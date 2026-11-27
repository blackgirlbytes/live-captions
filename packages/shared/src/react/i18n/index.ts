import { languageName as englishLanguageName } from "../../core/settings";
import type { Locale } from "../../core/locales";
import type { SharedUiLabels } from "../labels";
import { de } from "./de";
import { en } from "./en";
import { es } from "./es";
import { fr } from "./fr";
import { ja } from "./ja";
import { pt } from "./pt";

/** Words inside the shared components, per interface language. English is the source of truth. */
export const UI_LABELS: Record<Locale, SharedUiLabels> = { en, es, fr, pt, de, ja };

const cache = new Map<Locale, SharedUiLabels>();

/** Shared-component labels for a language, with language names (Spanish, Español…) in that language too. */
export function uiLabels(locale: Locale): SharedUiLabels {
  const labels = UI_LABELS[locale];
  if (locale === "en") return labels;
  const hit = cache.get(locale);
  if (hit) return hit;
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
  const out = { ...labels, language: { ...labels.language, languageName } };
  cache.set(locale, out);
  return out;
}
