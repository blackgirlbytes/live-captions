"use client";

import { useT } from "@/i18n/I18nProvider";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { DURATION, SCRIPT, formatTime, useHeroDemo } from "./state";

/** How fast the simulated recognizer reveals words. */
const WORDS_PER_SEC = 3;
/** How long the play/pause glyph lingers after resuming. */
const FLASH_MS = 650;

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** The player: the video with Heard's live caption overlay. */
export function VideoFrame() {
  const { time, playing, captionsOn, showCaptions, current, togglePlaying, seek } = useHeroDemo();
  const t = useT("demo");

  // Live caption: the current line, revealed a few words at a time.
  const line = current !== null && captionsOn && showCaptions ? SCRIPT[current] : undefined;
  const allWords = line ? line.text.split(" ") : [];
  const revealed = line ? Math.min(allWords.length, Math.floor(Math.max(0, time - line.t) * WORDS_PER_SEC) + 1) : 0;
  const words = allWords.slice(0, revealed);

  // Briefly show the pause glyph after resuming; the play glyph stays while paused.
  const [flash, setFlash] = useState(false);
  const flashTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(flashTimer.current), []);
  const onToggle = () => {
    window.clearTimeout(flashTimer.current);
    if (!playing && !prefersReducedMotion()) {
      setFlash(true);
      flashTimer.current = window.setTimeout(() => setFlash(false), FLASH_MS);
    } else {
      setFlash(false);
    }
    togglePlaying();
  };
  const glyphVisible = !playing || flash;

  // Scrubbing.
  const barRef = useRef<HTMLDivElement>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const fractionAt = (clientX: number): number => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  };
  const onBarDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    seek(fractionAt(e.clientX) * DURATION);
  };
  const onBarMove = (e: PointerEvent<HTMLDivElement>) => {
    const f = fractionAt(e.clientX);
    setHoverX(f);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) seek(f * DURATION);
  };
  const onBarKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 10 : 5;
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") next = time + step;
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = time - step;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = DURATION;
    if (next === null) return;
    e.preventDefault();
    seek(next);
  };

  const progress = Math.max(0, Math.min(1, time / DURATION));

  return (
    <div className="relative aspect-video overflow-hidden rounded-2xl bg-[#0b0b10] shadow-[0_30px_60px_-24px_rgba(0,0,0,0.95)] ring-1 ring-white/10">
      <svg viewBox="0 0 160 90" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id="hero-spot" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f5b83d" stopOpacity="0.22" />
            <stop offset="1" stopColor="#f5b83d" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="hero-floor" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#f5b83d" stopOpacity="0.16" />
            <stop offset="1" stopColor="#f5b83d" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="160" height="90" fill="#101016" />
        <path d="M72 0h16l30 90H42z" fill="url(#hero-spot)" />
        <ellipse cx="80" cy="89" rx="50" ry="8" fill="url(#hero-floor)" />
        <g className={`transition-opacity duration-500 motion-reduce:transition-none ${playing ? "opacity-100" : "opacity-60"}`}>
          <circle cx="80" cy="44" r="7.5" fill="#2c2b36" />
          <path d="M63 90c0-20 7.5-34 17-34s17 14 17 34z" fill="#2c2b36" />
        </g>
      </svg>

      {/* The whole picture is the play/pause control, under the overlays. */}
      <button
        type="button"
        onClick={onToggle}
        aria-label={playing ? t.video.pause : t.video.play}
        className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
      >
        <span
          aria-hidden="true"
          className={`flex h-12 w-12 items-center justify-center rounded-full bg-black/55 text-white/90 backdrop-blur-sm transition-opacity duration-300 motion-reduce:transition-none sm:h-14 sm:w-14 ${glyphVisible ? "opacity-100" : "opacity-0"}`}
        >
          {playing ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="translate-x-[1px]">
              <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" />
            </svg>
          )}
        </span>
      </button>

      {captionsOn ? (
        <span className="pointer-events-none absolute top-3 right-3 inline-flex xl:right-auto xl:left-12 items-center gap-1.5 whitespace-nowrap rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-live backdrop-blur">
          <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-live" />
          {t.video.liveCaptions}
        </span>
      ) : (
        <span className="pointer-events-none absolute top-3 right-3 inline-flex xl:right-auto xl:left-12 items-center whitespace-nowrap rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-ink-400 backdrop-blur">
          {t.video.captionsOff}
        </span>
      )}

      {/* At most two caption lines; older lines roll off the top as words arrive. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-3 bottom-5 flex max-h-[3.5em] xl:inset-x-8 xl:bottom-11 flex-col justify-end overflow-hidden text-[12.5px] leading-[1.75] sm:bottom-6 sm:text-sm"
      >
        {line && (
          <p className="text-center font-medium text-white">
            {/* Each word carries its own caption background, so the bar grows as words arrive. */}
            {words.map((w, i) => (
              <span
                key={`${current}-${i}`}
                className={`bg-black/85 py-[3px] motion-safe:animate-[word-in_220ms_ease-out_both] ${i === 0 ? "rounded-l pl-2" : ""} ${i === words.length - 1 ? "rounded-r pr-2" : ""}`}
              >
                {w}
                {i < words.length - 1 ? " " : ""}
              </span>
            ))}
          </p>
        )}
      </div>

      {/* Seek bar: a 12px hit area over the 3px track. */}
      <div
        ref={barRef}
        role="slider"
        tabIndex={0}
        aria-label={t.video.seek}
        aria-valuemin={0}
        aria-valuemax={DURATION}
        aria-valuenow={Math.floor(time)}
        aria-valuetext={t.video.seekValue(formatTime(time), formatTime(DURATION))}
        onPointerDown={onBarDown}
        onPointerMove={onBarMove}
        onPointerLeave={() => setHoverX(null)}
        onKeyDown={onBarKey}
        className="group absolute inset-x-0 bottom-0 h-3 cursor-pointer touch-none focus-visible:outline-none"
      >
        <div className="absolute inset-x-0 bottom-0 h-[3px] bg-white/10 transition-[height] duration-150 group-hover:h-[5px] group-focus-visible:h-[5px] motion-reduce:transition-none">
          <div className="h-full bg-accent" style={{ width: `${progress * 100}%` }} />
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-[5px] ring-2 ring-accent ring-inset group-focus-visible:block" />
        {hoverX !== null && (
          <span
            className="pointer-events-none absolute bottom-3 -translate-x-1/2 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-medium text-white tabular-nums"
            style={{ left: `clamp(16px, ${hoverX * 100}%, calc(100% - 16px))` }}
          >
            {formatTime(hoverX * DURATION)}
          </span>
        )}
      </div>
    </div>
  );
}
