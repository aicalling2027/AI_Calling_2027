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
 * Band for a dashboard voice.
 *
 * The commercial list above is written against the marketing ids, which for a
 * stored voice is its speaker slug: an employee row keeps the catalogue UUID,
 * and a UUID carries no rate decision of its own.
 */
export const tierOfVoice = (voice: { id: string; slug: string }): VoiceTier =>
  tierOf(voice.slug || voice.id);

export const planForVoice = (voice: { id: string; slug: string }): VoicePlan =>
  VOICE_PLANS[tierOfVoice(voice)];

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
  // The bundled dashboard voices the provider publishes no profile for. Only
  // transliterations are listed; a language with no entry keeps the English
  // name, because inventing one would misname the speaker.
  kavya: { "hi-IN": "काव्या", "mr-IN": "काव्या" },
  ritu: { "hi-IN": "ऋतु" },
  aditya: { "hi-IN": "आदित्य" },
  simran: { "hi-IN": "सिमरन", "pa-IN": "ਸਿਮਰਨ" },
  rahul: { "hi-IN": "राहुल" },
  neha: { "hi-IN": "नेहा" },
  shreya: { "hi-IN": "श्रेया" },
  // The rest of the speaker set. Hindi is the one language where a
  // transliteration is both wanted and unambiguous, so it is the only entry
  // each of these gets for now.
  ashutosh: { "hi-IN": "आशुतोष" },
  pooja: { "hi-IN": "पूजा" },
  rohan: { "hi-IN": "रोहन" },
  amit: { "hi-IN": "अमित" },
  dev: { "hi-IN": "देव" },
  ishita: { "hi-IN": "इशिता" },
  ratan: { "hi-IN": "रतन" },
  varun: { "hi-IN": "वरुण" },
  manan: { "hi-IN": "मनन" },
  sumit: { "hi-IN": "सुमित" },
  roopa: { "hi-IN": "रूपा" },
  aayan: { "hi-IN": "आयान" },
  advait: { "hi-IN": "अद्वैत" },
  tarun: { "hi-IN": "तरुण" },
  gokul: { "hi-IN": "गोकुल" },
  vijay: { "hi-IN": "विजय" },
  shruti: { "hi-IN": "श्रुति" },
  suhani: { "hi-IN": "सुहानी" },
  mohit: { "hi-IN": "मोहित" },
  kavitha: { "hi-IN": "कविता" },
  rehan: { "hi-IN": "रेहान" },
  soham: { "hi-IN": "सोहम" },
  rupali: { "hi-IN": "रूपाली" },
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
  "pa-IN": "ਪੰਜਾਬੀ",
  "or-IN": "ଓଡ଼ିଆ",
  "as-IN": "অসমীয়া",
  "ur-IN": "اردو",
  "ne-IN": "नेपाली",
  "kok-IN": "कोंकणी",
  "sa-IN": "संस्कृतम्",
  "mai-IN": "मैथिली",
  "sd-IN": "سنڌي",
};

export const nativeName = (code: string): string => NATIVE_LANGUAGE[code] ?? code;

/**
 * Every language a voice can be heard in, in the order the employee form lists
 * them.
 *
 * Mirrors `SPEECH_LANGUAGES` in `Backend/app/core/constants.py`, which is the
 * speech API's own set: transcription accepts more languages than synthesis,
 * and a preview is synthesised. A code that is missing here would be filtered
 * out of the library before it could be requested, and a code that does not
 * exist there would fail at the provider.
 */
export const VOICE_LANGUAGES: readonly VoiceLanguage[] = [
  { code: "hi-IN", label: "Hindi" },
  { code: "en-IN", label: "English (India)" },
  { code: "mr-IN", label: "Marathi" },
  { code: "ta-IN", label: "Tamil" },
  { code: "te-IN", label: "Telugu" },
  { code: "kn-IN", label: "Kannada" },
  { code: "ml-IN", label: "Malayalam" },
  { code: "gu-IN", label: "Gujarati" },
  { code: "bn-IN", label: "Bengali" },
  { code: "pa-IN", label: "Punjabi" },
  { code: "or-IN", label: "Odia" },
];

/** The display string the bundle uses for a voice that speaks all of them. */
export const ALL_LANGUAGES_LABEL = "All supported languages";

/** How many languages one voice can be heard in. */
export const VOICE_LANGUAGE_COUNT = VOICE_LANGUAGES.length;

const CODE_BY_LABEL = new Map(VOICE_LANGUAGES.map((entry) => [entry.label, entry.code]));
// The employee form writes "English" where the provider writes "English (India)".
CODE_BY_LABEL.set("English", "en-IN");

/** The code behind a language name, for a language stored as display text. */
export const languageCodeOf = (label: string): string | undefined =>
  CODE_BY_LABEL.get(label.trim());

/**
 * The languages a dashboard voice offers.
 *
 * A voice the provider publishes a profile for carries its own language list,
 * so this only has to read the bundle's display string: labels are mapped back
 * to codes, and a voice that speaks every language is expanded rather than left
 * unreadable. An unknown label is dropped instead of guessed at.
 */
export function languagesForVoice(voice: { language: string }): VoiceLanguage[] {
  if (voice.language === ALL_LANGUAGES_LABEL) return [...VOICE_LANGUAGES];

  return voice.language
    .split(",")
    .map((label) => label.trim())
    .flatMap((label) => {
      const code = CODE_BY_LABEL.get(label);
      return code ? [{ code, label: label === "English" ? "English (India)" : label }] : [];
    });
}

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

/**
 * The name a speaker goes by in one language, keyed by the slug an employee
 * stores.
 *
 * The card prints this, so a card labelled "spoken in हिन्दी" cannot lead with
 * the English name while the audio says something else.
 */
export function nameOfSlug(
  slug: string,
  fallback: string,
  language: string,
): string {
  return VOICE_NAMES[slug]?.[language] ?? fallback;
}
