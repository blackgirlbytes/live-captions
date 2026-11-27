"use client";

import { looksLikeDeepgramKey, verifyDeepgramKey } from "@heard/shared";
import { useId, useState, type FormEvent } from "react";
import { DEEPGRAM_CONSOLE_URL, saveUserKey } from "@/lib/deepgram-key";
import { useT } from "@/i18n/I18nProvider";

export interface DeepgramKeyFormProps {
  /** Called after the key was verified with Deepgram and saved. `persisted` is false when storage is blocked. */
  onSaved: (persisted: boolean) => void;
  onCancel?: () => void;
  autoFocus?: boolean;
  /** Tighter layout for the settings popover. */
  compact?: boolean;
}

type ErrorCode = "empty" | "malformed" | "rejected" | "offline";

type Phase = { kind: "idle" } | { kind: "checking" } | { kind: "error"; code: ErrorCode };

/** Paste → verify with Deepgram (a brief socket from this browser) → save locally. */
export function DeepgramKeyForm({ onSaved, onCancel, autoFocus = false, compact = false }: DeepgramKeyFormProps) {
  const t = useT("key").form;
  const id = useId();
  const errorId = `${id}-error`;
  const [value, setValue] = useState("");
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const checking = phase.kind === "checking";

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (checking) return;
    const key = value.trim();
    if (!key) return setPhase({ kind: "error", code: "empty" });
    if (!looksLikeDeepgramKey(key)) return setPhase({ kind: "error", code: "malformed" });
    setPhase({ kind: "checking" });
    const result = await verifyDeepgramKey(key);
    if (result !== "ok") return setPhase({ kind: "error", code: result });
    const persisted = saveUserKey(key);
    setValue("");
    setPhase({ kind: "idle" });
    onSaved(persisted);
  };

  const error = phase.kind === "error" ? t.errors[phase.code] : null;

  return (
    <form onSubmit={onSubmit} noValidate className={compact ? "space-y-2.5" : "space-y-3"}>
      <label htmlFor={id} className={compact ? "sr-only" : "block text-sm font-medium text-ink-100"}>
        {t.label}
      </label>
      <div
        className={`flex items-center gap-1 rounded-xl bg-ink-850 p-1 ring-1 transition-shadow focus-within:ring-2 focus-within:ring-accent ${
          error ? "ring-live/60" : "ring-ink-700"
        }`}
      >
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (phase.kind === "error") setPhase({ kind: "idle" });
          }}
          onPaste={(e) => {
            // Pasted keys often carry stray whitespace or a trailing newline.
            const pasted = e.clipboardData.getData("text").trim();
            if (!pasted) return;
            e.preventDefault();
            setValue(pasted);
            if (phase.kind === "error") setPhase({ kind: "idle" });
          }}
          placeholder={t.placeholder}
          autoFocus={autoFocus}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          data-1p-ignore
          data-lpignore="true"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          disabled={checking}
          // The wrapper draws the focus ring; the global :focus-visible outline (unlayered) would double it.
          style={{ outline: "none" }}
          className={`min-w-0 flex-1 bg-transparent px-3 font-mono text-ink-100 placeholder:font-sans placeholder:text-ink-500 focus:outline-none disabled:opacity-60 ${
            compact ? "h-9 text-sm" : "h-10 text-[0.95rem]"
          }`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={visible ? t.hide : t.show}
          title={visible ? t.hide : t.show}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-100"
        >
          <EyeIcon off={visible} />
        </button>
      </div>

      {error && (
        <p id={errorId} role="alert" className="text-sm leading-snug text-[#ff8b96]">
          {error}
        </p>
      )}

      <div className={`flex items-center gap-2 ${compact ? "" : "pt-1"}`}>
        <button
          type="submit"
          disabled={checking}
          className={`inline-flex items-center justify-center gap-2 rounded-xl bg-accent font-semibold text-accent-ink transition-colors hover:bg-accent-strong disabled:cursor-wait disabled:opacity-70 ${
            compact ? "h-9 px-3.5 text-sm" : "h-11 px-5"
          }`}
        >
          {checking && <Spinner />}
          {checking ? t.checking : t.submit}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={checking}
            className={`rounded-xl px-3 text-ink-300 transition-colors hover:bg-ink-800 hover:text-ink-100 ${compact ? "h-9 text-sm" : "h-11"}`}
          >
            {t.cancel}
          </button>
        )}
        {compact && (
          <a
            href={DEEPGRAM_CONSOLE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-xs text-ink-400 underline-offset-2 hover:text-accent hover:underline"
          >
            {t.getKey}
          </a>
        )}
      </div>
    </form>
  );
}

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.8" />
      {off && <path d="M4 4l16 16" />}
    </svg>
  );
}

function Spinner() {
  return <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent-ink/30 border-t-accent-ink" aria-hidden="true" />;
}
