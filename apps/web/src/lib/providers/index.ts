import type { ParsedVideo, ParseProblem, VideoProvider } from "./types";
import { isParseProblem } from "./types";
import { parseExtensionOnlyUrl } from "./extension-only";
import { twitchProvider } from "./twitch";
import { youtubeProvider } from "./youtube";

export * from "./types";

/** Every supported provider. Add Vimeo / direct-media providers here. */
export const PROVIDERS: VideoProvider[] = [youtubeProvider, twitchProvider];

export function getProvider(id: string): VideoProvider | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

export type ResolveResult =
  | { ok: true; provider: VideoProvider; video: ParsedVideo }
  | { ok: false; message: string; problem?: ParseProblem };

/** Accepts what people paste: full URLs, URLs without a scheme, or surrounding whitespace. */
export function toUrl(input: string): URL | null {
  const raw = input.trim();
  if (!raw) return null;
  try {
    return new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
}

export function resolveVideo(input: string): ResolveResult {
  const url = toUrl(input);
  if (!url) return { ok: false, message: "Paste a full video link, like https://www.youtube.com/watch?v=…" };
  for (const provider of PROVIDERS) {
    const parsed: ParsedVideo | ParseProblem | null = provider.parse(url);
    if (!parsed) continue;
    if (isParseProblem(parsed)) return { ok: false, message: parsed.message, problem: parsed };
    return { ok: true, provider, video: parsed };
  }
  const external = parseExtensionOnlyUrl(url);
  if (external) return { ok: false, message: external.message, problem: external };
  return {
    ok: false,
    message: "Heard doesn't recognize that link yet. YouTube and Twitch videos and livestreams are supported.",
  };
}

export function watchHref(input: string): string {
  return `/watch?url=${encodeURIComponent(input.trim())}`;
}
