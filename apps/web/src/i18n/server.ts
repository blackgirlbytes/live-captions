import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALE_HEADER, isLocale, matchAcceptLanguage, type Locale } from "./config";
import { MESSAGES, type Messages } from "./messages";

/** The language for this request: `?lang=` (via the proxy), then the saved choice, then the browser's language. */
export async function getLocale(): Promise<Locale> {
  const h = await headers();
  const fromLink = h.get(LOCALE_HEADER);
  if (isLocale(fromLink)) return fromLink;
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(saved)) return saved;
  return matchAcceptLanguage(h.get("accept-language")) ?? DEFAULT_LOCALE;
}

export async function getMessages(): Promise<Messages> {
  return MESSAGES[await getLocale()];
}
