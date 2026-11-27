import type { CaptionSettings } from "./types";

export const DEFAULT_CAPTION_SETTINGS: CaptionSettings = {
  enabled: true,
  fontSize: 24,
  fontFamily: "sans",
  textColor: "#ffffff",
  backgroundColor: "#000000",
  backgroundOpacity: 0.72,
  position: "overlay",
  maxLines: 2,
  spokenLanguage: "multi",
  captionLanguage: "",
};

export const AUTO_LANGUAGE = "multi";

/**
 * Languages Deepgram Nova-3 transcribes, as `[code, name]`. A selection of its monolingual
 * list (developers.deepgram.com/docs/models-languages-overview); "multi" detects any of
 * the 55 multilingual languages and follows speakers who switch mid-sentence.
 */
export const SPOKEN_LANGUAGES: ReadonlyArray<readonly [string, string]> = [
  ["ar", "Arabic"],
  ["bn", "Bengali"],
  ["bg", "Bulgarian"],
  ["ca", "Catalan"],
  ["zh-HK", "Cantonese"],
  ["zh", "Chinese (Simplified)"],
  ["zh-TW", "Chinese (Traditional)"],
  ["hr", "Croatian"],
  ["cs", "Czech"],
  ["da", "Danish"],
  ["nl", "Dutch"],
  ["en", "English"],
  ["et", "Estonian"],
  ["fi", "Finnish"],
  ["fr", "French"],
  ["de", "German"],
  ["el", "Greek"],
  ["gu", "Gujarati"],
  ["he", "Hebrew"],
  ["hi", "Hindi"],
  ["hu", "Hungarian"],
  ["id", "Indonesian"],
  ["it", "Italian"],
  ["ja", "Japanese"],
  ["kn", "Kannada"],
  ["ko", "Korean"],
  ["lv", "Latvian"],
  ["lt", "Lithuanian"],
  ["ms", "Malay"],
  ["ml", "Malayalam"],
  ["mr", "Marathi"],
  ["no", "Norwegian"],
  ["fa", "Persian"],
  ["pl", "Polish"],
  ["pt", "Portuguese"],
  ["pa", "Punjabi"],
  ["ro", "Romanian"],
  ["ru", "Russian"],
  ["sr", "Serbian"],
  ["sk", "Slovak"],
  ["sl", "Slovenian"],
  ["es", "Spanish"],
  ["sw", "Swahili"],
  ["sv", "Swedish"],
  ["tl", "Tagalog"],
  ["ta", "Tamil"],
  ["te", "Telugu"],
  ["th", "Thai"],
  ["tr", "Turkish"],
  ["uk", "Ukrainian"],
  ["ur", "Urdu"],
  ["vi", "Vietnamese"],
];

/** Languages Chrome's on-device translator can produce, as `[code, name]`. */
export const CAPTION_LANGUAGES: ReadonlyArray<readonly [string, string]> = [
  ["ar", "Arabic"],
  ["bn", "Bengali"],
  ["bg", "Bulgarian"],
  ["zh", "Chinese (Simplified)"],
  ["zh-Hant", "Chinese (Traditional)"],
  ["hr", "Croatian"],
  ["cs", "Czech"],
  ["da", "Danish"],
  ["nl", "Dutch"],
  ["en", "English"],
  ["fi", "Finnish"],
  ["fr", "French"],
  ["de", "German"],
  ["el", "Greek"],
  ["he", "Hebrew"],
  ["hi", "Hindi"],
  ["hu", "Hungarian"],
  ["id", "Indonesian"],
  ["it", "Italian"],
  ["ja", "Japanese"],
  ["kn", "Kannada"],
  ["ko", "Korean"],
  ["lt", "Lithuanian"],
  ["mr", "Marathi"],
  ["no", "Norwegian"],
  ["pl", "Polish"],
  ["pt", "Portuguese"],
  ["ro", "Romanian"],
  ["ru", "Russian"],
  ["sk", "Slovak"],
  ["sl", "Slovenian"],
  ["es", "Spanish"],
  ["sv", "Swedish"],
  ["ta", "Tamil"],
  ["te", "Telugu"],
  ["th", "Thai"],
  ["tr", "Turkish"],
  ["uk", "Ukrainian"],
  ["vi", "Vietnamese"],
];

/** English name for a language code we list, else the code itself. */
export function languageName(code: string): string {
  if (code === AUTO_LANGUAGE) return "Auto-detect";
  const hit = SPOKEN_LANGUAGES.find(([c]) => c === code) ?? CAPTION_LANGUAGES.find(([c]) => c === code);
  if (hit) return hit[1];
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export const CAPTION_FONT_SIZES = [16, 20, 24, 30, 38, 48] as const;

export const CAPTION_FONT_STACKS: Record<CaptionSettings["fontFamily"], string> = {
  sans: 'Inter, "Segoe UI", system-ui, -apple-system, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: '"JetBrains Mono", ui-monospace, Menlo, monospace',
};

/** Merge untrusted stored settings with defaults, clamping numeric ranges. */
export function normalizeCaptionSettings(input: unknown): CaptionSettings {
  const s = { ...DEFAULT_CAPTION_SETTINGS, ...(isObject(input) ? input : {}) } as CaptionSettings;
  return {
    enabled: Boolean(s.enabled),
    fontSize: clamp(Number(s.fontSize) || DEFAULT_CAPTION_SETTINGS.fontSize, 12, 72),
    fontFamily: ["sans", "serif", "mono"].includes(s.fontFamily) ? s.fontFamily : "sans",
    textColor: isColor(s.textColor) ? s.textColor : DEFAULT_CAPTION_SETTINGS.textColor,
    backgroundColor: isColor(s.backgroundColor) ? s.backgroundColor : DEFAULT_CAPTION_SETTINGS.backgroundColor,
    backgroundOpacity: clamp(Number(s.backgroundOpacity), 0, 1),
    position: s.position === "below" ? "below" : "overlay",
    maxLines: clamp(Math.round(Number(s.maxLines) || 2), 1, 4),
    spokenLanguage:
      s.spokenLanguage === AUTO_LANGUAGE || SPOKEN_LANGUAGES.some(([c]) => c === s.spokenLanguage) ? s.spokenLanguage : AUTO_LANGUAGE,
    captionLanguage: CAPTION_LANGUAGES.some(([c]) => c === s.captionLanguage) ? s.captionLanguage : "",
  };
}

/** `#rrggbb` + opacity → `rgba(...)`. */
export function withOpacity(hex: string, opacity: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1]!, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${opacity})`;
}

function clamp(n: number, min: number, max: number) {
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
}
function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
function isColor(v: unknown): v is string {
  return typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
}
