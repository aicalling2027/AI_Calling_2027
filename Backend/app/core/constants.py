"""Domain constants and reference data.

These mirror the PRD: supported languages, voices, AI models, call outcomes,
lead sources, subscription plans and the built-in employee templates.
"""

from __future__ import annotations

from enum import StrEnum
from typing import Final


# ---------------------------------------------------------------------------
# Roles & permissions
# ---------------------------------------------------------------------------
class Role(StrEnum):
    SUPER_ADMIN = "super_admin"
    OWNER = "owner"
    ADMIN = "admin"
    MANAGER = "manager"
    MEMBER = "member"


#: Fine-grained permission strings, used by ``require_permission``.
class Perm(StrEnum):
    ORG_READ = "org:read"
    ORG_WRITE = "org:write"
    USERS_READ = "users:read"
    USERS_WRITE = "users:write"
    EMPLOYEES_READ = "employees:read"
    EMPLOYEES_WRITE = "employees:write"
    TRAINING_READ = "training:read"
    TRAINING_WRITE = "training:write"
    LEADS_READ = "leads:read"
    LEADS_WRITE = "leads:write"
    CAMPAIGNS_READ = "campaigns:read"
    CAMPAIGNS_WRITE = "campaigns:write"
    CALLS_READ = "calls:read"
    CALLS_WRITE = "calls:write"
    CONVERSATIONS_READ = "conversations:read"
    PHONE_NUMBERS_READ = "phone_numbers:read"
    PHONE_NUMBERS_WRITE = "phone_numbers:write"
    BILLING_READ = "billing:read"
    BILLING_WRITE = "billing:write"
    INTEGRATIONS_READ = "integrations:read"
    INTEGRATIONS_WRITE = "integrations:write"
    ANALYTICS_READ = "analytics:read"
    DEVELOPERS_READ = "developers:read"
    DEVELOPERS_WRITE = "developers:write"


_READ_ONLY: Final[frozenset[Perm]] = frozenset(
    {
        Perm.ORG_READ,
        Perm.EMPLOYEES_READ,
        Perm.TRAINING_READ,
        Perm.LEADS_READ,
        Perm.CAMPAIGNS_READ,
        Perm.CALLS_READ,
        Perm.CONVERSATIONS_READ,
        Perm.PHONE_NUMBERS_READ,
        Perm.ANALYTICS_READ,
    }
)

_PERMISSIONS: Final[dict[Role, frozenset[Perm]]] = {
    Role.SUPER_ADMIN: frozenset(Perm),
    Role.OWNER: frozenset(Perm),
    Role.ADMIN: frozenset(
        set(Perm)
        - {Perm.BILLING_WRITE, Perm.DEVELOPERS_WRITE, Perm.ORG_WRITE}
        | {Perm.BILLING_READ, Perm.DEVELOPERS_READ}
    ),
    Role.MANAGER: frozenset(
        _READ_ONLY
        | {
            Perm.LEADS_WRITE,
            Perm.TRAINING_READ,
            Perm.CAMPAIGNS_WRITE,
            Perm.CALLS_WRITE,
        }
    ),
    Role.MEMBER: frozenset(
        {
            Perm.ORG_READ,
            Perm.EMPLOYEES_READ,
            Perm.LEADS_READ,
            Perm.CALLS_READ,
            Perm.CONVERSATIONS_READ,
            Perm.ANALYTICS_READ,
        }
    ),
}


def permissions_for(role: Role | str) -> frozenset[str]:
    """Resolve a role (name or enum) to its permission set."""
    if isinstance(role, str):
        try:
            role = Role(role)
        except ValueError:
            try:
                role = Role[role.upper()]
            except KeyError:
                return frozenset()
    resolved = _PERMISSIONS.get(role, frozenset())
    return frozenset(str(p) for p in resolved)


