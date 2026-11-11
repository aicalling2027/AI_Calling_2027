import type { User } from "@supabase/supabase-js";

/** Prefer the name the provider sent, then the email, then a neutral label. */
export function userDisplayName(user: User): string {
  const metadata = user.user_metadata ?? {};
  const candidates = [metadata.full_name, metadata.name, metadata.display_name];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return user.email ?? "Your account";
}

/** Two-letter avatar label, e.g. "ameen@aotms.com" → "AA". */
export function userInitials(user: User): string {
  const words = userDisplayName(user)
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2);

  const initials = words.map((word) => word[0]).join("");

  return (initials || "A").toUpperCase();
}
