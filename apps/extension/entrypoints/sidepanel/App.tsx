import { useEffect, useState, type FormEvent } from "react";
import { browser } from "wxt/browser";
import { CaptionSettingsForm, PlayIcon, StatusBadge, StopIcon, TranscriptToolbar, TranscriptView } from "@earshot/shared/react";
import { Wordmark } from "@/components/Logo";
import { useActiveTab, useCaptionSettings, useCommands, useServerUrl, useSession } from "@/components/hooks";
import { DEFAULT_EARSHOT_URL, normalizeServerUrl, restrictedReason, STORAGE_KEYS } from "@/utils/config";

type View = "transcript" | "settings";

export default function App() {
  const tab = useActiveTab();
  const { snap, capturing } = useSession();
  const cmd = useCommands();
  const [view, setView] = useState<View>("transcript");
  const [query, setQuery] = useState("");

  const t = snap.transcript;
  const here = tab?.id !== undefined && snap.tabId === tab.id;
  const restricted = restrictedReason(tab?.url);
  const error = cmd.error ?? (t.status === "error" ? t.error : null);
  const warning = t.status === "reconnecting" ? t.error : null;

  return (
    <div className="flex h-screen flex-col bg-ink-900">
      <header className="flex items-center justify-between border-b border-ink-800 px-4 py-3">
        <Wordmark />
        <StatusBadge status={t.status} />
      </header>

      <section className="space-y-2 border-b border-ink-800 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            {capturing ? (
              <>
                <p className="text-[11px] font-medium tracking-wide text-ink-500 uppercase">{here ? "Capturing this tab" : "Capturing another tab"}</p>
                <p className="truncate text-sm text-ink-100" title={snap.tabTitle ?? undefined}>
                  {snap.tabTitle || "Untitled tab"}
                </p>
              </>
            ) : (
              <>
                <p className="text-[11px] font-medium tracking-wide text-ink-500 uppercase">Current tab</p>
                <p className="truncate text-sm text-ink-100" title={tab?.title}>
                  {tab?.title || "This tab"}
                </p>
              </>
            )}
          </div>
          {capturing ? (
            <button
              type="button"
              onClick={() => void cmd.stop()}
              disabled={cmd.pending}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-live px-3.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
            >
              <StopIcon size={14} /> Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={() => tab?.id && void cmd.start(tab.id)}
              disabled={!tab?.id || Boolean(restricted) || cmd.pending}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3.5 text-sm font-semibold text-accent-ink hover:bg-accent-strong disabled:opacity-40"
            >
              <PlayIcon size={14} /> {cmd.pending ? "Starting…" : "Start"}
            </button>
          )}
        </div>
        {capturing && !here && tab?.id && !restricted && (
          <button type="button" onClick={() => void cmd.start(tab.id!)} className="text-xs text-accent hover:underline" disabled={cmd.pending}>
            Switch captions to the current tab
          </button>
        )}
        {restricted && !capturing && <p className="text-xs text-accent">{restricted}</p>}
        {capturing && snap.overlayHidden && (
          <button type="button" onClick={() => void cmd.showOverlay()} className="block text-xs text-accent hover:underline">
            Show the caption overlay again
          </button>
        )}
        {error && (
          <p role="alert" className="rounded-lg bg-live/10 px-3 py-2 text-xs leading-relaxed text-live ring-1 ring-live/25">
            {error}
          </p>
        )}
        {warning && !error && <p className="text-xs text-accent">{warning}</p>}
      </section>

      <nav className="flex gap-1 px-4 pt-3" aria-label="Panel sections">
        {(
          [
            ["transcript", "Transcript"],
            ["settings", "Caption style & server"],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            aria-current={view === v ? "page" : undefined}
            className={`h-8 rounded-lg px-3 text-sm font-medium transition-colors ${
              view === v ? "bg-ink-800 text-ink-100" : "text-ink-400 hover:text-ink-100"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {view === "transcript" ? (
        <main className="flex min-h-0 flex-1 flex-col">
          <TranscriptToolbar
            className="px-4 py-3"
            lines={t.lines}
            query={query}
            onQueryChange={setQuery}
            fileName={snap.tabTitle ? `${snap.tabTitle} transcript` : "earshot-transcript"}
          />
          <TranscriptView
            lines={t.lines}
            caption={t.caption}
            live={capturing}
            query={query}
            timeBase="stream"
            emptyState={
              capturing ? "Listening… captions appear when someone speaks." : "Press Start on a tab that's playing video or audio. The transcript will appear here."
            }
          />
        </main>
      ) : (
        <main className="earshot-scroll min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-4">
          <SettingsSection />
          <ServerUrlSection />
        </main>
      )}

      <footer className="border-t border-ink-800 px-4 py-2.5 text-[11px] leading-relaxed text-ink-500">
        Audio is only captured after you press Start; transcripts are not saved.
      </footer>
    </div>
  );
}

function SettingsSection() {
  const [settings, setSettings] = useCaptionSettings();
  if (!settings) return null;
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-ink-100">Caption style</h2>
      <CaptionSettingsForm settings={settings} onChange={setSettings} showPosition={false} />
      <p className="mt-3 text-xs text-ink-500">Drag the caption box to move it; drag its corner to resize. Changes apply live.</p>
    </section>
  );
}

function ServerUrlSection() {
  const current = useServerUrl();
  const [value, setValue] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (current) setValue(current);
  }, [current]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const normalized = normalizeServerUrl(value);
    if (!normalized) {
      setMessage({ ok: false, text: "Enter a full http(s) URL, e.g. http://localhost:3000" });
      return;
    }
    await browser.storage.local.set({ [STORAGE_KEYS.serverUrl]: normalized });
    setMessage({ ok: true, text: "Saved. Used the next time you press Start." });
  };

  const reset = async () => {
    await browser.storage.local.remove(STORAGE_KEYS.serverUrl);
    setMessage({ ok: true, text: "Reset to the default server." });
  };

  return (
    <section>
      <h2 className="mb-1 text-sm font-semibold text-ink-100">Server URL</h2>
      <p className="mb-3 text-xs leading-relaxed text-ink-400">
        The Earshot server issues short-lived Deepgram tokens; your Deepgram API key never enters the extension.
      </p>
      <form onSubmit={save} className="flex gap-2">
        <label className="sr-only" htmlFor="server-url">
          Server URL
        </label>
        <input
          id="server-url"
          type="url"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setMessage(null);
          }}
          placeholder={DEFAULT_EARSHOT_URL}
          spellCheck={false}
          className="h-9 min-w-0 flex-1 rounded-lg bg-ink-850 px-3 font-mono text-xs text-ink-100 ring-1 ring-ink-700 placeholder:text-ink-500 focus:ring-accent focus:outline-none"
        />
        <button type="submit" className="h-9 rounded-lg bg-ink-700 px-3 text-sm font-medium text-ink-100 hover:bg-ink-600">
          Save
        </button>
      </form>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs">
        <span className={message ? (message.ok ? "text-ok" : "text-live") : "text-ink-500"}>{message?.text ?? `Default: ${DEFAULT_EARSHOT_URL}`}</span>
        {current !== DEFAULT_EARSHOT_URL && (
          <button type="button" onClick={() => void reset()} className="shrink-0 text-ink-400 hover:text-ink-100 hover:underline">
            Reset
          </button>
        )}
      </div>
    </section>
  );
}