# ---------------------------------------------------------------------------
# Languages, voices, models
# ---------------------------------------------------------------------------
#: 15+ Indian languages targeted by the PRD, keyed by BCP-47 / Sarvam code.
SUPPORTED_LANGUAGES: Final[dict[str, str]] = {
    "hi-IN": "Hindi",
    "en-IN": "English (India)",
    "ta-IN": "Tamil",
    "te-IN": "Telugu",
    "bn-IN": "Bengali",
    "mr-IN": "Marathi",
    "gu-IN": "Gujarati",
    "kn-IN": "Kannada",
    "ml-IN": "Malayalam",
    "pa-IN": "Punjabi",
    "or-IN": "Odia",
    "as-IN": "Assamese",
    "ur-IN": "Urdu",
    "ne-IN": "Nepali",
    "sa-IN": "Sanskrit",
    "kok-IN": "Konkani",
    "mai-IN": "Maithili",
    "sd-IN": "Sindhi",
}

DEFAULT_LANGUAGE: Final[str] = "en-IN"

#: Sarvam Bulbul speaker presets mapped to a gender label for the UI.
SUPPORTED_VOICES: Final[dict[str, str]] = {
    "shubh": "male",
    "tanya": "female",
    "anand": "male",
    "sunny": "male",
    "mani": "male",
    "kabir": "male",
    "priya": "female",
    "kavya": "female",
    "ritu": "female",
}

#: The public voice catalogue - what the marketing site lists and what the
#: preview endpoint synthesises. Every Bulbul speaker can speak every supported
#: language; ``languages`` lists the ones this deployment actually uses the
#: voice for, so the UI shows a short, honest set of chips rather than all 18.
#:
#: ``sample`` is fixed server-side: the preview endpoint reads it from here
#: instead of accepting text from the caller, so it can never be used as a free
#: text-to-speech proxy.
VOICE_PROFILES: Final[tuple[dict[str, object], ...]] = (
    {
        "id": "shubh",
        "name": "Shubh",
        "gender": "male",
        "personality": "Confident & bold",
        "use_case": "Sales",
        "languages": ("en-IN", "hi-IN", "ta-IN"),
        "preview_language": "en-IN",
        "sample": (
            "Hello, Shubh from AOTMS. I'm calling about the plan you asked "
            "about - can I take two minutes of your time?"
        ),
        "featured": True,
    },
    {
        "id": "tanya",
        "name": "Tanya",
        "gender": "female",
        "personality": "Friendly & modern",
        "use_case": "Support",
        "languages": ("en-IN", "hi-IN", "bn-IN"),
        "preview_language": "hi-IN",
        "sample": (
            "नमस्ते! मैं AOTMS से तान्या बोल रही हूँ। आपकी शिकायत दर्ज हो गई है "
            "और हम आज ही समाधान भेज देंगे।"
        ),
        "featured": True,
    },
    {
        "id": "anand",
        "name": "Anand",
        "gender": "male",
        "personality": "Warm & reassuring",
        "use_case": "Reminders",
        "languages": ("en-IN", "hi-IN", "te-IN"),
        "preview_language": "hi-IN",
        "sample": (
            "नमस्ते! आनंद बोल रहा हूँ AOTMS से। आपका अपॉइंटमेंट कल सुबह दस बजे "
            "तय है।"
        ),
        "featured": True,
    },
    {
        "id": "sunny",
        "name": "Sunny",
        "gender": "male",
        "personality": "Cheerful & upbeat",
        "use_case": "Marketing",
        "languages": ("en-IN", "hi-IN", "ml-IN"),
        "preview_language": "en-IN",
        "sample": (
            "Hi! Sunny from AOTMS with a quick update on this month's "
            "offer - it takes under a minute."
        ),
        "featured": False,
    },
    {
        "id": "mani",
        "name": "Mani",
        "gender": "male",
        "personality": "Calm & composed",
        "use_case": "Collections",
        "languages": ("en-IN", "hi-IN", "kn-IN"),
        "preview_language": "en-IN",
        "sample": (
            "Hello, Mani calling from AOTMS about the invoice due this week. "
            "May I confirm the payment date?"
        ),
        "featured": False,
    },
    {
        "id": "kabir",
        "name": "Kabir",
        "gender": "male",
        "personality": "Steady & trustworthy",
        "use_case": "Renewals",
        "languages": ("en-IN", "hi-IN", "gu-IN"),
        "preview_language": "en-IN",
        "sample": (
            "Good evening, Kabir from AOTMS. Your plan renews on Friday and "
            "I wanted to check whether anything needs changing."
        ),
        "featured": False,
    },
    {
        "id": "priya",
        "name": "Priya",
        "gender": "female",
        "personality": "Clear & precise",
        "use_case": "Surveys",
        "languages": ("en-IN", "hi-IN", "mr-IN"),
        "preview_language": "en-IN",
        "sample": (
            "Hello, this is Priya from AOTMS with a two-question feedback "
            "call. Shall I continue?"
        ),
        "featured": False,
    },
)

