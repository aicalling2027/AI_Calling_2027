"use client";

import * as React from "react";
import { Check, Code2, Copy, KeyRound, Plus, Trash2, Webhook } from "lucide-react";

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
import { cn } from "@/lib/utils";

const EVENTS = ["call.completed", "call.failed", "lead.created", "campaign.finished"];

const SAMPLE = `curl https://api.aotms.si/v1/calls \\
  -H "Authorization: Bearer sk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "employee_id": "emp_aarav",
    "phone": "+919820411822",
    "language": "hi-IN",
    "context": "Renewal due on 28 Nov"
  }'`;

export default function DevelopersPage() {
  const { apiKeys, webhooks, addApiKey, revokeApiKey, addWebhook, toggleWebhook } =
    useWorkspace();
  const [keyOpen, setKeyOpen] = React.useState(false);
  const [label, setLabel] = React.useState("");
  const [createdKey, setCreatedKey] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState<string | null>(null);
  const [hookOpen, setHookOpen] = React.useState(false);
  const [hookUrl, setHookUrl] = React.useState("");
  const [hookEvents, setHookEvents] = React.useState<string[]>([EVENTS[0]]);
  const [hookError, setHookError] = React.useState<string | null>(null);

  const copy = async (value: string, tag: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(tag);
      setTimeout(() => setCopied((current) => (current === tag ? null : current)), 1600);
    } catch {
      setCopied(null);
    }
  };

  const createKey = () => {
    if (!label.trim()) return;
    const raw = addApiKey(label.trim());
    setCreatedKey(raw);
    setLabel("");
    setKeyOpen(false);
  };

  const createHook = () => {
    if (!/^https:\/\//.test(hookUrl)) {
      setHookError("Use an https:// endpoint.");
      return;
    }
    if (hookEvents.length === 0) {
      setHookError("Pick at least one event.");
      return;
    }
    addWebhook(hookUrl.trim(), hookEvents);
    setHookUrl("");
    setHookEvents([EVENTS[0]]);
    setHookError(null);
    setHookOpen(false);
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-5">
      <PageHeader
        eyebrow="Developers"
        title="Developers"
        description="API keys, webhooks and the endpoints behind the dashboard. Everything the UI can do is available over REST."
        actions={<Badge variant="secondary">API v1</Badge>}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="API keys" value={String(apiKeys.length)} hint="Live keys only" />
        <StatTile label="Webhooks" value={String(webhooks.length)} hint={`${webhooks.filter((hook) => hook.status === "Active").length} active`} />
        <StatTile label="Requests today" value="18,402" hint="Across all keys" />
        <StatTile label="Rate limit" value="120 / min" hint="Per key, per endpoint" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-xl border border-line bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-4 py-3">
            <div>
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                <KeyRound className="size-4 text-cobalt" />
                API keys
              </h2>
              <p className="text-xs text-ink-soft">Keys inherit the organisation&apos;s permissions.</p>
            </div>
            <button type="button" onClick={() => setKeyOpen(true)} className={buttonVariants({ size: "sm" })}>
              <Plus aria-hidden />
              Create key
            </button>
          </div>
          {apiKeys.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={<KeyRound className="size-5" />}
                title="No API keys"
                description="Create a key to call the REST API from your backend or n8n."
              />
            </div>
          ) : (
            <ul className="divide-y divide-hairline">
              {apiKeys.map((key) => (
                <li key={key.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-ink">{key.label}</p>
                    <p className="font-mono text-[11px] text-ink-soft">
                      {key.prefix}••••••••••••
                    </p>
                    <p className="text-[11px] text-ink-soft">
                      Created {key.createdAt} · last used {key.lastUsed}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Revoke “${key.label}”? Requests using it fail immediately.`)) {
                        revokeApiKey(key.id);
                      }
                    }}
                    className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-ink-soft transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-3" />
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
          )}
          {createdKey ? (
            <div className="m-4 rounded-lg bg-[#e6f5ec] p-3">
              <p className="text-[11px] font-semibold text-[#1c7a4c]">
                Copy this key now — it is not shown again.
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded bg-surface px-2 py-1.5 font-mono text-[11px] text-ink ring-1 ring-line">
                  {createdKey}
                </code>
                <button
                  type="button"
                  onClick={() => copy(createdKey, "created")}
                  className="inline-flex h-8 items-center gap-1 rounded-md bg-surface px-2 text-[11px] font-medium text-ink ring-1 ring-line"
                >
                  {copied === "created" ? <Check className="size-3" /> : <Copy className="size-3" />}
                  {copied === "created" ? "Copied" : "Copy"}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setCreatedKey(null)}
                className="mt-2 text-[11px] font-semibold text-[#1c7a4c] underline"
              >
                I have saved it
              </button>
            </div>
          ) : null}
        </section>

        <section className="rounded-xl border border-line bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-4 py-3">
            <div>
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                <Webhook className="size-4 text-cobalt" />
                Webhooks
              </h2>
              <p className="text-xs text-ink-soft">Signed with the workspace secret in the header.</p>
            </div>
            <button type="button" onClick={() => setHookOpen(true)} className={buttonVariants({ size: "sm" })}>
              <Plus aria-hidden />
              Add webhook
            </button>
          </div>
          {webhooks.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={<Webhook className="size-5" />}
                title="No webhooks"
                description="Send finished calls to n8n, your CRM or Slack."
              />
            </div>
          ) : (
            <ul className="divide-y divide-hairline">
              {webhooks.map((hook) => (
                <li key={hook.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-[11px] font-medium text-ink">
                        {hook.url}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {hook.events.map((event) => (
                          <Badge key={event} variant="outline">
                            {event}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <StatusBadge variant={hook.status === "Active" ? "success" : "secondary"}>
                        {hook.status}
                      </StatusBadge>
                      <button
                        type="button"
                        onClick={() => toggleWebhook(hook.id)}
                        className="inline-flex h-7 items-center rounded-md bg-mist px-2 text-[11px] font-medium text-ink-soft transition-colors hover:text-ink"
                      >
                        {hook.status === "Active" ? "Disable" : "Enable"}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="rounded-xl border border-line bg-surface p-4 xl:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              <Code2 className="size-4 text-cobalt" />
              Start a call from your backend
            </h2>
            <button
              type="button"
              onClick={() => copy(SAMPLE, "sample")}
              className={cn(
                "inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium transition-colors",
                copied === "sample"
                  ? "bg-[#e6f5ec] text-[#1c7a4c]"
                  : "bg-mist text-ink-soft hover:text-ink",
              )}
            >
              {copied === "sample" ? <Check className="size-3" /> : <Copy className="size-3" />}
              {copied === "sample" ? "Copied" : "Copy"}
            </button>
          </div>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-cobalt-night p-4 text-[11px] leading-relaxed text-white/90">
            <code>{SAMPLE}</code>
          </pre>
          <p className="mt-2 text-[11px] text-ink-soft">
            The call is queued and the response returns a call id. Poll
            <code className="mx-1 rounded bg-mist px-1 py-0.5 font-mono text-[10px]">GET /v1/calls/{"{id}"}</code>
            or subscribe to <code className="rounded bg-mist px-1 py-0.5 font-mono text-[10px]">call.completed</code>.
          </p>
        </section>

        <section className="rounded-xl border border-line bg-surface p-4">
          <h2 className="text-sm font-semibold text-ink">Rate limits</h2>
          <dl className="mt-3 space-y-2 text-xs">
            {[
              { label: "Read endpoints", value: "600 / min" },
              { label: "Call creation", value: "120 / min" },
              { label: "Bulk imports", value: "10 / min" },
              { label: "Webhook retries", value: "5, exponential" },
            ].map((row) => (
              <div key={row.label} className="flex justify-between gap-3">
                <dt className="text-ink-soft">{row.label}</dt>
                <dd className="font-medium text-ink">{row.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 rounded-lg bg-mist-soft p-2.5 text-[11px] leading-relaxed text-ink-soft">
            Limits are per key. A 429 response includes <code className="font-mono">Retry-After</code>{" "}
            in seconds.
          </p>
          <a
            href="https://api.aotms.si/docs"
            className={buttonVariants({ variant: "outline", size: "sm", className: "mt-3 w-full" })}
          >
            Open API reference
          </a>
        </section>
      </div>

      <section className="overflow-hidden rounded-xl border border-line bg-surface">
        <div className="border-b border-hairline px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Recent API activity</h2>
        </div>
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead>
            <tr className="border-b border-hairline text-[10px] uppercase tracking-wide text-ink-soft">
              <th scope="col" className="px-4 py-2 font-semibold">Endpoint</th>
              <th scope="col" className="px-4 py-2 font-semibold">Key</th>
              <th scope="col" className="px-4 py-2 font-semibold">Status</th>
              <th scope="col" className="px-4 py-2 font-semibold">Latency</th>
              <th scope="col" className="px-4 py-2 font-semibold">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {[
              { endpoint: "POST /v1/calls", key: "Production server", status: "201", latency: "184 ms", when: "4 min ago" },
              { endpoint: "POST /v1/webhooks/n8n", key: "n8n workflow", status: "200", latency: "62 ms", when: "12 min ago" },
              { endpoint: "GET /v1/leads", key: "Production server", status: "200", latency: "91 ms", when: "18 min ago" },
              { endpoint: "POST /v1/campaigns/import", key: "Production server", status: "429", latency: "4 ms", when: "1 hr ago" },
            ].map((row) => (
              <tr key={`${row.endpoint}-${row.when}`}>
                <td className="px-4 py-2.5 font-mono text-[11px] text-ink">{row.endpoint}</td>
                <td className="px-4 py-2.5 text-ink-soft">{row.key}</td>
                <td className="px-4 py-2.5">
                  <Badge variant={row.status === "200" || row.status === "201" ? "success" : "danger"}>
                    {row.status}
                  </Badge>
                </td>
                <td className="px-4 py-2.5 text-ink-soft">{row.latency}</td>
                <td className="px-4 py-2.5 text-ink-soft">{row.when}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <Modal
        open={keyOpen}
        onClose={() => setKeyOpen(false)}
        title="Create an API key"
        description="The full key is shown once. Store it in your secret manager."
        footer={
          <>
            <button type="button" onClick={() => setKeyOpen(false)} className={buttonVariants({ variant: "outline" })}>
              Cancel
            </button>
            <button type="button" onClick={createKey} className={buttonVariants()}>
              Create key
            </button>
          </>
        }
      >
        <Field label="Key label" htmlFor="key-label" hint="Name it after the system that will use it.">
          <TextInput
            id="key-label"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Production server"
          />
        </Field>
        <p className="rounded-lg bg-mist-soft p-2.5 text-[11px] text-ink-soft">
          Keys are scoped to this organisation. Rotating a key revokes the old one
          immediately.
        </p>
      </Modal>

      <Modal
        open={hookOpen}
        onClose={() => setHookOpen(false)}
        title="Add a webhook"
        description="We POST a signed JSON body and retry failed deliveries five times."
        footer={
          <>
            <button type="button" onClick={() => setHookOpen(false)} className={buttonVariants({ variant: "outline" })}>
              Cancel
            </button>
            <button type="button" onClick={createHook} className={buttonVariants()}>
              Add webhook
            </button>
          </>
        }
      >
        <Field label="Endpoint URL" htmlFor="hook-url">
          <TextInput
            id="hook-url"
            value={hookUrl}
            onChange={(event) => setHookUrl(event.target.value)}
            placeholder="https://hooks.example.com/aotms"
          />
        </Field>
        <fieldset>
          <legend className="text-xs font-semibold text-ink">Events</legend>
          <div className="mt-1.5 space-y-1.5">
            {EVENTS.map((event) => (
              <label key={event} className="flex items-center gap-2 text-xs text-ink-soft">
                <input
                  type="checkbox"
                  checked={hookEvents.includes(event)}
                  onChange={() =>
                    setHookEvents((current) =>
                      current.includes(event)
                        ? current.filter((item) => item !== event)
                        : [...current, event],
                    )
                  }
                  className="size-3.5 rounded border-line accent-cobalt"
                />
                <code className="font-mono text-[11px]">{event}</code>
              </label>
            ))}
          </div>
        </fieldset>
        {hookError ? (
          <p role="alert" className="text-xs text-destructive">
            {hookError}
          </p>
        ) : null}
      </Modal>
    </div>
  );
}
