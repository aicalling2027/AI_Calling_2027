/**
 * The part of the voice catalogue the provider does not publish.
 *
 * `content/voices.ts` holds the catalogue itself - a mirror of the backend's
 * `VOICE_PROFILES`, which is what `/api/voices` returns. Two things are ours to
 * decide and are kept here instead: the rate band a voice is billed at, and the
 * words the site uses for the two models behind the codes. A card prints its
 * code (`PM-01`, `SD-07`), never the speaker's own name; the name survives only
 * as a search alias, so a customer who knows a voice by name still finds it.
 */

import { PREMIUM_VOICE_IDS, type VoiceSample } from "@/content/voices";

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
    blurb: "Every base speaker, for the calls that carry the brand.",
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
 * Voices billed at the Premium rate. The list comes from the catalogue module
 * because the codes are derived from it too, so a card cannot print a band its
 * code contradicts. Anything not listed is Standard, so a voice added without
 * a commercial decision here is never silently sold at the higher price.
 */
const PREMIUM_VOICES = new Set(PREMIUM_VOICE_IDS);

/**
 * The band a catalogue code names: `PM-07` is Premium, anything else Standard.
 *
 * This is the backend's own rule, so a row whose payload carries a code is
 * priced by what it prints. A voice added to the premium band on the server
 * arrives as Premium here without a second decision on this side.
 */
export const tierOfCode = (code: string): VoiceTier =>
  code.startsWith("PM-") ? "premium" : "standard";

export const tierOf = (id: string): VoiceTier =>
  PREMIUM_VOICES.has(id) ? "premium" : "standard";

/**
 * Band for a catalogue row, read from its code when one is present.
 *
 * The seed list above still answers for a payload from an older backend, or
 * for an id that arrives without a catalogue entry.
 */
export const tierOfSample = (voice: { id: string; code?: string }): VoiceTier =>
  voice.code ? tierOfCode(voice.code) : tierOf(voice.id);

/**
 * The models a voice can belong to, in the order the filter lists them.
 *
 * Separate models, not tiers of one: their speaker ids are not interchangeable,
 * and a speaker sent to the other model comes back as an error instead of
 * audio. The catalogue says which one a card is, so two voices that differ only
 * by model are visibly different.
 */
export const VOICE_MODELS: readonly string[] = ["AOTMS-V 3B", "AOTMS-V 10B"];

/** The model a voice belongs to, or an empty string when it names none. */
export const familyOf = (voice: { model?: string }): string => voice.model ?? "";

/**
 * The label a card prints for a voice: its catalogue code.
 *
 * The code names the band and the edition at once. The fallback is the speaker
 * name, which only a payload from an older backend can reach.
 */
export const codeOf = (voice: { code?: string; name: string }): string =>
  voice.code ?? voice.name;

/**
 * The edition part of a code, for avatars: `PM-07` -> `07`.
 *
 * Two letters would look the same on every card, so the avatar carries the part
 * that tells one voice from the next.
 */
export const editionOf = (voice: { code?: string; name: string }): string =>
  codeOf(voice).split("-")[1] ?? codeOf(voice).slice(0, 1);

export const planOf = (id: string): VoicePlan => VOICE_PLANS[tierOf(id)];

export const planOfSample = (voice: { id: string; code?: string }): VoicePlan =>
  VOICE_PLANS[tierOfSample(voice)];

/**
 * Band for a dashboard voice.
 *
 * The commercial list above is written against the marketing ids, which for a
 * stored voice is its speaker slug: an employee row keeps the catalogue UUID,
 * and a UUID carries no rate decision of its own. A row that already carries
 * a code follows the code, so the band and the printed edition never disagree.
 */
export const tierOfVoice = (voice: {
  id: string;
  slug: string;
  code?: string;
}): VoiceTier =>
  voice.code ? tierOfCode(voice.code) : tierOf(voice.slug || voice.id);

export const planForVoice = (voice: { id: string; slug: string; code?: string }): VoicePlan =>
  VOICE_PLANS[tierOfVoice(voice)];

/**
 * The name each voice goes by in each language it speaks.
 *
 * Cards print codes, not names, so these are search aliases: they let a
 * customer who knows a voice as "शुभ" find PM-01. English is the catalogue name,
 * so only the other languages need an entry; a language with no entry falls
 * back to the English name rather than going blank.
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
  return (
    VOICE_NAMES[slug]?.[language] ??
    VOICE_NAMES[slug.split("_")[0]]?.[language] ??
    fallback
  );
}
