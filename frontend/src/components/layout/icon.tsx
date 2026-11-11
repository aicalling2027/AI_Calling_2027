import {
  ArrowRight,
  BarChart3,
  Building2,
  Car,
  Clock,
  Globe,
  GraduationCap,
  Headphones,
  HeartPulse,
  Home,
  Languages,
  Layers,
  MapPin,
  Megaphone,
  MessageSquare,
  PhoneCall,
  PhoneIncoming,
  Plane,
  Plug,
  Shield,
  ShoppingBag,
  Sparkles,
  Users,
  Wallet,
  Workflow,
  Zap,
} from "lucide-react";

import { cn } from "@/lib/utils";

type IconComponent = React.ComponentType<{ className?: string }>;

/**
 * Curated icon set. Content files reference icons by name instead of
 * importing components, which keeps them pure data.
 */
const registry = {
  "arrow-right": ArrowRight,
  "bar-chart": BarChart3,
  building: Building2,
  car: Car,
  clock: Clock,
  globe: Globe,
  education: GraduationCap,
  headphones: Headphones,
  health: HeartPulse,
  home: Home,
  languages: Languages,
  layers: Layers,
  "map-pin": MapPin,
  megaphone: Megaphone,
  message: MessageSquare,
  "phone-call": PhoneCall,
  "phone-incoming": PhoneIncoming,
  plane: Plane,
  plug: Plug,
  shield: Shield,
  commerce: ShoppingBag,
  sparkles: Sparkles,
  users: Users,
  wallet: Wallet,
  workflow: Workflow,
  zap: Zap,
} satisfies Record<string, IconComponent>;

export type IconName = keyof typeof registry;

/** 48px rounded squares: blue-tint with blue glyphs, or coral for the one
 *  highlighted icon in a section. */
const tones = {
  blue: "icon-tile icon-tile-blue",
  coral: "icon-tile icon-tile-accent",
  plain: "icon-tile icon-tile-quiet",
} as const;

type IconBadgeProps = {
  name: IconName;
  tone?: keyof typeof tones;
  className?: string;
};

export function IconBadge({ name, tone = "blue", className }: IconBadgeProps) {
  const Icon = registry[name];

  return (
    <span className={cn(tones[tone], className)}>
      <Icon className="size-5" />
    </span>
  );
}
