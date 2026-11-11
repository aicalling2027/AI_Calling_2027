type JsonLdProps = {
  /** Structured data built from locally authored content. */
  data: Record<string, unknown>;
};

/**
 * Renders JSON-LD. `<` is escaped so the payload can never close the script
 * tag early, which keeps `dangerouslySetInnerHTML` safe here.
 */
export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
