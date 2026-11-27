"use client";

import { uiLabels, type SharedUiLabels } from "@heard/shared/react";
import { useLocale } from "@/i18n/I18nProvider";

/** Labels for the shared transcript/settings components in the page language, language names included. */
export function useSharedLabels(): SharedUiLabels {
  return uiLabels(useLocale().locale);
}
