import { FatalTranscriptionError } from "./session";

/** Response shape of the Earshot token endpoint (`POST /api/deepgram/token`). */
export interface TokenResponse {
  access_token: string;
  expires_in: number;
}

/**
 * Returns a `getToken` function that fetches a short-lived Deepgram JWT from the
 * Earshot server. Each (re)connect asks for a fresh token; the permanent API key
 * stays on the server.
 */
export function createTokenFetcher(endpoint: string): () => Promise<string> {
  return async () => {
    let res: Response;
    try {
      res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    } catch {
      throw new Error(`Could not reach the Earshot server at ${originOf(endpoint)}.`);
    }
    const body = (await res.json().catch(() => ({}))) as Partial<TokenResponse> & { error?: string };
    if (!res.ok || !body.access_token) {
      const message = body.error ?? `Token request failed (HTTP ${res.status}).`;
      // Misconfiguration and authorization problems won't fix themselves by retrying.
      if (res.status === 401 || res.status === 403 || res.status === 500 || res.status === 503) {
        throw new FatalTranscriptionError(message);
      }
      throw new Error(message);
    }
    return body.access_token;
  };
}

function originOf(endpoint: string): string {
  try {
    return new URL(endpoint, globalThis.location?.href).origin;
  } catch {
    return endpoint;
  }
}
