import type { TranscriptionStatus } from "../core/types";
import type { DubStatus } from "../core/dubbing/types";

/**
 * UI words for the shared React components. Every component takes an optional `labels` prop
 * (partial is fine) and falls back to these English defaults, so callers that don't translate
 * (the Chrome extension) keep today's text.
 */

export interface StatusBadgeLabels {
  status: Record<TranscriptionStatus, string>;
  /** Screen-reader label, e.g. "Transcription live". */
  aria: (label: string) => string;
}

export const DEFAULT_STATUS_BADGE_LABELS: StatusBadgeLabels = {
  status: {
    idle: "Off",
    connecting: "Connecting",
    live: "Live",
    paused: "Paused",
    reconnecting: "Reconnecting",
    error: "Error",
  },
  aria: (label) => `Transcription ${label.toLowerCase()}`,
};

export interface TranscriptViewLabels {
  region: string;
  empty: string;
  noMatches: (query: string) => string;
  jumpTo: (timestamp: string) => string;
  jumpToLive: string;
  jumpToLatest: string;
}

export const DEFAULT_TRANSCRIPT_VIEW_LABELS: TranscriptViewLabels = {
  region: "Transcript",
  empty: "The transcript will appear here.",
  noMatches: (q) => `No matches for “${q}”`,
  jumpTo: (ts) => `Jump to ${ts}`,
  jumpToLive: "Jump to live",
  jumpToLatest: "Jump to latest",
};

export interface TranscriptToolbarLabels {
  search: string;
  clearSearch: string;
  copy: string;
  download: string;
  formats: { txt: [string, string]; srt: [string, string]; vtt: [string, string] };
}

export const DEFAULT_TRANSCRIPT_TOOLBAR_LABELS: TranscriptToolbarLabels = {
  search: "Search transcript",
  clearSearch: "Clear search",
  copy: "Copy transcript",
  download: "Download transcript",
  formats: {
    txt: ["Text", "Timestamped .txt"],
    srt: ["SubRip", ".srt subtitles"],
    vtt: ["WebVTT", ".vtt subtitles"],
  },
};

export interface LanguageSettingsLabels {
  legend: string;
  spoken: string;
  detect: string;
  showIn: string;
  sameAsSpoken: string;
  /** Under the caption language while it follows live dubbing (language is a name, e.g. "Spanish"). */
  followsDubbing: (language: string) => string;
  /** Joins two language names, e.g. "English to Spanish". */
  pair: (from: string, to: string) => string;
  ready: (pair: string) => string;
  needsDownload: (pair: string) => string;
  downloadNow: string;
  downloading: (pair: string, percent: number) => string;
  unsupported: (pair: string) => string;
  noApi: string;
  auto: (target: string) => string;
  /** Display name for a language code; defaults to the English names. */
  languageName?: (code: string) => string;
  // TranslationNotice
  noticeNoApi: string;
  noticeUnsupported: (pair: string, source: string) => string;
  noticeNeedsDownload: (pair: string) => string;
  noticeDownload: string;
  /** Chrome's translator errored; `detail` is Chrome's own message. Captions stay as spoken. */
  noticeFailed: (pair: string, detail: string) => string;
}

export const DEFAULT_LANGUAGE_SETTINGS_LABELS: LanguageSettingsLabels = {
  legend: "Language",
  spoken: "Spoken in the video",
  detect: "Detect automatically",
  showIn: "Show captions in",
  sameAsSpoken: "The spoken language",
  followsDubbing: (l) => `Captions and transcript follow live dubbing (${l}) while it's on. Pick another language here to change that.`,
  pair: (from, to) => `${from} to ${to}`,
  ready: (pair) => `Translating ${pair} on this device. Text never leaves your browser.`,
  needsDownload: (pair) => `Translating ${pair} needs a one-time download in Chrome.`,
  downloadNow: "Download now",
  downloading: (pair, pct) => `Downloading ${pair}… ${pct}%`,
  unsupported: (pair) => `Chrome can’t translate ${pair} yet. Captions stay in the spoken language.`,
  noApi:
    "Translation uses Chrome’s built-in translator, which this browser doesn’t have. Use Chrome on a computer, or keep captions in the spoken language.",
  auto: (target) =>
    `Captions are translated to ${target} on this device. If a language needs a download first, you’ll be asked. Pick the spoken language to get it ready now.`,
  noticeNoApi: "Captions can’t be translated in this browser. Chrome on a computer has a built-in translator.",
  noticeUnsupported: (pair, source) => `Chrome can’t translate ${pair}, so those captions stay in ${source}.`,
  noticeNeedsDownload: (pair) => `Translating ${pair} needs a one-time download.`,
  noticeDownload: "Download",
  noticeFailed: (pair, detail) => `Translating ${pair} stopped working, so captions stay as spoken. Chrome said: ${detail}`,
};

