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

#: Every speaker id an employee may be configured with.
#:
#: Three generations live here on purpose. The nine names at the top are the
#: original Bulbul presets, and employees already saved with one of them must
#: keep validating - dropping them would turn an unrelated edit into a 422.
#: The names below them are the rest of the model's speaker set, added so an
#: employee can be built on any voice the catalogue publishes. The UUIDs after
#: that are the ids an older copy of the catalogue issued, kept for the rows
#: that still carry one.
#:
#: ``"unspecified"`` is the honest label for a speaker the provider does not
#: describe: guessing male/female would print a claim we cannot verify in
#: front of a customer.
SUPPORTED_VOICES: Final[dict[str, str]] = {
    # -- Original presets, kept for existing rows -------------------------
    "shubh": "male",
    "tanya": "female",
    "anand": "male",
    "sunny": "male",
    "mani": "male",
    "kabir": "male",
    "priya": "female",
    "kavya": "female",
    "ritu": "female",
    # -- The rest of the speaker set --------------------------------------
    # Keep this block in step with ``VOICE_PROFILES``: a speaker the catalogue
    # lists but this map rejects is a 422 on save.
    "aditya": "male",
    "ashutosh": "unspecified",
    "neha": "female",
    "rahul": "male",
    "pooja": "female",
    "rohan": "unspecified",
    "simran": "female",
    "amit": "unspecified",
    "dev": "unspecified",
    "ishita": "unspecified",
    "shreya": "female",
    "ratan": "unspecified",
    "varun": "unspecified",
    "manan": "unspecified",
    "sumit": "unspecified",
    "roopa": "unspecified",
    "aayan": "unspecified",
    "advait": "unspecified",
    "tarun": "unspecified",
    "gokul": "male",
    "vijay": "male",
    "shruti": "unspecified",
    "suhani": "female",
    "mohit": "unspecified",
    "kavitha": "unspecified",
    "rehan": "unspecified",
    "soham": "unspecified",
    "rupali": "unspecified",
    # -- Older catalogue ids ----------------------------------------------
    "01a0cf16-7021-76f7-a0cc-9d065cdb30a8": "unspecified",
    "01a0cf16-5726-7055-8622-322e53f6bc77": "unspecified",
    "01a0cf16-73d4-78aa-a416-c593287484db": "unspecified",
    "01a0cf16-6001-7fac-b2c3-96de29fc6cd6": "unspecified",
    # This id was supplied twice; it is one voice, so it is listed once.
    "01a0cf16-729b-720b-bf53-1e18c3d5a5da": "unspecified",
    "01a0cf16-655d-78cb-8b68-a000a3e4878e": "unspecified",
    "01a0cf16-6ecd-7a97-b86b-f91eeadd5bd7": "unspecified",
    "01a0cf16-6b54-7b44-8dff-e67586a9762a": "unspecified",
    "01a0cf16-5a52-747d-8900-0a77b9f5402c": "unspecified",
    "01a0cf16-68c6-7341-8408-bceec24a6a06": "unspecified",
    "01a0cf16-5c61-787d-a83f-ae54ce8c0f96": "unspecified",
    "01a0cf16-7179-7472-b7df-b7b432d5faa5": "unspecified",
    "01a0cf16-6c54-746b-815a-2e1cf51a473a": "unspecified",
    "01a0cf16-6a07-7cee-b592-494b2d213be1": "unspecified",
    # -- Remaining catalogue ids -------------------------------------------
    # No name, gender or speaker accompanies these, so nothing more than the id
    # is known. Keep this list in step with ``UNNAMED_VOICE_IDS`` in the
    # frontend's ``content/workspace.ts``; an id missing here is a 422 on save.
    "01a0cf16-c8fa-7c70-a30e-0896e4695e86": "unspecified",
    "01a0cf16-8d27-75e7-a4f8-f71f57f86443": "unspecified",
    "01a0cf16-944c-78eb-9f80-81eb02c4bcb9": "unspecified",
    "01a0cf16-90ae-7470-941d-2c1f17b37528": "unspecified",
    "01a0e8fc-b042-7326-a139-e97058ab7c50": "unspecified",
    "01a0cf16-e8b3-7f97-909b-27be790e7330": "unspecified",
    "01a0cf16-98e5-7477-b1c4-73db8ad8ba82": "unspecified",
    "01a0cf16-8c17-7394-a54d-d11431e8a13a": "unspecified",
    "01a0e8fc-a461-75e4-b7d4-43e84745eee6": "unspecified",
    "01a0cf16-97b2-72b5-bdc4-4785b7a334ed": "unspecified",
    "01a0e8fc-9b0d-7595-b5b6-4ba0d403c566": "unspecified",
    "01a0cf16-b5cd-7a8b-a0f5-f3889c932e82": "unspecified",
    "01a0e8fc-8c7f-7a29-ad18-34060dd8bac2": "unspecified",
    "01a0e8fc-aee0-7e7b-9dd9-11c12bbe2bcd": "unspecified",
    "01a0e8fc-865c-715e-993e-3478d3a1fc1c": "unspecified",
    "01a0cf1a-7d5a-7bca-a22b-f36f7c6c1bbe": "unspecified",
    "01a0e8fc-87f8-73ff-bbc9-2b8b802b2b13": "unspecified",
    "01a0cf16-8e7d-72c5-9a8b-e3c431253630": "unspecified",
    "01a0cf16-955f-71e1-b1b6-68bf2fcf2172": "unspecified",
    "01a0cf16-96aa-7c19-89c0-2978daac5737": "unspecified",
    "01a0cf16-b371-767c-b137-81a1cd4d9eed": "unspecified",
    "01a0e8fc-b332-7ea8-9f1d-4f5495aff777": "unspecified",
    "01a0cf16-ecd8-7d99-8aab-265fd11bc871": "unspecified",
    "01a0e8fc-b0f1-72a6-ad04-96656a0d28d2": "unspecified",
    "01a0cf16-eba8-7528-a44c-eb42d4b2b5d9": "unspecified",
    "01a0cf16-e9ab-77e9-9953-2238f05c7110": "unspecified",
    "01a0cf16-b252-7218-996b-1d4902aae830": "unspecified",
    "01a0cf16-eddc-7cb3-823b-88731b6cbe29": "unspecified",
    "01a0cf17-0b6e-79f0-b8ab-7392cabc497b": "unspecified",
    "01a0e8fc-b2bb-781b-a7fa-f5b43f946f03": "unspecified",
    "01a0cf16-eabc-779c-a266-b37c1967acb3": "unspecified",
    "01a0e8fc-b168-741f-87a9-3ba15a7628ec": "unspecified",
    "01a0cf16-b474-782d-9743-13bdfc4c9a25": "unspecified",
    "01a0cf16-897b-76f8-8de9-34f27e861df6": "unspecified",
    "01a0cf16-8ac9-7d36-866f-b19d0c05a72d": "unspecified",
    "01a0cf17-17b8-7952-ab5c-ed9ea97a6925": "unspecified",
    "01a0cf17-1650-73b7-ac23-aad040439447": "unspecified",
    "01a0cf16-ef1b-7525-91f7-03bca0da8bf4": "unspecified",
    "01a0cf16-9a05-79b1-8110-4b923c936015": "unspecified",
    "01a0cf16-aff2-7919-b06c-9c03433f2ffd": "unspecified",
    "01a0cf17-07ec-7e82-976c-1115f36dda1b": "unspecified",
    "01a0cf16-ad8b-762d-8e12-73ddbae38db8": "unspecified",
    "01a0cf16-aee5-7a59-981c-e4e7b8b148a0": "unspecified",
    "01a0cf17-154d-7cc0-b5c3-b11b350d519b": "unspecified",
    "01a0cf16-da10-74b6-a33b-9640d0f046fd": "unspecified",
    "01a0cf16-d697-7eb3-b04f-79641a0aaef2": "unspecified",
    "01a0cf16-d30b-796e-b775-e33f383b004b": "unspecified",
    "01a0cf16-d447-7a70-a2a0-4dc350038a24": "unspecified",
    "01a0e8fc-aa0e-78f5-96a4-b4640a6446f9": "unspecified",
    "01a0e8fc-ab43-77e8-ab9d-2cec9ec5dfac": "unspecified",
    "01a0cf16-d8d6-70e3-8282-7494b008cb37": "unspecified",
    "01a0cf16-db1d-7fa1-b803-6c76b70c2917": "unspecified",
    "01a0cf16-dc66-7811-a129-ac6855ef5ca9": "unspecified",
    "01a0cf17-0200-70eb-86af-68c0147d2351": "unspecified",
    "01a0e8fc-accd-7171-b0e6-e952a20fc408": "unspecified",
    "01a0e8fc-abc0-7c93-aa6a-174eb836a648": "unspecified",
    "01a0e8fc-86d1-72b5-89d8-37018dd049b4": "unspecified",
    "01a0cf16-de84-785d-b91b-7b47965d373d": "unspecified",
    "01a0cf16-df9b-76dc-a9e1-e3981efacba0": "unspecified",
    "01a0cf16-dd5f-77fa-8a45-4a6c01663eb1": "unspecified",
    "01a0cf16-d541-7554-a9ad-1e8964aeb427": "unspecified",
    "01a0cf16-d7da-7f22-b00b-b454c7a709ba": "unspecified",
    "01a0e8fc-b801-7a88-a9c6-7c4dc2755a01": "unspecified",
    "01a0cf16-e562-7c39-a3fb-24ec65422292": "unspecified",
    "01a0e8fc-b777-79fe-be74-548740a07d96": "unspecified",
    "01a0cf16-f693-7823-b244-369096928e66": "unspecified",
    "01a0cf16-f569-72ca-b0a6-e1e973c00ae7": "unspecified",
    "01a0cf16-f486-7d5c-b1cc-7f6a3eef52e3": "unspecified",
    "01a0e8fc-b87f-7efc-a4a0-908a32674ffb": "unspecified",
    "01a0cf16-ca3d-739c-aaa2-2a9d61f94abf": "unspecified",
    "01a0cf16-cc50-70f1-a3c2-fc8b0afff87e": "unspecified",
    "01a0e8fc-a176-70dc-8444-4043e6271041": "unspecified",
    "01a0cf16-c7f5-7248-8cf6-4eb9a5bb264d": "unspecified",
    "01a0cf16-cb52-7d7d-b708-4ae241366ee1": "unspecified",
    "01a0cf16-cd9f-7de5-b8e3-7d438ebb57cd": "unspecified",
    "01a0e8fc-a296-7e2c-a431-b055396bb790": "unspecified",
    "01a0cf16-cfd4-71b3-9254-b921720f3ed0": "unspecified",
    "01a0e8fc-a31d-7e65-a508-8b62a5d45639": "unspecified",
    "01a0cf16-c6b0-74a8-93b8-0f8fbd35a74d": "unspecified",
    "01a0cf16-cea3-70e6-931b-9dc276d6675f": "unspecified",
    "01a0cf16-d0cd-7e3a-a054-2bb4a1310538": "unspecified",
    "01a0e8fc-a5ba-71fe-abcc-5543b864c9fb": "unspecified",
    "01a0cf16-a1c6-7d20-8675-7b4941347f1e": "unspecified",
    "01a0cf16-a0c0-76f9-8d2e-79635434a78a": "unspecified",
    "01a0cf16-d212-7f69-b4e0-60b1b45d8c29": "unspecified",
    "01a0e8fc-ba8b-79c2-83f9-f64f06fa03f1": "unspecified",
    "01a0e8fc-9a2a-76d9-b143-e250fa1d6be1": "unspecified",
    "01a0cf16-beba-74d5-b4e1-fa97f11587f6": "unspecified",
    "01a0e8fc-9d8f-7ba3-9397-3c0443e9f918": "unspecified",
    "01a0cf16-b718-7896-89b7-f64266beb2c8": "unspecified",
    "01a0cf16-b828-78d4-819d-0ec6fc85b3f0": "unspecified",
    "01a0cf16-b98a-7203-8697-5e09e2b95a62": "unspecified",
    "01a0cf16-bba3-7c6d-a76d-b866f9063987": "unspecified",
    "01a0cf16-bc9f-724e-a450-37b605a509f8": "unspecified",
    "01a0cf16-bdbf-7e26-bdc5-0235e462d043": "unspecified",
    "01a0cf16-ba80-7ea3-9e61-8e5a0381560b": "unspecified",
    "01a0e8fc-afcd-77b6-acfe-4c0341856ee6": "unspecified",
    "01a0cf16-c013-7907-8311-4977d02f37f5": "unspecified",
    "01a0cf16-c153-7c18-bee4-b599f3a8f423": "unspecified",
    "01a0cf16-c253-72de-a0e3-d99c8127a4bd": "unspecified",
    "01a0cf16-c38c-7c6c-8e6a-f0bd7af56a16": "unspecified",
    "01a0cf16-c494-7231-b33d-fc186090959f": "unspecified",
    "01a0cf17-12bd-7de3-9df0-f607db604d52": "unspecified",
    "01a0e8fc-9b80-7cb2-aaec-6a9b030b4d36": "unspecified",
    "01a0cf1a-7e84-7b02-af0f-cc692f99bcc3": "unspecified",
    "01a0cf16-e0d7-7870-a832-83bdd785052c": "unspecified",
    "01a0cf16-e219-74ee-8e6c-a1e3d5df8d11": "unspecified",
    "01a0e8fc-9f41-7d10-9f15-1720a4b077d0": "unspecified",
    "01a0e8fc-a540-7db8-b919-feda80526484": "unspecified",
    "01a0cf16-a32a-730c-9800-0451f3f6598e": "unspecified",
    "01a0cf16-e455-7887-b274-77f1c903825f": "unspecified",
    "01a0cf16-fec7-72d5-8803-5ea3ea7b5e8a": "unspecified",
}

