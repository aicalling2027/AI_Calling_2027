import Image from "next/image";
import type { User } from "@supabase/supabase-js";

import { cn } from "@/lib/utils";
import { userAvatarUrl, userInitials } from "@/lib/user";

/**
 * One avatar for every auth surface (header, mobile drawer, account page).
 * Uses the provider photo when the identity has one — Google does — and falls
 * back to initials so email sign-ups still get a filled circle.
 */
export function UserAvatar({
  user,
  className,
}: {
  user: User;
  className?: string;
}) {
  const src = userAvatarUrl(user);

  if (src) {
    return (
      <Image
        src={src}
        alt=""
        width={56}
        height={56}
        unoptimized
        className={cn(
          "size-8 shrink-0 rounded-full border border-line object-cover",
          className,
        )}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-full bg-cobalt text-[0.7rem] font-semibold uppercase tracking-wide text-white",
        className,
      )}
    >
      {userInitials(user)}
    </span>
  );
}
