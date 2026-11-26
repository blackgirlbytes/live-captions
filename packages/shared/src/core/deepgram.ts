import { PCM_TARGET_SAMPLE_RATE } from "./audio";
import type { DeepgramCredential, DeepgramStreamOptions } from "./types";
import type { DgResults } from "./transcript";

export const DEEPGRAM_LISTEN_URL = "wss://api.deepgram.com/v1/listen";

/** Build the Nova-3 streaming URL for 16 kHz mono linear16 audio. */
export function buildListenUrl(opts: DeepgramStreamOptions = {}, base = DEEPGRAM_LISTEN_URL): string {
  const p = new URLSearchParams({
    model: opts.model ?? "nova-3",
    language: opts.language ?? "en",
    encoding: "linear16",
    sample_rate: String(PCM_TARGET_SAMPLE_RATE),
    channels: "1",
    interim_results: "true",
    smart_format: "true",
    endpointing: "300",
    utterance_end_ms: "1000",
    vad_events: "true",
  });
  for (const term of opts.keyterms ?? []) if (term.trim()) p.append("keyterm", term.trim());
  return `${base}?${p.toString()}`;
}

export type DeepgramServerMessage =
  | DgResults
  | { type: "UtteranceEnd"; last_word_end?: number }
  | { type: "SpeechStarted"; timestamp?: number }
  | { type: "Metadata"; request_id?: string }
  | { type: "Error" | "Warning"; description?: string; message?: string; code?: string; err_code?: string }
  | { type: string; [k: string]: unknown };

export interface DeepgramSocketHandlers {
  onOpen: () => void;
  onMessage: (msg: DeepgramServerMessage) => void;
  onClose: (info: { code: number; reason: string; wasOpen: boolean }) => void;
}

/**
 * Thin wrapper around a browser WebSocket to Deepgram's /v1/listen.
 *
 * Browsers cannot set an Authorization header on WebSockets, so credentials go in the
 * subprotocol — the same mechanism the official @deepgram/sdk uses in the browser:
 * `["bearer", jwt]` for server-minted tokens, `["token", apiKey]` for a user's own key.
 */
export class DeepgramSocket {
  private ws: WebSocket;
  private opened = false;
  private closedByUs = false;

  constructor(credential: DeepgramCredential, url: string, private readonly handlers: DeepgramSocketHandlers) {
    this.ws = new WebSocket(url, [credential.type, credential.value]);
    this.ws.binaryType = "arraybuffer";
    this.ws.onopen = () => {
      this.opened = true;
      handlers.onOpen();
    };
    this.ws.onmessage = (e) => {
      if (typeof e.data !== "string") return;
      try {
        handlers.onMessage(JSON.parse(e.data) as DeepgramServerMessage);
      } catch {
        /* ignore malformed frames */
      }
    };
    this.ws.onclose = (e) => handlers.onClose({ code: e.code, reason: e.reason, wasOpen: this.opened });
    this.ws.onerror = () => {
      /* onclose always follows with details */
    };
  }

  get isOpen(): boolean {
    return this.ws.readyState === WebSocket.OPEN;
  }

  get isClosedByUs(): boolean {
    return this.closedByUs;
  }

  sendAudio(pcm: ArrayBuffer): boolean {
    if (!this.isOpen) return false;
    this.ws.send(pcm);
    return true;
  }

  /** Control messages must be text frames. */
  private control(type: "KeepAlive" | "Finalize" | "CloseStream") {
    if (this.isOpen) this.ws.send(JSON.stringify({ type }));
  }

  keepAlive() {
    this.control("KeepAlive");
  }

  /** Flush the current partial as a final result without closing. */
  finalize() {
    this.control("Finalize");
  }

  /** Ask Deepgram to flush and close; resolves once closed (or after a timeout). */
  async closeGracefully(timeoutMs = 5000): Promise<void> {
    this.closedByUs = true;
    if (this.ws.readyState === WebSocket.CLOSED) return;
    if (this.ws.readyState === WebSocket.CONNECTING) {
      this.ws.close();
      return;
    }
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        this.ws.close(1000);
        resolve();
      }, timeoutMs);
      this.ws.addEventListener("close", () => {
        clearTimeout(timer);
        resolve();
      });
      this.control("CloseStream");
    });
  }

  abort() {
    this.closedByUs = true;
    try {
      this.ws.close(1000);
    } catch {
      /* noop */
    }
  }
}

/** Human-readable explanation for a socket close. */
export function describeClose(code: number, reason: string, wasOpen: boolean): string {
  if (reason) return `Deepgram closed the connection: ${reason}`;
  if (!wasOpen) return "Could not connect to Deepgram. Check your network connection.";
  if (code === 1008) return "Deepgram rejected the stream (policy violation).";
  if (code === 1011) return "Deepgram timed out waiting for audio.";
  return `Connection to Deepgram lost (code ${code}).`;
}

/** Cheap shape check for a pasted Deepgram API key (they are 40 hex characters today). */
export function looksLikeDeepgramKey(key: string): boolean {
  return /^[A-Za-z0-9_-]{32,128}$/.test(key.trim());
}

export type KeyCheckResult = "ok" | "rejected" | "offline";

/**
 * Verify a user's Deepgram key from the browser by briefly opening a streaming socket.
 * (Deepgram's REST API doesn't allow browser CORS, so the socket is the only browser-side check.)
 * A rejected key fails the handshake with HTTP 401, which browsers surface as a close before open.
 */
export function verifyDeepgramKey(key: string, timeoutMs = 8000): Promise<KeyCheckResult> {
  return new Promise((resolve) => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) return resolve("offline");
    let done = false;
    const finish = (r: KeyCheckResult) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(r);
    };
    let ws: WebSocket;
    try {
      ws = new WebSocket(buildListenUrl(), ["token", key.trim()]);
    } catch {
      return resolve("rejected");
    }
    const timer = setTimeout(() => {
      try {
        ws.close();
      } catch {
        /* noop */
      }
      finish("offline");
    }, timeoutMs);
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "CloseStream" }));
      ws.close(1000);
      finish("ok");
    };
    ws.onerror = () => finish(typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "rejected");
    ws.onclose = () => finish("rejected");
  });
}
