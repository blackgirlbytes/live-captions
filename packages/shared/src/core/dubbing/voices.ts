/**
 * Live dubbing languages and Deepgram Flux TTS voices (developers.deepgram.com/docs/flux-tts/voices).
 *
 * A dubbing language must work through the whole pipeline: Deepgram transcribes the video,
 * Chrome's on-device translator produces the language (CAPTION_LANGUAGES), and Flux TTS has a
 * voice for it. Keys are translator codes, so they line up with caption languages.
 */
import { CAPTION_LANGUAGES } from "../settings";

export type VoiceGender = "f" | "m";

export interface FluxVoice {
  /** Model id for `/v2/speak?model=…`. */
  id: string;
  name: string;
  gender: VoiceGender;
  /**
   * Region of the accent (ISO 3166 code, e.g. "GB", "BR"), for languages whose voices come
   * in more than one accent. Unset when the catalog names no accent.
   */
  accent?: string;
}

const v = (id: string, name: string, gender: VoiceGender, accent?: string): FluxVoice => ({ id, name, gender, accent });

/** Voices per dubbing language, featured voices first. */
export const DUB_VOICES: Readonly<Record<string, readonly FluxVoice[]>> = {
  en: [
    v("flux-hannah-en", "Hannah", "f", "US"),
    v("flux-kit-en", "Kit", "m", "GB"),
    v("flux-alexis-en", "Alexis", "f", "US"),
    v("flux-cliff-en", "Cliff", "m", "US"),
    v("flux-sienna-en", "Sienna", "f", "US"),
    v("flux-cole-en", "Cole", "m", "US"),
    v("flux-gemma-en", "Gemma", "f", "GB"),
    v("flux-colin-en", "Colin", "m", "GB"),
    v("flux-haley-en", "Haley", "f", "US"),
    v("flux-miles-en", "Miles", "m", "US"),
    v("flux-maeve-en", "Maeve", "f", "IE"),
    v("flux-sharon-en", "Sharon", "f", "AU"),
    v("flux-priya-en", "Priya", "f", "IN"),
    v("flux-naveen-en", "Naveen", "m", "IN"),
  ],
  es: [
    v("flux-carmen-es", "Carmen", "f"),
    v("flux-rafael-es", "Rafael", "m"),
    v("flux-valentina-es", "Valentina", "f"),
    v("flux-alfredo-es", "Alfredo", "m"),
    v("flux-fernanda-es", "Fernanda", "f"),
    v("flux-eduardo-es", "Eduardo", "m"),
    v("flux-pilar-es", "Pilar", "f"),
    v("flux-gustavo-es", "Gustavo", "m"),
    v("flux-cecilia-es", "Cecilia", "f"),
    v("flux-tomas-es", "Tomas", "m"),
  ],
  fr: [
    v("flux-camille-fr", "Camille", "f"),
    v("flux-julien-fr", "Julien", "m"),
    v("flux-chloe-fr", "Chloe", "f"),
    v("flux-pierre-fr", "Pierre", "m"),
    v("flux-brigitte-fr", "Brigitte", "f"),
    v("flux-mathieu-fr", "Mathieu", "m"),
    v("flux-yasmine-fr", "Yasmine", "f"),
    v("flux-arnaud-fr", "Arnaud", "m"),
  ],
  de: [
    v("flux-janine-de", "Janine", "f", "DE"),
    v("flux-moritz-de", "Moritz", "m", "DE"),
    v("flux-sonja-de", "Sonja", "f", "DE"),
    v("flux-tobias-de", "Tobias", "m", "DE"),
    v("flux-verena-de", "Verena", "f", "DE"),
    v("flux-christian-de", "Christian", "m", "DE"),
    v("flux-leonie-de", "Leonie", "f", "CH"),
    v("flux-yannick-de", "Yannick", "m", "CH"),
  ],
  pt: [
    v("flux-mariana-pt", "Mariana", "f", "BR"),
    v("flux-bruno-pt", "Bruno", "m", "BR"),
    v("flux-bianca-pt", "Bianca", "f", "BR"),
    v("flux-rodrigo-pt", "Rodrigo", "m", "BR"),
    v("flux-catarina-pt", "Catarina", "f", "PT"),
    v("flux-pedro-pt", "Pedro", "m", "PT"),
  ],
  it: [
    v("flux-chiara-it", "Chiara", "f"),
    v("flux-matteo-it", "Matteo", "m"),
    v("flux-sofia-it", "Sofia", "f"),
    v("flux-federico-it", "Federico", "m"),
  ],
  nl: [
    v("flux-anouk-nl", "Anouk", "f", "NL"),
    v("flux-bram-nl", "Bram", "m", "NL"),
    v("flux-sanne-nl", "Sanne", "f", "NL"),
    v("flux-ruben-nl", "Ruben", "m", "NL"),
    v("flux-lotte-nl", "Lotte", "f", "BE"),
    v("flux-niels-nl", "Niels", "m", "BE"),
  ],
  ja: [v("flux-ayumi-ja", "Ayumi", "f"), v("flux-hayato-ja", "Hayato", "m"), v("flux-nozomi-ja", "Nozomi", "f"), v("flux-sayaka-ja", "Sayaka", "f")],
  hi: [v("flux-anjali-hi", "Anjali", "f"), v("flux-arjun-hi", "Arjun", "m"), v("flux-divya-hi", "Divya", "f"), v("flux-vikram-hi", "Vikram", "m")],
  ru: [v("flux-natalia-ru", "Natalia", "f"), v("flux-mikhail-ru", "Mikhail", "m"), v("flux-olga-ru", "Olga", "f"), v("flux-andrei-ru", "Andrei", "m")],
  ko: [v("flux-eunji-ko", "Eunji", "f"), v("flux-minjun-ko", "Minjun", "m"), v("flux-soojin-ko", "Soojin", "f"), v("flux-hyunwoo-ko", "Hyunwoo", "m")],
  zh: [
    v("flux-lijuan-zh", "Lijuan", "f", "CN"),
    v("flux-haoran-zh", "Haoran", "m", "CN"),
    v("flux-wenjing-zh", "Wenjing", "f", "CN"),
    v("flux-jian-zh", "Jian", "m", "CN"),
  ],
  "zh-Hant": [
    v("flux-yawen-zh", "Yawen", "f", "TW"),
    v("flux-kuanyu-zh", "Kuanyu", "m", "TW"),
    v("flux-yuting-zh", "Yuting", "f", "TW"),
    v("flux-chiaying-zh", "Chiaying", "f", "TW"),
  ],
  // Early Access languages with one catalogued voice each.
  bn: [v("flux-afsana-bn", "Afsana", "f")],
  bg: [v("flux-desislava-bg", "Desislava", "f")],
  hr: [v("flux-dalibor-hr", "Dalibor", "m")],
  cs: [v("flux-jakub-cs", "Jakub", "m")],
  da: [v("flux-pernille-da", "Pernille", "f")],
  fi: [v("flux-kirsi-fi", "Kirsi", "f")],
  el: [v("flux-kostas-el", "Kostas", "m")],
  hu: [v("flux-bence-hu", "Bence", "m")],
  id: [v("flux-dewi-id", "Dewi", "f")],
  kn: [v("flux-manjunath-kn", "Manjunath", "m")],
  lt: [v("flux-goda-lt", "Goda", "f")],
  mr: [v("flux-pooja-mr", "Pooja", "f")],
  no: [v("flux-erlend-no", "Erlend", "m")],
  pl: [v("flux-bartosz-pl", "Bartosz", "m")],
  ro: [v("flux-cosmin-ro", "Cosmin", "m")],
  sk: [v("flux-dominika-sk", "Dominika", "f")],
  sl: [v("flux-gregor-sl", "Gregor", "m")],
  sv: [v("flux-axel-sv", "Axel", "m")],
  ta: [v("flux-gokul-ta", "Gokul", "m")],
  te: [v("flux-pavan-te", "Pavan", "m")],
  tr: [v("flux-dilek-tr", "Dilek", "f")],
  uk: [v("flux-denys-uk", "Denys", "m")],
  vi: [v("flux-hoa-vi", "Hoa", "f")],
};

