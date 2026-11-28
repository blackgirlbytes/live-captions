/**
 * Shared types for Heard. Nothing in here knows about YouTube, Chrome, or React —
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
  /** Language Deepgram reported for most of the line's words (auto-detect only). */
  language?: string;
  /**
   * Who said it, when speaker labels are on (`diarize`): `"<connection>:<speaker>"`.
   * Deepgram numbers speakers per connection, so the same person can get a new label after
   * a reconnect. A line never mixes speakers.
   */
  speaker?: string;
}

/** What should be on screen as a caption right now. */
export interface CaptionState {
  /** Finalized-but-uncommitted words followed by the current interim hypothesis. */
  text: string;
  /** True when the tail of `text` is still an interim (may change) result. */
  hasInterim: boolean;
  /** Wall-clock ms of the last change; renderers use it to fade stale captions. */
  updatedAt: number;
  /** Language Deepgram reported for the caption text (auto-detect only). */
  language?: string;
}

/** Why a caption couldn't be translated right now. */
export interface TranslationIssue {
  /** Translator language codes. */
  source: string;
  target: string;
  /**
   * `download`: the language pair needs a one-time download, which only a click can start.
   * `failed`: Chrome has the translator but it errored or stopped answering; `detail` says why.
   */
  kind: "download" | "unsupported" | "no-api" | "failed";
  detail?: string;
}

/** Translated captions, kept beside the original transcript. */
export interface TranslationState {
  /** Caption language, or null when captions stay in the spoken language. */
  target: string | null;
  /** Translated text by transcript line id. */
  lines: Record<string, string>;
  /** Translation of the current caption (may lag the caption by a moment). */
  caption: string | null;
  issue: TranslationIssue | null;
}

export interface TranscriptState {
  status: TranscriptionStatus;
  error: string | null;
  lines: TranscriptLine[];
  caption: CaptionState;
  /** Wall-clock ms when the current session started, null when never started. */
  startedAt: number | null;
  translation: TranslationState;
}

/** Incremental events — cheap to send across process boundaries (e.g. extension messaging). */
export type TranscriptEvent =
  | { type: "status"; status: TranscriptionStatus; error?: string | null }
  | { type: "line"; line: TranscriptLine }
  | { type: "caption"; caption: CaptionState }
  | { type: "reset"; startedAt: number | null }
  | { type: "snapshot"; state: TranscriptState }
  /** Translation target changed (clears earlier translations) or a translation problem changed. */
  | { type: "translation-config"; target: string | null; issue: TranslationIssue | null }
  | { type: "line-translated"; target: string; id: string; text: string }
  | { type: "caption-translated"; target: string; text: string };

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
  /** Deepgram language code for what's spoken, or "multi" to detect it (and follow switches). */
  spokenLanguage: string;
  /** Show captions in this language (Chrome's on-device translator); "" keeps the spoken language. */
  captionLanguage: string;
}

export interface DeepgramStreamOptions {
  model?: string;
  language?: string;
  keyterms?: string[];
  /** Ask Deepgram for speaker labels on each word. */
  diarize?: boolean;
}

/**
 * How the browser authenticates the Deepgram WebSocket.
 * - `bearer`: short-lived JWT minted by a Heard server (server holds the API key).
 * - `token`: the user's own Deepgram API key ("bring your own key"); never sent to Heard.
 */
export interface DeepgramCredential {
  type: "bearer" | "token";
  value: string;
}
