import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { formatTimestamp, lineTimes, type TimeBase } from "../core/format";
import type { CaptionState, TranscriptLine } from "../core/types";
import { ArrowDownIcon } from "./icons";

export interface TranscriptViewProps {
  lines: TranscriptLine[];
  /** Live caption; its text is shown as the in-progress last line. */
  caption?: CaptionState;
  live?: boolean;
  query?: string;
  timeBase?: TimeBase;
  /** When provided, timestamps become buttons that seek the media. */
  onSeek?: (seconds: number) => void;
  /** Highlight the line containing this media time (e.g. current playback position). */
  activeMediaTime?: number | null;
  emptyState?: ReactNode;
  className?: string;
}

/** Live, searchable transcript with timestamps and smart auto-scroll. */
export function TranscriptView({
  lines,
  caption,
  live = false,
  query = "",
  timeBase = "stream",
  onSeek,
  activeMediaTime = null,
  emptyState,
  className = "",
}: TranscriptViewProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(true);
  const q = query.trim().toLowerCase();

  const visible = useMemo(() => (q ? lines.filter((l) => l.text.toLowerCase().includes(q)) : lines), [lines, q]);
  // The in-progress text is whatever the caption shows beyond the last committed line.
  const draft = live && !q && caption?.text && caption.text !== lines[lines.length - 1]?.text ? caption.text : "";

  const activeId = useMemo(() => {
    if (activeMediaTime === null || timeBase !== "media") return null;
    let id: string | null = null;
    for (const l of lines) {
      if (l.mediaStart !== null && l.mediaStart <= activeMediaTime + 0.25) id = l.id;
    }
    return id;
  }, [lines, activeMediaTime, timeBase]);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && pinned && !q) el.scrollTop = el.scrollHeight;
  }, [visible.length, draft, pinned, q]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onScroll = () => setPinned(el.scrollHeight - el.scrollTop - el.clientHeight < 48);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const isEmpty = visible.length === 0 && !draft;

  return (
    <div className={`relative min-h-0 flex-1 ${className}`}>
      <div
        ref={scroller}
        className="earshot-scroll absolute inset-0 overflow-y-auto px-4 py-3"
        aria-live="polite"
        aria-relevant="additions"
        role="log"
        aria-label="Transcript"
      >
        {isEmpty ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-ink-400">
            {q ? `No matches for “${query.trim()}”` : emptyState ?? "The transcript will appear here."}
          </div>
        ) : (
          <ol className="space-y-1">
            {visible.map((line) => {
              const t = lineTimes(line, timeBase);
              const seekable = Boolean(onSeek) && timeBase === "media" && line.mediaStart !== null;
              const active = line.id === activeId;
              return (
                <li
                  key={line.id}
                  className={`group grid grid-cols-[3.75rem_1fr] gap-3 rounded-lg px-2 py-1.5 transition-colors ${
                    active ? "bg-ink-800" : "hover:bg-ink-850"
                  }`}
                >
                  {seekable ? (
                    <button
                      type="button"
                      onClick={() => onSeek!(t.start)}
                      className="mt-0.5 h-fit rounded-md text-left font-mono text-xs tabular-nums text-accent hover:text-accent-strong hover:underline focus-visible:outline-2 focus-visible:outline-accent"
                      title={`Jump to ${formatTimestamp(t.start)}`}
                    >
                      {formatTimestamp(t.start)}
                    </button>
                  ) : (
                    <span className="mt-0.5 font-mono text-xs tabular-nums text-ink-500">{formatTimestamp(t.start)}</span>
                  )}
                  <p className={`text-[0.95rem] leading-relaxed ${active ? "text-ink-100" : "text-ink-200"}`}>
                    <Highlight text={line.text} query={q} />
                  </p>
                </li>
              );
            })}
            {draft && (
              <li className="grid grid-cols-[3.75rem_1fr] gap-3 px-2 py-1.5">
                <span className="mt-1.5 flex items-start">
                  <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-live" aria-hidden="true" />
                </span>
                <p className="text-[0.95rem] leading-relaxed text-ink-400 italic">{draft}</p>
              </li>
            )}
          </ol>
        )}
      </div>
      {!pinned && !q && !isEmpty && (
        <button
          type="button"
          onClick={() => {
            setPinned(true);
            const el = scroller.current;
            if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
          }}
          className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-ink-700/95 px-3 py-1.5 text-xs font-medium text-ink-100 shadow-lg ring-1 ring-ink-600 backdrop-blur hover:bg-ink-600"
        >
          <ArrowDownIcon size={13} /> {live ? "Jump to live" : "Jump to latest"}
        </button>
      )}
    </div>
  );
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const parts: ReactNode[] = [];
  const lower = text.toLowerCase();
  let i = 0;
  let k = 0;
  while (i < text.length) {
    const j = lower.indexOf(query, i);
    if (j < 0) {
      parts.push(<Fragment key={k++}>{text.slice(i)}</Fragment>);
      break;
    }
    if (j > i) parts.push(<Fragment key={k++}>{text.slice(i, j)}</Fragment>);
    parts.push(
      <mark key={k++} className="earshot-hit">
        {text.slice(j, j + query.length)}
      </mark>,
    );
    i = j + query.length;
  }
  return <>{parts}</>;
}
