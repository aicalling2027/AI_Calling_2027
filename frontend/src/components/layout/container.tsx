import { cn } from "@/lib/utils";

/** Single horizontal rhythm used by every section and the header/footer. */
export function Container({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-[1200px] px-5 md:px-8", className)}>
      {children}
    </div>
  );
}
