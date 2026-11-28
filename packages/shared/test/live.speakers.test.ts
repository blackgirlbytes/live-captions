/**
 * Live check of per-speaker dubbing voices against the real Deepgram API (skipped without a
 * key). Bills a few hundred characters of Flux TTS and about half a minute of speech-to-text.
 *
 *   DEEPGRAM_API_KEY=... npx vitest run test/live.speakers.test.ts
 *
 * Makes a two-person conversation with Flux TTS (a lower and a higher English voice), streams
 * it at real-time pace through TranscriptionSession with speaker labels on, measures each
 * speaker's pitch with SpeakerPitch from the same audio, and casts Spanish voices for them.
 */
import { describe, expect, it, vi } from "vitest";

const feeder = vi.hoisted(() => ({ onChunk: null as null | ((b: ArrayBuffer) => void) }));
vi.mock("../src/core/audio", async (orig) => {
  const actual = await orig<typeof import("../src/core/audio")>();
  return {
    ...actual,
    startPcmCapture: async (o: { onChunk: (b: ArrayBuffer) => void }) => {
      feeder.onChunk = o.onChunk;
      return { sampleRate: 16000, setPlaybackVolume() {}, stop: async () => undefined };
    },
  };
});

import { SpeakerPitch, VoiceCaster, voicesFor } from "../src/core/dubbing";
import { TranscriptionSession } from "../src/core/session";
import type { TranscriptLine } from "../src/core/types";

const KEY = process.env.DEEPGRAM_API_KEY;

async function say(voice: string, text: string): Promise<Int16Array> {
  const res = await fetch(`https://api.deepgram.com/v2/speak?model=${voice}&encoding=linear16&sample_rate=16000&container=none`, {
    method: "POST",
    headers: { Authorization: `Token ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`speak ${voice}: HTTP ${res.status} ${await res.text()}`);
  const buf = await res.arrayBuffer();
  return new Int16Array(buf.slice(0, buf.byteLength - (buf.byteLength % 2)));
}

const TURNS: Array<[string, string]> = [
  ["flux-cole-en", "Welcome back to the show. Today we are talking about how cities plan for heavy rain."],
  ["flux-hannah-en", "Thanks for having me. The short answer is that most drains were built for a different climate."],
  ["flux-cole-en", "So what should a city do first, if the budget is small?"],
  ["flux-hannah-en", "Start by mapping where the water actually goes. That alone changes a lot of decisions."],
];

describe.skipIf(!KEY)("speakers live (real API)", () => {
  it("labels two speakers, tells their pitch apart, and gives each a matching voice", async () => {
    const parts = await Promise.all(TURNS.map(([voice, text]) => say(voice, text)));
    const gap = new Int16Array(16000); // 1 s between turns
    const audio = new Int16Array(parts.reduce((n, p) => n + p.length + gap.length, 0));
    let at = 0;
    for (const p of parts) {
      audio.set(p, at);
      at += p.length + gap.length;
    }

    const pitch = new SpeakerPitch();
    const lines: TranscriptLine[] = [];
    const session = new TranscriptionSession({
      getToken: async () => ({ type: "token", value: KEY! }),
      workletUrl: "unused-in-test",
      onAudio: (pcm, start) => pitch.addAudio(pcm, start),
      onEvent: (e) => {
        if (e.type !== "line") return;
        lines.push(e.line);
        if (e.line.speaker) pitch.measure(e.line.speaker, e.line.start, e.line.end);
      },
    });
    session.setLanguages("en", "");
    session.setDiarize(true);
    await session.start({ getTracks: () => [], getAudioTracks: () => [{}] } as unknown as MediaStream);
    for (let i = 0; i < audio.length; i += 1600) {
      feeder.onChunk!(audio.slice(i, i + 1600).buffer);
      await new Promise((r) => setTimeout(r, 100));
    }
    await session.stop();

    const speakers = [...new Set(lines.map((l) => l.speaker).filter((s): s is string => !!s))];
    const caster = new VoiceCaster("es", "");
    const report = speakers.map((s) => {
      const p = pitch.get(s);
      const voice = caster.voiceFor(s, p);
      return { speaker: s, hz: p && Math.round(p.hz), voicedSeconds: p && +p.seconds.toFixed(1), voice };
    });
    console.log(lines.map((l) => `${l.speaker}: ${l.text}`).join("\n"));
    console.log(report);

    expect(speakers).toHaveLength(2);
    const gender = (id: string) => voicesFor("es").find((v) => v.id === id)!.gender;
    const bySpeaker = Object.fromEntries(report.map((r) => [r.speaker, r]));
    // Cole speaks first, so he's speaker 0.
    const cole = bySpeaker[lines[0]!.speaker!]!;
    const hannah = report.find((r) => r !== cole)!;
    expect(cole.hz!).toBeLessThan(hannah.hz!);
    expect(gender(cole.voice)).toBe("m");
    expect(gender(hannah.voice)).toBe("f");
  }, 120_000);
});
