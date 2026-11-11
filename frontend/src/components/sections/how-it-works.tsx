import { Container } from "@/components/layout/container";
import { howItWorks } from "@/content/home";
import { cn } from "@/lib/utils";

export function HowItWorks() {
  return (
    <section className="section bg-surface">
      <Container>
        <p className="eyebrow">{howItWorks.eyebrow}</p>
        <h2 className="display mt-3 max-w-2xl text-3xl leading-tight md:text-4xl">
          {howItWorks.title}
        </h2>

        <ol className="mt-10 grid gap-5 md:grid-cols-3">
          {howItWorks.steps.map((step, index) => (
            <li key={step.title} className="card card-lift p-6">
              <span
                className={cn(
                  "inline-flex size-9 items-center justify-center rounded-full text-sm font-semibold",
                  index === 0 ? "bg-coral text-ink" : "bg-blue-tint text-blue",
                )}
              >
                {index + 1}
              </span>
              <h3 className="mt-4 text-lg font-semibold text-ink">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
