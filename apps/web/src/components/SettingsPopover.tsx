"use client";

import type { CaptionSettings } from "@earshot/shared";
import { CaptionSettingsForm, SettingsIcon } from "@earshot/shared/react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export function SettingsPopover({
  settings,
  onChange,
  showPosition,
  buttonClassName,
  sheet = false,
  open: openProp,
  onOpenChange,
  children,
  scrollToChildren = false,
}: {
  settings: CaptionSettings;
  onChange: (s: CaptionSettings) => void;
  showPosition: boolean;
  buttonClassName: string;
  /** Render as a full-height side sheet (fullscreen), instead of a dropdown below the button. */
  sheet?: boolean;
  /** Controlled open state (optional). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Extra sections below the caption settings (e.g. the Deepgram key). */
  children?: ReactNode;
  /** Scroll the extra sections into view when opening. */
  scrollToChildren?: boolean;
}) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (next: boolean) => {
    if (openProp === undefined) setOpenState(next);
    onOpenChange?.(next);
  };
  const setOpenRef = useRef(setOpen);
  setOpenRef.current = setOpen;
  const extra = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpenRef.current(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenRef.current(false);
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

  useEffect(() => {
    if (open && scrollToChildren) extra.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [open, scrollToChildren]);

  return (
    <div className="relative" ref={root}>
      <button
        ref={button}
        type="button"
        className={buttonClassName}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={id}
        aria-label="Settings"
        title="Settings"
      >
        <SettingsIcon size={18} />
      </button>
      {open && (
        <div
          id={id}
          role="dialog"
          aria-label="Settings"
          className={
            // Never drawn over the video: it drops below the controls, or (in fullscreen) the
            // stage makes room for it on the right.
            sheet
              ? "fixed top-0 right-0 bottom-0 z-40 w-80 overflow-y-auto bg-ink-900 p-5 ring-1 ring-ink-700"
              : "sheet-in absolute top-full right-0 z-40 mt-2 max-h-[calc(100dvh-5rem)] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl bg-ink-900 p-5 shadow-2xl ring-1 ring-ink-700"
          }
        >
          <CaptionSettingsForm settings={settings} onChange={onChange} showPosition={showPosition} />
          {!showPosition && (
            <p className="mt-4 border-t border-ink-800 pt-3 text-xs leading-relaxed text-ink-500">
              YouTube doesn’t allow anything on top of its player, so captions show just below the video.
            </p>
          )}
          {children && (
            <div ref={extra} className="mt-5 scroll-mt-4 border-t border-ink-800 pt-5">
              {children}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
