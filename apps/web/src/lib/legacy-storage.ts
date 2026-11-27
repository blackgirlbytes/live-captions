/**
 * Heard used to be called Earshot, and stored its settings under `earshot:` keys. This moves
 * them to the matching `heard:` keys once, so a saved Deepgram key or caption style survives
 * the rename. Safe to call often: after the first run there is nothing left to move.
 */
const OLD_PREFIX = "earshot:";
const NEW_PREFIX = "heard:";
let done = false;

export function migrateLegacyStorage(): void {
  if (done || typeof window === "undefined") return;
  done = true;
  try {
    const old: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(OLD_PREFIX)) old.push(k);
    }
    for (const k of old) {
      const next = NEW_PREFIX + k.slice(OLD_PREFIX.length);
      const value = localStorage.getItem(k);
      if (value !== null && localStorage.getItem(next) === null) localStorage.setItem(next, value);
      localStorage.removeItem(k);
    }
  } catch {
    /* storage unavailable (private mode): nothing to migrate */
  }
}
