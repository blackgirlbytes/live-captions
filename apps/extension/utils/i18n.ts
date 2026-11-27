/**
 * The extension's interface language. Stored as `uiLanguage` in chrome.storage.local; empty
 * (the default) follows Chrome's own language. Works in every context: pages, the overlay
 * content script and the service worker.
 */
import { browser } from "wxt/browser";
import { DEFAULT_LOCALE, isLocale, matchLocale, type Locale } from "@heard/shared";
import { MESSAGES, type ExtensionMessages } from "@/i18n";
import { STORAGE_KEYS } from "./config";

/** Chrome's language matched to one Heard speaks, or English. */
export function browserLocale(): Locale {
  let ui: string | undefined;
  try {
    ui = browser.i18n.getUILanguage();
  } catch {
    /* no i18n API in this context */
  }
  const preferred = typeof navigator !== "undefined" ? navigator.languages ?? [] : [];
  return matchLocale([ui, ...preferred]) ?? DEFAULT_LOCALE;
}

/** The saved choice: a locale, or "" to follow Chrome. */
export function storedLanguage(value: unknown): Locale | "" {
  return isLocale(value) ? value : "";
}

export async function getUiLanguageSetting(): Promise<Locale | ""> {
  const stored = (await browser.storage.local.get(STORAGE_KEYS.uiLanguage).catch(() => ({})))[STORAGE_KEYS.uiLanguage as never];
  return storedLanguage(stored);
}

export async function getLocale(): Promise<Locale> {
  return (await getUiLanguageSetting()) || browserLocale();
}

export async function getMessages(): Promise<ExtensionMessages> {
  return MESSAGES[await getLocale()];
}

export function setUiLanguage(value: Locale | ""): Promise<void> {
  return value ? browser.storage.local.set({ [STORAGE_KEYS.uiLanguage]: value }) : browser.storage.local.remove(STORAGE_KEYS.uiLanguage);
}

/** Calls `fn` whenever the saved interface language changes. Returns an unsubscribe function. */
export function onUiLanguageChange(fn: () => void): () => void {
  const listener = (changes: Record<string, unknown>, area: string) => {
    if (area === "local" && STORAGE_KEYS.uiLanguage in changes) fn();
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}
