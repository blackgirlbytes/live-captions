import { useEffect, useMemo, useState } from "react";
import type { Locale } from "@heard/shared";
import { uiLabels } from "@heard/shared/react";
import { MESSAGES } from "@/i18n";
import { browserLocale, getUiLanguageSetting, onUiLanguageChange, setUiLanguage } from "@/utils/i18n";

/**
 * The interface language for an extension page or the caption box. Follows the saved choice
 * live, so changing it in the side panel updates every open view.
 *
 * Starts in Chrome's language, which is also the saved choice for nearly everyone, so the
 * first paint rarely changes.
 */
export function useI18n() {
  const [setting, setSetting] = useState<Locale | "" | null>(null);

  useEffect(() => {
    let alive = true;
    const read = () => void getUiLanguageSetting().then((v) => alive && setSetting(v));
    read();
    const off = onUiLanguageChange(read);
    return () => {
      alive = false;
      off();
    };
  }, []);

  const auto = useMemo(browserLocale, []);
  const locale: Locale = setting || auto;

  useEffect(() => {
    // Extension pages only: sets the page language for screen readers and fonts.
    if (typeof document !== "undefined" && location.protocol === "chrome-extension:") document.documentElement.lang = locale;
  }, [locale]);

  return {
    locale,
    /** The extension's own words. */
    t: MESSAGES[locale],
    /** Words inside the shared transcript and settings components. */
    ui: uiLabels(locale),
    /** The saved choice: a locale, or "" to follow Chrome; null until read. */
    setting,
    /** Chrome's language, matched to one Heard speaks. */
    auto,
    setLanguage: (value: Locale | "") => void setUiLanguage(value),
  };
}
