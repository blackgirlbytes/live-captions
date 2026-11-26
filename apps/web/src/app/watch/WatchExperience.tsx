"use client";

import {
  createPcmWorkletUrl,
  createTokenFetcher,
  preferredTimeBase,
  TranscriptionSession,
  type CaptionSettings,
  type CaptionState,
  type TranscriptionStatus,
} from "@earshot/shared";
import {
  CaptionsIcon,
  CaptionText,
  ExternalIcon,
  PanelIcon,
  PlayIcon,
  StatusBadge,
  StopIcon,
  TranscriptToolbar,
  TranscriptView,
  useTranscriptionSession,
} from "@earshot/shared/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SettingsPopover } from "@/components/SettingsPopover";
import { StartGuide } from "@/components/StartGuide";
import { captureTabAudio, detectCaptureSupport } from "@/lib/capture";
import { resolveVideo, type PlayerAdapter, type PlayerError, type PlayerState } from "@/lib/providers";
import { loadCaptionSettings, saveCaptionSettings } from "@/lib/settings-storage";

const GUIDE_KEY = "earshot:skip-start-guide";
const POLL_MS = 250;

let workletUrl: string | null = null;
/** One Blob URL per page load is enough for every session. */
function getWorkletUrl() {
  return (workletUrl ??= createPcmWorkletUrl());
}

const RUNNING: TranscriptionStatus[] = ["connecting", "live", "paused", "reconnecting"];

