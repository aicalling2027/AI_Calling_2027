/**
 * The part of the voice catalogue the provider does not publish.
 *
 * `content/home.ts` holds the catalogue itself - a mirror of the backend's
 * `VOICE_PROFILES`, which is what `/api/voices` returns. Two things are ours to
 * decide and are kept here instead: the rate band a voice is billed at, and the
 * name it goes by in each language it speaks. A Hindi listener hears "शुभ", not
 * "Shubh", and the card has to say the same thing the audio does.
 */

import type { VoiceSample } from "@/content/home";

export type VoiceTier = "premium" | "standard";

/** One language a voice is offered in, as the backend sends it. */
export type VoiceLanguage = VoiceSample["languages"][number];

export type VoicePlan = {
  label: string;
  /** Rupees per connected minute. */
  rate: number;
  /** One line on when this band applies, shown in the hero rate panel. */
  blurb: string;
};

export const VOICE_PLANS: Record<VoiceTier, VoicePlan> = {
  premium: {
    label: "Premium",
    rate: 7,
    blurb: "The featured voices, for the calls that carry the brand.",
  },
  standard: {
    label: "Standard",
    rate: 5,
    blurb: "The rest of the catalogue, at the lower rate.",
  },
};

/** Display order for the mode filter and the hero rate panel. */
export const VOICE_TIER_ORDER: readonly VoiceTier[] = ["premium", "standard"];

/**
 * Voices billed at the Premium rate. Anything not listed is Standard, so a
 * voice added to the catalogue without a commercial decision here is never
 * silently sold at the higher price.
 */
const PREMIUM_VOICES = new Set(["shubh", "tanya", "anand"]);

export const tierOf = (id: string): VoiceTier =>
  PREMIUM_VOICES.has(id) ? "premium" : "standard";

export const planOf = (id: string): VoicePlan => VOICE_PLANS[tierOf(id)];

/**
 * The name each voice goes by in each language it speaks. English is the
 * catalogue name, so only the other languages need an entry; a language with
 * no entry falls back to the English name rather than going blank.
 */
const VOICE_NAMES: Record<string, Record<string, string>> = {
  shubh: { "hi-IN": "शुभ", "ta-IN": "சுப்" },
  tanya: { "hi-IN": "तान्या", "bn-IN": "তানিয়া" },
  anand: { "hi-IN": "आनंद", "te-IN": "ఆనంద్" },
  sunny: { "hi-IN": "सनी", "ml-IN": "സണ്ണി" },
  mani: { "hi-IN": "मणि", "kn-IN": "ಮಣಿ" },
  kabir: { "hi-IN": "कबीर", "gu-IN": "કબીર" },
  priya: { "hi-IN": "प्रिया", "mr-IN": "प्रिया" },
};

export function nameIn(voice: VoiceSample, language: string): string {
  return VOICE_NAMES[voice.id]?.[language] ?? voice.name;
}

/** Language codes written the way their own speakers write them. */
const NATIVE_LANGUAGE: Record<string, string> = {
  "en-IN": "English",
  "hi-IN": "हिन्दी",
  "ta-IN": "தமிழ்",
  "te-IN": "తెలుగు",
  "kn-IN": "ಕನ್ನಡ",
  "ml-IN": "മലയാളം",
  "gu-IN": "ગુજરાતી",
  "bn-IN": "বাংলা",
  "mr-IN": "मराठी",
};

export const nativeName = (code: string): string => NATIVE_LANGUAGE[code] ?? code;

/**
 * Which language a card leads with. With no filter the voice keeps its own
 * preview language; with a filter it leads with the language the visitor came
 * for, which is also the one played and the one the name is written in.
 */
export function languagesOf(
  voice: VoiceSample,
  language: string,
): { primary: VoiceLanguage; also: VoiceLanguage[] } {
  const chosen = voice.languages.some((item) => item.code === language)
    ? language
    : voice.preview_language;
  const primary =
    voice.languages.find((item) => item.code === chosen) ?? voice.languages[0];
  return {
    primary,
    also: voice.languages.filter((item) => item.code !== primary?.code),
  };
}
