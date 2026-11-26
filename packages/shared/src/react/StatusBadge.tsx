import type { TranscriptionStatus } from "../core/types";

const LABELS: Record<TranscriptionStatus, string> = {
  idle: "Off",
  connecting: "Connecting",
  live: "Live",
  paused: "Paused",
  reconnecting: "Reconnecting",
  error: "Error",
};

const DOT: Record<TranscriptionStatus, string> = {
  idle: "bg-ink-500",
  connecting: "bg-accent animate-pulse-dot",
  live: "bg-live animate-pulse-dot",
  paused: "bg-ink-400",
  reconnecting: "bg-accent animate-pulse-dot",
  error: "bg-live",
};

/** Compact indicator that makes it obvious when audio is being transcribed. */
export function StatusBadge({ status, className = "" }: { status: TranscriptionStatus; className?: string }) {
  const active = status === "live";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide uppercase ring-1 ${
        active ? "bg-live/12 text-live ring-live/30" : status === "error" ? "bg-live/10 text-live ring-live/25" : "bg-ink-800 text-ink-300 ring-ink-700"
      } ${className}`}
      role="status"
      aria-label={`Transcription ${LABELS[status].toLowerCase()}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[status]}`} aria-hidden="true" />
      {LABELS[status]}
    </span>
  );
}

export const STATUS_LABELS = LABELS;
