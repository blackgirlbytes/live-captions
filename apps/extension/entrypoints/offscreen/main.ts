/**
 * Offscreen document: the only place audio is touched, and the source of truth for the
 * session (the MV3 service worker may be suspended at any time; this page is not).
 *
 * tab audio (tabCapture stream id) → getUserMedia → TranscriptionSession (@heard/shared)
 * → TranscriptEvents broadcast to the background (relays to the overlay) and to the
 * popup / side panel. Transcripts live in memory only.
 */
import { browser } from "wxt/browser";
import {
  createTokenFetcher,
  initialTranscriptState,
  reduceTranscript,
  TranscriptionSession,
  type DeepgramCredential,
} from "@heard/shared";
import {
  broadcast,
  errorMessage,
  isRuntimeMessage,
  type CommandResult,
  type OffscreenRequest,
  type OffscreenResponses,
  type SessionSnapshot,
} from "@/utils/messages";

let session: TranscriptionSession | null = null;
let transcript = initialTranscriptState();
let meta: Pick<SessionSnapshot, "tabId" | "tabTitle" | "overlayHidden"> = { tabId: null, tabTitle: null, overlayHidden: false };

function snapshot(): SessionSnapshot {
  return { ...meta, transcript };
}

function setMeta(next: Partial<typeof meta>) {
  meta = { ...meta, ...next };
  broadcast({ to: "broadcast", type: "meta", meta });
}

function userKeyCredential(key: string): () => Promise<DeepgramCredential> {
  const credential: DeepgramCredential = { type: "token", value: key };
  return async () => credential;
}

async function start(msg: Extract<OffscreenRequest, { type: "start" }>): Promise<CommandResult> {
  await stop();

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: msg.streamId } },
      video: false,
    } as unknown as MediaStreamConstraints);
  } catch (err) {
    return { ok: false, error: `Could not capture the tab's audio: ${errorMessage(err)}` };
  }

  const tabId = msg.tabId;
  setMeta({ tabId, tabTitle: msg.tabTitle, overlayHidden: false });
  const s = new TranscriptionSession({
    // A user key is used directly (Deepgram's `token` subprotocol); no Heard server involved.
    // Otherwise each (re)connect fetches a short-lived JWT from the Heard server.
    getToken:
      msg.credential.kind === "user-key"
        ? userKeyCredential(msg.credential.userKey)
        : createTokenFetcher(msg.credential.tokenEndpoint),
    workletUrl: browser.runtime.getURL("/pcm-worklet.js"),
    // chrome.tabCapture mutes the tab for the user; route the audio back to the speakers.
    preservePlayback: true,
    onEvent: (event) => {
      transcript = reduceTranscript(transcript, event);
      broadcast({ to: "broadcast", type: "transcript-event", tabId, event });
    },
  });
  s.setLanguages(msg.languages.spoken, msg.languages.caption);
  session = s;
  // start() resolves after the first connect attempt; failures surface as status events.
  void s.start(stream);
  return { ok: true };
}

async function stop(): Promise<CommandResult> {
  const s = session;
  session = null;
  if (s) await s.stop();
  return { ok: true };
}

browser.runtime.onMessage.addListener((msg: unknown, _sender, sendResponse) => {
  if (!isRuntimeMessage(msg) || msg.to !== "offscreen") return;
  const reply = <K extends OffscreenRequest["type"]>(_type: K, value: OffscreenResponses[K] | Promise<OffscreenResponses[K]>) => {
    Promise.resolve(value).then(sendResponse, (err) => sendResponse({ ok: false, error: errorMessage(err) }));
    return true as const;
  };
  switch (msg.type) {
    case "start":
      return reply("start", start(msg));
    case "stop":
      return reply("stop", stop());
    case "get-state":
      return reply("get-state", snapshot());
    case "set-languages":
      session?.setLanguages(msg.languages.spoken, msg.languages.caption);
      return reply("set-languages", { ok: true });
    case "set-overlay-hidden":
      setMeta({ overlayHidden: msg.hidden });
      return reply("set-overlay-hidden", { ok: true });
  }
});
