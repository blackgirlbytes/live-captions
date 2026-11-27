import { DEFAULT_CAPTION_SETTINGS, normalizeCaptionSettings, type CaptionSettings } from "@heard/shared";

import { migrateLegacyStorage } from "@/lib/legacy-storage";

/** Only caption appearance is persisted — never transcripts. */
const KEY = "heard:caption-settings:v1";

export function loadCaptionSettings(): CaptionSettings {
  migrateLegacyStorage();
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
