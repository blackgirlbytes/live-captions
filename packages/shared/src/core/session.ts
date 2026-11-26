import { startPcmCapture, stopStream, PCM_TARGET_SAMPLE_RATE, type PcmCapture } from "./audio";
import { buildListenUrl, describeClose, DeepgramSocket, type DeepgramServerMessage } from "./deepgram";
import { StreamTimeMap } from "./time-map";
import { initialTranscriptState, reduceTranscript, TranscriptAssembler, type DgResults } from "./transcript";
import type { DeepgramCredential, DeepgramStreamOptions, TranscriptEvent, TranscriptState, TranscriptionStatus } from "./types";

/** Throw this from `getToken` when retrying cannot help (e.g. server has no API key). */
export class FatalTranscriptionError extends Error {
  readonly fatal = true;
}

export interface TranscriptionSessionOptions {
  /**
   * Returns the credential for each (re)connect: a short-lived JWT from an Earshot server
   * (a plain string is treated as a bearer JWT) or the user's own key (`{ type: "token" }`).
   */
  getToken: () => Promise<string | DeepgramCredential>;
  /** URL of the PCM AudioWorklet module (see PCM_WORKLET_SOURCE). */
  workletUrl: string;
  /** Re-route captured audio to the speakers (chrome.tabCapture mutes the tab otherwise). */
  preservePlayback?: boolean;
  /** Current media position (e.g. video currentTime) or null. Enables seekable timestamps. */
  getMediaTime?: () => number | null;
  deepgram?: DeepgramStreamOptions;
  /** Override for tests / regional endpoints. */
  listenBaseUrl?: string;
  /** Called with every transcript event (for forwarding across processes). */
  onEvent?: (event: TranscriptEvent) => void;
  maxReconnectAttempts?: number;
}

const KEEPALIVE_MS = 3000;
const MAX_BUFFER_SECONDS = 15;

interface BufferedChunk {
  pcm: ArrayBuffer;
  start: number;
}

/**
 * Owns one transcription run: audio capture → Deepgram socket → transcript assembly.
 * Provider-agnostic: give it any MediaStream with an audio track.
 */
export class TranscriptionSession {
  private state: TranscriptState = initialTranscriptState();
  private listeners = new Set<(s: TranscriptState) => void>();
  private assembler: TranscriptAssembler;
  private timeMap = new StreamTimeMap();

  private stream: MediaStream | null = null;
  private ownsStream = true;
  private capture: PcmCapture | null = null;
  private socket: DeepgramSocket | null = null;
  /** Absolute stream time of the first chunk sent on the current socket. */
  private connOffset: number | null = null;
  private streamSeconds = 0;
  private buffer: BufferedChunk[] = [];
  private gated = false;
  private running = false;
  private attempts = 0;
  /** Whether any socket opened during this run (a user key that never opens is likely invalid). */
  private everOpened = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null;
  private lastSentAt = 0;
  private readonly onOnline = () => {
    if (this.running && !this.socket && this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
      void this.connect();
    }
  };

  constructor(private readonly opts: TranscriptionSessionOptions) {
    this.assembler = this.createAssembler();
  }

  /* ----------------------------- public API ----------------------------- */

  getState(): TranscriptState {
    return this.state;
  }

