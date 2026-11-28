/**
 * Playback queue for dubbed speech (Web Audio).
 *
 * PCM chunks are scheduled back to back on one clock, so phrases play in order and never
 * overlap. Each speaker's voice synthesizes on its own connection, so a later phrase's audio
 * can arrive while an earlier one is still coming in: it waits until the earlier one is done. A phrase whose first word would start too long after the original was spoken is
 * skipped, which keeps a livestream's dub close to live instead of replaying an ever-older
 * backlog. Nothing is stored: chunks are dropped as soon as they've played.
 */
import { DUB_SAMPLE_RATE } from "./flux-tts";

/** The parts of AudioContext the player uses (a fake in tests). */
export interface DubAudioContext {
  readonly currentTime: number;
  readonly destination: AudioNode;
  readonly state: AudioContextState;
  createGain(): GainNode;
  createBuffer(channels: number, length: number, sampleRate: number): AudioBuffer;
  createBufferSource(): AudioBufferSourceNode;
  suspend(): Promise<void>;
  resume(): Promise<void>;
  close(): Promise<void>;
}

export interface DubPlayerOptions {
  sampleRate?: number;
  /** Skip a phrase that would start more than this long after it was spoken. */
  maxLagMs?: number;
  /** Small scheduling lead so the first chunk isn't clipped. */
  leadSeconds?: number;
  createContext?: () => DubAudioContext;
  now?: () => number;
  /** Dubbed audio started (true) or ran out (false). */
  onPlaying?: (playing: boolean) => void;
  /** Delay of the phrase that just started, in ms (see DubState.delayMs). */
  onDelay?: (ms: number) => void;
  onSkipped?: () => void;
}

interface Phrase {
  spokenAt: number;
  /** Paused time already counted when the phrase was registered. */
  pausedBase: number;
  state: "waiting" | "playing" | "skipped";
  /** Audio that arrived but isn't scheduled yet (an earlier phrase is still in front). */
  chunks: Int16Array[];
  /** No more audio will come. */
  ended: boolean;
}

export class DubPlayer {
  private ctx: DubAudioContext | null = null;
  private gain: GainNode | null = null;
  private volume = 1;
  private nextTime = 0;
  private phrases = new Map<number, Phrase>();
  private sources = new Set<AudioBufferSourceNode>();
  private paused = false;
  private pausedSince = 0;
  private pausedTotal = 0;
  private playing = false;
  private readonly sampleRate: number;
  private readonly maxLagMs: number;
  private readonly lead: number;
  private readonly now: () => number;

  constructor(private readonly opts: DubPlayerOptions = {}) {
    this.sampleRate = opts.sampleRate ?? DUB_SAMPLE_RATE;
    this.maxLagMs = opts.maxLagMs ?? 8000;
    this.lead = opts.leadSeconds ?? 0.05;
    this.now = opts.now ?? Date.now;
  }

  private context(): DubAudioContext {
    if (!this.ctx) {
      const ctx = this.opts.createContext?.() ?? (new AudioContext({ latencyHint: "interactive" }) as DubAudioContext);
      const gain = ctx.createGain();
      gain.gain.value = this.volume;
      gain.connect(ctx.destination);
      this.ctx = ctx;
      this.gain = gain;
      if (this.paused) void ctx.suspend().catch(() => undefined);
      else if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
    }
    return this.ctx;
  }

  /** Register a phrase before its audio arrives, in spoken order. */
  begin(seq: number, spokenAt: number): void {
    if (!this.phrases.has(seq)) this.phrases.set(seq, { spokenAt, pausedBase: this.pausedMs(), state: "waiting", chunks: [], ended: false });
  }

  /** Audio for a phrase (PCM16 mono). Unknown phrases are ignored (they were cleared). */
  push(seq: number, pcm: Int16Array): void {
    const phrase = this.phrases.get(seq);
    if (!phrase || phrase.state === "skipped" || pcm.length === 0) return;
    phrase.chunks.push(pcm);
    this.drain();
  }

