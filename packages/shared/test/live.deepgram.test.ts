/**
 * Live end-to-end test against the real Deepgram API (skipped without a key).
 *
 *   DEEPGRAM_API_KEY=... EARSHOT_TEST_AUDIO=/path/to/speech.wav npx vitest run test/live.deepgram.test.ts
 *
 * Exercises the production path minus the browser audio graph: real 16-bit WAV →
 * the real PCM worklet resampler → TranscriptionSession → JWT from /v1/auth/grant →
 * WebSocket with the `bearer` subprotocol → Nova-3 interim/final results → transcript lines.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

const feeder = vi.hoisted(() => ({ onChunk: null as null | ((b: ArrayBuffer) => void) }));
vi.mock("../src/core/audio", async (orig) => {
  const actual = await orig<typeof import("../src/core/audio")>();
  return {
    ...actual,
    startPcmCapture: async (o: { onChunk: (b: ArrayBuffer) => void }) => {
      feeder.onChunk = o.onChunk;
      return { sampleRate: 16000, stop: async () => undefined };
    },
  };
});

import { PCM_WORKLET_SOURCE } from "../src/core/audio";
import { TranscriptionSession } from "../src/core/session";

const KEY = process.env.DEEPGRAM_API_KEY;
const AUDIO = process.env.EARSHOT_TEST_AUDIO;

/** Decode a PCM16 WAV into mono Float32 + sample rate. */
function readWav(path: string) {
  const buf = readFileSync(path);
  let off = 12;
  let rate = 0;
  let channels = 1;
  while (off < buf.length) {
    const id = buf.toString("ascii", off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === "fmt ") {
      channels = buf.readUInt16LE(off + 10);
      rate = buf.readUInt32LE(off + 12);
    }
    if (id === "data") {
      const frames = Math.floor(size / 2 / channels);
      const out = new Float32Array(frames);
      for (let i = 0; i < frames; i++) out[i] = buf.readInt16LE(off + 8 + i * 2 * channels) / 32768;
      return { rate, samples: out };
    }
    off += 8 + size + (size % 2);
  }
  throw new Error("No data chunk");
}

/** Resample through the real worklet code, collecting 100 ms int16 chunks. */
function resampleWithWorklet(rate: number, samples: Float32Array): ArrayBuffer[] {
  const chunks: ArrayBuffer[] = [];
  let Ctor: any;
  class AudioWorkletProcessor {
    port = { postMessage: (b: ArrayBuffer) => chunks.push(b) };
  }
  new Function("AudioWorkletProcessor", "registerProcessor", "sampleRate", PCM_WORKLET_SOURCE)(
    AudioWorkletProcessor,
    (_: string, c: any) => (Ctor = c),
    rate,
  );
  const proc = new Ctor({ processorOptions: { targetSampleRate: 16000, chunkSamples: 1600 } });
  for (let i = 0; i + 128 <= samples.length; i += 128) proc.process([[samples.subarray(i, i + 128)]]);
  return chunks;
}

describe.skipIf(!KEY || !AUDIO)("Deepgram live (real API)", () => {
  it("transcribes streamed speech end to end", async () => {
    const getToken = async () => {
      const res = await fetch("https://api.deepgram.com/v1/auth/grant", {
        method: "POST",
        headers: { Authorization: `Token ${KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ttl_seconds: 30 }),
      });
      expect(res.ok).toBe(true);
      return ((await res.json()) as { access_token: string }).access_token;
    };

    const statuses: string[] = [];
    let interims = 0;
    const session = new TranscriptionSession({
      getToken,
      workletUrl: "unused-in-test",
      getMediaTime: () => null,
      onEvent: (e) => {
        if (e.type === "status") statuses.push(e.status);
        if (e.type === "caption" && e.caption.hasInterim) interims++;
      },
    });

    const { rate, samples } = readWav(AUDIO!);
    const chunks = resampleWithWorklet(rate, samples);
    await session.start({ getTracks: () => [], getAudioTracks: () => [{}] } as unknown as MediaStream);

    // Stream at real-time pace, like tab audio.
    for (const c of chunks) {
      feeder.onChunk!(c);
      await new Promise((r) => setTimeout(r, 100));
    }
    await session.stop();

    const state = session.getState();
    const text = state.lines.map((l) => l.text).join(" ");
    console.log(`\n${state.lines.length} lines, ${interims} interim updates\n${text}\n`);
    expect(statuses).toContain("live");
    expect(state.status).toBe("idle");
    expect(interims).toBeGreaterThan(0);
    expect(state.lines.length).toBeGreaterThan(0);
    expect(text.toLowerCase()).toContain("spacewalk");
    expect(text.toLowerCase()).toContain("today"); // nothing lost at stop
    expect(state.lines.length).toBeGreaterThan(1); // long speech is split into readable lines
    // Monotonic, non-overlapping timestamps.
    for (let i = 1; i < state.lines.length; i++) expect(state.lines[i]!.start).toBeGreaterThanOrEqual(state.lines[i - 1]!.end - 0.05);
  }, 90_000);
});

describe.skipIf(!KEY)("verifyDeepgramKey (real API)", () => {
  it("accepts a real key and rejects a bad one", async () => {
    const { verifyDeepgramKey } = await import("../src/core/deepgram");
    expect(await verifyDeepgramKey(KEY!)).toBe("ok");
    expect(await verifyDeepgramKey("0123456789abcdef0123456789abcdef01234567")).toBe("rejected");
  }, 20_000);
});
