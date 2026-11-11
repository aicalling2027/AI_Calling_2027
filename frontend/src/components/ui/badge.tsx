import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Status chips. Every variant is a tint, never a saturated fill — the dashboard
 * keeps its surfaces light so the data (not the chrome) carries the emphasis.
 */
const badgeVariants = cva(
  "inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-[0.7rem] font-medium whitespace-nowrap ring-1 ring-inset",
  {
    variants: {
      variant: {
        default: "bg-cobalt-tint text-cobalt-deep ring-transparent",
        secondary: "bg-mist text-ink-soft ring-transparent",
        outline: "bg-surface text-ink-soft ring-hairline",
        success: "bg-[#e6f5ec] text-[#1c7a4c] ring-transparent",
        warning: "bg-tangerine-tint text-tangerine-ink ring-transparent",
        danger: "bg-destructive/10 text-destructive ring-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
