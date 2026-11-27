"use client";

import { languageName as englishLanguageName } from "@heard/shared";
import type { SharedUiLabels } from "@heard/shared/react";
import { useMemo } from "react";
import { useLocale, useT } from "@/i18n/I18nProvider";

/** Labels for the shared transcript/settings components in the page language, language names included. */
export function useSharedLabels(): SharedUiLabels {
  const t = useT("watch");
  const { locale } = useLocale();
  return useMemo(() => {
    if (locale === "en") return t.ui;
    let names: Intl.DisplayNames | null = null;
    try {
      names = new Intl.DisplayNames([locale], { type: "language" });
    } catch {
      /* no Intl.DisplayNames: keep English names */
    }
    const languageName = (code: string) => {
      try {
        return names?.of(code) ?? englishLanguageName(code);
      } catch {
        return englishLanguageName(code);
      }
    };
    return { ...t.ui, language: { ...t.ui.language, languageName } };
  }, [t, locale]);
}
