import { browser } from "wxt/browser";
import { normalizeCaptionSettings, type CaptionSettings } from "@heard/shared";

/** Build-time default (`WXT_HEARD_URL=https://heard.example npx wxt build`). */
export const DEFAULT_HEARD_URL: string = (
  (import.meta.env.WXT_HEARD_URL as string | undefined) || "http://localhost:3100"
).replace(/\/+$/, "");

/** chrome.storage.local keys. Transcripts are never stored. */
export const STORAGE_KEYS = {
  serverUrl: "serverUrl",
  captionSettings: "captionSettings",
  overlayLayout: "overlayLayout",
  /** The user's own Deepgram API key ("bring your own key"). Only ever sent to Deepgram. */
  deepgramKey: "deepgramKey",
  /** Interface language ("en", "es", …); missing means "follow Chrome". */
  uiLanguage: "uiLanguage",
} as const;

/** chrome.storage.session keys (cleared when the browser closes). */
export const SESSION_KEYS = {
  /** One-shot request from the popup: open the side panel on this view. */
  sidepanelView: "sidepanelView",
} as const;

/** Popup → side panel: "show this view". Scoped to a window; expires instead of being consumed. */
export interface SidepanelViewRequest {
  view: "settings";
  windowId: number;
  at: number;
}

export const SIDEPANEL_VIEW_REQUEST_TTL_MS = 10_000;

/** Caption box placement, as fractions of the viewport so it survives resizes / fullscreen. */
export interface OverlayLayout {
  /** Left edge, 0..1 of viewport width. */
  x: number;
  /** Top edge, 0..1 of viewport height. */
  y: number;
  /** Box width in CSS px. */
  width: number;
  /** The user placed the box themselves; otherwise it sits on the page's main video. */
  manual?: boolean;
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
  return (typeof stored === "string" && normalizeServerUrl(stored)) || DEFAULT_HEARD_URL;
}

export function tokenEndpoint(serverUrl: string): string {
  return `${serverUrl}/api/deepgram/token`;
}

/** The user's saved Deepgram key, or null. Never log or broadcast the returned value. */
export async function getUserKey(): Promise<string | null> {
  const stored = (await browser.storage.local.get(STORAGE_KEYS.deepgramKey))[STORAGE_KEYS.deepgramKey];
  return typeof stored === "string" && stored.trim() ? stored.trim() : null;
}

/** "••••abcd" — the only form of the key the UI ever shows. */
export function maskKey(key: string): string {
  return `••••${key.slice(-4)}`;
}

/**
 * What the Heard server can do for us when the user has no key of their own.
 * - ready: reachable and has a Deepgram key.
 * - no_server_key: reachable but can't mint tokens.
 * - unknown: reachable, but it doesn't report whether it has a key (older server).
 * - unreachable: nothing answered.
 */
export type ServerStatus = "ready" | "no_server_key" | "unknown" | "unreachable";

/** `GET {server}/api/deepgram/token` → `{ serverKey: boolean }`. Works from pages and the service worker. */
export async function probeServer(serverUrl: string, timeoutMs = 3000): Promise<ServerStatus> {
  const url = tokenEndpoint(serverUrl);
  try {
    const res = await fetch(url, { method: "GET", cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
    const body = (await res.json().catch(() => null)) as { serverKey?: unknown; code?: unknown } | null;
    if (body && typeof body.serverKey === "boolean") return body.serverKey ? "ready" : "no_server_key";
    if (body?.code === "no_server_key") return "no_server_key";
    return "unknown";
  } catch {
    // A CORS-less answer (e.g. an older server without GET) still proves something is listening.
    try {
      await fetch(url, { method: "GET", mode: "no-cors", cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
      return "unknown";
    } catch {
      return "unreachable";
    }
  }
}

export async function getCaptionSettings(): Promise<CaptionSettings> {
  const stored = (await browser.storage.local.get(STORAGE_KEYS.captionSettings))[STORAGE_KEYS.captionSettings];
  return { ...normalizeCaptionSettings(stored), position: "overlay" };
}

/**
 * Pages Chrome never lets extensions capture or script. `url` is only known when we have
 * activeTab for the tab (popup) — undefined means "can't tell", so we let Chrome decide.
 */
export function restrictedReason(url: string | undefined): "restricted_chrome" | "restricted_webstore" | null {
  if (!url) return null;
  if (/^(chrome|edge|brave|about|devtools|view-source|chrome-extension|chrome-search|chrome-untrusted):/i.test(url)) {
    return "restricted_chrome";
  }
  if (/^https:\/\/(chromewebstore\.google\.com|chrome\.google\.com\/webstore)/i.test(url)) {
    return "restricted_webstore";
  }
  return null;
}
