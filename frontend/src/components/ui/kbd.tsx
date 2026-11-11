import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * A keyboard hint. Used in menus (`⌘K`) and next to the dashboard search.
 */
const kbdVariants = cva(
  "inline-flex items-center justify-center gap-0.5 rounded-md border border-line bg-mist-soft font-mono font-medium text-ink-soft",
  {
    variants: {
      size: {
        xs: "h-5 min-w-5 px-1 text-[0.65rem]",
        sm: "h-6 min-w-6 px-1.5 text-xs",
        md: "h-7 min-w-7 px-2 text-xs",
      },
    },
    defaultVariants: {
      size: "sm",
    },
  },
);

function Kbd({
  className,
  size,
  ...props
}: React.ComponentProps<"kbd"> & VariantProps<typeof kbdVariants>) {
  return <kbd className={cn(kbdVariants({ size }), className)} {...props} />;
}

export { Kbd, kbdVariants };
