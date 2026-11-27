import type { TranscriptionStatus } from "../core/types";

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
}

export const DEFAULT_LANGUAGE_SETTINGS_LABELS: LanguageSettingsLabels = {
  legend: "Language",
  spoken: "Spoken in the video",
  detect: "Detect automatically",
  showIn: "Show captions in",
  sameAsSpoken: "The spoken language",
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

/** All shared-component labels in one object, handy for an app's message files. */
export interface SharedUiLabels {
  status: StatusBadgeLabels;
  transcript: TranscriptViewLabels;
  toolbar: TranscriptToolbarLabels;
  settings: CaptionSettingsLabels;
  language: LanguageSettingsLabels;
}
