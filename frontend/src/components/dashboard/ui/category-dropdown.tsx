"use client";

/**
 * Animated dropdown used by the language pickers and the toolbar filters.
 *
 * The interaction is the one from the reference category switcher: the panel
 * springs open to its own height, rows fade in with a small stagger, and a
 * single highlight slides to the hovered row. The surface is re-skinned for
 * this app — white panel, mist fills, cobalt accents — because the dashboard
 * rule is light backgrounds only.
 *
 * It is a plain listbox built on <button> rows rather than Radix, so it works
 * for single and multi selection without extra dependencies.
 */

import * as React from "react";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  type Variants,
} from "motion/react";
import { Check, ChevronDown, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type DropdownOption = {
  value: string;
  label: string;
  description?: string;
  /** Short text shown in a tinted chip, e.g. a language glyph or initials. */
  badge?: string;
  /** Hex accent used by the badge chip and the hovered icon. */
  accent?: string;
  icon?: LucideIcon;
  /** Trailing hint, e.g. "Default". */
  hint?: string;
};

type CommonProps = {
  options: DropdownOption[];
  /** Accessible name of the control and of the listbox. */
  label: string;
  placeholder?: string;
  /** Width / layout classes for the trigger wrapper. */
  className?: string;
  size?: "sm" | "md";
  align?: "start" | "end";
  /** Render a hairline separator after this option index. */
  dividerAfter?: number;
  disabled?: boolean;
  /** Extra row rendered under the list, e.g. a Done button. */
  footer?: React.ReactNode;
  id?: string;
};

type SingleProps = CommonProps & {
  multiple?: false;
  value: string;
  onChange: (value: string) => void;
};

type MultipleProps = CommonProps & {
  multiple: true;
  value: string[];
  onChange: (value: string[]) => void;
};

export type CategoryDropdownProps = SingleProps | MultipleProps;

const listVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { when: "beforeChildren", staggerChildren: 0.04 },
  },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, y: -6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.26, ease: "easeOut" } },
};

const panelSpring = {
  type: "spring",
  stiffness: 500,
  damping: 30,
  mass: 1,
} as const;

