/**
 * Where the caption box sits on the page's video. Pure functions, so they're testable without
 * a DOM. Nothing here is site-specific: it works the same on YouTube, Twitch, LinkedIn, X,
 * TikTok and Instagram (see docs/streaming-platforms-plan.md, Track 1).
 */

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Viewport {
  w: number;
  h: number;
}

export interface VideoCandidate {
  rect: Rect;
  paused: boolean;
  /** Not muted and volume above zero. */
  audible: boolean;
}

export const MIN_WIDTH = 220;
export const EDGE = 8;

/** Smallest video worth attaching to (thumbnails and avatars are smaller). */
const MIN_VIDEO = { width: 200, height: 112 };

export function isPortrait(video: Rect): boolean {
  return video.height > video.width * 1.05;
}

/**
 * How likely this is the video someone is listening to. Bigger and more visible wins; playing
 * and audible videos count much more, which matters in feeds (LinkedIn, X) where several
 * muted previews autoplay at once; ties go to the one nearest the middle of the screen.
 * Returns 0 for videos that shouldn't be picked at all.
 */
export function scoreVideo(c: VideoCandidate, vp: Viewport): number {
  const r = c.rect;
  if (r.width < MIN_VIDEO.width || r.height < MIN_VIDEO.height) return 0;
  const visW = Math.min(r.left + r.width, vp.w) - Math.max(r.left, 0);
  const visH = Math.min(r.top + r.height, vp.h) - Math.max(r.top, 0);
  if (visW <= 0 || visH <= 0) return 0;
  const cx = r.left + r.width / 2 - vp.w / 2;
  const cy = r.top + r.height / 2 - vp.h / 2;
  const centered = 1 - 0.5 * Math.min(1, Math.hypot(cx, cy) / Math.hypot(vp.w / 2, vp.h / 2));
  return visW * visH * (c.paused ? 1 : 4) * (c.audible ? 2 : 1) * centered;
}

/** The best candidate's index, or -1 when none qualifies. */
export function pickMainVideo(candidates: VideoCandidate[], vp: Viewport): number {
  let best = -1;
  let bestScore = 0;
  candidates.forEach((c, i) => {
    const s = scoreVideo(c, vp);
    if (s > bestScore) {
      best = i;
      bestScore = s;
    }
  });
  return best;
}

/**
 * Captions grow with the video, like a TV's: the settings size is the size on a ~480px-tall
 * landscape player. Scaling by the shorter side keeps tall 9:16 players (TikTok, Instagram)
 * from getting huge text in a narrow frame.
 */
export function videoFontScale(video: Rect | null): number {
  if (!video) return 1;
  return Math.min(2.2, Math.max(1, Math.min(video.width, video.height) / 480));
}

/**
 * Landscape: centered near the bottom of the video, about where broadcast captions sit.
 * Portrait: a bit wider than 82% of the narrow frame and raised above the bottom quarter,
 * where vertical-video apps draw comments and the message box.
 */
export function placeOnVideo(video: Rect, boxHeight: number, vp: Viewport) {
  const portrait = isPortrait(video);
  const wanted = portrait ? Math.max(video.width * 0.92, Math.min(360, vp.w * 0.9)) : video.width * 0.82;
  const width = Math.min(Math.max(MIN_WIDTH, wanted), vp.w - 2 * EDGE);
  const left = Math.min(Math.max(EDGE, video.left + (video.width - width) / 2), Math.max(EDGE, vp.w - width - EDGE));
  const bottomGap = portrait ? video.height * 0.28 : Math.max(12, video.height * 0.07);
  const top = Math.min(
    Math.max(EDGE, video.top + video.height - bottomGap - boxHeight),
    Math.max(EDGE, vp.h - boxHeight - EDGE),
  );
  return { left, top, width };
}
