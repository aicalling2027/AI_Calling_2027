"use client";

import * as React from "react";
import { PhoneForwarded, Plus, Search } from "lucide-react";

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
import type { AvailableNumber, TelephonyMarket } from "@/lib/api/phone-numbers";

const MODES: PhoneNumberRecord["mode"][] = ["Inbound", "Outbound", "Both"];

const money = (value: number) => `₹${value.toLocaleString("en-IN")}`;

const statusVariant = (status: PhoneNumberRecord["status"]) =>
  status === "Active" ? "success" : status === "Pending" ? "warning" : "secondary";

export default function PhoneNumbersPage() {
  const { numbers, numbersError, refreshNumbers, agents, updateNumber, releaseNumber, buyNumber } =
    useWorkspace();

  const [open, setOpen] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [rowError, setRowError] = React.useState<string | null>(null);

  // The purchase form's own state: where to look, what was found, what is chosen.
  const [markets, setMarkets] = React.useState<TelephonyMarket[]>([]);
  const [countryCode, setCountryCode] = React.useState("");
  const [region, setRegion] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [shelf, setShelf] = React.useState<AvailableNumber[]>([]);
  const [shelfStatus, setShelfStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [shelfError, setShelfError] = React.useState<string | null>(null);
  const [chosen, setChosen] = React.useState<AvailableNumber | null>(null);
  const [label, setLabel] = React.useState("");
  const [employeeId, setEmployeeId] = React.useState("");
  const [buying, setBuying] = React.useState(false);
  const [buyError, setBuyError] = React.useState<string | null>(null);

  const active = numbers.filter((record) => record.status === "Active").length;
  const pending = numbers.filter((record) => record.status === "Pending").length;
  const monthly = numbers
    .filter((record) => record.status !== "Released")
    .reduce((total, record) => total + (record.monthlyCostInr ?? 0), 0);
  const country = markets.find((market) => market.country_code === countryCode);
  const chosenPrice = chosen?.monthly_cost_inr ?? 0;

  // Where numbers can be bought is a read of its own: it changes when the
  // carrier adds a market, not when this workspace buys something.
  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/phone-numbers/catalogue", { cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as
          | { markets?: TelephonyMarket[]; error?: { message?: string } }
          | null;
        if (!response.ok) throw new Error(body?.error?.message ?? "Could not load the catalogue.");
        return body?.markets ?? [];
      })
      .then((items) => {
        if (cancelled || items.length === 0) return;
        setMarkets(items);
        setCountryCode((current) => current || items[0].country_code);
        setRegion((current) => current || items[0].regions[0]?.region || "");
      })
      .catch((error: unknown) => {
        console.error("[phone-numbers] load catalogue", error);
        if (!cancelled) {
          setShelfStatus("error");
          setShelfError(
            error instanceof Error ? error.message : "The catalogue could not be loaded.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Search is a round trip, so it waits for a pause in typing rather than
  // firing once per keystroke.
  React.useEffect(() => {
    if (!open || !countryCode) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ country_code: countryCode, limit: "12" });
      if (region) params.set("region", region);
      if (search.trim()) params.set("q", search.trim());

      setShelfStatus("loading");
      fetch(`/api/phone-numbers/available?${params.toString()}`, {
        cache: "no-store",
        signal: controller.signal,
      })
        .then(async (response) => {
          const body = (await response.json().catch(() => null)) as
            | { numbers?: AvailableNumber[]; error?: { message?: string } }
            | null;
          if (!response.ok) throw new Error(body?.error?.message ?? "Could not load numbers.");
          return body?.numbers ?? [];
        })
        .then((items) => {
          setShelf(items);
          setShelfError(null);
          setShelfStatus("ready");
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          console.error("[phone-numbers] search", error);
          setShelfError(error instanceof Error ? error.message : "Numbers could not be loaded.");
          setShelfStatus("error");
        });
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [open, countryCode, region, search]);

  const startPurchase = () => {
    setChosen(null);
    setLabel("");
    setEmployeeId("");
    setBuyError(null);
    setNotice(null);
    setSearch("");
    setOpen(true);
  };

  const chooseNumber = (row: AvailableNumber) => {
    setChosen(row);
    // The city a line was bought in is the name that stays useful on a list of
    // ten of them, so it is the default rather than a blank field.
    setLabel((current) => (current.trim() ? current : `${row.region} line`));
  };

  const buy = async () => {
    if (!chosen) return;
    setBuying(true);
    setBuyError(null);
    const outcome = await buyNumber({
      number: chosen.number,
      label: label.trim() || undefined,
      employeeId: employeeId || null,
      capabilities: ["inbound", "outbound"],
    });
    setBuying(false);
    if (!outcome.ok) {
      setBuyError(outcome.error);
      return;
    }
    setOpen(false);
    setNotice(
      `Bought ${outcome.record.number} for ${money(chosen.monthly_cost_inr)} a month. ` +
        (outcome.record.status === "Active"
          ? "It routes to its employee now."
          : "Assign an employee to start answering calls on it."),
    );
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
      `Release ${record.number}? Calls on it stop immediately, the number goes back to the ` +
        "shelf and this cannot be undone.",
    );
    if (!confirmed) return;
    void releaseNumber(record.id).then((outcome) => {
      setRowError(outcome.ok ? null : outcome.error);
      if (outcome.ok) {
        setNotice(`Released ${record.number}. It is back on the shelf for anyone to buy.`);
      }
    });
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-5">
      <PageHeader
        eyebrow="Phone numbers"
        title="Phone numbers"
        description="Buy numbers, assign the employee that answers each line, and decide whether a line dials out or receives calls."
        actions={
          <button type="button" onClick={startPurchase} className={buttonVariants({ size: "lg" })}>
            <Plus aria-hidden />
            Buy a number
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
        <StatTile label="Numbers" value={String(numbers.length)} hint={`${active} active`} />
        <StatTile label="Billed monthly" value={money(monthly)} hint="Lines not yet released" />
        <StatTile label="Pending" value={String(pending)} hint="Waiting for an employee" />
        <StatTile
          label="Assigned"
          value={String(numbers.filter((record) => record.agentId).length)}
          hint="Answered by an employee"
        />
      </div>

      {numbers.length === 0 ? (
        <EmptyState
          icon={<PhoneForwarded className="size-5" />}
          title="No numbers yet"
          description="Buy a number to start making outbound calls and receiving inbound enquiries."
          action={
            <button type="button" onClick={startPurchase} className={buttonVariants({ size: "lg" })}>
              <Plus aria-hidden />
              Buy a number
            </button>
          }
        />
      ) : (
        <section className="overflow-hidden rounded-xl border border-line bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-xs">
              <thead>
                <tr className="border-b border-hairline text-[10px] uppercase tracking-wide text-ink-soft">
                  <th scope="col" className="px-4 py-2.5 font-semibold">Number</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Provider</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Mode</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Status</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Answered by</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Monthly</th>
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
                    <td className="px-4 py-3 text-ink-soft">{record.provider}</td>
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
                    <td className="px-4 py-3 text-ink-soft">
                      {record.monthlyCostInr ? money(record.monthlyCostInr) : "—"}
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

      <section className="rounded-xl border border-line bg-cream/60 p-4">
        <h2 className="text-xs font-semibold text-ink">Porting a number you already own</h2>
        <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-ink-soft">
          A number bought elsewhere can be moved to AOTMS SIP and keep working while it moves.
          Porting needs the last invoice and an authorised-signatory letter, so it starts with a
          message to support rather than a form here. Most ports complete in two working days.
        </p>
      </section>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Buy a number"
        description="Pick a number from the shelf. It is billed monthly from today and is yours alone."
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
              onClick={() => void buy()}
              disabled={!chosen || buying}
              className={buttonVariants()}
            >
              {buying
                ? "Buying…"
                : chosen
                  ? `Buy for ${money(chosenPrice)}/mo`
                  : "Choose a number"}
            </button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Country" htmlFor="buy-country">
            <SelectInput
              id="buy-country"
              value={countryCode}
              onChange={(event) => {
                const next = markets.find((market) => market.country_code === event.target.value);
                setCountryCode(event.target.value);
                setRegion(next?.regions[0]?.region ?? "");
                setChosen(null);
              }}
            >
              {markets.map((market) => (
                <option key={market.country_code} value={market.country_code}>
                  {market.country} ({market.dial_code})
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="City" htmlFor="buy-region" hint="A local prefix is easier to answer.">
            <SelectInput
              id="buy-region"
              value={region}
              onChange={(event) => {
                setRegion(event.target.value);
                setChosen(null);
              }}
            >
              {(country?.regions ?? []).map((item) => (
                <option key={item.region} value={item.region}>
                  {item.region} · {money(item.monthly_cost_inr)}/mo
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>

        <Field
          label="Search"
          htmlFor="buy-search"
          hint="Optional — part of the number, e.g. 22671."
        >
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-soft"
            />
            <TextInput
              id="buy-search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                // The chosen number may not survive the new results, and a
                // selection the buyer cannot see is a trap.
                setChosen(null);
              }}
              placeholder="Digits"
              inputMode="numeric"
              className="pl-8"
            />
          </div>
        </Field>

        <div>
          <p className="text-xs font-semibold text-ink">Available numbers</p>
          <div className="mt-1.5 max-h-56 overflow-y-auto rounded-lg border border-line">
            {shelfStatus === "loading" ? (
              <p className="px-3 py-4 text-[11px] text-ink-soft">Looking for numbers…</p>
            ) : shelfStatus === "error" ? (
              <p className="px-3 py-4 text-[11px] text-destructive">
                {shelfError ?? "Numbers could not be loaded."}
              </p>
            ) : shelf.length === 0 ? (
              <p className="px-3 py-4 text-[11px] text-ink-soft">
                Every number here is taken. Try another city or clear the search.
              </p>
            ) : (
              <ul className="divide-y divide-hairline">
                {shelf.map((row) => (
                  <li key={row.number}>
                    <button
                      type="button"
                      onClick={() => chooseNumber(row)}
                      aria-pressed={chosen?.number === row.number}
                      className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors ${
                        chosen?.number === row.number
                          ? "bg-cobalt/5"
                          : "hover:bg-mist-soft"
                      }`}
                    >
                      <span>
                        <span className="block font-mono text-xs font-semibold text-ink">
                          {row.formatted}
                        </span>
                        <span className="block text-[11px] text-ink-soft">
                          {row.region} · {row.capabilities.join(" + ")}
                        </span>
                      </span>
                      <span className="text-[11px] font-medium text-ink-soft">
                        {money(row.monthly_cost_inr)}/mo
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name this line" htmlFor="buy-label" hint="Shown on this page only.">
            <TextInput
              id="buy-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder={chosen ? `${chosen.region} line` : "Mumbai outbound"}
            />
          </Field>
          <Field label="Answered by" htmlFor="buy-agent" hint="Optional — can be set later.">
            <SelectInput
              id="buy-agent"
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

        {buyError ? (
          <p role="alert" className="text-xs text-destructive">
            {buyError}
          </p>
        ) : (
          <p className="text-[11px] leading-relaxed text-ink-soft">
            {chosen
              ? `${chosen.formatted} — ${money(chosen.monthly_cost_inr)} a month from ${chosen.country}.`
              : "Prices are per month; there is no setup fee."}
          </p>
        )}
      </Modal>
    </div>
  );
}
