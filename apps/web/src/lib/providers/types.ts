/**
 * Video provider abstraction. The watch page only talks to these interfaces, so adding
 * Twitch, Vimeo or direct media URLs means adding a provider — no changes to the
 * transcription code (which lives in @heard/shared and knows nothing about players).
 */

export interface ParsedVideo {
  providerId: string;
  /** Stable key for this video (used to reset state when it changes). */
  key: string;
  /** Canonical page URL on the provider's site ("Open on YouTube"). */
  canonicalUrl: string;
  /** Provider-specific data needed to embed it. */
  embed: Record<string, string | number | undefined>;
  /** Start offset in seconds, if the link had one. */
  startSeconds?: number;
  /** Best guess before the player loads; the adapter reports the truth. */
  maybeLive: boolean;
}

/** A link we recognized but can't play (e.g. a @handle live URL without a video id). */
export interface ParseProblem {
  providerId: string;
  /** English fallback; the UI swaps in the current language's words using `kind`. */
  message: string;
  /**
   * "extensionOnly": the platform has no official embed, so the web app can't play it; the
   * Chrome extension can caption it on the platform's own site.
   */
  kind?: "extensionOnly" | "clip" | "channel";
  /** Display name of the platform the link belongs to ("LinkedIn"). */
  platformName?: string;
  /** The link to open on the platform's own site, when it's safe to offer one. */
  openUrl?: string;
}

export interface ProviderCapabilities {
  /** Host shown in "the extension adds captions directly on …" ("youtube.com"). */
  siteHost: string;
  /** Whether the provider's terms let us draw captions on top of its embedded player. */
  allowsCaptionOverlay: boolean;
  /** Smallest player viewport the provider allows, in CSS px. */
  minPlayerSize: { width: number; height: number };
}

export type PlayerState = "unstarted" | "playing" | "paused" | "buffering" | "ended";

export interface PlayerError {
  code: string;
  message: string;
  /** Embedding refused by the uploader: offer to open the video on the provider's site. */
  embeddingBlocked: boolean;
}

export interface PlayerEvents {
  onReady?: () => void;
  onStateChange?: (state: PlayerState) => void;
  onError?: (error: PlayerError) => void;
}

/** What the watch page needs from a player, whatever the provider. */
export interface PlayerAdapter {
  getCurrentTime(): number;
  /**
   * False when the player can't report a playhead (a Twitch live channel). Transcript lines
   * then use stream time and aren't seekable. Omitted means true.
   */
  hasTimeline?(): boolean;
  seekTo(seconds: number): void;
  play(): void;
  getState(): PlayerState;
  isLive(): boolean;
  getTitle(): string | null;
  getPlaybackRate(): number;
  destroy(): void;
}

export interface VideoProvider {
  id: string;
  name: string;
  capabilities: ProviderCapabilities;
  /** Returns the parsed video, a problem explaining why it can't be played, or null if not ours. */
  parse(url: URL): ParsedVideo | ParseProblem | null;
  /** Mount a player inside `host`. The player lives in its own child element, removed on destroy. */
  mount(host: HTMLElement, video: ParsedVideo, events: PlayerEvents): Promise<PlayerAdapter>;
}

export function isParseProblem(v: ParsedVideo | ParseProblem): v is ParseProblem {
  return "message" in v;
}
