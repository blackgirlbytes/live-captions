import type { ParseProblem } from "./types";

/**
 * Platforms with no official embed for their live streams. The web app can't play them, but
 * the Chrome extension captions them on the platform's own site, so we say that instead of
 * "Heard doesn't recognize that link". See docs/streaming-platforms-plan.md (Track 3).
 *
 * Never scrape, proxy or re-host these streams to get around the missing embed.
 */
const PLATFORMS: Array<{ id: string; name: string; hosts: string[] }> = [
  { id: "linkedin", name: "LinkedIn", hosts: ["linkedin.com", "lnkd.in"] },
  { id: "x", name: "X", hosts: ["x.com", "twitter.com"] },
  { id: "tiktok", name: "TikTok", hosts: ["tiktok.com"] },
  { id: "instagram", name: "Instagram", hosts: ["instagram.com", "instagr.am"] },
];

function matches(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

export function parseExtensionOnlyUrl(url: URL): ParseProblem | null {
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase();
  const platform = PLATFORMS.find((p) => p.hosts.some((d) => matches(host, d)));
  if (!platform) return null;
  const open = new URL(url.toString());
  open.protocol = "https:";
  return {
    providerId: platform.id,
    kind: "extensionOnly",
    platformName: platform.name,
    openUrl: open.toString(),
    message: `${platform.name} doesn't allow its streams to be embedded, so Heard can't play this link here. Open it on ${platform.name} and turn on captions with the Heard Chrome extension.`,
  };
}
