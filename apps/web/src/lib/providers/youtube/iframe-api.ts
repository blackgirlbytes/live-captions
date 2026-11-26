/** Loads the official YouTube IFrame Player API exactly once. */

let loading: Promise<typeof YT> | null = null;

declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
  }
}

export function loadYouTubeIframeApi(): Promise<typeof YT> {
  if (typeof window === "undefined") return Promise.reject(new Error("YouTube player needs a browser."));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (loading) return loading;

  loading = new Promise<typeof YT>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => {
      loading = null;
      script.remove();
      reject(new Error("Couldn't load the YouTube player. Check your connection or disable blockers for youtube.com."));
    };
    document.head.appendChild(script);
  });
  return loading;
}
