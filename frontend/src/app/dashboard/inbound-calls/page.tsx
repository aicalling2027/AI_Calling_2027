"use client";

import Link from "next/link";
import * as React from "react";
import { Headphones, PhoneIncoming, PhoneMissed, Settings2 } from "lucide-react";

import {
  EmptyState,
  Field,
  PageHeader,
  SaveButton,
  SelectInput,
  StatTile,
  TextInput,
} from "@/components/dashboard/ui/kit";
import { useWorkspace } from "@/components/dashboard/workspace-store";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { PhoneNumberRecord } from "@/content/workspace";
import { cn } from "@/lib/utils";

const SENTIMENT_DOT: Record<string, string> = {
  Positive: "bg-[#1c7a4c]",
  Neutral: "bg-cobalt",
  Negative: "bg-destructive",
  Unknown: "bg-ink-soft/40",
};

const CALLERS = [
  { name: "Priyanka Rao", phone: "+91 98450 33219" },
  { name: "Imran Shaikh", phone: "+91 98201 77440" },
  { name: "Deepa Krishnan", phone: "+91 90350 11877" },
];

export default function InboundCallsPage() {
  const { numbers, agents, conversations, addConversation } = useWorkspace();
  const inbound = conversations.filter((call) => call.direction === "Inbound");
  const activeNumbers = numbers.filter((record) => record.status === "Active");
  const missed = inbound.filter((call) => call.outcome === "No answer").length;
  const simulateIndex = React.useRef(0);

  const simulate = () => {
    const caller = CALLERS[simulateIndex.current % CALLERS.length];
    simulateIndex.current += 1;
    const agent = agents.find((item) => item.status === "Active") ?? agents[0];
    if (!agent) return;
    addConversation({
      contact: caller.name,
      phone: caller.phone,
      agentId: agent.id,
      direction: "Inbound",
      outcome: "Qualified lead",
      sentiment: "Positive",
      duration: "2:26",
      credits: 7,
      startedAt: "Just now",
      summary: `${agent.name} answered an inbound call from ${caller.name}, qualified the enquiry and sent the details on WhatsApp.`,
      transcript: [
        { who: "Agent", text: agent.greeting },
        { who: "Customer", text: "I saw your ad and wanted to know the pricing." },
        {
          who: "Agent",
          text: "I can help with that. Let me take two details and share the pricing right away.",
        },
      ],
    });
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-5">
      <PageHeader
        eyebrow="Inbound calls"
        title="Inbound calls"
        description="Every number you own, the employee that answers it, and the calls that came in today."
        actions={
          <>
            <Link href="/dashboard/phone-numbers" className={buttonVariants({ variant: "outline", size: "lg" })}>
              <Settings2 aria-hidden />
              Manage numbers
            </Link>
            <button type="button" onClick={simulate} className={buttonVariants({ size: "lg" })}>
              <PhoneIncoming aria-hidden />
              Simulate a call
            </button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Active numbers" value={String(activeNumbers.length)} hint={`${numbers.length} provisioned`} />
        <StatTile label="Inbound today" value={String(inbound.length)} hint="Answered by AI employees" />
        <StatTile label="Missed" value={String(missed)} hint="Rang out before pickup" />
        <StatTile label="Average handle time" value="3:12" hint="Last 30 days" />
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Routing</h2>
          <span className="text-xs text-ink-soft">
            Changes apply to the next inbound call
          </span>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {numbers.map((record) => (
            <RoutingCard key={record.id} record={record} />
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Inbound call log</h2>
          <Link href="/dashboard/conversations" className="text-xs font-medium text-cobalt hover:underline">
            All conversations
          </Link>
        </div>
        {inbound.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={<Headphones className="size-5" />}
              title="No inbound calls yet"
              description="Test the routing by simulating a call, or dial one of the numbers above."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead>
                <tr className="border-b border-hairline text-[10px] uppercase tracking-wide text-ink-soft">
                  <th scope="col" className="px-4 py-2 font-semibold">Caller</th>
                  <th scope="col" className="px-4 py-2 font-semibold">Answered by</th>
                  <th scope="col" className="px-4 py-2 font-semibold">Outcome</th>
                  <th scope="col" className="px-4 py-2 font-semibold">Sentiment</th>
                  <th scope="col" className="px-4 py-2 font-semibold">Duration</th>
                  <th scope="col" className="px-4 py-2 font-semibold">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {inbound.map((call) => (
                  <tr key={call.id}>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-ink">{call.contact}</p>
                      <p className="text-[11px] text-ink-soft">{call.phone}</p>
                    </td>
                    <td className="px-4 py-2.5 text-ink-soft">
                      {agents.find((agent) => agent.id === call.agentId)?.name ?? "Unassigned"}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge
                        variant={
                          call.outcome === "No answer" || call.outcome === "Failed"
                            ? "danger"
                            : "secondary"
                        }
                      >
                        {call.outcome}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1.5 text-ink-soft">
                        <span className={cn("size-2 rounded-full", SENTIMENT_DOT[call.sentiment])} aria-hidden />
                        {call.sentiment}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-ink-soft">{call.duration}</td>
                    <td className="px-4 py-2.5 text-ink-soft">{call.startedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-line bg-cream/60 p-4">
        <h2 className="text-xs font-semibold text-ink">What happens on an inbound call</h2>
        <div className="mt-2 grid gap-2 text-[11px] leading-relaxed text-ink-soft sm:grid-cols-2 xl:grid-cols-4">
          <p><span className="font-semibold text-ink">Pickup.</span> The employee answers within one ring with the number&apos;s welcome line.</p>
          <p><span className="font-semibold text-ink">Language.</span> It matches the caller&apos;s language and switches if they do.</p>
          <p><span className="font-semibold text-ink">Qualify.</span> The saved script runs; knowledge sources answer product questions.</p>
          <p><span className="font-semibold text-ink">Handover.</span> Urgent or billing calls transfer to the number set in Settings.</p>
        </div>
      </section>
    </div>
  );
}

function RoutingCard({ record }: { record: PhoneNumberRecord }) {
  const { agents, updateNumber } = useWorkspace();
  const [agentId, setAgentId] = React.useState(record.agentId ?? "");
  const [welcome, setWelcome] = React.useState(record.welcome);

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-sm font-semibold text-ink">{record.number}</p>
          <p className="mt-0.5 text-[11px] text-ink-soft">
            {record.provider} · {record.mode}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant={record.status === "Active" ? "success" : "warning"}>
            {record.status}
          </Badge>
        </div>
      </div>

      <div className="mt-3 grid gap-3">
        <Field label="Answered by" htmlFor={`route-agent-${record.id}`}>
          <SelectInput
            id={`route-agent-${record.id}`}
            value={agentId}
            onChange={(event) => setAgentId(event.target.value)}
          >
            <option value="">No employee (missed)</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name} · {agent.purpose}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Welcome line" htmlFor={`route-welcome-${record.id}`}>
          <TextInput
            id={`route-welcome-${record.id}`}
            value={welcome}
            onChange={(event) => setWelcome(event.target.value)}
            placeholder="Thank you for calling…"
          />
        </Field>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <SaveButton
          size="sm"
          label="Save routing"
          onSave={() => updateNumber(record.id, { agentId: agentId || null, welcome })}
        />
        {record.agentId === null ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-destructive">
            <PhoneMissed className="size-3" />
            Calls are not answered
          </span>
        ) : (
          <span className="text-[11px] text-ink-soft">
            {agents.find((agent) => agent.id === record.agentId)?.name ?? "—"} answers this line
          </span>
        )}
      </div>

      {record.status !== "Active" ? (
        <p className="mt-2 rounded-lg bg-tangerine-tint/60 px-2.5 py-1.5 text-[11px] text-tangerine-ink">
          Verification is pending. The line starts routing as soon as the provider confirms it.
        </p>
      ) : null}
    </div>
  );
}
