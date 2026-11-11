/**
 * Auth routes render on a bare canvas: no site header, no footer, nothing but
 * the form card. The marketing shell lives in the `(marketing)` route group.
 * The cream backdrop keeps the white card readable now that pages are white.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex flex-1 items-center justify-center bg-cream px-4 py-10">
      {children}
    </main>
  );
}
