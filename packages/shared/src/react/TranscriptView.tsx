import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { formatTimestamp, lineTimes, type TimeBase } from "../core/format";
import type { CaptionState, TranscriptLine } from "../core/types";
import { ArrowDownIcon } from "./icons";
import { DEFAULT_TRANSCRIPT_VIEW_LABELS, type TranscriptViewLabels } from "./labels";

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
  /** Translated text by line id; translated lines show the translation with the original below. */
  translations?: Record<string, string>;
  /** Translation of the live caption, shown in place of the in-progress line. */
  captionTranslation?: string | null;
  className?: string;
  /** UI words; English by default. */
  labels?: Partial<TranscriptViewLabels>;
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
  translations,
  captionTranslation = null,
  className = "",
  labels,
}: TranscriptViewProps) {
  const L = { ...DEFAULT_TRANSCRIPT_VIEW_LABELS, ...labels };
  const scroller = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(true);
  const q = query.trim().toLowerCase();

  const visible = useMemo(
    () =>
      q
        ? lines.filter((l) => l.text.toLowerCase().includes(q) || Boolean(translations?.[l.id]?.toLowerCase().includes(q)))
        : lines,
    [lines, q, translations],
  );
  // The in-progress text is whatever the caption shows beyond the last committed line.
  const draftSource = live && !q && caption?.text && caption.text !== lines[lines.length - 1]?.text ? caption.text : "";
  const draft = draftSource && captionTranslation ? captionTranslation : draftSource;

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
        className="heard-scroll absolute inset-0 overflow-y-auto px-4 py-3"
        aria-live="polite"
        aria-relevant="additions"
        role="log"
        aria-label={L.region}
      >
        {isEmpty ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-ink-400">
            {q ? L.noMatches(query.trim()) : emptyState ?? L.empty}
          </div>
        ) : (
          <ol className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-5 gap-y-1">
            {/* One shared timestamp column, as wide as the widest timestamp, so long livestream times never touch the text. */}
            {visible.map((line) => {
              const t = lineTimes(line, timeBase);
              const seekable = Boolean(onSeek) && timeBase === "media" && line.mediaStart !== null;
              const active = line.id === activeId;
              return (
                <li
                  key={line.id}
                  className={`group col-span-2 grid grid-cols-subgrid items-baseline rounded-lg px-2 py-1.5 transition-colors ${
                    active ? "bg-ink-800" : "hover:bg-ink-850"
                  }`}
                >
                  {seekable ? (
                    <button
                      type="button"
                      onClick={() => onSeek!(t.start)}
                      className="h-fit rounded-md text-left font-mono text-xs tabular-nums text-accent hover:text-accent-strong hover:underline focus-visible:outline-2 focus-visible:outline-accent"
                      title={L.jumpTo(formatTimestamp(t.start))}
                    >
                      {formatTimestamp(t.start)}
                    </button>
                  ) : (
                    <span className="font-mono text-xs tabular-nums text-ink-500">{formatTimestamp(t.start)}</span>
                  )}
                  {translations?.[line.id] && translations[line.id] !== line.text ? (
                    <div dir="auto">
                      <p className={`text-[0.95rem] leading-relaxed ${active ? "text-ink-100" : "text-ink-200"}`}>
                        <Highlight text={translations[line.id]!} query={q} />
                      </p>
                      <p className="mt-0.5 text-[0.8rem] leading-relaxed text-ink-500" lang={line.language}>
                        <Highlight text={line.text} query={q} />
                      </p>
                    </div>
                  ) : (
                    <p dir="auto" lang={line.language} className={`text-[0.95rem] leading-relaxed ${active ? "text-ink-100" : "text-ink-200"}`}>
                      <Highlight text={line.text} query={q} />
                    </p>
                  )}
                </li>
              );
            })}
            {draft && (
              <li className="col-span-2 grid grid-cols-subgrid px-2 py-1.5">
                <span className="mt-1.5 flex items-start">
                  <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-live" aria-hidden="true" />
                </span>
                <p dir="auto" className="text-[0.95rem] leading-relaxed text-ink-400 italic">{draft}</p>
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
          <ArrowDownIcon size={13} /> {live ? L.jumpToLive : L.jumpToLatest}
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
      <mark key={k++} className="heard-hit">
        {text.slice(j, j + query.length)}
      </mark>,
    );
    i = j + query.length;
  }
  return <>{parts}</>;
}
