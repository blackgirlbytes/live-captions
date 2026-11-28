/**
 * Picks a dubbing voice for each speaker: a lower voice for a lower-pitched speaker and a
 * higher one for a higher-pitched speaker, each person a different voice where the catalog
 * has enough, all in the chosen accent.
 *
 * The Flux catalog tags voices "f"/"m"; here that only stands for higher and lower voices.
 * A speaker's pitch says how their voice sounds, not who they are.
 */
import type { PitchEstimate } from "./pitch";
import { voicesFor, type FluxVoice, type VoiceGender } from "./voices";

/** Median speaking pitch below this gets a lower voice (adult voices overlap around here). */
export const LOWER_VOICE_MAX_HZ = 160;
/** Seconds of voiced speech after which a speaker keeps their voice for good. */
export const VOICE_LOCK_SECONDS = 2.5;

interface Casting {
  voice: string;
  locked: boolean;
}

/** Key for lines without speaker labels: everyone shares one voice. */
const NO_SPEAKER = "_";

export class VoiceCaster {
  private readonly cast = new Map<string, Casting>();
  private readonly voices: readonly FluxVoice[];

  constructor(
    readonly language: string,
    readonly accent: string,
  ) {
    const all = voicesFor(language);
    const inAccent = accent ? all.filter((v) => v.accent === accent) : all;
    this.voices = inAccent.length > 0 ? inAccent : all;
  }

  /** The first lower and higher voice: the ones worth connecting before anyone speaks. */
  get likelyVoices(): string[] {
    const out = (["m", "f"] as const).map((g) => this.voices.find((v) => v.gender === g)?.id).filter((x): x is string => !!x);
    return out.length > 0 ? out : this.voices.slice(0, 1).map((v) => v.id);
  }

  /** Voice for `speaker` (a transcript line's label), given what's known of their pitch. */
  voiceFor(speaker: string | undefined, pitch: PitchEstimate | null): string {
    const key = speaker ?? NO_SPEAKER;
    const had = this.cast.get(key);
    if (had?.locked) return had.voice;

    const want: VoiceGender | null = pitch ? (pitch.hz < LOWER_VOICE_MAX_HZ ? "m" : "f") : null;
    let pool: readonly FluxVoice[] = this.voices;
    if (want) {
      const sameAccent = this.voices.filter((v) => v.gender === want);
      // An accent with only one kind of voice borrows the other kind from the language.
      const anyAccent = voicesFor(this.language).filter((v) => v.gender === want);
      pool = sameAccent.length > 0 ? sameAccent : anyAccent.length > 0 ? anyAccent : this.voices;
    }

    let voice: string;
    if (had && pool.some((v) => v.id === had.voice)) voice = had.voice;
    else voice = this.leastUsed(pool, key);
    this.cast.set(key, { voice, locked: pitch !== null && pitch.seconds >= VOICE_LOCK_SECONDS });
    return voice;
  }

  /**
   * The first voice in `pool` nobody else in this speaker's connection has. Labels from an
   * earlier connection don't count: after a reconnect the same people come back under new
   * labels, and should get the same voices again.
   */
  private leastUsed(pool: readonly FluxVoice[], key: string): string {
    const set = key.split(":")[0];
    const uses = new Map<string, number>();
    for (const [k, c] of this.cast) if (k !== key && k.split(":")[0] === set) uses.set(c.voice, (uses.get(c.voice) ?? 0) + 1);
    let best = pool[0]!;
    for (const v of pool) if ((uses.get(v.id) ?? 0) < (uses.get(best.id) ?? 0)) best = v;
    return best.id;
  }
}