/** Dubbing languages as `[translator code, English name]`, in caption-language order. */
export const DUB_LANGUAGES: ReadonlyArray<readonly [string, string]> = CAPTION_LANGUAGES.filter(([code]) => (DUB_VOICES[code]?.length ?? 0) > 0);

export function voicesFor(language: string): readonly FluxVoice[] {
  return DUB_VOICES[language] ?? [];
}

/** The voice if it belongs to the language, else that language's first voice. */
export function pickVoice(language: string, voice: string | null | undefined): string {
  const voices = voicesFor(language);
  return voices.find((x) => x.id === voice)?.id ?? voices[0]?.id ?? "";
}

/** Accent regions a language's voices come in, most common first ([] when there's no choice). */
export function accentsFor(language: string): string[] {
  const out: string[] = [];
  for (const voice of voicesFor(language)) if (voice.accent && !out.includes(voice.accent)) out.push(voice.accent);
  return out.length > 1 ? out : [];
}

/** The accent if the language has it, else its most common one ("" when there's no choice). */
export function pickAccent(language: string, accent: string | null | undefined): string {
  const accents = accentsFor(language);
  return accents.find((a) => a === accent) ?? accents[0] ?? "";
}

export interface DubSettings {
  /** Translator code of the dubbed speech (a key of DUB_VOICES). */
  language: string;
  /**
   * Accent region for languages with several ("" otherwise). Voices within it are picked per
   * speaker, lower or higher to match each one.
   */
  accent: string;
}

export const DEFAULT_DUB_SETTINGS: DubSettings = {
  language: "es",
  accent: "",
};

/**
 * While dubbing, the original plays at 10% so the interpreter is clearly on top while the
 * speaker's tone, music and other sounds stay faintly audible. Not user-adjustable.
 */
export const DUB_ORIGINAL_VOLUME = 0.1;

/** Merge untrusted stored settings with defaults. Settings saved with a voice keep its accent. */
export function normalizeDubSettings(input: unknown): DubSettings {
  const raw = (typeof input === "object" && input !== null ? input : {}) as Partial<DubSettings> & { voice?: unknown };
  const language = typeof raw.language === "string" && voicesFor(raw.language).length > 0 ? raw.language : DEFAULT_DUB_SETTINGS.language;
  const fromVoice = typeof raw.voice === "string" ? voicesFor(language).find((x) => x.id === raw.voice)?.accent : undefined;
  return { language, accent: pickAccent(language, typeof raw.accent === "string" ? raw.accent : fromVoice) };
}
