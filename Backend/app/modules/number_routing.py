"""Inbound routing state for a phone number.

A number is *operational* only when the voice provider has confirmed that an
agent answers it. This module exists to keep that sentence true:

* a local assignment is recorded immediately but reported as ``pending``;
* a provider answer is only trusted when the response was real - a simulated
  (credential-less) response confirms nothing;
* ``last_synced_at`` is written only when a provider answer arrived, so it is
  the single piece of evidence behind ``confirmed``;
* no provider id, workspace id or credential is ever returned to a caller.

Nothing here places a call. Creating a deployment does make the number answer,
which is why it is only reached from an explicit assignment and never from a
read.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import AppError
from app.core.logging import get_logger
from app.database.base import utcnow
from app.database.models.employee import Employee, EmployeeAgentBinding
from app.database.models.phone_number import PhoneNumber, PhoneNumberStatus
from app.database.models.provider import DEFAULT_PROVIDER, ProviderDeployment
from app.integrations import sanitize
from app.integrations.voice_provider import get_voice_provider
from app.schemas.phone_number import NumberRoutingOut

logger = get_logger(__name__)

#: Deployment states that mean we have asked the provider (or it agreed) to
#: answer this number. ``deleted`` and ``failed`` are closed states.
OPEN_STATES = ("pending", "active", "paused")

_NO_EMPLOYEE = "Assign an AI employee to answer calls to this number."
_NOT_CONFIGURED = "This number is not configured with the voice provider yet."
_UNCONFIRMED = (
    "The voice provider has not confirmed this number yet. "
    "Retry routing, or check the provider configuration."
)
_REFUSED = (
    "The voice provider did not accept this number's configuration. "
    "Check the provider configuration and retry."
)


# ---------------------------------------------------------------------------
# Reading
# ---------------------------------------------------------------------------
def _deployments_for(
    db: Session, number_ids: list[str]
) -> dict[str, ProviderDeployment]:
    """The newest inbound deployment per number, keyed by number id."""
    if not number_ids:
        return {}

    rows = (
        db.execute(
            select(ProviderDeployment)
            .where(
                ProviderDeployment.phone_number_id.in_(number_ids),
                ProviderDeployment.channel_direction == "inbound",
            )
            .order_by(ProviderDeployment.created_at.desc())
        )
        .scalars()
        .all()
    )

    newest: dict[str, ProviderDeployment] = {}
    for row in rows:
        # Ordered newest first, so the first row seen for an id is the current
        # one; anything older is history that the row already replaced.
        newest.setdefault(str(row.phone_number_id), row)
    return newest


def describe(
    number: PhoneNumber,
    deployment: ProviderDeployment | None,
    employees: dict[str, Employee] | None = None,
) -> NumberRoutingOut:
    """What the workspace may believe about this number's inbound routing."""
    if not number.employee_id:
        return NumberRoutingOut(
            state="unconfigured",
            confirmed=False,
            detail=(
                "This number has been released."
                if number.status == str(PhoneNumberStatus.RELEASED)
                else _NO_EMPLOYEE
            ),
        )

    if deployment is None:
        return NumberRoutingOut(state="pending", confirmed=False, detail=_NOT_CONFIGURED)

    confirmed = deployment.last_synced_at is not None
    checked_at = deployment.last_synced_at

    if deployment.deployment_status == "failed":
        # A refusal is a real answer from the provider, so it is reported as one
        # rather than being softened into "pending".
        return NumberRoutingOut(
            state="failed", confirmed=confirmed, detail=_REFUSED, checked_at=checked_at
        )

    if not confirmed:
        # Active or paused locally, but no provider answer ever arrived: the
        # local intent is not routing, and saying otherwise would be a lie.
        return NumberRoutingOut(state="pending", confirmed=False, detail=_UNCONFIRMED)

    if deployment.deployment_status == "active":
        employee = (employees or {}).get(str(number.employee_id))
        who = employee.name if employee is not None else "your AI employee"
        return NumberRoutingOut(
            state="active",
            confirmed=True,
            detail=f"Calls to this number are answered by {who}.",
            checked_at=checked_at,
        )

    if deployment.deployment_status == "paused":
        return NumberRoutingOut(
            state="paused",
            confirmed=True,
            detail="Routing is paused; calls to this number are not answered here.",
            checked_at=checked_at,
        )

    return NumberRoutingOut(
        state="pending",
        confirmed=False,
        detail="This number is no longer routed. Assign an AI employee to route it again.",
        checked_at=checked_at,
    )


def routing_for(
    db: Session, numbers: list[PhoneNumber]
) -> dict[str, NumberRoutingOut]:
    """Routing for a page of numbers, in two queries rather than two per row."""
    if not numbers:
        return {}

    deployments = _deployments_for(db, [str(row.id) for row in numbers])
    employee_ids = {str(row.employee_id) for row in numbers if row.employee_id}
    employees = (
        {
            str(row.id): row
            for row in db.execute(
                select(Employee).where(Employee.id.in_(list(employee_ids)))
            )
            .scalars()
            .all()
        }
        if employee_ids
        else {}
    )

    return {
        str(number.id): describe(
            number, deployments.get(str(number.id)), employees
        )
        for number in numbers
    }