SUPPORTED_MODELS: Final[dict[str, dict[str, object]]] = {
    "sarvam-m": {
        "provider": "sarvam",
        "display_name": "Sarvam M",
        "languages": ["hi-IN", "en-IN", "bn-IN", "ta-IN", "te-IN", "gu-IN", "kn-IN", "ml-IN", "mr-IN", "pa-IN", "or-IN"],
        "capabilities": ["chat", "function_calling", "multilingual"],
    },
    "sarvam-2b": {
        "provider": "sarvam",
        "display_name": "Sarvam 2B",
        "languages": ["hi-IN", "en-IN", "bn-IN", "ta-IN", "te-IN"],
        "capabilities": ["chat", "low_latency"],
    },
}

DEFAULT_MODEL: Final[str] = "sarvam-m"

# ---------------------------------------------------------------------------
# Enumerations used by models and schemas
# ---------------------------------------------------------------------------
class EmployeeStatus(StrEnum):
    DRAFT = "draft"
    ACTIVE = "active"
    PAUSED = "paused"
    ARCHIVED = "archived"


class LeadStatus(StrEnum):
    NEW = "new"
    QUEUED = "queued"
    CALLING = "calling"
    CONTACTED = "contacted"
    QUALIFIED = "qualified"
    NOT_INTERESTED = "not_interested"
    UNREACHABLE = "unreachable"
    CONVERTED = "converted"
    DNC = "dnc"


class LeadSource(StrEnum):
    INSTANT = "instant"
    BULK_CAMPAIGN = "bulk_campaign"
    INBOUND = "inbound"
    GOOGLE_SHEETS = "google_sheets"
    META_LEAD_ADS = "meta_lead_ads"
    MANUAL_UPLOAD = "manual_upload"
    API = "api"
    OTHER = "other"


class CampaignStatus(StrEnum):
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class CallDirection(StrEnum):
    INBOUND = "inbound"
    OUTBOUND = "outbound"


class CallStatus(StrEnum):
    QUEUED = "queued"
    INITIATED = "initiated"
    RINGING = "ringing"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    NO_ANSWER = "no_answer"
    BUSY = "busy"
    CANCELLED = "cancelled"

    @classmethod
    def terminal(cls) -> set["CallStatus"]:
        return {cls.COMPLETED, cls.FAILED, cls.NO_ANSWER, cls.BUSY, cls.CANCELLED}


class CallOutcome(StrEnum):
    SUCCESSFUL = "successful"
    LEAD_CAPTURED = "lead_captured"
    APPOINTMENT_BOOKED = "appointment_booked"
    INTERESTED = "interested"
    NOT_INTERESTED = "not_interested"
    NO_ANSWER = "no_answer"
    BUSY = "busy"
    FAILED = "failed"
    TRANSFERRED_TO_HUMAN = "transferred_to_human"
    OTHER = "other"


