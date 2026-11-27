import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from "react";
import { browser } from "wxt/browser";
import { CaptionText } from "@heard/shared/react";
import { DEFAULT_CAPTION_SETTINGS, type CaptionSettings, type CaptionState, type TranscriptionStatus } from "@heard/shared";
import { getCaptionSettings, STORAGE_KEYS, type OverlayLayout } from "@/utils/config";

/* ------------------------------ tiny store ------------------------------ */

export interface OverlayState {
  status: TranscriptionStatus;
  caption: CaptionState;
  hidden: boolean;
}

export function createOverlayStore(initial: OverlayState) {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(patch: Partial<OverlayState>) {
      state = { ...state, ...patch };
      listeners.forEach((l) => l());
    },
    subscribe(l: () => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}
export type OverlayStore = ReturnType<typeof createOverlayStore>;

/* ------------------------------ geometry ------------------------------ */

const MIN_WIDTH = 220;
const EDGE = 8;

function viewport() {
  return { w: window.innerWidth, h: window.innerHeight };
}

function defaultLayout(): OverlayLayout {
  const { w, h } = viewport();
  const width = Math.round(Math.min(760, w * 0.8));
  return { x: (w - width) / 2 / w, y: Math.max(0, h - 190) / h, width };
}

/** Layout fractions → on-screen pixels, clamped so the box is always fully visible. */
function place(layout: OverlayLayout, boxHeight: number) {
  const { w, h } = viewport();
  const width = Math.max(Math.min(MIN_WIDTH, w - 2 * EDGE), Math.min(layout.width, w - 2 * EDGE));
  const left = Math.min(Math.max(EDGE, layout.x * w), Math.max(EDGE, w - width - EDGE));
  const top = Math.min(Math.max(EDGE, layout.y * h), Math.max(EDGE, h - boxHeight - EDGE));
  return { left, top, width };
}

function normalizeLayout(v: unknown): OverlayLayout | null {
  if (typeof v !== "object" || v === null) return null;
  const { x, y, width } = v as Record<string, unknown>;
  if (![x, y, width].every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  return { x: x as number, y: y as number, width: width as number };
}

/* ------------------------------ component ------------------------------ */

const STATUS_TEXT: Partial<Record<TranscriptionStatus, string>> = {
  live: "Live",
  connecting: "Connecting…",
  reconnecting: "Reconnecting…",
  paused: "Paused",
};

export function Overlay({ store, onDismiss }: { store: OverlayStore; onDismiss: () => void }) {
  const { status, caption, hidden } = useSyncExternalStore(store.subscribe, store.get);
  const [settings, setSettings] = useState<CaptionSettings>({ ...DEFAULT_CAPTION_SETTINGS, position: "overlay" });
  const [layout, setLayout] = useState<OverlayLayout>(defaultLayout);
  const [, setViewportTick] = useState(0);
  const [mode, setMode] = useState<"idle" | "drag" | "resize">("idle");
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxHeight, setBoxHeight] = useState(80);

  // Settings + saved layout, kept in sync with the side panel through storage events.
  useEffect(() => {
    let alive = true;
    void getCaptionSettings().then((s) => alive && setSettings(s));
    void browser.storage.local.get(STORAGE_KEYS.overlayLayout).then((r) => {
      const saved = normalizeLayout(r[STORAGE_KEYS.overlayLayout]);
      if (alive && saved) setLayout(saved);
    });
    const onChanged = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area !== "local") return;
      if (STORAGE_KEYS.captionSettings in changes) void getCaptionSettings().then((s) => alive && setSettings(s));
      const l = normalizeLayout(changes[STORAGE_KEYS.overlayLayout]?.newValue);
      if (l) setLayout(l);
    };
    browser.storage.onChanged.addListener(onChanged);
    return () => {
      alive = false;
      browser.storage.onChanged.removeListener(onChanged);
    };
  }, []);

  // Re-clamp on viewport changes (window resize, entering/leaving fullscreen).
  useEffect(() => {
    const bump = () => setViewportTick((t) => t + 1);
    window.addEventListener("resize", bump);
    document.addEventListener("fullscreenchange", bump);
    return () => {
      window.removeEventListener("resize", bump);
      document.removeEventListener("fullscreenchange", bump);
    };
  }, []);

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBoxHeight(el.offsetHeight));
    ro.observe(el);
    setBoxHeight(el.offsetHeight);
    return () => ro.disconnect();
  }, [hidden, settings.enabled]);

  const pos = place(layout, boxHeight);

  const persist = useCallback((next: OverlayLayout) => {
    void browser.storage.local.set({ [STORAGE_KEYS.overlayLayout]: next }).catch(() => undefined);
  }, []);

  /** Shared pointer-tracking for drag (move) and corner-resize. */
  const track = (e: ReactPointerEvent<HTMLElement>, kind: "drag" | "resize") => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const start = { x: e.clientX, y: e.clientY, ...pos };
    let latest = layout;
    setMode(kind);

    const onMove = (ev: PointerEvent) => {
      const { w, h } = viewport();
      const dx = ev.clientX - start.x;
      const dy = ev.clientY - start.y;
      if (kind === "drag") {
        const left = Math.min(Math.max(EDGE, start.left + dx), w - start.width - EDGE);
        const top = Math.min(Math.max(EDGE, start.top + dy), h - boxHeight - EDGE);
        latest = { x: left / w, y: top / h, width: start.width };
      } else {
        const width = Math.min(Math.max(MIN_WIDTH, start.width + dx), w - start.left - EDGE);
        latest = { x: start.left / w, y: start.top / h, width };
      }
      setLayout(latest);
    };
    const onUp = (ev: PointerEvent) => {
      target.releasePointerCapture(ev.pointerId);
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
      target.removeEventListener("pointercancel", onUp);
      setMode("idle");
      persist(latest);
    };
    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
    target.addEventListener("pointercancel", onUp);
  };

  if (hidden || !settings.enabled) return null;

  const label = STATUS_TEXT[status] ?? "";
  return (
    <div
      ref={boxRef}
      className={`box ${mode !== "idle" ? "active" : ""} ${mode === "drag" ? "dragging" : ""}`}
      style={{ left: pos.left, top: pos.top, width: pos.width }}
      onPointerDown={(e) => track(e, "drag")}
      aria-label="Heard live captions. Drag to move."
    >
      <div className={`live ${status === "live" ? "on" : ""}`} title={`Heard: ${label || status}`}>
        <span className="dot" aria-hidden="true" />
        <span className="label">Heard · {label}</span>
      </div>

      <div className="bar">
        <span className="btn grip" title="Drag to move" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="9" cy="6" r="1.6" />
            <circle cx="15" cy="6" r="1.6" />
            <circle cx="9" cy="12" r="1.6" />
            <circle cx="15" cy="12" r="1.6" />
            <circle cx="9" cy="18" r="1.6" />
            <circle cx="15" cy="18" r="1.6" />
          </svg>
        </span>
        <button
          type="button"
          className="btn"
          title="Hide captions on this tab (the transcript keeps going in the side panel)"
          aria-label="Hide captions"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onDismiss}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <CaptionText caption={caption} settings={settings} style={{ minHeight: `${1.35 * settings.fontSize}px` }} />

      <span className="resize" title="Drag to resize" aria-hidden="true" onPointerDown={(e) => track(e, "resize")} />
    </div>
  );
}
