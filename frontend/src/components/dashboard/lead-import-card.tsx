"use client";

import * as React from "react";
import { ArrowRight, CheckCircle2, Download, Loader2, UserPlus } from "lucide-react";

import { Field, TextInput } from "@/components/dashboard/ui/kit";
import { useWorkspace } from "@/components/dashboard/workspace-store";
import AnimatedFileUpload from "@/components/ui/animated-file-upload";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  CSV_ACCEPT,
  CSV_HEADER,
  type LeadDraft,
  type ParsedLeadRow,
  LEAD_IMPORT_FIELDS,
  blankLeadDraft,
  parseLeadCsv,
  phoneKey,
  validLeads,
  validateLeadDraft,
} from "@/lib/lead-import";
import { cn } from "@/lib/utils";

type Mode = "upload" | "manual";

type Notice = { tone: "ok" | "error"; text: string };

/** Two megabytes is thousands of rows - far past the 5000-lead ceiling. */
const MAX_FILE_BYTES = 2 * 1024 * 1024;

const TEMPLATE_HREF = `data:text/csv;charset=utf-8,${encodeURIComponent(`${CSV_HEADER}\n`)}`;

/**
 * Add leads to the workspace, either from a reviewed sheet or typed one at a
 * time. Both paths send the same four fields and run the same validation, so a
 * row that looks acceptable here is exactly what the server will accept.
 */
