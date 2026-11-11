"use client";

import Link from "next/link";
import * as React from "react";
import { KeyRound, ShieldCheck, Users } from "lucide-react";

import { CategoryDropdown } from "@/components/dashboard/ui/category-dropdown";
import {
  Field,
  Modal,
  PageHeader,
  SaveButton,
  StatusBadge,
  TextInput,
} from "@/components/dashboard/ui/kit";
import { useWorkspace } from "@/components/dashboard/workspace-store";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { TeamMember } from "@/content/workspace";
import { cn } from "@/lib/utils";

const TABS = ["Organization", "Team", "Calling", "Notifications", "Security"] as const;
type Tab = (typeof TABS)[number];

const TIMEZONES: { value: string; description: string }[] = [
  { value: "Asia/Kolkata", description: "GMT+5:30 · India Standard Time" },
  { value: "Asia/Dubai", description: "GMT+4 · Gulf Standard Time" },
  { value: "Asia/Singapore", description: "GMT+8 · Singapore Time" },
  { value: "Europe/London", description: "GMT+0 / GMT+1 · UK" },
  { value: "America/New_York", description: "GMT−5 / GMT−4 · US Eastern" },
];
const ROLES: TeamMember["role"][] = ["Owner", "Admin", "Manager", "Member"];
const ROLE_HINTS: Record<TeamMember["role"], string> = {
  Owner: "Full access, including deletion and billing",
  Admin: "Team, billing and every module",
  Manager: "Campaigns, leads and reports",
  Member: "Leads and conversations only",
};

