import {
  Code,
  CreditCard,
  Gauge,
  GraduationCap,
  Hash,
  LayoutDashboard,
  ListChecks,
  Megaphone,
  MessageSquare,
  PhoneCall,
  PhoneIncoming,
  Settings,
  UserPlus,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * The dashboard's left-hand navigation. Three groups, in the order the product
 * spec lists them; the hrefs are what the catch-all route uses to resolve a
 * page title, so adding a module here is the only edit needed to add it to the
 * sidebar and make its URL resolve.
 */

export type DashboardModule = {
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
};

export type DashboardGroup = {
  heading: string;
  items: DashboardModule[];
};

export const dashboardGroups: DashboardGroup[] = [
  {
    heading: "Overview",
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        description: "What needs your attention today, across every agent.",
      },
      {
        label: "My Employees",
        href: "/dashboard/employees",
        icon: Users,
        description: "The AI agents on your account and how each one is doing.",
      },
      {
        label: "New employee",
        href: "/dashboard/employees/new",
        icon: UserPlus,
        description: "Create an agent, pick a voice and give it a script.",
      },
      {
        label: "Talk to an employee",
        href: "/dashboard/talk",
        icon: PhoneCall,
        description: "Hold a live conversation with an agent before you deploy it.",
      },
    ],
  },
  {
    heading: "Calling",
    items: [
      {
        label: "Instant Leads",
        href: "/dashboard/instant-leads",
        icon: Zap,
        description: "Reach new leads within seconds of them arriving.",
      },
      {
        label: "Bulk Campaigns",
        href: "/dashboard/campaigns",
        icon: Megaphone,
        description: "Upload a list and let an agent work through it.",
      },
      {
        label: "Inbound Calls",
        href: "/dashboard/inbound-calls",
        icon: PhoneIncoming,
        description: "Every call the agents answered, as it happens.",
      },
    ],
  },
  {
    heading: "Results & setup",
    items: [
      {
        label: "Leads & Results",
        href: "/dashboard/leads",
        icon: ListChecks,
        description: "Leads captured, outcomes and follow-up status.",
      },
      {
        label: "All Conversations",
        href: "/dashboard/conversations",
        icon: MessageSquare,
        description: "Transcripts, recordings and call summaries.",
      },
      {
        label: "Train Employees",
        href: "/dashboard/training",
        icon: GraduationCap,
        description: "Give agents knowledge, scripts and corrections.",
      },
      {
        label: "Phone Numbers",
        href: "/dashboard/phone-numbers",
        icon: Hash,
        description: "Buy, verify and route the numbers agents answer on.",
      },
      {
        label: "Performance",
        href: "/dashboard/performance",
        icon: Gauge,
        description: "Answer rates, talk time and conversion by agent.",
      },
      {
        label: "Billing",
        href: "/dashboard/billing",
        icon: CreditCard,
        description: "Plan, usage and invoices.",
      },
      {
        label: "Settings",
        href: "/dashboard/settings",
        icon: Settings,
        description: "Workspace, team and agent defaults.",
      },
      {
        label: "Developers",
        href: "/dashboard/developers",
        icon: Code,
        description: "API keys, webhooks and integration docs.",
      },
    ],
  },
];

export const dashboardModules = dashboardGroups.flatMap((group) => group.items);

/**
 * The slice of the Supabase user the dashboard shell needs. Passed from the
 * server layout so the client chrome never holds the whole session object.
 */
export type DashboardProfile = {
  name: string;
  email: string;
  initials: string;
  avatarUrl: string | null;
};

/**
 * The sidebar's active entry. Longest match wins, so `/dashboard/employees/new`
 * highlights "New employee" rather than also lighting up "My Employees".
 */
export function activeDashboardHref(pathname: string): string | null {
  const matches = dashboardModules.filter((module) =>
    // The index is only itself — otherwise it would prefix-match every module
    // and swallow unknown URLs instead of letting the page 404.
    module.href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname === module.href || pathname.startsWith(`${module.href}/`),
  );

  if (matches.length === 0) {
    return null;
  }

  return matches.reduce((longest, module) =>
    module.href.length > longest.href.length ? module : longest,
  ).href;
}

/** Resolve a module from a URL path — used by the catch-all page for its title. */
export function dashboardModuleForPath(path: string): DashboardModule | null {
  const href = activeDashboardHref(path);
  return dashboardModules.find((module) => module.href === href) ?? null;
}

/** The section heading a module sits under, for page labels. */
export function dashboardGroupForHref(href: string): string {
  return (
    dashboardGroups.find((group) =>
      group.items.some((item) => item.href === href),
    )?.heading ?? "Dashboard"
  );
}

/** Stand-in notification tray until the notifications API exists. */
export const dashboardNotifications = [
  {
    id: "campaign-finished",
    title: "Bulk campaign finished",
    detail: "HDFC renewals · 412 of 420 calls completed",
    time: "12m ago",
    unread: true,
    icon: Megaphone,
  },
  {
    id: "lead-captured",
    title: "3 new instant leads",
    detail: "Captured by the inbound agent in the last hour",
    time: "1h ago",
    unread: true,
    icon: Zap,
  },
  {
    id: "number-verified",
    title: "Phone number verified",
    detail: "+91 80199 52233 is ready for outbound",
    time: "Yesterday",
    unread: false,
    icon: PhoneIncoming,
  },
];
