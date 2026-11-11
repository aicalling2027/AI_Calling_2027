"""ORM model registry.

Importing this package registers every table on ``Base.metadata``; Alembic and
``create_all`` rely on that side effect.
"""

from app.database.models.billing import (
    CreditAccount,
    CreditLedger,
    Invoice,
    Payment,
    Subscription,
    SubscriptionPlan,
    UsageRecord,
)
from app.database.models.call import (
    Call,
    CallEvent,
    CallRecording,
    Conversation,
    ConversationOutcome,
    ConversationSummary,
    ExtractedInformation,
    Transcript,
)
from app.database.models.campaign import (
    Campaign,
    CampaignAttempt,
    CampaignContact,
    CampaignSchedule,
)
from app.database.models.employee import (
    ActionExecution,
    Employee,
    EmployeeAction,
    EmployeeLanguage,
    EmployeePromptVersion,
)
from app.database.models.integration import (
    Integration,
    IntegrationCredential,
    IntegrationLog,
    NotificationLog,
    Webhook,
    Workflow,
    WorkflowExecution,
)
from app.database.models.lead import (
    Contact,
    FollowUp,
    Lead,
    LeadActivity,
    LeadAssignment,
    LeadSourceDefinition,
)
from app.database.models.organization import (
    ApiKey,
    AuditLog,
    Organization,
    OrganizationMember,
    RefreshToken,
    User,
)
from app.database.models.phone_number import (
    PhoneNumber,
    PhoneNumberAssignment,
    TelephonyProvider,
)
from app.database.models.training import (
    EmployeeKnowledgeSource,
    KnowledgeChunk,
    TrainingDocument,
    TrainingJob,
    TrainingSource,
)

__all__ = [
    # Organization & access
    "Organization",
    "User",
    "OrganizationMember",
    "RefreshToken",
    "ApiKey",
    "AuditLog",
    # Employees
    "Employee",
    "EmployeeLanguage",
    "EmployeePromptVersion",
    "EmployeeAction",
    "ActionExecution",
    # Training
    "TrainingSource",
    "TrainingDocument",
    "TrainingJob",
    "KnowledgeChunk",
    "EmployeeKnowledgeSource",
    # Leads
    "Contact",
    "LeadSourceDefinition",
    "Lead",
    "LeadAssignment",
    "LeadActivity",
    "FollowUp",
    # Campaigns
    "Campaign",
    "CampaignContact",
    "CampaignAttempt",
    "CampaignSchedule",
    # Calls
    "Call",
    "CallEvent",
    "Conversation",
    "Transcript",
    "ConversationSummary",
    "ConversationOutcome",
    "ExtractedInformation",
    "CallRecording",
    # Phone numbers
    "PhoneNumber",
    "PhoneNumberAssignment",
    "TelephonyProvider",
    # Billing
    "SubscriptionPlan",
    "Subscription",
    "CreditAccount",
    "CreditLedger",
    "UsageRecord",
    "Payment",
    "Invoice",
    # Integrations & automation
    "Integration",
    "IntegrationCredential",
    "IntegrationLog",
    "Workflow",
    "WorkflowExecution",
    "Webhook",
    "NotificationLog",
]
