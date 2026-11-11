import {
  CalendarClock,
  CreditCard,
  Hash,
  ListChecks,
  Megaphone,
  MessageSquare,
  PhoneCall,
  PhoneIncoming,
  PhoneOff,
  Upload,
  UserPlus,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * Sample figures for the dashboard home screen. Every number here is placeholder
 * data shaped like the API will eventually return it — the PRD's Dashboard
 * module (section 5) defines the widgets, not the values.
 */

export type DashboardKpi = {
  id: string;
  label: string;
  value: string;
  delta: string;
  trend: "up" | "down";
  hint: string;
  icon: LucideIcon;
  /** Light tint only — the dashboard never uses saturated fills. */
  iconClass: string;
};

export const dashboardKpis: DashboardKpi[] = [
  {
    id: "total-calls",
    label: "Total calls",
    value: "4,812",
    delta: "+12.4%",
    trend: "up",
    hint: "vs previous 30 days",
    icon: PhoneCall,
    iconClass: "bg-cobalt-tint text-cobalt-deep",
  },
  {
    id: "answered",
    label: "Answered calls",
    value: "3,947",
    delta: "+4.1%",
    trend: "up",
    hint: "82% answer rate",
    icon: PhoneIncoming,
    iconClass: "bg-mist text-ink-soft",
  },
  {
    id: "leads",
    label: "Leads captured",
    value: "612",
    delta: "+9.8%",
    trend: "up",
    hint: "from 4,812 conversations",
    icon: UserPlus,
    iconClass: "bg-tangerine-tint text-tangerine-ink",
  },
  {
    id: "qualified",
    label: "Qualified leads",
    value: "274",
    delta: "+3.2%",
    trend: "up",
    hint: "45% of captured leads",
    icon: ListChecks,
    iconClass: "bg-[#e6f5ec] text-[#1c7a4c]",
  },
];

/** The PRD's "Recent summary" strip — today only, not a 30-day window. */
export const dashboardSummary = [
  { id: "calls", label: "Total calls", value: "186", hint: "+12 vs yesterday" },
  { id: "leads", label: "Leads generated", value: "24", hint: "+5 vs yesterday" },
  { id: "conversations", label: "Successful", value: "141", hint: "76% of calls" },
  { id: "appointments", label: "Appointments", value: "11", hint: "+3 vs yesterday" },
  { id: "follow-ups", label: "Follow-ups due", value: "9", hint: "due today" },
  { id: "transfers", label: "Human transfers", value: "4", hint: "3% of calls" },
];

export type CallVolumePoint = {
  period: string;
  total: number;
  answered: number;
  missed: number;
};

export type CallVolumeRange = "daily" | "weekly" | "monthly";

export const callVolumeSeries: Record<
  "total" | "answered" | "missed",
  { label: string; color: string }
> = {
  total: { label: "Total calls", color: "#185adb" },
  answered: { label: "Answered", color: "#0d2a6b" },
  missed: { label: "Missed", color: "#ff8a3d" },
};

export const callVolumeRanges: Record<
  CallVolumeRange,
  { label: string; hint: string; points: CallVolumePoint[] }
> = {
  daily: {
    label: "Daily",
    hint: "Last 10 days",
    points: [
      { period: "Nov 3", total: 152, answered: 129, missed: 23 },
      { period: "Nov 4", total: 168, answered: 141, missed: 27 },
      { period: "Nov 5", total: 149, answered: 124, missed: 25 },
      { period: "Nov 6", total: 181, answered: 150, missed: 31 },
      { period: "Nov 7", total: 142, answered: 117, missed: 25 },
      { period: "Nov 8", total: 96, answered: 81, missed: 15 },
      { period: "Nov 9", total: 88, answered: 74, missed: 14 },
      { period: "Nov 10", total: 176, answered: 148, missed: 28 },
      { period: "Nov 11", total: 194, answered: 163, missed: 31 },
      { period: "Nov 12", total: 186, answered: 152, missed: 34 },
    ],
  },
  weekly: {
    label: "Weekly",
    hint: "Last 8 weeks",
    points: [
      { period: "W40", total: 1040, answered: 852, missed: 135 },
      { period: "W41", total: 982, answered: 805, missed: 128 },
      { period: "W42", total: 1106, answered: 907, missed: 144 },
      { period: "W43", total: 1172, answered: 961, missed: 152 },
      { period: "W44", total: 1090, answered: 894, missed: 142 },
      { period: "W45", total: 1188, answered: 974, missed: 155 },
      { period: "W46", total: 1240, answered: 1017, missed: 161 },
      { period: "W47", total: 1210, answered: 992, missed: 157 },
    ],
  },
  monthly: {
    label: "Monthly",
    hint: "Last 6 months",
    points: [
      { period: "Jun", total: 3120, answered: 2558, missed: 374 },
      { period: "Jul", total: 3480, answered: 2854, missed: 418 },
      { period: "Aug", total: 3890, answered: 3190, missed: 467 },
      { period: "Sep", total: 4120, answered: 3378, missed: 494 },
      { period: "Oct", total: 4560, answered: 3739, missed: 547 },
      { period: "Nov", total: 4812, answered: 3947, missed: 578 },
    ],
  },
};

/** Calls per hour of day — the bar chart in the PRD's "Busiest hours". */
export const busiestHours = [
  { hour: "8am", calls: 34 },
  { hour: "9am", calls: 62 },
  { hour: "10am", calls: 118 },
  { hour: "11am", calls: 142 },
  { hour: "12pm", calls: 96 },
  { hour: "1pm", calls: 74 },
  { hour: "2pm", calls: 108 },
  { hour: "3pm", calls: 124 },
  { hour: "4pm", calls: 88 },
  { hour: "5pm", calls: 52 },
];

export type DonutSlice = { label: string; value: number; color: string };

export const conversationOutcomes: DonutSlice[] = [
  { label: "Successful", value: 1690, color: "#185adb" },
  { label: "Lead captured", value: 984, color: "#4f86e8" },
  { label: "Appointment booked", value: 421, color: "#0d2a6b" },
  { label: "Interested", value: 612, color: "#ff8a3d" },
  { label: "Not interested", value: 358, color: "#f6bf9c" },
  { label: "No answer", value: 512, color: "#c9d3e3" },
  { label: "Transferred", value: 235, color: "#8fa1b5" },
];

export const conversationSources: DonutSlice[] = [
  { label: "Bulk campaigns", value: 1942, color: "#185adb" },
  { label: "Instant leads", value: 1264, color: "#4f86e8" },
  { label: "Inbound calls", value: 1108, color: "#0d2a6b" },
  { label: "Google Sheets", value: 312, color: "#ff8a3d" },
  { label: "Meta lead ads", value: 186, color: "#c9d3e3" },
];

export type DashboardAgent = {
  id: string;
  name: string;
  purpose: string;
  initials: string;
  tone: string;
  status: "Active" | "Paused" | "Draft";
  languages: string;
  voice: string;
  model: string;
  calls: number;
  successRate: number;
  lastActive: string;
};

export const dashboardAgents: DashboardAgent[] = [
  {
    id: "aarav",
    name: "Aarav",
    purpose: "Renewals",
    initials: "AR",
    tone: "bg-cobalt-tint text-cobalt-deep",
    status: "Active",
    languages: "Hindi, English",
    voice: "Anushka",
    model: "Sarvam-M 24B",
    calls: 1284,
    successRate: 74,
    lastActive: "3 min ago",
  },
  {
    id: "meera",
    name: "Meera",
    purpose: "Inbound support",
    initials: "MR",
    tone: "bg-mist text-ink-soft",
    status: "Active",
    languages: "Hindi, Marathi, English",
    voice: "Kavya",
    model: "Sarvam-M 24B",
    calls: 2410,
    successRate: 81,
    lastActive: "just now",
  },
  {
    id: "kabir",
    name: "Kabir",
    purpose: "Lead qualification",
    initials: "KB",
    tone: "bg-tangerine-tint text-tangerine-ink",
    status: "Paused",
    languages: "English, Tamil",
    voice: "Arjun",
    model: "Sarvam-M 2B",
    calls: 318,
    successRate: 62,
    lastActive: "2 days ago",
  },
];

export type AttentionItem = {
  id: string;
  title: string;
  detail: string;
  href: string;
  icon: LucideIcon;
  iconClass: string;
};

export const attentionItems: AttentionItem[] = [
  {
    id: "failed-calls",
    title: "12 failed calls on Aarav",
    detail: "Provider errors between 9:10 and 9:40. The retry queue has cleared.",
    href: "/dashboard/conversations",
    icon: PhoneOff,
    iconClass: "bg-tangerine-tint text-tangerine-ink",
  },
  {
    id: "low-credits",
    title: "Credits running low",
    detail: "1,240 credits left, about three days at the current pace.",
    href: "/dashboard/billing",
    icon: CreditCard,
    iconClass: "bg-destructive/10 text-destructive",
  },
  {
    id: "number-verification",
    title: "Number pending verification",
    detail: "+91 80199 52233 cannot place outbound calls until KYC clears.",
    href: "/dashboard/phone-numbers",
    icon: Hash,
    iconClass: "bg-mist text-ink-soft",
  },
  {
    id: "follow-ups",
    title: "9 follow-ups due today",
    detail: "Six of them come from the HDFC renewals campaign.",
    href: "/dashboard/leads",
    icon: CalendarClock,
    iconClass: "bg-cobalt-tint text-cobalt-deep",
  },
];

export const managerInsights = [
  {
    id: "best-hours",
    text: "Aarav books 2.4× more appointments between 10am and 12pm. Move campaign windows earlier.",
  },
  {
    id: "script-change",
    text: "Kabir's qualification rate fell to 62% after the Tamil script change. Re-test the opening line.",
  },
  {
    id: "best-campaign",
    text: "HDFC renewals produced 41 qualified leads at ₹6.10 per lead, the best campaign this month.",
  },
];

export type CallTone = "success" | "secondary" | "warning" | "danger";

export type RecentCall = {
  id: string;
  contact: string;
  phone: string;
  employee: string;
  channel: "Inbound" | "Outbound";
  outcome: string;
  outcomeTone: CallTone;
  sentiment: "Positive" | "Neutral" | "Negative" | "Unknown";
  talkTime: string;
  time: string;
};

export const recentCalls: RecentCall[] = [
  {
    id: "call-1",
    contact: "Rohit Sharma",
    phone: "+91 98204 11822",
    employee: "Meera",
    channel: "Inbound",
    outcome: "Appointment booked",
    outcomeTone: "success",
    sentiment: "Positive",
    talkTime: "4:12",
    time: "2 min ago",
  },
  {
    id: "call-2",
    contact: "Anita Deshmukh",
    phone: "+91 99870 45510",
    employee: "Aarav",
    channel: "Outbound",
    outcome: "Interested",
    outcomeTone: "warning",
    sentiment: "Positive",
    talkTime: "2:38",
    time: "11 min ago",
  },
  {
    id: "call-3",
    contact: "Faizan Qureshi",
    phone: "+91 90042 77361",
    employee: "Kabir",
    channel: "Outbound",
    outcome: "No answer",
    outcomeTone: "secondary",
    sentiment: "Unknown",
    talkTime: "—",
    time: "24 min ago",
  },
  {
    id: "call-4",
    contact: "Lakshmi Iyer",
    phone: "+91 98840 22109",
    employee: "Meera",
    channel: "Inbound",
    outcome: "Lead captured",
    outcomeTone: "success",
    sentiment: "Positive",
    talkTime: "6:04",
    time: "38 min ago",
  },
  {
    id: "call-5",
    contact: "Vikram Singh",
    phone: "+91 98110 60742",
    employee: "Aarav",
    channel: "Outbound",
    outcome: "Not interested",
    outcomeTone: "danger",
    sentiment: "Negative",
    talkTime: "1:21",
    time: "1 hr ago",
  },
  {
    id: "call-6",
    contact: "Sneha Kulkarni",
    phone: "+91 90280 31947",
    employee: "Meera",
    channel: "Inbound",
    outcome: "Successful",
    outcomeTone: "success",
    sentiment: "Neutral",
    talkTime: "3:47",
    time: "1 hr ago",
  },
];

/** The PRD's "Quick actions" — shortcuts to the modules that start work. */
export const quickActions = [
  { id: "new-employee", label: "New employee", href: "/dashboard/employees/new", icon: UserPlus },
  { id: "instant-lead", label: "Instant lead", href: "/dashboard/instant-leads", icon: Zap },
  { id: "campaign", label: "Bulk campaign", href: "/dashboard/campaigns", icon: Megaphone },
  { id: "inbound", label: "Inbound setup", href: "/dashboard/inbound-calls", icon: PhoneIncoming },
  { id: "upload", label: "Upload leads", href: "/dashboard/leads", icon: Upload },
  { id: "conversations", label: "Conversations", href: "/dashboard/conversations", icon: MessageSquare },
  { id: "employees", label: "All employees", href: "/dashboard/employees", icon: Users },
];
