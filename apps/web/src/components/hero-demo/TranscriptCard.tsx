"use client";

import { Fragment, useEffect, useRef, type ReactNode } from "react";
import { useHeroDemo, SCRIPT, formatTime, type ScriptLine } from "./state";

interface HeardLine extends ScriptLine {
  index: number;
}

export function TranscriptCard() {
  const { heard, current, query, setQuery, seek } = useHeroDemo();
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const q = query.trim().toLowerCase();
  const lines: HeardLine[] = heard.flatMap((index) => {
    const line = SCRIPT[index];
    return line ? [{ ...line, index }] : [];
  });
  const visible = q ? lines.filter((l) => l.text.toLowerCase().includes(q)) : lines;

  // Keep the current line (or the latest one) in view by scrolling the list
  // itself, never the page. Leave the list alone while the user is searching.
  const target = current ?? heard[heard.length - 1] ?? null;
  useEffect(() => {
    const list = listRef.current;
    if (!list || q || target === null) return;
    const el = list.querySelector<HTMLElement>(`[data-line="${target}"]`);
    if (!el) return;
    const top = el.offsetTop;
    const bottom = top + el.offsetHeight;
    let next: number | null = null;
    if (top < list.scrollTop) next = top;
    else if (bottom > list.scrollTop + list.clientHeight) next = bottom - list.clientHeight;
    if (next === null) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    list.scrollTo({ top: next, behavior: reduce ? "auto" : "smooth" });
  }, [target, heard.length, q]);

  const download = () => {
    const text = lines.map((l) => `${formatTime(l.t)} ${l.text}`).join("\n") + "\n";
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "heard-transcript.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <div className="flex h-full flex-col rounded-[20px] bg-ink-900 p-4 shadow-[0_30px_60px_-24px_rgba(0,0,0,0.95)] ring-1 ring-white/[0.08]">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-ink-100">Transcript</span>
        <button
          type="button"
          onClick={download}
          disabled={lines.length === 0}
          className="-mr-1.5 rounded-md px-1.5 py-0.5 text-[11px] text-ink-500 transition-colors hover:text-ink-100 focus-visible:outline-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-50"
        >
          Download
        </button>
      </div>

      <div
        ref={listRef}
        className="heard-scroll relative mt-3 h-[6.5rem] overflow-y-auto xl:h-auto xl:min-h-0 xl:flex-1 overscroll-contain"
        role="log"
        aria-label="Transcript"
        aria-live="polite"
        aria-relevant="additions"
      >
        {lines.length === 0 ? (
          <p className="px-2 py-1.5 text-[12.5px] leading-snug text-ink-500">Lines appear here as they&rsquo;re spoken.</p>
        ) : visible.length === 0 ? (
          <p className="px-2 py-1.5 text-[12.5px] leading-snug text-ink-500">No matches</p>
        ) : (
          <ol className="space-y-0.5 text-[12.5px] leading-snug">
            {visible.map((line) => {
              const now = line.index === current;
              return (
                <li
                  key={line.index}
                  data-line={line.index}
                  className="transition-[opacity,translate] duration-300 ease-out starting:translate-y-1 starting:opacity-0 motion-reduce:transition-none"
                >
                  <button
                    type="button"
                    onClick={() => seek(line.t)}
                    title={`Jump to ${formatTime(line.t)}`}
                    aria-current={now ? "true" : undefined}
                    className={`flex w-full gap-3 rounded-lg px-2 py-1.5 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent ${
                      now ? "bg-accent/10 text-ink-100" : "text-ink-400 hover:bg-white/[0.04] hover:text-ink-200"
                    }`}
                  >
                    <span className={`tabular-nums ${now ? "text-accent" : "text-ink-500"}`}>{formatTime(line.t)}</span>
                    <span>
                      <Highlight text={line.text} query={q} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className="mt-3 flex h-9 items-center gap-2 rounded-xl bg-ink-850 pr-1 pl-3 text-[12px] ring-accent/50 focus-within:ring-1">
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && query) {
              e.preventDefault();
              setQuery("");
            }
          }}
          placeholder="Search the transcript"
          aria-label="Search the transcript"
          autoComplete="off"
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent text-ink-100 outline-none placeholder:text-ink-500 [&::-webkit-search-cancel-button]:appearance-none"
        />
        <button
          type="button"
          onClick={() => {
            if (query) setQuery("");
            inputRef.current?.focus();
          }}
          aria-label={query ? "Clear search" : "Search the transcript"}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-ink-700 text-ink-200 transition-colors hover:bg-ink-600 hover:text-ink-100 focus-visible:outline-2 focus-visible:outline-accent"
        >
          {query ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m20 20-4-4" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

/** Wraps each case-insensitive match of `query` (already lowercased) in a mark. */
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
