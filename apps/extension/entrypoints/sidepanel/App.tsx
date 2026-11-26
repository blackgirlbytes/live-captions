import { useEffect, useRef, useState, type FormEvent } from "react";
import { browser } from "wxt/browser";
import { looksLikeDeepgramKey, verifyDeepgramKey } from "@earshot/shared";
import { CaptionSettingsForm, PlayIcon, StatusBadge, StopIcon, TranscriptToolbar, TranscriptView } from "@earshot/shared/react";
import { Wordmark } from "@/components/Logo";
import {
  needsKey,
  useActiveTab,
  useCaptionSettings,
  useCommands,
  useServerStatus,
  useServerUrl,
  useSession,
  useUserKey,
} from "@/components/hooks";
import {
  DEFAULT_EARSHOT_URL,
  normalizeServerUrl,
  restrictedReason,
  SESSION_KEYS,
  SIDEPANEL_VIEW_REQUEST_TTL_MS,
  STORAGE_KEYS,
  type ServerStatus,
  type SidepanelViewRequest,
} from "@/utils/config";
import { isKeyError } from "@/utils/messages";

type View = "transcript" | "settings";

const DEEPGRAM_CONSOLE_URL = "https://console.deepgram.com/";

export default function App() {
  const tab = useActiveTab();
  const { snap, capturing } = useSession();
  const cmd = useCommands();
  const [view, setView] = useState<View>("transcript");
  const [query, setQuery] = useState("");
  /** Bumped to move focus to the key input (e.g. from "Add your key"). */
  const [focusKey, setFocusKey] = useState(0);

  const userKey = useUserKey();
  const serverUrl = useServerUrl();
  const server = useServerStatus(serverUrl, userKey.loaded && !userKey.hasKey);
  const missingKey = needsKey(userKey.hasKey, server.status);

  const t = snap.transcript;
  const here = tab?.id !== undefined && snap.tabId === tab.id;
  const restricted = restrictedReason(tab?.url);
  const error = cmd.error ?? (t.status === "error" ? t.error : null);
  const warning = t.status === "reconnecting" ? t.error : null;
  const keyAction = Boolean(error) && (cmd.errorCode === "needs_key" || isKeyError(error));

  const goToKey = () => {
    setView("settings");
    setFocusKey((n) => n + 1);
  };

  // The popup asks for a specific view through session storage (it can't message a panel that isn't open yet).
  useEffect(() => {
    let windowId: number | undefined;
    let handled = 0;
    const take = (value: unknown) => {
      const req = value as Partial<SidepanelViewRequest> | undefined;
      if (req?.view !== "settings" || typeof req.at !== "number" || req.at <= handled) return;
      if (Date.now() - req.at > SIDEPANEL_VIEW_REQUEST_TTL_MS) return;
      if (windowId !== undefined && req.windowId !== windowId) return;
      handled = req.at;
      goToKey();
    };
    const onChanged = (changes: Record<string, { newValue?: unknown }>, areaName: string) => {
      if (areaName === "session" && SESSION_KEYS.sidepanelView in changes) take(changes[SESSION_KEYS.sidepanelView]!.newValue);
    };
    browser.storage.onChanged.addListener(onChanged);
    void browser.windows
      .getCurrent()
      .then((w) => (windowId = w.id))
      .catch(() => undefined)
      .then(() => browser.storage.session.get(SESSION_KEYS.sidepanelView))
      .then((r) => take(r[SESSION_KEYS.sidepanelView]));
    return () => browser.storage.onChanged.removeListener(onChanged);
  }, []);

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
        {missingKey && !capturing && !error && (
          <div data-testid="needs-key" className="rounded-lg bg-ink-850 px-3 py-2.5 text-xs leading-relaxed text-ink-200 ring-1 ring-ink-700">
            <p>
              <span className="font-semibold text-ink-100">Add a Deepgram API key to start.</span>{" "}
              {server.status === "no_server_key"
                ? `The Earshot server at ${serverUrl} has no Deepgram key.`
                : `No Earshot server is running at ${serverUrl}, so Earshot needs your own key.`}
            </p>
            <button type="button" onClick={goToKey} className="mt-1.5 font-semibold text-accent hover:underline">
              Add your key →
            </button>
          </div>
        )}
        {error && (
          <div role="alert" className="rounded-lg bg-live/10 px-3 py-2 text-xs leading-relaxed text-live ring-1 ring-live/25">
            <p>{error}</p>
            {keyAction && (
              <button type="button" onClick={goToKey} className="mt-1.5 font-semibold underline hover:no-underline">
                {userKey.hasKey ? "Check your key" : "Add your Deepgram key"}
              </button>
            )}
          </div>
        )}
        {warning && !error && <p className="text-xs text-accent">{warning}</p>}
      </section>

      <nav className="flex gap-1 px-4 pt-3" aria-label="Panel sections">
        {(
          [
            ["transcript", "Transcript"],
            ["settings", "Settings"],
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
          <KeySection
            masked={userKey.masked}
            serverUrl={serverUrl}
            serverStatus={server.status}
            onRecheck={server.recheck}
            capturing={capturing}
            focusSignal={focusKey}
          />
          <ServerUrlSection usingUserKey={userKey.hasKey} />
          <SettingsSection />
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

function KeySection({
  masked,
  serverUrl,
  serverStatus,
  onRecheck,
  capturing,
  focusSignal,
}: {
  masked: string | null;
  serverUrl: string | null;
  serverStatus: ServerStatus | "checking" | null;
  onRecheck: () => void;
  capturing: boolean;
  focusSignal: number;
}) {
  const [value, setValue] = useState("");
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (focusSignal === 0) return;
    sectionRef.current?.scrollIntoView({ block: "start" });
    inputRef.current?.focus();
  }, [focusSignal]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const key = value.trim();
    if (!key) {
      setMessage({ ok: false, text: "Paste your Deepgram API key first." });
      return;
    }
    if (!looksLikeDeepgramKey(key)) {
      setMessage({ ok: false, text: "That doesn't look like a Deepgram API key. Copy the whole key from the Deepgram console." });
      return;
    }
    setBusy(true);
    setMessage(null);
    const result = await verifyDeepgramKey(key);
    setBusy(false);
    if (result === "rejected") {
      setMessage({ ok: false, text: "Deepgram rejected this key. Check that you copied all of it and that it hasn't expired or been deleted." });
      return;
    }
    if (result === "offline") {
      setMessage({ ok: false, text: "Couldn't reach Deepgram to check the key. Check your connection and try again." });
      return;
    }
    await browser.storage.local.set({ [STORAGE_KEYS.deepgramKey]: key });
    setValue("");
    setReveal(false);
    setMessage({ ok: true, text: capturing ? "Key saved. It's used the next time you press Start." : "Key saved. Captions will use your key." });
  };

  const forget = async () => {
    await browser.storage.local.remove(STORAGE_KEYS.deepgramKey);
    setMessage({ ok: true, text: "Key removed from this browser." });
    onRecheck();
  };

  const status = (() => {
    if (masked) return `Using your key (${masked})`;
    const where = serverUrl ?? DEFAULT_EARSHOT_URL;
    if (serverStatus === "unreachable") return `No key saved, and no Earshot server is reachable at ${where}.`;
    if (serverStatus === "no_server_key") return `No key saved, and the Earshot server at ${where} has no Deepgram key.`;
    if (serverStatus === "checking") return `Checking the Earshot server at ${where}…`;
    return `Using Earshot server at ${where}`;
  })();
  const statusOk = Boolean(masked) || serverStatus === "ready" || serverStatus === "unknown";

  return (
    <section ref={sectionRef} aria-labelledby="key-heading">
      <h2 id="key-heading" className="mb-1 text-sm font-semibold text-ink-100">
        Deepgram key
      </h2>
      <p data-testid="key-status" className={`mb-2 text-xs font-medium ${statusOk ? "text-ok" : "text-accent"}`}>
        {status}
      </p>
      <p className="mb-3 text-xs leading-relaxed text-ink-400">
        Use your own Deepgram API key and Earshot works without any server; usage is billed to your Deepgram account. Create one at{" "}
        <a href={DEEPGRAM_CONSOLE_URL} target="_blank" rel="noreferrer" className="text-accent hover:underline">
          console.deepgram.com
        </a>
        . Make a dedicated key for Earshot with the fewest permissions (Member or lower) and an expiry date.
      </p>
      <form onSubmit={save} className="space-y-2">
        <label className="sr-only" htmlFor="deepgram-key">
          Deepgram API key
        </label>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            id="deepgram-key"
            type={reveal ? "text" : "password"}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setMessage(null);
            }}
            placeholder={masked ? "Paste a new key to replace it" : "Paste your Deepgram API key"}
            autoComplete="off"
            spellCheck={false}
            className="h-9 min-w-0 flex-1 rounded-lg bg-ink-850 px-3 font-mono text-xs text-ink-100 ring-1 ring-ink-700 placeholder:font-sans placeholder:text-ink-500 focus:ring-accent focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setReveal((r) => !r)}
            aria-pressed={reveal}
            aria-controls="deepgram-key"
            className="h-9 shrink-0 rounded-lg px-2.5 text-xs text-ink-300 ring-1 ring-ink-700 hover:bg-ink-800 hover:text-ink-100"
          >
            {reveal ? "Hide" : "Show"}
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={busy}
            className="h-9 rounded-lg bg-accent px-3 text-sm font-semibold text-accent-ink hover:bg-accent-strong disabled:opacity-50"
          >
            {busy ? "Verifying…" : "Verify & save"}
          </button>
          {masked && (
            <button type="button" onClick={() => void forget()} className="text-xs text-ink-400 hover:text-ink-100 hover:underline">
              Forget key
            </button>
          )}
        </div>
      </form>
      {message && (
        <p role={message.ok ? "status" : "alert"} data-testid="key-message" className={`mt-2 text-xs leading-relaxed ${message.ok ? "text-ok" : "text-live"}`}>
          {message.text}
        </p>
      )}
      <p className="mt-2 text-[11px] leading-relaxed text-ink-500">
        Your key stays in this browser (extension storage) and is only sent to Deepgram, never to Earshot or any other server.
      </p>
    </section>
  );
}

function ServerUrlSection({ usingUserKey }: { usingUserKey: boolean }) {
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
        {usingUserKey
          ? "Not used while your own Deepgram key is saved."
          : "Without a key of your own, an Earshot server issues short-lived Deepgram tokens; its API key stays on the server."}
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
