/**
 * The voice catalogue the site ships with.
 *
 * Mirrors `VOICE_PROFILES` in `Backend/app/core/constants.py`, which is what
 * `/api/voices` returns. Only `/voices` and the dashboard's voice picker read
 * it: they paint from it before that endpoint answers, and keep painting from
 * it if the endpoint is unreachable.
 *
 * Nothing here belongs to the landing page, which lists no voices at all.
 */

/** One entry of `GET /api/v1/voices` - the voice catalogue. */
export type VoiceSample = {
  id: string;
  /**
   * What the catalogue prints in place of a name: `PM-01`, `SD-07`. The band
   * and the edition are both readable from it. Optional so a payload from an
   * older backend still renders - the name is the fallback.
   */
  code?: string;
  /** The speaker's own name. Search finds a voice by it; cards never show it. */
  name: string;
  /** `unspecified` where the provider does not label the speaker. */
  gender: "female" | "male" | "unspecified";
  personality: string;
  use_case: string;
  languages: { code: string; label: string }[];
  preview_language: string;
  /** The exact line the preview endpoint synthesises. */
  sample_text: string;
  featured: boolean;
  /**
   * The public name of the model the voice is synthesised with (`AOTMS-V 3B`).
   * Speaker ids are not portable between the two models, so the card names the
   * one it belongs to.
   */
  model: string;
};

/**
 * The languages a voice can be heard in - the speech API's synthesis set, not
 * its wider transcription set. Mirrors `SPEECH_LANGUAGES` in the backend.
 */
