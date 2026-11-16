/**
 * Cloned voices, kept on the device that made them.
 *
 * Creating a usable clone needs a persona on the speech provider. This
 * deployment does not create one yet, and the employee API refuses any voice
 * outside the provider catalogue, so a clone is stored here - its name, the
 * language it was captured in and the take's length - instead of on an
 * employee. The list is what the picker's "My voices" tab reads.
 *
 * Storage is the browser's own, keyed per origin. Nothing is uploaded: the
 * recording is played back from an object URL and then dropped.
 */

export type ClonedVoice = {
  /** Local handle. A provider clone would carry an `svc-…` id instead. */
  id: string;
  name: string;
  /** Language the take was recorded in, as the operator named it. */
  language: string;
  /** Length of the take in milliseconds. */
  durationMs: number;
  /** ISO timestamp of the save. */
  createdAt: string;
  /**
   * "Saved" is the whole truth here: the identity is kept, but no provider
   * persona exists yet, so the clone cannot be assigned or synthesised.
   */
  status: "Saved";
};

const KEY = "aotms.cloned-voices";

/** The starter allowance is 50 clones per workspace; keep the same ceiling. */
const MAX_CLONES = 50;

export function readClones(): ClonedVoice[] {
  try {
    const stored = window.localStorage.getItem(KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is ClonedVoice =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as ClonedVoice).id === "string" &&
        typeof (item as ClonedVoice).name === "string",
    );
  } catch {
    // Private mode or a corrupt value: start with nothing rather than crash.
    return [];
  }
}

export function writeClones(list: ClonedVoice[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_CLONES)));
  } catch {
    // A full quota leaves the list in memory for this session only.
  }
}

/** Id for a clone saved here. Never sent to the backend. */
export const newCloneId = (): string =>
  `clone-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
