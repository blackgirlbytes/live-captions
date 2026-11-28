/**
 * How low or high each speaker's voice is, so live dubbing can give them a matching voice.
 *
 * The offscreen document already has the 16 kHz audio it sends for transcription. It keeps
 * the last few seconds, and when a transcript line arrives (one speaker, with start and end
 * times on the same clock), measures the pitch of the voiced parts of that stretch. Each
 * speaker's pitch is the median over everything measured so far.
 *
 * This only says whether a voice sounds lower or higher. It says nothing about who the
 * person is. Nothing is stored beyond the short rolling buffer, and nothing leaves the device.
 */
import { PCM_TARGET_SAMPLE_RATE } from "../audio";

/** Lowest and highest speaking pitch considered (Hz). */
const MIN_HZ = 70;
const MAX_HZ = 400;

export interface PitchEstimate {
  /** Median pitch in Hz. */
  hz: number;
  /** Seconds of voiced audio behind the estimate. */
  seconds: number;
}

/**
 * Pitch of one frame with the YIN method (de Cheveigné & Kawahara, 2002), or null when the
 * frame isn't clearly voiced (silence, noise, most music).
 */
export function framePitch(frame: Float32Array, sampleRate: number, threshold = 0.15): number | null {
  const minLag = Math.floor(sampleRate / MAX_HZ);
  const maxLag = Math.min(Math.ceil(sampleRate / MIN_HZ), Math.floor(frame.length / 2));
  const w = frame.length - maxLag;
  if (w <= 0 || maxLag <= minLag) return null;

  // Too quiet to be speech.
  let energy = 0;
  for (let i = 0; i < frame.length; i++) energy += frame[i]! * frame[i]!;
  if (Math.sqrt(energy / frame.length) < 0.01) return null;

  const d = new Float32Array(maxLag + 1);
  for (let lag = 1; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i < w; i++) {
      const diff = frame[i]! - frame[i + lag]!;
      sum += diff * diff;
    }
    d[lag] = sum;
  }
  // Cumulative mean normalized difference.
  let running = 0;
  let best = -1;
  for (let lag = 1; lag <= maxLag; lag++) {
    running += d[lag]!;
    d[lag] = running > 0 ? (d[lag]! * lag) / running : 1;
  }
  for (let lag = minLag; lag <= maxLag; lag++) {
    if (d[lag]! < threshold) {
      while (lag + 1 <= maxLag && d[lag + 1]! < d[lag]!) lag++;
      best = lag;
      break;
    }
  }
  if (best < 0) return null;
  // Parabolic interpolation for a sub-sample lag.
  const a = d[best - 1] ?? d[best]!;
  const b = d[best]!;
  const c = d[best + 1] ?? d[best]!;
  const denom = a - 2 * b + c;
  const lag = denom !== 0 ? best + (a - c) / (2 * denom) : best;
  const hz = sampleRate / lag;
  return hz >= MIN_HZ && hz <= MAX_HZ ? hz : null;
}

/** Pitch of every voiced frame in `samples`, and how many frames were looked at. */
export function voicedPitches(
  samples: Float32Array,
  sampleRate: number,
  opts: { frameMs?: number; hopMs?: number; maxFrames?: number } = {},
): { pitches: number[]; frames: number } {
  const frame = Math.round((sampleRate * (opts.frameMs ?? 40)) / 1000);
  const total = Math.floor((samples.length - frame) / Math.round((sampleRate * (opts.hopMs ?? 20)) / 1000)) + 1;
  if (total <= 0) return { pitches: [], frames: 0 };
  // Spread at most `maxFrames` frames evenly over long stretches (keeps the cost bounded).
  const frames = Math.min(total, opts.maxFrames ?? 150);
  const step = (samples.length - frame) / Math.max(1, frames - 1);
  const out: number[] = [];
  for (let k = 0; k < frames; k++) {
    const at = Math.round(k * step);
    const hz = framePitch(samples.subarray(at, at + frame), sampleRate);
    if (hz !== null) out.push(hz);
  }
  return { pitches: out, frames };
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

interface Chunk {
  start: number;
  pcm: Int16Array;
}

export interface SpeakerPitchOptions {
  sampleRate?: number;
  /** Seconds of audio kept for measuring (lines are finalized a few seconds after the audio). */
  keepSeconds?: number;
}

export class SpeakerPitch {
  private chunks: Chunk[] = [];
  private readonly samples = new Map<string, { pitches: number[]; seconds: number }>();
  private readonly sampleRate: number;
  private readonly keep: number;

  constructor(opts: SpeakerPitchOptions = {}) {
    this.sampleRate = opts.sampleRate ?? PCM_TARGET_SAMPLE_RATE;
    this.keep = opts.keepSeconds ?? 30;
  }

  /** Every chunk of transcribed audio, with its start in stream seconds. */
  addAudio(pcm: Int16Array, start: number): void {
    // Stream time went backwards: a new capture started.
    const last = this.chunks.at(-1);
    if (last && start < last.start) this.chunks = [];
    this.chunks.push({ start, pcm });
    const end = start + pcm.length / this.sampleRate;
    while (this.chunks.length > 0 && end - this.chunks[0]!.start > this.keep) this.chunks.shift();
  }

  /** Measure the stretch `start`–`end` (stream seconds) as `speaker`'s voice. */
  measure(speaker: string, start: number, end: number): void {
    const audio = this.slice(start, end);
    if (!audio) return;
    const { pitches, frames } = voicedPitches(audio, this.sampleRate);
    if (pitches.length === 0) return;
    const entry = this.samples.get(speaker) ?? { pitches: [], seconds: 0 };
    entry.pitches.push(...pitches);
    // Plenty for a stable median; keep the newest.
    if (entry.pitches.length > 1500) entry.pitches.splice(0, entry.pitches.length - 1500);
    entry.seconds += (audio.length / this.sampleRate) * (pitches.length / frames);
    this.samples.set(speaker, entry);
  }

  get(speaker: string): PitchEstimate | null {
    const entry = this.samples.get(speaker);
    if (!entry || entry.pitches.length === 0) return null;
    return { hz: median(entry.pitches), seconds: entry.seconds };
  }

  /** Forget everyone (a new capture). */
  clear(): void {
    this.chunks = [];
    this.samples.clear();
  }

  private slice(start: number, end: number): Float32Array | null {
    const sr = this.sampleRate;
    const from = Math.max(start, this.chunks[0]?.start ?? Infinity);
    if (!(end > from)) return null;
    const out = new Float32Array(Math.ceil((end - from) * sr));
    let filled = 0;
    for (const c of this.chunks) {
      const cEnd = c.start + c.pcm.length / sr;
      if (cEnd <= from || c.start >= end) continue;
      const i0 = Math.max(0, Math.round((from - c.start) * sr));
      const i1 = Math.min(c.pcm.length, Math.round((end - c.start) * sr));
      const at = Math.round((c.start + i0 / sr - from) * sr);
      for (let i = i0; i < i1 && at + i - i0 < out.length; i++) out[at + i - i0] = c.pcm[i]! / 0x8000;
      filled += Math.max(0, i1 - i0);
    }
    return filled > sr * 0.2 ? out : null;
  }
}
