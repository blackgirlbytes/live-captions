const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function normalizeServerUrl(input: string): string | null {
  try {
    const url = new URL(input.trim());
    if (url.username || url.password || url.search || url.hash) return null;
    if (url.protocol !== "https:" && !(url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname))) return null;
    return url.origin + url.pathname.replace(/\/+$/, "");
  } catch {
    return null;
  }
}
