"use client";

import type { CaptionSettings } from "@heard/shared";
import { CaptionSettingsForm, CloseIcon } from "@heard/shared/react";
import { useEffect, useRef, type ReactNode } from "react";
import { useSharedLabels } from "./useSharedLabels";
import { useT } from "@/i18n/I18nProvider";

export const SETTINGS_PANEL_ID = "caption-settings";

/**
 * Caption settings as a panel: it takes the transcript's place in the sidebar (or a sheet
 * beside the video in fullscreen), so the captions it changes stay in view while you adjust them.
 */
export function SettingsPanel({
  settings,
  onChange,
  showPosition,
  providerName,
  onClose,
  children,
  scrollToChildren = false,
}: {
  settings: CaptionSettings;
  onChange: (s: CaptionSettings) => void;
  showPosition: boolean;
  /** Named in the "doesn't allow anything on top of its player" note. */
  providerName: string;
  onClose: () => void;
  /** Extra sections below the caption settings (e.g. the Deepgram key). */
  children?: ReactNode;
  /** Scroll the extra sections into view when opening. */
  scrollToChildren?: boolean;
}) {
  const t = useT("watch").settings;
  const ui = useSharedLabels();
  const extra = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (scrollToChildren) extra.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [scrollToChildren]);

  return (
    <div id={SETTINGS_PANEL_ID} role="region" aria-labelledby={`${SETTINGS_PANEL_ID}-title`} className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
        <h2
          ref={heading}
          id={`${SETTINGS_PANEL_ID}-title`}
          tabIndex={-1}
          className="font-display text-lg font-semibold tracking-tight text-ink-100 focus:outline-none"
        >
          {t.title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t.close}
          title={t.close}
          className="grid h-9 w-9 place-items-center rounded-full text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-100 focus-visible:outline-2 focus-visible:outline-accent"
        >
          <CloseIcon size={18} />
        </button>
      </div>
      <div className="heard-scroll min-h-0 flex-1 overflow-y-auto border-t border-ink-800 px-4 py-5">
        <CaptionSettingsForm settings={settings} onChange={onChange} showPosition={showPosition} labels={{ ...ui.settings, language: ui.language }} />
        {!showPosition && <p className="mt-4 border-t border-ink-800 pt-3 text-xs leading-relaxed text-ink-500">{t.noOverlay(providerName)}</p>}
        {children && (
          <div ref={extra} className="mt-5 scroll-mt-4 border-t border-ink-800 pt-5">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
