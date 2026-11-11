"use client";

import * as React from "react";
import { PhoneForwarded, Plus } from "lucide-react";

import { CategoryDropdown } from "@/components/dashboard/ui/category-dropdown";
import {
  EmptyState,
  Field,
  Modal,
  PageHeader,
  StatTile,
  StatusBadge,
  TextInput,
} from "@/components/dashboard/ui/kit";
import { useWorkspace } from "@/components/dashboard/workspace-store";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { PhoneNumberRecord } from "@/content/workspace";

const PROVIDERS = ["Sarvam SIP", "Exotel", "Plivo", "Twilio"];
const MODES: PhoneNumberRecord["mode"][] = ["Inbound", "Outbound", "Both"];

export default function PhoneNumbersPage() {
  const { numbers, agents, addNumber, updateNumber } = useWorkspace();
  const [open, setOpen] = React.useState(false);
  const [number, setNumber] = React.useState("");
  const [provider, setProvider] = React.useState(PROVIDERS[0]);
  const [mode, setMode] = React.useState<PhoneNumberRecord["mode"]>("Both");
  const [error, setError] = React.useState<string | null>(null);

  const active = numbers.filter((record) => record.status === "Active").length;
  const pending = numbers.filter((record) => record.status === "Pending").length;
  const providers = new Set(numbers.map((record) => record.provider)).size;

  const add = () => {
    if (number.replace(/\D/g, "").length < 10) {
      setError("Enter the full number including the country code.");
      return;
    }
    addNumber({ number: number.trim(), provider, mode });
    setNumber("");
    setMode("Both");
    setError(null);
    setOpen(false);
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-5">
      <PageHeader
        eyebrow="Phone numbers"
        title="Phone numbers"
        description="Buy numbers, assign the employee that answers each line, and decide whether a line dials out or receives calls."
        actions={
          <button type="button" onClick={() => setOpen(true)} className={buttonVariants({ size: "lg" })}>
            <Plus aria-hidden />
            Add number
          </button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Numbers" value={String(numbers.length)} hint={`${active} active`} />
        <StatTile label="Pending verification" value={String(pending)} hint="Provider documents" />
        <StatTile label="Providers" value={String(providers)} hint="SIP and cloud telephony" />
        <StatTile label="Assigned" value={String(numbers.filter((record) => record.agentId).length)} hint="Answered by an employee" />
      </div>

      {numbers.length === 0 ? (
        <EmptyState
          icon={<PhoneForwarded className="size-5" />}
          title="No numbers yet"
          description="Add a number to start making outbound calls and receiving inbound enquiries."
          action={
            <button type="button" onClick={() => setOpen(true)} className={buttonVariants({ size: "lg" })}>
              <Plus aria-hidden />
              Add number
            </button>
          }
        />
      ) : (
        <section className="overflow-hidden rounded-xl border border-line bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-xs">
              <thead>
                <tr className="border-b border-hairline text-[10px] uppercase tracking-wide text-ink-soft">
                  <th scope="col" className="px-4 py-2.5 font-semibold">Number</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Provider</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Mode</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Status</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Answered by</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {numbers.map((record) => (
                  <tr key={record.id} className="hover:bg-mist-soft/60">
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs font-semibold text-ink">{record.number}</p>
                      {record.status === "Active" && record.welcome ? (
                        <p className="mt-0.5 max-w-[300px] truncate text-[11px] text-ink-soft">
                          {record.welcome}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{record.provider}</td>
                    <td className="px-4 py-3">
                      <label className="sr-only" htmlFor={`mode-${record.id}`}>
                        Mode for {record.number}
                      </label>
                      <select
                        id={`mode-${record.id}`}
                        value={record.mode}
                        onChange={(event) =>
                          updateNumber(record.id, {
                            mode: event.target.value as PhoneNumberRecord["mode"],
                          })
                        }
                        className="h-8 rounded-md border border-line bg-surface px-1.5 text-[11px] text-ink outline-none focus-visible:border-cobalt"
                      >
                        {MODES.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        variant={
                          record.status === "Active"
                            ? "success"
                            : record.status === "Pending"
                              ? "warning"
                              : "secondary"
                        }
                      >
                        {record.status}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3">
                      <label className="sr-only" htmlFor={`agent-${record.id}`}>
                        Employee for {record.number}
                      </label>
                      <select
                        id={`agent-${record.id}`}
                        value={record.agentId ?? ""}
                        onChange={(event) =>
                          updateNumber(record.id, {
                            agentId: event.target.value || null,
                          })
                        }
                        disabled={record.status === "Released"}
                        className="h-8 rounded-md border border-line bg-surface px-1.5 text-[11px] text-ink outline-none focus-visible:border-cobalt disabled:opacity-50"
                      >
                        <option value="">Unassigned</option>
                        {agents.map((agent) => (
                          <option key={agent.id} value={agent.id}>
                            {agent.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {record.status === "Released" ? (
                        <Badge variant="outline">Released</Badge>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Release ${record.number}? Inbound calls stop immediately.`)) {
                              updateNumber(record.id, {
                                status: "Released",
                                agentId: null,
                                welcome: "",
                              });
                            }
                          }}
                          className="inline-flex h-7 items-center rounded-md px-2 text-[11px] font-medium text-ink-soft transition-colors hover:bg-destructive/10 hover:text-destructive"
                        >
                          Release
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-line bg-cream/60 p-4">
        <h2 className="text-xs font-semibold text-ink">Porting an existing number</h2>
        <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-ink-soft">
          Numbers bought elsewhere can be ported to Sarvam SIP. Upload the last invoice and
          the authorised-signatory letter in the add-number dialog; verification usually
          completes in two working days and the line keeps working while it moves.
        </p>
      </section>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add a phone number"
        description="Numbers start as Pending until the provider verifies ownership."
        footer={
          <>
            <button type="button" onClick={() => setOpen(false)} className={buttonVariants({ variant: "outline" })}>
              Cancel
            </button>
            <button type="button" onClick={add} className={buttonVariants()}>
              Add number
            </button>
          </>
        }
      >
        <Field label="Number" htmlFor="new-number" hint="Include the country code, e.g. +91 80199 52233.">
          <TextInput
            id="new-number"
            value={number}
            onChange={(event) => setNumber(event.target.value)}
            placeholder="+91 "
            inputMode="tel"
          />
        </Field>
        <Field label="Provider" htmlFor="new-provider">
          <CategoryDropdown
            id="new-provider"
            label="Provider"
            value={provider}
            onChange={setProvider}
            options={PROVIDERS.map((item) => ({ value: item, label: item }))}
          />
        </Field>
        <Field label="Mode" htmlFor="new-mode">
          <CategoryDropdown
            id="new-mode"
            label="Mode"
            value={mode}
            onChange={(next) => setMode(next as PhoneNumberRecord["mode"])}
            options={MODES.map((item) => ({
              value: item,
              label: item,
              description:
                item === "Inbound"
                  ? "Customers call in; an employee answers"
                  : item === "Outbound"
                    ? "Campaigns and instant leads only"
                    : "Both directions on one line",
            }))}
          />
        </Field>
        {error ? (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : null}
        <p className="text-[11px] leading-relaxed text-ink-soft">
          Outbound-only numbers do not need a welcome line. Inbound and Both routes to the
          employee you assign after verification.
        </p>
      </Modal>
    </div>
  );
}
