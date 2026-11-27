/**
 * Languages Heard's own words (buttons, help text) come in, shared by the site and the
 * extension. Captions and transcripts are separate: they show what was said, or the
 * translation the viewer picked.
 */
export const LOCALES = ["en", "es", "fr", "pt", "de", "ja"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

/** Each language's name in itself, for pickers. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
  pt: "Português",
  de: "Deutsch",
  ja: "日本語",
};

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

/** First supported language among BCP 47 tags in preference order, e.g. ["pt-BR", "en"] → "pt". */
export function matchLocale(tags: readonly (string | null | undefined)[]): Locale | null {
  for (const tag of tags) {
    const base = (tag ?? "").trim().toLowerCase().split(/[-_]/)[0];
    if (isLocale(base)) return base;
  }
  return null;
}

/** Best supported match for an Accept-Language header, e.g. "pt-BR,pt;q=0.9,en;q=0.8" → "pt". */
export function matchAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null;
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      return { tag: tag ?? "", q: q ? Number(q.split("=")[1]) || 0 : 1 };
    })
    .sort((a, b) => b.q - a.q);
  return matchLocale(ranked.map((r) => r.tag));
}