  /** No more audio will come for a phrase (finished, merged or dropped). */
  end(seq: number): void {
    const phrase = this.phrases.get(seq);
    if (!phrase) return;
    phrase.ended = true;
    this.drain();
  }

  /** Schedule audio of the phrase at the front, then the next one once it's done. */
  private drain() {
    for (const [seq, head] of this.phrases) {
      if (head.state !== "skipped" && head.chunks.length === 0 && !head.ended && this.blockedTooLong(head)) {
        head.state = "skipped";
        this.opts.onSkipped?.();
      }
      if (head.state !== "skipped") {
        for (const pcm of head.chunks.splice(0)) this.schedule(head, pcm);
      }
      if (head.state === "skipped" || head.ended) {
        this.phrases.delete(seq);
        continue;
      }
      return;
    }
  }

  /**
   * A phrase with no audio yet, holding up later ones that have theirs, is given up once it
   * would be too late to play anyway.
   */
  private blockedTooLong(head: Phrase): boolean {
    let later = false;
    for (const p of this.phrases.values()) if (p !== head && p.chunks.length > 0) later = true;
    return later && this.now() - head.spokenAt - (this.pausedMs() - head.pausedBase) > this.maxLagMs;
  }

  private schedule(phrase: Phrase, pcm: Int16Array) {
    if (phrase.state === "skipped") return;
    const ctx = this.context();
    const start = Math.max(ctx.currentTime + this.lead, this.nextTime);

    if (phrase.state === "waiting") {
      const age = this.now() - phrase.spokenAt - (this.pausedMs() - phrase.pausedBase);
      const delay = Math.round(age + (start - ctx.currentTime) * 1000);
      if (delay > this.maxLagMs) {
        phrase.state = "skipped";
        this.opts.onSkipped?.();
        return;
      }
      phrase.state = "playing";
      this.opts.onDelay?.(delay);
    }

    const buffer = ctx.createBuffer(1, pcm.length, this.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) data[i] = pcm[i]! / 0x8000;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.gain!);
    source.onended = () => {
      this.sources.delete(source);
      try {
        source.disconnect();
      } catch {
        /* already disconnected */
      }
      if (this.sources.size === 0) this.setPlaying(false);
    };
    this.sources.add(source);
    source.start(start);
    this.nextTime = start + pcm.length / this.sampleRate;
    this.setPlaying(true);
  }

  /** Stop and drop everything queued (seek, new language, dubbing off). */
  clear(): void {
    this.phrases.clear();
    for (const s of this.sources) {
      s.onended = null;
      try {
        s.stop();
        s.disconnect();
      } catch {
        /* not started or already stopped */
      }
    }
    this.sources.clear();
    this.nextTime = 0;
    this.setPlaying(false);
  }

  setVolume(volume: number): void {
    this.volume = Math.min(1, Math.max(0, volume));
    if (this.gain) this.gain.gain.value = this.volume;
  }

  /** Follow the source video: a paused video pauses the dub where it is. */
  setPaused(paused: boolean): void {
    if (paused === this.paused) return;
    this.paused = paused;
    if (paused) this.pausedSince = this.now();
    else this.pausedTotal += this.now() - this.pausedSince;
    if (!this.ctx) return;
    void (paused ? this.ctx.suspend() : this.ctx.resume()).catch(() => undefined);
  }

  /** Seconds of dubbed audio scheduled but not yet played. */
  get backlogSeconds(): number {
    return this.ctx ? Math.max(0, this.nextTime - this.ctx.currentTime) : 0;
  }

  async close(): Promise<void> {
    this.clear();
    const ctx = this.ctx;
    this.ctx = null;
    this.gain = null;
    await ctx?.close().catch(() => undefined);
  }

  private pausedMs() {
    return this.pausedTotal + (this.paused ? this.now() - this.pausedSince : 0);
  }

  private setPlaying(playing: boolean) {
    if (playing === this.playing) return;
    this.playing = playing;
    this.opts.onPlaying?.(playing);
  }
}
