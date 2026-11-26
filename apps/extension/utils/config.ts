import { browser } from "wxt/browser";
import { normalizeCaptionSettings, type CaptionSettings } from "@earshot/shared";

/** Build-time default (`WXT_EARSHOT_URL=https://earshot.example npx wxt build`). */
export const DEFAULT_EARSHOT_URL: string = (
  (import.meta.env.WXT_EARSHOT_URL as string | undefined) || "http://localhost:3100"
).replace(/\/+$/, "");

/** chrome.storage.local keys. Transcripts are never stored. */
export const STORAGE_KEYS = {
  serverUrl: "serverUrl",
  captionSettings: "captionSettings",
  overlayLayout: "overlayLayout",
} as const;

/** Caption box placement, as fractions of the viewport so it survives resizes / fullscreen. */
export interface OverlayLayout {
  /** Left edge, 0..1 of viewport width. */
  x: number;
  /** Top edge, 0..1 of viewport height. */
  y: number;
  /** Box width in CSS px. */
  width: number;
}

/** Normalize a user-entered server URL; returns null when it's not an http(s) origin. */
export function normalizeServerUrl(input: string): string | null {
  try {
    const url = new URL(input.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin + url.pathname.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

export async function getServerUrl(): Promise<string> {
  const stored = (await browser.storage.local.get(STORAGE_KEYS.serverUrl))[STORAGE_KEYS.serverUrl];
  return (typeof stored === "string" && normalizeServerUrl(stored)) || DEFAULT_EARSHOT_URL;
}

export function tokenEndpoint(serverUrl: string): string {
  return `${serverUrl}/api/deepgram/token`;
}

export async function getCaptionSettings(): Promise<CaptionSettings> {
  const stored = (await browser.storage.local.get(STORAGE_KEYS.captionSettings))[STORAGE_KEYS.captionSettings];
  return { ...normalizeCaptionSettings(stored), position: "overlay" };
}

/**
 * Pages Chrome never lets extensions capture or script. `url` is only known when we have
 * activeTab for the tab (popup) — undefined means "can't tell", so we let Chrome decide.
 */
export function restrictedReason(url: string | undefined): string | null {
  if (!url) return null;
  if (/^(chrome|edge|brave|about|devtools|view-source|chrome-extension|chrome-search|chrome-untrusted):/i.test(url)) {
    return "Chrome doesn't allow extensions to capture its own pages. Open a site with video or audio.";
  }
  if (/^https:\/\/(chromewebstore\.google\.com|chrome\.google\.com\/webstore)/i.test(url)) {
    return "Chrome doesn't allow extensions to run on the Chrome Web Store.";
  }
  return null;
}
