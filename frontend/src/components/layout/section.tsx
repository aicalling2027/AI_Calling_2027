import { cn } from "@/lib/utils";

type SectionHeaderProps = {
  eyebrow?: string;
  title: string;
  body?: string;
  align?: "left" | "center";
  /** Interior pages render their own <h1>; section headings stay <h2>. */
  headingLevel?: "h2" | "h3";
  className?: string;
};

/**
 * The single heading pattern used by every marketing section.
 * Keeps typographic scale and spacing identical across page templates.
 */
export function SectionHeader({
  eyebrow,
  title,
  body,
  align = "left",
  headingLevel = "h2",
  className,
}: SectionHeaderProps) {
  const Heading = headingLevel;

  return (
    <div
      className={cn(
        "max-w-2xl",
        align === "center" && "mx-auto text-center",
        className,
      )}
    >
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <Heading className="display mt-3 text-3xl leading-tight md:text-4xl">
        {title}
      </Heading>
      {body ? (
        <p className="mt-4 text-base leading-relaxed text-ink-soft">{body}</p>
      ) : null}
    </div>
  );
}

type SectionProps = {
  children: React.ReactNode;
  className?: string;
  id?: string;
  /** Alternate surface used by pages that need to separate two sections. */
  tone?: "ivory" | "raised" | "blue";
};

const toneClass: Record<NonNullable<SectionProps["tone"]>, string> = {
  /** Page background (ivory-light) — the default, so most bands read as one. */
  ivory: "",
  /** Alternate band in pure white. */
  raised: "border-y border-line bg-surface",
  /** The single full-bleed blue-night band per page. */
  blue: "section-night",
};

export function Section({
  children,
  className,
  id,
  tone = "ivory",
}: SectionProps) {
  return (
    <section id={id} className={cn("section", toneClass[tone], className)}>
      {children}
    </section>
  );
}
