"""Fresh read-only check of the Sarvam Voice Agents workspace key.

Only the existing ``list_deployments`` GET is called: nothing is created,
paused, resumed or deleted, and no call is placed.
"""

from collections import Counter

from app.core.config import settings
from app.integrations import sarvam_agents as sarvam

print("key_conflicts_with_ids:", sarvam.key_conflicts_with_ids())
print("missing_workspace_settings:", sarvam.missing_workspace_settings())
print("configured_from_env:", sarvam.configured())
print("agent_app_id_set:", bool(str(settings.sarvam_agent_app_id or "").strip()))
print("agent_app_version:", settings.sarvam_agent_app_version)

result = sarvam.list_deployments(page_size=100, max_pages=1)
print("ok:", result.ok)
print("simulated:", result.simulated)
print("status_code:", result.status_code)
print("error:", (result.error or "")[:200])

items = (result.data or {}).get("items") or []
print("deployments:", len(items))
print("statuses:", dict(Counter(str(item.get("status")) for item in items)))