export default function SettingsPage() {
  const store = useWorkspace();
  const { settings, team } = store;
  const [tab, setTab] = React.useState<Tab>("Organization");
  const [orgName, setOrgName] = React.useState(settings.orgName);
  const [timezone, setTimezone] = React.useState(settings.timezone);
  const [currency, setCurrency] = React.useState(settings.currency);
  const [start, setStart] = React.useState(settings.callWindowStart);
  const [end, setEnd] = React.useState(settings.callWindowEnd);
  const [dnd, setDnd] = React.useState(settings.dnd);
  const [record, setRecord] = React.useState(settings.recordCalls);
  const [emailAlerts, setEmailAlerts] = React.useState(settings.emailAlerts);
  const [whatsappAlerts, setWhatsappAlerts] = React.useState(settings.whatsappAlerts);
  const [digest, setDigest] = React.useState(settings.dailyDigest);
  const [twoFactor, setTwoFactor] = React.useState(true);
  const [securityNote, setSecurityNote] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState<TeamMember["role"]>("Member");
  const [error, setError] = React.useState<string | null>(null);

  const invite = () => {
    if (!inviteEmail.includes("@") || inviteEmail.length < 5) {
      setError("Enter a valid email address.");
      return;
    }
    store.inviteMember(inviteEmail.trim(), inviteRole);
    setInviteEmail("");
    setInviteRole("Member");
    setError(null);
    setOpen(false);
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-5">
      <PageHeader
        eyebrow="Settings"
        title="Settings"
        description="Organisation profile, team access, calling rules and notifications for the whole workspace."
        actions={<Badge variant="outline">{team.length} team members</Badge>}
      />

      <div
        role="tablist"
        aria-label="Settings sections"
        className="flex gap-1 overflow-x-auto rounded-lg border border-line bg-surface p-1"
      >
        {TABS.map((item) => (
          <button
            key={item}
            role="tab"
            type="button"
            aria-selected={tab === item}
            onClick={() => setTab(item)}
            className={cn(
              "shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              tab === item
                ? "bg-cobalt-tint text-cobalt-deep"
                : "text-ink-soft hover:bg-mist hover:text-ink",
            )}
          >
            {item}
          </button>
        ))}
      </div>

      {tab === "Organization" ? (
        <section className="rounded-xl border border-line bg-surface p-4">
          <h2 className="text-sm font-semibold text-ink">Organisation profile</h2>
          <p className="mt-0.5 text-xs text-ink-soft">
            Shown on invoices and used for the calling window.
          </p>
          <div className="mt-4 grid max-w-2xl gap-3 sm:grid-cols-2">
            <Field label="Organisation name" htmlFor="org-name" className="sm:col-span-2">
              <TextInput
                id="org-name"
                value={orgName}
                onChange={(event) => setOrgName(event.target.value)}
              />
            </Field>
            <Field label="Timezone" htmlFor="org-timezone">
              <CategoryDropdown
                id="org-timezone"
                label="Timezone"
                value={timezone}
                onChange={setTimezone}
                options={TIMEZONES.map((item) => ({
                  value: item.value,
                  label: item.value,
                  description: item.description,
                }))}
              />
            </Field>
            <Field label="Currency" htmlFor="org-currency">
              <CategoryDropdown
                id="org-currency"
                label="Currency"
                value={currency}
                onChange={setCurrency}
                options={[
                  { value: "INR", label: "Indian rupee", badge: "₹", accent: "#b45309" },
                  { value: "USD", label: "US dollar", badge: "$", accent: "#185adb" },
                  { value: "AED", label: "UAE dirham", badge: "د.إ", accent: "#0f766e" },
                  { value: "SGD", label: "Singapore dollar", badge: "S$", accent: "#b91c1c" },
                ]}
              />
            </Field>
          </div>
          <div className="mt-4">
            <SaveButton
              label="Save organisation"
              onSave={() => store.saveSettings({ orgName, timezone, currency })}
            />
          </div>
        </section>
      ) : null}

      {tab === "Team" ? (
        <section className="rounded-xl border border-line bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-ink">Team</h2>
              <p className="text-xs text-ink-soft">
                Owners and admins can change billing and delete employees.
              </p>
            </div>
            <button type="button" onClick={() => setOpen(true)} className={buttonVariants()}>
              Invite member
            </button>
          </div>
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-hairline text-[10px] uppercase tracking-wide text-ink-soft">
                <th scope="col" className="px-4 py-2 font-semibold">Member</th>
                <th scope="col" className="px-4 py-2 font-semibold">Role</th>
                <th scope="col" className="px-4 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {team.map((member) => (
                <tr key={member.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{member.name}</p>
                    <p className="text-[11px] text-ink-soft">{member.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <CategoryDropdown
                      id={`role-${member.id}`}
                      label={`Role for ${member.name}`}
                      size="sm"
                      className="w-36"
                      value={member.role}
                      onChange={(next) =>
                        store.updateTeamRole(member.id, next as TeamMember["role"])
                      }
                      options={ROLES.map((role) => ({
                        value: role,
                        label: role,
                        description: ROLE_HINTS[role],
                      }))}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge variant={member.status === "Active" ? "success" : "warning"}>
                      {member.status}
                    </StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-4 py-3 text-[11px] text-ink-soft">
            <Users className="mr-1 inline size-3" />
            Seats used {team.length} of 5. Extra seats are billed at ₹499 per member.
          </p>
        </section>
      ) : null}

      {tab === "Calling" ? (
        <section className="rounded-xl border border-line bg-surface p-4">
          <h2 className="text-sm font-semibold text-ink">Calling rules</h2>
          <p className="mt-0.5 text-xs text-ink-soft">
            Applied to campaigns and instant leads. Inbound calls are always answered.
          </p>
          <div className="mt-4 grid max-w-xl gap-3 sm:grid-cols-2">
            <Field label="Window opens" htmlFor="window-start">
              <TextInput
                id="window-start"
                type="time"
                value={start}
                onChange={(event) => setStart(event.target.value)}
              />
            </Field>
            <Field label="Window closes" htmlFor="window-end">
              <TextInput
                id="window-end"
                type="time"
                value={end}
                onChange={(event) => setEnd(event.target.value)}
              />
            </Field>
          </div>
          <div className="mt-4 max-w-xl space-y-2">
            <Toggle
              label="Respect the do-not-call registry"
              description="Skip numbers on the TRAI DND list and anything marked do-not-call by an employee."
              checked={dnd}
              onChange={setDnd}
            />
            <Toggle
              label="Record calls"
              description="Store the audio for 90 days. Transcripts are always kept."
              checked={record}
              onChange={setRecord}
            />
          </div>
          <div className="mt-4">
            <SaveButton
              label="Save calling rules"
              onSave={() =>
                store.saveSettings({
                  callWindowStart: start,
                  callWindowEnd: end,
                  dnd,
                  recordCalls: record,
                })
              }
            />
          </div>
        </section>
      ) : null}

      {tab === "Notifications" ? (
        <section className="rounded-xl border border-line bg-surface p-4">
          <h2 className="text-sm font-semibold text-ink">Notifications</h2>
          <p className="mt-0.5 text-xs text-ink-soft">
            Alerts are sent to the billing email and the owner&apos;s WhatsApp.
          </p>
          <div className="mt-4 max-w-xl space-y-2">
            <Toggle
              label="Email alerts"
              description="Failed campaigns, low credits and failed payments."
              checked={emailAlerts}
              onChange={setEmailAlerts}
            />
            <Toggle
              label="WhatsApp alerts"
              description="An instant message when a campaign finishes or a number is released."
              checked={whatsappAlerts}
              onChange={setWhatsappAlerts}
            />
            <Toggle
              label="Daily digest"
              description="Yesterday's calls, leads and credits in one email at 8am."
              checked={digest}
              onChange={setDigest}
            />
          </div>
          <div className="mt-4">
            <SaveButton
              label="Save notifications"
              onSave={() =>
                store.saveSettings({
                  emailAlerts,
                  whatsappAlerts,
                  dailyDigest: digest,
                })
              }
            />
          </div>
        </section>
      ) : null}

      {tab === "Security" ? (
        <div className="space-y-4">
          <section className="rounded-xl border border-line bg-surface p-4">
            <h2 className="text-sm font-semibold text-ink">Account security</h2>
            <div className="mt-3 max-w-xl">
              <Toggle
                label="Two-factor authentication"
                description="Require a one-time code from the authenticator app at every sign-in."
                checked={twoFactor}
                onChange={setTwoFactor}
              />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSecurityNote("All other sessions were signed out.")}
                className={buttonVariants({ variant: "outline" })}
              >
                Sign out other sessions
              </button>
              <Link href="/dashboard/developers" className={buttonVariants({ variant: "ghost" })}>
                <KeyRound aria-hidden />
                Manage API keys
              </Link>
            </div>
            {securityNote ? (
              <p className="mt-3 rounded-lg bg-[#e6f5ec] px-2.5 py-2 text-[11px] text-[#1c7a4c]">
                {securityNote}
              </p>
            ) : null}
          </section>

          <section className="rounded-xl border border-line bg-surface p-4">
            <h2 className="text-sm font-semibold text-ink">Active sessions</h2>
            <ul className="mt-3 divide-y divide-hairline">
              {[
                { device: "Chrome · Windows", place: "Chennai, IN", when: "Active now", current: true },
                { device: "Safari · iPhone", place: "Chennai, IN", when: "2 hours ago", current: false },
                { device: "n8n workflow", place: "API token", when: "4 minutes ago", current: false },
              ].map((session) => (
                <li key={session.device} className="flex items-center gap-3 py-2.5 text-xs">
                  <ShieldCheck className="size-4 shrink-0 text-ink-soft" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">{session.device}</p>
                    <p className="text-[11px] text-ink-soft">
                      {session.place} · {session.when}
                    </p>
                  </div>
                  {session.current ? <Badge variant="success">This device</Badge> : null}
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Invite a team member"
        description="They receive an email invitation. Seats are billed monthly."
        footer={
          <>
            <button type="button" onClick={() => setOpen(false)} className={buttonVariants({ variant: "outline" })}>
              Cancel
            </button>
            <button type="button" onClick={invite} className={buttonVariants()}>
              Send invite
            </button>
          </>
        }
      >
        <Field label="Email" htmlFor="invite-email">
          <TextInput
            id="invite-email"
            type="email"
            value={inviteEmail}
            onChange={(event) => setInviteEmail(event.target.value)}
            placeholder="name@company.com"
          />
        </Field>
        <Field label="Role" htmlFor="invite-role" hint="Managers can run campaigns; members only see leads.">
          <CategoryDropdown
            id="invite-role"
            label="Role"
            value={inviteRole}
            onChange={(next) => setInviteRole(next as TeamMember["role"])}
            options={ROLES.filter((role) => role !== "Owner").map((role) => ({
              value: role,
              label: role,
              description: ROLE_HINTS[role],
            }))}
          />
        </Field>
        {error ? (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : null}
        <p className="rounded-lg bg-mist-soft p-2.5 text-[11px] text-ink-soft">
          Invited members stay Pending until they accept. You can change the role or remove
          access at any time.
        </p>
      </Modal>
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-line bg-surface p-3 transition-colors hover:bg-mist-soft/60">
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-ink">{label}</span>
        <span className="mt-0.5 block text-[11px] leading-relaxed text-ink-soft">
          {description}
        </span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={cn(
          "relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors peer-focus-visible:ring-3 peer-focus-visible:ring-cobalt/30",
          checked ? "bg-cobalt" : "bg-mist-deep",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-4 rounded-full bg-surface shadow transition-[left]",
            checked ? "left-[18px]" : "left-0.5",
          )}
        />
      </span>
    </label>
  );
}
