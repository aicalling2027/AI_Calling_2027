"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The marketing call to action: an outlined pill that reshapes itself on hover.
 *
 * At rest it is a transparent pill with a hairline edge and its arrow parked at
 * the right. On hover the corners pull in, an ink disc blooms from the centre
 * until it fills the shape, the label slides right and the two arrows trade
 * places - one leaves through the right edge as another enters from the left.
 *
 * The whole effect is `group-hover`, so it needs no state and no measurement,
 * which is why a link and a button can share it. Focus is a ring only: a
 * half-transitioned keyboard state would leave white text on a partial disc.
 *
 * `tone` picks the ground. `default`/`quiet` sit on the light page; `night`/
 * `nightQuiet` invert to white for the cobalt-night bands, where an ink disc
 * would vanish into the navy.
 */
const TONES = {
  default: {
    root: "border-ink/35 text-ink hover:border-transparent hover:text-white",
    disc: "bg-ink",
    arrow: "stroke-ink group-hover:stroke-white",
  },
  /**
   * The filled cobalt call to action. Colour at rest, not only on hover: a
   * transparent pill beside a second transparent pill left the hero with no
   * primary at all. The fill is a gradient with a bloom under it, the way a lit
   * pill sits on a pale field; hover inverts it to white on cobalt.
   */
  brand: {
    root: "border-transparent bg-[linear-gradient(90deg,#2f9bff,#0b6ff0)] text-white shadow-[0_16px_36px_-14px_rgba(31,139,247,0.85)] hover:text-[#0b6ff0]",
    disc: "bg-white",
    arrow: "stroke-white group-hover:stroke-[#0b6ff0]",
  },
  /** The filled white secondary that sits beside `brand` without competing. */
  paper: {
    root: "border-[#e3ebf7] bg-white text-ink shadow-[0_10px_26px_-18px_rgba(13,42,107,0.6)] hover:border-transparent hover:text-white",
    disc: "bg-ink",
    arrow: "stroke-ink group-hover:stroke-white",
  },
  quiet: {
    root: "border-ink/20 text-ink-soft hover:border-transparent hover:text-white",
    disc: "bg-ink",
    arrow: "stroke-ink group-hover:stroke-white",
  },
  night: {
    root: "border-on-night-line text-white hover:border-transparent hover:text-ink",
    disc: "bg-white",
    arrow: "stroke-white group-hover:stroke-ink",
  },
  nightQuiet: {
    root: "border-white/20 text-white/80 hover:border-transparent hover:text-ink",
    disc: "bg-white",
    arrow: "stroke-white group-hover:stroke-ink",
  },
} as const;

/**
 * The horizontal padding is the arrows' runway: the resting arrow sits 16px in
 * from the edge and needs its full width clear of the label, hence px-8/px-9.
 * `sm` is the header's compact pill, where the bar itself is only 64-72px tall.
 */
const SIZES = {
  sm: "h-10 px-8 text-[0.78rem]",
  md: "h-11 px-8 text-[0.8rem]",
  lg: "h-12 px-9 text-sm",
} as const;

const BASE =
  "group relative inline-flex shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border-[1.5px] bg-transparent font-semibold whitespace-nowrap outline-none select-none transition-all duration-[600ms] ease-[cubic-bezier(0.23,1,0.32,1)] hover:rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.95] disabled:pointer-events-none disabled:opacity-50";

const ARROW =
  "pointer-events-none absolute top-1/2 z-[9] size-4 -translate-y-1/2 fill-none transition-all duration-[800ms] ease-[cubic-bezier(0.34,1,0.56,1)]";

type ButtonProps = Omit<
  React.ComponentPropsWithoutRef<"button">,
  "className" | "children"
>;

type FlowButtonProps = {
  children: React.ReactNode;
  /** Renders a link when present, a `<button type="button">` otherwise. */
  href?: string;
  tone?: keyof typeof TONES;
  size?: keyof typeof SIZES;
  /**
   * The travelling arrows. Chrome controls that hold their own icon (the
   * account pill) turn them off; the label then stays centred on the disc.
   */
  arrow?: boolean;
  className?: string;
} & ButtonProps;

/**
 * The props are typed for a button, but the link branch renders an anchor:
 * `type` and `disabled` mean nothing there, so they are dropped before the
 * spread while aria state, handlers and ids pass through.
 */
function linkSafeProps(props: ButtonProps) {
  const safe: Record<string, unknown> = { ...props };
  delete safe.type;
  delete safe.disabled;
  return safe as React.AnchorHTMLAttributes<HTMLAnchorElement>;
}

export function FlowButton({
  children,
  href,
  tone = "default",
  size = "md",
  arrow = true,
  className,
  ...rest
}: FlowButtonProps) {
  const classes = cn(BASE, TONES[tone].root, SIZES[size], className);

  const content = (
    <>
      {/* The label steps aside to make room for the entering arrow; without
          arrows it keeps the centre. */}
      <span
        className={cn(
          "relative z-[1] transition-transform duration-[800ms] ease-out",
          arrow && "-translate-x-3 group-hover:translate-x-3",
        )}
      >
        {children}
      </span>

      {/* Entering arrow. Parked outside the clip, so it slides in from nothing. */}
      {arrow ? (
        <ArrowRight
          aria-hidden
          className={cn(
            ARROW,
            TONES[tone].arrow,
            "left-[-30%] group-hover:left-4",
          )}
        />
      ) : null}

      {/* The disc is a fixed-size square scaled from zero rather than a box
          whose width animates: transform stays on the compositor and the
          150% width keeps a wide label's corners covered. */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-1/2 left-1/2 z-0 aspect-square w-[150%] min-w-[220px] -translate-x-1/2 -translate-y-1/2 scale-0 rounded-full opacity-0 transition-[transform,opacity] duration-[800ms] ease-[cubic-bezier(0.19,1,0.22,1)] group-hover:scale-100 group-hover:opacity-100",
          TONES[tone].disc,
        )}
      />

      {/* Leaving arrow. */}
      {arrow ? (
        <ArrowRight
          aria-hidden
          className={cn(
            ARROW,
            TONES[tone].arrow,
            "right-4 group-hover:right-[-30%]",
          )}
        />
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={classes} {...linkSafeProps(rest)}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" className={classes} {...rest}>
      {content}
    </button>
  );
}
