"use client";

import { CloseIcon, ExternalIcon } from "@heard/shared/react";
import { useEffect, useId, useRef } from "react";
import { DeepgramKeyForm } from "./DeepgramKeyForm";
import { DEEPGRAM_CONSOLE_URL } from "@/lib/deepgram-key";
import { useT } from "@/i18n/I18nProvider";

export interface DeepgramKeyDialogProps {
  onSaved: (persisted: boolean) => void;
  onClose: () => void;
}

/** Asks for the visitor's own Deepgram key when this deployment has no server key. */
export function DeepgramKeyDialog({ onSaved, onClose }: DeepgramKeyDialogProps) {
  const titleId = useId();
  const descId = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const t = useT("key").dialog;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && dialog.current) {
        const items = [...dialog.current.querySelectorAll<HTMLElement>("a[href], button, input")].filter((el) => !(el as HTMLButtonElement).disabled);
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
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="sheet-in max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-ink-900 p-6 shadow-2xl ring-1 ring-ink-700 sm:rounded-3xl sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/12 text-accent ring-1 ring-accent/25">
              <KeyIcon />
            </span>
            <h2 id={titleId} className="font-display text-xl font-semibold tracking-tight text-ink-100 sm:text-2xl">
              {t.title}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="-mt-1 -mr-2 rounded-lg p-2 text-ink-400 hover:bg-ink-800 hover:text-ink-100" aria-label={t.close}>
            <CloseIcon size={18} />
          </button>
        </div>

        <p id={descId} className="mt-4 text-[0.95rem] leading-relaxed text-ink-300">
          {t.intro}
        </p>

        <ol className="mt-5 space-y-3 text-sm leading-relaxed text-ink-300">
          <Step n={1}>
            {t.step1}{" "}
            <a
              href={DEEPGRAM_CONSOLE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-accent underline-offset-2 hover:underline"
            >
              console.deepgram.com <ExternalIcon size={13} />
            </a>
          </Step>
          <Step n={2}>
            {t.step2Before}
            <span className="text-ink-100">{t.step2Role}</span>
            {t.step2After}
          </Step>
          <Step n={3}>{t.step3}</Step>
        </ol>

        <div className="mt-6">
          <DeepgramKeyForm onSaved={onSaved} autoFocus />
        </div>

        <p className="mt-6 flex gap-2.5 border-t border-ink-800 pt-4 text-xs leading-relaxed text-ink-400">
          <LockIcon />
          <span>
            <span className="font-medium text-ink-200">{t.privacyStrong}</span> {t.privacyRest}
          </span>
        </p>
      </div>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="font-display text-base leading-snug font-semibold text-accent tabular-nums">{n}</span>
      <span>{children}</span>
    </li>
  );
}

export function KeyIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="15" r="4" />
      <path d="M10.8 12.2 20 3M16.5 6.5l2.5 2.5M14 9l2 2" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="mt-px shrink-0 text-ok" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
