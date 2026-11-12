"use client";

import { motion } from "motion/react";

import { cn } from "@/lib/utils";

type MenuToggleIconProps = {
  open: boolean;
  className?: string;
  /** Milliseconds for the two bars to swing into the cross. */
  duration?: number;
};

/**
 * Two bars that swing into a cross. The header keeps the button size fixed, so
 * the icon swap never shifts the row.
 */
export function MenuToggleIcon({
  open,
  className,
  duration = 0.3,
}: MenuToggleIconProps) {
  const transition = { duration, ease: "easeInOut" } as const;

  return (
    <span
      aria-hidden
      className={cn(
        "relative inline-flex size-5 items-center justify-center",
        className,
      )}
    >
      <motion.span
        className="absolute h-[1.6px] w-5 rounded-full bg-current"
        initial={false}
        animate={open ? { rotate: 45, y: 0 } : { rotate: 0, y: -3.5 }}
        transition={transition}
      />
      <motion.span
        className="absolute h-[1.6px] w-5 rounded-full bg-current"
        initial={false}
        animate={open ? { rotate: -45, y: 0 } : { rotate: 0, y: 3.5 }}
        transition={transition}
      />
    </span>
  );
}