class PhoneNumberStatus(StrEnum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    PENDING = "pending"
    RELEASED = "released"


class IntegrationStatus(StrEnum):
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    ERROR = "error"


class BillingInterval(StrEnum):
    MONTHLY = "monthly"
    YEARLY = "yearly"


class LedgerEntryType(StrEnum):
    CREDIT = "credit"
    DEBIT = "debit"
    REFUND = "refund"
    ADJUSTMENT = "adjustment"


class TrainingSourceType(StrEnum):
    PDF = "pdf"
    DOCX = "docx"
    TXT = "txt"
    URL = "url"
    FAQ = "faq"
    TEXT = "text"


class TrainingJobStatus(StrEnum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


# ---------------------------------------------------------------------------
# Billing defaults
# ---------------------------------------------------------------------------
class CreditCost:
    """Credit consumption per billable action."""

    OUTBOUND_CALL_PER_MINUTE: Final[int] = 2
    INBOUND_CALL_PER_MINUTE: Final[int] = 1
    WHATSAPP_MESSAGE: Final[int] = 1
    KNOWLEDGE_EMBEDDING_PER_1K_TOKENS: Final[int] = 1


DEFAULT_PLANS: Final[list[dict[str, object]]] = [
    {
        "code": "starter",
        "name": "Starter",
        "price_inr": 4999,
        "billing_interval": "monthly",
        "included_credits": 5000,
        "max_employees": 2,
        "max_phone_numbers": 1,
        "features": ["inbound_calls", "instant_leads", "whatsapp_notifications"],
    },
    {
        "code": "growth",
        "name": "Growth",
        "price_inr": 14999,
        "billing_interval": "monthly",
        "included_credits": 20000,
        "max_employees": 10,
        "max_phone_numbers": 5,
        "features": ["bulk_campaigns", "knowledge_base", "crm_sync", "analytics"],
    },
    {
        "code": "enterprise",
        "name": "Enterprise",
        "price_inr": 49999,
        "billing_interval": "monthly",
        "included_credits": 100000,
        "max_employees": 100,
        "max_phone_numbers": 50,
        "features": ["priority_support", "custom_integrations", "sso", "dedicated_infra"],
    },
]

#: Credits granted to a brand-new organization so it can trial the platform.
TRIAL_CREDITS: Final[int] = 500


# ---------------------------------------------------------------------------
# Built-in employee templates (PRD 7.7)
# ---------------------------------------------------------------------------
EMPLOYEE_TEMPLATES: Final[list[dict[str, object]]] = [
    {
        "key": "insurance_finance",
        "category": "Insurance & Finance",
        "name": "Insurance Advisor",
        "description": "Qualifies insurance and loan enquiries and books advisor callbacks.",
        "suggested_role": "Insurance advisor",
        "default_prompt": (
            "You are Riya, a warm and professional insurance advisor for {business_name}. "
            "Greet the customer, confirm the product they are interested in, capture their "
            "age, city and sum assured requirement, explain the key benefits in one or two "
            "sentences, and offer to book a callback with a licensed advisor. Never promise "
            "returns or guarantees. Keep every turn under 40 words."
        ),
        "suggested_languages": ["hi-IN", "en-IN", "ta-IN"],
        "suggested_voice": "tanya",
        "conversation_guidelines": [
            "Confirm identity before discussing policy details.",
            "Capture name, city, product interest and preferred callback slot.",
            "Never quote exact premiums; route to a licensed advisor.",
        ],
        "suggested_outcomes": ["lead_captured", "appointment_booked", "not_interested"],
    },
    {
        "key": "travel_tourism",
        "category": "Travel & Tourism",
        "name": "Travel Consultant",
        "description": "Handles holiday and package enquiries and shares itineraries.",
        "suggested_role": "Travel consultant",
        "default_prompt": (
            "You are Kabir, a friendly travel consultant for {business_name}. Ask for the "
            "destination, travel dates, number of travellers and budget range, then suggest "
            "one suitable package and offer to send details on WhatsApp. Be concise and "
            "enthusiastic."
        ),
        "suggested_languages": ["hi-IN", "en-IN"],
        "suggested_voice": "shubh",
        "conversation_guidelines": [
            "Capture destination, dates, traveller count and budget.",
            "Confirm the WhatsApp number for sending the itinerary.",
        ],
        "suggested_outcomes": ["lead_captured", "interested", "not_interested"],
    },
    {
        "key": "hospital_clinic",
        "category": "Hospital & Clinic",
        "name": "Clinic Receptionist",
        "description": "Books, reschedules and confirms clinic appointments.",
        "suggested_role": "Front desk receptionist",
        "default_prompt": (
            "You are Anjali, the front desk assistant for {business_name}. Help the caller "
            "book an appointment: collect patient name, preferred department, doctor "
            "preference and preferred date/time. Confirm the slot and mention the clinic "
            "address. If the caller describes an emergency, advise them to call emergency "
            "services immediately. Never give medical advice."
        ),
        "suggested_languages": ["hi-IN", "en-IN", "te-IN", "kn-IN"],
        "suggested_voice": "priya",
        "conversation_guidelines": [
            "Never provide medical advice or diagnosis.",
            "Escalate emergency descriptions immediately.",
            "Always read back the confirmed appointment slot.",
        ],
        "suggested_outcomes": ["appointment_booked", "lead_captured", "transferred_to_human"],
    },
    {
        "key": "coaching_tuition",
        "category": "Coaching & Tuitions",
        "name": "Admissions Counsellor",
        "description": "Handles course enquiries and schedules counselling sessions.",
        "suggested_role": "Admissions counsellor",
        "default_prompt": (
            "You are Rohan, an admissions counsellor for {business_name}. Find out the "
            "student's class or grade, the course of interest and the parent's availability, "
            "then explain the course structure briefly and invite them for a free demo class."
        ),
        "suggested_languages": ["hi-IN", "en-IN", "mr-IN"],
        "suggested_voice": "anand",
        "conversation_guidelines": [
            "Collect student grade, course interest and parent contact.",
            "Offer a free demo class instead of quoting fees directly.",
        ],
        "suggested_outcomes": ["lead_captured", "appointment_booked", "interested"],
    },
    {
        "key": "real_estate",
        "category": "Real Estate",
        "name": "Property Advisor",
        "description": "Qualifies property buyers and books site visits.",
        "suggested_role": "Property advisor",
        "default_prompt": (
            "You are Neha, a property advisor for {business_name}. Qualify the caller on "
            "budget, preferred locality, property type (1BHK/2BHK/3BHK/villa) and possession "
            "timeline, then offer a site visit and confirm a slot."
        ),
        "suggested_languages": ["hi-IN", "en-IN", "gu-IN", "mr-IN"],
        "suggested_voice": "kavya",
        "conversation_guidelines": [
            "Qualify budget, locality, configuration and timeline.",
            "Always offer a site visit with a concrete time slot.",
        ],
        "suggested_outcomes": ["lead_captured", "appointment_booked", "not_interested"],
    },
    {
        "key": "local_services",
        "category": "Local Services",
        "name": "Service Coordinator",
        "description": "Takes service requests and schedules technician visits.",
        "suggested_role": "Service coordinator",
        "default_prompt": (
            "You are Suresh, a service coordinator for {business_name}. Understand the issue, "
            "collect the full address and landmark, agree a service window, and confirm that a "
            "technician will call before arriving."
        ),
        "suggested_languages": ["hi-IN", "en-IN", "ta-IN", "ml-IN"],
        "suggested_voice": "mani",
        "conversation_guidelines": [
            "Capture issue, address, landmark and preferred service window.",
            "Confirm that the technician calls before arrival.",
        ],
        "suggested_outcomes": ["appointment_booked", "lead_captured", "other"],
    },
    {
        "key": "jewellery_fashion",
        "category": "Jewellery & Fashion",
        "name": "Store Consultant",
        "description": "Handles product enquiries and store visit bookings.",
        "suggested_role": "Store consultant",
        "default_prompt": (
            "You are Meera, a store consultant for {business_name}. Understand whether the "
            "caller is looking for bridal, daily wear or gifting, note the budget range, and "
            "invite them to the nearest store or share the catalogue on WhatsApp."
        ),
        "suggested_languages": ["hi-IN", "en-IN", "ta-IN", "te-IN"],
        "suggested_voice": "ritu",
        "conversation_guidelines": [
            "Identify occasion and budget range.",
            "Prefer store visit or WhatsApp catalogue over price negotiation.",
        ],
        "suggested_outcomes": ["lead_captured", "appointment_booked", "interested"],
    },
]


# ---------------------------------------------------------------------------
# Dashboard outcome groupings (PRD 5.2-I)
# ---------------------------------------------------------------------------
OUTCOME_GROUPS: Final[dict[str, list[str]]] = {
    "positive": ["successful", "lead_captured", "appointment_booked", "interested"],
    "negative": ["not_interested", "no_answer", "busy", "failed"],
    "human": ["transferred_to_human"],
    "other": ["other"],
}
