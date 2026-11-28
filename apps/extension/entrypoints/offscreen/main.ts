/**
 * Offscreen document: the only place audio is touched, and the source of truth for the
 * session (the MV3 service worker may be suspended at any time; this page is not).
 *
 * tab audio (tabCapture stream id) → getUserMedia → TranscriptionSession (@heard/shared)
 * → TranscriptEvents broadcast to the background (relays to the overlay) and to the
 * popup / side panel. Transcripts live in memory only.
 *
 * Live dubbing plays here too: the side panel sends translated phrases over a port, and
 * Flux TTS audio comes out of this page. tabCapture only records the captured tab, so the
 * dub is never transcribed again. The original audio is routed back to the speakers
 * through a gain node, which ducks it without changing what Deepgram hears.
 *
 * While dubbing, transcription asks Deepgram for speaker labels, and this page measures
 * each speaker's pitch from the audio it already has, so every speaker gets a fitting voice.
 */
import { browser, type Browser } from "wxt/browser";
import {
  createTokenFetcher,
  DUB_ORIGINAL_VOLUME,
  DubOutput,
  INITIAL_DUB_STATE,
  initialTranscriptState,
  reduceTranscript,
  SpeakerPitch,
  TranscriptionSession,
  type DeepgramCredential,
  type DubState,
} from "@heard/shared";
import {
  broadcast,
  DUB_PORT,
  errorMessage,
  isRuntimeMessage,
  unknownError,
  type CommandResult,
  type DubPortEvent,
  type DubPortRequest,
  type OffscreenRequest,
  type OffscreenResponses,
  type SessionSnapshot,
} from "@/utils/messages";

let session: TranscriptionSession | null = null;
let transcript = initialTranscriptState();
let meta: Pick<SessionSnapshot, "tabId" | "tabTitle" | "overlayHidden"> = { tabId: null, tabTitle: null, overlayHidden: false };


let dub: DubOutput | null = null;
let dubState: DubState = INITIAL_DUB_STATE;
/** Dubbing language and accent while dubbing is on, else null. */
let voice: { language: string; accent: string } | null = null;
/** How low or high each speaker sounds (from the audio sent for transcription). */
const pitch = new SpeakerPitch();
/** The side panel driving dubbing; dubbing ends when it closes. */
let dubPort: Browser.runtime.Port | null = null;
/** Bumped on every clear; phrases from an older epoch are outdated. */
let epoch = 0;

function setDubState(next: DubState) {
  dubState = next;
  broadcast({ to: "broadcast", type: "dub-state", dub: next });
  // Original audio is only ducked while dubbing actually works.
  applyOriginalVolume();
}

function applyOriginalVolume() {
  const ducked = voice !== null && dubState.status !== "off" && dubState.status !== "unavailable";
  session?.setPlaybackVolume(ducked ? DUB_ORIGINAL_VOLUME : 1);
}

function createDub(getToken: () => Promise<DeepgramCredential | string>) {
  void dub?.close();
  voice = null;
  pitch.clear();
  dub = new DubOutput({ getToken, onState: setDubState, pitchOf: (speaker) => pitch.get(speaker) });
  setDubState(INITIAL_DUB_STATE);
}

function stopDubbing() {
  voice = null;
  session?.setDiarize(false);
  dub?.disable();
  applyOriginalVolume();
}

function clearDub() {
  epoch += 1;
  dub?.clear();
  const msg: DubPortEvent = { type: "epoch", epoch };
  try {
    dubPort?.postMessage(msg);
  } catch {
    /* panel closed */
  }
}

function onDubMessage(port: Browser.runtime.Port, msg: DubPortRequest) {
  if (!dub || !session) return;
  switch (msg.type) {
    case "enable": {
      dubPort = port;
      const changed = voice?.language !== msg.language || voice?.accent !== msg.accent;
      voice = { language: msg.language, accent: msg.accent };
      if (changed) clearDub();
      // Speaker labels, so each speaker can get their own voice.
      session.setDiarize(true);
      dub.enable(msg.language, msg.accent);
      applyOriginalVolume();
      break;
    }
    case "disable":
      if (port === dubPort) dubPort = null;
      stopDubbing();
      break;
    case "translating":
      dub.setTranslating(msg.busy);
      break;
    case "segment":
      if (msg.epoch === epoch) dub.speak(msg.segment);
      break;
    case "clear":
      clearDub();
      break;
  }
}

