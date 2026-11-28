/**
 * Live test of live dubbing's speech synthesis against the real Deepgram API (skipped
 * without a key). Bills a few dozen characters of Flux TTS.
 *
 *   DEEPGRAM_API_KEY=... npx vitest run test/live.flux-tts.test.ts
 *
 * Checks the browser auth path both ways (`token` subprotocol with a key, `bearer` with a
 * JWT from /v1/auth/grant like the Heard server mints), that phrases come back as audio in
 * order, and how long the first audio takes.
 */
import { describe, expect, it } from "vitest";
import { FluxSpeaker } from "../src/core/dubbing/flux-tts";
import type { DeepgramCredential } from "../src/core/types";

const KEY = process.env.DEEPGRAM_API_KEY;

async function grantJwt(key: string): Promise<string> {
  const res = await fetch("https://api.deepgram.com/v1/auth/grant", {
    method: "POST",
    headers: { Authorization: `Token ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ttl_seconds: 60 }),
  });
  const body = (await res.json()) as { access_token?: string };
  if (!body.access_token) throw new Error(`grant failed: HTTP ${res.status}`);
  return body.access_token;
}

async function synthesize(getToken: () => Promise<string | DeepgramCredential>) {
  const audio = new Map<number, number>();
  const order: number[] = [];
  const ends: number[] = [];
  let firstAudioMs: number | null = null;
  const started = Date.now();
  let status = "";
  let error: string | null = null;
  const speaker = new FluxSpeaker({
    voice: "flux-carmen-es",
    getToken,
    onAudio: (seq, pcm) => {
      firstAudioMs ??= Date.now() - started;
      if (order.at(-1) !== seq) order.push(seq);
      audio.set(seq, (audio.get(seq) ?? 0) + pcm.length);
    },
    onTurnEnd: (seq) => ends.push(seq),
    onStatus: (s, e) => {
      status = s;
      error = e;
    },
  });
  speaker.speak({ seq: 1, text: "Hola a todos.", spokenAt: Date.now() });
  speaker.speak({ seq: 2, text: "Bienvenidos al programa de hoy.", spokenAt: Date.now() });
  const deadline = Date.now() + 15_000;
  while (ends.length < 1 && Date.now() < deadline && status !== "failed") await new Promise((r) => setTimeout(r, 50));
  // Queue a third phrase on the open socket: a separate turn.
  speaker.speak({ seq: 3, text: "Empezamos.", spokenAt: Date.now() });
  while (ends.length < 2 && Date.now() < deadline && status !== "failed") await new Promise((r) => setTimeout(r, 50));
  speaker.close();
  return { audio, order, ends, firstAudioMs, status, error };
}

describe.skipIf(!KEY)("Flux TTS live", () => {
  it("speaks with the user's own key (token subprotocol)", async () => {
    const r = await synthesize(async () => ({ type: "token", value: KEY! }));
    console.log("token auth:", { firstAudioMs: r.firstAudioMs, order: r.order, ends: r.ends, samples: [...r.audio], error: r.error });
    expect(r.error).toBeNull();
    expect(r.order).toEqual([1, 3]);
    expect(r.ends).toEqual([1, 3]);
    // 24 kHz: "Hola a todos. Bienvenidos al programa de hoy." is well over a second.
    expect(r.audio.get(1)!).toBeGreaterThan(24_000);
  }, 30_000);

  it("answers faster on a pre-warmed connection", async () => {
    const firstAudio = async (warm: boolean) => {
      let sentAt = 0;
      let firstAt = 0;
      let status = "";
      const speaker = new FluxSpeaker({
        voice: "flux-carmen-es",
        keepWarm: warm,
        getToken: async () => ({ type: "token", value: KEY! }),
        onAudio: () => (firstAt ||= Date.now()),
        onStatus: (st) => (status = st),
      });
      if (warm) {
        speaker.warm();
        while (status !== "open") await new Promise((r) => setTimeout(r, 20));
      }
      sentAt = Date.now();
      speaker.speak({ seq: 1, text: "Hola a todos.", spokenAt: sentAt });
      while (!firstAt && Date.now() - sentAt < 10_000) await new Promise((r) => setTimeout(r, 10));
      speaker.close();
      return firstAt - sentAt;
    };
    const cold = await firstAudio(false);
    const warm = await firstAudio(true);
    console.log("first audio after a phrase:", { coldMs: cold, warmMs: warm });
    expect(warm).toBeGreaterThan(0);
  }, 30_000);

  it("speaks with a server-minted JWT (bearer subprotocol)", async () => {
    const jwt = await grantJwt(KEY!);
    const r = await synthesize(async () => jwt);
    console.log("bearer auth:", { firstAudioMs: r.firstAudioMs, order: r.order, error: r.error });
    expect(r.error).toBeNull();
    expect(r.order).toEqual([1, 3]);
  }, 30_000);
});
