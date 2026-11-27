import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE, LOCALE_HEADER, LOCALE_PARAM, isLocale } from "@/i18n/config";

/**
 * `?lang=es` on any page picks that language for this request and remembers it, so a shared
 * link opens in the sender's language and later pages stay in it without the parameter.
 */
export function proxy(request: NextRequest) {
  const lang = request.nextUrl.searchParams.get(LOCALE_PARAM);
  if (!isLocale(lang)) return NextResponse.next();
  const forwarded = new Headers(request.headers);
  forwarded.set(LOCALE_HEADER, lang);
  const res = NextResponse.next({ request: { headers: forwarded } });
  res.cookies.set(LOCALE_COOKIE, lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return res;
}

export const config = {
  // Pages only: not API routes, Next's own files, or static assets.
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
