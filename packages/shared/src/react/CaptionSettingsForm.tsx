import { CAPTION_FONT_SIZES, DEFAULT_CAPTION_SETTINGS } from "../core/settings";
import type { CaptionSettings } from "../core/types";
import { LanguageSettings } from "./LanguageSettings";
import { DEFAULT_CAPTION_SETTINGS_LABELS, type CaptionSettingsLabels } from "./labels";

export interface CaptionSettingsFormProps {
  settings: CaptionSettings;
  onChange: (next: CaptionSettings) => void;
  /** Show the overlay/below placement option (web player only). */
  showPosition?: boolean;
  /** Caption language in effect instead of the saved one (see LanguageSettings). */
  captionOverride?: string | null;
  onCaptionLanguagePick?: (language: string) => void;
  className?: string;
  /** UI words; English by default. `labels.language` goes to the language section. */
  labels?: Partial<CaptionSettingsLabels>;
}

const BACKGROUNDS: Array<{ key: "solid" | "translucent" | "none"; color: string; opacity: number }> = [
  { key: "solid", color: "#000000", opacity: 0.9 },
  { key: "translucent", color: "#000000", opacity: 0.6 },
  { key: "none", color: "#000000", opacity: 0 },
];
const TEXT_COLORS = ["#ffffff", "#ffe27a", "#9ef0c4", "#a9d4ff"];

/** Caption appearance controls shared by the web player and the extension side panel. */
export function CaptionSettingsForm({ settings, onChange, showPosition = false, captionOverride = null, onCaptionLanguagePick, className = "", labels }: CaptionSettingsFormProps) {
  const L = { ...DEFAULT_CAPTION_SETTINGS_LABELS, ...labels };
  const set = <K extends keyof CaptionSettings>(key: K, value: CaptionSettings[K]) => onChange({ ...settings, [key]: value });
  const seg = (on: boolean) =>
    `h-8 flex-1 rounded-md px-2 text-sm font-medium transition-colors ${on ? "bg-ink-600 text-ink-100 shadow-sm" : "text-ink-300 hover:text-ink-100"}`;

  return (
    <div className={`space-y-5 text-sm ${className}`}>
      <label className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-100">{L.showCaptions}</span>
        <button
          type="button"
          role="switch"
          aria-checked={settings.enabled}
          onClick={() => set("enabled", !settings.enabled)}
          className={`relative h-6 w-11 rounded-full transition-colors ${settings.enabled ? "bg-accent" : "bg-ink-600"}`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${settings.enabled ? "left-5.5" : "left-0.5"}`} />
        </button>
      </label>

      <LanguageSettings settings={settings} onChange={onChange} captionOverride={captionOverride} onCaptionLanguagePick={onCaptionLanguagePick} labels={L.language} />

      <fieldset className="space-y-2">
        <legend className="mb-2 text-xs font-semibold tracking-wide text-ink-300 uppercase">{L.textSize}</legend>
        <div className="flex gap-1 rounded-lg bg-ink-850 p-1 ring-1 ring-ink-700">
          {CAPTION_FONT_SIZES.map((size, i) => (
            <button key={size} type="button" className={seg(settings.fontSize === size)} onClick={() => set("fontSize", size)} aria-pressed={settings.fontSize === size}>
              {L.sizes[i]}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-xs font-semibold tracking-wide text-ink-300 uppercase">{L.background}</legend>
        <div className="flex gap-1 rounded-lg bg-ink-850 p-1 ring-1 ring-ink-700">
          {BACKGROUNDS.map((b) => {
            const on = Math.abs(settings.backgroundOpacity - b.opacity) < 0.05;
            return (
              <button
                key={b.key}
                type="button"
                className={seg(on)}
                aria-pressed={on}
                onClick={() => onChange({ ...settings, backgroundColor: b.color, backgroundOpacity: b.opacity })}
              >
                {L.backgrounds[b.key]}
              </button>
            );
          })}
        </div>
        <label className="mt-3 flex items-center gap-3 text-sm text-ink-300">
          {L.opacity}
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.backgroundOpacity}
            onChange={(e) => set("backgroundOpacity", Number(e.target.value))}
            className="flex-1 accent-[var(--color-accent)]"
          />
          <span className="w-8 text-right tabular-nums">{Math.round(settings.backgroundOpacity * 100)}%</span>
        </label>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-xs font-semibold tracking-wide text-ink-300 uppercase">{L.text}</legend>
        <div className="flex items-center gap-2">
          {TEXT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => set("textColor", c)}
              aria-label={L.textColor(c)}
              aria-pressed={settings.textColor === c}
              className={`h-7 w-7 rounded-full ring-2 ring-offset-2 ring-offset-ink-900 transition ${settings.textColor === c ? "ring-accent" : "ring-transparent hover:ring-ink-600"}`}
              style={{ background: c }}
            />
          ))}
          <div className="ml-auto flex gap-1 rounded-lg bg-ink-850 p-1 ring-1 ring-ink-700">
            {(["sans", "serif", "mono"] as const).map((f) => (
              <button key={f} type="button" className={seg(settings.fontFamily === f)} onClick={() => set("fontFamily", f)} aria-pressed={settings.fontFamily === f}>
                {L.fonts[f]}
              </button>
            ))}
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-xs font-semibold tracking-wide text-ink-300 uppercase">{L.lines}</legend>
        <div className="flex gap-1 rounded-lg bg-ink-850 p-1 ring-1 ring-ink-700">
          {[1, 2, 3].map((n) => (
            <button key={n} type="button" className={seg(settings.maxLines === n)} onClick={() => set("maxLines", n)} aria-pressed={settings.maxLines === n}>
              {n}
            </button>
          ))}
        </div>
      </fieldset>

      {showPosition && (
        <fieldset>
          <legend className="mb-2 text-xs font-semibold tracking-wide text-ink-300 uppercase">{L.placement}</legend>
          <div className="flex gap-1 rounded-lg bg-ink-850 p-1 ring-1 ring-ink-700">
            <button type="button" className={seg(settings.position === "overlay")} onClick={() => set("position", "overlay")} aria-pressed={settings.position === "overlay"}>
              {L.overVideo}
            </button>
            <button type="button" className={seg(settings.position === "below")} onClick={() => set("position", "below")} aria-pressed={settings.position === "below"}>
              {L.belowVideo}
            </button>
          </div>
        </fieldset>
      )}

      <button
        type="button"
        onClick={() =>
          onChange({
            ...DEFAULT_CAPTION_SETTINGS,
            enabled: settings.enabled,
            position: settings.position,
            spokenLanguage: settings.spokenLanguage,
            captionLanguage: settings.captionLanguage,
          })
        }
        className="text-sm text-ink-300 underline-offset-2 hover:text-ink-100 hover:underline"
      >
        {L.reset}
      </button>
    </div>
  );
}
