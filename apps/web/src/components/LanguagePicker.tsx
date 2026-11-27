"use client";

import { GlobeIcon, Select } from "@heard/shared/react";
import { LOCALES, LOCALE_NAMES, isLocale } from "@/i18n/config";
import { useLocale, useT } from "@/i18n/I18nProvider";

const OPTIONS = LOCALES.map((l) => ({ value: l, label: LOCALE_NAMES[l], lang: l }));

/** A compact language menu. The choice is remembered, and only the site's words change, never captions. */
export function LanguagePicker({ className = "" }: { className?: string }) {
  const { locale, setLocale } = useLocale();
  const t = useT("common");
  return (
    <Select
      variant="compact"
      label={t.language.label}
      icon={<GlobeIcon size={15} className="shrink-0" />}
      value={locale}
      options={OPTIONS}
      onChange={(l) => isLocale(l) && setLocale(l)}
      className={`text-sm text-ink-400 hover:text-ink-100 ${className}`}
    />
  );
}
