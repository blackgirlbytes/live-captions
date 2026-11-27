"use client";

/**
 * Shared state for the home page's product demo. The player, extension popup,
 * transcript and player controls all read and change this one simulated session,
 * so using one piece updates the others (turn captions off in the popup and the
 * player stops captioning, click a transcript line and the player jumps there).
 *
 * Nothing here touches real audio or Deepgram. It is a scripted talk on a clock.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export interface ScriptLine {
  /** Seconds into the video when the line starts. */
  t: number;
  text: string;
}

/** An invented talk, so the demo never quotes a real one. */
export const SCRIPT: ScriptLine[] = [
  { t: 12, text: "Good morning, everyone. Thanks for having me." },
  { t: 17, text: "I want to start with a question." },
  { t: 21, text: "What do we really mean when we say learning?" },
  { t: 26, text: "Most of us picture tests and grades." },
  { t: 31, text: "But the best lessons rarely look like that." },
  { t: 36, text: "So today I want to talk about curiosity, and how we lose it." },
  { t: 43, text: "Every child starts out asking hundreds of questions a day." },
  { t: 49, text: "Somewhere along the way, most of them stop." },
  { t: 54, text: "I think we can change that." },
];

export const VIDEO_TITLE = "Why curiosity matters";
/** Where the clock starts on load, and where it loops back to. */
export const START_TIME = 33;
export const LOOP_FROM = 10;
export const DURATION = 60;
/** Lines already in the transcript when the page loads, so it isn't empty. */
const PRE_HEARD = SCRIPT.filter((l) => l.t <= START_TIME).map((_, i) => i);
const TICK_MS = 250;

export interface HeroDemoState {
  /** Simulated playback position in seconds. */
  time: number;
  playing: boolean;
  /** Heard is listening (the popup switch and Stop/Start captions). */
  captionsOn: boolean;
  /** The caption overlay is visible on the player (the CC button). */
  showCaptions: boolean;
  /** The transcript card is visible (the transcript button). */
  showTranscript: boolean;
  /** Indices into SCRIPT that Heard has captured so far, in order. */
  heard: number[];
  /** Index of the line being spoken right now, or null between lines / when not listening. */
  current: number | null;
  /** Transcript search text. */
  query: string;

  togglePlaying: () => void;
  setCaptionsOn: (on: boolean) => void;
  setShowCaptions: (on: boolean) => void;
  setShowTranscript: (on: boolean) => void;
  setQuery: (q: string) => void;
  /** Jump the player to a time (transcript lines call this). */
  seek: (t: number) => void;
}

const Ctx = createContext<HeroDemoState | null>(null);

/** Index of the line that covers time `t`, or null before the first line. */
export function lineAt(t: number): number | null {
  let idx: number | null = null;
  SCRIPT.forEach((line, i) => {
    if (line.t <= t) idx = i;
  });
  if (idx === null) return null;
  const end = SCRIPT[idx + 1]?.t ?? DURATION;
  return t < end ? idx : null;
}

export function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function HeroDemoProvider({ children }: { children: ReactNode }) {
  const [time, setTime] = useState(START_TIME);
  const [playing, setPlaying] = useState(true);
  const [captionsOn, setCaptionsOn] = useState(true);
  const [showCaptions, setShowCaptions] = useState(true);
  const [showTranscript, setShowTranscript] = useState(true);
  const [heard, setHeard] = useState<number[]>(PRE_HEARD);
  const [query, setQuery] = useState("");

  // With reduced motion, start paused; everything still works on click.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setPlaying(false);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setTime((t) => {
        const next = t + TICK_MS / 1000;
        if (next >= DURATION) {
          setHeard([]);
          return LOOP_FROM;
        }
        return next;
      });
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [playing]);

  // Capture the line being spoken while Heard is listening.
  const spoken = lineAt(time);
  useEffect(() => {
    if (!captionsOn || spoken === null) return;
    setHeard((h) => (h.includes(spoken) ? h : [...h, spoken].sort((a, b) => a - b)));
  }, [captionsOn, spoken]);

  const seek = useCallback((t: number) => setTime(Math.max(0, Math.min(DURATION - 0.01, t))), []);
  const togglePlaying = useCallback(() => setPlaying((p) => !p), []);

  const value = useMemo<HeroDemoState>(
    () => ({
      time,
      playing,
      captionsOn,
      showCaptions,
      showTranscript,
      heard,
      current: captionsOn ? spoken : null,
      query,
      togglePlaying,
      setCaptionsOn,
      setShowCaptions,
      setShowTranscript,
      setQuery,
      seek,
    }),
    [time, playing, captionsOn, showCaptions, showTranscript, heard, spoken, query, togglePlaying, seek],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useHeroDemo(): HeroDemoState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useHeroDemo must be used inside <HeroDemoProvider>");
  return v;
}