export function WatchExperience({ url }: { url: string }) {
  const resolved = useMemo(() => resolveVideo(url), [url]);
  if (!resolved.ok) throw new Error(resolved.message); // WatchShell only renders us for valid links
  const { provider, video } = resolved;

  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const adapterRef = useRef<PlayerAdapter | null>(null);

  const [session] = useState(
    () =>
      new TranscriptionSession({
        // Absolute URL: the shared fetcher builds error messages with `new URL(endpoint)`.
        getToken: createTokenFetcher(`${window.location.origin}/api/deepgram/token`),
        workletUrl: getWorkletUrl(),
        getMediaTime: () => adapterRef.current?.getCurrentTime() ?? null,
        preservePlayback: false,
      }),
  );
  const ts = useTranscriptionSession(session);
  const running = RUNNING.includes(ts.status);

  const [playerReady, setPlayerReady] = useState(false);
  const [playerError, setPlayerError] = useState<PlayerError | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(video.maybeLive);
  const [currentTime, setCurrentTime] = useState(0);

  const [settings, setSettingsState] = useState<CaptionSettings>(loadCaptionSettings);
  const setSettings = useCallback((next: CaptionSettings) => {
    setSettingsState(next);
    saveCaptionSettings(next);
  }, []);
  const overlayAllowed = provider.capabilities.allowsCaptionOverlay;
  const placement = overlayAllowed ? settings.position : "below";

  const [support] = useState(detectCaptureSupport);
  const [guideOpen, setGuideOpen] = useState(false);
  const [skipGuide, setSkipGuide] = useState(() => readFlag(GUIDE_KEY));
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);

  const [panelOpen, setPanelOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  /* ----------------------------- player ----------------------------- */

  const applyPlayerState = useCallback(
    (state: PlayerState) => {
      // Only send audio while the video is actually playing (buffering is a short blip).
      session.setPaused(!(state === "playing" || state === "buffering"));
    },
    [session],
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let adapter: PlayerAdapter | null = null;
    provider
      .mount(host, video, {
        onReady: () => {
          if (cancelled) return;
          setPlayerReady(true);
          setTitle(adapterRef.current?.getTitle() ?? null);
        },
        onStateChange: (state) => {
          if (cancelled) return;
          applyPlayerState(state);
          const a = adapterRef.current;
          if (a) {
            setIsLive(a.isLive());
            setTitle((t) => a.getTitle() ?? t);
          }
        },
        onError: (err) => !cancelled && setPlayerError(err),
      })
      .then((a) => {
        if (cancelled) return a.destroy();
        adapter = a;
        adapterRef.current = a;
      })
      .catch((err: Error) => {
        if (!cancelled) setPlayerError({ code: "load", message: err.message, embeddingBlocked: false });
      });
    return () => {
      cancelled = true;
      adapter?.destroy();
      if (adapterRef.current === adapter) adapterRef.current = null;
    };
  }, [provider, video, applyPlayerState]);

  // Poll the playhead: drives the active transcript line and detects seeks.
  useEffect(() => {
    let prev: { t: number; at: number; state: PlayerState } | null = null;
    let ticks = 0;
    const id = setInterval(() => {
      const a = adapterRef.current;
      if (!a) return;
      const t = a.getCurrentTime();
      const at = performance.now();
      const state = a.getState();
      if (prev) {
        const elapsed = (at - prev.at) / 1000;
        const expected = prev.state === "playing" ? prev.t + elapsed * a.getPlaybackRate() : prev.t;
        const tolerance = 1.25 + elapsed * 0.25;
        if (Math.abs(t - expected) > tolerance) session.markDiscontinuity();
      }
      prev = { t, at, state };
      setCurrentTime((c) => (Math.abs(c - t) >= 0.2 ? t : c));
      if (++ticks % 8 === 0) {
        // Title / live flag can arrive late (e.g. once a livestream starts playing).
        setIsLive(a.isLive());
        setTitle((old) => a.getTitle() ?? old);
      }
    }, POLL_MS);
    return () => clearInterval(id);
  }, [session]);

  /* ---------------------------- session ---------------------------- */

  // Stop capturing when leaving the page or switching videos (this component is keyed by video).
  useEffect(() => {
    const onHide = () => void session.stop();
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      void session.stop();
    };
  }, [session]);

  const startCapture = useCallback(async () => {
    setCaptureError(null);
    setRequesting(true);
    let stream: MediaStream;
    try {
      stream = await captureTabAudio();
    } catch (err) {
      setRequesting(false);
      setCaptureError((err as Error).message);
      setGuideOpen(true);
      return;
    }
    setRequesting(false);
    setGuideOpen(false);
    await session.start(stream);
    const a = adapterRef.current;
    if (a) {
      const state = a.getState();
      if (state !== "playing" && state !== "buffering") a.play();
      applyPlayerState(a.getState());
    }
  }, [session, applyPlayerState]);

  const onStartClick = () => {
    if (!support.ok) return;
    // Calling getDisplayMedia straight from the click keeps Chrome's user-activation requirement.
    if (skipGuide) void startCapture();
    else {
      setCaptureError(null);
      setGuideOpen(true);
    }
  };

  const onSkipGuideChange = (v: boolean) => {
    setSkipGuide(v);
    writeFlag(GUIDE_KEY, v);
  };

  /* --------------------------- fullscreen --------------------------- */

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === stageRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void stageRef.current?.requestFullscreen().catch(() => undefined);
  }, []);

  /* ---------------------------- keyboard ---------------------------- */

  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))) return;
      if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        setSettings({ ...settingsRef.current, enabled: !settingsRef.current.enabled });
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        toggleFullscreen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setSettings, toggleFullscreen]);

  /* ---------------------------- transcript ---------------------------- */

  const timeBase = preferredTimeBase(ts.lines);
  const onSeek = useCallback((s: number) => adapterRef.current?.seekTo(s), []);
  const fileName = title ?? "earshot-transcript";

  const sessionError = ts.status === "error" ? ts.error : null;
  const reconnecting = ts.status === "reconnecting";

  /* ------------------------------ render ------------------------------ */

  const iconBtn =
    "inline-flex h-10 w-10 items-center justify-center rounded-xl text-ink-300 transition-colors hover:bg-ink-800 hover:text-ink-100 aria-pressed:text-accent disabled:opacity-40";

  const captionHint = playerError ? null : hintFor(ts.status, support.ok);

  return (
    <div
      className={`mx-auto grid w-full max-w-[1600px] flex-1 gap-0 lg:gap-6 lg:px-6 lg:py-5 ${
        panelOpen ? "lg:grid-cols-[minmax(0,1fr)_400px]" : "lg:grid-cols-[minmax(0,1fr)]"
      }`}
    >
      {/* Stage: player + caption bar + controls. This is what goes fullscreen. */}
      <section aria-label="Video" className="min-w-0">
        <div ref={stageRef} className={`stage relative flex flex-col bg-ink-950 ${fullscreen && settingsOpen ? "pr-80" : ""}`}>
          <div className="stage-player relative aspect-video max-h-[calc(100dvh-15rem)] min-h-[200px] w-full min-w-[200px] overflow-hidden bg-black lg:rounded-t-2xl">
            <div ref={hostRef} className={`absolute inset-0 ${playerError ? "hidden" : ""}`} />
            {!playerReady && !playerError && <div className="absolute inset-0 animate-pulse bg-ink-900" aria-hidden="true" />}
            {playerError && <PlayerErrorPanel error={playerError} canonicalUrl={video.canonicalUrl} providerName={provider.name} />}
            {placement === "overlay" && settings.enabled && (
              <CaptionText caption={ts.caption} settings={settings} className="absolute inset-x-4 bottom-[8%]" />
            )}
          </div>

          {placement === "below" && settings.enabled && <CaptionBar caption={ts.caption} settings={settings} hint={captionHint} />}

          {/* Controls */}
          <div className={`flex flex-wrap items-center gap-2 border-ink-800 bg-ink-900 px-3 py-2.5 sm:px-4 ${fullscreen ? "" : "lg:rounded-b-2xl lg:border-x lg:border-b"}`}>
            {running ? (
              <button
                type="button"
                onClick={() => void session.stop()}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-ink-700 px-4 text-sm font-semibold text-ink-100 transition-colors hover:bg-ink-600"
              >
                <StopIcon size={14} /> Stop captions
              </button>
            ) : (
              <button
                type="button"
                onClick={onStartClick}
                disabled={!support.ok || requesting || Boolean(playerError)}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
              >
                <PlayIcon size={14} /> {requesting ? "Waiting for Chrome…" : "Start captions"}
              </button>
            )}
            <StatusBadge status={ts.status} />
            {isLive && (
              <span className="hidden items-center rounded-full bg-ink-800 px-2.5 py-1 text-xs font-medium text-ink-300 ring-1 ring-ink-700 sm:inline-flex">
                Livestream
              </span>
            )}
            <p className="hidden min-w-0 flex-1 truncate px-1 text-sm text-ink-400 md:block" title={title ?? undefined}>
              {title}
            </p>

            <div className="ml-auto flex items-center gap-0.5">
              <button
                type="button"
                className={iconBtn}
                onClick={() => setSettings({ ...settings, enabled: !settings.enabled })}
                aria-pressed={settings.enabled}
                aria-label="Show captions"
                title="Show captions (c)"
              >
                <CaptionsIcon size={20} />
              </button>
              <SettingsPopover
                settings={settings}
                onChange={setSettings}
                showPosition={overlayAllowed}
                buttonClassName={iconBtn}
                sheet={fullscreen}
                onOpenChange={setSettingsOpen}
              />
              {!fullscreen && (
                <button
                  type="button"
                  className={iconBtn}
                  onClick={() => setPanelOpen((o) => !o)}
                  aria-pressed={panelOpen}
                  aria-label="Transcript panel"
                  title={panelOpen ? "Hide transcript" : "Show transcript"}
                >
                  <PanelIcon size={18} />
                </button>
              )}
              <button
                type="button"
                className={iconBtn}
                onClick={toggleFullscreen}
                aria-label={fullscreen ? "Exit full screen" : "Full screen"}
                title={fullscreen ? "Exit full screen (f)" : "Full screen (f)"}
              >
                <FullscreenIcon exit={fullscreen} />
              </button>
            </div>
          </div>

          {guideOpen && (
            <StartGuide
              onShare={() => void startCapture()}
              onClose={() => setGuideOpen(false)}
              busy={requesting}
              error={captureError}
              skipNextTime={skipGuide}
              onSkipNextTimeChange={onSkipGuideChange}
            />
          )}
        </div>

        {/* Notices */}
        <div className="space-y-2 px-3 pt-3 empty:hidden sm:px-4 lg:px-0" aria-live="polite">
          {!support.ok && <Banner tone="info">{support.reason}</Banner>}
          {captureError && !guideOpen && (
            <Banner tone="error" action={{ label: "Try again", onClick: () => void startCapture() }}>
              {captureError}
            </Banner>
          )}
          {sessionError && (
            <Banner tone="error" action={support.ok ? { label: "Restart captions", onClick: () => void startCapture() } : undefined}>
              Captions stopped: {sessionError}
            </Banner>
          )}
          {reconnecting && <Banner tone="info">Reconnecting to Deepgram… {ts.error ? `(${ts.error})` : ""} Audio is buffered meanwhile.</Banner>}
        </div>
      </section>

      {/* Transcript */}
      {panelOpen && (
        <aside
          aria-label="Transcript"
          className="mt-3 flex h-[65dvh] min-h-[320px] flex-col border-t border-ink-800 bg-ink-900 lg:sticky lg:top-[4.5rem] lg:mt-0 lg:h-[calc(100dvh-6rem)] lg:rounded-2xl lg:border lg:border-ink-800"
        >
          <div className="flex items-center justify-between gap-3 px-4 pt-4">
            <h2 className="font-display text-lg font-semibold tracking-tight text-ink-100">Transcript</h2>
            <span className="text-xs text-ink-500 tabular-nums">
              {ts.lines.length > 0 ? `${ts.lines.length} line${ts.lines.length === 1 ? "" : "s"}` : ""}
            </span>
          </div>
          <TranscriptToolbar lines={ts.lines} query={query} onQueryChange={setQuery} fileName={fileName} className="px-3 py-3" />
          <TranscriptView
            lines={ts.lines}
            caption={ts.caption}
            live={running}
            query={query}
            timeBase={timeBase}
            onSeek={timeBase === "media" ? onSeek : undefined}
            activeMediaTime={timeBase === "media" ? currentTime : null}
            emptyState={<TranscriptEmpty status={ts.status} supported={support.ok} />}
            className="border-t border-ink-800"
          />
          <p className="border-t border-ink-800 px-4 py-2.5 text-xs text-ink-500">
            Transcripts stay in this tab and aren’t saved anywhere. Download to keep one.
          </p>
        </aside>
      )}
    </div>
  );
}

