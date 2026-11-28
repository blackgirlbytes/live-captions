import { useCallback, useEffect, useRef, useState } from "react";
import { browser, type Browser } from "wxt/browser";
import {
  AUTO_LANGUAGE,
  DEFAULT_DUB_SETTINGS,
  DubPhrasePipeline,
  normalizeDubSettings,
  prepareTranslator,
  type DubSettings,
  type TranscriptEvent,
  type TranslationIssue,
} from "@heard/shared";
import { STORAGE_KEYS } from "@/utils/config";
import { DUB_PORT, isRuntimeMessage, type DubPortEvent, type DubPortRequest, type SessionSnapshot } from "@/utils/messages";

/** Saved dubbing language and accent, shared by every open panel. */
export function useDubSettings() {
  const [settings, setSettings] = useState<DubSettings>(DEFAULT_DUB_SETTINGS);
  useEffect(() => {
    const read = () =>
      void browser.storage.local.get(STORAGE_KEYS.dubSettings).then((r) => setSettings(normalizeDubSettings(r[STORAGE_KEYS.dubSettings])));
    read();
    const onChanged = (changes: Record<string, unknown>, area: string) => {
      if (area === "local" && STORAGE_KEYS.dubSettings in changes) read();
    };
    browser.storage.onChanged.addListener(onChanged);
    return () => browser.storage.onChanged.removeListener(onChanged);
  }, []);
  const update = useCallback((next: DubSettings) => {
    const normalized = normalizeDubSettings(next);
    setSettings(normalized);
    void browser.storage.local.set({ [STORAGE_KEYS.dubSettings]: normalized });
  }, []);
  return [settings, update] as const;
}

/**
 * Live dubbing, side panel half. This page translates (Chrome's translator won't run in the
 * offscreen document), so it groups finished transcript lines into phrases, translates them,
 * and hands them to the offscreen document, which speaks and plays them. Closing the panel
 * closes the port, and the offscreen document then turns dubbing off and restores the audio.
 */
export function useDubbing({ snap, capturing, spokenLanguage }: { snap: SessionSnapshot; capturing: boolean; spokenLanguage: string }) {
  const [settings, setSettings] = useDubSettings();
  const [enabled, setEnabled] = useState(false);
  const [issue, setIssue] = useState<TranslationIssue | null>(null);
  const portRef = useRef<Browser.runtime.Port | null>(null);
  const epochRef = useRef(0);
  const enabledRef = useRef(false);
  enabledRef.current = enabled;

  const post = useCallback((msg: DubPortRequest) => {
    try {
      portRef.current?.postMessage(msg);
    } catch {
      /* offscreen document went away */
    }
  }, []);

  const [pipeline] = useState(
    () =>
      new DubPhrasePipeline({
        onSegment: (segment) => post({ type: "segment", epoch: epochRef.current, segment }),
        onTranslating: (busy) => post({ type: "translating", busy }),
        onIssue: setIssue,
      }),
  );

  // One port per capture session: the offscreen document is recreated for each one.
  useEffect(() => {
    if (!capturing) return;
    const port = browser.runtime.connect({ name: DUB_PORT });
    portRef.current = port;
    port.onMessage.addListener((msg: unknown) => {
      const m = msg as DubPortEvent;
      if (m?.type === "epoch") {
        epochRef.current = m.epoch;
        pipeline.clear();
      }
    });
    port.onDisconnect.addListener(() => {
      if (portRef.current === port) portRef.current = null;
      pipeline.stop();
      setEnabled(false);
    });
    return () => {
      portRef.current = null;
      port.disconnect();
      pipeline.stop();
      setEnabled(false);
    };
  }, [capturing, pipeline]);

  // Finished transcript lines come from the offscreen document's broadcasts.
  useEffect(() => {
    const onMessage = (msg: unknown) => {
      if (!isRuntimeMessage(msg) || msg.to !== "broadcast" || msg.type !== "transcript-event") return;
      pipeline.handle((msg as { event: TranscriptEvent }).event);
    };
    browser.runtime.onMessage.addListener(onMessage);
    return () => browser.runtime.onMessage.removeListener(onMessage);
  }, [pipeline]);

  // A new spoken or dubbing language makes queued speech outdated.
  useEffect(() => {
    pipeline.configure(spokenLanguage, settings.language);
    if (enabledRef.current) post({ type: "clear" });
  }, [pipeline, post, spokenLanguage, settings.language]);

  // A new accent applies live while dubbing.
  useEffect(() => {
    if (enabled) post({ type: "enable", language: settings.language, accent: settings.accent });
  }, [enabled, post, settings.language, settings.accent]);

  // The session ended or dubbing failed for good: reflect it here.
  useEffect(() => {
    if (enabled && snap.dub.status === "unavailable") pipeline.stop();
  }, [enabled, pipeline, snap.dub.status]);

  /** Call from the click handler: a translator download only starts during a user gesture. */
  const setDubbing = useCallback(
    (on: boolean) => {
      if (on) {
        if (!portRef.current) return;
        if (spokenLanguage !== AUTO_LANGUAGE) void prepareTranslator(spokenLanguage, settings.language);
        setIssue(null);
        pipeline.start();
        setEnabled(true);
      } else {
        pipeline.stop();
        post({ type: "disable" });
        setEnabled(false);
      }
    },
    [pipeline, post, settings.language, spokenLanguage],
  );

  return { settings, setSettings, enabled: enabled && capturing, setDubbing, issue, state: snap.dub };
}
