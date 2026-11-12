import {
  CalendarDays,
  Infinity as InfinityMark,
  MessageCircle,
  Send,
  Sheet,
  Webhook,
  Workflow,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The tools the platform exchanges data with.
 *
 * The glyphs are lucide icons tinted with a darkened version of each product's
 * brand colour rather than the wordmarks themselves: the real marks are
 * trademarked, and at 16–20px a full logo is illegible anyway. The colour plus
 * the name below it is what makes each row recognisable.
 */
export type ToolMark = {
  id: string;
  name: string;
  icon: LucideIcon;
  /** Tinted tile behind the glyph. */
  tile: string;
  /** Glyph colour, kept at 3:1 or better on white. */
  glyph: string;
};

export const toolMarks: ToolMark[] = [
  {
    id: "whatsapp",
    name: "WhatsApp",
    icon: MessageCircle,
    tile: "bg-[#128c4a]/10",
    glyph: "text-[#128c4a]",
  },
  {
    id: "n8n",
    name: "n8n",
    icon: Workflow,
    tile: "bg-[#c9355b]/10",
    glyph: "text-[#c9355b]",
  },
  {
    id: "meta",
    name: "Meta",
    icon: InfinityMark,
    tile: "bg-[#0866ff]/10",
    glyph: "text-[#0866ff]",
  },
  {
    id: "google-sheets",
    name: "Google Sheets",
    icon: Sheet,
    tile: "bg-[#0b8043]/10",
    glyph: "text-[#0b8043]",
  },
  {
    id: "google-calendar",
    name: "Google Calendar",
    icon: CalendarDays,
    tile: "bg-[#1a73e8]/10",
    glyph: "text-[#1a73e8]",
  },
  {
    id: "aisensy",
    name: "AiSensy",
    icon: Send,
    tile: "bg-[#0b8a62]/10",
    glyph: "text-[#0b8a62]",
  },
  {
    id: "custom-api",
    name: "Custom API",
    icon: Webhook,
    tile: "bg-cobalt/10",
    glyph: "text-cobalt",
  },
];

/** A tinted square holding one tool's glyph; it fills whatever box it is given. */
export function ToolGlyph({
  tool,
  className,
}: {
  tool: ToolMark;
  className?: string;
}) {
  const Icon = tool.icon;

  return (
    <span
      className={cn(
        "grid size-full place-items-center rounded-[inherit]",
        tool.tile,
        tool.glyph,
        className,
      )}
    >
      <Icon aria-hidden className="size-[52%]" />
    </span>
  );
}