export interface CaptionSettingsLabels {
  showCaptions: string;
  textSize: string;
  sizes: [string, string, string, string, string, string];
  background: string;
  backgrounds: { solid: string; translucent: string; none: string };
  opacity: string;
  text: string;
  textColor: (color: string) => string;
  fonts: { sans: string; serif: string; mono: string };
  lines: string;
  placement: string;
  overVideo: string;
  belowVideo: string;
  reset: string;
  language?: Partial<LanguageSettingsLabels>;
}

export const DEFAULT_CAPTION_SETTINGS_LABELS: CaptionSettingsLabels = {
  showCaptions: "Show captions",
  textSize: "Text size",
  sizes: ["XS", "S", "M", "L", "XL", "2XL"],
  background: "Background",
  backgrounds: { solid: "Solid", translucent: "Translucent", none: "None" },
  opacity: "Opacity",
  text: "Text",
  textColor: (c) => `Text color ${c}`,
  fonts: { sans: "Sans", serif: "Serif", mono: "Mono" },
  lines: "Lines",
  placement: "Placement",
  overVideo: "Over video",
  belowVideo: "Below video",
  reset: "Reset to defaults",
};

export interface DubbingLabels {
  title: string;
  status: Record<DubStatus, string>;
  needsSession: string;
  /** Seconds the dub trails the original speech. */
  delay: (seconds: number) => string;
  language: string;
  /** Opens the dubbing settings. */
  settingsButton: string;
  /** Short reminder shown next to the language before dubbing is on. */
  extraCost: string;
  /** Heading of the accent choice (only for languages with several accents). */
  accent: string;
  /** Name of an accent's region ("BR" → "Brazil"); English names when unset. */
  regionName?: (code: string) => string;
  /** How voices are chosen. */
  voicesNote: string;
  costNote: string;
  unavailable: string;
  failed: (error: string) => string;
  /** Chrome couldn't translate a phrase (pair is e.g. "English to Spanish"). */
  translateIssue: (pair: string) => string;
}

export const DEFAULT_DUBBING_LABELS: DubbingLabels = {
  title: "Live dubbing",
  status: {
    off: "Off",
    connecting: "Connecting",
    listening: "Listening",
    translating: "Translating",
    playing: "Playing dubbed audio",
    reconnecting: "Reconnecting",
    unavailable: "Dubbing unavailable",
  },
  needsSession: "Start captions to use dubbing",
  delay: (s) => `${s.toFixed(1)} s behind`,
  language: "Hear it in",
  settingsButton: "Dubbing settings",
  extraCost: "extra Deepgram usage",
  accent: "Accent",
  voicesNote: "Each speaker gets their own voice, lower or higher to match how they sound.",
  costNote:
    "Dubbing sends the translated text to Deepgram for text-to-speech, which is billed separately from captions. Nothing is recorded.",
  unavailable: "Live dubbing isn’t available here.",
  failed: (e) => `Dubbing stopped and the original audio is back. ${e}`,
  translateIssue: (pair) => `Chrome can’t translate ${pair} on this device yet, so those phrases aren’t dubbed. Turn dubbing off and on again to download the language.`,
};

/** All shared-component labels in one object, handy for an app's message files. */
export interface SharedUiLabels {
  status: StatusBadgeLabels;
  transcript: TranscriptViewLabels;
  toolbar: TranscriptToolbarLabels;
  settings: CaptionSettingsLabels;
  language: LanguageSettingsLabels;
  dubbing: DubbingLabels;
}
