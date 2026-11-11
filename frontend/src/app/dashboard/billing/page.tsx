"use client";

import * as React from "react";
import { Check, CreditCard, Download, Sparkles } from "lucide-react";

import { PageHeader, StatTile, StatusBadge, inr } from "@/components/dashboard/ui/kit";
import { useWorkspace } from "@/components/dashboard/workspace-store";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { billing, usageByModule } from "@/content/workspace";

const PACKS = [1000, 5000, 10000];

export default function BillingPage() {
  const { creditsLimit, creditsUsed, buyCredits, invoices } = useWorkspace();
  const [note, setNote] = React.useState<string | null>(null);
  const remaining = Math.max(0, creditsLimit - creditsUsed);

  const topUp = (amount: number) => {
    buyCredits(amount);
    setNote(`${amount.toLocaleString("en-IN")} credits added to the organisation.`);
  };

  const download = (id: string) => {
    const invoice = invoices.find((item) => item.id === id);
    if (!invoice) return;
    const lines = [
      "AOTMS Global · Tax invoice",
      `Invoice ${invoice.id}`,
      `Date ${invoice.date}`,
      `Amount ${inr(invoice.amount)}`,
      `Status ${invoice.status}`,
      "GSTIN 29AATCA1234F1Z5",
      "",
      `Growth plan · monthly platform fee ${inr(billing.price)}`,
      "Credits are billed in arrears at ₹0.52 per credit.",
    ];
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${invoice.id}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-5">
      <PageHeader
        eyebrow="Billing"
        title="Billing"
        description="Plan, credits and invoices for this organisation. Credits are shared by every employee."
        actions={
          <StatusBadge variant={invoices.some((item) => item.status === "Due") ? "warning" : "success"}>
            {invoices.some((item) => item.status === "Due") ? "1 invoice due" : "All paid"}
          </StatusBadge>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Plan" value={billing.plan} hint={`Renews ${billing.renewal}`} />
        <StatTile label="Credits left" value={remaining.toLocaleString("en-IN")} hint={`of ${creditsLimit.toLocaleString("en-IN")}`} />
        <StatTile label="Used this cycle" value={creditsUsed.toLocaleString("en-IN")} hint="Calls, tests and retries" />
        <StatTile label="Seats" value={`${billing.seats} / ${billing.seatsIncluded}`} hint="Team members" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="rounded-xl border border-line bg-surface p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-soft">
                Current plan
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-ink">
                {billing.plan}
              </h2>
            </div>
            <Badge variant="default">Recommended</Badge>
          </div>
          <p className="mt-2 text-2xl font-semibold text-ink">
            {inr(billing.price)}
            <span className="text-xs font-normal text-ink-soft"> / month</span>
          </p>
          <ul className="mt-3 space-y-1.5 text-xs text-ink-soft">
            {[
              `${billing.creditsIncluded.toLocaleString("en-IN")} credits included`,
              `${billing.seatsIncluded} seats and unlimited campaigns`,
              "All 15 Indian languages and 8 voices",
              "API access, webhooks and n8n",
            ].map((feature) => (
              <li key={feature} className="flex items-start gap-1.5">
                <Check className="mt-0.5 size-3.5 shrink-0 text-[#1c7a4c]" />
                {feature}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setNote("Your account manager will call you about the upgrade.")}
              className={buttonVariants({ size: "lg", className: "flex-1" })}
            >
              Upgrade plan
            </button>
            <a
              href="mailto:billing@aotms.si"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              Contact
            </a>
          </div>
        </section>

        <section className="rounded-xl border border-line bg-surface p-4 xl:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-soft">
                Credits
              </p>
              <h2 className="mt-1 text-sm font-semibold text-ink">
                {remaining.toLocaleString("en-IN")} credits left this cycle
              </h2>
            </div>
            <Badge variant="secondary">₹0.52 per credit</Badge>
          </div>
          <div className="mt-3">
            <Progress value={Math.min(100, Math.round((creditsUsed / creditLimitGuard(creditsLimit)) * 100))} aria-label="Credits used" />
            <div className="mt-1 flex justify-between text-[11px] text-ink-soft">
              <span>{creditsUsed.toLocaleString("en-IN")} used</span>
              <span>{creditsLimit.toLocaleString("en-IN")} total</span>
            </div>
          </div>

          <h3 className="mt-4 text-xs font-semibold text-ink">Top up</h3>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {PACKS.map((pack) => (
              <button
                key={pack}
                type="button"
                onClick={() => topUp(pack)}
                className="rounded-lg border border-line bg-surface p-3 text-left transition-colors hover:border-cobalt/40 hover:bg-cobalt-tint/20"
              >
                <span className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                  <Sparkles className="size-3.5 text-cobalt" />
                  {pack.toLocaleString("en-IN")} credits
                </span>
                <span className="mt-0.5 block text-[11px] text-ink-soft">
                  {inr(pack * 0.52)} · one-time
                </span>
              </button>
            ))}
          </div>
          {note ? (
            <p className="mt-3 rounded-lg bg-[#e6f5ec] px-2.5 py-2 text-[11px] text-[#1c7a4c]">
              {note}
            </p>
          ) : null}
          <p className="mt-3 text-[11px] leading-relaxed text-ink-soft">
            Test calls from the Talk module are free. Credits are charged per connected
            minute, rounded up, and retries are charged once.
          </p>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="rounded-xl border border-line bg-surface xl:col-span-2">
          <div className="border-b border-hairline px-4 py-3">
            <h2 className="text-sm font-semibold text-ink">Usage this cycle</h2>
            <p className="text-xs text-ink-soft">Calls and credits by module.</p>
          </div>
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-hairline text-[10px] uppercase tracking-wide text-ink-soft">
                <th scope="col" className="px-4 py-2 font-semibold">Module</th>
                <th scope="col" className="px-4 py-2 font-semibold">Calls</th>
                <th scope="col" className="px-4 py-2 font-semibold">Credits</th>
                <th scope="col" className="px-4 py-2 font-semibold">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {usageByModule.map((row) => (
                <tr key={row.label}>
                  <td className="px-4 py-2.5 font-medium text-ink">{row.label}</td>
                  <td className="px-4 py-2.5 text-ink-soft">{row.calls.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-2.5 text-ink-soft">{row.credits.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex h-1.5 w-28 overflow-hidden rounded-full bg-mist">
                      <span
                        className="h-full rounded-full bg-cobalt"
                        style={{ width: `${Math.round((row.credits / creditsUsed) * 100)}%` }}
                      />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="rounded-xl border border-line bg-surface p-4">
          <h2 className="text-sm font-semibold text-ink">Payment method</h2>
          <div className="mt-3 rounded-lg border border-line bg-mist-soft p-3">
            <p className="flex items-center gap-2 text-xs font-semibold text-ink">
              <CreditCard className="size-4 text-cobalt" />
              UPI autopay · HDFC Bank
            </p>
            <p className="mt-1 text-[11px] text-ink-soft">
              ameen@okhdfcbank · mandate active
            </p>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-ink-soft">
            Payments are collected through Razorpay. GST invoices are emailed to the billing
            contact on the first of each month.
          </p>
          <div className="mt-3 border-t border-hairline pt-3 text-[11px] text-ink-soft">
            <p><span className="font-semibold text-ink">GSTIN</span> 29AATCA1234F1Z5</p>
            <p className="mt-1"><span className="font-semibold text-ink">Billing email</span> billing@aotms.com</p>
          </div>
          <button
            type="button"
            onClick={() => setNote("A secure Razorpay link has been emailed to billing@aotms.com.")}
            className={buttonVariants({ variant: "outline", size: "sm", className: "mt-3 w-full" })}
          >
            Update payment method
          </button>
        </section>
      </div>

      <section className="overflow-hidden rounded-xl border border-line bg-surface">
        <div className="border-b border-hairline px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Invoices</h2>
        </div>
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-hairline text-[10px] uppercase tracking-wide text-ink-soft">
              <th scope="col" className="px-4 py-2 font-semibold">Invoice</th>
              <th scope="col" className="px-4 py-2 font-semibold">Date</th>
              <th scope="col" className="px-4 py-2 font-semibold">Amount</th>
              <th scope="col" className="px-4 py-2 font-semibold">Status</th>
              <th scope="col" className="px-4 py-2 text-right font-semibold">Download</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {invoices.map((invoice) => (
              <tr key={invoice.id}>
                <td className="px-4 py-2.5 font-mono text-[11px] font-medium text-ink">
                  {invoice.id}
                </td>
                <td className="px-4 py-2.5 text-ink-soft">{invoice.date}</td>
                <td className="px-4 py-2.5 text-ink-soft">{inr(invoice.amount)}</td>
                <td className="px-4 py-2.5">
                  <Badge variant={invoice.status === "Paid" ? "success" : "warning"}>
                    {invoice.status}
                  </Badge>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => download(invoice.id)}
                    className="inline-flex h-7 items-center gap-1 rounded-md bg-mist px-2 text-[11px] font-medium text-ink-soft transition-colors hover:text-ink"
                  >
                    <Download className="size-3" />
                    Receipt
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function creditLimitGuard(limit: number) {
  return limit > 0 ? limit : 1;
}
