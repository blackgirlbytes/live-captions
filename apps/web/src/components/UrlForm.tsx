"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { useT } from "@/i18n/I18nProvider";
import { resolveVideo, watchHref } from "@/lib/providers";

export interface UrlFormProps {
  initialValue?: string;
  size?: "hero" | "compact";
  autoFocus?: boolean;
}

/** Paste a link → /watch. Validates locally so mistakes are explained before navigating. */
export function UrlForm({ initialValue = "", size = "hero", autoFocus = false }: UrlFormProps) {
  const router = useRouter();
  const t = useT("home").form;
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const hero = size === "hero";

  const go = (raw: string) => {
    const result = resolveVideo(raw);
    if (!result.ok) {
      setError(localizeError(result.message, t.errors));
      return;
    }
    setError(null);
    router.push(watchHref(raw));
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    go(value);
  };

  return (
    <form onSubmit={onSubmit} className="w-full" noValidate>
      <label htmlFor={id} className="sr-only">
        {t.label}
      </label>
      <div
        className={`flex w-full items-center gap-2 rounded-2xl bg-ink-850 ring-1 transition-shadow focus-within:ring-2 focus-within:ring-accent ${
          error ? "ring-live/60" : "ring-ink-700"
        } ${hero ? "p-2 sm:p-2.5" : "p-1"}`}
      >
        <svg
          className={`shrink-0 text-ink-500 ${hero ? "ml-3 h-5 w-5" : "ml-2.5 h-4 w-4"}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" />
        </svg>
        <input
          id={id}
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData("text");
            // Pasting a valid link into an empty box goes straight to the player.
            if (!value.trim() && pasted && resolveVideo(pasted).ok) {
              e.preventDefault();
              setValue(pasted.trim());
              go(pasted);
            }
          }}
          placeholder={hero ? t.placeholder : t.placeholderCompact}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`min-w-0 flex-1 bg-transparent text-ink-100 placeholder:text-ink-500 focus:outline-none ${
            hero ? "h-12 text-base sm:text-lg" : "h-9 text-sm"
          }`}
        />
        <button
          type="submit"
          className={`shrink-0 rounded-xl bg-accent font-semibold text-accent-ink transition-colors hover:bg-accent-strong focus-visible:outline-offset-2 ${
            hero ? "h-12 px-4 text-base sm:px-6" : "h-9 px-3.5 text-sm"
          }`}
        >
          {hero ? (
            <>
              <span className="sm:hidden">{t.watch}</span>
              <span className="hidden sm:inline">{t.watchWithCaptions}</span>
            </>
          ) : (
            t.open
          )}
        </button>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className={`mt-2 text-sm text-live ${hero ? "px-1" : "px-1 text-xs"}`}>
          {error}
        </p>
      )}
    </form>
  );
}

/** resolveVideo's messages are English; swap the known ones for the current language's words. */
function localizeError(message: string, errors: { notALink: string; unknown: string; channel: string }): string {
  if (message.startsWith("Paste a full video link")) return errors.notALink;
  if (message.startsWith("Heard doesn't recognize")) return errors.unknown;
  if (message.startsWith("Channel links")) return errors.channel;
  return message;
}
