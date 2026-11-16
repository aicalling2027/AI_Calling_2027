"use client";

import * as React from "react";
import { PhoneForwarded, Plus, RefreshCw } from "lucide-react";

import {
  EmptyState,
  Field,
  Modal,
  PageHeader,
  SelectInput,
  StatTile,
  StatusBadge,
  TextInput,
} from "@/components/dashboard/ui/kit";
import { useWorkspace } from "@/components/dashboard/workspace-store";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { PhoneNumberRecord } from "@/content/workspace";
import type { InventorySummary } from "@/lib/api/phone-numbers";
import { cn } from "@/lib/utils";

const MODES: PhoneNumberRecord["mode"][] = ["Inbound", "Outbound", "Both"];

/** Reading the counts is its own request, with its own failure states. */
type InventoryState = "loading" | "ready" | "error";

const statusVariant = (status: PhoneNumberRecord["status"]) =>
  status === "Active" ? "success" : status === "Pending" ? "warning" : "secondary";

/** The server decides identity on digits, so the field checks the same thing. */
const digitsIn = (value: string) => value.replace(/[^0-9]/g, "");

/** The plan code the backend enforces, written the way the billing screen does. */
const planName = (code: string) =>
  code ? code.charAt(0).toUpperCase() + code.slice(1) : "No plan";

/**
 * What may be said about where calls land, in one sentence.
 *
 * Only a route the provider confirmed is called live. The employee chosen here
 * is this workspace's intent, and saying a line "routes" before Sarvam answered
 * would claim something nobody verified.
 */
const describeRoute = (record: PhoneNumberRecord): string => {
  if (record.status === "Released") return "The number is released; its records are kept.";
  if (!record.agentId) return "No employee answers it yet - assign one to route calls.";
  const route = record.routing;
  if (route?.confirmed && route.state === "Active") {
    return "Sarvam confirmed the route, so calls reach its employee now.";
  }
  if (route?.state === "Failed") {
    return "Sarvam could not set the route up. Assign the employee again to retry.";
  }
  return "Waiting for Sarvam to confirm the route; calls may not arrive until it does.";
};

