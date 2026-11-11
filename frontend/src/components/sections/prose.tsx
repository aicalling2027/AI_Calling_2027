import { cn } from "@/lib/utils";

/** Block shapes used by long-form templates (blog bodies, legal pages, glossary). */
export type Block =
  | { type: "heading"; text: string }
  | { type: "subheading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "ordered"; items: string[] }
  | { type: "quote"; text: string; cite?: string }
  | { type: "note"; text: string };

type ProseProps = {
  blocks: Block[];
  className?: string;
};

/**
 * Renders the block array used by every article-style template.
 * Kept deliberately small so content stays data, not hand-written JSX.
 */
export function Prose({ blocks, className }: ProseProps) {
  return (
    <div className={cn("space-y-5", className)}>
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`;

        switch (block.type) {
          case "heading":
            return (
              <h2
                key={key}
                className="display mt-10 text-2xl leading-snug text-ink first:mt-0 md:text-3xl"
              >
                {block.text}
              </h2>
            );
          case "subheading":
            return (
              <h3
                key={key}
                className="mt-8 text-lg font-semibold text-ink md:text-xl"
              >
                {block.text}
              </h3>
            );
          case "paragraph":
            return (
              <p key={key} className="text-base leading-relaxed text-ink-soft">
                {block.text}
              </p>
            );
          case "list":
            return (
              <ul key={key} className="space-y-2 pl-1">
                {block.items.map((item) => (
                  <li
                    key={item}
                    className="flex gap-3 text-base leading-relaxed text-ink-soft"
                  >
                    <span
                      aria-hidden
                      className="mt-2 size-1.5 shrink-0 rounded-full bg-coral-deep"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            );
          case "ordered":
            return (
              <ol key={key} className="space-y-2 pl-1">
                {block.items.map((item, itemIndex) => (
                  <li
                    key={item}
                    className="flex gap-3 text-base leading-relaxed text-ink-soft"
                  >
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-tint text-[0.7rem] font-semibold text-blue">
                      {itemIndex + 1}
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
            );
          case "quote":
            return (
              <blockquote
                key={key}
                className="border-l-2 border-coral pl-5 text-base italic leading-relaxed text-ink"
              >
                {block.text}
                {block.cite ? (
                  <footer className="mt-2 text-xs not-italic text-ink-soft">
                    {block.cite}
                  </footer>
                ) : null}
              </blockquote>
            );
          case "note":
            return (
              <p
                key={key}
                className="rounded-2xl border border-line bg-ivory-light px-4 py-3 text-sm leading-relaxed text-ink-soft"
              >
                {block.text}
              </p>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
