/**
 * - `off`: dubbing is disabled.
 * - `connecting`: opening the Flux TTS socket.
 * - `listening`: ready, waiting for the next finished phrase.
 * - `translating`: a phrase is being translated.
 * - `playing`: dubbed speech is coming out of the speakers.
 * - `reconnecting`: the TTS socket dropped; retrying.
 * - `unavailable`: dubbing can't run (bad key, repeated failures, unsupported capture);
 *   original audio is restored and `error` says why.
 */
export type DubStatus = "off" | "connecting" | "listening" | "translating" | "playing" | "reconnecting" | "unavailable";

export interface DubState {
  status: DubStatus;
  /** Why dubbing is unavailable or reconnecting (English, from the shared code). */
  error: string | null;
  /**
   * How far the dubbed speech trails the original, in ms: from the moment a phrase was
   * finalized by speech-to-text to the moment its dubbed audio started playing. Null until measured.
   */
  delayMs: number | null;
  /** Phrases skipped to stay close to live (since dubbing was enabled). */
  skipped: number;
}

export const INITIAL_DUB_STATE: DubState = { status: "off", error: null, delayMs: null, skipped: 0 };

/** A finished, translated phrase on its way to speech synthesis. */
export interface DubSegment {
  /** Increasing per pipeline; used to keep order and drop duplicates. */
  seq: number;
  text: string;
  /** Wall-clock ms when the original words were finalized (the delay measurement's start). */
  spokenAt: number;
  /** Who said it (a transcript line's `speaker`), when speaker labels are on. */
  speaker?: string;
}
