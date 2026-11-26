import { DEFAULT_CAPTION_SETTINGS, normalizeCaptionSettings, type CaptionSettings } from "@earshot/shared";

/** Only caption appearance is persisted — never transcripts. */
const KEY = "earshot:caption-settings:v1";

export function loadCaptionSettings(): CaptionSettings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? normalizeCaptionSettings(JSON.parse(raw)) : { ...DEFAULT_CAPTION_SETTINGS };
  } catch {
    return { ...DEFAULT_CAPTION_SETTINGS };
  }
}

export function saveCaptionSettings(settings: CaptionSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* storage unavailable (private mode) — settings just won't persist */
  }
}
