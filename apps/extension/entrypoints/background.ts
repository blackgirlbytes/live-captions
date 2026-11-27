/**
 * Background service worker: orchestrates a single capture at a time.
 *
 * It keeps NO session state of its own — MV3 may suspend it at any moment. Whenever it
 * needs to know what's going on it asks the offscreen document (`get-state`), which is
 * the source of truth. Transcript events carry their tabId, so relaying them to the
 * captured tab's overlay needs no memory either.
 */
import { browser, type Browser } from "wxt/browser";
import { defineBackground } from "wxt/utils/define-background";
import { initialTranscriptState, type TranscriptEvent } from "@heard/shared";
import { getCaptionSettings, getServerUrl, getUserKey, probeServer, restrictedReason, STORAGE_KEYS, tokenEndpoint } from "@/utils/config";
import {
  errorMessage,
  isCapturing,
  isRuntimeMessage,
  sendToOffscreen,
  sendToOverlay,
  type BackgroundRequest,
  type BackgroundResponses,
  type CommandResult,
  type CredentialSource,
  type OverlayHello,
  type SessionLanguages,
  type SessionSnapshot,
} from "@/utils/messages";

const OFFSCREEN_PATH = "/offscreen.html";
const OVERLAY_SCRIPT = "/content-scripts/overlay.js";
const LIVE_COLOR = "#e5484d";

