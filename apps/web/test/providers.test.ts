import { describe, expect, it } from "vitest";
import { resolveVideo, type ParsedVideo, type ParseProblem } from "../src/lib/providers";
import { formatTwitchTime, parseTwitchUrl } from "../src/lib/providers/twitch/parse";

const twitch = (href: string) => parseTwitchUrl(new URL(href));
const video = (v: ParsedVideo | ParseProblem | null) => v as ParsedVideo;
const problem = (v: ParsedVideo | ParseProblem | null) => v as ParseProblem;

describe("parseTwitchUrl", () => {
  it("reads live channels", () => {
    for (const href of [
      "https://www.twitch.tv/SomeStreamer",
      "https://twitch.tv/somestreamer",
      "https://m.twitch.tv/somestreamer",
      "https://www.twitch.tv/somestreamer/about",
      "https://player.twitch.tv/?channel=somestreamer&parent=example.com",
    ]) {
      const v = video(twitch(href));
      expect(v.key, href).toBe("twitch:channel:somestreamer");
      expect(v.embed).toEqual({ channel: "somestreamer" });
      expect(v.maybeLive).toBe(true);
      expect(v.canonicalUrl).toBe("https://www.twitch.tv/somestreamer");
    }
  });

  it("reads VODs with start times", () => {
    const v = video(twitch("https://www.twitch.tv/videos/2123456789?t=1h2m3s"));
    expect(v.key).toBe("twitch:video:2123456789");
    expect(v.embed).toEqual({ videoId: "2123456789" });
    expect(v.startSeconds).toBe(3723);
    expect(v.maybeLive).toBe(false);
    expect(v.canonicalUrl).toBe("https://www.twitch.tv/videos/2123456789?t=1h2m3s");

    expect(video(twitch("https://www.twitch.tv/videos/2123456789")).startSeconds).toBeUndefined();
    expect(video(twitch("https://www.twitch.tv/somestreamer/v/2123456789")).key).toBe("twitch:video:2123456789");
    expect(video(twitch("https://player.twitch.tv/?video=v2123456789&parent=x")).key).toBe("twitch:video:2123456789");
  });

  it("explains that clips aren't supported", () => {
    for (const href of ["https://clips.twitch.tv/FunnyClipSlug-abc", "https://www.twitch.tv/somestreamer/clip/FunnyClipSlug-abc"]) {
      const p = problem(twitch(href));
      expect(p.kind, href).toBe("clip");
      expect(p.openUrl).toBe(href);
    }
  });

  it("ignores Twitch pages that aren't channels or videos", () => {
    for (const href of [
      "https://www.twitch.tv/",
      "https://www.twitch.tv/directory/category/just-chatting",
      "https://www.twitch.tv/settings/profile",
      "https://www.twitch.tv/videos/notanid",
      "https://www.twitch.tv/somestreamer/videos",
      "https://dev.twitch.tv/docs",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    ]) {
      expect(twitch(href), href).toBeNull();
    }
  });

  it("formats Twitch times", () => {
    expect(formatTwitchTime(3723)).toBe("1h2m3s");
    expect(formatTwitchTime(59.9)).toBe("0h0m59s");
  });
});

describe("resolveVideo", () => {
  it("picks the Twitch provider", () => {
    const r = resolveVideo("twitch.tv/somestreamer");
    expect(r.ok && r.provider.id).toBe("twitch");
  });

  it("still picks YouTube", () => {
    const r = resolveVideo("https://youtu.be/dQw4w9WgXcQ");
    expect(r.ok && r.provider.id).toBe("youtube");
  });

  it("points platforms without an embed to the extension", () => {
    const cases: Array<[string, string]> = [
      ["https://www.linkedin.com/events/7270000000000000000/", "LinkedIn"],
      ["https://www.linkedin.com/video/live/urn:li:ugcPost:7270000000000000000/", "LinkedIn"],
      ["https://x.com/i/broadcasts/1ABCdefGHIjkl", "X"],
      ["https://twitter.com/i/broadcasts/1ABCdefGHIjkl", "X"],
      ["https://www.tiktok.com/@someone/live", "TikTok"],
      ["https://www.instagram.com/someone/live/", "Instagram"],
    ];
    for (const [href, name] of cases) {
      const r = resolveVideo(href);
      expect(r.ok, href).toBe(false);
      if (r.ok) continue;
      expect(r.problem?.kind, href).toBe("extensionOnly");
      expect(r.problem?.platformName, href).toBe(name);
      expect(r.problem?.openUrl, href).toBe(href);
    }
  });

  it("doesn't mistake look-alike hosts for those platforms", () => {
    const r = resolveVideo("https://notx.com/i/broadcasts/1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problem).toBeUndefined();
  });
});
