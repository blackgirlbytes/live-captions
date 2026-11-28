/**
 * Deepgram Flux TTS over the streaming `/v2/speak` WebSocket.
 *
 * One persistent socket per voice: each phrase is one turn (`Speak` + `Flush`), and raw
 * linear16 audio streams back as binary frames while the turn is synthesized. The server
 * handles turns in order, so audio frames map to phrases first-in, first-out using its
 * `SpeechStarted` / `SpeechMetadata` markers.
 *
 * Auth is the same as speech-to-text: browsers can't set headers on a WebSocket, so the
 * credential goes in the subprotocol (`["bearer", jwt]` or `["token", userKey]`).
 */
import type { DeepgramCredential } from "../types";
import type { DubSegment } from "./types";

export const DEEPGRAM_SPEAK_V2_URL = "wss://api.deepgram.com/v2/speak";
export const DUB_SAMPLE_RATE = 24000;

export function buildSpeakUrl(voice: string, base = DEEPGRAM_SPEAK_V2_URL, sampleRate = DUB_SAMPLE_RATE): string {
  const p = new URLSearchParams({ model: voice, encoding: "linear16", sample_rate: String(sampleRate) });
  return `${base}?${p.toString()}`;
}

export type SpeakerStatus = "idle" | "connecting" | "open" | "reconnecting" | "failed";

export interface FluxSpeakerOptions {
  voice: string;
  /** Called for every (re)connect, like the transcription session's `getToken`. */
  getToken: () => Promise<string | DeepgramCredential>;
  /** PCM16 mono audio for a phrase, in order. */
  onAudio: (seq: number, pcm: Int16Array) => void;
  /**
   * No more audio will come for a phrase: it finished, was merged into another phrase's
   * turn, or was dropped (connection lost, reset, failure). Called once per phrase.
   */
  onTurnEnd?: (seq: number) => void;
  onStatus?: (status: SpeakerStatus, error: string | null) => void;
  baseUrl?: string;
  sampleRate?: number;
  maxReconnectAttempts?: number;
  /** Close the socket after this long without phrases (the server closes idle ones at 60 s). */
  idleCloseMs?: number;
  /**
   * Keep a connection open and ready instead of connecting on the first phrase: `warm()`
   * opens it, and it's reopened quietly after the server closes an idle one or after a reset.
   * Opening a connection isn't billed; only spoken characters are.
   */
  keepWarm?: boolean;
  /** At most this many turns per minute; extra phrases are merged into the next turn. */
  maxTurnsPerMinute?: number;
  /** Injected for tests. */
  WebSocketImpl?: typeof WebSocket;
}

interface Turn {
  seq: number;
  /** Every phrase merged into this turn (audio is reported under the first). */
  seqs: number[];
}

type ServerMessage = { type: string; code?: string; description?: string; speech_id?: string };

export class FluxSpeaker {
  private ws: WebSocket | null = null;
  private queued: DubSegment[] = [];
  private turns: Turn[] = [];
  private current: Turn | null = null;
  private attempts = 0;
  private everOpened = false;
  private closed = false;
  private status: SpeakerStatus = "idle";
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private turnTimer: ReturnType<typeof setTimeout> | null = null;
  private turnTimes: number[] = [];
  private oddByte: number | null = null;
  private lastError: string | null = null;

  constructor(private readonly opts: FluxSpeakerOptions) {}

  get voice(): string {
    return this.opts.voice;
  }

  /** Open the connection now so the first phrase doesn't wait for it. */
  warm(quiet = false): void {
    if (this.closed || this.status === "failed" || this.ws || this.reconnectTimer) return;
    void this.connect(quiet);
  }

  /** Queue a phrase; connects on demand. */
  speak(segment: DubSegment): void {
    if (this.closed || this.status === "failed") return;
    this.queued.push(segment);
    this.touch();
    if (this.ws?.readyState === 1) this.pump();
    else if (!this.ws && !this.reconnectTimer) void this.connect();
  }