# ---------------------------------------------------------------------------
# Writing
# ---------------------------------------------------------------------------
def _current(db: Session, number: PhoneNumber) -> ProviderDeployment | None:
    """The deployment row this number may reuse, if any.

    One row per number rather than one per assignment: it is the record of the
    number's inbound state, and replacing it on every assignment would leave a
    trail of orphans that point at a deployment nobody stopped.
    """
    return (
        db.execute(
            select(ProviderDeployment)
            .where(
                ProviderDeployment.organization_id == number.organization_id,
                ProviderDeployment.phone_number_id == number.id,
                ProviderDeployment.channel_direction == "inbound",
            )
            .order_by(ProviderDeployment.created_at.desc())
        )
        .scalars()
        .first()
    )


def _agent_binding(db: Session, employee: Employee) -> EmployeeAgentBinding | None:
    return (
        db.execute(
            select(EmployeeAgentBinding).where(
                EmployeeAgentBinding.employee_id == employee.id
            )
        )
        .scalars()
        .first()
    )


def configure_inbound(
    db: Session,
    *,
    number: PhoneNumber,
    employee: Employee,
    user_id: str | None,
) -> ProviderDeployment:
    """Ask the provider to answer this number with this employee's agent.

    A provider problem never raises: the local record is written either way, so
    the workspace can see that the number is not answering instead of getting a
    failed assignment it cannot act on. Repeating the call is the retry.
    """
    deployment = _current(db, number)
    if deployment is None:
        deployment = ProviderDeployment(
            organization_id=number.organization_id,
            employee_id=employee.id,
            phone_number_id=number.id,
            provider=DEFAULT_PROVIDER,
            channel_direction="inbound",
            deployment_status="pending",
        )
        db.add(deployment)
    else:
        # Rebinding to a different employee replaces the agent that answers.
        deployment.employee_id = employee.id

    deployment.deployment_status = "pending"
    deployment.last_synced_at = None
    deployment.external_connection_id = (
        str(settings.sarvam_connection_id or "").strip() or None
    )
    db.flush()

    binding = _agent_binding(db, employee)
    if binding is None or not str(binding.app_id or "").strip():
        # The employee has no provider agent yet. Turning calling on for the
        # employee is what creates one, so there is nothing to deploy here.
        logger.info(
            "routing_waiting_for_agent",
            number_id=number.id,
            employee_id=employee.id,
        )
        return deployment

    provider = get_voice_provider()
    try:
        result = provider.create_deployment(
            agent_id=str(binding.app_id).strip(),
            agent_version=int(binding.app_version or 1),
            name=employee.name,
            connection_id=deployment.external_connection_id or "",
            phone_number=number.number,
            description=f"Inbound line for {employee.name}",
        )
    except AppError as exc:
        # An unavailable capability or an unaddressed workspace is a provider
        # problem, not a reason to lose the assignment.
        deployment.deployment_status = "pending"
        logger.warning(
            "routing_not_configured",
            number_id=number.id,
            employee_id=employee.id,
            error=exc.message,
        )
        return deployment

    if not result.ok:
        deployment.deployment_status = "failed"
        logger.warning(
            "routing_provider_refused",
            number_id=number.id,
            employee_id=employee.id,
            error=sanitize(result.error),
        )
        return deployment

    if result.simulated:
        # No credential is configured, so nothing exists at the provider. The
        # row stays pending and unconfirmed; it must not read as a live line.
        logger.info("routing_simulated", number_id=number.id, user_id=user_id)
        return deployment

    external_id = str(
        result.data.get("deployment_id") or result.data.get("id") or ""
    ).strip()
    if external_id:
        deployment.external_deployment_id = external_id
    deployment.deployment_status = "active"
    deployment.deployed_at = utcnow()
    deployment.last_synced_at = utcnow()
    logger.info(
        "routing_confirmed",
        number_id=number.id,
        employee_id=employee.id,
    )
    return deployment


def stop_inbound(
    db: Session,
    *,
    number: PhoneNumber,
    user_id: str | None,
) -> ProviderDeployment | None:
    """Ask the provider to stop answering, and close the local record.

    The row always ends ``paused``: that is the requested state whether or not
    the provider confirmed it, and ``last_synced_at`` still separates a
    confirmed pause from a requested one. Only a confirmed ``active`` row blocks
    releasing the line, so a number can always be given up.
    """
    deployment = _current(db, number)
    if deployment is None or deployment.deployment_status in ("paused", "deleted"):
        return deployment

    confirmed = False
    if deployment.external_deployment_id:
        try:
            result = get_voice_provider().pause_deployment(
                deployment.external_deployment_id
            )
            confirmed = result.ok and not result.simulated
            if not confirmed:
                logger.warning(
                    "routing_pause_unconfirmed",
                    number_id=number.id,
                    error=sanitize(result.error),
                )
        except AppError as exc:
            logger.warning(
                "routing_pause_failed",
                number_id=number.id,
                error=exc.message,
            )

    deployment.deployment_status = "paused"
    deployment.last_synced_at = utcnow() if confirmed else None
    logger.info(
        "routing_stopped",
        number_id=number.id,
        confirmed=confirmed,
        user_id=user_id,
    )
    return deployment


__all__ = [
    "OPEN_STATES",
    "configure_inbound",
    "describe",
    "routing_for",
    "stop_inbound",
]