#: The languages Bulbul can speak. Transcription accepts more, but a preview
#: is synthesised, so this is the set a voice can actually be heard in.
#:
#: ``or-IN`` is this codebase's spelling; the speech API calls Odia ``od-IN``
#: and the adapter translates it before the request goes out. Order is the one
#: the employee form lists them in - keep this in step with ``VOICE_LANGUAGES``
#: in the frontend's ``content/voice-catalogue.ts``.
SPEECH_LANGUAGES: Final[tuple[str, ...]] = (
    "hi-IN",
    "en-IN",
    "mr-IN",
    "ta-IN",
    "te-IN",
    "kn-IN",
    "ml-IN",
    "gu-IN",
    "bn-IN",
    "pa-IN",
    "or-IN",
)

#: The line every preview speaks, per language.
#:
#: One short clause on purpose. A preview exists so a listener can judge the
#: speaker, and it is cached per voice and language, so a long marketing
#: sentence both buried the voice under the copy and multiplied what had to be
#: synthesised. Each line says the same thing in its own script, because the
#: speech API reads the text as written: only the language code tells it how.
PREVIEW_LINES: Final[dict[str, str]] = {
    "en-IN": "Hi, this is how I speak.",
    "hi-IN": "नमस्ते, यह मेरी आवाज़ है।",
    "bn-IN": "নমস্কার, এটি আমার কণ্ঠ।",
    "ta-IN": "வணக்கம், இது என் குரல்.",
    "te-IN": "హాయ్, ఇది నా గొంతు.",
    "gu-IN": "નમસ્તે, આ મારો અવાજ છે.",
    "kn-IN": "ನಮಸ್ಕಾರ, ಇದು ನನ್ನ ಧ್ವನಿ.",
    "ml-IN": "ഹായ്, ഇത് എന്റെ ശബ്ദമാണ്.",
    "mr-IN": "नमस्कार, हा माझा आवाज आहे.",
    "pa-IN": "ਸਤ ਸ੍ਰੀ ਅਕਾਲ, ਇਹ ਮੇਰੀ ਆਵਾਜ਼ ਹੈ।",
    "or-IN": "ନମସ୍କାର, ଏହା ମୋର ସ୍ୱର।",
}

