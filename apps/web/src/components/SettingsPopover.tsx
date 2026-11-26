"use client";

import type { CaptionSettings } from "@earshot/shared";
import { CaptionSettingsForm, SettingsIcon } from "@earshot/shared/react";
import { useEffect, useId, useRef, useState } from "react";

export function SettingsPopover({
  settings,
  onChange,
  showPosition,
  buttonClassName,
  sheet = false,
  onOpenChange,
}: {
  settings: CaptionSettings;
  onChange: (s: CaptionSettings) => void;
  showPosition: boolean;
  buttonClassName: string;
  /** Render as a full-height side sheet (fullscreen), instead of a dropdown below the button. */
  sheet?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => onOpenChange?.(open), [open, onOpenChange]);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={root}>
      <button
        ref={button}
        type="button"
        className={buttonClassName}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={id}
        aria-label="Caption settings"
        title="Caption settings"
      >
        <SettingsIcon size={18} />
      </button>
      {open && (
        <div
          id={id}
          role="dialog"
          aria-label="Caption settings"
          className={
            // Never drawn over the video: it drops below the controls, or (in fullscreen) the
            // stage makes room for it on the right.
            sheet
              ? "fixed top-0 right-0 bottom-0 z-40 w-80 overflow-y-auto bg-ink-900 p-5 ring-1 ring-ink-700"
              : "sheet-in absolute top-full right-0 z-40 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-2xl bg-ink-900 p-5 shadow-2xl ring-1 ring-ink-700"
          }
        >
          <CaptionSettingsForm settings={settings} onChange={onChange} showPosition={showPosition} />
          {!showPosition && (
            <p className="mt-4 border-t border-ink-800 pt-3 text-xs leading-relaxed text-ink-500">
              YouTube doesn’t allow anything on top of its player, so captions show just below the video.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
