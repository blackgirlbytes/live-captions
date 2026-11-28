import { useId, type ReactNode } from "react";
import { languageName } from "../core/settings";
import { accentsFor, DUB_LANGUAGES, pickAccent, type DubSettings } from "../core/dubbing/voices";
import type { DubState, DubStatus } from "../core/dubbing/types";
import { SettingsIcon } from "./icons";
import { DEFAULT_DUBBING_LABELS, type DubbingLabels } from "./labels";
import { Select } from "./Select";

const DOT: Record<DubStatus, string> = {
  off: "bg-ink-500",
  connecting: "bg-accent animate-pulse",
  listening: "bg-ok",
  translating: "bg-accent",
  playing: "bg-ok animate-pulse",
  reconnecting: "bg-accent animate-pulse",
  unavailable: "bg-live",
};

/* ------------------------------ bar ------------------------------ */

export interface DubbingBarProps {
  settings: DubSettings;
  /** Whether dubbing is on right now (never on by default). */
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  state: DubState;
  /** Dubbing needs a running caption session. */
  sessionRunning: boolean;
  /** False when this setup can't keep the dub out of the captured audio. */
  available?: boolean;
  /** Opens the full dubbing settings (language, accent). Omit to hide the button. */
  onOpenSettings?: () => void;
  /** Extra message (e.g. a phrase couldn't be translated). Shown only while on. */
  notice?: ReactNode;
  labels?: Partial<DubbingLabels>;
  /** Display name for a language code (defaults to English names). */
  languageName?: (code: string) => string;
  /** Style of the "Live dubbing" title (e.g. to match section headings). */
  titleClassName?: string;
  className?: string;
}

/**
 * Live dubbing in one row: switch, a one-line status, and a settings button. Small enough
 * to sit above a transcript without pushing it down.
 */
export function DubbingBar({
  settings,
  enabled,
  onEnabledChange,
  state,
  sessionRunning,
  available = true,
  onOpenSettings,
  notice,
  labels,
  languageName: nameOf = languageName,
  titleClassName = "text-sm leading-tight font-semibold text-ink-100",
  className = "",
}: DubbingBarProps) {
  const L = { ...DEFAULT_DUBBING_LABELS, ...labels };
  const id = useId();
  const status: DubStatus = enabled ? state.status : "off";
  const failed = enabled && status === "unavailable" && state.error;

  let line: string;
  if (!available) line = L.status.unavailable;
  else if (enabled) {
    line = L.status[status];
    if (state.delayMs !== null && status !== "unavailable") line += ` · ${L.delay(state.delayMs / 1000)}`;
  } else if (sessionRunning) line = `${nameOf(settings.language)} · ${L.extraCost}`;
  else line = L.needsSession;

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p id={`${id}-title`} className={titleClassName}>
            {L.title}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-400" role="status" aria-live="polite">
            <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${DOT[status]}`} />
            <span className="min-w-0 truncate" title={line}>
              {line}
            </span>
          </p>
        </div>
        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label={L.settingsButton}
            title={L.settingsButton}
            className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-400 transition-colors hover:bg-ink-800 hover:text-ink-100 focus-visible:outline-2 focus-visible:outline-accent"
          >
            <SettingsIcon size={16} />
          </button>
        )}
        <button
          type="button"
          role="switch"
          data-testid="dub-toggle"
          aria-checked={enabled}
          aria-labelledby={`${id}-title`}
          disabled={!available || (!enabled && !sessionRunning)}
          onClick={() => onEnabledChange(!enabled)}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40 ${
            enabled ? "bg-accent" : "bg-ink-600"
          }`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${enabled ? "left-5.5" : "left-0.5"}`} />
        </button>
      </div>
      {failed && (
        <p role="alert" className="mt-2 text-xs leading-relaxed text-live">
          {L.failed(state.error!)}
        </p>
      )}
      {enabled && !failed && notice && <p className="mt-2 text-xs leading-relaxed text-accent">{notice}</p>}
    </div>
  );
}

/* ------------------------------ settings ------------------------------ */

export interface DubbingSettingsProps {
  settings: DubSettings;
  onSettingsChange: (next: DubSettings) => void;
  labels?: Partial<DubbingLabels>;
  languageName?: (code: string) => string;
  className?: string;
}

/** English name of an accent region. */
function englishRegion(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Dubbing language, accent (where there's a choice), and how voices and cost work. */
export function DubbingSettings({
  settings,
  onSettingsChange,
  labels,
  languageName: nameOf = languageName,
  className = "",
}: DubbingSettingsProps) {
  const L = { ...DEFAULT_DUBBING_LABELS, ...labels };
  const id = useId();
  const accents = accentsFor(settings.language);
  const regionName = L.regionName ?? englishRegion;
  const setLanguage = (language: string) => onSettingsChange({ language, accent: pickAccent(language, null) });

  return (
    <div className={`space-y-4 text-sm ${className}`}>
      <div className="space-y-2">
        <span id={`${id}-lang`} className="block text-ink-200">
          {L.language}
        </span>
        <Select
          aria-labelledby={`${id}-lang`}
          value={settings.language}
          onChange={setLanguage}
          options={DUB_LANGUAGES.map(([code, english]) => ({ value: code, label: nameOf === languageName ? english : nameOf(code) }))}
        />
      </div>
      {accents.length > 0 && (
        <div className="space-y-2">
          <span id={`${id}-accent`} className="block text-ink-200">
            {L.accent}
          </span>
          <Select
            aria-labelledby={`${id}-accent`}
            value={pickAccent(settings.language, settings.accent)}
            onChange={(accent) => onSettingsChange({ ...settings, accent })}
            options={accents.map((code) => ({ value: code, label: regionName(code) }))}
          />
        </div>
      )}
      <p className="text-xs leading-relaxed text-ink-400">
        {L.voicesNote} {L.costNote}
      </p>
    </div>
  );
}

/* ------------------------------ both ------------------------------ */

export interface DubbingControlsProps extends DubbingBarProps {
  onSettingsChange: (next: DubSettings) => void;
  /** Shown instead of the settings when unavailable. */
  unavailableNote?: ReactNode;
}

/** Bar plus settings in one block (or the bar plus an explanation when unavailable). */
export function DubbingControls({ onSettingsChange, unavailableNote, className = "", ...bar }: DubbingControlsProps) {
  const L = { ...DEFAULT_DUBBING_LABELS, ...bar.labels };
  const available = bar.available ?? true;
  return (
    <section className={`space-y-4 ${className}`}>
      <DubbingBar {...bar} />
      {available ? (
        <DubbingSettings
          settings={bar.settings}
          onSettingsChange={onSettingsChange}
          labels={bar.labels}
          languageName={bar.languageName}
        />
      ) : (
        <div className="rounded-lg bg-ink-850 px-3 py-2.5 text-xs leading-relaxed text-ink-300 ring-1 ring-ink-700">{unavailableNote ?? L.unavailable}</div>
      )}
    </section>
  );
}