/* ------------------------------ pieces ------------------------------ */

function CaptionBar({ caption, settings, hint }: { caption: CaptionState; settings: CaptionSettings; hint: string | null }) {
  // Reserve room for the configured number of lines so the layout doesn't jump.
  const minHeight = `calc(${settings.maxLines * settings.fontSize * 1.35}px + 1.25rem)`;
  return (
    <div className="relative flex items-center justify-center bg-black px-4 py-2.5" style={{ minHeight }}>
      {hint && !caption.text && <p className="pointer-events-none absolute inset-x-4 text-center text-sm text-ink-500">{hint}</p>}
      <CaptionText caption={caption} settings={settings} className="relative w-full" />
    </div>
  );
}

function hintFor(status: TranscriptionStatus, supported: boolean): string | null {
  switch (status) {
    case "idle":
    case "error":
      return supported ? "Captions appear here. Press Start captions." : "Captions need Chrome or Edge on a computer.";
    case "connecting":
      return "Connecting…";
    case "paused":
      return "Paused. Captions continue when the video plays.";
    case "reconnecting":
      return "Reconnecting…";
    case "live":
      return "Listening…";
  }
}

function TranscriptEmpty({ status, supported }: { status: TranscriptionStatus; supported: boolean }) {
  if (status === "live") return <span>Listening… the transcript fills in as people speak.</span>;
  if (status === "connecting") return <span>Connecting to Deepgram…</span>;
  if (status === "paused") return <span>Press play on the video to start the transcript.</span>;
  return (
    <span className="max-w-[16rem]">
      {supported
        ? "Press Start captions and share this tab. Every line lands here — click a timestamp to jump back."
        : "Open Earshot in Chrome or Edge on a computer to transcribe videos."}
    </span>
  );
}

