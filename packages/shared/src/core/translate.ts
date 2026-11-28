/**
 * Caption translation with Chrome's built-in, on-device Translator API
 * (developer.chrome.com/docs/ai/translator-api). Deepgram transcribes in the spoken language;
 * this turns that text into the viewer's language without any server or key: the model runs
 * in the browser and text never leaves it.
 *
 * Each language pair is a one-time download that Chrome only starts from a click, so the
 * settings UI calls `prepareTranslator` from its change handler, and the running session
 * reports a `download` issue when it meets a pair that isn't on the device yet.
 */
import { AUTO_LANGUAGE } from "./settings";
import type { CaptionState, TranscriptEvent, TranscriptLine, TranslationIssue } from "./types";

type Availability = "unavailable" | "downloadable" | "downloading" | "available";

interface ChromeTranslator {
  translate(text: string): Promise<string>;
  destroy(): void;
}

interface ChromeTranslatorApi {
  availability(opts: { sourceLanguage: string; targetLanguage: string }): Promise<Availability>;
  create(opts: {
    sourceLanguage: string;
    targetLanguage: string;
    monitor?: (m: EventTarget) => void;
  }): Promise<ChromeTranslator>;
}

function translatorApi(): ChromeTranslatorApi | null {
  const api = (globalThis as { Translator?: ChromeTranslatorApi }).Translator;
  return api && typeof api.create === "function" ? api : null;
}

/** Whether this browser has Chrome's built-in translator. */
export function hasTranslator(): boolean {
  return translatorApi() !== null;
}

/** Deepgram language code (`pt-BR`, `zh-TW`) → the code Chrome's translator expects (`pt`, `zh-Hant`). */
export function translatorCode(code: string): string {
  const c = code.trim().toLowerCase();
  if (c === "zh" || c.startsWith("zh-")) return /^zh-(tw|hk|mo|hant)/.test(c) ? "zh-Hant" : "zh";
  const base = c.split("-")[0] ?? c;
  return base === "iw" ? "he" : base;
}

const translators = new Map<string, Promise<ChromeTranslator>>();
const pairKey = (source: string, target: string) => `${source}>${target}`;

/** `no-api` when the browser has no built-in translator. */
export async function translatorAvailability(source: string, target: string): Promise<Availability | "no-api"> {
  const api = translatorApi();
  if (!api) return "no-api";
  try {
    // Some Chromium builds (embedded browsers) expose the API but never answer: treat that as no API.
    const timeout = new Promise<"no-api">((resolve) => setTimeout(() => resolve("no-api"), AVAILABILITY_TIMEOUT_MS));
    return await Promise.race([
      api.availability({ sourceLanguage: translatorCode(source), targetLanguage: translatorCode(target) }),
      timeout,
    ]);
  } catch {
    return "unavailable";
  }
}

const AVAILABILITY_TIMEOUT_MS = 4000;
/** Loading a downloaded model, and translating one caption, take well under these. */
const CREATE_TIMEOUT_MS = 20_000;
const TRANSLATE_TIMEOUT_MS = 10_000;

class TimeoutError extends Error {
  constructor(what: string, ms: number) {
    super(`Chrome's translator didn't answer (${what}, ${ms / 1000}s)`);
  }
}

/** Some contexts expose the translator but never settle its promises: never wait forever. */
function withTimeout<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new TimeoutError(what, ms)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

function describe(err: unknown): string {
  if (err instanceof Error) return err.name && err.name !== "Error" ? `${err.name}: ${err.message}` : err.message;
  return String(err);
}

/**
 * Start (or finish) the one-time download for a language pair. Call it straight from a click
 * or change handler: Chrome only downloads a model during a user gesture.
 * Resolves true once the pair is ready.
 */
export async function prepareTranslator(source: string, target: string, onProgress?: (fraction: number) => void): Promise<boolean> {
  const api = translatorApi();
  if (!api) return false;
  const s = translatorCode(source);
  const t = translatorCode(target);
  if (s === t) return true;
  const key = pairKey(s, t);
  const existing = translators.get(key);
  if (existing) return existing.then(() => true, () => false);
  const created = api.create({
    sourceLanguage: s,
    targetLanguage: t,
    monitor: (m) =>
      m.addEventListener("downloadprogress", (e) => onProgress?.(Number((e as Event & { loaded?: number }).loaded) || 0)),
  });
  translators.set(key, created);
  try {
    await created;
    return true;
  } catch {
    translators.delete(key);
    return false;
  }
}

type NotReady = Pick<TranslationIssue, "kind" | "detail">;

/** A ready translator for the pair, or the reason there isn't one. Never downloads. */
async function readyTranslator(source: string, target: string): Promise<ChromeTranslator | NotReady> {
  const key = pairKey(source, target);
  let created = translators.get(key);
  if (!created) {
    const availability = await translatorAvailability(source, target);
    if (availability === "no-api") return { kind: "no-api" };
    if (availability === "unavailable") return { kind: "unsupported" };
    if (availability !== "available") return { kind: "download" };
    created = translatorApi()!.create({ sourceLanguage: source, targetLanguage: target });
    translators.set(key, created);
  }
  try {
    return await withTimeout(created, CREATE_TIMEOUT_MS, "loading the model");
  } catch (err) {
    translators.delete(key);
    console.warn(`Heard: couldn't load the ${source}→${target} translator`, err);
    return { kind: "failed", detail: describe(err) };
  }
}

