/**
 * Back half of live dubbing: translated phrases → Flux TTS → playback queue, plus the
 * status the UI shows. Runs in a context whose audio is NOT being captured (the extension's
 * offscreen document), so the dub is never transcribed again.
 *
 * Each speaker gets a voice (see VoiceCaster), and each voice its own Flux connection.
 * The player keeps phrases in spoken order, so voices take turns and never overlap.
 */
import type { DeepgramCredential } from "../types";
import { VoiceCaster } from "./cast";
import { FluxSpeaker, type SpeakerStatus } from "./flux-tts";
import type { PitchEstimate } from "./pitch";
import { DubPlayer, type DubAudioContext } from "./player";
import { INITIAL_DUB_STATE, type DubSegment, type DubState } from "./types";

export interface DubOutputOptions {
  getToken: () => Promise<string | DeepgramCredential>;
  /** What's known so far about how low or high a speaker's voice is. */
  pitchOf?: (speaker: string) => PitchEstimate | null;
  onState?: (state: DubState) => void;
  /** Livestreams should stay closer to live than recorded videos. */
  maxLagMs?: number;
  speakBaseUrl?: string;
  createContext?: () => DubAudioContext;
  WebSocketImpl?: typeof WebSocket;
}

interface Voice {
  speaker: FluxSpeaker;
  status: SpeakerStatus;
  error: string | null;
}

export class DubOutput {
  private state: DubState = INITIAL_DUB_STATE;
  private caster: VoiceCaster | null = null;
  private voices = new Map<string, Voice>();
  private translating = false;
  private playing = false;
  private lastSeq = 0;
  private readonly player: DubPlayer;

  constructor(private readonly opts: DubOutputOptions) {
    this.player = new DubPlayer({
      maxLagMs: opts.maxLagMs,
      createContext: opts.createContext,
      onPlaying: (p) => {
        this.playing = p;
        this.refresh();
      },
      onDelay: (ms) => this.update({ delayMs: ms }),
      onSkipped: () => this.update({ skipped: this.state.skipped + 1 }),
    });
  }

  getState(): DubState {
    return this.state;
  }

  get enabled(): boolean {
    return this.caster !== null;
  }

  /** Voices with an open or opening connection (for tests and diagnostics). */
  get activeVoices(): string[] {
    return [...this.voices.keys()];
  }

  /**
   * Turn dubbing on, or switch language or accent. Everything queued for older voices is
   * dropped. The likely first voices connect right away so the first phrase isn't delayed.
   */
  enable(language: string, accent = ""): void {
    const failed = [...this.voices.values()].some((v) => v.status === "failed");
    if (this.caster && this.caster.language === language && this.caster.accent === accent && !failed) {
      for (const id of this.caster.likelyVoices) this.voice(id).speaker.warm();
      return;
    }
    this.teardownVoices();
    this.player.clear();
    this.lastSeq = 0;
    this.update({ ...INITIAL_DUB_STATE, status: "listening" });
    this.caster = new VoiceCaster(language, accent);
    for (const id of this.caster.likelyVoices) this.voice(id).speaker.warm();
    this.refresh();
  }

  /** Turn dubbing off: stop speech now and cancel pending synthesis. */
  disable(): void {
    this.teardownVoices();
    this.caster = null;
    this.player.clear();
    this.translating = false;
    this.playing = false;
    this.lastSeq = 0;
    this.update({ ...INITIAL_DUB_STATE });
  }

  /** A translated phrase. Repeats (same or older `seq`) are ignored. */
  speak(segment: DubSegment): void {
    if (!this.caster || segment.seq <= this.lastSeq) return;
    if ([...this.voices.values()].some((v) => v.status === "failed")) return;
    this.lastSeq = segment.seq;
    const pitch = segment.speaker ? (this.opts.pitchOf?.(segment.speaker) ?? null) : null;
    const id = this.caster.voiceFor(segment.speaker, pitch);
    this.player.begin(segment.seq, segment.spokenAt);
    this.voice(id).speaker.speak(segment);
  }

  /** The front half is translating a phrase (status only). */
  setTranslating(busy: boolean): void {
    this.translating = busy;
    this.refresh();
  }

  /** Drop queued and in-flight speech (seek, new video, new language). */
  clear(): void {
    this.player.clear();
    for (const v of this.voices.values()) v.speaker.reset();
    this.lastSeq = 0;
  }

  setPaused(paused: boolean): void {
    this.player.setPaused(paused);
  }

  async close(): Promise<void> {
    this.teardownVoices();
    this.caster = null;
    await this.player.close();
  }

  /** The connection for a voice, opened on first use and kept ready afterwards. */
  private voice(id: string): Voice {
    const had = this.voices.get(id);
    if (had) return had;
    const v: Voice = { speaker: null as unknown as FluxSpeaker, status: "idle", error: null };
    v.speaker = new FluxSpeaker({
      voice: id,
      keepWarm: true,
      getToken: this.opts.getToken,
      baseUrl: this.opts.speakBaseUrl,
      WebSocketImpl: this.opts.WebSocketImpl,
      onAudio: (seq, pcm) => this.player.push(seq, pcm),
      onTurnEnd: (seq) => this.player.end(seq),
      onStatus: (status, error) => {
        v.status = status;
        v.error = error;
        if (status === "failed") {
          // A failed voice (almost always a rejected key) means every voice will fail.
          this.player.clear();
          for (const other of this.voices.values()) if (other !== v) other.speaker.close();
        }
        this.refresh();
      },
    });
    this.voices.set(id, v);
    return v;
  }

  private teardownVoices() {
    const voices = [...this.voices.values()];
    this.voices.clear();
    for (const v of voices) v.speaker.close();
  }

  private refresh() {
    if (!this.caster) return;
    const all = [...this.voices.values()];
    const failed = all.find((v) => v.status === "failed");
    if (failed) return this.update({ status: "unavailable", error: failed.error });
    const reconnecting = all.find((v) => v.status === "reconnecting");
    if (reconnecting) return this.update({ status: "reconnecting", error: reconnecting.error });
    if (this.playing) return this.update({ status: "playing", error: null });
    if (all.some((v) => v.status === "connecting")) return this.update({ status: "connecting", error: null });
    this.update({ status: this.translating ? "translating" : "listening", error: null });
  }

  private update(patch: Partial<DubState>) {
    const next = { ...this.state, ...patch };
    if (
      next.status === this.state.status &&
      next.error === this.state.error &&
      next.delayMs === this.state.delayMs &&
      next.skipped === this.state.skipped
    ) {
      return;
    }
    this.state = next;
    this.opts.onState?.(next);
  }
}
