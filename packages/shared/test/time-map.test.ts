import { describe, expect, it } from "vitest";
import { StreamTimeMap } from "../src/core/time-map";

describe("StreamTimeMap", () => {
  it("maps steady playback and compacts samples", () => {
    const m = new StreamTimeMap();
    for (let i = 1; i <= 50; i++) m.record(i * 0.1, 20 + i * 0.1);
    expect(m.mediaAt(2.05)).toBeCloseTo(22.05, 5);
    expect(m.size).toBeLessThan(10);
  });
  it("handles a seek", () => {
    const m = new StreamTimeMap();
    for (let i = 1; i <= 20; i++) m.record(i * 0.1, i * 0.1); // 0..2s at media 0..2
    for (let i = 21; i <= 40; i++) m.record(i * 0.1, 100 + (i - 20) * 0.1); // seek to 100
    expect(m.mediaAt(1.0)).toBeCloseTo(1.0, 5);
    expect(m.mediaAt(3.0)).toBeCloseTo(101.0, 5);
  });
  it("returns null without media time", () => {
    const m = new StreamTimeMap();
    m.record(0.1, null);
    expect(m.mediaAt(0.05)).toBeNull();
    expect(new StreamTimeMap().mediaAt(1)).toBeNull();
  });
});
