/**
 * Shared types for Earshot. Nothing in here knows about YouTube, Chrome, or React —
 * it only describes transcription state so any surface (web app, extension, future
 * providers) can render it.
 */

export type TranscriptionStatus =
  | "idle"
  | "connecting"
  | "live"
  | "paused"
  | "reconnecting"
  | "error";

/** A committed (final) transcript line. Times are seconds. */
export interface TranscriptLine {
  id: string;
  text: string;
  /** Seconds since transcription started, measured in audio actually streamed. */
  start: number;
  end: number;
  /** Position in the media (e.g. video currentTime) when known; null for unseekable sources. */
  mediaStart: number | null;
  mediaEnd: number | null;
  /** Wall-clock ms when the line was committed. */
  createdAt: number;
}

/** What should be on screen as a caption right now. */
export interface CaptionState {
  /** Finalized-but-uncommitted words followed by the current interim hypothesis. */
  text: string;
  /** True when the tail of `text` is still an interim (may change) result. */
  hasInterim: boolean;
  /** Wall-clock ms of the last change; renderers use it to fade stale captions. */
  updatedAt: number;
}

export interface TranscriptState {
  status: TranscriptionStatus;
  error: string | null;
  lines: TranscriptLine[];
  caption: CaptionState;
  /** Wall-clock ms when the current session started, null when never started. */
  startedAt: number | null;
}

/** Incremental events — cheap to send across process boundaries (e.g. extension messaging). */
export type TranscriptEvent =
  | { type: "status"; status: TranscriptionStatus; error?: string | null }
  | { type: "line"; line: TranscriptLine }
  | { type: "caption"; caption: CaptionState }
  | { type: "reset"; startedAt: number | null }
  | { type: "snapshot"; state: TranscriptState };

export type CaptionFont = "sans" | "serif" | "mono";
export type CaptionPosition = "overlay" | "below";

export interface CaptionSettings {
  enabled: boolean;
  /** Font size in CSS px. */
  fontSize: number;
  fontFamily: CaptionFont;
  textColor: string;
  backgroundColor: string;
  /** 0 = no box (text shadow only), 1 = opaque. */
  backgroundOpacity: number;
  /** Web player only: draw over the video or below it. */
  position: CaptionPosition;
  /** Max visible caption lines. */
  maxLines: number;
}

export interface DeepgramStreamOptions {
  model?: string;
  language?: string;
  keyterms?: string[];
}

/**
 * How the browser authenticates the Deepgram WebSocket.
 * - `bearer`: short-lived JWT minted by an Earshot server (server holds the API key).
 * - `token`: the user's own Deepgram API key ("bring your own key"); never sent to Earshot.
 */
export interface DeepgramCredential {
  type: "bearer" | "token";
  value: string;
}
