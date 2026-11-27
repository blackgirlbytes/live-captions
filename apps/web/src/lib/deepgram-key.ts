"use client";

import { createTokenFetcher, type DeepgramCredential } from "@heard/shared";
import { migrateLegacyStorage } from "@/lib/legacy-storage";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

/**
 * "Bring your own Deepgram key".
 *
 * A visitor's own key lives only in this browser (localStorage, or memory when storage is
 * blocked) and is handed straight to Deepgram's WebSocket. It is never sent to the Heard
 * server. When a user key is saved it takes precedence over the server's token endpoint.
 */

const STORAGE_KEY = "heard:deepgram-key";
export const TOKEN_ENDPOINT_PATH = "/api/deepgram/token";
export const DEEPGRAM_CONSOLE_URL = "https://console.deepgram.com/";

/** In-memory copy; also the fallback when localStorage throws (private mode, blocked storage). */
let current: string | null | undefined;
const listeners = new Set<() => void>();

function read(): string | null {
  if (current !== undefined) return current;
  migrateLegacyStorage();
  try {
    current = localStorage.getItem(STORAGE_KEY)?.trim() || null;
  } catch {
    current = null;
  }
  return current;
}

function emit() {
  for (const l of listeners) l();
}

export function loadUserKey(): string | null {
  return typeof window === "undefined" ? null : read();
}

/** Saves the key. Returns false when it could only be kept in memory for this tab. */
export function saveUserKey(key: string): boolean {
  current = key.trim();
  let persisted = true;
  try {
    localStorage.setItem(STORAGE_KEY, current);
  } catch {
    persisted = false;
  }
  emit();
  return persisted;
}

export function forgetUserKey(): void {
  current = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
  emit();
}

/** "••••1a2b" — enough to recognise which key is saved without revealing it. */
export function maskKey(key: string): string {
  return `••••${key.slice(-4)}`;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Keep tabs in sync when the key changes in another tab.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY && e.key !== null) return;
    current = undefined;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** The saved user key (or null), kept in sync across components and tabs. */
export function useUserDeepgramKey(): string | null {
  return useSyncExternalStore(subscribe, loadUserKey, () => null);
}

/* ------------------------- server key availability ------------------------- */

let serverStatus: Promise<boolean | null> | null = null;

/**
 * Whether the Heard server has its own Deepgram key (GET /api/deepgram/token).
 * Cached per page load; resolves null when the check itself failed (it's retried next call).
 */
export function fetchServerKeyStatus(): Promise<boolean | null> {
  serverStatus ??= fetch(TOKEN_ENDPOINT_PATH, { method: "GET", cache: "no-store" })
    .then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { serverKey?: unknown };
      return body.serverKey === true;
    })
    .catch(() => {
      serverStatus = null;
      return null;
    });
  return serverStatus;
}

/** Record what a token request revealed (e.g. a 503 `no_server_key`) without another round trip. */
export function setServerKeyStatus(value: boolean) {
  serverStatus = Promise.resolve(value);
}

/** null while loading or unknown. */
export function useServerKeyStatus(): [boolean | null, (v: boolean) => void] {
  const [status, setStatus] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    void fetchServerKeyStatus().then((v) => !cancelled && setStatus(v));
    return () => {
      cancelled = true;
    };
  }, []);
  const set = useCallback((v: boolean) => {
    setServerKeyStatus(v);
    setStatus(v);
  }, []);
  return [status, set];
}

/* ------------------------------- getToken ------------------------------- */

/**
 * `getToken` for TranscriptionSession: the user's own key when one is saved (read on every
 * connect, so a newly saved key applies on the next connection), otherwise a short-lived
 * JWT from the Heard server.
 */
export function createGetToken(endpoint: string): () => Promise<string | DeepgramCredential> {
  const fetchServerToken = createTokenFetcher(endpoint);
  return async () => {
    const userKey = loadUserKey();
    if (userKey) return { type: "token", value: userKey };
    return fetchServerToken();
  };
}

export type KeyMode = "user" | "server" | "none" | "unknown";

export function keyMode(userKey: string | null, serverKey: boolean | null): KeyMode {
  if (userKey) return "user";
  if (serverKey === true) return "server";
  if (serverKey === false) return "none";
  return "unknown";
}
