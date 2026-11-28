import { describe, expect, it } from "vitest";
import { isPortrait, pickMainVideo, placeOnVideo, videoFontScale, type VideoCandidate } from "../utils/video-geometry";

const vp = { w: 1440, h: 900 };
const rect = (left: number, top: number, width: number, height: number) => ({ left, top, width, height });

describe("pickMainVideo", () => {
  it("prefers the playing, audible video over bigger muted feed previews", () => {
    const candidates: VideoCandidate[] = [
      { rect: rect(300, 80, 700, 394), paused: false, audible: false }, // autoplaying muted preview
      { rect: rect(360, 420, 560, 315), paused: false, audible: true }, // the live stream the user unmuted
    ];
    expect(pickMainVideo(candidates, vp)).toBe(1);
  });

  it("prefers a playing video over a paused one of similar size", () => {
    const candidates: VideoCandidate[] = [
      { rect: rect(100, 100, 640, 360), paused: true, audible: true },
      { rect: rect(760, 100, 600, 338), paused: false, audible: true },
    ];
    expect(pickMainVideo(candidates, vp)).toBe(1);
  });

  it("ignores thumbnails and off-screen videos", () => {
    const candidates: VideoCandidate[] = [
      { rect: rect(10, 10, 160, 90), paused: false, audible: true },
      { rect: rect(100, 1200, 800, 450), paused: false, audible: true },
    ];
    expect(pickMainVideo(candidates, vp)).toBe(-1);
  });
});

describe("placement", () => {
  it("keeps landscape captions near the bottom of the video", () => {
    const video = rect(100, 100, 960, 540);
    const pos = placeOnVideo(video, 80, vp);
    expect(pos.width).toBeCloseTo(960 * 0.82);
    expect(pos.top + 80).toBeGreaterThan(100 + 540 - 60);
    expect(pos.left).toBeCloseTo(100 + (960 - pos.width) / 2);
  });

  it("raises portrait captions above the comment area and keeps them readable", () => {
    const video = rect(550, 40, 340, 604); // TikTok / Instagram Live on desktop
    expect(isPortrait(video)).toBe(true);
    const pos = placeOnVideo(video, 80, vp);
    expect(pos.width).toBeGreaterThanOrEqual(340 * 0.92);
    expect(pos.top + 80).toBeLessThanOrEqual(40 + 604 * 0.72 + 1);
    // Centered on the video.
    expect(pos.left + pos.width / 2).toBeCloseTo(550 + 340 / 2);
  });

  it("stays inside a narrow viewport", () => {
    const pos = placeOnVideo(rect(0, 0, 300, 560), 80, { w: 320, h: 640 });
    expect(pos.left).toBeGreaterThanOrEqual(8);
    expect(pos.left + pos.width).toBeLessThanOrEqual(320 - 8);
  });
});

describe("videoFontScale", () => {
  it("grows with big landscape players", () => {
    expect(videoFontScale(rect(0, 0, 1707, 960))).toBe(2);
  });

  it("doesn't blow up text on tall portrait players", () => {
    expect(videoFontScale(rect(0, 0, 450, 800))).toBe(1);
  });
});
