"use client";

import * as React from "react";
import { Star } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * A star rating, read or set.
 *
 * A decimal value fills part of a star, so a stored average and a visitor's own
 * whole-star rating can render through one component. An editable rating is
 * built from real buttons with their own labels, because a click-only star row
 * cannot be set from the keyboard; hovering or focusing previews the value
 * before it is committed.
 */
const ratingVariants = cva("flex items-center", {
  variants: {
    size: {
      sm: "gap-1",
      md: "gap-1.5",
      lg: "gap-2",
    },
  },
  defaultVariants: {
    size: "md",
  },
});

const starVariants = cva("shrink-0", {
  variants: {
    size: {
      sm: "size-4",
      md: "size-5",
      lg: "size-6",
    },
  },
  defaultVariants: {
    size: "md",
  },
});

const valueVariants = cva("tabular-nums text-ink-soft", {
  variants: {
    size: {
      sm: "ml-1.5 text-xs",
      md: "ml-2 text-sm",
      lg: "ml-2.5 text-base",
    },
  },
  defaultVariants: {
    size: "md",
  },
});

type RatingProps = Omit<React.ComponentProps<"div">, "onChange"> &
  VariantProps<typeof ratingVariants> & {
    /** The current value; a decimal fills part of a star. */
    rating: number;
    /** How many stars the row prints. */
    maxRating?: number;
    /** Print the value beside the stars. */
    showValue?: boolean;
    /** Class for the stars themselves. */
    starClassName?: string;
    /** Class for the printed value. */
    valueClassName?: string;
    /** Whether pressing a star changes the rating. */
    editable?: boolean;
    onRatingChange?: (rating: number) => void;
  };

function Rating({
  rating,
  maxRating = 5,
  size,
  className,
  starClassName,
  valueClassName,
  showValue = false,
  editable = false,
  onRatingChange,
  "aria-label": ariaLabel,
  ...props
}: RatingProps) {
  const [hovered, setHovered] = React.useState<number | null>(null);
  const shown = editable && hovered !== null ? hovered : rating;

  return (
    <div
      data-slot="rating"
      role={editable ? "group" : "img"}
      aria-label={ariaLabel ?? `${rating.toFixed(1)} out of ${maxRating} stars`}
      className={cn(ratingVariants({ size }), className)}
      onMouseLeave={() => setHovered(null)}
      {...props}
    >
      {Array.from({ length: maxRating }, (_, index) => {
        const value = index + 1;
        const fill =
          shown >= value ? 100 : shown > value - 1 ? (shown - value + 1) * 100 : 0;

        const star = (
          <span className="relative grid place-items-center">
            <Star
              aria-hidden
              data-slot="rating-star-empty"
              className={cn(starVariants({ size }), "text-ink-soft/30", starClassName)}
            />
            {fill > 0 ? (
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 overflow-hidden"
                style={{ width: `${fill}%` }}
              >
                <Star
                  data-slot="rating-star-filled"
                  className={cn(
                    starVariants({ size }),
                    "fill-tangerine text-tangerine-deep",
                    starClassName,
                  )}
                />
              </span>
            ) : null}
          </span>
        );

        if (!editable) return <React.Fragment key={value}>{star}</React.Fragment>;

        return (
          <button
            key={value}
            type="button"
            aria-label={value === 1 ? "Rate 1 star" : `Rate ${value} stars`}
            aria-pressed={rating === value}
            className="rounded-full p-0.5 transition-colors hover:bg-cream-deep focus-visible:ring-2 focus-visible:ring-cobalt/40 focus-visible:outline-none"
            onClick={() => onRatingChange?.(value)}
            onMouseEnter={() => setHovered(value)}
            onFocus={() => setHovered(value)}
            onBlur={() => setHovered(null)}
          >
            {star}
          </button>
        );
      })}

      {showValue ? (
        <span
          data-slot="rating-value"
          className={cn(valueVariants({ size }), valueClassName)}
        >
          {shown.toFixed(1)}
        </span>
      ) : null}
    </div>
  );
}

export { Rating, ratingVariants, starVariants };