export default function PhoneNumbersPage() {
  const {
    numbers,
    numbersError,
    refreshNumbers,
    agents,
    updateNumber,
    releaseNumber,
    attachNumber,
  } = useWorkspace();

  const [open, setOpen] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [rowError, setRowError] = React.useState<string | null>(null);

  // The attach form: the number as it was rented, and who answers it.
  const [number, setNumber] = React.useState("");
  const [label, setLabel] = React.useState("");
  const [employeeId, setEmployeeId] = React.useState("");
  const [attaching, setAttaching] = React.useState(false);
  const [attachError, setAttachError] = React.useState<string | null>(null);

  // The counts: every line stored here, refreshed on demand. Nothing is polled -
  // a line changes when someone rents one, not every few seconds.
  const [inventory, setInventory] = React.useState<InventorySummary | null>(null);
  const [inventoryState, setInventoryState] = React.useState<InventoryState>("loading");
  const [inventoryError, setInventoryError] = React.useState<string | null>(null);
  const [inventoryKey, setInventoryKey] = React.useState(0);

  const live = numbers.filter((record) => record.status !== "Released");
  const active = live.filter((record) => record.status === "Active").length;
  const pending = live.filter((record) => record.status === "Pending").length;
  const unreleased = numbers.length - live.length;

  React.useEffect(() => {
    let cancelled = false;

    fetch("/api/phone-numbers/sync", { cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as
          | { inventory?: InventorySummary; error?: { message?: string } }
          | null;
        if (!response.ok || !body?.inventory) {
          throw new Error(body?.error?.message ?? "The counts could not be read.");
        }
        return body.inventory;
      })
      .then((next) => {
        if (cancelled) return;
        setInventory(next);
        setInventoryError(null);
        setInventoryState("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error("[phone-numbers] inventory counts", error);
        setInventoryError(error instanceof Error ? error.message : "The counts could not be read.");
        setInventoryState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [inventoryKey]);

  // Refreshing is a user action, so the loading state belongs to the handler
  // rather than the effect: the effect only talks to the network.
  const refreshInventory = () => {
    setInventoryState("loading");
    setInventoryKey((key) => key + 1);
  };

  const startAttach = () => {
    setNumber("");
    setLabel("");
    setEmployeeId("");
    setAttachError(null);
    setNotice(null);
    setOpen(true);
  };

  const attach = async () => {
    if (digitsIn(number).length < 7) {
      setAttachError("Enter the full number, including the country code.");
      return;
    }
    setAttaching(true);
    setAttachError(null);
    const outcome = await attachNumber({
      number: number.trim(),
      label: label.trim() || undefined,
      employeeId: employeeId || null,
    });
    setAttaching(false);
    if (!outcome.ok) {
      setAttachError(outcome.error);
      return;
    }
    setOpen(false);
    setNotice(
      outcome.created
        ? `Attached ${outcome.record.number}. ${describeRoute(outcome.record)}`
        : `${outcome.record.number} was already attached to this workspace, so nothing changed.`,
    );
    refreshInventory();
  };

  const saveMode = (id: string, mode: PhoneNumberRecord["mode"]) => {
    void updateNumber(id, { mode }).then((outcome) => {
      setRowError(outcome.ok ? null : outcome.error);
    });
  };

  const saveAgent = (id: string, next: string) => {
    void updateNumber(id, { agentId: next || null }).then((outcome) => {
      setRowError(outcome.ok ? null : outcome.error);
    });
  };

  const release = (record: PhoneNumberRecord) => {
    const confirmed = window.confirm(
      `Release ${record.number}? Calls on it stop immediately. Its call, campaign and ` +
        "assignment history stays here. Returning the line to Sarvam is a separate step in " +
        "the console.",
    );
    if (!confirmed) return;
    void releaseNumber(record.id).then((outcome) => {
      setRowError(outcome.ok ? null : outcome.error);
      if (outcome.ok) {
        setNotice(`Released ${record.number}. Its records are kept.`);
        refreshInventory();
      }
    });
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-5">
      <PageHeader
        eyebrow="Phone numbers"
        title="Phone numbers"
        description="Attach a number provisioned for this organization in the OWN AI Sarvam workspace, then choose the employee that answers it and whether it dials out or receives calls."
        actions={
          <button type="button" onClick={startAttach} className={buttonVariants({ size: "lg" })}>
            <Plus aria-hidden />
            Attach Sarvam number
          </button>
        }
      />

      {numbersError || rowError ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
        >
          <span>{rowError ?? numbersError}</span>
          <button
            type="button"
            onClick={() => {
              setRowError(null);
              void refreshNumbers();
            }}
            className="font-medium underline underline-offset-2"
          >
            Reload the list
          </button>
        </div>
      ) : null}

      {notice ? (
        <p
          role="status"
          className="rounded-lg border border-line bg-mist-soft px-3 py-2 text-xs text-ink-soft"
        >
          {notice}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Attached" value={String(live.length)} hint={`${active} active`} />
        <StatTile
          label="Pending"
          value={String(pending)}
          hint="Waiting for an employee"
        />
        <StatTile
          label="Answered"
          value={String(live.filter((record) => record.agentId).length)}
          hint="Employee assigned"
        />
        <StatTile
          label="Released"
          value={String(unreleased)}
          hint="Kept for their history"
        />
      </div>

      {numbers.length === 0 ? (
        <EmptyState
          icon={<PhoneForwarded className="size-5" />}
          title="No numbers attached"
          description="Numbers are provisioned in the OWN AI Sarvam workspace. Attach the one assigned to your organization to route its calls to an employee."
          action={
            <button type="button" onClick={startAttach} className={buttonVariants({ size: "lg" })}>
              <Plus aria-hidden />
              Attach Sarvam number
            </button>
          }
        />
      ) : (
        <section className="overflow-hidden rounded-xl border border-line bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead>
                <tr className="border-b border-hairline text-[10px] uppercase tracking-wide text-ink-soft">
                  <th scope="col" className="px-4 py-2.5 font-semibold">Number</th>
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
                      {record.label ? (
                        <p className="mt-0.5 max-w-[260px] truncate text-[11px] text-ink-soft">
                          {record.label}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <label className="sr-only" htmlFor={`mode-${record.id}`}>
                        Mode for {record.number}
                      </label>
                      <SelectInput
                        id={`mode-${record.id}`}
                        value={record.mode}
                        onChange={(event) =>
                          saveMode(record.id, event.target.value as PhoneNumberRecord["mode"])
                        }
                        disabled={record.status === "Released"}
                        className="h-8 text-[11px]"
                      >
                        {MODES.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </SelectInput>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge variant={statusVariant(record.status)}>
                        {record.status}
                      </StatusBadge>
                      <RouteLabel record={record} />
                    </td>
                    <td className="px-4 py-3">
                      <label className="sr-only" htmlFor={`agent-${record.id}`}>
                        Employee for {record.number}
                      </label>
                      <SelectInput
                        id={`agent-${record.id}`}
                        value={record.agentId ?? ""}
                        onChange={(event) => saveAgent(record.id, event.target.value)}
                        disabled={record.status === "Released"}
                        className="h-8 text-[11px]"
                      >
                        <option value="">Unassigned</option>
                        {agents.map((agent) => (
                          <option key={agent.id} value={agent.id}>
                            {agent.name}
                          </option>
                        ))}
                      </SelectInput>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {record.status === "Released" ? (
                        <Badge variant="outline">Released</Badge>
                      ) : (
                        <button
                          type="button"
                          onClick={() => release(record)}
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

      <InventoryPanel
        summary={inventory}
        state={inventoryState}
        error={inventoryError}
        onRefresh={refreshInventory}
      />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Attach Sarvam number"
        description="Record a number provisioned for this organization in the OWN AI Sarvam workspace so its calls reach an employee here."
        footer={
          <>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className={buttonVariants({ variant: "outline" })}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void attach()}
              disabled={attaching || digitsIn(number).length < 7}
              className={buttonVariants()}
            >
              {attaching ? "Attaching…" : "Attach number"}
            </button>
          </>
        }
      >
        <Field
          label="Number"
          htmlFor="attach-number"
          hint="As rented in the console. Spaces and the + are ignored; digits decide identity."
        >
          <TextInput
            id="attach-number"
            value={number}
            onChange={(event) => setNumber(event.target.value)}
            placeholder="+91 80 6535 4620"
            inputMode="tel"
            autoComplete="tel"
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name this line" htmlFor="attach-label" hint="Shown on this page only.">
            <TextInput
              id="attach-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Mumbai outbound"
            />
          </Field>
          <Field label="Answered by" htmlFor="attach-agent" hint="Optional — can be set later.">
            <SelectInput
              id="attach-agent"
              value={employeeId}
              onChange={(event) => setEmployeeId(event.target.value)}
            >
              <option value="">Nobody yet</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>

        {attachError ? (
          <p role="alert" className="text-xs text-destructive">
            {attachError}
          </p>
        ) : (
          <p className="text-[11px] leading-relaxed text-ink-soft">
            Attaching records the number here. It does not rent, renew, price or release anything
            with the carrier — the central Sarvam workspace owns that.
          </p>
        )}

        {inventory?.quota ? (
          <p className="text-[11px] leading-relaxed text-ink-soft">
            {inventory.quota.remaining > 0
              ? `${planName(inventory.quota.plan)} plan: ${inventory.quota.current} of ` +
                `${inventory.quota.limit} numbers held, ${inventory.quota.remaining} more fit.`
              : `The ${planName(inventory.quota.plan)} plan holds ${inventory.quota.limit} ` +
                "numbers and all of them are in use. Release one to free a place."}
          </p>
        ) : null}
      </Modal>
    </div>
  );
}

/**
 * Where calls actually land, kept beside the line's own status.
 *
 * The two are different facts: a line can be active and still unconfirmed at
 * the provider, so this says which of those it is rather than repeating
 * "Active" in a second place.
 */
function RouteLabel({ record }: { record: PhoneNumberRecord }) {
  if (record.status === "Released") return null;
  if (!record.agentId) {
    return <p className="mt-1 text-[10px] text-ink-soft">No employee assigned</p>;
  }
  const route = record.routing;
  if (route?.confirmed && route.state === "Active") {
    return (
      <p className="mt-1 text-[10px] font-medium text-cobalt-deep">Route confirmed by Sarvam</p>
    );
  }
  if (route?.state === "Failed") {
    return <p className="mt-1 text-[10px] font-medium text-destructive">Route failed at Sarvam</p>;
  }
  return <p className="mt-1 text-[10px] text-ink-soft">Awaiting Sarvam confirmation</p>;
}

/**
 * Where the lines come from, and what this workspace holds right now.
 *
 * The panel says what it counts. There is no carrier read behind it - Sarvam
 * publishes no API for rented numbers - so a count that disagreed with the
 * console would mean an attachment was missed, not that the account changed.
 */
function InventoryPanel({
  summary,
  state,
  error,
  onRefresh,
}: {
  summary: InventorySummary | null;
  state: InventoryState;
  error: string | null;
  onRefresh: () => void;
}) {
  const checked = summary ? new Date(summary.checked_at) : null;
  const quota = summary?.quota ?? null;
  const share =
    quota && quota.limit > 0 ? Math.min(100, Math.round((quota.current / quota.limit) * 100)) : 0;

  return (
    <section
      aria-labelledby="inventory-heading"
      className="overflow-hidden rounded-xl border border-line bg-surface"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 id="inventory-heading" className="text-sm font-semibold text-ink">
              Central Sarvam workspace
            </h2>
            <StatusBadge variant="secondary">Managed by OWN AI</StatusBadge>
          </div>
          <p className="mt-0.5 max-w-2xl text-[11px] leading-relaxed text-ink-soft">
            Renting, pricing, renewal and returning a line all happen in OWN AI&apos;s central
            Sarvam workspace. This page records which of those numbers belong to this
            organization and who answers them.
          </p>
          <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-ink-soft">
            Sarvam does not expose rented numbers over an API, so the counts below come from what
            was attached here, not from the provider.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {checked ? (
            <span className="hidden text-[10px] uppercase tracking-[0.12em] text-ink-soft sm:inline">
              {checked.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </span>
          ) : null}
          <button
            type="button"
            onClick={onRefresh}
            disabled={state === "loading"}
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-line px-2.5 text-[11px] font-medium text-ink-soft transition-colors hover:bg-mist-soft hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw aria-hidden className={cn("size-3", state === "loading" && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      {state === "loading" && !summary ? (
        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4" aria-hidden>
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="h-16 animate-pulse rounded-lg bg-mist-soft" />
          ))}
        </div>
      ) : null}

      {state === "error" && !summary ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-destructive"
        >
          <span>{error ?? "The counts could not be read."}</span>
          <button
            type="button"
            onClick={onRefresh}
            className="font-medium underline underline-offset-2"
          >
            Try again
          </button>
        </div>
      ) : null}

      {summary ? (
        <>
          {quota ? (
            <div className="border-b border-hairline px-4 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-soft">
                  {planName(quota.plan)} plan allowance
                </p>
                <p className="text-[11px] text-ink">
                  <span className="font-semibold tabular-nums">{quota.current}</span>
                  {" of "}
                  <span className="tabular-nums">{quota.limit}</span> numbers held
                </p>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-mist" aria-hidden>
                <div
                  className={cn(
                    "h-full rounded-full",
                    quota.remaining === 0 ? "bg-destructive" : "bg-cobalt",
                  )}
                  style={{ width: `${share}%` }}
                />
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-ink-soft">
                {quota.remaining > 0
                  ? `${quota.remaining} more ${quota.remaining === 1 ? "number fits" : "numbers fit"} ` +
                    "this plan. Pending and switched-off lines count; released ones do not."
                  : "The plan is full. Release a number or move to a larger plan before attaching " +
                    "another."}
              </p>
            </div>
          ) : null}

          <dl className="grid gap-px border-b border-hairline bg-hairline sm:grid-cols-2 xl:grid-cols-4">
            <CountStat label="Attached" value={summary.local_total} hint="Lines in this workspace" />
            <CountStat label="Active" value={summary.local_active} hint="Answering or dialing" />
            <CountStat label="Pending" value={summary.local_pending} hint="No employee yet" />
            <CountStat
              label="Released"
              value={summary.local_released}
              hint="Records kept, not in use"
            />
          </dl>

          {summary.by_country.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5 border-b border-hairline px-4 py-2.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-soft">
                By country
              </span>
              {summary.by_country.map((entry) => (
                <Badge key={entry.country} variant="outline" className="font-mono">
                  {entry.country} · {entry.numbers}
                </Badge>
              ))}
            </div>
          ) : null}

          <p className="px-4 py-3 text-[11px] leading-relaxed text-ink-soft">
            {summary.local_total === 0
              ? "Nothing attached yet. Attach the number provisioned for this organization here."
              : `${summary.assigned} of ${summary.local_total} assigned to an employee; ` +
                `${summary.unassigned} still unassigned.`}
          </p>
        </>
      ) : null}
    </section>
  );
}

function CountStat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="bg-surface px-4 py-3">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-soft">
        {label}
      </dt>
      <dd className="mt-1 text-lg font-semibold tracking-tight text-ink tabular-nums">{value}</dd>
      {hint ? <dd className="mt-0.5 text-[11px] text-ink-soft">{hint}</dd> : null}
    </div>
  );
}