function Banner({
  tone,
  children,
  action,
}: {
  tone: "info" | "error";
  children: React.ReactNode;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex flex-wrap items-center gap-3 rounded-xl px-4 py-3 text-sm ring-1 ${
        tone === "error" ? "bg-live/10 text-ink-100 ring-live/30" : "bg-ink-850 text-ink-300 ring-ink-700"
      }`}
    >
      <p className="min-w-0 flex-1">{children}</p>
      {action && (
        <button type="button" onClick={action.onClick} className="rounded-lg bg-ink-100 px-3 py-1.5 text-sm font-semibold text-ink-900 hover:bg-white">
          {action.label}
        </button>
      )}
    </div>
  );
}

function PlayerErrorPanel({ error, canonicalUrl, providerName }: { error: PlayerError; canonicalUrl: string; providerName: string }) {
  return (
    <div role="alert" data-error-code={error.code} className="absolute inset-0 flex items-center justify-center overflow-y-auto bg-ink-900 p-6">
      <div className="max-w-md text-center">
        <h2 className="font-display text-xl font-semibold tracking-tight text-ink-100">
          {error.embeddingBlocked ? "Watch this one on YouTube" : "This video can’t be played here"}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-300">{error.message}</p>
        {error.embeddingBlocked && (
          <p className="mt-2 text-sm leading-relaxed text-ink-400">
            The Earshot Chrome extension adds the same live captions directly on youtube.com.{" "}
            <a href="/#extension" className="text-accent underline-offset-2 hover:underline">
              Get the extension
            </a>
          </p>
        )}
        <a
          href={canonicalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-ink-100 px-4 text-sm font-semibold text-ink-900 hover:bg-white"
        >
          Open on {providerName} <ExternalIcon size={15} />
        </a>
      </div>
    </div>
  );
}

function FullscreenIcon({ exit }: { exit: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {exit ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /> : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
    </svg>
  );
}

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}
function writeFlag(key: string, on: boolean) {
  try {
    if (on) localStorage.setItem(key, "1");
    else localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
