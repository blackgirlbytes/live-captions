import { afterEach, describe, expect, it, vi } from "vitest";
import { buildListenUrl } from "../src/core/deepgram";
import { normalizeCaptionSettings } from "../src/core/settings";
import { initialTranscriptState, reduceTranscript, TranscriptAssembler } from "../src/core/transcript";
import { TranslationEngine, translatorCode } from "../src/core/translate";
import type { TranscriptEvent } from "../src/core/types";

const g = globalThis as { Translator?: unknown };

/** A fake Chrome Translator: `available` pairs translate by tagging the text. */
function fakeTranslator(available: string[]) {
  g.Translator = {
    availability: vi.fn(async ({ sourceLanguage, targetLanguage }: { sourceLanguage: string; targetLanguage: string }) =>
      available.includes(`${sourceLanguage}>${targetLanguage}`) ? "available" : "downloadable",
    ),
    create: vi.fn(async ({ sourceLanguage, targetLanguage }: { sourceLanguage: string; targetLanguage: string }) => ({
      translate: async (text: string) => `[${sourceLanguage}>${targetLanguage}] ${text}`,
      destroy() {},
    })),
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => {
  delete g.Translator;
});

describe("languages", () => {
  it("maps Deepgram codes to translator codes", () => {
    expect(translatorCode("pt-BR")).toBe("pt");
    expect(translatorCode("zh-TW")).toBe("zh-Hant");
    expect(translatorCode("zh-CN")).toBe("zh");
    expect(translatorCode("es-419")).toBe("es");
  });

  it("defaults to auto-detect and drops unknown codes", () => {
    expect(normalizeCaptionSettings({}).spokenLanguage).toBe("multi");
    expect(normalizeCaptionSettings({ spokenLanguage: "xx", captionLanguage: "zz" })).toMatchObject({ spokenLanguage: "multi", captionLanguage: "" });
    expect(normalizeCaptionSettings({ spokenLanguage: "es", captionLanguage: "en" })).toMatchObject({ spokenLanguage: "es", captionLanguage: "en" });
  });

  it("asks Deepgram for the chosen language", () => {
    expect(new URL(buildListenUrl({ language: "multi" })).searchParams.get("language")).toBe("multi");
    expect(new URL(buildListenUrl({ language: "es" })).searchParams.get("language")).toBe("es");
  });

  it("tags lines and captions with the language Deepgram detected", () => {
    const events: TranscriptEvent[] = [];
    const a = new TranscriptAssembler((e) => events.push(e), { now: () => 1 });
    a.handleResults(
      {
        type: "Results",
        start: 0,
        duration: 1,
        is_final: true,
        speech_final: true,
        channel: {
          alternatives: [
            {
              transcript: "hola amigos ok",
              words: [
                { word: "hola", start: 0, end: 0.3, language: "es" },
                { word: "amigos", start: 0.3, end: 0.6, language: "es" },
                { word: "ok", start: 0.6, end: 0.8, language: "en" },
              ],
            },
          ],
        },
      },
      0,
    );
    const line = events.find((e) => e.type === "line");
    expect(line?.type === "line" && line.line.language).toBe("es");
  });
});

describe("TranslationEngine", () => {
  it("translates lines and captions from the fixed spoken language", async () => {
    fakeTranslator(["es>en"]);
    let state = initialTranscriptState();
    const engine = new TranslationEngine((e) => (state = reduceTranscript(state, e)));
    engine.configure("es", "en");
    const line = { id: "a", text: "hola", start: 0, end: 1, mediaStart: null, mediaEnd: null, createdAt: 0 };
    state = reduceTranscript(state, { type: "line", line });
    engine.handle({ type: "line", line });
    engine.handle({ type: "caption", caption: { text: "buenos días", hasInterim: true, updatedAt: 1 } });
    await flush();
    await flush();
    expect(state.translation.target).toBe("en");
    expect(state.translation.lines.a).toBe("[es>en] hola");
    expect(state.translation.caption).toBe("[es>en] buenos días");
  });

  it("uses the detected language in auto mode and leaves same-language text alone", async () => {
    fakeTranslator(["fr>en"]);
    let state = initialTranscriptState();
    const engine = new TranslationEngine((e) => (state = reduceTranscript(state, e)));
    engine.configure("multi", "en");
    engine.handle({ type: "caption", caption: { text: "bonjour", hasInterim: false, updatedAt: 1, language: "fr" } });
    await flush();
    expect(state.translation.caption).toBe("[fr>en] bonjour");
    engine.handle({ type: "caption", caption: { text: "hello", hasInterim: false, updatedAt: 2, language: "en" } });
    await flush();
    expect(state.translation.caption).toBe("hello");
  });

  it("reports a pair that needs a download and shows the original meanwhile", async () => {
    fakeTranslator([]);
    let state = initialTranscriptState();
    const engine = new TranslationEngine((e) => (state = reduceTranscript(state, e)));
    engine.configure("de", "en");
    engine.handle({ type: "caption", caption: { text: "hallo", hasInterim: false, updatedAt: 1 } });
    await flush();
    await flush();
    expect(state.translation.issue).toEqual({ source: "de", target: "en", kind: "download" });
    expect(state.translation.caption).toBe("hallo");
  });

  it("does nothing when the caption language matches the spoken one", () => {
    const events: TranscriptEvent[] = [];
    const engine = new TranslationEngine((e) => events.push(e));
    engine.configure("es", "es");
    expect(engine.active).toBe(false);
  });

  it("reports when the browser has no translator", async () => {
    let state = initialTranscriptState();
    const engine = new TranslationEngine((e) => (state = reduceTranscript(state, e)));
    // A pair no earlier test created (translators are cached per page).
    engine.configure("it", "ja");
    engine.handle({ type: "caption", caption: { text: "ciao", hasInterim: false, updatedAt: 1 } });
    await flush();
    expect(state.translation.issue?.kind).toBe("no-api");
  });
});
