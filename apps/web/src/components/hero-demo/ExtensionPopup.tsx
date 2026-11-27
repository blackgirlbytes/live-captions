"use client";

import { CaptionsGlyph } from "./icons";
import { useHeroDemo, VIDEO_TITLE } from "./state";

/** Mirrors the extension's popup (apps/extension/entrypoints/popup). */
export function ExtensionPopup() {
  const { captionsOn, setCaptionsOn } = useHeroDemo();

  return (
    <div className="rounded-[20px] bg-ink-900 p-3.5 shadow-[0_30px_60px_-24px_rgba(0,0,0,0.95)] ring-1 ring-white/[0.08]">
      <div className="flex items-center justify-between px-0.5">
        <span className="font-display text-[15px] font-semibold tracking-tight text-ink-100">Earshot</span>
        <span
          role="status"
          aria-label={captionsOn ? "Transcription live" : "Transcription off"}
          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            captionsOn ? "bg-live/15 text-live" : "bg-ink-800 text-ink-300"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${captionsOn ? "animate-pulse-dot bg-live" : "bg-ink-500"}`} aria-hidden="true" />
          {captionsOn ? "Live" : "Off"}
        </span>
      </div>
      <div className="mt-3 rounded-2xl bg-ink-850 p-3">
        <div className="flex items-center gap-2.5">
          <span
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors ${
              captionsOn ? "bg-accent text-accent-ink" : "bg-ink-800 text-ink-300"
            }`}
          >
            <CaptionsGlyph />
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block text-[13px] font-semibold text-ink-100">AI captions</span>
            <span className="block truncate text-[11px] text-ink-400">{VIDEO_TITLE}</span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={captionsOn}
            aria-label={captionsOn ? "Stop captions" : "Start captions"}
            title={captionsOn ? "Stop captions" : "Start captions"}
            onClick={() => setCaptionsOn(!captionsOn)}
            className={`relative h-6 w-10 shrink-0 cursor-pointer rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              captionsOn ? "bg-accent hover:bg-accent-strong" : "bg-ink-600 hover:bg-ink-500"
            }`}
          >
            <span
              className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${captionsOn ? "left-5" : "left-1"}`}
              aria-hidden="true"
            />
          </button>
        </div>
        <p className="mt-2.5 text-[11px] leading-relaxed text-ink-300" aria-live="polite">
          {captionsOn ? "Captioning this tab on youtube.com" : "Turn on to caption whatever is playing in this tab."}
        </p>
      </div>
    </div>
  );
}