  /**
   * Drop everything queued or being synthesized (seek, stale backlog). Flux has no "clear"
   * message, so the socket is closed and the next phrase opens a fresh one.
   */
  reset(): void {
    this.dropPending();
    this.dropSocket();
    if (this.status !== "failed") this.setStatus("idle");
    if (this.opts.keepWarm) this.warm(true);
  }

  /** Stop for good. */
  close(): void {
    this.closed = true;
    this.dropPending();
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.dropSocket();
  }

  /* ----------------------------- internals ----------------------------- */

  /** Forget every phrase not yet fully spoken, telling the player they're over. */
  private dropPending() {
    const seqs = [...(this.current?.seqs ?? []), ...this.turns.flatMap((t) => t.seqs), ...this.queued.map((q) => q.seq)];
    this.queued = [];
    this.turns = [];
    this.current = null;
    for (const seq of seqs) this.opts.onTurnEnd?.(seq);
  }

  private endTurn(turn: Turn) {
    for (const seq of turn.seqs) this.opts.onTurnEnd?.(seq);
  }

  private setStatus(status: SpeakerStatus, error: string | null = null) {
    if (status === this.status && error === this.lastError) return;
    this.status = status;
    this.lastError = error;
    this.opts.onStatus?.(status, error);
  }

  private dropSocket() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.turnTimer) clearTimeout(this.turnTimer);
    this.reconnectTimer = null;
    this.turnTimer = null;
    const ws = this.ws;
    this.ws = null;
    this.oddByte = null;
    if (ws) {
      ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
      try {
        if (ws.readyState === 1) ws.send(JSON.stringify({ type: "Close" }));
        ws.close(1000);
      } catch {
        /* already closing */
      }
    }
  }

  private touch() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (this.opts.keepWarm) return;
    this.idleTimer = setTimeout(() => {
      if (this.queued.length === 0 && this.turns.length === 0 && !this.current) {
        this.dropSocket();
        if (this.status !== "failed") this.setStatus("idle");
      } else this.touch();
    }, this.opts.idleCloseMs ?? 45_000);
  }

  /** `quiet`: a background (re)open; the UI keeps showing its current status. */
  private async connect(quiet = false) {
    if (this.closed) return;
    if (!quiet) this.setStatus(this.attempts === 0 ? "connecting" : "reconnecting", this.attempts === 0 ? null : this.lastError);
    let credential: DeepgramCredential;
    try {
      const token = await this.opts.getToken();
      credential = typeof token === "string" ? { type: "bearer", value: token } : token;
    } catch (err) {
      return this.retry((err as Error).message, (err as { fatal?: boolean }).fatal === true);
    }
    if (this.closed || this.ws) return;

    const WS = this.opts.WebSocketImpl ?? WebSocket;
    const ws = new WS(buildSpeakUrl(this.opts.voice, this.opts.baseUrl, this.opts.sampleRate), [credential.type, credential.value]);
    ws.binaryType = "arraybuffer";
    this.ws = ws;
    let opened = false;
    let openedAt = 0;
    let serverError: string | null = null;

    ws.onopen = () => {
      opened = true;
      openedAt = Date.now();
      this.everOpened = true;
      this.attempts = 0;
      this.setStatus("open");
      this.pump();
    };
    ws.onmessage = (e: MessageEvent) => {
      if (this.ws !== ws) return;
      if (typeof e.data === "string") {
        let msg: ServerMessage;
        try {
          msg = JSON.parse(e.data) as ServerMessage;
        } catch {
          return;
        }
        if (msg.type === "Error") serverError = msg.description ? `Deepgram: ${msg.description}` : `Deepgram error ${msg.code ?? ""}`.trim();
        this.onControl(msg);
      } else {
        this.onBinary(e.data as ArrayBuffer);
      }
    };
    ws.onerror = () => {
      /* onclose follows */
    };
    ws.onclose = (e: CloseEvent) => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.oddByte = null;
      // Turns in flight are lost: re-sending them could repeat words already played.
      const lost = [...(this.current ? [this.current] : []), ...this.turns];
      this.turns = [];
      this.current = null;
      for (const turn of lost) this.endTurn(turn);
      // Nothing waiting (e.g. the server closed a quiet socket, NET-0004): reconnect on the next phrase.
      if (opened && this.queued.length === 0) {
        // Keep one ready, unless it died right away (don't spin on a socket that won't stay up).
        if (this.opts.keepWarm && Date.now() - openedAt >= 10_000) {
          void this.connect(true);
          return;
        }
        this.setStatus("idle");
        return;
      }
      if (!opened && !this.everOpened && credential.type === "token") {
        return this.retry("Deepgram didn't accept your API key for speech synthesis.", true);
      }
      const reason = serverError ?? (e.reason ? `Deepgram closed the speech connection: ${e.reason}` : opened ? `Speech connection lost (code ${e.code}).` : "Could not connect to Deepgram speech synthesis.");
      this.retry(reason, false);
    };
  }

  private retry(reason: string, fatal: boolean) {
    this.ws = null;
    this.attempts += 1;
    const max = this.opts.maxReconnectAttempts ?? 4;
    if (fatal || this.attempts > max) {
      this.dropPending();
      this.setStatus("failed", fatal ? reason : `${reason} Gave up after ${max} attempts.`);
      return;
    }
    this.lastError = reason;
    this.setStatus("reconnecting", reason);
    const delay = Math.min(400 * 2 ** (this.attempts - 1), 5000);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, delay);
  }

  /** Send queued phrases as turns, merging them when the turn budget is spent. */
  private pump() {
    const ws = this.ws;
    if (!ws || ws.readyState !== 1 || this.queued.length === 0) return;
    const now = Date.now();
    const limit = this.opts.maxTurnsPerMinute ?? 20;
    this.turnTimes = this.turnTimes.filter((t) => now - t < 60_000);
    if (this.turnTimes.length >= limit) {
      if (!this.turnTimer) {
        const wait = 60_000 - (now - this.turnTimes[0]!) + 10;
        this.turnTimer = setTimeout(() => {
          this.turnTimer = null;
          this.pump();
        }, wait);
      }
      return;
    }
    // Everything waiting goes out as one turn (usually that's a single phrase).
    const batch = this.queued;
    this.queued = [];
    const text = batch.map((s) => s.text).join(" ");
    this.turns.push({ seq: batch[0]!.seq, seqs: batch.map((s) => s.seq) });
    this.turnTimes.push(now);
    ws.send(JSON.stringify({ type: "Speak", text }));
    ws.send(JSON.stringify({ type: "Flush" }));
  }

  private onControl(msg: ServerMessage) {
    switch (msg.type) {
      case "SpeechStarted":
        this.current = this.turns.shift() ?? this.current;
        break;
      case "SpeechMetadata": {
        const turn = this.current ?? this.turns.shift();
        this.current = null;
        this.oddByte = null;
        if (turn) this.endTurn(turn);
        this.touch();
        break;
      }
      case "Warning":
        // A turn with nothing to say produces no audio and no SpeechStarted: forget it.
        if (!this.current && (msg.code === "NO_SYNTHESIZABLE_TEXT" || msg.code === "NO_AUDIO_GENERATED")) {
          const turn = this.turns.shift();
          if (turn) this.endTurn(turn);
        }
        break;
    }
  }

  private onBinary(data: ArrayBuffer) {
    if (!this.current) this.current = this.turns.shift() ?? null;
    const turn = this.current;
    if (!turn) return;
    let bytes = new Uint8Array(data);
    // Keep 16-bit samples whole if a frame ever splits one.
    if (this.oddByte !== null) {
      const joined = new Uint8Array(bytes.length + 1);
      joined[0] = this.oddByte;
      joined.set(bytes, 1);
      bytes = joined;
      this.oddByte = null;
    }
    if (bytes.length % 2 === 1) {
      this.oddByte = bytes[bytes.length - 1]!;
      bytes = bytes.subarray(0, bytes.length - 1);
    }
    if (bytes.length === 0) return;
    const pcm = new Int16Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length));
    this.opts.onAudio(turn.seq, pcm);
  }
}
