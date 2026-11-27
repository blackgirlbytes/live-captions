"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ToolIcon } from "./icons";
import { useHeroDemo } from "./state";

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function PlayerControls() {
  const { captionsOn, setCaptionsOn, showCaptions, setShowCaptions, showTranscript, setShowTranscript } = useHeroDemo();
  const fullscreenRef = useRef<HTMLButtonElement>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const demoRoot = useCallback(
    () => fullscreenRef.current?.closest<HTMLElement>("[data-hero-demo]") ?? null,
    [],
  );

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement !== null && document.fullscreenElement === demoRoot());
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [demoRoot]);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => undefined);
      return;
    }
    const root = demoRoot();
    if (!root || typeof root.requestFullscreen !== "function") return;
    void root.requestFullscreen().catch(() => undefined);
  };

  return (
    <div className="flex items-center gap-1 rounded-full bg-ink-950/90 p-1.5 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.95)] ring-1 ring-white/[0.08] backdrop-blur">
      {captionsOn ? (
        <button
          type="button"
          onClick={() => setCaptionsOn(false)}
          title="Stop captions"
          className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-live/15 px-4 text-sm font-semibold text-live transition-colors hover:bg-live/25 ${focusRing}`}
        >
          <span className="h-2 w-2 rounded-[3px] bg-live" aria-hidden="true" />
          Stop captions
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setCaptionsOn(true)}
          title="Start captions"
          className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-accent px-4 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-strong ${focusRing}`}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M6 4l15 8-15 8z" />
          </svg>
          Start captions
        </button>
      )}
      <ToolIcon
        label="Show captions"
        title={showCaptions ? "Hide captions" : "Show captions"}
        active={showCaptions}
        aria-pressed={showCaptions}
        onClick={() => setShowCaptions(!showCaptions)}
      >
        <rect x="3" y="6" width="18" height="12" rx="2.5" />
        <path d="M10 10.5a2 2 0 1 0 0 3M16 10.5a2 2 0 1 0 0 3" />
      </ToolIcon>
      <ToolIcon
        label="Transcript panel"
        title={showTranscript ? "Hide transcript" : "Show transcript"}
        active={showTranscript}
        aria-pressed={showTranscript}
        onClick={() => setShowTranscript(!showTranscript)}
      >
        <path d="M5 7h14M5 12h14M5 17h9" />
      </ToolIcon>
      <ToolIcon ref={fullscreenRef} label={fullscreen ? "Exit full screen" : "Full screen"} onClick={toggleFullscreen}>
        {fullscreen ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /> : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
      </ToolIcon>
    </div>
  );
}
