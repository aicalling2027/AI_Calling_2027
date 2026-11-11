import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Initials avatar for AI employees. There is no photo to show until employees
 * can upload one, so the tint in `className` is what distinguishes them.
 */
function Avatar({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="avatar"
      className={cn(
        "relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-full text-xs font-semibold",
        className,
      )}
      {...props}
    />
  );
}

function AvatarFallback({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="avatar-fallback"
      className={cn("leading-none tracking-wide", className)}
      {...props}
    />
  );
}

export { Avatar, AvatarFallback };