browser.runtime.onConnect.addListener((port) => {
  if (port.name !== DUB_PORT) return;
  // Tell the panel which epoch its phrases belong to.
  port.postMessage({ type: "epoch", epoch } satisfies DubPortEvent);
  port.onMessage.addListener((msg: unknown) => onDubMessage(port, msg as DubPortRequest));
  port.onDisconnect.addListener(() => {
    if (port !== dubPort) return;
    // No panel, no translations: don't leave the user with a ducked, silent tab.
    dubPort = null;
    stopDubbing();
  });
});

function snapshot(): SessionSnapshot {
  return { ...meta, transcript, dub: dubState };
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
    return { ok: false, error: { code: "tab_audio_failed", detail: errorMessage(err) } };
  }

  const tabId = msg.tabId;
  setMeta({ tabId, tabTitle: msg.tabTitle, overlayHidden: false });
  // A user key is used directly (Deepgram's `token` subprotocol); no Heard server involved.
  // Otherwise each (re)connect fetches a short-lived JWT from the Heard server. Dubbing's
  // speech synthesis authenticates the same way.
  const getToken =
    msg.credential.kind === "user-key" ? userKeyCredential(msg.credential.userKey) : createTokenFetcher(msg.credential.tokenEndpoint);
  createDub(getToken);
  const s = new TranscriptionSession({
    getToken,
    workletUrl: browser.runtime.getURL("/pcm-worklet.js"),
    // chrome.tabCapture mutes the tab for the user; route the audio back to the speakers.
    preservePlayback: true,
    onAudio: (pcm, at) => {
      if (voice) pitch.addAudio(pcm, at);
    },
    onEvent: (event) => {
      // Measure each speaker's pitch while their words are still in the recent audio.
      if (voice && event.type === "line" && event.line.speaker) pitch.measure(event.line.speaker, event.line.start, event.line.end);
      transcript = reduceTranscript(transcript, event);
      broadcast({ to: "broadcast", type: "transcript-event", tabId, event });
    },
  });
  // Only the spoken language matters here. Chrome's translator refuses to run in this hidden
  // page, so the side panel translates (see useSession in components/hooks.ts).
  s.setLanguages(msg.languages.spoken, "");
  session = s;
  // start() resolves after the first connect attempt; failures surface as status events.
  void s.start(stream);
  return { ok: true };
}

async function stop(): Promise<CommandResult> {
  const s = session;
  session = null;
  dubPort = null;
  voice = null;
  const d = dub;
  dub = null;
  await d?.close();
  if (dubState.status !== "off") setDubState(INITIAL_DUB_STATE);
  if (s) await s.stop();
  return { ok: true };
}

function mediaState(msg: Extract<OffscreenRequest, { type: "media-state" }>): CommandResult {
  if (msg.discontinuity) clearDub();
  if (msg.paused !== undefined) dub?.setPaused(msg.paused);
  return { ok: true };
}

browser.runtime.onMessage.addListener((msg: unknown, _sender, sendResponse) => {
  if (!isRuntimeMessage(msg) || msg.to !== "offscreen") return;
  const reply = <K extends OffscreenRequest["type"]>(_type: K, value: OffscreenResponses[K] | Promise<OffscreenResponses[K]>) => {
    Promise.resolve(value).then(sendResponse, (err) => sendResponse(unknownError(err)));
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
      session?.setLanguages(msg.languages.spoken, "");
      return reply("set-languages", { ok: true });
    case "set-overlay-hidden":
      setMeta({ overlayHidden: msg.hidden });
      return reply("set-overlay-hidden", { ok: true });
    case "media-state":
      return reply("media-state", mediaState(msg));
  }
});
