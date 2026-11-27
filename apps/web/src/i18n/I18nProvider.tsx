"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { LOCALE_COOKIE, LOCALE_PARAM, type Locale } from "./config";
import { MESSAGES, type Messages } from "./messages";

interface I18nState {
  locale: Locale;
  setLocale: (next: Locale) => void;
}

const Ctx = createContext<I18nState | null>(null);

/** Holds the page language. The server picks the first one, so the page never flashes English. */
export function I18nProvider({ initialLocale, children }: { initialLocale: Locale; children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    document.documentElement.lang = next;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    // A ?lang= in the address would override the new choice on reload, so drop it.
    const url = new URL(window.location.href);
    if (url.searchParams.has(LOCALE_PARAM)) {
      url.searchParams.delete(LOCALE_PARAM);
      window.history.replaceState(window.history.state, "", url);
    }
  }, []);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLocale(): I18nState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useLocale must be used inside <I18nProvider>");
  return v;
}

/** The current language's words for one area of the site, e.g. `const t = useT("home"); t.hero.title`. */
export function useT<N extends keyof Messages>(namespace: N): Messages[N] {
  const { locale } = useLocale();
  return MESSAGES[locale][namespace];
}