#: The language a preview leads with when the caller names none.
PREVIEW_LANGUAGE: Final[str] = "en-IN"


def _voice(
    voice_id: str,
    name: str,
    gender: str,
    personality: str = "",
    use_case: str = "",
    *,
    featured: bool = False,
) -> dict[str, object]:
    """One catalogue entry, with the fields every voice shares filled in."""
    return {
        "id": voice_id,
        "name": name,
        "gender": gender,
        "personality": personality,
        "use_case": use_case,
        "languages": SPEECH_LANGUAGES,
        "preview_language": PREVIEW_LANGUAGE,
        "sample": PREVIEW_LINES[PREVIEW_LANGUAGE],
        "featured": featured,
    }


#: The public voice catalogue - every speaker the speech model publishes, which
#: is what both the marketing site and the dashboard library list.
#:
#: Languages are not decided per voice: one speaker can render every entry in
#: ``SPEECH_LANGUAGES``, so the list is uniform by design and the UI may offer
#: all of them for all of them. ``sample`` is fixed server-side - the preview
#: endpoint reads the sentence from here instead of accepting text from the
#: caller, so it can never be used as a free text-to-speech proxy.
#:
#: ``personality`` and ``use_case`` carry only what the provider publishes about
#: a voice. An empty string is the honest value where it publishes nothing, and
#: the site then prints nothing rather than inventing a role for the speaker.
#:
#: Order is display order: the featured three lead, the rest follow the order
#: the provider lists its speakers in.
VOICE_PROFILES: Final[tuple[dict[str, object], ...]] = (
    _voice("shubh", "Shubh", "male", "Confident & bold", "Sales", featured=True),
    _voice("tanya", "Tanya", "female", "Friendly & modern", "Support", featured=True),
    _voice("anand", "Anand", "male", "Warm & reassuring", "Reminders", featured=True),
    # The rest of the speaker set. Personality comes from the provider's tone
    # hint where it publishes one; an entry with no hint stays empty.
    _voice("aditya", "Aditya", "male", "Professional & clear"),
    _voice("ritu", "Ritu", "female", "Calm & professional"),
    _voice("ashutosh", "Ashutosh", "unspecified"),
    _voice("priya", "Priya", "female", "Clear & precise", "Surveys"),
    _voice("neha", "Neha", "female", "Warm & conversational"),
    _voice("rahul", "Rahul", "male", "Professional & relaxed"),
    _voice("pooja", "Pooja", "female", "Warm & friendly"),
    _voice("rohan", "Rohan", "unspecified"),
    _voice("simran", "Simran", "female", "Bright & clear"),
    _voice("kavya", "Kavya", "female", "Calm & professional"),
    _voice("amit", "Amit", "unspecified"),
    _voice("dev", "Dev", "unspecified"),
    _voice("ishita", "Ishita", "unspecified"),
    _voice("shreya", "Shreya", "female", "Calm & narrative"),
    _voice("ratan", "Ratan", "unspecified"),
    _voice("varun", "Varun", "unspecified"),
    _voice("manan", "Manan", "unspecified"),
    _voice("sumit", "Sumit", "unspecified"),
    _voice("roopa", "Roopa", "unspecified"),
    _voice("kabir", "Kabir", "male", "Steady & trustworthy", "Renewals"),
    _voice("aayan", "Aayan", "unspecified"),
    _voice("advait", "Advait", "unspecified"),
    _voice("tarun", "Tarun", "unspecified"),
    _voice("sunny", "Sunny", "male", "Cheerful & upbeat", "Marketing"),
    _voice("mani", "Mani", "male", "Calm & composed", "Collections"),
    _voice("gokul", "Gokul", "male", "Mature & narrative"),
    _voice("vijay", "Vijay", "male", "Mature & authoritative"),
    _voice("shruti", "Shruti", "unspecified"),
    _voice("suhani", "Suhani", "female", "Young & energetic"),
    _voice("mohit", "Mohit", "unspecified"),
    _voice("kavitha", "Kavitha", "unspecified"),
    _voice("rehan", "Rehan", "unspecified"),
    _voice("soham", "Soham", "unspecified"),
    _voice("rupali", "Rupali", "unspecified"),
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
