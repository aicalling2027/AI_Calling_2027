"use client";

/**
 * Small shared primitives for the dashboard module screens. They follow the
 * light-surface rule: white panels, mist tints and hairlines, never saturated
 * blocks of colour.
 */

import * as React from "react";
import { Check, Loader2, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ header */

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft">
          {eyebrow}
        </p>
        <h1 className="mt-1 text-[26px] font-semibold leading-tight tracking-tight text-ink">
          {title}
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-soft">
          {description}
        </p>
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

/* ----------------------------------------------------------------- toolbar */

export function SearchField({
  value,
  onChange,
  placeholder = "Search",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative min-w-0 flex-1 sm:max-w-xs", className)}>
      <Search
        aria-hidden
        className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-soft/70"
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-lg border border-line bg-surface pl-8 pr-3 text-sm text-ink outline-none transition-colors placeholder:text-ink-soft/60 focus-visible:border-cobalt focus-visible:ring-3 focus-visible:ring-cobalt/15"
      />
    </div>
  );
}

export function FilterPills<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex flex-wrap items-center gap-1 rounded-lg bg-mist p-0.5"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
              active
                ? "bg-surface text-ink shadow-sm ring-1 ring-line"
                : "text-ink-soft hover:text-ink",
            )}
          >
            {option.label}
            {typeof option.count === "number" ? (
              <span
                className={cn(
                  "rounded px-1 text-[10px]",
                  active ? "bg-cobalt-tint text-cobalt-deep" : "bg-surface/70 text-ink-soft",
                )}
              >
                {option.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------- forms */

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="block text-xs font-semibold text-ink"
      >
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink-soft/80">{hint}</p>
      ) : null}
    </div>
  );
}

const controlClass =
  "w-full rounded-lg border border-line bg-surface px-2.5 text-sm text-ink outline-none transition-colors placeholder:text-ink-soft/60 focus-visible:border-cobalt focus-visible:ring-3 focus-visible:ring-cobalt/15 disabled:cursor-not-allowed disabled:bg-mist/60";

export function TextInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(controlClass, "h-9", className)} />;
}

export function TextArea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(controlClass, "min-h-24 py-2 leading-relaxed", className)}
    />
  );
}

export function SelectInput({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cn(controlClass, "h-9 pr-8", className)}>
      {children}
    </select>
  );
}

/* -------------------------------------------------------------- save button */

export function SaveButton({
  label = "Save changes",
  onSave,
  className,
  size = "default",
}: {
  label?: string;
  onSave?: () => void;
  className?: string;
  size?: "sm" | "default";
}) {
  const [state, setState] = React.useState<"idle" | "saving" | "saved">("idle");
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const handleClick = () => {
    if (state === "saving") return;
    setState("saving");
    timer.current = setTimeout(() => {
      onSave?.();
      setState("saved");
      timer.current = setTimeout(() => setState("idle"), 1600);
    }, 700);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-live="polite"
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg bg-cobalt font-medium text-white transition-colors hover:bg-cobalt-deep focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-cobalt/30 disabled:opacity-60",
        size === "sm" ? "h-8 px-3 text-xs" : "h-9 px-3.5 text-sm",
        className,
      )}
      disabled={state === "saving"}
    >
      {state === "saving" ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : null}
      {state === "saved" ? <Check aria-hidden className="size-3.5" /> : null}
      {state === "saving" ? "Saving…" : state === "saved" ? "Saved" : label}
    </button>
  );
}

/* ------------------------------------------------------------------- modal */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-cobalt-night/25 p-4 backdrop-blur-[2px]"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[86vh] w-full max-w-lg overflow-y-auto rounded-xl border border-line bg-surface p-5 shadow-[0_24px_60px_-24px_rgba(13,42,107,0.45)]"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-ink">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-md p-1 text-ink-soft transition-colors hover:bg-mist hover:text-ink"
          >
            <span aria-hidden className="text-lg leading-none">×</span>
          </button>
        </div>
        <div className="mt-4 space-y-3">{children}</div>
        {footer ? (
          <div className="mt-5 flex items-center justify-end gap-2">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ states */

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-mist-soft px-6 py-12 text-center">
      <span className="grid size-10 place-items-center rounded-lg bg-mist text-ink-soft">
        {icon}
      </span>
      <p className="mt-3 text-sm font-semibold text-ink">{title}</p>
      <p className="mt-1 max-w-sm text-xs leading-relaxed text-ink-soft">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  badge,
}: {
  label: string;
  value: string;
  hint?: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-soft">
          {label}
        </p>
        {badge}
      </div>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight text-ink">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-ink-soft">{hint}</p> : null}
    </div>
  );
}

export function StatusBadge({
  children,
  variant = "secondary",
}: {
  children: React.ReactNode;
  variant?: React.ComponentProps<typeof Badge>["variant"];
}) {
  return <Badge variant={variant}>{children}</Badge>;
}

/* ----------------------------------------------------------------- helpers */

export const inr = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

export const pct = (part: number, whole: number) =>
  whole <= 0 ? "0%" : `${Math.round((part / whole) * 100)}%`;
