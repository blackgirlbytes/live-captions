/**
 * Follows the captured page's main video so live dubbing can pause with it and drop
 * outdated speech after a seek. Play/pause/seek events don't bubble, but they are visible
 * in the capture phase at the document, so no per-video listeners are needed.
 */
import { pickMainVideo } from "@/utils/video-geometry";

export interface MediaChange {
  paused?: boolean;
  discontinuity?: boolean;
}

function mainVideo(): HTMLVideoElement | null {
  const videos = Array.from(document.querySelectorAll("video"));
  const vp = { w: window.innerWidth, h: window.innerHeight };
  const i = pickMainVideo(
    videos.map((v) => {
      const r = v.getBoundingClientRect();
      return { rect: { left: r.left, top: r.top, width: r.width, height: r.height }, paused: v.paused, audible: !v.muted && v.volume > 0 };
    }),
    vp,
  );
  return i < 0 ? null : (videos[i] ?? null);
}

/** Calls `onChange` when the main video pauses, plays, seeks, or is replaced. Returns a stop function. */
export function watchMainVideo(onChange: (change: MediaChange) => void): () => void {
  let paused: boolean | null = null;
  let current: HTMLVideoElement | null = null;

  const check = (event?: Event) => {
    const video = mainVideo();
    if (video !== current) {
      // A different video (e.g. the next one in a playlist) starts a new stream of speech.
      if (current !== null) onChange({ discontinuity: true });
      current = video;
    }
    if (!video) return;
    if (event?.target === video && event.type === "seeking") onChange({ discontinuity: true });
    const p = video.paused || video.ended;
    if (p !== paused) {
      paused = p;
      onChange({ paused: p });
    }
  };

  const events = ["play", "playing", "pause", "ended", "seeking", "emptied", "loadedmetadata"];
  for (const e of events) document.addEventListener(e, check, true);
  const timer = window.setInterval(check, 1000);
  check();
  return () => {
    for (const e of events) document.removeEventListener(e, check, true);
    window.clearInterval(timer);
  };
}