const SPEECH_LANGUAGES: VoiceSample["languages"] = [
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

/**
 * The line every preview speaks, per language.
 *
 * Mirrors `PREVIEW_LINES` in `Backend/app/core/constants.py`: one short clause,
 * written in its own script because the speech API reads the text as written.
 * The catalogue payload only carries the default line, so `/voices` reads its
 * own copy to show what the sample will actually say in the chosen language.
 */
export const PREVIEW_LINES: Record<string, string> = {
  "en-IN": "Hi, this is how I speak.",
  "hi-IN": "नमस्ते, यह मेरी आवाज़ है।",
  "bn-IN": "নমস্কার, এটি আমার কণ্ঠ।",
  "ta-IN": "வணக்கம், இது என் குரல்.",
  "te-IN": "హాయ్, ఇది నా గొంతు.",
  "gu-IN": "નમસ્તે, આ મારો અવાજ છે.",
  "kn-IN": "ನಮಸ್ಕಾರ, ಇದು ನನ್ನ ಧ್ವನಿ.",
  "ml-IN": "ഹായ്, ഇത് എന്റെ ശബ്ദമാണ്.",
  "mr-IN": "नमस्कार, हा माझा आवाज आहे.",
  "pa-IN": "ਸਤ ਸ੍ਰੀ ਅਕਾਲ, ਇਹ ਮੇਰੀ ਆਵਾਜ਼ ਹੈ।",
  "or-IN": "ନମସ୍କାର, ଏହା ମୋର ସ୍ୱର।",
};

/** The language a sample leads with when the visitor names none. */
const PREVIEW_LANGUAGE = "en-IN";

/** The line the catalogue carries as `sample_text`, in the default language. */
const PREVIEW_LINE = PREVIEW_LINES[PREVIEW_LANGUAGE];

/** id, name, gender, personality, use case, featured. */
type VoiceSeed = readonly [
  id: string,
  name: string,
  gender: VoiceSample["gender"],
  personality: string,
  useCase: string,
  featured: boolean,
];

/**
 * The same catalogue the backend publishes, as a seed table.
 *
 * The shape is uniform by design: every speaker renders every language the
 * speech API synthesises, and every preview is the same one short line. Only
 * personality and use case differ between voices, and both stay empty where
 * the provider says nothing - inventing a role for a speaker would be a claim
 * the product cannot support.
 */
const VOICE_SEEDS: readonly VoiceSeed[] = [
  ["shubh", "Shubh", "male", "Confident & bold", "Sales", true],
  ["tanya", "Tanya", "female", "Friendly & modern", "Support", true],
  ["anand", "Anand", "male", "Warm & reassuring", "Reminders", true],
  ["aditya", "Aditya", "male", "Professional & clear", "", false],
  ["ritu", "Ritu", "female", "Calm & professional", "", false],
  ["ashutosh", "Ashutosh", "unspecified", "", "", false],
  ["priya", "Priya", "female", "Clear & precise", "Surveys", false],
  ["neha", "Neha", "female", "Warm & conversational", "", false],
  ["rahul", "Rahul", "male", "Professional & relaxed", "", false],
  ["pooja", "Pooja", "female", "Warm & friendly", "", false],
  ["rohan", "Rohan", "unspecified", "", "", false],
  ["simran", "Simran", "female", "Bright & clear", "", false],
  ["kavya", "Kavya", "female", "Calm & professional", "", false],
  ["amit", "Amit", "unspecified", "", "", false],
  ["dev", "Dev", "unspecified", "", "", false],
  ["ishita", "Ishita", "unspecified", "", "", false],
  ["shreya", "Shreya", "female", "Calm & narrative", "", false],
  ["ratan", "Ratan", "unspecified", "", "", false],
  ["varun", "Varun", "unspecified", "", "", false],
  ["manan", "Manan", "unspecified", "", "", false],
  ["sumit", "Sumit", "unspecified", "", "", false],
  ["roopa", "Roopa", "unspecified", "", "", false],
  ["kabir", "Kabir", "male", "Steady & trustworthy", "Renewals", false],
  ["aayan", "Aayan", "unspecified", "", "", false],
  ["advait", "Advait", "unspecified", "", "", false],
  ["tarun", "Tarun", "unspecified", "", "", false],
  ["sunny", "Sunny", "male", "Cheerful & upbeat", "Marketing", false],
  ["mani", "Mani", "male", "Calm & composed", "Collections", false],
  ["gokul", "Gokul", "male", "Mature & narrative", "", false],
  ["vijay", "Vijay", "male", "Mature & authoritative", "", false],
  ["shruti", "Shruti", "unspecified", "", "", false],
  ["suhani", "Suhani", "female", "Young & energetic", "", false],
  ["mohit", "Mohit", "unspecified", "", "", false],
  ["kavitha", "Kavitha", "unspecified", "", "", false],
  ["rehan", "Rehan", "unspecified", "", "", false],
  ["soham", "Soham", "unspecified", "", "", false],
  ["rupali", "Rupali", "unspecified", "", "", false],
];

/**
 * The voices sold on the premium rate: every seed above, which is the set of
 * base speakers the backend also prices and numbers `PM-01..37`. Personas only
 * arrive with the live catalogue and are standard.
 *
 * The band is normally read from the code a payload carries
 * (`tierOfCode` in `content/voice-catalogue.ts`), so this list is the fallback
 * for an id that arrives without one. It still has to stay equal to
 * `_PREMIUM_SPEAKERS` in `Backend/app/core/constants.py`: the bundled codes are
 * stamped from it, and a voice premium in one place and standard in the other
 * would show a band its own code contradicts.
 */
export const PREMIUM_VOICE_IDS: readonly string[] = VOICE_SEEDS.map(([id]) => id);

/**
 * Stamp the bundled catalogue with the codes the backend assigns.
 *
 * Premium voices number `PM-01..` in catalogue order and every other voice
 * `SD-01..`. `VOICE_SEEDS` is written in the backend's order, so the same rule
 * reproduces the live codes exactly - `/voices` reads the same codes before
 * `/api/voices` answers and while it is unreachable.
 */
function withCodes<T extends { id: string }>(
  rows: T[],
): (T & { code: string })[] {
  const premium = new Set(PREMIUM_VOICE_IDS);
  const taken = { PM: 0, SD: 0 };
  return rows.map((row) => {
    const series = premium.has(row.id) ? "PM" : "SD";
    taken[series] += 1;
    return { ...row, code: `${series}-${String(taken[series]).padStart(2, "0")}` };
  });
}

/**
 * The bundled catalogue, read by `/voices` and the dashboard's voice picker.
 *
 * Mirrors `VOICE_PROFILES` in Backend/app/core/constants.py so the catalogue
 * renders with real content before /api/voices answers - and stays intact if
 * the API is unreachable.
 */
export const voices = {
  catalog: withCodes(
    VOICE_SEEDS.map(([id, name, gender, personality, use_case, featured]) => ({
      id,
      name,
      gender,
      personality,
      use_case,
      languages: SPEECH_LANGUAGES,
      preview_language: PREVIEW_LANGUAGE,
      sample_text: PREVIEW_LINE,
      featured,
      // Every base speaker is synthesised by the stable model; the personas
      // only arrive with the live catalogue.
      model: "AOTMS-V 3B",
    })),
  ) satisfies VoiceSample[],
};
