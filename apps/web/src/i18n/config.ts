/**
 * Languages for the site's own words (navigation, buttons, help text). The list lives in
 * @heard/shared so the extension offers the same ones.
 */
export { DEFAULT_LOCALE, LOCALES, LOCALE_NAMES, isLocale, matchAcceptLanguage, type Locale } from "@heard/shared/locales";

/** Cookie that remembers the visitor's choice. */
export const LOCALE_COOKIE = "heard-lang";
/** Request header the proxy sets when the address carries `?lang=`. */
export const LOCALE_HEADER = "x-heard-lang";
/** Query parameter that picks a language for a shared link. */
export const LOCALE_PARAM = "lang";
