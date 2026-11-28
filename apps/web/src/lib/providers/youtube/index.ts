import type { PlayerAdapter, PlayerError, PlayerEvents, PlayerState, ParsedVideo, VideoProvider } from "../types";
import { loadYouTubeIframeApi } from "./iframe-api";
import { parseYouTubeUrl } from "./parse";

export { parseYouTubeUrl, parseYouTubeTime } from "./parse";

const STATES: Record<number, PlayerState> = {
  [-1]: "unstarted",
  0: "ended",
  1: "playing",
  2: "paused",
  3: "buffering",
  5: "unstarted",
};

export function describeYouTubeError(code: number): PlayerError {
  switch (code) {
    case 2:
      return { code: "2", embeddingBlocked: false, message: "That link doesn't point to a valid YouTube video. Check the URL and try again." };
    case 5:
      return { code: "5", embeddingBlocked: false, message: "The YouTube player hit a playback error. Reload the page, or try the video on YouTube." };
    case 100:
      return { code: "100", embeddingBlocked: false, message: "This video isn't available — it may have been removed or made private." };
    case 101:
    case 150:
      return {
        code: String(code),
        embeddingBlocked: true,
        message: "YouTube won't play this video outside youtube.com. The owner may have turned off embedding, or the video may be restricted.",
      };
    case 153:
      return { code: "153", embeddingBlocked: false, message: "YouTube refused the embed request. Reload the page and try again." };
    default:
      return { code: String(code), embeddingBlocked: false, message: `The YouTube player reported an error (${code}).` };
  }
}

/** Minimal surface of YT.Player we rely on (some methods are undocumented-but-stable). */
type YTPlayer = YT.Player;
type VideoDataWithLive = YT.VideoData & { isLive?: boolean };

function videoData(player: YTPlayer): VideoDataWithLive | undefined {
  try {
    return typeof player.getVideoData === "function" ? (player.getVideoData() as VideoDataWithLive) : undefined;
  } catch {
    return undefined;
  }
}

function createAdapter(player: YTPlayer, wrapper: HTMLElement, video: ParsedVideo, queued: { play: boolean }): PlayerAdapter {
  const ready = () => typeof player.getCurrentTime === "function";
  return {
    getCurrentTime: () => (ready() ? player.getCurrentTime() || 0 : 0),
    seekTo: (s) => {
      if (!ready()) return;
      player.seekTo(Math.max(0, s), true);
      if (player.getPlayerState() !== 1) player.playVideo();
    },
    play: () => {
      if (ready()) player.playVideo();
      else queued.play = true;
    },
    getState: () => (ready() ? (STATES[player.getPlayerState()] ?? "unstarted") : "unstarted"),
    isLive: () => {
      const data = ready() ? videoData(player) : undefined;
      if (data?.isLive) return true;
      // Livestreams report no fixed duration until (and sometimes after) they start.
      return video.maybeLive || (ready() && player.getPlayerState() === 1 && player.getDuration() === 0);
    },
    getTitle: () => {
      const title = ready() ? videoData(player)?.title : undefined;
      return title?.trim() || null;
    },
    getPlaybackRate: () => (ready() ? player.getPlaybackRate() || 1 : 1),
    destroy: () => {
      try {
        player.destroy();
      } catch {
        /* already gone */
      }
      wrapper.remove();
    },
  };
}

export const youtubeProvider: VideoProvider = {
  id: "youtube",
  name: "YouTube",
  capabilities: {
    siteHost: "youtube.com",
    // YouTube's Required Minimum Functionality forbids drawing anything in front of the
    // embedded player (see docs/provider-policies.md), so captions render below it.
    allowsCaptionOverlay: false,
    minPlayerSize: { width: 200, height: 200 },
  },
  parse: parseYouTubeUrl,

  async mount(host, video, events: PlayerEvents) {
    const YTApi = await loadYouTubeIframeApi();
    // Each mount owns its wrapper, so a quick remount (React strict mode, video switch)
    // can't tear down a newer player.
    const wrapper = document.createElement("div");
    wrapper.className = "h-full w-full";
    host.appendChild(wrapper);

    const playerVars: YT.PlayerVars = {
      fs: 0, // we provide our own fullscreen that keeps the caption bar visible
      playsinline: 1,
      rel: 0,
      enablejsapi: 1,
      origin: window.location.origin,
      start: video.startSeconds,
    };

    // play() requested before the player finished loading is replayed once it's ready.
    const queued = { play: false };
    const handlers: YT.Events = {
      onReady: (e) => {
        if (queued.play) e.target.playVideo();
        events.onReady?.();
      },
      onStateChange: (e) => events.onStateChange?.(STATES[e.data] ?? "unstarted"),
      onError: (e) => events.onError?.(describeYouTubeError(Number(e.data))),
    };

    let player: YTPlayer;
    const channelId = video.embed.channelId;
    if (typeof channelId === "string") {
      // A channel's current livestream: the IFrame API has no option for this, so build the
      // documented embed URL ourselves and attach the API to that iframe.
      const iframe = document.createElement("iframe");
      const src = new URL("https://www.youtube.com/embed/live_stream");
      src.searchParams.set("channel", channelId);
      for (const [k, v] of Object.entries(playerVars)) if (v !== undefined) src.searchParams.set(k, String(v));
      iframe.src = src.toString();
      iframe.title = "YouTube livestream";
      iframe.allow = "autoplay; encrypted-media; picture-in-picture";
      iframe.referrerPolicy = "strict-origin-when-cross-origin";
      iframe.className = "h-full w-full";
      wrapper.appendChild(iframe);
      player = new YTApi.Player(iframe, { events: handlers });
    } else {
      const target = document.createElement("div");
      wrapper.appendChild(target);
      player = new YTApi.Player(target, {
        width: "100%",
        height: "100%",
        videoId: String(video.embed.videoId),
        playerVars,
        events: handlers,
      });
      const iframe = wrapper.querySelector("iframe");
      if (iframe) iframe.title = "YouTube video player";
    }
    return createAdapter(player, wrapper, video, queued);
  },
};
