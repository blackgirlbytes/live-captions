import { describe, expect, it } from "vitest";
import { formatTimestamp, preferredTimeBase, toPlainText, toSrt, toVtt } from "../src/core/format";
import { normalizeCaptionSettings, withOpacity } from "../src/core/settings";
import { buildListenUrl } from "../src/core/deepgram";
import type { TranscriptLine } from "../src/core/types";

const L = (text: string, start: number, end: number, mediaStart: number | null = null): TranscriptLine => ({
  id: text, text, start, end, mediaStart, mediaEnd: mediaStart === null ? null : mediaStart + (end - start), createdAt: 0,
});

describe("format", () => {
  it("formats timestamps", () => {
    expect(formatTimestamp(0)).toBe("0:00");
    expect(formatTimestamp(75.4)).toBe("1:15");
    expect(formatTimestamp(3725)).toBe("1:02:05");
  });
  it("exports SRT and VTT", () => {
    const lines = [L("Hello", 1.5, 2.75), L("World", 3, 4.2)];
    expect(toSrt(lines)).toBe("1\n00:00:01,500 --> 00:00:02,750\nHello\n\n2\n00:00:03,000 --> 00:00:04,200\nWorld\n");
    expect(toVtt(lines).startsWith("WEBVTT\n\n00:00:01.500 --> 00:00:02.750\nHello\n")).toBe(true);
  });
  it("prefers media time when all lines have it", () => {
    const lines = [L("a", 0, 1, 60), L("b", 1, 2, 61)];
    expect(preferredTimeBase(lines)).toBe("media");
    expect(toPlainText(lines)).toBe("[1:00] a\n[1:01] b");
    expect(preferredTimeBase([L("a", 0, 1, 60), L("b", 1, 2)])).toBe("stream");
  });
});

describe("settings", () => {
  it("normalizes untrusted values", () => {
    const s = normalizeCaptionSettings({ fontSize: 999, textColor: "red", position: "below", backgroundOpacity: 3 });
    expect(s.fontSize).toBe(72);
    expect(s.textColor).toBe("#ffffff");
    expect(s.position).toBe("below");
    expect(s.backgroundOpacity).toBe(1);
  });
  it("converts hex to rgba", () => {
    expect(withOpacity("#ff0080", 0.5)).toBe("rgba(255, 0, 128, 0.5)");
  });
});

describe("buildListenUrl", () => {
  it("targets nova-3 linear16 16k with interim results", () => {
    const u = new URL(buildListenUrl({ keyterms: ["Deepgram", " "] }));
    expect(u.origin + u.pathname).toBe("wss://api.deepgram.com/v1/listen");
    expect(u.searchParams.get("model")).toBe("nova-3");
    expect(u.searchParams.get("encoding")).toBe("linear16");
    expect(u.searchParams.get("sample_rate")).toBe("16000");
    expect(u.searchParams.get("interim_results")).toBe("true");
    expect(u.searchParams.getAll("keyterm")).toEqual(["Deepgram"]);
  });
});
