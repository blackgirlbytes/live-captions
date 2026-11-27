/** Small icons shared by the hero demo pieces. */

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

export function CaptionsGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="6" width="18" height="12" rx="2.5" />
      <path d="M10 10.5a2 2 0 1 0 0 3M16 10.5a2 2 0 1 0 0 3" />
    </svg>
  );
}

/** Round icon button for the demo's player controls. `active` shows the pressed style. */
export const ToolIcon = forwardRef<
  HTMLButtonElement,
  { children: ReactNode; active?: boolean; label: string } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-label">
>(function ToolIcon({ children, active = false, label, className = "", title, ...rest }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={title ?? label}
      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-ink-800 hover:text-ink-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        active ? "bg-ink-800 text-ink-100" : "text-ink-400"
      } ${className}`}
      {...rest}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {children}
      </svg>
    </button>
  );
});