export function LeadImportCard({ employeeId }: { employeeId?: string | null }) {
  const { addLead } = useWorkspace();
  const [mode, setMode] = React.useState<Mode>("upload");
  const [rows, setRows] = React.useState<ParsedLeadRow[]>([]);
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<Notice | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [manual, setManual] = React.useState<LeadDraft>(blankLeadDraft);
  const [manualProblems, setManualProblems] = React.useState<string[]>([]);

  const ready = React.useMemo(() => validLeads(rows), [rows]);
  const skippedRows = rows.length - ready.length;

  const remember = (lead: LeadDraft, note: string) => {
    addLead({
      name: lead.name.trim(),
      phone: lead.phone.trim(),
      email: lead.email.trim(),
      source: "Instant leads",
      agentId: employeeId || null,
      status: "New",
      followUp: "Not scheduled",
      lastContact: "just added",
      summary: note,
    });
  };

  const handleFiles = async (files: File[]) => {
    setNotice(null);
    setFileError(null);

    const file = files[0];
    if (!file) {
      setRows([]);
      setFileName(null);
      return;
    }

    setFileName(file.name);

    if (!/\.csv$/i.test(file.name)) {
      setRows([]);
      setFileError("Upload a .csv file. In Excel or Sheets, use Save as → CSV.");
      return;
    }

    const result = parseLeadCsv(await file.text());
    setRows(result.rows);

    if (result.missingFields.length > 0) {
      const labels = result.missingFields
        .map((field) => LEAD_IMPORT_FIELDS.find((item) => item.key === field)?.label ?? field)
        .join(" and ");
      setFileError(`The sheet is missing the ${labels} column.`);
      return;
    }

    if (result.rows.length === 0) {
      setFileError("No rows found. The first row should be a header, then one lead per line.");
    }
  };

  const importSheet = async () => {
    if (ready.length === 0) return;

    setBusy(true);
    setNotice(null);

    try {
      const response = await fetch("/api/leads/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leads: ready, employeeId }),
      });
      const body = (await response.json().catch(() => null)) as
        | {
            created?: number;
            skipped?: number;
            createdPhones?: string[];
            error?: { message?: string };
          }
        | null;

      if (!response.ok) {
        throw new Error(body?.error?.message ?? "The import did not run. Try again.");
      }

      const created = Number(body?.created ?? 0);
      // Name the rows the server says it created rather than the first N ready
      // ones: a sheet that mixes duplicates with new leads would otherwise put
      // the wrong people in the visible list. Falling back to the first N keeps
      // this working against a server that does not report them yet.
      const landed = new Set((body?.createdPhones ?? []).map(phoneKey));
      const saved = landed.size > 0 ? ready.filter((lead) => landed.has(phoneKey(lead.phone))) : [];
      const remembered = saved.length > 0 ? saved : ready.slice(0, created);
      remembered.forEach((lead) =>
        remember(lead, lead.identity ? `Imported · ID ${lead.identity}` : "Imported from a sheet"),
      );

      const duplicates = Number(body?.skipped ?? 0);
      setNotice({
        tone: "ok",
        text:
          `${created} lead${created === 1 ? "" : "s"} imported` +
          (duplicates > 0 ? `, ${duplicates} skipped as duplicates or invalid.` : "."),
      });
      setRows([]);
      setFileName(null);
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "The import did not run. Try again.",
      });
    } finally {
      setBusy(false);
    }
  };

  const addManualLead = async () => {
    const problems = validateLeadDraft(manual);
    setManualProblems(problems);
    if (problems.length > 0) return;

    setBusy(true);
    setNotice(null);

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...manual, employeeId }),
      });
      const body = (await response.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;

      if (!response.ok) {
        throw new Error(body?.error?.message ?? "The lead was not saved. Try again.");
      }

      remember(manual, manual.identity ? `Added by hand · ID ${manual.identity}` : "Added by hand");
      setNotice({ tone: "ok", text: `${manual.name.trim()} is in the queue.` });
      setManual(blankLeadDraft());
      setManualProblems([]);
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "The lead was not saved. Try again.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-ink">Add leads to the queue</h2>
          <p className="mt-0.5 text-xs text-ink-soft">
            Upload a sheet of Name, Email, Phone and Identity, or type one lead in.
          </p>
        </div>
        <a
          href={TEMPLATE_HREF}
          download="aotms-leads-template.csv"
          className="inline-flex items-center gap-1 text-[11px] font-medium text-cobalt hover:underline"
        >
          <Download className="size-3" aria-hidden />
          Template
        </a>
      </div>

      <div
        role="tablist"
        aria-label="How to add leads"
        className="mt-3 inline-flex rounded-lg border border-line bg-mist p-0.5"
      >
        {(
          [
            { id: "upload", label: "Upload a sheet" },
            { id: "manual", label: "Add manually" },
          ] as { id: Mode; label: string }[]
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={mode === tab.id}
            onClick={() => {
              setMode(tab.id);
              setNotice(null);
            }}
            className={cn(
              "h-7 rounded-md px-2.5 text-[11px] font-semibold transition-colors",
              mode === tab.id
                ? "bg-surface text-ink shadow-[0_1px_2px_rgba(13,42,107,0.1)]"
                : "text-ink-soft hover:text-ink",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {mode === "upload" ? (
        <div className="mt-3 space-y-3">
          <AnimatedFileUpload
            accept={CSV_ACCEPT}
            maxSize={MAX_FILE_BYTES}
            multiple={false}
            disabled={busy}
            onFilesSelected={(files) => {
              void handleFiles(files);
            }}
          />

          <p className="text-[11px] text-ink-soft">
            Columns: {LEAD_IMPORT_FIELDS.map((field) => field.label).join(", ")}.
            Name and Phone are required; Email and Identity can stay empty.
          </p>

          {fileError ? (
            <p role="alert" className="text-xs text-destructive">
              {fileError}
            </p>
          ) : null}

          {rows.length > 0 ? (
            <div className="rounded-lg border border-line">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-3 py-2">
                <p className="truncate text-[11px] text-ink-soft">
                  {fileName} · {rows.length} row{rows.length === 1 ? "" : "s"}
                </p>
                <div className="flex items-center gap-1.5">
                  <Badge variant="success">{ready.length} ready</Badge>
                  {skippedRows > 0 ? (
                    <Badge variant="warning">{skippedRows} to skip</Badge>
                  ) : null}
                </div>
              </div>

              <div className="max-h-64 overflow-auto">
                <table className="w-full min-w-[520px] text-left text-[11px]">
                  <thead className="sticky top-0 bg-surface">
                    <tr className="border-b border-hairline text-[10px] uppercase tracking-wide text-ink-soft">
                      <th scope="col" className="px-3 py-1.5 font-semibold">Line</th>
                      <th scope="col" className="px-3 py-1.5 font-semibold">Name</th>
                      <th scope="col" className="px-3 py-1.5 font-semibold">Email</th>
                      <th scope="col" className="px-3 py-1.5 font-semibold">Phone</th>
                      <th scope="col" className="px-3 py-1.5 font-semibold">Identity</th>
                      <th scope="col" className="px-3 py-1.5 font-semibold">Check</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {rows.slice(0, 100).map((row) => (
                      <tr key={row.line} className={row.problems.length ? "bg-tangerine-tint/30" : undefined}>
                        <td className="px-3 py-1.5 text-ink-soft tabular-nums">{row.line}</td>
                        <td className="px-3 py-1.5 font-medium text-ink">{row.lead.name || "—"}</td>
                        <td className="px-3 py-1.5 text-ink-soft">{row.lead.email || "—"}</td>
                        <td className="px-3 py-1.5 text-ink-soft">{row.lead.phone || "—"}</td>
                        <td className="px-3 py-1.5 text-ink-soft">{row.lead.identity || "—"}</td>
                        <td className="px-3 py-1.5">
                          {row.problems.length === 0 ? (
                            <span className="inline-flex items-center gap-1 text-[#1c7a4c]">
                              <CheckCircle2 className="size-3" aria-hidden /> Ready
                            </span>
                          ) : (
                            <span className="text-tangerine-ink" title={row.problems.join(" ")}>
                              {row.problems[0]}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {rows.length > 100 ? (
                <p className="border-t border-hairline px-3 py-1.5 text-[10px] text-ink-soft">
                  Showing the first 100 rows. All {rows.length} will be imported.
                </p>
              ) : null}
            </div>
          ) : null}

          <button
            type="button"
            onClick={importSheet}
            disabled={busy || ready.length === 0}
            className={buttonVariants({
              size: "lg",
              className: "w-full gap-2 disabled:opacity-60",
            })}
          >
            {busy ? <Loader2 aria-hidden className="animate-spin" /> : null}
            {busy
              ? "Importing…"
              : ready.length > 0
                ? `Import ${ready.length} lead${ready.length === 1 ? "" : "s"}`
                : "Choose a file to import"}
            {!busy ? <ArrowRight aria-hidden /> : null}
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" htmlFor="import-name">
              <TextInput
                id="import-name"
                value={manual.name}
                onChange={(event) => setManual({ ...manual, name: event.target.value })}
                placeholder="Rohit Sharma"
                autoComplete="off"
              />
            </Field>
            <Field label="Phone" htmlFor="import-phone">
              <TextInput
                id="import-phone"
                value={manual.phone}
                onChange={(event) => setManual({ ...manual, phone: event.target.value })}
                placeholder="+91 98204 11822"
                inputMode="tel"
                autoComplete="off"
              />
            </Field>
            <Field label="Email" hint="Optional" htmlFor="import-email">
              <TextInput
                id="import-email"
                value={manual.email}
                onChange={(event) => setManual({ ...manual, email: event.target.value })}
                placeholder="rohit@example.com"
                inputMode="email"
                autoComplete="off"
              />
            </Field>
            <Field label="Identity" hint="Your reference for this customer" htmlFor="import-identity">
              <TextInput
                id="import-identity"
                value={manual.identity}
                onChange={(event) => setManual({ ...manual, identity: event.target.value })}
                placeholder="POL-884213"
                autoComplete="off"
              />
            </Field>
          </div>

          {manualProblems.length > 0 ? (
            <ul role="alert" className="space-y-0.5 text-xs text-destructive">
              {manualProblems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          ) : null}

          <button
            type="button"
            onClick={addManualLead}
            disabled={busy}
            className={buttonVariants({
              size: "lg",
              className: "w-full gap-2 disabled:opacity-60",
            })}
          >
            {busy ? (
              <Loader2 aria-hidden className="animate-spin" />
            ) : (
              <UserPlus aria-hidden />
            )}
            {busy ? "Saving…" : "Add lead"}
          </button>
        </div>
      )}

      {notice ? (
        <p
          role="status"
          className={cn(
            "mt-2 rounded-lg px-2.5 py-2 text-xs",
            notice.tone === "ok"
              ? "bg-[#e6f5ec] text-[#1c7a4c]"
              : "bg-destructive/10 text-destructive",
          )}
        >
          {notice.text}
        </p>
      ) : null}
    </section>
  );
}
