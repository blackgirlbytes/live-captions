import type { Locale } from "../config";
import * as de from "./de";
import * as en from "./en";
import * as es from "./es";
import * as fr from "./fr";
import * as ja from "./ja";
import * as pt from "./pt";

/** Every language's words, grouped by area of the site. English is the source of truth. */
export type Messages = typeof en;
export const MESSAGES: Record<Locale, Messages> = { en, es, fr, pt, de, ja };
