/**
 * The extension's whole message protocol, in one place.
 *
 * Contexts:
 * - background (service worker): orchestrates capture, owns no transcript state.
 * - offscreen document: runs the TranscriptionSession; SOURCE OF TRUTH for session state.
 * - popup / side panel: UI; read state with `get-state`, then follow broadcasts.
 * - overlay content script: caption box inside the captured tab.
 *
 * `runtime.sendMessage` reaches every extension page at once, so every runtime message
 * carries a `to` field and each context ignores messages that aren't addressed to it.
 */
import { browser } from "wxt/browser";
import type { CaptionState, TranscriptEvent, TranscriptionStatus, TranscriptState } from "@heard/shared";

/** Everything the UI needs to render one capture session. Lives in the offscreen document. */
export interface SessionSnapshot {
  /** Tab being (or last) captured; null when nothing has been captured. */
  tabId: number | null;
  tabTitle: string | null;
  /** The user dismissed the in-page caption box for this capture. */
  overlayHidden: boolean;
  transcript: TranscriptState;
}

export type SessionMeta = Pick<SessionSnapshot, "tabId" | "tabTitle" | "overlayHidden">;

/** Generic reply for commands. `code: "needs_key"` means "the user should add their own Deepgram key". */
export type CommandResult = { ok: true } | { ok: false; error: string; code?: "needs_key" };

/**
 * How the offscreen document authenticates to Deepgram. Chosen by the background, which
 * is the only context that reads the user's key from storage. Sent only background → offscreen.
 */
export type CredentialSource = { kind: "user-key"; userKey: string } | { kind: "server"; tokenEndpoint: string };

/* ----------------------------- → background ----------------------------- */

export type BackgroundRequest =
  | { to: "background"; type: "start"; tabId: number }
  | { to: "background"; type: "stop" }
  | { to: "background"; type: "get-state" }
  /** Re-show (injecting if necessary) the caption box in the captured tab. */
  | { to: "background"; type: "show-overlay" }
  /** From the overlay: the user closed the caption box. */
  | { to: "background"; type: "overlay-dismissed" }
  /** From a freshly injected overlay: "what should I show?" (tab comes from sender). */
  | { to: "background"; type: "overlay-hello" };

export interface BackgroundResponses {
  start: CommandResult;
  stop: CommandResult;
  "get-state": SessionSnapshot;
  "show-overlay": CommandResult;
  "overlay-dismissed": CommandResult;
  "overlay-hello": OverlayHello;
}

export interface OverlayHello {
  /** False when this tab is not the captured tab: the overlay should remove itself. */
  captured: boolean;
  hidden: boolean;
  status: TranscriptionStatus;
  caption: CaptionState | null;
  /** Translation of `caption` when captions are translated. */
  captionTranslation: string | null;
}

/** Spoken language (Deepgram code or "multi") and caption language ("" = as spoken). */
export interface SessionLanguages {
  spoken: string;
  caption: string;
}

/* ----------------------------- → offscreen ----------------------------- */

export type OffscreenRequest =
  | {
      to: "offscreen";
      type: "start";
      streamId: string;
      tabId: number;
      tabTitle: string | null;
      credential: CredentialSource;
      languages: SessionLanguages;
    }
  | { to: "offscreen"; type: "set-languages"; languages: SessionLanguages }
  | { to: "offscreen"; type: "stop" }
  | { to: "offscreen"; type: "get-state" }
  | { to: "offscreen"; type: "set-overlay-hidden"; hidden: boolean };

export interface OffscreenResponses {
  start: CommandResult;
  stop: CommandResult;
  "get-state": SessionSnapshot;
  "set-overlay-hidden": CommandResult;
  "set-languages": CommandResult;
}

/* --------------------------- offscreen → everyone --------------------------- */

export type Broadcast =
  | { to: "broadcast"; type: "transcript-event"; tabId: number | null; event: TranscriptEvent }
  | { to: "broadcast"; type: "meta"; meta: SessionMeta };

/* ----------------------- background → overlay (tabs.sendMessage) ----------------------- */

export type OverlayMessage =
  | { to: "overlay"; type: "event"; event: TranscriptEvent }
  | { to: "overlay"; type: "show" }
  /** Capture ended for this tab: remove the overlay entirely. */
  | { to: "overlay"; type: "teardown" };

export type RuntimeMessage = BackgroundRequest | OffscreenRequest | Broadcast;

/* ----------------------------- typed helpers ----------------------------- */

export function sendToBackground<T extends BackgroundRequest>(msg: T): Promise<BackgroundResponses[T["type"]]> {
  return browser.runtime.sendMessage(msg);
}

export function sendToOffscreen<T extends OffscreenRequest>(msg: T): Promise<OffscreenResponses[T["type"]]> {
  return browser.runtime.sendMessage(msg);
}

/** Fire-and-forget broadcast; "no receiver" errors are expected when no UI is open. */
export function broadcast(msg: Broadcast): void {
  browser.runtime.sendMessage(msg).catch(() => undefined);
}

export function sendToOverlay(tabId: number, msg: OverlayMessage): Promise<unknown> {
  return browser.tabs.sendMessage(tabId, msg);
}

export function isRuntimeMessage(msg: unknown): msg is RuntimeMessage {
  return typeof msg === "object" && msg !== null && "to" in msg && "type" in msg;
}

export function isOverlayMessage(msg: unknown): msg is OverlayMessage {
  return typeof msg === "object" && msg !== null && (msg as { to?: unknown }).to === "overlay";
}

/** Statuses during which audio is being captured. */
export function isCapturing(status: TranscriptionStatus): boolean {
  return status === "connecting" || status === "live" || status === "paused" || status === "reconnecting";
}

/** Session errors that the user's (or the server's) Deepgram key can fix. */
export function isKeyError(message: string | null | undefined): boolean {
  return Boolean(message && /API key|Deepgram key/i.test(message));
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
