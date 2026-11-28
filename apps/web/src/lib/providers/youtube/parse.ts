import type { ParsedVideo, ParseProblem } from "../types";

const ID = /^[A-Za-z0-9_-]{11}$/;
const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;
const HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

/** "90", "90s", "1m30s", "1h2m3s" → seconds. */
export function parseYouTubeTime(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const v = raw.trim();
  if (/^\d+(\.\d+)?$/.test(v)) return Math.floor(Number(v)) || undefined;
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i.exec(v);
  if (!m || (!m[1] && !m[2] && !m[3])) return undefined;
  const total = Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  return total || undefined;
}

function video(id: string, url: URL, live: boolean): ParsedVideo {
  const startSeconds = parseYouTubeTime(url.searchParams.get("t") ?? url.searchParams.get("start") ?? hashTime(url));
  const canonical = new URL(`https://www.youtube.com/watch?v=${id}`);
  if (startSeconds) canonical.searchParams.set("t", `${startSeconds}s`);
  return {
    providerId: "youtube",
    key: `youtube:${id}`,
    canonicalUrl: canonical.toString(),
    embed: { videoId: id },
    startSeconds,
    maybeLive: live,
  };
}

function hashTime(url: URL): string | null {
  const m = /[#&]t=([^&]+)/.exec(url.hash);
  return m?.[1] ?? null;
}

export function parseYouTubeUrl(url: URL): ParsedVideo | ParseProblem | null {
  const host = url.hostname.toLowerCase();
  const segs = url.pathname.split("/").filter(Boolean);

  if (host === "youtu.be" || host === "www.youtu.be") {
    const id = segs[0];
    return id && ID.test(id) ? video(id, url, false) : null;
  }
  if (!HOSTS.has(host)) return null;

  const [first, second, third] = segs;
  if (!first) return null;

  if (first === "watch") {
    const id = url.searchParams.get("v");
    return id && ID.test(id) ? video(id, url, false) : null;
  }
  if (["embed", "shorts", "live", "v", "e"].includes(first) && second && ID.test(second)) {
    return video(second, url, first === "live");
  }
  if (first === "embed" && second === "live_stream") {
    const channel = url.searchParams.get("channel");
    if (channel && CHANNEL_ID.test(channel)) return channelLive(channel);
  }
  if (first === "channel" && second && CHANNEL_ID.test(second)) {
    if (third === "live" || third === "streams" || !third) return channelLive(second);
  }
  if (first.startsWith("@") || first === "c" || first === "user") {
    return {
      providerId: "youtube",
      kind: "channel",
      message:
        "Channel links like @handle/live can't be opened directly. Open the stream on YouTube, copy the video link (youtube.com/watch?v=… or youtube.com/live/…) and paste it here.",
    };
  }
  return null;
}

function channelLive(channelId: string): ParsedVideo {
  return {
    providerId: "youtube",
    key: `youtube:channel:${channelId}`,
    canonicalUrl: `https://www.youtube.com/channel/${channelId}/live`,
    embed: { channelId },
    maybeLive: true,
  };
}
