import type { Locale } from "@heard/shared";
import { de } from "./de";
import { en, type ExtensionMessages } from "./en";
import { es } from "./es";
import { fr } from "./fr";
import { ja } from "./ja";
import { pt } from "./pt";

export type { ExtensionMessages };
/** The extension's own words in every interface language. English is the source of truth. */
export const MESSAGES: Record<Locale, ExtensionMessages> = { en, es, fr, pt, de, ja };