/**
 * Translate one piece of text with the same cached on-device translators the captions use.
 * Never downloads a model. Codes may be Deepgram or translator codes.
 */
export async function translateText(
  text: string,
  source: string,
  target: string,
): Promise<{ ok: true; text: string } | { ok: false; issue: TranslationIssue }> {
  const s = translatorCode(source);
  const t = translatorCode(target);
  if (s === t) return { ok: true, text };
  const translator = await readyTranslator(s, t);
  if ("kind" in translator) return { ok: false, issue: { source: s, target: t, ...translator } };
  try {
    return { ok: true, text: await withTimeout(translator.translate(text), TRANSLATE_TIMEOUT_MS, "translating") };
  } catch (err) {
    translators.delete(pairKey(s, t));
    return { ok: false, issue: { source: s, target: t, kind: "failed", detail: describe(err) } };
  }
}

/** How long to wait before asking Chrome again about a pair that wasn't ready. */
const RECHECK_MS = 3000;

/**
 * Follows a transcript's events and emits translations of its lines and live caption.
 * The caption is translated latest-wins, so a slow translation never queues up behind
 * a speaker: while one runs, only the newest caption text waits for the next turn.
 */
export class TranslationEngine {
  private spoken = AUTO_LANGUAGE;
  private target: string | null = null;
  private generation = 0;
  private issue: TranslationIssue | null = null;
  private notReadyUntil = new Map<string, number>();
  private captionBusy = false;
  private nextCaption: CaptionState | null = null;

  constructor(private readonly emit: (event: TranscriptEvent) => void) {}

  get active(): boolean {
    return this.target !== null;
  }

  /** `spoken` is a Deepgram code or "multi"; `caption` is "" to keep the spoken language. */
  configure(spoken: string, caption: string): void {
    this.spoken = spoken || AUTO_LANGUAGE;
    const target = caption ? translatorCode(caption) : null;
    // A fixed spoken language that matches the caption language needs no translating.
    const next = target && this.spoken !== AUTO_LANGUAGE && translatorCode(this.spoken) === target ? null : target;
    if (next === this.target) return;
    this.target = next;
    this.generation += 1;
    this.issue = null;
    this.notReadyUntil.clear();
    this.emit({ type: "translation-config", target: next, issue: null });
  }

  /** Feed every transcript event here. */
  handle(event: TranscriptEvent): void {
    if (!this.target) return;
    if (event.type === "line") void this.translateLine(event.line);
    else if (event.type === "caption") this.queueCaption(event.caption);
  }

  private sourceFor(detected: string | undefined): string | null {
    const code = this.spoken === AUTO_LANGUAGE ? detected : this.spoken;
    return code ? translatorCode(code) : null;
  }

  /** The translated text, the original when it's already in the target language, or null. */
  private async translate(text: string, detected: string | undefined): Promise<string | null> {
    const target = this.target;
    const source = this.sourceFor(detected);
    if (!target || !source) return null;
    if (source === target) return text;
    const key = pairKey(source, target);
    if ((this.notReadyUntil.get(key) ?? 0) > Date.now()) return null;
    const translator = await readyTranslator(source, target);
    if ("kind" in translator) {
      this.notReadyUntil.set(key, Date.now() + RECHECK_MS);
      this.setIssue({ source, target, ...translator });
      return null;
    }
    try {
      const out = await withTimeout(translator.translate(text), TRANSLATE_TIMEOUT_MS, "translating");
      if (this.issue) this.setIssue(null);
      return out;
    } catch (err) {
      // Start over with a fresh translator on the next try.
      translators.delete(key);
      this.notReadyUntil.set(key, Date.now() + RECHECK_MS);
      console.warn(`Heard: ${source}→${target} translation failed`, err);
      this.setIssue({ source, target, kind: "failed", detail: describe(err) });
      return null;
    }
  }

  private setIssue(issue: TranslationIssue | null) {
    const same =
      issue === this.issue ||
      (issue &&
        this.issue &&
        issue.kind === this.issue.kind &&
        issue.source === this.issue.source &&
        issue.target === this.issue.target &&
        issue.detail === this.issue.detail);
    if (same) return;
    this.issue = issue;
    this.emit({ type: "translation-config", target: this.target, issue });
  }

  private async translateLine(line: TranscriptLine) {
    const generation = this.generation;
    const target = this.target;
    const text = await this.translate(line.text, line.language);
    if (text === null || !target || generation !== this.generation) return;
    this.emit({ type: "line-translated", target, id: line.id, text });
  }

  private queueCaption(caption: CaptionState) {
    this.nextCaption = caption;
    if (!this.captionBusy) void this.pumpCaptions();
  }

  private async pumpCaptions() {
    this.captionBusy = true;
    try {
      while (this.nextCaption) {
        const caption = this.nextCaption;
        this.nextCaption = null;
        const generation = this.generation;
        const target = this.target;
        if (!target) break;
        const text = caption.text ? await this.translate(caption.text, caption.language) : "";
        if (generation !== this.generation) continue;
        // Untranslatable text shows as spoken rather than leaving an older translation up.
        this.emit({ type: "caption-translated", target, text: text ?? caption.text });
      }
    } finally {
      this.captionBusy = false;
    }
  }
}
