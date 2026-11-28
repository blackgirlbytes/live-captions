import { useCallback, useEffect, useRef, useState } from "react";
import { browser, type Browser } from "wxt/browser";
import {
  INITIAL_DUB_STATE,
  initialTranscriptState,
  reduceTranscript,
  TranslationEngine,
  type CaptionSettings,
  type TranscriptEvent,
} from "@heard/shared";
import {
  getCaptionSettings,
  getServerUrl,
  getUserKey,
  maskKey,
  probeServer,
  STORAGE_KEYS,
  type ServerStatus,
} from "@/utils/config";
import {
  errorMessage,
  isCapturing,
  isRuntimeMessage,
  sendToBackground,
  type CommandError,
  type CommandResult,
  type SessionSnapshot,
} from "@/utils/messages";

const EMPTY: SessionSnapshot = { tabId: null, tabTitle: null, overlayHidden: false, transcript: initialTranscriptState(), dub: INITIAL_DUB_STATE };

/**
 * Session snapshot from the offscreen document (via the background), kept current by
 * applying the offscreen's broadcast events with the shared pure reducer.
 *
 * With `translate`, this page also translates the transcript into the chosen caption
 * language and sends caption translations on to the overlay. That happens here rather than
 * in the offscreen document because Chrome's built-in translator refuses to run there.
 *
 * `setCaptionOverride` translates into another language than the saved one until it's
 * cleared (captions follow live dubbing's language while dubbing is on).
 */
export function useSession({ translate = false }: { translate?: boolean } = {}) {
  const [snap, setSnap] = useState<SessionSnapshot>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const overrideRef = useRef<string | null>(null);
  const configureRef = useRef<() => void>(() => undefined);
  const setCaptionOverride = useCallback((language: string | null) => {
    if (overrideRef.current === language) return;
    overrideRef.current = language;
    configureRef.current();
  }, []);

  useEffect(() => {
    let ready = false;
    const early: Array<(s: SessionSnapshot) => SessionSnapshot> = [];
    const apply = (fn: (s: SessionSnapshot) => SessionSnapshot) => (ready ? setSnap(fn) : early.push(fn));

    let alive = true;
    const engine = translate
      ? new TranslationEngine((event) => {
          if (!alive) return; // a translation finishing after this panel closed
          apply((s) => ({ ...s, transcript: reduceTranscript(s.transcript, event) }));
          if (event.type === "caption-translated" || event.type === "translation-config") {
            void sendToBackground({ to: "background", type: "overlay-translation", event }).catch(() => undefined);
          }
        })
      : null;
    const configure = () =>
      void getCaptionSettings().then((s) => alive && engine?.configure(s.spokenLanguage, overrideRef.current ?? s.captionLanguage));
    configureRef.current = configure;
    const onSettings = (changes: Record<string, unknown>, area: string) => {
      if (area === "local" && STORAGE_KEYS.captionSettings in changes) configure();
    };
    if (engine) {
      configure();
      browser.storage.onChanged.addListener(onSettings);
    }

    const onMessage = (msg: unknown) => {
      if (!isRuntimeMessage(msg) || msg.to !== "broadcast") return;
      if (msg.type === "transcript-event") {
        const { event, tabId } = msg as { event: TranscriptEvent; tabId: number | null };
        apply((s) => ({ ...s, tabId: tabId ?? s.tabId, transcript: reduceTranscript(s.transcript, event) }));
        engine?.handle(event);
      } else if (msg.type === "meta") {
        apply((s) => ({ ...s, ...msg.meta }));
      } else if (msg.type === "dub-state") {
        apply((s) => ({ ...s, dub: msg.dub }));
      }
    };
    browser.runtime.onMessage.addListener(onMessage);

    sendToBackground({ to: "background", type: "get-state" })
      .then((s) => s ?? EMPTY)
      .catch(() => EMPTY)
      .then((s) => {
        ready = true;
        // Replay events that raced the snapshot (line events are de-duplicated by id).
        const merged = early.reduce((acc, fn) => fn(acc), s);
        setSnap(merged);
        setLoaded(true);
        // Translate what was said before this panel opened.
        for (const line of merged.transcript.lines) engine?.handle({ type: "line", line });
        if (merged.transcript.caption.text) engine?.handle({ type: "caption", caption: merged.transcript.caption });
      });
    return () => {
      alive = false;
      browser.runtime.onMessage.removeListener(onMessage);
      if (engine) browser.storage.onChanged.removeListener(onSettings);
    };
  }, [translate]);

  return { snap, loaded, capturing: isCapturing(snap.transcript.status), setCaptionOverride };
}

