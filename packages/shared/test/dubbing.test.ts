import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildSpeakUrl,
  DubOutput,
  DubPhrasePipeline,
  DubPlayer,
  DUB_LANGUAGES,
  FluxSpeaker,
  isCompletePhrase,
  accentsFor,
  framePitch,
  LOWER_VOICE_MAX_HZ,
  normalizeDubSettings,
  pickVoice,
  SpeakerPitch,
  VoiceCaster,
  voicesFor,
  type DubAudioContext,
  type DubSegment,
  type DubState,
} from "../src/core/dubbing";
import type { TranscriptLine } from "../src/core/types";

/* ------------------------------ fakes ------------------------------ */

class FakeSocket {
  static all: FakeSocket[] = [];
  readyState = 0;
  binaryType = "blob";
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onclose: ((e: { code: number; reason: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(
    readonly url: string,
    readonly protocols: string[],
  ) {
    FakeSocket.all.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.readyState = 3;
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  json(msg: object) {
    this.onmessage?.({ data: JSON.stringify(msg) });
  }
  audio(samples: number[]) {
    this.onmessage?.({ data: new Int16Array(samples).buffer });
  }
  serverClose(code = 1006, reason = "") {
    this.readyState = 3;
    this.onclose?.({ code, reason });
  }
  get texts() {
    return this.sent.map((s) => JSON.parse(s) as { type: string; text?: string }).filter((m) => m.type === "Speak").map((m) => m.text);
  }
}

interface FakeSource {
  buffer: { length: number } | null;
  startAt: number | null;
  stopped: boolean;
  onended: (() => void) | null;
}

function fakeContext() {
  const sources: FakeSource[] = [];
  const ctx = {
    currentTime: 0,
    state: "running" as AudioContextState,
    destination: {} as AudioNode,
    sources,
    createGain: () => ({ gain: { value: 1 }, connect() {}, disconnect() {} }) as unknown as GainNode,
    createBuffer: (_c: number, length: number) => ({ length, getChannelData: () => new Float32Array(length) }) as unknown as AudioBuffer,
    createBufferSource: () => {
      const s: FakeSource & Record<string, unknown> = {
        buffer: null,
        startAt: null,
        stopped: false,
        onended: null,
        connect() {},
        disconnect() {},
        start(t: number) {
          s.startAt = t;
        },
        stop() {
          s.stopped = true;
        },
      };
      sources.push(s);
      return s as unknown as AudioBufferSourceNode;
    },
    suspend: vi.fn(async () => {
      ctx.state = "suspended";
    }),
    resume: vi.fn(async () => {
      ctx.state = "running";
    }),
    close: vi.fn(async () => undefined),
  };
  return ctx;
}

const flush = () => new Promise((r) => setTimeout(r, 0));
const ws = () => FakeSocket.all[FakeSocket.all.length - 1]!;

beforeEach(() => {
  FakeSocket.all = [];
});
afterEach(() => {
  vi.useRealTimers();
});

/* ------------------------------ voices ------------------------------ */

describe("dubbing languages and voices", () => {
  it("only offers languages the translator and Flux TTS both support", () => {
    const codes = DUB_LANGUAGES.map(([c]) => c);
    expect(codes).toContain("es");
    expect(codes).toContain("zh-Hant");
    // Arabic captions exist, but Flux TTS has no Arabic voice.
    expect(codes).not.toContain("ar");
    for (const code of codes) expect(voicesFor(code).every((v) => v.id.startsWith("flux-"))).toBe(true);
  });

  it("falls back to the language's first voice", () => {
    expect(pickVoice("fr", "flux-carmen-es")).toBe("flux-camille-fr");
  });

  it("offers an accent only where the voices come in several", () => {
    expect(accentsFor("en")).toEqual(["US", "GB", "IE", "AU", "IN"]);
    expect(accentsFor("pt")).toEqual(["BR", "PT"]);
    expect(accentsFor("de")).toEqual(["DE", "CH"]);
    expect(accentsFor("nl")).toEqual(["NL", "BE"]);
    expect(accentsFor("es")).toEqual([]);
    expect(accentsFor("zh")).toEqual([]);
  });

  it("normalizes saved settings, keeping the accent of a voice saved by an earlier build", () => {
    expect(normalizeDubSettings({ language: "xx", voice: "nope" })).toEqual({ language: "es", accent: "" });
    expect(normalizeDubSettings({ language: "en" })).toEqual({ language: "en", accent: "US" });
    expect(normalizeDubSettings({ language: "pt", voice: "flux-pedro-pt" })).toEqual({ language: "pt", accent: "PT" });
    expect(normalizeDubSettings({ language: "en", accent: "GB", voice: "flux-hannah-en" })).toEqual({ language: "en", accent: "GB" });
    expect(normalizeDubSettings({ language: "fr", accent: "GB" })).toEqual({ language: "fr", accent: "" });
  });

  it("builds the streaming speak URL", () => {
    expect(buildSpeakUrl("flux-carmen-es")).toBe("wss://api.deepgram.com/v2/speak?model=flux-carmen-es&encoding=linear16&sample_rate=24000");
  });
});

/* ------------------------------ phrases ------------------------------ */

let lineId = 0;
function line(text: string, createdAt: number, language?: string): { type: "line"; line: TranscriptLine } {
  return { type: "line", line: { id: `l${++lineId}`, text, start: 0, end: 0, mediaStart: null, mediaEnd: null, createdAt, language } };
}

describe("DubPhrasePipeline", () => {
  const translate = vi.fn(async (text: string, source: string, target: string) => ({ ok: true as const, text: `[${source}>${target}] ${text}` }));

  it("knows when a phrase is complete", () => {
    expect(isCompletePhrase("Hello there, friends.")).toBe(true);
    expect(isCompletePhrase("Hi.")).toBe(false);
    expect(isCompletePhrase("and then we")).toBe(false);
  });

  it("speaks complete sentences right away and ignores lines from before it started", async () => {
    let now = 1000;
    const out: DubSegment[] = [];
    const p = new DubPhrasePipeline({ onSegment: (s) => out.push(s) }, { translate, now: () => now });
    p.configure("en", "es");
    p.handle(line("Said before dubbing was on.", 900));
    p.start();
    now = 2000;
    p.handle(line("Welcome back to the show.", 2000));
    await flush();
    expect(out.map((s) => s.text)).toEqual(["[en>es] Welcome back to the show."]);
    expect(out[0]!.spokenAt).toBe(2000);
  });

  it("groups short fragments into one phrase", async () => {
    vi.useFakeTimers();
    let now = 0;
    const out: DubSegment[] = [];
    const p = new DubPhrasePipeline({ onSegment: (s) => out.push(s) }, { translate, now: () => now, holdMs: 500 });
    p.configure("en", "es");
    p.start();
    p.handle(line("So", 10));
    p.handle(line("anyway", 20));
    expect(out).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(600);
    expect(out.map((s) => s.text)).toEqual(["[en>es] So anyway"]);
  });

  it("releases translations in spoken order even when they finish out of order", async () => {
    const slowFirst = vi.fn(async (text: string) => {
      await new Promise((r) => setTimeout(r, text.startsWith("First") ? 20 : 1));
      return { ok: true as const, text };
    });
    const out: DubSegment[] = [];
    const p = new DubPhrasePipeline({ onSegment: (s) => out.push(s) }, { translate: slowFirst });
    p.configure("en", "es");
    p.start();
    p.handle(line("First sentence goes here.", Date.now()));
    p.handle(line("Second sentence goes here.", Date.now()));
    await new Promise((r) => setTimeout(r, 40));
    expect(out.map((s) => s.text)).toEqual(["First sentence goes here.", "Second sentence goes here."]);
    expect(out[0]!.seq).toBeLessThan(out[1]!.seq);
  });

  it("drops in-flight phrases when the language changes and skips stale ones", async () => {
    let now = 0;
    const out: DubSegment[] = [];
    const onSkipped = vi.fn();
    const p = new DubPhrasePipeline({ onSegment: (s) => out.push(s), onSkipped }, { translate, now: () => now, maxLagMs: 5000 });
    p.configure("en", "es");
    p.start();
    p.handle(line("This one is outdated now.", 0));
    p.configure("en", "fr");
    await flush();
    expect(out).toHaveLength(0);

    p.handle(line("This one waited far too long.", 0));
    now = 9000;
    await flush();
    expect(out).toHaveLength(0);
    expect(onSkipped).toHaveBeenCalledOnce();
  });

  it("never speaks the same line twice", async () => {
    const out: DubSegment[] = [];
    const p = new DubPhrasePipeline({ onSegment: (s) => out.push(s) }, { translate });
    p.configure("en", "es");
    p.start();
    const l = line("Only say this once please.", Date.now());
    p.handle(l);
    p.handle(l);
    await flush();
    expect(out).toHaveLength(1);
  });

  it("translates from the detected language when the spoken language is auto", async () => {
    const out: DubSegment[] = [];
    const p = new DubPhrasePipeline({ onSegment: (s) => out.push(s) }, { translate });
    p.configure("multi", "en");
    p.start();
    p.handle(line("Bonjour à tous et bienvenue.", Date.now(), "fr"));
    await flush();
    expect(out[0]!.text).toBe("[fr>en] Bonjour à tous et bienvenue.");
  });
});

/* ------------------------------ speaker ------------------------------ */

function speaker(extra: Partial<ConstructorParameters<typeof FluxSpeaker>[0]> = {}) {
  const audio: Array<[number, number[]]> = [];
  const ends: number[] = [];
  const statuses: string[] = [];
  const s = new FluxSpeaker({
    voice: "flux-carmen-es",
    getToken: async () => "jwt",
    onAudio: (seq, pcm) => audio.push([seq, [...pcm]]),
    onTurnEnd: (seq) => ends.push(seq),
    onStatus: (st) => statuses.push(st),
    WebSocketImpl: FakeSocket as unknown as typeof WebSocket,
    ...extra,
  });
  return { s, audio, ends, statuses };
}

const seg = (seq: number, text = `phrase ${seq}`): DubSegment => ({ seq, text, spokenAt: Date.now() });

describe("FluxSpeaker", () => {
  it("authenticates like speech-to-text and sends each phrase as a turn", async () => {
    const { s } = speaker();
    s.speak(seg(1, "Hola a todos."));
    await flush();
    expect(ws().protocols).toEqual(["bearer", "jwt"]);
    expect(ws().url).toContain("model=flux-carmen-es");
    ws().open();
    expect(ws().sent.map((x) => JSON.parse(x).type)).toEqual(["Speak", "Flush"]);
    expect(ws().texts).toEqual(["Hola a todos."]);
  });

  it("maps audio to phrases in order using the turn markers", async () => {
    const { s, audio, ends } = speaker();
    s.speak(seg(1));
    s.speak(seg(2));
    await flush();
    ws().open();
    s.speak(seg(3));
    // Phrases 1 and 2 were queued while connecting: one turn. Phrase 3 is its own turn.
    expect(ws().texts).toEqual(["phrase 1 phrase 2", "phrase 3"]);
    ws().json({ type: "SpeechStarted", speech_id: "a" });
    ws().audio([1, 2]);
    ws().json({ type: "SpeechMetadata", speech_id: "a" });
    ws().json({ type: "SpeechStarted", speech_id: "b" });
    ws().audio([3]);
    ws().json({ type: "SpeechMetadata", speech_id: "b" });
    expect(audio).toEqual([
      [1, [1, 2]],
      [3, [3]],
    ]);
    // Phrase 2 was merged into phrase 1's turn: it's over when that turn is.
    expect(ends).toEqual([1, 2, 3]);
  });

  it("merges phrases instead of exceeding the turn budget", async () => {
    vi.useFakeTimers();
    const { s } = speaker({ maxTurnsPerMinute: 1 });
    s.speak(seg(1));
    await vi.advanceTimersByTimeAsync(0);
    ws().open();
    s.speak(seg(2));
    s.speak(seg(3));
    expect(ws().texts).toEqual(["phrase 1"]);
    await vi.advanceTimersByTimeAsync(61_000);
    expect(ws().texts).toEqual(["phrase 1", "phrase 2 phrase 3"]);
  });

  it("reset closes the socket so nothing outdated is spoken", async () => {
    const { s, audio } = speaker();
    s.speak(seg(1));
    await flush();
    const first = ws();
    first.open();
    s.reset();
    expect(first.readyState).toBe(3);
    first.audio([9]); // late frame from the old socket
    expect(audio).toEqual([]);
    s.speak(seg(2));
    await flush();
    expect(FakeSocket.all).toHaveLength(2);
  });

  it("gives up on a rejected user key without retrying", async () => {
    const { s, statuses } = speaker({ getToken: async () => ({ type: "token", value: "bad" }) });
    s.speak(seg(1));
    await flush();
    ws().serverClose(1006);
    expect(statuses.at(-1)).toBe("failed");
    expect(FakeSocket.all).toHaveLength(1);
  });

  it("reconnects after a dropped connection, without re-sending phrases already sent", async () => {
    vi.useFakeTimers();
    const { s, statuses } = speaker();
    s.speak(seg(1));
    await vi.advanceTimersByTimeAsync(0);
    ws().open();
    s.speak(seg(2));
    // Drop while phrase 2 is queued but before it was sent? It was sent; queue a third.
    ws().readyState = 0;
    s.speak(seg(3));
    ws().serverClose(1011);
    expect(statuses).toContain("reconnecting");
    await vi.advanceTimersByTimeAsync(500);
    ws().open();
    expect(ws().texts).toEqual(["phrase 3"]);
  });
});

describe("FluxSpeaker keep-warm", () => {
  it("connects before the first phrase and sends it as soon as it arrives", async () => {
    const { s, statuses } = speaker({ keepWarm: true });
    s.warm();
    await flush();
    expect(FakeSocket.all).toHaveLength(1);
    expect(statuses).toEqual(["connecting"]);
    ws().open();
    expect(ws().sent).toEqual([]);
    s.speak(seg(1, "Hola."));
    expect(ws().texts).toEqual(["Hola."]);
    expect(FakeSocket.all).toHaveLength(1);
  });

  it("quietly reopens after the server closes an idle connection", async () => {
    vi.useFakeTimers();
    const { s, statuses } = speaker({ keepWarm: true });
    s.warm();
    await vi.advanceTimersByTimeAsync(0);
    ws().open();
    await vi.advanceTimersByTimeAsync(60_000);
    ws().serverClose(1000, "NET-0004");
    await vi.advanceTimersByTimeAsync(0);
    expect(FakeSocket.all).toHaveLength(2);
    // No "connecting" or "idle" flicker for the background reopen.
    expect(statuses).toEqual(["connecting", "open"]);
  });

  it("doesn't spin on a connection that closes right away", async () => {
    const { s } = speaker({ keepWarm: true });
    s.warm();
    await flush();
    ws().open();
    ws().serverClose(1000);
    await flush();
    expect(FakeSocket.all).toHaveLength(1);
  });

  it("reopens straight after a reset (seek) so the next phrase is quick", async () => {
    const { s } = speaker({ keepWarm: true });
    s.warm();
    await flush();
    ws().open();
    s.reset();
    await flush();
    expect(FakeSocket.all).toHaveLength(2);
  });
});

/* ------------------------------ player ------------------------------ */

describe("DubPlayer", () => {
  it("plays phrases back to back without overlapping", () => {
    const ctx = fakeContext();
    const p = new DubPlayer({ createContext: () => ctx as unknown as DubAudioContext, sampleRate: 1000, leadSeconds: 0, now: () => 0 });
    p.begin(1, 0);
    p.begin(2, 0);
    p.push(1, new Int16Array(500)); // 0.5 s
    p.push(1, new Int16Array(250)); // 0.25 s
    p.end(1);
    p.push(2, new Int16Array(1000));
    expect(ctx.sources.map((s) => s.startAt)).toEqual([0, 0.5, 0.75]);
    expect(p.backlogSeconds).toBeCloseTo(1.75);
  });

  it("skips a phrase that would start too far behind live, and reports the delay", () => {
    const ctx = fakeContext();
    const delays: number[] = [];
    const skipped = vi.fn();
    let now = 10_000;
    const p = new DubPlayer({
      createContext: () => ctx as unknown as DubAudioContext,
      sampleRate: 1000,
      leadSeconds: 0,
      maxLagMs: 3000,
      now: () => now,
      onDelay: (d) => delays.push(d),
      onSkipped: skipped,
    });
    p.begin(1, 9000); // spoken 1 s ago
    p.push(1, new Int16Array(4000)); // 4 s of audio queued
    p.end(1);
    p.begin(2, 9500); // would start 4 s from now → 4.5 s late
    p.push(2, new Int16Array(100));
    p.push(2, new Int16Array(100));
    expect(delays).toEqual([1000]);
    expect(skipped).toHaveBeenCalledOnce();
    expect(ctx.sources).toHaveLength(1);
    now = 10_001;
  });

  it("doesn't count paused time as lag, and suspends while paused", () => {
    const ctx = fakeContext();
    const skipped = vi.fn();
    let now = 0;
    const p = new DubPlayer({ createContext: () => ctx as unknown as DubAudioContext, maxLagMs: 3000, leadSeconds: 0, now: () => now, onSkipped: skipped });
    p.push(0, new Int16Array(0)); // creates the context lazily (ignored: unknown phrase)
    p.begin(1, 0);
    p.setPaused(true);
    now = 60_000;
    p.setPaused(false);
    p.push(1, new Int16Array(10));
    expect(skipped).not.toHaveBeenCalled();
    expect(ctx.sources).toHaveLength(1);
  });

  it("clear stops everything and forgets pending phrases", () => {
    const ctx = fakeContext();
    const playing: boolean[] = [];
    const p = new DubPlayer({ createContext: () => ctx as unknown as DubAudioContext, now: () => 0, onPlaying: (x) => playing.push(x) });
    p.begin(1, 0);
    p.push(1, new Int16Array(10));
    p.clear();
    p.push(1, new Int16Array(10)); // late audio for a cleared phrase
    expect(ctx.sources).toHaveLength(1);
    expect(ctx.sources[0]!.stopped).toBe(true);
    expect(playing).toEqual([true, false]);
  });
});

/* ------------------------------ output ------------------------------ */

describe("DubOutput", () => {
  function output() {
    const ctx = fakeContext();
    const states: DubState[] = [];
    const o = new DubOutput({
      getToken: async () => "jwt",
      onState: (s) => states.push(s),
      createContext: () => ctx as unknown as DubAudioContext,
      WebSocketImpl: FakeSocket as unknown as typeof WebSocket,
    });
    return { o, ctx, states };
  }

  const socketFor = (voice: string) => FakeSocket.all.filter((x) => x.url.includes(`model=${voice}&`)).at(-1)!;
  const openAll = () => FakeSocket.all.filter((x) => x.readyState === 0).forEach((x) => x.open());

  it("goes listening → connecting → playing → listening", async () => {
    const { o, ctx, states } = output();
    o.enable("es");
    o.speak(seg(1, "Hola."));
    await flush();
    openAll();
    const carmen = socketFor("flux-carmen-es");
    carmen.json({ type: "SpeechStarted" });
    carmen.audio([1, 2, 3]);
    ctx.sources[0]!.onended?.();
    const statuses = states.map((s) => s.status).filter((s, i, all) => s !== all[i - 1]);
    expect(statuses).toEqual(["listening", "connecting", "listening", "playing", "listening"]);
    expect(states.at(-1)!.delayMs).not.toBeNull();
  });

  it("ignores repeated phrases", async () => {
    const { o } = output();
    o.enable("es");
    o.speak(seg(1, "Uno."));
    o.speak(seg(1, "Uno."));
    await flush();
    openAll();
    expect(socketFor("flux-carmen-es").texts).toEqual(["Uno."]);
  });

  it("reports unavailable when synthesis fails for good, and resets when disabled", async () => {
    const { o, states } = output();
    const failing = new DubOutput({
      getToken: async () => ({ type: "token", value: "bad" }),
      onState: (s) => states.push(s),
      createContext: () => fakeContext() as unknown as DubAudioContext,
      WebSocketImpl: FakeSocket as unknown as typeof WebSocket,
    });
    failing.enable("es");
    failing.speak(seg(1));
    await flush();
    socketFor("flux-carmen-es").serverClose(1006);
    expect(failing.getState().status).toBe("unavailable");
    expect(failing.getState().error).toMatch(/API key/);
    failing.disable();
    expect(failing.getState().status).toBe("off");
    o.disable();
  });
});

/* ------------------------------ speakers ------------------------------ */

/** A voiced sound at `hz` with a few harmonics, like a vowel. */
function vowel(hz: number, seconds: number, sampleRate = 16000): Float32Array {
  const out = new Float32Array(Math.round(seconds * sampleRate));
  for (let i = 0; i < out.length; i++) {
    const t = i / sampleRate;
    out[i] = 0.3 * Math.sin(2 * Math.PI * hz * t) + 0.15 * Math.sin(4 * Math.PI * hz * t) + 0.08 * Math.sin(6 * Math.PI * hz * t);
  }
  return out;
}

const toPcm = (f: Float32Array) => Int16Array.from(f, (x) => Math.round(x * 0x7fff));

describe("pitch", () => {
  it("measures voiced frames and ignores silence and noise", () => {
    expect(framePitch(vowel(120, 0.04), 16000)).toBeCloseTo(120, -1);
    expect(framePitch(vowel(220, 0.04), 16000)).toBeCloseTo(220, -1);
    expect(framePitch(new Float32Array(640), 16000)).toBeNull();
    let seed = 1;
    const noise = Float32Array.from({ length: 640 }, () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 0.6);
    expect(framePitch(noise, 16000)).toBeNull();
  });

  it("tracks each speaker from the recent audio, on the transcript's clock", () => {
    const p = new SpeakerPitch();
    // 0–3 s: a lower voice; 3–6 s: a higher one, in 100 ms chunks like the capture.
    const audio = new Float32Array([...vowel(110, 3), ...vowel(210, 3)]);
    for (let i = 0; i < audio.length; i += 1600) p.addAudio(toPcm(audio.subarray(i, i + 1600)), i / 16000);
    p.measure("1:0", 0.2, 2.8);
    p.measure("1:1", 3.2, 5.8);
    expect(p.get("1:0")!.hz).toBeCloseTo(110, -1);
    expect(p.get("1:1")!.hz).toBeCloseTo(210, -1);
    expect(p.get("1:0")!.seconds).toBeGreaterThan(2);
    expect(p.get("1:9")).toBeNull();
    p.clear();
    expect(p.get("1:0")).toBeNull();
  });
});

describe("VoiceCaster", () => {
  const low = { hz: 115, seconds: 3 };
  const high = { hz: 205, seconds: 3 };
  const gender = (id: string) => voicesFor(id.split("-").at(-1)!).find((v) => v.id === id)!.gender;

  it("gives lower and higher voices, a different one per speaker", () => {
    const c = new VoiceCaster("es", "");
    const a = c.voiceFor("1:0", low);
    const b = c.voiceFor("1:1", high);
    const d = c.voiceFor("1:2", low);
    expect(gender(a)).toBe("m");
    expect(gender(b)).toBe("f");
    expect(gender(d)).toBe("m");
    expect(d).not.toBe(a);
    // Same speaker, same voice.
    expect(c.voiceFor("1:0", low)).toBe(a);
    expect(LOWER_VOICE_MAX_HZ).toBe(160);
  });

  it("stays within the accent, borrowing from another accent only when it has no such voice", () => {
    const gb = new VoiceCaster("en", "GB");
    expect(voicesFor("en").find((v) => v.id === gb.voiceFor("1:0", low))!.accent).toBe("GB");
    expect(voicesFor("en").find((v) => v.id === gb.voiceFor("1:1", high))!.accent).toBe("GB");
    // Irish English has only a higher voice.
    const ie = new VoiceCaster("en", "IE");
    expect(ie.voiceFor("1:1", high)).toBe("flux-maeve-en");
    expect(gender(ie.voiceFor("1:0", low))).toBe("m");
    expect(ie.likelyVoices).toEqual(["flux-maeve-en"]);
  });

  it("can revise an early guess, but keeps the voice once it has heard enough", () => {
    const c = new VoiceCaster("es", "");
    const first = c.voiceFor("1:0", null);
    expect(first).toBe("flux-carmen-es");
    const better = c.voiceFor("1:0", { hz: 120, seconds: 1 });
    expect(gender(better)).toBe("m");
    const locked = c.voiceFor("1:0", { hz: 120, seconds: 3 });
    expect(c.voiceFor("1:0", { hz: 230, seconds: 4 })).toBe(locked);
  });

  it("gives the same voices again after a reconnect relabels everyone", () => {
    const c = new VoiceCaster("es", "");
    const before = [c.voiceFor("1:0", low), c.voiceFor("1:1", low)];
    const after = [c.voiceFor("2:0", low), c.voiceFor("2:1", low)];
    expect(after).toEqual(before);
  });

  it("gives everyone the one voice in a single-voice language", () => {
    const c = new VoiceCaster("pl", "");
    expect(c.voiceFor("1:0", low)).toBe("flux-bartosz-pl");
    expect(c.voiceFor("1:1", high)).toBe("flux-bartosz-pl");
  });
});

describe("DubPhrasePipeline with speakers", () => {
  it("ends a phrase when the speaker changes and labels each one", async () => {
    const segments: DubSegment[] = [];
    const p = new DubPhrasePipeline({ onSegment: (s) => segments.push(s) }, { translate: async (t) => ({ ok: true, text: `[${t}]` }) });
    p.configure("en", "es");
    p.start();
    const line = (id: string, text: string, speaker: string): TranscriptLine => ({
      id,
      text,
      start: 0,
      end: 1,
      mediaStart: null,
      mediaEnd: null,
      createdAt: Date.now() + 1,
      speaker,
    });
    p.handle({ type: "line", line: line("a", "How are", "1:0") });
    p.handle({ type: "line", line: line("b", "Fine, thank you.", "1:1") });
    await flush();
    await flush();
    expect(segments.map((s) => [s.text, s.speaker])).toEqual([
      ["[How are]", "1:0"],
      ["[Fine, thank you.]", "1:1"],
    ]);
  });
});

describe("DubPlayer across voices", () => {
  it("holds a later phrase's audio until the earlier phrase is done", () => {
    const ctx = fakeContext();
    const p = new DubPlayer({ createContext: () => ctx as unknown as DubAudioContext, sampleRate: 1000, leadSeconds: 0, now: () => 0 });
    p.begin(1, 0);
    p.begin(2, 0);
    p.push(2, new Int16Array(300)); // the second voice answers first
    expect(ctx.sources).toHaveLength(0);
    p.push(1, new Int16Array(500));
    expect(ctx.sources.map((s) => s.startAt)).toEqual([0]);
    p.push(1, new Int16Array(500));
    p.end(1);
    expect(ctx.sources.map((s) => s.startAt)).toEqual([0, 0.5, 1]);
  });

  it("gives up on a phrase whose audio never comes once it's too late", () => {
    const ctx = fakeContext();
    const skipped = vi.fn();
    let now = 0;
    const p = new DubPlayer({ createContext: () => ctx as unknown as DubAudioContext, maxLagMs: 3000, leadSeconds: 0, now: () => now, onSkipped: skipped });
    p.begin(1, 0);
    p.begin(2, 3500);
    now = 3600;
    p.push(2, new Int16Array(10));
    expect(skipped).toHaveBeenCalledOnce();
    expect(ctx.sources).toHaveLength(1);
  });

  it("moves on when a phrase ends without audio (merged into another turn or dropped)", () => {
    const ctx = fakeContext();
    const p = new DubPlayer({ createContext: () => ctx as unknown as DubAudioContext, sampleRate: 1000, leadSeconds: 0, now: () => 0 });
    p.begin(1, 0);
    p.begin(2, 0);
    p.push(2, new Int16Array(100));
    p.end(1);
    expect(ctx.sources).toHaveLength(1);
  });
});

describe("DubOutput with speakers", () => {
  it("speaks each speaker with a matching voice on its own connection", async () => {
    const pitches: Record<string, { hz: number; seconds: number }> = { "1:0": { hz: 120, seconds: 3 }, "1:1": { hz: 210, seconds: 3 } };
    const o = new DubOutput({
      getToken: async () => "jwt",
      pitchOf: (s) => pitches[s] ?? null,
      createContext: () => fakeContext() as unknown as DubAudioContext,
      WebSocketImpl: FakeSocket as unknown as typeof WebSocket,
    });
    o.enable("en", "GB");
    await flush();
    // The likely first voices are connecting before anyone speaks.
    expect(o.activeVoices).toEqual(["flux-kit-en", "flux-gemma-en"]);
    o.speak({ ...seg(1, "Hello."), speaker: "1:0" });
    o.speak({ ...seg(2, "Hi."), speaker: "1:1" });
    o.speak({ ...seg(3, "So."), speaker: "1:2" });
    await flush();
    FakeSocket.all.forEach((x) => x.open());
    const texts = (voice: string) => FakeSocket.all.filter((x) => x.url.includes(`model=${voice}&`)).flatMap((x) => x.texts);
    expect(texts("flux-kit-en")).toEqual(["Hello."]);
    expect(texts("flux-gemma-en")).toEqual(["Hi."]);
    // Nothing known about speaker 2 yet: a voice nobody else has.
    expect(o.activeVoices).toHaveLength(3);
    await o.close();
  });
});
