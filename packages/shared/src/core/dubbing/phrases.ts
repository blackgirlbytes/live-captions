/**
 * Front half of live dubbing: finalized transcript lines → natural phrases → translated text,
 * in the order they were spoken. Interim results are never used, so the dub never repeats or
 * corrects itself.
 *
 * Runs wherever Chrome's translator works (the extension's side panel, a web page). The
 * translated phrases go to a DubOutput, which may live in another context.
 */
import { AUTO_LANGUAGE } from "../settings";
import { translateText } from "../translate";
import type { TranscriptEvent, TranscriptLine, TranslationIssue } from "../types";
import type { DubSegment } from "./types";

export interface PhraseOptions {
  /** Wait this long for a short fragment's continuation before sending it alone. */
  holdMs?: number;
  /** Never hold a phrase longer than this since its first words were finalized. */
  maxHoldMs?: number;
  /** Phrases older than this when they're ready to speak are skipped (stay close to live). */
  maxLagMs?: number;
  /** Injected for tests. */
  translate?: typeof translateText;
  now?: () => number;
}

export interface PhraseHandlers {
  onSegment: (segment: DubSegment) => void;
  /** True while at least one phrase is being translated. */
  onTranslating?: (busy: boolean) => void;
  /** A phrase couldn't be translated (null clears). */
  onIssue?: (issue: TranslationIssue | null) => void;
  /** A phrase was dropped because it got too old. */
  onSkipped?: () => void;
}

interface Pending {
  text: string;
  spokenAt: number;
  firstAt: number;
  language: string | undefined;
  speaker: string | undefined;
}

const SENTENCE_END = /[.!?。！？…]["'”’)\]]*$/u;
/** Scripts written without spaces: count characters instead of words. */
const NO_SPACES = /[぀-ヿ㐀-鿿가-힯]/u;

function size(text: string): number {
  return NO_SPACES.test(text) ? Math.ceil(text.replace(/\s/g, "").length / 3) : text.split(/\s+/).filter(Boolean).length;
}

/** Whether a phrase is ready to speak without waiting for more words. */
export function isCompletePhrase(text: string): boolean {
  const n = size(text);
  return n >= 12 || (n >= 3 && SENTENCE_END.test(text.trim()));
}

export class DubPhrasePipeline {
  private spoken = AUTO_LANGUAGE;
  private target = "";
  private active = false;
  private since = 0;
  private generation = 0;
  private seq = 0;
  private seen = new Set<string>();
  private pending: Pending | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private chain: Promise<void> = Promise.resolve();
  private inFlight = 0;
  private readonly holdMs: number;
  private readonly maxHoldMs: number;
  private readonly maxLagMs: number;
  private readonly translate: typeof translateText;
  private readonly now: () => number;

  constructor(
    private readonly handlers: PhraseHandlers,
    opts: PhraseOptions = {},
  ) {
    this.holdMs = opts.holdMs ?? 900;
    this.maxHoldMs = opts.maxHoldMs ?? 2000;
    this.maxLagMs = opts.maxLagMs ?? 8000;
    this.translate = opts.translate ?? translateText;
    this.now = opts.now ?? Date.now;
  }

  /** `spoken`: Deepgram code or "multi". `target`: translator code of the dubbed speech. */
  configure(spoken: string, target: string): void {
    const s = spoken || AUTO_LANGUAGE;
    if (s === this.spoken && target === this.target) return;
    this.spoken = s;
    this.target = target;
    // A new language makes everything in flight outdated.
    this.clear();
  }

  /** Start dubbing from now on: lines finalized before this call are never spoken. */
  start(): void {
    if (this.active) return;
    this.active = true;
    this.since = this.now();
    this.clear();
  }

  stop(): void {
    this.active = false;
    this.clear();
  }

  get isActive(): boolean {
    return this.active;
  }

  /** Drop held and in-flight phrases (seek, language change, new video). */
  clear(): void {
    this.generation += 1;
    this.pending = null;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.chain = Promise.resolve();
    if (this.inFlight > 0) {
      this.inFlight = 0;
      this.handlers.onTranslating?.(false);
    }
  }

  /** Feed every transcript event. */
  handle(event: TranscriptEvent): void {
    if (event.type === "reset") {
      this.seen.clear();
      this.clear();
      return;
    }
    if (event.type !== "line" || !this.active || !this.target) return;
    this.addLine(event.line);
  }

  private addLine(line: TranscriptLine) {
    if (this.seen.has(line.id)) return;
    this.seen.add(line.id);
    if (line.createdAt < this.since) return;
    const text = line.text.trim();
    if (!text) return;

    const p = this.pending;
    // A language switch ends the phrase: each one is translated from its own language.
    // So does a new speaker, who gets their own voice.
    if (p && (p.language !== line.language || p.speaker !== line.speaker)) this.emit();
    if (this.pending) {
      this.pending.text = `${this.pending.text} ${text}`;
      this.pending.spokenAt = line.createdAt;
      this.pending.language ??= line.language;
    } else {
      this.pending = { text, spokenAt: line.createdAt, firstAt: line.createdAt, language: line.language, speaker: line.speaker };
    }

    const cur = this.pending!;
    if (isCompletePhrase(cur.text) || this.now() - cur.firstAt >= this.maxHoldMs) {
      this.emit();
      return;
    }
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.emit();
    }, this.holdMs);
  }

  private sourceFor(detected: string | undefined): string | null {
    return this.spoken === AUTO_LANGUAGE ? (detected ?? null) : this.spoken;
  }

  private emit() {
    const p = this.pending;
    this.pending = null;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (!p) return;

    const generation = this.generation;
    const target = this.target;
    const source = this.sourceFor(p.language);
    const seq = ++this.seq;
    // Translations run in parallel but are released in spoken order.
    this.setBusy(+1);
    const translated = source
      ? this.translate(p.text, source, target).catch(
          (err): Awaited<ReturnType<typeof translateText>> => ({
            ok: false,
            issue: { source, target, kind: "failed", detail: String(err) },
          }),
        )
      : Promise.resolve<Awaited<ReturnType<typeof translateText>>>({
          ok: false,
          issue: { source: "", target, kind: "unsupported" },
        });

    this.chain = this.chain.then(async () => {
      const result = await translated;
      if (generation !== this.generation) return;
      this.setBusy(-1);
      if (!result.ok) {
        this.handlers.onIssue?.(result.issue);
        return;
      }
      this.handlers.onIssue?.(null);
      if (this.now() - p.spokenAt > this.maxLagMs) {
        this.handlers.onSkipped?.();
        return;
      }
      const text = result.text.trim();
      if (text) this.handlers.onSegment({ seq, text, spokenAt: p.spokenAt, ...(p.speaker ? { speaker: p.speaker } : {}) });
    });
  }

  private setBusy(delta: number) {
    const before = this.inFlight;
    this.inFlight = Math.max(0, this.inFlight + delta);
    if ((before === 0) !== (this.inFlight === 0)) this.handlers.onTranslating?.(this.inFlight > 0);
  }
}
