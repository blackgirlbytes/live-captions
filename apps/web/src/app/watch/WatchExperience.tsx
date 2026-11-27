"use client";

import {
  createPcmWorkletUrl,
  preferredTimeBase,
  TranscriptionSession,
  type CaptionSettings,
  type CaptionState,
  type TranscriptionStatus,
} from "@heard/shared";
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
  TranslationNotice,
  useTranscriptionSession,
  SettingsIcon,
} from "@heard/shared/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSharedLabels } from "@/components/useSharedLabels";
import { useT } from "@/i18n/I18nProvider";
import { DeepgramKeyDialog } from "@/components/DeepgramKeyDialog";
import { DeepgramKeySettings } from "@/components/DeepgramKeySettings";
import { SETTINGS_PANEL_ID, SettingsPanel } from "@/components/SettingsPopover";
import { StartGuide } from "@/components/StartGuide";
import { captureTabAudio, detectCaptureSupport } from "@/lib/capture";
import { createGetToken, keyMode, TOKEN_ENDPOINT_PATH, useServerKeyStatus, useUserDeepgramKey } from "@/lib/deepgram-key";
import { resolveVideo, type PlayerAdapter, type PlayerError, type PlayerState } from "@/lib/providers";
import { migrateLegacyStorage } from "@/lib/legacy-storage";
import { loadCaptionSettings, saveCaptionSettings } from "@/lib/settings-storage";

const GUIDE_KEY = "heard:skip-start-guide";
const POLL_MS = 250;

let workletUrl: string | null = null;
/** One Blob URL per page load is enough for every session. */
function getWorkletUrl() {
  return (workletUrl ??= createPcmWorkletUrl());
}

const RUNNING: TranscriptionStatus[] = ["connecting", "live", "paused", "reconnecting"];

type WatchT = ReturnType<typeof useT<"watch">>;

