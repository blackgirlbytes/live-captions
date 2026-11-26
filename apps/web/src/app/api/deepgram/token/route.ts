import { DeepgramClient, DeepgramError } from "@deepgram/sdk";
import type { NextRequest } from "next/server";

/**
 * POST /api/deepgram/token → { access_token, expires_in }
 * GET  /api/deepgram/token → { serverKey: boolean }
 *
 * DEEPGRAM_API_KEY is optional. When it's unset, GET reports `serverKey: false` and POST
 * answers 503 `{ error, code: "no_server_key" }`: visitors then bring their own Deepgram key,
 * which stays in their browser and is never sent here.
 *
 * Mints a short-lived Deepgram JWT so the browser (web app or Chrome extension) can open
 * the streaming WebSocket without ever seeing the permanent API key. An open socket stays
 * alive after the token expires; the client fetches a fresh token for every reconnect.
 *
 * Contract shared with apps/extension: POST {origin}/api/deepgram/token, body `{}`,
 * `Content-Type: application/json`.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOKEN_TTL_SECONDS = 60;
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = Math.max(1, Number(process.env.EARSHOT_TOKEN_RATE_LIMIT) || 30);

/* ------------------------------ CORS ------------------------------ */

function allowedExtensionIds(): string[] | null {
  const raw = process.env.EARSHOT_EXTENSION_IDS?.trim();
  if (!raw) return null;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function isSameOrigin(req: NextRequest, origin: string): boolean {
  let host: string;
  try {
    host = new URL(origin).host;
  } catch {
    return false;
  }
  const candidates = [req.headers.get("x-forwarded-host"), req.headers.get("host"), req.nextUrl.host];
  return candidates.some((h) => h && h.split(",")[0]!.trim() === host);
}

function isAllowedExtension(origin: string): boolean {
  const m = /^chrome-extension:\/\/([a-p]{32}|[a-z0-9]+)$/i.exec(origin);
  if (!m) return false;
  const ids = allowedExtensionIds();
  return ids === null || ids.includes(m[1]!);
}

type OriginCheck = { ok: true; corsOrigin: string | null } | { ok: false };

/** Requests without an Origin header (curl, server-to-server) are allowed but get no CORS headers. */
function checkOrigin(req: NextRequest): OriginCheck {
  const origin = req.headers.get("origin");
  if (!origin) return { ok: true, corsOrigin: null };
  if (isSameOrigin(req, origin)) return { ok: true, corsOrigin: origin };
  if (isAllowedExtension(origin)) return { ok: true, corsOrigin: origin };
  return { ok: false };
}

function corsHeaders(origin: string | null): HeadersInit {
  const h: Record<string, string> = {
    "Cache-Control": "no-store, max-age=0",
    Vary: "Origin",
  };
  if (origin) {
    h["Access-Control-Allow-Origin"] = origin;
    h["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
    h["Access-Control-Allow-Headers"] = "Content-Type";
    h["Access-Control-Max-Age"] = "600";
  }
  return h;
}

function json(body: unknown, status: number, origin: string | null, extra: HeadersInit = {}) {
  return Response.json(body, { status, headers: { ...corsHeaders(origin), ...extra } });
}

/* --------------------------- rate limiting --------------------------- */

const hits = new Map<string, { count: number; resetAt: number }>();

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "local";
}

/** Fixed-window, in-memory, per-IP limiter. Good enough for a single instance. */
function rateLimit(key: string): { ok: true } | { ok: false; retryAfter: number } {
  const now = Date.now();
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
  }
  const entry = hits.get(key);
  if (!entry || entry.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return { ok: true };
  }
  entry.count += 1;
  if (entry.count > RATE_LIMIT) return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  return { ok: true };
}

/* ------------------------------ handlers ------------------------------ */

export function OPTIONS(req: NextRequest) {
  const check = checkOrigin(req);
  if (!check.ok) return new Response(null, { status: 403, headers: { Vary: "Origin" } });
  return new Response(null, { status: 204, headers: corsHeaders(check.corsOrigin) });
}

function serverApiKey(): string | null {
  return process.env.DEEPGRAM_API_KEY?.trim() || null;
}

/** Availability check for clients deciding whether to ask the user for their own key. Never mints. */
export function GET(req: NextRequest) {
  const check = checkOrigin(req);
  if (!check.ok) return json({ error: "This origin is not allowed to query the token endpoint." }, 403, null);
  const origin = check.corsOrigin;

  // Separate bucket so status checks don't eat into the token budget.
  const limit = rateLimit(`status:${clientIp(req)}`);
  if (!limit.ok) {
    return json({ error: "Too many requests. Wait a moment and try again." }, 429, origin, {
      "Retry-After": String(limit.retryAfter),
    });
  }

  return json({ serverKey: serverApiKey() !== null }, 200, origin);
}

export async function POST(req: NextRequest) {
  const check = checkOrigin(req);
  if (!check.ok) return json({ error: "This origin is not allowed to request Deepgram tokens." }, 403, null);
  const origin = check.corsOrigin;

  const limit = rateLimit(clientIp(req));
  if (!limit.ok) {
    return json({ error: "Too many token requests. Wait a moment and try again." }, 429, origin, {
      "Retry-After": String(limit.retryAfter),
    });
  }

  const apiKey = serverApiKey();
  if (!apiKey) {
    // Not a server fault: this deployment expects visitors to bring their own Deepgram key.
    return json(
      {
        error: "This Earshot server doesn't provide a Deepgram API key. Add your own Deepgram API key to start captions.",
        code: "no_server_key",
      },
      503,
      origin,
    );
  }

  try {
    const client = new DeepgramClient({ apiKey });
    const grant = await client.auth.v1.tokens.grant({ ttl_seconds: TOKEN_TTL_SECONDS });
    if (!grant?.access_token) throw new Error("Deepgram returned no access token.");
    return json({ access_token: grant.access_token, expires_in: grant.expires_in ?? TOKEN_TTL_SECONDS }, 200, origin);
  } catch (err) {
    const status = err instanceof DeepgramError ? err.statusCode : undefined;
    if (status === 401 || status === 403) {
      // Bad/insufficient key: retrying won't help, so answer with a status the client treats as fatal.
      return json(
        { error: "Deepgram rejected the server's API key. Check DEEPGRAM_API_KEY (it needs Member permissions or higher)." },
        500,
        origin,
      );
    }
    console.error("[earshot] Deepgram token grant failed:", status ?? "", (err as Error).message);
    return json({ error: "Could not get a Deepgram token right now. Retrying…" }, 502, origin);
  }
}
