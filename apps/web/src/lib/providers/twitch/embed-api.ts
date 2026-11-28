/**
 * Loads Twitch's official interactive embed (`Twitch.Player`) exactly once.
 * Docs: https://dev.twitch.tv/docs/embed/video-and-clips/
 */

export interface TwitchPlayerOptions {
  width: number | string;
  height: number | string;
  channel?: string;
  video?: string;
  /** Domains embedding the player. Twitch refuses to play without the current one. */
  parent: string[];
  autoplay?: boolean;
  muted?: boolean;
  /** VOD start time, "1h2m3s". */
  time?: string;
}

/** The documented subset of Twitch.Player we use. */
export interface TwitchPlayer {
  addEventListener(event: string, callback: () => void): void;
  play(): void;
  pause(): void;
  /** Seconds. VODs only. */
  seek(seconds: number): void;
  /** Seconds. VODs only; live streams don't report a playhead. */
  getCurrentTime(): number;
  getEnded(): boolean;
  isPaused(): boolean;
  getChannel(): string | undefined;
}

export interface TwitchPlayerStatic {
  new (target: string | HTMLElement, options: TwitchPlayerOptions): TwitchPlayer;
  READY: string;
  PLAY: string;
  PLAYING: string;
  PAUSE: string;
  ENDED: string;
  ONLINE: string;
  OFFLINE: string;
  PLAYBACK_BLOCKED: string;
  SEEK: string;
}

declare global {
  interface Window {
    Twitch?: { Player?: TwitchPlayerStatic };
  }
}

const SRC = "https://player.twitch.tv/js/embed/v1.js";
let loading: Promise<TwitchPlayerStatic> | null = null;

export function loadTwitchEmbedApi(): Promise<TwitchPlayerStatic> {
  if (typeof window === "undefined") return Promise.reject(new Error("The Twitch player needs a browser."));
  if (window.Twitch?.Player) return Promise.resolve(window.Twitch.Player);
  if (loading) return loading;

  loading = new Promise<TwitchPlayerStatic>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SRC;
    script.async = true;
    script.onload = () => {
      const Player = window.Twitch?.Player;
      if (Player) resolve(Player);
      else fail();
    };
    const fail = () => {
      loading = null;
      script.remove();
      reject(new Error("Couldn't load the Twitch player. Check your connection or disable blockers for twitch.tv."));
    };
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return loading;
}