  subscribe(listener: (s: TranscriptState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get isRunning(): boolean {
    return this.running;
  }

  /**
   * Start transcribing `stream`. If `ownsStream` (default) the stream's tracks are stopped
   * when the session stops.
   */
  async start(stream: MediaStream, { ownsStream = true, keepTranscript = false } = {}): Promise<void> {
    if (this.running) await this.stop();
    this.running = true;
    this.stream = stream;
    this.ownsStream = ownsStream;
    this.streamSeconds = 0;
    this.buffer = [];
    this.gated = false;
    this.attempts = 0;
    this.everOpened = false;
    this.timeMap.clear();
    this.assembler = this.createAssembler();
    if (keepTranscript) {
      this.dispatch({ type: "snapshot", state: { ...this.state, startedAt: this.state.startedAt ?? Date.now() } });
    } else {
      this.dispatch({ type: "reset", startedAt: Date.now() });
    }
    this.setStatus("connecting");

    try {
      this.capture = await startPcmCapture({
        stream,
        workletUrl: this.opts.workletUrl,
        preservePlayback: this.opts.preservePlayback,
        onChunk: (pcm) => this.onChunk(pcm),
        onEnded: () => void this.stop("Audio capture ended."),
      });
    } catch (err) {
      await this.fail((err as Error).message);
      return;
    }

    if (typeof window !== "undefined") window.addEventListener("online", this.onOnline);
    this.keepAliveTimer = setInterval(() => {
      if (this.socket?.isOpen && Date.now() - this.lastSentAt >= KEEPALIVE_MS) this.socket.keepAlive();
    }, 1000);

    await this.connect();
  }

  /**
   * Pause/resume streaming (e.g. when the video is paused). While paused no audio is
   * sent — the socket is kept alive with KeepAlive messages — so silence isn't billed.
   */
  setPaused(paused: boolean): void {
    if (!this.running || this.gated === paused) return;
    this.gated = paused;
    if (paused) {
      this.socket?.finalize();
      this.setStatus("paused");
    } else if (this.socket?.isOpen) {
      this.setStatus("live");
    }
  }

  /** The media jumped (seek). Flush pending text and clear the on-screen caption. */
  markDiscontinuity(): void {
    if (!this.running) return;
    this.socket?.finalize();
    this.assembler.flush({ clearCaption: true });
  }

  /** Stop capture and close the socket after Deepgram flushes final results. */
  async stop(errorMessage?: string): Promise<void> {
    if (!this.running) return;
    this.running = false;
    this.clearTimers();
    if (typeof window !== "undefined") window.removeEventListener("online", this.onOnline);

    const capture = this.capture;
    this.capture = null;
    await capture?.stop();

    const socket = this.socket;
    this.socket = null;
    if (socket) {
      // Keep processing messages that arrive while closing (final words).
      await socket.closeGracefully();
    }
    this.assembler.flush();
    this.buffer = [];
    if (this.ownsStream) stopStream(this.stream);
    this.stream = null;
    if (errorMessage) this.setStatus("error", errorMessage);
    else this.setStatus("idle");
  }

  /** Clear transcript lines (only while stopped). */
  clear(): void {
    if (this.running) return;
    this.dispatch({ type: "reset", startedAt: null });
  }

  /* ----------------------------- internals ----------------------------- */

  private createAssembler() {
    return new TranscriptAssembler((e) => this.dispatch(e), {
      mediaTimeAt: this.opts.getMediaTime ? (t) => this.timeMap.mediaAt(t) : undefined,
    });
  }

  private dispatch(event: TranscriptEvent) {
    this.state = reduceTranscript(this.state, event);
    this.opts.onEvent?.(event);
    for (const l of this.listeners) l(this.state);
  }

  private setStatus(status: TranscriptionStatus, error: string | null = null) {
    if (this.state.status === status && this.state.error === error) return;
    this.dispatch({ type: "status", status, error });
  }

  private onChunk(pcm: ArrayBuffer) {
    if (!this.running || this.gated) return;
    const start = this.streamSeconds;
    this.streamSeconds += pcm.byteLength / 2 / PCM_TARGET_SAMPLE_RATE;
    let media: number | null = null;
    try {
      media = this.opts.getMediaTime?.() ?? null;
    } catch {
      media = null;
    }
    this.timeMap.record(this.streamSeconds, media);

    if (this.socket?.isOpen) {
      this.send({ pcm, start });
    } else {
      this.buffer.push({ pcm, start });
      // Keep only the most recent contiguous audio while disconnected.
      while (this.buffer.length > 0 && this.streamSeconds - this.buffer[0]!.start > MAX_BUFFER_SECONDS) {
        this.buffer.shift();
      }
    }
  }

  private send(chunk: BufferedChunk) {
    if (!this.socket) return;
    if (this.connOffset === null) this.connOffset = chunk.start;
    if (this.socket.sendAudio(chunk.pcm)) this.lastSentAt = Date.now();
  }

  private async connect(): Promise<void> {
    if (!this.running) return;
    this.setStatus(this.attempts === 0 ? "connecting" : "reconnecting");

    let credential: DeepgramCredential;
    try {
      const token = await this.opts.getToken();
      credential = typeof token === "string" ? { type: "bearer", value: token } : token;
    } catch (err) {
      if ((err as FatalTranscriptionError).fatal) return this.fail((err as Error).message);
      return this.scheduleReconnect((err as Error).message);
    }
    if (!this.running) return;

    this.connOffset = null;
    const url = buildListenUrl(this.opts.deepgram, this.opts.listenBaseUrl);
    const socket = new DeepgramSocket(credential, url, {
      onOpen: () => {
        if (this.socket !== socket) return;
        this.everOpened = true;
        this.setStatus(this.gated ? "paused" : "live");
        const pending = this.buffer;
        this.buffer = [];
        for (const chunk of pending) this.send(chunk);
      },
      onMessage: (msg) => {
        if (this.socket !== socket && !socket.isClosedByUs) return;
        this.handleMessage(msg);
      },
      onClose: ({ code, reason, wasOpen }) => {
        if (socket.isClosedByUs || this.socket !== socket) return;
        this.socket = null;
        this.assembler.flush();
        if (wasOpen) this.attempts = 0;
        if (!wasOpen && !this.everOpened && credential.type === "token" && !(typeof navigator !== "undefined" && navigator.onLine === false)) {
          void this.fail("Deepgram didn't accept your API key. Check it in settings, or create a new one at console.deepgram.com.");
          return;
        }
        this.scheduleReconnect(describeClose(code, reason, wasOpen));
      },
    });
    this.socket = socket;
  }

  private connOffsetValue() {
    return this.connOffset ?? 0;
  }

  private handleMessage(msg: DeepgramServerMessage) {
    switch (msg.type) {
      case "Results":
        this.assembler.handleResults(msg as DgResults, this.connOffsetValue());
        if (this.attempts > 0) this.attempts = 0;
        break;
      case "UtteranceEnd":
        this.assembler.handleUtteranceEnd();
        break;
      default:
        break;
    }
  }

  private scheduleReconnect(reason: string) {
    if (!this.running) return;
    this.attempts += 1;
    const max = this.opts.maxReconnectAttempts ?? 6;
    if (this.attempts > max) {
      void this.fail(`${reason} Gave up after ${max} attempts.`);
      return;
    }
    this.setStatus("reconnecting", reason);
    const delay = Math.min(500 * 2 ** (this.attempts - 1), 8000);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, delay);
  }

  private async fail(message: string) {
    await this.stop(message);
    if (this.state.status !== "error") this.setStatus("error", message);
  }

  private clearTimers() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.keepAliveTimer) clearInterval(this.keepAliveTimer);
    this.reconnectTimer = null;
    this.keepAliveTimer = null;
  }
}
