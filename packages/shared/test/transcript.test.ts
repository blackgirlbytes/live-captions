import { describe, expect, it } from "vitest";
import { initialTranscriptState, reduceTranscript, TranscriptAssembler, type DgResults } from "../src/core/transcript";
import type { TranscriptEvent, TranscriptState } from "../src/core/types";

function words(text: string, start: number, step = 0.3) {
  return text.split(" ").map((w, i) => ({ word: w.toLowerCase(), punctuated_word: w, start: start + i * step, end: start + i * step + 0.25 }));
}
function res(text: string, start: number, duration: number, opts: { final?: boolean; speechFinal?: boolean } = {}): DgResults {
  return {
    type: "Results",
    start,
    duration,
    is_final: opts.final ?? false,
    speech_final: opts.speechFinal ?? false,
    channel: { alternatives: [{ transcript: text, words: opts.final ? words(text, start) : [] }] },
  };
}
function harness(mediaTimeAt?: (t: number) => number | null) {
  let state: TranscriptState = initialTranscriptState();
  const events: TranscriptEvent[] = [];
  const a = new TranscriptAssembler(
    (e) => {
      events.push(e);
      state = reduceTranscript(state, e);
    },
    { mediaTimeAt, now: () => 1000 },
  );
  return { a, get state() { return state; }, events };
}

describe("TranscriptAssembler", () => {
  it("shows interim text as caption and replaces it", () => {
    const h = harness();
    h.a.handleResults(res("hello", 0, 0.5), 0);
    expect(h.state.caption.text).toBe("hello");
    expect(h.state.caption.hasInterim).toBe(true);
    h.a.handleResults(res("hello there", 0, 1), 0);
    expect(h.state.caption.text).toBe("hello there");
    expect(h.state.lines).toHaveLength(0);
  });

  it("accumulates finals and commits a line on speech_final", () => {
    const h = harness();
    h.a.handleResults(res("Hello there.", 0, 1, { final: true }), 0);
    expect(h.state.lines).toHaveLength(0);
    h.a.handleResults(res("General Kenobi.", 1, 1, { final: true, speechFinal: true }), 0);
    expect(h.state.lines).toHaveLength(1);
    expect(h.state.lines[0]!.text).toBe("Hello there. General Kenobi.");
    expect(h.state.lines[0]!.start).toBe(0);
  });

  it("commits on UtteranceEnd", () => {
    const h = harness();
    h.a.handleResults(res("Testing one two", 0, 1.2, { final: true }), 0);
    h.a.handleUtteranceEnd();
    expect(h.state.lines.map((l) => l.text)).toEqual(["Testing one two"]);
  });

  it("applies connection offset so timestamps continue after a reconnect", () => {
    const h = harness();
    h.a.handleResults(res("First line", 0, 1, { final: true, speechFinal: true }), 0);
    h.a.handleResults(res("Second line", 0, 1, { final: true, speechFinal: true }), 30);
    expect(h.state.lines[1]!.start).toBe(30);
  });

  it("drops duplicate words already finalized (replay after reconnect)", () => {
    const h = harness();
    h.a.handleResults(res("one two three", 10, 1, { final: true }), 0);
    // Replayed audio overlapping [10, 11) arrives on a new connection whose offset is 10.5.
    const replay: DgResults = {
      type: "Results",
      start: 0,
      duration: 1.5,
      is_final: true,
      speech_final: true,
      channel: {
        alternatives: [
          {
            transcript: "three four five",
            words: [
              { word: "three", start: 0.1, end: 0.35 },
              { word: "four", start: 0.6, end: 0.85 },
              { word: "five", start: 0.9, end: 1.2 },
            ],
          },
        ],
      },
    };
    h.a.handleResults(replay, 10.5);
    expect(h.state.lines[0]!.text).toBe("one two three four five");
  });

  it("ignores an identical final delivered twice", () => {
    const h = harness();
    const r = res("Same thing", 2, 1, { final: true });
    h.a.handleResults(r, 0);
    h.a.handleResults(r, 0);
    h.a.flush();
    expect(h.state.lines.map((l) => l.text)).toEqual(["Same thing"]);
  });

  it("maps line times into media time", () => {
    const h = harness((t) => t + 100);
    h.a.handleResults(res("Mapped", 5, 1, { final: true, speechFinal: true }), 0);
    expect(h.state.lines[0]!.mediaStart).toBe(105);
  });

  it("splits very long monologues", () => {
    const h = harness();
    const sentence = "This is a fairly long sentence that keeps going and going.";
    for (let i = 0; i < 6; i++) h.a.handleResults(res(sentence, i * 4, 4, { final: true }), 0);
    expect(h.state.lines.length).toBeGreaterThanOrEqual(2);
    for (const l of h.state.lines) expect(l.text.length).toBeLessThanOrEqual(330);
  });

  it("flush with clearCaption empties caption and drops interim", () => {
    const h = harness();
    h.a.handleResults(res("pending words", 0, 1, { final: true }), 0);
    h.a.handleResults(res("interim", 1, 0.5), 0);
    h.a.flush({ clearCaption: true });
    expect(h.state.lines.map((l) => l.text)).toEqual(["pending words"]);
    expect(h.state.caption.text).toBe("");
  });
});

describe("reduceTranscript", () => {
  it("ignores duplicate line ids", () => {
    let s = initialTranscriptState();
    const line = { id: "x", text: "a", start: 0, end: 1, mediaStart: null, mediaEnd: null, createdAt: 0 };
    s = reduceTranscript(s, { type: "line", line });
    s = reduceTranscript(s, { type: "line", line });
    expect(s.lines).toHaveLength(1);
  });
});

describe("line splitting", () => {
  it("splits continuous speech at sentence boundaries when speech_final never arrives", () => {
    const h = harness();
    h.a.handleResults(res("Yeah. As much as it's worth celebrating the first spacewalk with an all female team, I think many of us", 0, 4, { final: true }), 0);
    h.a.handleResults(res("are looking forward to it just being normal. And I think if it signifies anything, it is", 4, 4, { final: true }), 0);
    expect(h.state.lines).toHaveLength(1);
    expect(h.state.lines[0]!.text.endsWith("being normal.")).toBe(true);
    expect(h.state.caption.text.startsWith("And I think")).toBe(true);
  });
});
