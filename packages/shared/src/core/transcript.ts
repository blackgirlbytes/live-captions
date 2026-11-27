import type { CaptionState, TranscriptEvent, TranscriptState, TranslationState } from "./types";

/* ------------------------------------------------------------------ */
/* Pure state reducer used by every consumer (session, side panel...) */
/* ------------------------------------------------------------------ */

export const EMPTY_CAPTION: CaptionState = { text: "", hasInterim: false, updatedAt: 0 };

export const NO_TRANSLATION: TranslationState = { target: null, lines: {}, caption: null, issue: null };

export function initialTranscriptState(): TranscriptState {
  return { status: "idle", error: null, lines: [], caption: EMPTY_CAPTION, startedAt: null, translation: NO_TRANSLATION };
}

export function reduceTranscript(state: TranscriptState, event: TranscriptEvent): TranscriptState {
  switch (event.type) {
    case "status":
      return { ...state, status: event.status, error: event.error ?? (event.status === "error" ? state.error : null) };
    case "line":
      if (state.lines.some((l) => l.id === event.line.id)) return state;
      return { ...state, lines: [...state.lines, event.line] };
    case "caption":
      return { ...state, caption: event.caption };
    case "reset":
      return {
        ...initialTranscriptState(),
        status: state.status,
        startedAt: event.startedAt,
        translation: { ...NO_TRANSLATION, target: state.translation.target, issue: state.translation.issue },
      };
    case "snapshot":
      return { ...event.state, translation: event.state.translation ?? NO_TRANSLATION };
    case "translation-config": {
      const t = state.translation;
      const same = t.target === event.target;
      return {
        ...state,
        translation: same ? { ...t, issue: event.issue } : { target: event.target, lines: {}, caption: null, issue: event.issue },
      };
    }
    case "line-translated":
      if (state.translation.target !== event.target) return state;
      return { ...state, translation: { ...state.translation, lines: { ...state.translation.lines, [event.id]: event.text } } };
    case "caption-translated":
      if (state.translation.target !== event.target) return state;
      return { ...state, translation: { ...state.translation, caption: event.text } };
  }
}

/* ------------------------------------------------------------------ */
/* Assembles Deepgram results into lines + a live caption             */
/* ------------------------------------------------------------------ */

export interface DgWord {
  word: string;
  punctuated_word?: string;
  start: number;
  end: number;
  /** Detected language of the word (`language=multi` only). */
  language?: string;
}

/** Subset of Deepgram's `Results` message we rely on. */
export interface DgResults {
  type: "Results";
  start: number;
  duration: number;
  is_final?: boolean;
  speech_final?: boolean;
  channel: { alternatives: Array<{ transcript: string; words?: DgWord[]; languages?: string[] }> };
}

interface Span {
  text: string;
  start: number;
  end: number;
  language?: string;
}

export interface AssemblerOptions {
  /** Map stream seconds → media seconds (null if unknown). */
  mediaTimeAt?: (streamSeconds: number) => number | null;
  /** Commit long monologues at sentence boundaries once this many chars accumulate. */
  softLineLimit?: number;
  /** Always commit once this many chars accumulate. */
  hardLineLimit?: number;
  /** Max characters shown in the caption. */
  captionChars?: number;
  now?: () => number;
  idPrefix?: string;
}

/**
 * Turns a stream of Deepgram `Results` (interim + final) into committed lines and a caption.
 *
 * - `offset` is the absolute stream time at which the current WebSocket connection began,
 *   so timestamps stay monotonic across reconnects.
 * - Finals whose words end before the last committed audio are dropped, which prevents
 *   duplicated segments when audio is replayed after a reconnect or after `Finalize`.
 */
export class TranscriptAssembler {
  private pending: Span[] = [];
  private interim: Span | null = null;
  /** Absolute stream time up to which final words have been accepted. */
  private finalizedUntil = 0;
  private counter = 0;
  private readonly opts: Required<Omit<AssemblerOptions, "mediaTimeAt">> & Pick<AssemblerOptions, "mediaTimeAt">;

  constructor(
    private readonly emit: (event: TranscriptEvent) => void,
    options: AssemblerOptions = {},
  ) {
    this.opts = {
      softLineLimit: 160,
      hardLineLimit: 320,
      captionChars: 220,
      now: () => Date.now(),
      idPrefix: Math.random().toString(36).slice(2, 8),
      ...options,
    };
  }

