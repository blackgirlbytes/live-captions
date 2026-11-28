import type { ParsedVideo, ParseProblem } from "../types";
import { parseYouTubeTime } from "../youtube/parse";

const HOSTS = new Set(["twitch.tv", "www.twitch.tv", "m.twitch.tv", "go.twitch.tv", "player.twitch.tv"]);
const CLIP_HOSTS = new Set(["clips.twitch.tv"]);
/** Twitch logins: letters, digits and underscores. */
const LOGIN = /^[A-Za-z0-9_]{2,25}$/;
const VIDEO_ID = /^\d{5,}$/;
/** First path segments that are Twitch pages, not channels. */
const RESERVED = new Set([
  "bits", "broadcast", "creatorcamp", "dashboard", "directory", "downloads", "drops", "embed",
  "friends", "inventory", "jobs", "login", "messages", "moderator", "p", "payments", "popout",
  "prime", "privacy", "products", "search", "settings", "signup", "store", "subscriptions",
  "team", "turbo", "u", "user", "videos", "wallet",
]);

const CLIP_MESSAGE =
  "Twitch clips can't be captioned here yet, because Twitch's clip player has no playback controls for other sites. Open the clip on Twitch and use the Heard Chrome extension, or paste the channel or video link.";

/** Seconds → Twitch's "1h2m3s" time format. */
export function formatTwitchTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 3600)}h${Math.floor((s % 3600) / 60)}m${s % 60}s`;
}

function vod(id: string, url: URL): ParsedVideo {
  const startSeconds = parseYouTubeTime(url.searchParams.get("t") ?? url.searchParams.get("time"));
  const canonical = new URL(`https://www.twitch.tv/videos/${id}`);
  if (startSeconds) canonical.searchParams.set("t", formatTwitchTime(startSeconds));
  return {
    providerId: "twitch",
    key: `twitch:video:${id}`,
    canonicalUrl: canonical.toString(),
    embed: { videoId: id },
    startSeconds,
    maybeLive: false,
  };
}

function channel(login: string): ParsedVideo {
  const name = login.toLowerCase();
  return {
    providerId: "twitch",
    key: `twitch:channel:${name}`,
    canonicalUrl: `https://www.twitch.tv/${name}`,
    embed: { channel: name },
    maybeLive: true,
  };
}

function clip(url: URL): ParseProblem {
  const open = new URL(url.toString());
  open.protocol = "https:";
  return { providerId: "twitch", kind: "clip", platformName: "Twitch", openUrl: open.toString(), message: CLIP_MESSAGE };
}

export function parseTwitchUrl(url: URL): ParsedVideo | ParseProblem | null {
  const host = url.hostname.toLowerCase();
  const segs = url.pathname.split("/").filter(Boolean);

  if (CLIP_HOSTS.has(host)) return segs[0] || url.searchParams.get("clip") ? clip(url) : null;
  if (!HOSTS.has(host)) return null;

  // The embed player's own URL: player.twitch.tv/?channel=… or ?video=v123.
  if (host === "player.twitch.tv") {
    const v = url.searchParams.get("video")?.replace(/^v/, "");
    if (v && VIDEO_ID.test(v)) return vod(v, url);
    const c = url.searchParams.get("channel");
    return c && LOGIN.test(c) ? channel(c) : null;
  }

  const [first, second, third] = segs;
  if (!first) return null;

  if (first === "videos" && second && VIDEO_ID.test(second)) return vod(second, url);
  if (RESERVED.has(first.toLowerCase()) || !LOGIN.test(first)) return null;
  // twitch.tv/<channel>/clip/<slug>
  if (second === "clip" && third) return clip(url);
  // Older VOD links: twitch.tv/<channel>/v/<id> or /video/<id>.
  if ((second === "v" || second === "video") && third && VIDEO_ID.test(third)) return vod(third, url);
  // The channel page, or its about / schedule tabs: caption whatever is live there.
  if (!second || second === "about" || second === "schedule") return channel(first);
  return null;
}
