"use client";

import { CloseIcon } from "@earshot/shared/react";
import { useEffect, useId, useRef } from "react";
import { CAPTURE_STEPS } from "./StepArt";

export interface StartGuideProps {
  onShare: () => void;
  onClose: () => void;
  busy: boolean;
  error: string | null;
  skipNextTime: boolean;
  onSkipNextTimeChange: (v: boolean) => void;
}

/** Explains Chrome's tab-sharing picker before it appears, then opens it from the click. */
export function StartGuide({ onShare, onClose, busy, error, skipNextTime, onSkipNextTimeChange }: StartGuideProps) {
  const titleId = useId();
  const primary = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    primary.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && dialog.current) {
        // Keep focus inside the dialog.
        const items = dialog.current.querySelectorAll<HTMLElement>("button, input");
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="sheet-in max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-ink-900 p-6 shadow-2xl ring-1 ring-ink-700 sm:rounded-3xl sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="font-display text-2xl font-semibold tracking-tight text-ink-100">
              Let Earshot hear this tab
            </h2>
            <p className="mt-1.5 text-sm text-ink-400">Chrome will ask what to share. Here’s what to pick.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-ink-400 hover:bg-ink-800 hover:text-ink-100" aria-label="Close">
            <CloseIcon size={18} />
          </button>
        </div>

        <ol className="mt-6 grid gap-5 sm:grid-cols-3">
          {CAPTURE_STEPS.map((step, i) => (
            <li key={step.title}>
              <step.Art />
              <div className="mt-3 flex gap-3">
                <span className="font-display text-lg leading-tight font-semibold text-accent tabular-nums">{i + 1}</span>
                <div>
                  <h3 className="text-sm font-semibold text-ink-100">{step.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-ink-400">{step.body}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>

        {error && (
          <p role="alert" className="mt-6 rounded-xl bg-live/10 px-4 py-3 text-sm text-ink-100 ring-1 ring-live/30">
            {error}
          </p>
        )}

        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-2 text-sm text-ink-400">
            <input
              type="checkbox"
              checked={skipNextTime}
              onChange={(e) => onSkipNextTimeChange(e.target.checked)}
              className="h-4 w-4 rounded accent-[var(--color-accent)]"
            />
            Don’t show this again
          </label>
          <button
            ref={primary}
            type="button"
            onClick={onShare}
            disabled={busy}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-accent px-6 font-semibold text-accent-ink transition-colors hover:bg-accent-strong disabled:opacity-60"
          >
            {busy ? "Waiting for Chrome…" : error ? "Try again" : "Choose this tab"}
          </button>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-ink-500">
          Only this tab’s sound is used, and only while captions are on. Audio goes to Deepgram for transcription; transcripts stay in this tab.
        </p>
      </div>
    </div>
  );
}
