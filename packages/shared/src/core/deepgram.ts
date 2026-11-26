import { PCM_TARGET_SAMPLE_RATE } from "./audio";
import type { DeepgramStreamOptions } from "./types";
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
 * Browsers cannot set an Authorization header on WebSockets, so the short-lived JWT
 * from POST /v1/auth/grant is passed as the `bearer` subprotocol — the same mechanism
 * the official @deepgram/sdk uses in the browser. The permanent API key never reaches
 * the client.
 */
export class DeepgramSocket {
  private ws: WebSocket;
  private opened = false;
  private closedByUs = false;

  constructor(accessToken: string, url: string, private readonly handlers: DeepgramSocketHandlers) {
    this.ws = new WebSocket(url, ["bearer", accessToken]);
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
  if (!wasOpen) return "Could not connect to Deepgram. Check your network connection and API key.";
  if (code === 1008) return "Deepgram rejected the stream (policy violation).";
  if (code === 1011) return "Deepgram timed out waiting for audio.";
  return `Connection to Deepgram lost (code ${code}).`;
}
