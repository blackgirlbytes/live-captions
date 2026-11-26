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
};

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
