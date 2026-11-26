import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Replace real audio capture with a controllable fake.
const audio = vi.hoisted(() => ({ onChunk: null as null | ((b: ArrayBuffer) => void), onEnded: null as null | (() => void), stopped: 0 }));
vi.mock("../src/core/audio", async (orig) => {
  const actual = await orig<typeof import("../src/core/audio")>();
  return {
    ...actual,
    startPcmCapture: async (o: { onChunk: (b: ArrayBuffer) => void; onEnded: () => void }) => {
      audio.onChunk = o.onChunk;
      audio.onEnded = o.onEnded;
      return { sampleRate: 16000, stop: async () => void audio.stopped++ };
    },
  };
});

import { FatalTranscriptionError, TranscriptionSession } from "../src/core/session";

class FakeWS {
  static OPEN = 1;
  static CONNECTING = 0;
  static CLOSED = 3;
  static all: FakeWS[] = [];
  readyState = 0;
  sent: Array<ArrayBuffer | string> = [];
  binaryType = "blob";
  onopen?: () => void;
  onmessage?: (e: { data: string }) => void;
  onclose?: (e: { code: number; reason: string }) => void;
  onerror?: () => void;
  private listeners: Record<string, Array<() => void>> = {};
  constructor(public url: string, public protocols: string[]) {
    FakeWS.all.push(this);
  }
  addEventListener(t: string, f: () => void) {
    (this.listeners[t] ??= []).push(f);
  }
  send(d: ArrayBuffer | string) {
    this.sent.push(d);
    if (typeof d === "string" && JSON.parse(d).type === "CloseStream") queueMicrotask(() => this.serverClose(1000));
  }
  close() {
    this.serverClose(1000);
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  serverClose(code = 1006, reason = "") {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.onclose?.({ code, reason });
    this.listeners.close?.forEach((f) => f());
  }
  emit(msg: object) {
    this.onmessage?.({ data: JSON.stringify(msg) });
  }
  get audioFrames() {
    return this.sent.filter((d) => typeof d !== "string").length;
  }
}

const chunk = () => new ArrayBuffer(3200); // 100 ms of 16 kHz int16
const final = (text: string, start: number, speechFinal = true) => ({
  type: "Results",
  start,
  duration: 1,
  is_final: true,
  speech_final: speechFinal,
  channel: { alternatives: [{ transcript: text, words: text.split(" ").map((w, i) => ({ word: w, punctuated_word: w, start: start + i * 0.2, end: start + i * 0.2 + 0.15 })) }] },
});
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  FakeWS.all = [];
  vi.stubGlobal("WebSocket", FakeWS);
  audio.stopped = 0;
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function makeSession(extra: Partial<ConstructorParameters<typeof TranscriptionSession>[0]> = {}) {
  return new TranscriptionSession({ getToken: async () => "jwt-123", workletUrl: "x", ...extra });
}
const fakeStream = () => ({ getTracks: () => [{ stop: vi.fn() }], getAudioTracks: () => [{}] }) as unknown as MediaStream;

describe("TranscriptionSession", () => {
  it("authenticates with the bearer subprotocol and streams audio", async () => {
    const s = makeSession();
    await s.start(fakeStream());
    const ws = FakeWS.all[0]!;
    expect(ws.protocols).toEqual(["bearer", "jwt-123"]);
    expect(ws.url).toContain("model=nova-3");
    expect(s.getState().status).toBe("connecting");
    audio.onChunk!(chunk()); // buffered before open
    ws.open();
    expect(s.getState().status).toBe("live");
    audio.onChunk!(chunk());
    expect(ws.audioFrames).toBe(2);
    ws.emit(final("hello world", 0));
    expect(s.getState().lines.map((l) => l.text)).toEqual(["hello world"]);
    await s.stop();
    expect(s.getState().status).toBe("idle");
    expect(ws.sent.some((d) => d === JSON.stringify({ type: "CloseStream" }))).toBe(true);
    expect(audio.stopped).toBe(1);
  });

  it("reconnects with a fresh token, buffers audio meanwhile, and keeps timestamps monotonic", async () => {
    let n = 0;
    const s = makeSession({ getToken: async () => `jwt-${++n}` });
    await s.start(fakeStream());
    FakeWS.all[0]!.open();
    for (let i = 0; i < 10; i++) audio.onChunk!(chunk()); // 1 s
    FakeWS.all[0]!.emit(final("first", 0));
    vi.useFakeTimers();
    FakeWS.all[0]!.serverClose(1006);
    expect(s.getState().status).toBe("reconnecting");
    for (let i = 0; i < 5; i++) audio.onChunk!(chunk()); // buffered 0.5 s while offline
    await vi.advanceTimersByTimeAsync(600);
    const ws2 = FakeWS.all[1]!;
    expect(ws2.protocols).toEqual(["bearer", "jwt-2"]);
    ws2.open();
    expect(ws2.audioFrames).toBe(5);
    ws2.emit(final("second", 0.1));
    const lines = s.getState().lines;
    expect(lines.map((l) => l.text)).toEqual(["first", "second"]);
    expect(lines[1]!.start).toBeCloseTo(1.1, 3); // offset 1.0 + 0.1
    vi.useRealTimers();
    await s.stop();
  });

  it("does not send audio while paused and resumes after", async () => {
    const s = makeSession();
    await s.start(fakeStream());
    const ws = FakeWS.all[0]!;
    ws.open();
    s.setPaused(true);
    expect(s.getState().status).toBe("paused");
    audio.onChunk!(chunk());
    expect(ws.audioFrames).toBe(0);
    expect(ws.sent).toContain(JSON.stringify({ type: "Finalize" }));
    s.setPaused(false);
    audio.onChunk!(chunk());
    expect(ws.audioFrames).toBe(1);
    await s.stop();
  });

  it("stops with an error on a fatal token failure", async () => {
    const s = makeSession({ getToken: async () => { throw new FatalTranscriptionError("DEEPGRAM_API_KEY is not set"); } });
    await s.start(fakeStream());
    await flush();
    expect(s.getState().status).toBe("error");
    expect(s.getState().error).toContain("DEEPGRAM_API_KEY");
    expect(audio.stopped).toBe(1);
  });

  it("stops when the captured track ends", async () => {
    const s = makeSession();
    await s.start(fakeStream());
    FakeWS.all[0]!.open();
    audio.onEnded!();
    await flush();
    await flush();
    expect(s.isRunning).toBe(false);
    expect(s.getState().status).toBe("error");
  });

  it("uses the token subprotocol for a user's own key", async () => {
    const s = makeSession({ getToken: async () => ({ type: "token" as const, value: "user-key" }) });
    await s.start(fakeStream());
    expect(FakeWS.all[0]!.protocols).toEqual(["token", "user-key"]);
    FakeWS.all[0]!.open();
    expect(s.getState().status).toBe("live");
    await s.stop();
  });

  it("fails clearly (no retry loop) when a user key is rejected at the handshake", async () => {
    const s = makeSession({ getToken: async () => ({ type: "token" as const, value: "bad-key" }) });
    await s.start(fakeStream());
    FakeWS.all[0]!.serverClose(1006);
    await flush();
    await flush();
    expect(s.getState().status).toBe("error");
    expect(s.getState().error).toContain("API key");
    expect(FakeWS.all).toHaveLength(1);
  });

  it("still reconnects a user-key session that dropped after opening", async () => {
    const s = makeSession({ getToken: async () => ({ type: "token" as const, value: "user-key" }) });
    await s.start(fakeStream());
    FakeWS.all[0]!.open();
    vi.useFakeTimers();
    FakeWS.all[0]!.serverClose(1006);
    expect(s.getState().status).toBe("reconnecting");
    await vi.advanceTimersByTimeAsync(600);
    expect(FakeWS.all).toHaveLength(2);
    vi.useRealTimers();
    await s.stop();
  });
});
