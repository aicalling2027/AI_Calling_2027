"""Workspace (organization) and team management."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.api.deps import DbSession, Principal, require_permissions
from app.core.constants import Perm
from app.core.exceptions import PermissionDeniedError
from app.modules import organizations
from app.schemas.common import MessageResponse
from app.schemas.organization import (
    MemberInvite,
    MemberOut,
    MemberUpdate,
    OrganizationOut,
    OrganizationUpdate,
    OrganizationWithMembers,
)

router = APIRouter(prefix="/organizations", tags=["Organization"])

OrgReader = Annotated[Principal, Depends(require_permissions(Perm.ORG_READ))]
OrgWriter = Annotated[Principal, Depends(require_permissions(Perm.ORG_WRITE))]
UserReader = Annotated[Principal, Depends(require_permissions(Perm.USERS_READ))]
UserWriter = Annotated[Principal, Depends(require_permissions(Perm.USERS_WRITE))]


@router.get("/current", response_model=OrganizationWithMembers, summary="Current workspace")
def current_workspace(principal: OrgReader, db: DbSession) -> OrganizationWithMembers:
    return organizations.organization_with_members(db, principal.organization)


@router.patch("/current", response_model=OrganizationOut, summary="Update workspace settings")
def update_workspace(
    payload: OrganizationUpdate, principal: OrgWriter, db: DbSession
) -> OrganizationOut:
    return organizations.update_organization(
        db, principal.organization, payload, user_id=principal.user_id
    )


@router.get("/members", response_model=list[MemberOut], summary="List team members")
def list_members(principal: UserReader, db: DbSession) -> list[MemberOut]:
    return organizations.list_members(db, principal.organization_id)


@router.post(
    "/members",
    response_model=MemberOut,
    status_code=status.HTTP_201_CREATED,
    summary="Invite a teammate",
)
def invite_member(
    payload: MemberInvite, principal: UserWriter, db: DbSession
) -> MemberOut:
    if str(payload.role) == "owner":
        raise PermissionDeniedError("Ownership transfer is not available through invitations.")
    return organizations.invite_member(
        db, principal.organization_id, payload, actor_id=principal.user_id
    )


@router.patch("/members/{member_id}", response_model=MemberOut, summary="Change a member's role")
def update_member(
    member_id: str, payload: MemberUpdate, principal: UserWriter, db: DbSession
) -> MemberOut:
    return organizations.update_member(
        db, principal.organization_id, member_id, payload, actor_id=principal.user_id
    )


@router.delete("/members/{member_id}", response_model=MessageResponse, summary="Remove a member")
def remove_member(member_id: str, principal: UserWriter, db: DbSession) -> MessageResponse:
    organizations.remove_member(
        db, principal.organization_id, member_id, actor_id=principal.user_id
    )
    return MessageResponse(message="Member removed from the workspace.")
