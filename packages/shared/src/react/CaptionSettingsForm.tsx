import { CAPTION_FONT_SIZES, DEFAULT_CAPTION_SETTINGS } from "../core/settings";
import type { CaptionSettings } from "../core/types";

export interface CaptionSettingsFormProps {
  settings: CaptionSettings;
  onChange: (next: CaptionSettings) => void;
  /** Show the overlay/below placement option (web player only). */
  showPosition?: boolean;
  className?: string;
}

const BACKGROUNDS: Array<{ label: string; color: string; opacity: number }> = [
  { label: "Solid", color: "#000000", opacity: 0.9 },
  { label: "Translucent", color: "#000000", opacity: 0.6 },
  { label: "None", color: "#000000", opacity: 0 },
];
const TEXT_COLORS = ["#ffffff", "#ffe27a", "#9ef0c4", "#a9d4ff"];

/** Caption appearance controls shared by the web player and the extension side panel. */
export function CaptionSettingsForm({ settings, onChange, showPosition = false, className = "" }: CaptionSettingsFormProps) {
  const set = <K extends keyof CaptionSettings>(key: K, value: CaptionSettings[K]) => onChange({ ...settings, [key]: value });
  const seg = (on: boolean) =>
    `h-8 flex-1 rounded-md px-2 text-xs font-medium transition-colors ${on ? "bg-ink-600 text-ink-100 shadow-sm" : "text-ink-400 hover:text-ink-100"}`;

  return (
    <div className={`space-y-5 text-sm ${className}`}>
      <label className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-100">Show captions</span>
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

      <fieldset className="space-y-2">
        <legend className="mb-2 text-xs font-medium tracking-wide text-ink-400 uppercase">Text size</legend>
        <div className="flex gap-1 rounded-lg bg-ink-850 p-1 ring-1 ring-ink-700">
          {CAPTION_FONT_SIZES.map((size, i) => (
            <button key={size} type="button" className={seg(settings.fontSize === size)} onClick={() => set("fontSize", size)} aria-pressed={settings.fontSize === size}>
              {["XS", "S", "M", "L", "XL", "2XL"][i]}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-xs font-medium tracking-wide text-ink-400 uppercase">Background</legend>
        <div className="flex gap-1 rounded-lg bg-ink-850 p-1 ring-1 ring-ink-700">
          {BACKGROUNDS.map((b) => {
            const on = Math.abs(settings.backgroundOpacity - b.opacity) < 0.05;
            return (
              <button
                key={b.label}
                type="button"
                className={seg(on)}
                aria-pressed={on}
                onClick={() => onChange({ ...settings, backgroundColor: b.color, backgroundOpacity: b.opacity })}
              >
                {b.label}
              </button>
            );
          })}
        </div>
        <label className="mt-3 flex items-center gap-3 text-xs text-ink-400">
          Opacity
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
        <legend className="mb-2 text-xs font-medium tracking-wide text-ink-400 uppercase">Text</legend>
        <div className="flex items-center gap-2">
          {TEXT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => set("textColor", c)}
              aria-label={`Text color ${c}`}
              aria-pressed={settings.textColor === c}
              className={`h-7 w-7 rounded-full ring-2 ring-offset-2 ring-offset-ink-900 transition ${settings.textColor === c ? "ring-accent" : "ring-transparent hover:ring-ink-600"}`}
              style={{ background: c }}
            />
          ))}
          <div className="ml-auto flex gap-1 rounded-lg bg-ink-850 p-1 ring-1 ring-ink-700">
            {(["sans", "serif", "mono"] as const).map((f) => (
              <button key={f} type="button" className={seg(settings.fontFamily === f)} onClick={() => set("fontFamily", f)} aria-pressed={settings.fontFamily === f}>
                {f === "sans" ? "Sans" : f === "serif" ? "Serif" : "Mono"}
              </button>
            ))}
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-xs font-medium tracking-wide text-ink-400 uppercase">Lines</legend>
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
          <legend className="mb-2 text-xs font-medium tracking-wide text-ink-400 uppercase">Placement</legend>
          <div className="flex gap-1 rounded-lg bg-ink-850 p-1 ring-1 ring-ink-700">
            <button type="button" className={seg(settings.position === "overlay")} onClick={() => set("position", "overlay")} aria-pressed={settings.position === "overlay"}>
              Over video
            </button>
            <button type="button" className={seg(settings.position === "below")} onClick={() => set("position", "below")} aria-pressed={settings.position === "below"}>
              Below video
            </button>
          </div>
        </fieldset>
      )}

      <button
        type="button"
        onClick={() => onChange({ ...DEFAULT_CAPTION_SETTINGS, enabled: settings.enabled, position: settings.position })}
        className="text-xs text-ink-400 underline-offset-2 hover:text-ink-100 hover:underline"
      >
        Reset to defaults
      </button>
    </div>
  );
}
