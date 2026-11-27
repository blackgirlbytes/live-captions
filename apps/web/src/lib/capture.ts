/**
 * Tab-audio capture for the web player. The user shares *this tab* (with its audio) via
 * Chrome's screen-share picker; we drop the video track immediately and keep only audio.
 */

export type CaptureSupport = { ok: true } | { ok: false; reason: string };

interface UAData {
  mobile?: boolean;
  brands?: Array<{ brand: string }>;
}

export function detectCaptureSupport(): CaptureSupport {
  if (typeof navigator === "undefined") return { ok: true };
  const ua = navigator.userAgent;
  const uaData = (navigator as Navigator & { userAgentData?: UAData }).userAgentData;
  const mobile = uaData?.mobile ?? /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  if (mobile) {
    return { ok: false, reason: "Live captions need tab-audio sharing, which phones and tablets don't support. Open Heard in Chrome or Edge on a computer." };
  }
  if (/Firefox\//.test(ua)) {
    return { ok: false, reason: "Firefox can't share a tab's audio with websites. Open Heard in Chrome or Edge on a computer." };
  }
  const chromium = uaData?.brands?.some((b) => /Chromium|Google Chrome|Microsoft Edge/i.test(b.brand)) ?? /Chrome\/|Edg\//.test(ua);
  if (!chromium) {
    return { ok: false, reason: "This browser can't share a tab's audio with websites. Open Heard in Chrome or Edge on a computer." };
  }
  if (!navigator.mediaDevices?.getDisplayMedia) {
    return { ok: false, reason: "Tab sharing is unavailable here. Make sure the page is served over HTTPS (or localhost) in Chrome or Edge." };
  }
  return { ok: true };
}

export class CaptureError extends Error {
  constructor(
    message: string,
    readonly kind: "cancelled" | "no-audio" | "failed",
  ) {
    super(message);
  }
}

/** Must be called from a click handler (user activation). Resolves with an audio-only stream. */
export async function captureTabAudio(): Promise<MediaStream> {
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        suppressLocalAudioPlayback: false,
      },
      preferCurrentTab: true,
      selfBrowserSurface: "include",
      surfaceSwitching: "exclude",
      systemAudio: "exclude",
    } as DisplayMediaStreamOptions);
  } catch (err) {
    const name = (err as DOMException)?.name;
    if (name === "NotAllowedError" || name === "AbortError") {
      throw new CaptureError("Sharing was cancelled. Start again and pick “This tab” when Chrome asks.", "cancelled");
    }
    throw new CaptureError(`Chrome couldn't share this tab: ${(err as Error).message}`, "failed");
  }

  // We only need the sound — stop video right away so nothing is encoded.
  for (const t of stream.getVideoTracks()) {
    t.stop();
    stream.removeTrack(t);
  }
  if (stream.getAudioTracks().length === 0) {
    throw new CaptureError(
      "You didn't share tab audio. Start again and make sure “Also share tab audio” is switched on.",
      "no-audio",
    );
  }
  return stream;
}
