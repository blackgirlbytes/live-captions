import { useEffect, useState, type CSSProperties } from "react";
import { CAPTION_FONT_STACKS, withOpacity } from "../core/settings";
import type { CaptionSettings, CaptionState } from "../core/types";

export interface CaptionTextProps {
  caption: CaptionState;
  settings: CaptionSettings;
  /** Hide the caption after this many ms without updates. */
  fadeAfterMs?: number;
  className?: string;
  style?: CSSProperties;
}

/**
 * The caption box itself. Styled with inline styles (not Tailwind) so it renders the same
 * inside the web player and inside the extension's shadow-DOM overlay on any website.
 */
export function CaptionText({ caption, settings, fadeAfterMs = 6000, className, style }: CaptionTextProps) {
  const [stale, setStale] = useState(false);

  useEffect(() => {
    setStale(false);
    if (!caption.text) return;
    const remaining = caption.updatedAt + fadeAfterMs - Date.now();
    if (remaining <= 0) {
      setStale(true);
      return;
    }
    const t = setTimeout(() => setStale(true), remaining);
    return () => clearTimeout(t);
  }, [caption.text, caption.updatedAt, fadeAfterMs]);

  const visible = settings.enabled && Boolean(caption.text) && !stale;
  const lineHeight = 1.35;
  const boxed = settings.backgroundOpacity > 0.02;

  return (
    <div
      className={className}
      role="status"
      aria-live="off"
      style={{
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
        opacity: visible ? 1 : 0,
        transition: "opacity 220ms ease",
        ...style,
      }}
    >
      <div
        style={{
          maxWidth: "100%",
          padding: boxed ? "0.18em 0.55em" : 0,
          borderRadius: "0.3em",
          background: boxed ? withOpacity(settings.backgroundColor, settings.backgroundOpacity) : "transparent",
          color: settings.textColor,
          fontFamily: CAPTION_FONT_STACKS[settings.fontFamily],
          fontSize: `${settings.fontSize}px`,
          fontWeight: 500,
          lineHeight,
          letterSpacing: "0.005em",
          textAlign: "center",
          textShadow: boxed ? "none" : "0 0 4px #000, 0 1px 3px #000, 0 0 1px #000",
          // Clamp from the end so the newest words are always visible.
          maxHeight: `${settings.maxLines * lineHeight}em`,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          boxDecorationBreak: "clone",
          WebkitBoxDecorationBreak: "clone",
        }}
      >
        <span>{caption.text || " "}</span>
      </div>
    </div>
  );
}
