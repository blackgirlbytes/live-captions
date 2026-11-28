import type { PlayerAdapter, PlayerEvents, PlayerState, ParsedVideo, VideoProvider } from "../types";
import { loadTwitchEmbedApi, type TwitchPlayer } from "./embed-api";
import { formatTwitchTime, parseTwitchUrl } from "./parse";

export { parseTwitchUrl, formatTwitchTime } from "./parse";

let nextId = 0;

function createAdapter(player: TwitchPlayer, wrapper: HTMLElement, video: ParsedVideo, live: { online: boolean }, state: { current: PlayerState; ready: boolean; queuedPlay: boolean }): PlayerAdapter {
  const isVod = typeof video.embed.videoId === "string";
  return {
    // Twitch reports a playhead only for VODs; for live channels the watch page falls back
    // to stream time (hasTimeline() is false), so this value isn't used for transcript times.
    getCurrentTime: () => {
      if (!isVod || !state.ready) return 0;
      try {
        return player.getCurrentTime() || 0;
      } catch {
        return 0;
      }
    },
    hasTimeline: () => isVod,
    seekTo: (s) => {
      if (!isVod || !state.ready) return;
      player.seek(Math.max(0, s));
      if (state.current !== "playing") player.play();
    },
    play: () => {
      if (state.ready) player.play();
      else state.queuedPlay = true;
    },
    getState: () => state.current,
    isLive: () => !isVod && (live.online || state.current === "playing" || video.maybeLive),
    getTitle: () => {
      if (!state.ready) return null;
      try {
        const name = player.getChannel()?.trim();
        if (!name) return null;
        return isVod ? `${name} · Twitch video` : name;
      } catch {
        return null;
      }
    },
    getPlaybackRate: () => 1,
    destroy: () => {
      // Twitch.Player has no destroy(); removing the wrapper removes its iframe.
      wrapper.remove();
    },
  };
}

export const twitchProvider: VideoProvider = {
  id: "twitch",
  name: "Twitch",
  capabilities: {
    siteHost: "twitch.tv",
    // Twitch embed rule 1.3: embeds "should not be obscured in any way by other page
    // elements" (see docs/provider-policies.md), so captions render below the player.
    allowsCaptionOverlay: false,
    minPlayerSize: { width: 400, height: 300 },
  },
  parse: parseTwitchUrl,

  async mount(host, video, events: PlayerEvents) {
    const Player = await loadTwitchEmbedApi();
    const wrapper = document.createElement("div");
    wrapper.className = "h-full w-full";
    const target = document.createElement("div");
    target.id = `heard-twitch-${++nextId}`;
    target.className = "h-full w-full";
    wrapper.appendChild(target);
    host.appendChild(wrapper);

    const options = {
      width: "100%",
      height: "100%",
      // Twitch only plays inside the domains listed here.
      parent: [window.location.hostname],
      autoplay: false,
      ...(typeof video.embed.videoId === "string"
        ? { video: `v${video.embed.videoId}`, time: video.startSeconds ? formatTwitchTime(video.startSeconds) : undefined }
        : { channel: String(video.embed.channel) }),
    };
    const player = new Player(target, options);
    const iframe = wrapper.querySelector("iframe");
    if (iframe) iframe.title = "Twitch video player";

    const live = { online: false };
    const state = { current: "unstarted" as PlayerState, ready: false, queuedPlay: false };
    let everPlayed = false;
    const set = (next: PlayerState) => {
      if (state.current === next) return;
      state.current = next;
      events.onStateChange?.(next);
    };

    player.addEventListener(Player.READY, () => {
      state.ready = true;
      if (state.queuedPlay) player.play();
      events.onReady?.();
    });
    player.addEventListener(Player.PLAY, () => set("buffering"));
    player.addEventListener(Player.PLAYING, () => {
      everPlayed = true;
      set("playing");
    });
    player.addEventListener(Player.PAUSE, () => set("paused"));
    player.addEventListener(Player.ENDED, () => set("ended"));
    player.addEventListener(Player.ONLINE, () => {
      live.online = true;
    });
    player.addEventListener(Player.OFFLINE, () => {
      live.online = false;
      if (typeof video.embed.channel !== "string") return;
      if (everPlayed) set("ended");
      else
        events.onError?.({
          code: "offline",
          embeddingBlocked: false,
          message: `${video.embed.channel} isn't live on Twitch right now. Come back when the stream starts, or open the channel on Twitch to watch past broadcasts.`,
        });
    });
    player.addEventListener(Player.PLAYBACK_BLOCKED, () => set("paused"));

    return createAdapter(player, wrapper, video, live, state);
  },
};