export function WatchExperience({ url }: { url: string }) {
  const t = useT("watch");
  const ui = useSharedLabels();
  const resolved = useMemo(() => resolveVideo(url), [url]);
  if (!resolved.ok) throw new Error(resolved.message); // WatchShell only renders us for valid links
  const { provider, video } = resolved;

  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const adapterRef = useRef<PlayerAdapter | null>(null);

  const [session] = useState(
    () =>
      new TranscriptionSession({
        // The user's own Deepgram key when saved, else a server-minted JWT.
        // Absolute URL: the shared fetcher builds error messages with `new URL(endpoint)`.
        getToken: createGetToken(`${window.location.origin}${TOKEN_ENDPOINT_PATH}`),
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
  // Language changes apply live: a new spoken language reconnects, a new caption language translates.
  useEffect(() => session.setLanguages(settings.spokenLanguage, settings.captionLanguage), [session, settings.spokenLanguage, settings.captionLanguage]);
  const captionTranslation = ts.translation.target ? ts.translation.caption : null;
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
  /** Settings were opened to fix the Deepgram key: scroll there and show the form. */
  const [keyFocus, setKeyFocus] = useState(false);

  const userKey = useUserDeepgramKey();
  const [serverKey, setServerKey] = useServerKeyStatus();
  const mode = keyMode(userKey, serverKey);
  const [keyDialogOpen, setKeyDialogOpen] = useState(false);

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
    if (mode === "none") {
      // No server key and no key of their own yet: ask for one first.
      setCaptureError(null);
      setKeyDialogOpen(true);
      return;
    }
    // Calling getDisplayMedia straight from the click keeps Chrome's user-activation requirement.
    if (skipGuide) void startCapture();
    else {
      setCaptureError(null);
      setGuideOpen(true);
    }
  };

  // Verifying the key used up the click's user activation, so getDisplayMedia must come from
  // a fresh click: always continue through the start guide's "Choose this tab" button.
  const onKeySaved = useCallback(() => {
    setKeyDialogOpen(false);
    setCaptureError(null);
    setGuideOpen(true);
  }, []);
  const closeKeyDialog = useCallback(() => setKeyDialogOpen(false), []);

  const onSettingsOpenChange = useCallback((open: boolean) => {
    setSettingsOpen(open);
    if (!open) setKeyFocus(false);
  }, []);

  const openKeySettings = () => {
    setKeyFocus(true);
    setSettingsOpen(true);
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
  const fileName = title ?? "heard-transcript";

  const sessionError = ts.status === "error" ? ts.error : null;
  const reconnecting = ts.status === "reconnecting";
  const keyError = Boolean(sessionError && /API key/i.test(sessionError));
  const noServerKeyError = Boolean(sessionError && /doesn.t provide a Deepgram API key/i.test(sessionError));

  // The token endpoint said this server has no key (e.g. the status check failed earlier).
  useEffect(() => {
    if (noServerKeyError && serverKey !== false) setServerKey(false);
  }, [noServerKeyError, serverKey, setServerKey]);

  /* ------------------------------ render ------------------------------ */

  const iconBtn =
    "inline-flex h-10 w-10 items-center justify-center rounded-xl text-ink-300 transition-colors hover:bg-ink-800 hover:text-ink-100 aria-pressed:text-accent disabled:opacity-40";

  const captionHint = playerError ? null : hintFor(ts.status, support.ok, t);
  // Settings open in the sidebar (in the transcript's place), or beside the video in fullscreen.
  const sidebarSettings = settingsOpen && !fullscreen;
  const sidebarOpen = panelOpen || sidebarSettings;
  const closeSettings = () => onSettingsOpenChange(false);
  const settingsPanel = (
    <SettingsPanel settings={settings} onChange={setSettings} showPosition={overlayAllowed} onClose={closeSettings} scrollToChildren={keyFocus}>
      <DeepgramKeySettings userKey={userKey} serverKey={serverKey} initiallyEditing={keyFocus} running={running} />
    </SettingsPanel>
  );

  return (
    <div
      className={`mx-auto grid w-full max-w-[1600px] flex-1 gap-0 lg:gap-6 lg:px-6 lg:py-5 ${
        sidebarOpen ? "lg:grid-cols-[minmax(0,1fr)_400px]" : "lg:grid-cols-[minmax(0,1fr)]"
      }`}
    >
      {/* Stage: player + caption bar + controls. This is what goes fullscreen. */}
      <section aria-label={t.player.region} className="min-w-0">
        <div ref={stageRef} className={`stage relative flex flex-col bg-ink-950 ${fullscreen && settingsOpen ? "pr-80" : ""}`}>
          {fullscreen && settingsOpen && (
            <div className="fixed top-0 right-0 bottom-0 z-40 flex w-80 flex-col bg-ink-900 ring-1 ring-ink-700">{settingsPanel}</div>
          )}
          {/* Controls: above the video, so captions sit directly under the picture. */}
          <div className={`flex flex-wrap items-center gap-2 border-ink-800 bg-ink-900 px-3 py-2.5 sm:px-4 ${fullscreen ? "" : "lg:rounded-t-2xl lg:border-x lg:border-t"}`}>
            {running ? (
              <button
                type="button"
                onClick={() => void session.stop()}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-ink-700 px-4 text-sm font-semibold text-ink-100 transition-colors hover:bg-ink-600"
              >
                <StopIcon size={14} /> {t.player.stop}
              </button>
            ) : (
              <button
                type="button"
                onClick={onStartClick}
                disabled={!support.ok || requesting || Boolean(playerError)}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
              >
                <PlayIcon size={14} /> {requesting ? t.player.waiting : t.player.start}
              </button>
            )}
            <StatusBadge status={ts.status} labels={ui.status} />
            {isLive && (
              <span className="hidden items-center rounded-full bg-ink-800 px-2.5 py-1 text-xs font-medium text-ink-300 ring-1 ring-ink-700 sm:inline-flex">
                {t.player.livestream}
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
                aria-label={t.player.showCaptions}
                title={t.player.showCaptionsTitle}
              >
                <CaptionsIcon size={20} />
              </button>
              <button
                type="button"
                className={`${iconBtn} ${settingsOpen ? "bg-ink-800 text-ink-100" : ""}`}
                onClick={() => onSettingsOpenChange(!settingsOpen)}
                aria-expanded={settingsOpen}
                aria-controls={SETTINGS_PANEL_ID}
                aria-label={t.settings.title}
                title={t.settings.title}
              >
                <SettingsIcon size={18} />
              </button>
              {!fullscreen && (
                <button
                  type="button"
                  className={iconBtn}
                  onClick={() => {
                    // With settings in the sidebar, this button brings the transcript back.
                    if (sidebarSettings) {
                      closeSettings();
                      setPanelOpen(true);
                    } else setPanelOpen((o) => !o);
                  }}
                  aria-pressed={panelOpen && !sidebarSettings}
                  aria-label={t.player.panel}
                  title={panelOpen ? t.player.hideTranscript : t.player.showTranscript}
                >
                  <PanelIcon size={18} />
                </button>
              )}
              <button
                type="button"
                className={iconBtn}
                onClick={toggleFullscreen}
                aria-label={fullscreen ? t.player.exitFullscreen : t.player.fullscreen}
                title={fullscreen ? t.player.exitFullscreenTitle : t.player.fullscreenTitle}
              >
                <FullscreenIcon exit={fullscreen} />
              </button>
            </div>
          </div>

          <div
            className={`stage-player relative aspect-video max-h-[calc(100dvh-15rem)] min-h-[200px] w-full min-w-[200px] overflow-hidden bg-black ${
              placement === "below" && settings.enabled ? "" : "lg:rounded-b-2xl"
            }`}
          >
            <div ref={hostRef} className={`absolute inset-0 ${playerError ? "hidden" : ""}`} />
            {!playerReady && !playerError && <div className="absolute inset-0 animate-pulse bg-ink-900" aria-hidden="true" />}
            {playerError && <PlayerErrorPanel error={playerError} canonicalUrl={video.canonicalUrl} providerName={provider.name} t={t} />}
            {placement === "overlay" && settings.enabled && (
              <CaptionText caption={ts.caption} settings={settings} translation={captionTranslation} className="absolute inset-x-4 bottom-[8%]" />
            )}
          </div>

          {placement === "below" && settings.enabled && <CaptionBar caption={ts.caption} settings={settings} translation={captionTranslation} hint={captionHint} />}

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
          {keyDialogOpen && <DeepgramKeyDialog onSaved={onKeySaved} onClose={closeKeyDialog} />}
        </div>

        {/* Notices */}
        <div className="space-y-2 px-3 pt-3 empty:hidden sm:px-4 lg:px-0" aria-live="polite">
          {!support.ok && <Banner tone="info">{support.reason}</Banner>}
          {captureError && !guideOpen && (
            <Banner tone="error" action={{ label: t.banners.tryAgain, onClick: () => void startCapture() }}>
              {captureError}
            </Banner>
          )}
          {sessionError && (
            <Banner
              tone="error"
              action={
                keyError
                  ? mode === "none"
                    ? { label: t.banners.addKey, onClick: () => (support.ok ? setKeyDialogOpen(true) : openKeySettings()) }
                    : { label: t.banners.checkKey, onClick: openKeySettings }
                  : support.ok
                    ? { label: t.banners.restart, onClick: () => void startCapture() }
                    : undefined
              }
              secondary={keyError && support.ok && mode !== "none" ? { label: t.banners.restart, onClick: onStartClick } : undefined}
            >
              {t.banners.stopped(sessionError)}
            </Banner>
          )}
          {reconnecting && <Banner tone="info">{t.banners.reconnecting(ts.error)}</Banner>}
        </div>
      </section>

      {/* Sidebar: the transcript, or caption settings in its place (a sheet on phones). */}
      {sidebarSettings && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={closeSettings} aria-hidden="true" />}
      {sidebarOpen && (
        <aside
          aria-label={sidebarSettings ? t.settings.title : t.transcript.title}
          className={`flex flex-col bg-ink-900 lg:sticky lg:top-[4.5rem] lg:mt-0 lg:h-[calc(100dvh-6rem)] lg:rounded-2xl lg:border lg:border-ink-800 ${
            sidebarSettings
              ? "sheet-in fixed inset-x-0 bottom-0 z-40 h-[75dvh] rounded-t-2xl shadow-2xl ring-1 ring-ink-700 lg:static lg:z-auto lg:ring-0 lg:shadow-none lg:[animation:none]"
              : ""
          } ${sidebarSettings ? "" : "mt-3 h-[65dvh] min-h-[320px] border-t border-ink-800"}`}
        >
          {sidebarSettings && settingsPanel}
          <div className={sidebarSettings ? "hidden" : "contents"}>
          <div className="flex items-center justify-between gap-3 px-4 pt-4">
            <h2 className="font-display text-lg font-semibold tracking-tight text-ink-100">{t.transcript.title}</h2>
            <span className="text-xs text-ink-500 tabular-nums">
              {ts.lines.length > 0 ? t.transcript.lineCount(ts.lines.length) : ""}
            </span>
          </div>
          <TranscriptToolbar lines={ts.lines} query={query} onQueryChange={setQuery} fileName={fileName} className="px-3 py-3" labels={ui.toolbar} />
          <TranscriptView
            lines={ts.lines}
            caption={ts.caption}
            live={running}
            query={query}
            timeBase={timeBase}
            onSeek={timeBase === "media" ? onSeek : undefined}
            activeMediaTime={timeBase === "media" ? currentTime : null}
            emptyState={<TranscriptEmpty status={ts.status} supported={support.ok} t={t} />}
            labels={ui.transcript}
            translations={ts.translation.target ? ts.translation.lines : undefined}
            captionTranslation={captionTranslation}
            className="border-t border-ink-800"
          />
          <TranslationNotice issue={ts.translation.target ? ts.translation.issue : null} className="border-t border-ink-800 px-4 py-2.5" labels={ui.language} />
          <p className="border-t border-ink-800 px-4 py-2.5 text-xs text-ink-500">
            {t.transcript.privacy}
          </p>
          </div>
        </aside>
      )}
    </div>
  );
}

/* ------------------------------ pieces ------------------------------ */

function CaptionBar({
  caption,
  settings,
  translation,
  hint,
}: {
  caption: CaptionState;
  settings: CaptionSettings;
  translation: string | null;
  hint: string | null;
}) {
  // Reserve room for the configured number of lines so the layout doesn't jump.
  const minHeight = `calc(${settings.maxLines * settings.fontSize * 1.35}px + 1.25rem)`;
  return (
    <div className="relative flex items-center justify-center bg-black px-4 py-2.5 lg:rounded-b-2xl" style={{ minHeight }}>
      {hint && !caption.text && <p className="pointer-events-none absolute inset-x-4 text-center text-sm text-ink-500">{hint}</p>}
      <CaptionText caption={caption} settings={settings} translation={translation} className="relative w-full" />
    </div>
  );
}

function hintFor(status: TranscriptionStatus, supported: boolean, t: WatchT): string | null {
  switch (status) {
    case "idle":
    case "error":
      return supported ? t.hints.idle : t.hints.unsupported;
    case "connecting":
      return t.hints.connecting;
    case "paused":
      return t.hints.paused;
    case "reconnecting":
      return t.hints.reconnecting;
    case "live":
      return t.hints.live;
  }
}

function TranscriptEmpty({ status, supported, t }: { status: TranscriptionStatus; supported: boolean; t: WatchT }) {
  if (status === "live") return <span>{t.transcript.emptyLive}</span>;
  if (status === "connecting") return <span>{t.transcript.emptyConnecting}</span>;
  if (status === "paused") return <span>{t.transcript.emptyPaused}</span>;
  return <span className="max-w-[16rem]">{supported ? t.transcript.emptyIdle : t.transcript.emptyUnsupported}</span>;
}

function Banner({
  tone,
  children,
  action,
  secondary,
}: {
  tone: "info" | "error";
  children: React.ReactNode;
  action?: { label: string; onClick: () => void };
  secondary?: { label: string; onClick: () => void };
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex flex-wrap items-center gap-3 rounded-xl px-4 py-3 text-sm ring-1 ${
        tone === "error" ? "bg-live/10 text-ink-100 ring-live/30" : "bg-ink-850 text-ink-300 ring-ink-700"
      }`}
    >
      <p className="min-w-0 flex-1">{children}</p>
      {secondary && (
        <button type="button" onClick={secondary.onClick} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-ink-200 ring-1 ring-ink-600 hover:bg-ink-800">
          {secondary.label}
        </button>
      )}
      {action && (
        <button type="button" onClick={action.onClick} className="rounded-lg bg-ink-100 px-3 py-1.5 text-sm font-semibold text-ink-900 hover:bg-white">
          {action.label}
        </button>
      )}
    </div>
  );
}

function PlayerErrorPanel({ error, canonicalUrl, providerName, t }: { error: PlayerError; canonicalUrl: string; providerName: string; t: WatchT }) {
  return (
    <div role="alert" data-error-code={error.code} className="absolute inset-0 flex items-center justify-center overflow-y-auto bg-ink-900 p-6">
      <div className="max-w-md text-center">
        <h2 className="font-display text-xl font-semibold tracking-tight text-ink-100">
          {error.embeddingBlocked ? t.playerError.embedBlockedTitle : t.playerError.cantPlayTitle}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-300">{error.message}</p>
        {error.embeddingBlocked && (
          <p className="mt-2 text-sm leading-relaxed text-ink-400">
            {t.playerError.extensionNote}{" "}
            <a href="/#extension" className="text-accent underline-offset-2 hover:underline">
              {t.playerError.getExtension}
            </a>
          </p>
        )}
        <a
          href={canonicalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-ink-100 px-4 text-sm font-semibold text-ink-900 hover:bg-white"
        >
          {t.playerError.openOn(providerName)} <ExternalIcon size={15} />
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
  migrateLegacyStorage();
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