  handleResults(msg: DgResults, offset: number): void {
    const alt = msg.channel?.alternatives?.[0];
    if (!alt) return;
    const segStart = offset + msg.start;
    const segEnd = segStart + msg.duration;

    if (!msg.is_final) {
      const text = alt.transcript.trim();
      // An interim covering only audio we already finalized is stale.
      this.interim = text && segEnd > this.finalizedUntil + 0.01 ? { text, start: segStart, end: segEnd, language: alt.languages?.[0] } : null;
      this.emitCaption();
      return;
    }

    this.interim = null;
    if (alt.words && alt.words.length > 0) {
      for (const w of alt.words) {
        const start = offset + w.start;
        if (start < this.finalizedUntil - 0.02) continue; // already have it (replay / duplicate)
        this.pending.push({ text: w.punctuated_word ?? w.word, start, end: offset + w.end, language: w.language });
      }
    } else if (alt.transcript.trim() && segEnd > this.finalizedUntil + 0.01) {
      this.pending.push({ text: alt.transcript.trim(), start: segStart, end: segEnd, language: alt.languages?.[0] });
    }
    this.finalizedUntil = Math.max(this.finalizedUntil, segEnd);

    if (msg.speech_final) this.commit();
    else this.splitLongLine();
    this.emitCaption();
  }

  /** Deepgram `UtteranceEnd`: the speaker paused, close the current line. */
  handleUtteranceEnd(): void {
    this.commit();
    this.emitCaption();
  }

  /** Commit what we have (stop, seek, pause). Interim text is discarded because it was never confirmed. */
  flush(opts: { clearCaption?: boolean } = {}): void {
    this.commit();
    this.interim = null;
    if (opts.clearCaption) this.emit({ type: "caption", caption: { ...EMPTY_CAPTION, updatedAt: this.opts.now() } });
    else this.emitCaption();
  }

  /**
   * Continuous speech may never produce `speech_final`. Once the pending text is long,
   * commit up to the last sentence boundary (or everything past the hard limit) so the
   * transcript stays readable and timestamps stay useful.
   */
  private splitLongLine(): void {
    while (pendingLength(this.pending) >= this.opts.softLineLimit) {
      let chars = 0;
      let cut = -1;
      for (let i = 0; i < this.pending.length; i++) {
        chars += this.pending[i]!.text.length + 1;
        if (chars >= 40 && /[.!?]["')\]]?$/.test(this.pending[i]!.text)) cut = i;
      }
      if (cut < 0) {
        if (pendingLength(this.pending) >= this.opts.hardLineLimit) this.commit();
        return;
      }
      this.commit(cut + 1);
    }
  }

  private commit(count = this.pending.length): void {
    const words = this.pending.slice(0, count);
    this.pending = this.pending.slice(count);
    const text = words.map((w) => w.text).join(" ").trim();
    if (!text) return;
    const start = words[0]!.start;
    const end = words[words.length - 1]!.end;
    const media = this.opts.mediaTimeAt;
    const mediaStart = media ? media(start) : null;
    const mediaEnd = media ? media(end) : null;
    const language = mainLanguage(words);
    this.lastCommitted = text;
    this.lastCommittedLanguage = language;
    this.emit({
      type: "line",
      line: {
        id: `${this.opts.idPrefix}-${++this.counter}`,
        text,
        start: round(start),
        end: round(end),
        mediaStart: mediaStart === null ? null : round(mediaStart),
        mediaEnd: mediaEnd === null ? null : round(mediaEnd),
        createdAt: this.opts.now(),
        ...(language ? { language } : {}),
      },
    });
  }

  private lastCommitted = "";
  private lastCommittedLanguage: string | undefined;

  private emitCaption(): void {
    const pendingText = this.pending.map((w) => w.text).join(" ");
    const parts = [pendingText, this.interim?.text].filter(Boolean) as string[];
    // Between utterances keep showing the last line until the renderer fades it.
    const text = parts.length > 0 ? parts.join(" ") : this.lastCommitted;
    const language =
      parts.length > 0 ? mainLanguage(this.interim ? [...this.pending, this.interim] : this.pending) : this.lastCommittedLanguage;
    this.emit({
      type: "caption",
      caption: {
        text: tail(text, this.opts.captionChars),
        hasInterim: Boolean(this.interim),
        updatedAt: this.opts.now(),
        ...(language ? { language } : {}),
      },
    });
  }
}

/** Keep the last `max` characters, cut at a word boundary. */
export function tail(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(text.length - max);
  const space = cut.indexOf(" ");
  return space >= 0 ? cut.slice(space + 1) : cut;
}

/** The language most of these spans are in (by characters), if Deepgram reported any. */
function mainLanguage(spans: Span[]): string | undefined {
  const counts = new Map<string, number>();
  for (const s of spans) if (s.language) counts.set(s.language, (counts.get(s.language) ?? 0) + s.text.length);
  let best: string | undefined;
  let n = 0;
  for (const [lang, c] of counts) if (c > n) [best, n] = [lang, c];
  return best;
}

function pendingLength(words: Span[]): number {
  return words.reduce((n, w) => n + w.text.length + 1, 0);
}

function round(n: number) {
  return Math.round(n * 1000) / 1000;
}