export default defineBackground(() => {
  /* ------------------------------ offscreen ------------------------------ */

  let creatingOffscreen: Promise<void> | null = null;

  async function hasOffscreen(): Promise<boolean> {
    const contexts = await browser.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT" as Browser.runtime.ContextType],
      documentUrls: [browser.runtime.getURL(OFFSCREEN_PATH)],
    });
    return contexts.length > 0;
  }

  async function ensureOffscreen(): Promise<void> {
    if (await hasOffscreen()) return;
    creatingOffscreen ??= browser.offscreen
      .createDocument({
        url: OFFSCREEN_PATH,
        reasons: ["USER_MEDIA" as Browser.offscreen.Reason],
        justification: "Capture the audio of the tab the user chose and stream it to Deepgram for live captions.",
      })
      .finally(() => {
        creatingOffscreen = null;
      });
    await creatingOffscreen;
  }

  async function closeOffscreen(): Promise<void> {
    if (await hasOffscreen()) await browser.offscreen.closeDocument().catch(() => undefined);
  }

  /** Re-learn the session from the offscreen document (survives service worker restarts). */
  async function getSnapshot(): Promise<SessionSnapshot> {
    if (creatingOffscreen) await creatingOffscreen.catch(() => undefined);
    if (await hasOffscreen()) {
      try {
        const snap = await sendToOffscreen({ to: "offscreen", type: "get-state" });
        if (snap) return snap;
      } catch {
        /* document is closing */
      }
    }
    return { tabId: null, tabTitle: null, overlayHidden: false, transcript: initialTranscriptState() };
  }

  /* ------------------------------ indicators ------------------------------ */

  async function setLiveBadge(tabId: number, live: boolean) {
    try {
      await browser.action.setBadgeText({ tabId, text: live ? "LIVE" : "" });
      if (live) {
        await browser.action.setBadgeBackgroundColor({ tabId, color: LIVE_COLOR });
        await browser.action.setBadgeTextColor?.({ tabId, color: "#ffffff" });
      }
      await browser.action.setTitle({
        tabId,
        title: live ? "Heard — capturing this tab's audio (click to stop)" : "Heard — Live AI Captions",
      });
    } catch {
      /* tab is gone */
    }
  }

  async function injectOverlay(tabId: number): Promise<boolean> {
    try {
      await browser.scripting.executeScript({ target: { tabId }, files: [OVERLAY_SCRIPT] });
      return true;
    } catch {
      // chrome:// pages, the Web Store, PDFs, or activeTab no longer granted after navigation.
      return false;
    }
  }

  /* ------------------------------ commands ------------------------------ */

  function explainCaptureError(err: unknown): string {
    const msg = errorMessage(err);
    if (/invoked|activeTab/i.test(msg)) {
      return "Chrome only allows capture after you use Heard on this tab. Click the Heard toolbar icon on this tab, then Start.";
    }
    if (/active stream/i.test(msg)) {
      return "This tab's audio is already being captured (by Heard or another extension). Stop that capture and try again.";
    }
    if (/chrome pages|cannot be captured/i.test(msg)) {
      return "Chrome doesn't allow capturing this page.";
    }
    return `Could not capture this tab: ${msg}`;
  }

  /**
   * The user's own key wins; otherwise the Heard server mints tokens. Without a key we
   * check the server first so a missing/keyless server is explained up front instead of
   * surfacing later as a network error. The key itself only travels background → offscreen.
   */
  async function resolveCredential(): Promise<{ ok: true; credential: CredentialSource } | Extract<CommandResult, { ok: false }>> {
    const userKey = await getUserKey();
    if (userKey) return { ok: true, credential: { kind: "user-key", userKey } };
    const serverUrl = await getServerUrl();
    const status = await probeServer(serverUrl);
    if (status === "unreachable") {
      return {
        ok: false,
        code: "needs_key",
        error: `Heard needs a Deepgram API key. Add your own key in settings (the Heard server at ${serverUrl} isn't reachable).`,
      };
    }
    if (status === "no_server_key") {
      return {
        ok: false,
        code: "needs_key",
        error: `Heard needs a Deepgram API key. Add your own key in settings (the Heard server at ${serverUrl} has no Deepgram key).`,
      };
    }
    return { ok: true, credential: { kind: "server", tokenEndpoint: tokenEndpoint(serverUrl) } };
  }

  async function start(tabId: number): Promise<CommandResult> {
    const tab = await browser.tabs.get(tabId).catch(() => null);
    if (!tab) return { ok: false, error: "That tab no longer exists." };
    const restricted = restrictedReason(tab.url);
    if (restricted) return { ok: false, error: restricted };

    const cred = await resolveCredential();
    if (!cred.ok) return cred;

    // One capture at a time: stop whatever is running (on this or another tab) first.
    const current = await getSnapshot();
    if (current.tabId !== null && isCapturing(current.transcript.status)) await stop();

    let streamId: string;
    try {
      streamId = await browser.tabCapture.getMediaStreamId({ targetTabId: tabId });
    } catch (err) {
      return { ok: false, error: explainCaptureError(err) };
    }

    try {
      await ensureOffscreen();
      const res = await sendToOffscreen({
        to: "offscreen",
        type: "start",
        streamId,
        tabId,
        tabTitle: tab.title ?? null,
        credential: cred.credential,
        languages: await currentLanguages(),
      });
      if (!res?.ok) {
        await closeOffscreen();
        return res ?? { ok: false, error: "The audio capture page did not respond." };
      }
    } catch (err) {
      await closeOffscreen();
      return { ok: false, error: `Could not start audio capture: ${errorMessage(err)}` };
    }

    await setLiveBadge(tabId, true);
    void injectOverlay(tabId);
    return { ok: true };
  }

  async function stop(): Promise<CommandResult> {
    const snap = await getSnapshot();
    if (await hasOffscreen()) {
      // session.stop() flushes final words and closes socket + audio before replying.
      await sendToOffscreen({ to: "offscreen", type: "stop" }).catch(() => undefined);
      await closeOffscreen();
    }
    if (snap.tabId !== null) {
      await setLiveBadge(snap.tabId, false);
      sendToOverlay(snap.tabId, { to: "overlay", type: "teardown" }).catch(() => undefined);
    }
    return { ok: true };
  }

  async function showOverlay(): Promise<CommandResult> {
    const snap = await getSnapshot();
    if (snap.tabId === null || !isCapturing(snap.transcript.status)) {
      return { ok: false, error: "Captions aren't running." };
    }
    await sendToOffscreen({ to: "offscreen", type: "set-overlay-hidden", hidden: false });
    try {
      await sendToOverlay(snap.tabId, { to: "overlay", type: "show" });
      return { ok: true };
    } catch {
      return (await injectOverlay(snap.tabId))
        ? { ok: true }
        : { ok: false, error: "Chrome didn't allow showing captions on this page. Use the transcript panel instead." };
    }
  }

  async function currentLanguages(): Promise<SessionLanguages> {
    const s = await getCaptionSettings();
    return { spoken: s.spokenLanguage, caption: s.captionLanguage };
  }

  async function overlayHello(tabId: number | undefined): Promise<OverlayHello> {
    const snap = await getSnapshot();
    const captured = tabId !== undefined && snap.tabId === tabId && isCapturing(snap.transcript.status);
    return {
      captured,
      hidden: snap.overlayHidden,
      status: snap.transcript.status,
      caption: captured ? snap.transcript.caption : null,
      captionTranslation: captured && snap.transcript.translation?.target ? snap.transcript.translation.caption : null,
    };
  }

  /* ------------------------------ relaying ------------------------------ */

  function relay(tabId: number | null, event: TranscriptEvent) {
    if (tabId === null) return;
    if (event.type === "status") {
      const live = isCapturing(event.status);
      void setLiveBadge(tabId, live);
      if (!live) sendToOverlay(tabId, { to: "overlay", type: "teardown" }).catch(() => undefined);
    }
    // The overlay only renders the caption + status; transcript lines stay in the panels.
    if (
      event.type === "caption" ||
      event.type === "status" ||
      event.type === "reset" ||
      event.type === "caption-translated" ||
      event.type === "translation-config"
    ) {
      sendToOverlay(tabId, { to: "overlay", type: "event", event }).catch(() => undefined);
    }
  }

  /* ------------------------------ listeners ------------------------------ */

  browser.runtime.onMessage.addListener((msg: unknown, sender, sendResponse) => {
    if (!isRuntimeMessage(msg)) return;
    if (msg.to === "broadcast") {
      if (msg.type === "transcript-event") relay(msg.tabId, msg.event);
      return;
    }
    if (msg.to !== "background") return;

    const reply = <K extends BackgroundRequest["type"]>(_type: K, value: Promise<BackgroundResponses[K]>) => {
      value.then(sendResponse, (err) => sendResponse({ ok: false, error: errorMessage(err) }));
      return true as const;
    };
    switch (msg.type) {
      case "start":
        return reply("start", start(msg.tabId));
      case "stop":
        return reply("stop", stop());
      case "get-state":
        return reply("get-state", getSnapshot());
      case "show-overlay":
        return reply("show-overlay", showOverlay());
      case "overlay-dismissed":
        return reply(
          "overlay-dismissed",
          getSnapshot().then(async (snap) => {
            if (snap.tabId === sender.tab?.id && (await hasOffscreen())) {
              await sendToOffscreen({ to: "offscreen", type: "set-overlay-hidden", hidden: true });
            }
            return { ok: true } as const;
          }),
        );
      case "overlay-hello":
        return reply("overlay-hello", overlayHello(sender.tab?.id));
    }
  });

  // Language changes in the side panel apply to the running session.
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !(STORAGE_KEYS.captionSettings in changes)) return;
    void (async () => {
      if (!(await hasOffscreen())) return;
      await sendToOffscreen({ to: "offscreen", type: "set-languages", languages: await currentLanguages() }).catch(() => undefined);
    })();
  });

  browser.tabs.onRemoved.addListener((tabId) => {
    void getSnapshot().then((snap) => {
      if (snap.tabId === tabId && isCapturing(snap.transcript.status)) void stop();
    });
  });

  // After a full navigation the overlay is gone (and Chrome resets per-tab badges).
  // tabCapture keeps streaming across navigations, so restore both when allowed.
  browser.tabs.onUpdated.addListener((tabId, info) => {
    if (info.status !== "complete") return;
    void getSnapshot().then(async (snap) => {
      if (snap.tabId !== tabId || !isCapturing(snap.transcript.status)) return;
      await setLiveBadge(tabId, true);
      if (!snap.overlayHidden) await injectOverlay(tabId);
    });
  });
});
