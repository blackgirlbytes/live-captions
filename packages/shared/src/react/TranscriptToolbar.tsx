import { useEffect, useRef, useState } from "react";
import { downloadTranscript, toPlainText, type ExportFormat } from "../core/format";
import type { TranscriptLine } from "../core/types";
import { DEFAULT_TRANSCRIPT_TOOLBAR_LABELS, type TranscriptToolbarLabels } from "./labels";
import { CheckIcon, CloseIcon, CopyIcon, DownloadIcon, SearchIcon } from "./icons";

export interface TranscriptToolbarProps {
  lines: TranscriptLine[];
  query: string;
  onQueryChange: (q: string) => void;
  /** Base file name for downloads (e.g. the video title). */
  fileName?: string;
  className?: string;
  /** UI words; English by default. */
  labels?: Partial<TranscriptToolbarLabels>;
}

/** Search box + copy + download (TXT / SRT / VTT). All actions work on the in-memory transcript. */
export function TranscriptToolbar({ lines, query, onQueryChange, fileName = "transcript", className = "", labels }: TranscriptToolbarProps) {
  const L = { ...DEFAULT_TRANSCRIPT_TOOLBAR_LABELS, ...labels };
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const empty = lines.length === 0;
  const matches = query.trim() ? lines.filter((l) => l.text.toLowerCase().includes(query.trim().toLowerCase())).length : null;

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [menuOpen]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(toPlainText(lines));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard denied */
    }
  };

  const download = (format: ExportFormat) => {
    downloadTranscript(lines, format, fileName);
    setMenuOpen(false);
  };

  const btn =
    "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-2.5 text-sm text-ink-300 transition-colors hover:bg-ink-800 hover:text-ink-100 disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-accent";

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <label className="relative flex min-w-0 flex-1 items-center">
        <span className="sr-only">{L.search}</span>
        <SearchIcon size={15} className="pointer-events-none absolute left-3 text-ink-500" />
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={L.search}
          className="h-9 w-full min-w-0 rounded-lg bg-ink-850 pl-9 pr-16 text-sm text-ink-100 ring-1 ring-ink-700 placeholder:text-ink-500 focus:ring-accent focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <span className="absolute right-2 flex items-center gap-1">
            <span className="text-xs tabular-nums text-ink-500">{matches}</span>
            <button type="button" onClick={() => onQueryChange("")} className="rounded p-1 text-ink-400 hover:text-ink-100" aria-label={L.clearSearch}>
              <CloseIcon size={13} />
            </button>
          </span>
        )}
      </label>
      <button type="button" className={btn} onClick={copy} disabled={empty} title={L.copy} aria-label={L.copy}>
        {copied ? <CheckIcon size={16} className="text-ok" /> : <CopyIcon size={16} />}
      </button>
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          className={btn}
          onClick={() => setMenuOpen((o) => !o)}
          disabled={empty}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          title={L.download}
          aria-label={L.download}
        >
          <DownloadIcon size={16} />
        </button>
        {menuOpen && (
          <div role="menu" className="absolute right-0 top-11 z-20 w-48 overflow-hidden rounded-xl bg-ink-800 p-1 shadow-2xl ring-1 ring-ink-600">
            {(["txt", "srt", "vtt"] as const).map((fmt) => [fmt, ...L.formats[fmt]] as const).map(([fmt, label, hint]) => (
              <button
                key={fmt}
                role="menuitem"
                type="button"
                onClick={() => download(fmt)}
                className="flex w-full items-baseline justify-between rounded-lg px-3 py-2 text-left text-sm text-ink-100 hover:bg-ink-700"
              >
                {label}
                <span className="text-xs text-ink-400">{hint}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
