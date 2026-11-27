"use client";

import { LOCALES, LOCALE_NAMES, isLocale } from "@/i18n/config";
import { useLocale, useT } from "@/i18n/I18nProvider";

/** A compact language menu. The choice is remembered, and only the site's words change, never captions. */
export function LanguagePicker({ className = "" }: { className?: string }) {
  const { locale, setLocale } = useLocale();
  const t = useT("common");
  return (
    <label className={`relative inline-flex items-center text-sm text-ink-400 hover:text-ink-100 ${className}`}>
      <span className="sr-only">{t.language.label}</span>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" className="pointer-events-none absolute left-2">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.5 2.8 2.5 15.2 0 18M12 3c-2.5 2.8-2.5 15.2 0 18" />
      </svg>
      <select
        value={locale}
        onChange={(e) => isLocale(e.target.value) && setLocale(e.target.value)}
        className="cursor-pointer appearance-none rounded-lg bg-transparent py-1 pr-2 pl-7 text-inherit transition-colors hover:bg-ink-900 focus-visible:bg-ink-900"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l} lang={l} className="bg-ink-900 text-ink-100">
            {LOCALE_NAMES[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