/** The active tab of this window; refreshed when the user switches or navigates tabs. */
export function useActiveTab() {
  const [tab, setTab] = useState<Browser.tabs.Tab | null>(null);

  useEffect(() => {
    let alive = true;
    const refresh = () =>
      void browser.tabs
        .query({ active: true, currentWindow: true })
        .then(([t]) => alive && setTab(t ?? null))
        .catch(() => undefined);
    refresh();
    const onUpdated = (_id: number, info: Browser.tabs.OnUpdatedInfo, t: Browser.tabs.Tab) => {
      if (t.active && (info.url || info.title || info.status)) refresh();
    };
    browser.tabs.onActivated.addListener(refresh);
    browser.tabs.onUpdated.addListener(onUpdated);
    browser.windows?.onFocusChanged.addListener(refresh);
    return () => {
      alive = false;
      browser.tabs.onActivated.removeListener(refresh);
      browser.tabs.onUpdated.removeListener(onUpdated);
      browser.windows?.onFocusChanged.removeListener(refresh);
    };
  }, []);

  return tab;
}

export function useCaptionSettings() {
  const [settings, setSettings] = useState<CaptionSettings | null>(null);

  useEffect(() => {
    void getCaptionSettings().then(setSettings);
    const onChanged = (changes: Record<string, unknown>, area: string) => {
      if (area === "local" && STORAGE_KEYS.captionSettings in changes) void getCaptionSettings().then(setSettings);
    };
    browser.storage.onChanged.addListener(onChanged);
    return () => browser.storage.onChanged.removeListener(onChanged);
  }, []);

  const update = useCallback((next: CaptionSettings) => {
    setSettings(next);
    void browser.storage.local.set({ [STORAGE_KEYS.captionSettings]: { ...next, position: "overlay" } });
  }, []);

  return [settings, update] as const;
}

export function useServerUrl() {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    void getServerUrl().then(setUrl);
    const onChanged = (changes: Record<string, unknown>, area: string) => {
      if (area === "local" && STORAGE_KEYS.serverUrl in changes) void getServerUrl().then(setUrl);
    };
    browser.storage.onChanged.addListener(onChanged);
    return () => browser.storage.onChanged.removeListener(onChanged);
  }, []);
  return url;
}

/**
 * Whether the user saved their own Deepgram key. Only the masked form leaves this hook;
 * `loaded` is false until storage has been read.
 */
export function useUserKey() {
  const [state, setState] = useState<{ loaded: boolean; masked: string | null }>({ loaded: false, masked: null });
  useEffect(() => {
    const read = () => void getUserKey().then((key) => setState({ loaded: true, masked: key ? maskKey(key) : null }));
    read();
    const onChanged = (changes: Record<string, unknown>, area: string) => {
      if (area === "local" && STORAGE_KEYS.deepgramKey in changes) read();
    };
    browser.storage.onChanged.addListener(onChanged);
    return () => browser.storage.onChanged.removeListener(onChanged);
  }, []);
  return { loaded: state.loaded, hasKey: state.masked !== null, masked: state.masked };
}

/** Probe the Heard server (only when `enabled`, i.e. the user has no key of their own). */
export function useServerStatus(serverUrl: string | null, enabled: boolean) {
  const [status, setStatus] = useState<ServerStatus | "checking" | null>(null);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (!serverUrl || !enabled) {
      setStatus(null);
      return;
    }
    let alive = true;
    setStatus("checking");
    void probeServer(serverUrl).then((s) => alive && setStatus(s));
    return () => {
      alive = false;
    };
  }, [serverUrl, enabled, nonce]);
  return { status, recheck: useCallback(() => setNonce((n) => n + 1), []) };
}

/** No key of our own and the server can't help: the user must add a key before captions can work. */
export function needsKey(hasKey: boolean, server: ServerStatus | "checking" | null): boolean {
  return !hasKey && (server === "unreachable" || server === "no_server_key");
}

/** Start/stop/show-overlay commands with pending + error state. */
export function useCommands() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<CommandError | null>(null);

  const run = useCallback(async (fn: () => Promise<CommandResult>) => {
    setPending(true);
    setError(null);
    try {
      const res = await fn();
      if (!res?.ok) setError(res?.error ?? { code: "unknown" });
      return Boolean(res?.ok);
    } catch (err) {
      setError({ code: "unknown", detail: errorMessage(err) });
      return false;
    } finally {
      setPending(false);
    }
  }, []);

  return {
    pending,
    /** Why the last command failed; show it with `describeError`. */
    error,
    clearError: () => setError(null),
    start: (tabId: number) => run(() => sendToBackground({ to: "background", type: "start", tabId })),
    stop: () => run(() => sendToBackground({ to: "background", type: "stop" })),
    showOverlay: () => run(() => sendToBackground({ to: "background", type: "show-overlay" })),
  };
}
