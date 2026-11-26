/** Small illustrations of the three capture steps, reused on the home page and in the start guide. */

const frame = "relative aspect-[16/10] w-full overflow-hidden rounded-xl bg-ink-900 ring-1 ring-ink-700";

export function StepArtStart() {
  return (
    <div className={frame} aria-hidden="true">
      <div className="absolute inset-x-4 top-4 h-[46%] rounded-md bg-ink-800" />
      <div className="absolute inset-x-4 bottom-4 flex items-center gap-2">
        <span className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-accent px-2.5 text-[11px] font-semibold text-accent-ink shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-accent)_25%,transparent)]">
          <svg width="10" height="10" viewBox="0 0 24 24"><path d="M7 5v14l12-7z" fill="currentColor" /></svg>
          Start captions
        </span>
        <span className="h-2 w-16 rounded-full bg-ink-700" />
      </div>
    </div>
  );
}

export function StepArtPicker() {
  return (
    <div className={frame} aria-hidden="true">
      <div className="absolute inset-3 rounded-lg bg-ink-800 p-3 ring-1 ring-ink-600">
        <div className="mb-2 h-2 w-24 rounded-full bg-ink-600" />
        <div className="flex gap-1.5 text-[10px] font-medium">
          <span className="rounded-md bg-accent/15 px-2 py-1 text-accent ring-1 ring-accent/50">This tab</span>
          <span className="rounded-md px-2 py-1 text-ink-500">Window</span>
          <span className="rounded-md px-2 py-1 text-ink-500">Screen</span>
        </div>
        <div className="mt-2.5 h-[42%] rounded-md bg-ink-700 ring-2 ring-accent/70" />
      </div>
    </div>
  );
}

export function StepArtAudio() {
  return (
    <div className={frame} aria-hidden="true">
      <div className="absolute inset-3 flex flex-col justify-end rounded-lg bg-ink-800 p-3 ring-1 ring-ink-600">
        <div className="flex items-center justify-between rounded-md bg-ink-900 px-2.5 py-2">
          <span className="text-[10px] font-medium text-ink-200">Also share tab audio</span>
          <span className="relative h-4 w-7 rounded-full bg-accent">
            <span className="absolute top-0.5 right-0.5 h-3 w-3 rounded-full bg-white" />
          </span>
        </div>
        <div className="mt-2 flex justify-end gap-1.5 text-[10px] font-semibold">
          <span className="rounded-md px-2 py-1 text-ink-400">Cancel</span>
          <span className="rounded-md bg-ink-100 px-2 py-1 text-ink-900">Share</span>
        </div>
      </div>
    </div>
  );
}

export const CAPTURE_STEPS = [
  { title: "Click Start captions", body: "Earshot asks Chrome to listen to this tab and nothing else.", Art: StepArtStart },
  { title: "Choose “This tab”", body: "Chrome’s sharing picker opens. Pick the tab you’re watching in.", Art: StepArtPicker },
  { title: "Keep “Also share tab audio” on", body: "That switch sends the video’s sound to Earshot. Then press Share.", Art: StepArtAudio },
] as const;
