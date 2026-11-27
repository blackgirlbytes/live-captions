import { useEffect, useState } from "react";
import { AUTO_LANGUAGE, CAPTION_LANGUAGES, languageName, SPOKEN_LANGUAGES } from "../core/settings";
import { hasTranslator, prepareTranslator, translatorAvailability, translatorCode } from "../core/translate";
import type { CaptionSettings, TranslationIssue } from "../core/types";
import { DEFAULT_LANGUAGE_SETTINGS_LABELS, type LanguageSettingsLabels } from "./labels";

function resolve(labels?: Partial<LanguageSettingsLabels>) {
  const L = { ...DEFAULT_LANGUAGE_SETTINGS_LABELS, ...labels };
  const name = L.languageName ?? languageName;
  return { L, name, pair: (from: string, to: string) => L.pair(name(from), name(to)) };
}

type PairStatus =
  | { kind: "none" }
  | { kind: "checking" }
  | { kind: "ready" }
  | { kind: "download" }
  | { kind: "downloading"; progress: number }
  | { kind: "unsupported" }
  | { kind: "no-api" }
  | { kind: "auto" };

const selectClass =
  "h-9 w-full rounded-lg bg-ink-850 px-2.5 text-sm text-ink-100 ring-1 ring-ink-700 focus-visible:outline-2 focus-visible:outline-accent";

/** Spoken language (Deepgram) and caption language (Chrome's on-device translator). */
export function LanguageSettings({
  settings,
  onChange,
  labels,
}: {
  settings: CaptionSettings;
  onChange: (next: CaptionSettings) => void;
  labels?: Partial<LanguageSettingsLabels>;
}) {
  const { L, name } = resolve(labels);
  const spoken = settings.spokenLanguage;
  const target = settings.captionLanguage;
  const [status, setStatus] = useState<PairStatus>({ kind: "none" });

  const translating = Boolean(target) && !(spoken !== AUTO_LANGUAGE && translatorCode(spoken) === translatorCode(target));

  useEffect(() => {
    let alive = true;
    if (!translating) return setStatus({ kind: "none" });
    if (!hasTranslator()) return setStatus({ kind: "no-api" });
    if (spoken === AUTO_LANGUAGE) return setStatus({ kind: "auto" });
    setStatus((s) => (s.kind === "downloading" ? s : { kind: "checking" }));
    void translatorAvailability(spoken, target).then((a) => {
      if (!alive) return;
      setStatus((s) => {
        if (s.kind === "downloading" && (a === "downloadable" || a === "downloading")) return s;
        if (a === "available") return { kind: "ready" };
        if (a === "unavailable") return { kind: "unsupported" };
        if (a === "no-api") return { kind: "no-api" };
        return { kind: "download" };
      });
    });
    return () => {
      alive = false;
    };
  }, [spoken, target, translating]);

  /** Must run inside the click/change handler: Chrome only downloads during a user gesture. */
  const download = (from: string, to: string) => {
    if (!hasTranslator() || from === AUTO_LANGUAGE || !to || translatorCode(from) === translatorCode(to)) return;
    setStatus({ kind: "downloading", progress: 0 });
    void prepareTranslator(from, to, (p) => setStatus({ kind: "downloading", progress: p })).then((ok) =>
      setStatus(ok ? { kind: "ready" } : { kind: "unsupported" }),
    );
  };

  return (
    <fieldset className="space-y-3">
      <legend className="mb-2 text-xs font-medium tracking-wide text-ink-400 uppercase">{L.legend}</legend>
      <label className="block space-y-1.5">
        <span className="text-xs text-ink-400">{L.spoken}</span>
        <select
          className={selectClass}
          value={spoken}
          onChange={(e) => {
            const next = e.target.value;
            onChange({ ...settings, spokenLanguage: next });
            download(next, target);
          }}
        >
          <option value={AUTO_LANGUAGE}>{L.detect}</option>
          {SPOKEN_LANGUAGES.map(([code, english]) => (
            <option key={code} value={code}>
              {L.languageName ? name(code) : english}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1.5">
        <span className="text-xs text-ink-400">{L.showIn}</span>
        <select
          className={selectClass}
          value={target}
          onChange={(e) => {
            const next = e.target.value;
            onChange({ ...settings, captionLanguage: next });
            download(spoken, next);
          }}
        >
          <option value="">{L.sameAsSpoken}</option>
          {CAPTION_LANGUAGES.map(([code, english]) => (
            <option key={code} value={code}>
              {L.languageName ? name(code) : english}
            </option>
          ))}
        </select>
      </label>
      <PairStatusNote status={status} spoken={spoken} target={target} onDownload={() => download(spoken, target)} labels={labels} />
    </fieldset>
  );
}

function PairStatusNote({
  status,
  spoken,
  target,
  onDownload,
  labels,
}: {
  status: PairStatus;
  spoken: string;
  target: string;
  onDownload: () => void;
  labels?: Partial<LanguageSettingsLabels>;
}) {
  const r = resolve(labels);
  const { L } = r;
  const pair = r.pair(spoken, target);
  const note = "text-xs leading-relaxed text-ink-400";
  switch (status.kind) {
    case "none":
    case "checking":
      return null;
    case "ready":
      return <p className={note}>{L.ready(pair)}</p>;
    case "download":
      return (
        <p className={note}>
          {L.needsDownload(pair)}{" "}
          <button type="button" onClick={onDownload} className="font-medium text-accent hover:underline">
            {L.downloadNow}
          </button>
        </p>
      );
    case "downloading":
      return (
        <p className={note} role="status">
          {L.downloading(pair, Math.round(status.progress * 100))}
        </p>
      );
    case "unsupported":
      return <p className={note}>{L.unsupported(pair)}</p>;
    case "no-api":
      return <p className={note}>{L.noApi}</p>;
    case "auto":
      return <p className={note}>{L.auto(r.name(target))}</p>;
  }
}

/** Shown beside the transcript when the running session hits a pair it can't translate yet. */
export function TranslationNotice({
  issue,
  className = "",
  labels,
}: {
  issue: TranslationIssue | null;
  className?: string;
  labels?: Partial<LanguageSettingsLabels>;
}) {
  const r = resolve(labels);
  const { L } = r;
  const [state, setState] = useState<"idle" | "downloading" | "failed">("idle");
  const [progress, setProgress] = useState(0);
  useEffect(() => setState("idle"), [issue?.source, issue?.target, issue?.kind]);
  if (!issue) return null;
  const pair = r.pair(issue.source, issue.target);
  let body;
  if (issue.kind === "no-api") {
    body = <>{L.noticeNoApi}</>;
  } else if (issue.kind === "unsupported" || state === "failed") {
    body = <>{L.noticeUnsupported(pair, r.name(issue.source))}</>;
  } else if (state === "downloading") {
    body = <>{L.downloading(pair, Math.round(progress * 100))}</>;
  } else {
    body = (
      <>
        {L.noticeNeedsDownload(pair)}{" "}
        <button
          type="button"
          className="font-medium text-accent hover:underline"
          onClick={() => {
            setState("downloading");
            void prepareTranslator(issue.source, issue.target, setProgress).then((ok) => setState(ok ? "idle" : "failed"));
          }}
        >
          {L.noticeDownload}
        </button>
      </>
    );
  }
  return (
    <p role="status" className={`text-xs leading-relaxed text-ink-300 ${className}`}>
      {body}
    </p>
  );
}
