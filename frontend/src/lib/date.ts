const formatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** Deterministic date formatting so server renders stay stable. */
export function formatDate(iso: string): string {
  return formatter.format(new Date(`${iso}T00:00:00Z`));
}