export function CategoryDropdown(props: CategoryDropdownProps) {
  const {
    options,
    label,
    placeholder = "Select an option",
    className,
    size = "md",
    align = "start",
    dividerAfter,
    disabled = false,
    footer,
    id,
  } = props;

  const multiple = props.multiple === true;
  const selectedValues: string[] = multiple
    ? (props.value as string[])
    : props.value
      ? [props.value as string]
      : [];

  const [open, setOpen] = React.useState(false);
  const [hovered, setHovered] = React.useState<string | null>(null);
  const [highlight, setHighlight] = React.useState<{
    top: number;
    height: number;
  } | null>(null);

  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const panelId = React.useId();

  const selectedOptions = options.filter((option) =>
    selectedValues.includes(option.value),
  );
  const lead = selectedOptions[0];
  const activeValue =
    hovered ?? selectedOptions[0]?.value ?? options[0]?.value ?? null;

  const triggerLabel =
    selectedOptions.length === 0
      ? placeholder
      : multiple && selectedOptions.length > 1
        ? `${selectedOptions[0].label} +${selectedOptions.length - 1}`
        : selectedOptions[0].label;

  /* Close when a pointer lands outside the trigger or the panel. Listening on
     pointerdown (not click) keeps the list from closing before an option
     receives its click. */
  const close = React.useCallback(() => {
    setOpen(false);
    setHovered(null);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, close]);

  /* Move DOM focus into the panel so arrows and Enter work from the keyboard. */
  React.useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const node =
        listRef.current?.querySelector<HTMLButtonElement>('[data-active="true"]') ??
        listRef.current?.querySelector<HTMLButtonElement>("[data-option]");
      node?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  /* Measure the row the highlight should sit behind. offsetTop is relative to
     the positioned list wrapper, so separators and wrapping are handled. */
  const optionCount = options.length;
  React.useLayoutEffect(() => {
    if (!open || optionCount === 0) return;
    const node = listRef.current?.querySelector<HTMLButtonElement>(
      '[data-active="true"]',
    );
    if (!node) return;
    const next = { top: node.offsetTop, height: node.offsetHeight };
    setHighlight((current) =>
      current && current.top === next.top && current.height === next.height
        ? current
        : next,
    );
  }, [open, activeValue, optionCount]);

  const commit = (next: string[]) => {
    if (multiple) (props.onChange as (value: string[]) => void)(next);
    else (props.onChange as (value: string) => void)(next[0]);
  };

  const choose = (option: DropdownOption) => {
    if (multiple) {
      const already = selectedValues.includes(option.value);
      commit(
        already
          ? selectedValues.filter((value) => value !== option.value)
          : [...selectedValues, option.value],
      );
      return;
    }
    commit([option.value]);
    close();
    triggerRef.current?.focus();
  };

  const focusOption = (index: number) => {
    const nodes = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>("[data-option]") ?? [],
    );
    if (nodes.length === 0) return;
    const next = Math.min(Math.max(index, 0), nodes.length - 1);
    nodes[next].focus({ preventScroll: true });
    setHovered(nodes[next].dataset.value ?? null);
  };

  const onListKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const nodes = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>("[data-option]") ?? [],
    );
    if (nodes.length === 0) return;
    const current = nodes.findIndex((node) => node === document.activeElement);

    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusOption(current + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusOption(current - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusOption(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusOption(nodes.length - 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
      triggerRef.current?.focus();
    }
  };

  return (
    <MotionConfig reducedMotion="user">
      <div
        ref={rootRef}
        className={cn("relative", className)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) {
            event.stopPropagation();
            close();
            triggerRef.current?.focus();
          }
        }}
        onBlur={(event) => {
          const next = event.relatedTarget as Node | null;
          if (next && !event.currentTarget.contains(next)) close();
        }}
      >
        <button
          ref={triggerRef}
          id={id}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={label}
          onClick={() => (open ? close() : setOpen(true))}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);
            }
          }}
          className={cn(
            "flex w-full items-center justify-between gap-2 rounded-lg border border-line bg-surface text-left outline-none transition-colors",
            "hover:border-cobalt/30 hover:bg-mist/40",
            "focus-visible:border-cobalt focus-visible:ring-3 focus-visible:ring-cobalt/15",
            open && "border-cobalt/40 bg-mist/40",
            size === "sm" ? "h-8 px-2.5 text-xs" : "h-9 px-3 text-sm",
            disabled && "cursor-not-allowed opacity-60",
          )}
        >
          <span
            className={cn(
              "flex min-w-0 items-center gap-2",
              selectedOptions.length === 0 && "text-ink-soft/80",
            )}
          >
            {lead ? <Leading option={lead} active={false} /> : null}
            <span className="truncate font-medium">{triggerLabel}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            {multiple && selectedValues.length > 1 ? (
              <span className="rounded bg-cobalt-tint px-1.5 py-0.5 text-[10px] font-semibold text-cobalt-deep">
                {selectedValues.length}
              </span>
            ) : null}
            <motion.span
              aria-hidden
              animate={{ rotate: open ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="grid size-4 place-items-center text-ink-soft"
            >
              <ChevronDown className="size-4" />
            </motion.span>
          </span>
        </button>

        <AnimatePresence>
          {open ? (
            <motion.div
              key="panel"
              id={panelId}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto", transition: panelSpring }}
              exit={{ opacity: 0, height: 0, transition: panelSpring }}
              style={{ transformOrigin: "top" }}
              className={cn(
                "absolute top-full z-50 mt-2 w-full min-w-[14rem]",
                align === "end" ? "right-0" : "left-0",
              )}
            >
              <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-[0_24px_60px_-24px_rgba(13,42,107,0.35)]">
                <motion.div
                  role="listbox"
                  aria-label={label}
                  aria-multiselectable={multiple || undefined}
                  variants={listVariants}
                  initial="hidden"
                  animate="visible"
                  onKeyDown={onListKeyDown}
                  className="max-h-72 overflow-y-auto p-1"
                >
                  <div ref={listRef} className="relative">
                    {highlight ? (
                      <motion.div
                        aria-hidden
                        initial={false}
                        animate={{ top: highlight.top, height: highlight.height }}
                        transition={{
                          type: "spring",
                          bounce: 0.15,
                          duration: 0.4,
                        }}
                        className="absolute inset-x-0 rounded-lg bg-mist"
                      />
                    ) : null}

                    {options.length === 0 ? (
                      <p className="px-3 py-4 text-center text-xs text-ink-soft">
                        No options available
                      </p>
                    ) : null}

                    {options.map((option, index) => {
                      const isSelected = selectedValues.includes(option.value);
                      const isActive = option.value === activeValue;
                      return (
                        <React.Fragment key={option.value}>
                          {dividerAfter === index ? (
                            <div
                              role="separator"
                              className="mx-2 my-1 border-t border-hairline"
                            />
                          ) : null}
                          <motion.button
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            tabIndex={-1}
                            data-option
                            data-value={option.value}
                            data-active={isActive}
                            variants={rowVariants}
                            whileTap={{ scale: 0.985 }}
                            onMouseEnter={() => setHovered(option.value)}
                            onMouseLeave={() => setHovered(null)}
                            onFocus={() => setHovered(option.value)}
                            onClick={() => choose(option)}
                            className={cn(
                              "relative z-10 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left outline-none",
                              isActive || isSelected ? "text-ink" : "text-ink-soft",
                            )}
                          >
                            <Leading option={option} active={isActive} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">
                                {option.label}
                              </span>
                              {option.description ? (
                                <span className="block truncate text-[11px] text-ink-soft">
                                  {option.description}
                                </span>
                              ) : null}
                            </span>
                            {option.hint ? (
                              <span className="shrink-0 text-[10px] uppercase tracking-wide text-ink-soft">
                                {option.hint}
                              </span>
                            ) : null}
                            <span className="grid size-4 shrink-0 place-items-center text-cobalt">
                              <AnimatePresence initial={false}>
                                {isSelected ? (
                                  <motion.span
                                    key="check"
                                    initial={{ scale: 0, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0, opacity: 0 }}
                                    transition={{ duration: 0.15 }}
                                  >
                                    <Check className="size-3.5" />
                                  </motion.span>
                                ) : multiple ? (
                                  <span className="size-3.5 rounded border border-line" />
                                ) : null}
                              </AnimatePresence>
                            </span>
                          </motion.button>
                        </React.Fragment>
                      );
                    })}
                  </div>
                </motion.div>

                {footer ? (
                  <div className="border-t border-hairline bg-mist-soft/60 px-3 py-2">
                    {footer}
                  </div>
                ) : null}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}

function Leading({
  option,
  active,
}: {
  option: DropdownOption;
  active: boolean;
}) {
  if (option.icon) {
    const Icon = option.icon;
    return (
      <motion.span
        aria-hidden
        animate={{ scale: active ? 1.15 : 1 }}
        transition={{ duration: 0.18 }}
        className="grid size-5 shrink-0 place-items-center"
      >
        <Icon
          className="size-4"
          style={active && option.accent ? { color: option.accent } : undefined}
        />
      </motion.span>
    );
  }

  if (option.badge) {
    return (
      <span
        aria-hidden
        className="grid size-6 shrink-0 place-items-center rounded-md text-[10px] font-semibold"
        style={{
          backgroundColor: option.accent ? `${option.accent}16` : "var(--mist)",
          color: option.accent ?? "var(--ink-soft)",
        }}
      >
        {option.badge}
      </span>
    );
  }

  return null;
}
