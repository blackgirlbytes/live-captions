import { describe, expect, it } from "vitest";
import { PCM_WORKLET_NAME, PCM_WORKLET_SOURCE } from "../src/core/audio";

/** Run the worklet source in a fake AudioWorkletGlobalScope. */
function loadProcessor(sampleRate: number, chunkSamples: number) {
  let Ctor: any;
  const out: Int16Array[] = [];
  class AudioWorkletProcessor {
    port = { postMessage: (buf: ArrayBuffer) => out.push(new Int16Array(buf)) };
  }
  const registerProcessor = (name: string, c: any) => {
    expect(name).toBe(PCM_WORKLET_NAME);
    Ctor = c;
  };
  new Function("AudioWorkletProcessor", "registerProcessor", "sampleRate", PCM_WORKLET_SOURCE)(AudioWorkletProcessor, registerProcessor, sampleRate);
  const proc = new Ctor({ processorOptions: { targetSampleRate: 16000, chunkSamples } });
  return { proc, out };
}

describe("PCM worklet", () => {
  it("downsamples 48 kHz stereo to 16 kHz mono int16 chunks", () => {
    const { proc, out } = loadProcessor(48000, 1600);
    const quanta = 48000 / 128; // one second of audio
    let t = 0;
    for (let q = 0; q < quanta; q++) {
      const l = new Float32Array(128);
      const r = new Float32Array(128);
      for (let i = 0; i < 128; i++, t++) {
        const v = 0.5 * Math.sin((2 * Math.PI * 440 * t) / 48000);
        l[i] = v;
        r[i] = v;
      }
      expect(proc.process([[l, r]])).toBe(true);
    }
    const samples = out.reduce((n, c) => n + c.length, 0);
    expect(out.length).toBe(10); // one second → ten 100 ms chunks
    expect(samples).toBe(16000);
    const peak = Math.max(...out.flatMap((c) => Array.from(c)).map(Math.abs));
    expect(peak).toBeGreaterThan(16000 * 0.95);
    expect(peak).toBeLessThan(16500);
  });

  it("handles 44.1 kHz input", () => {
    const { proc, out } = loadProcessor(44100, 160);
    for (let q = 0; q < 44100 / 128; q++) proc.process([[new Float32Array(128).fill(0.1)]]);
    const samples = out.reduce((n, c) => n + c.length, 0);
    expect(Math.abs(samples - 16000)).toBeLessThanOrEqual(160);
  });
});
