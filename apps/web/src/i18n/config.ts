/**
 * Languages for the site's own words (navigation, buttons, help text). Captions and transcripts
 * are never translated: they show what was said, in the language it was said in.
 */
export const LOCALES = ["en", "es", "fr", "pt", "de", "ja"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

/** Each language's name in itself, for the picker. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
  pt: "Português",
  de: "Deutsch",
  ja: "日本語",
};

/** Cookie that remembers the visitor's choice. */
export const LOCALE_COOKIE = "heard-lang";
/** Request header the proxy sets when the address carries `?lang=`. */
export const LOCALE_HEADER = "x-heard-lang";
/** Query parameter that picks a language for a shared link. */
export const LOCALE_PARAM = "lang";

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

/** Best supported match for an Accept-Language header, e.g. "pt-BR,pt;q=0.9,en;q=0.8" → "pt". */
export function matchAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null;
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      return { base: (tag ?? "").toLowerCase().split("-")[0] ?? "", q: q ? Number(q.split("=")[1]) || 0 : 1 };
    })
    .sort((a, b) => b.q - a.q);
  for (const { base } of ranked) if (isLocale(base)) return base;
  return null;
}
