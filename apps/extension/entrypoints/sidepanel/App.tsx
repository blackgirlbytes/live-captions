import { useEffect, useRef, useState, type FormEvent } from "react";
import { browser } from "wxt/browser";
import { LOCALES, LOCALE_NAMES, isLocale, languageName, looksLikeDeepgramKey, verifyDeepgramKey, type Locale } from "@heard/shared";
import {
  CaptionSettingsForm,
  ChevronDownIcon,
  DubbingControls,
  PlayIcon,
  Select,
  StatusBadge,
  StopIcon,
  TranscriptToolbar,
  TranscriptView,
  TranslationNotice,
  type SharedUiLabels,
} from "@heard/shared/react";
import type { ExtensionMessages } from "@/i18n";
import { useI18n } from "@/components/useI18n";
import { Wordmark } from "@/components/Logo";
import { useDubbing } from "@/components/useDubbing";
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
  DEFAULT_HEARD_URL,
  restrictedReason,
  SESSION_KEYS,
  SIDEPANEL_VIEW_REQUEST_TTL_MS,
  STORAGE_KEYS,
  type ServerStatus,
  type SidepanelViewRequest,
} from "@/utils/config";
import { normalizeServerUrl } from "@/utils/server-url";
import { describeError, isKeyError, isNeedsKey } from "@/utils/messages";

type View = "transcript" | "settings";

const DEEPGRAM_CONSOLE_URL = "https://console.deepgram.com/";

export default function App() {
  const tab = useActiveTab();
  const { snap, capturing, setCaptionOverride } = useSession({ translate: true });
  const cmd = useCommands();
  const i18n = useI18n();
  const { t: m, ui } = i18n;
  const [view, setView] = useState<View>("transcript");
  const [query, setQuery] = useState("");
  /** Bumped to move focus to the key input (e.g. from "Add your key"). */
  const [focusKey, setFocusKey] = useState(0);

  const userKey = useUserKey();
  const serverUrl = useServerUrl();
  const server = useServerStatus(serverUrl, userKey.loaded && !userKey.hasKey);
  const missingKey = needsKey(userKey.hasKey, server.status);
  const [captionSettings] = useCaptionSettings();
  const dubbing = useDubbing({ snap, capturing, spokenLanguage: captionSettings?.spokenLanguage ?? "multi" });
  // While dubbing, captions and the transcript are in the language you hear, unless you pick
  // a caption language while it's on. Turning dubbing off goes back to the saved choice.
  const [captionsFollowDub, setCaptionsFollowDub] = useState(true);
  useEffect(() => {
    if (!dubbing.enabled) setCaptionsFollowDub(true);
  }, [dubbing.enabled]);
  const captionOverride = dubbing.enabled && captionsFollowDub ? dubbing.settings.language : null;
  useEffect(() => setCaptionOverride(captionOverride), [captionOverride, setCaptionOverride]);
  const langName = ui.language.languageName ?? languageName;

  const t = snap.transcript;
  const here = tab?.id !== undefined && snap.tabId === tab.id;
  const restricted = restrictedReason(tab?.url);
  const sessionError = t.status === "error" ? t.error : null;
  const error = cmd.error ? describeError(m, cmd.error) : sessionError;
  const warning = t.status === "reconnecting" ? t.error : null;
  const keyAction = cmd.error ? isNeedsKey(cmd.error) : isKeyError(sessionError);

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
    <div className="relative flex h-screen flex-col overflow-clip bg-ink-900">
      <header className="flex items-center justify-between border-b border-ink-800 px-4 py-3">
        <Wordmark />
        <StatusBadge status={t.status} labels={ui.status} />
      </header>

      <section className="space-y-2 border-b border-ink-800 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            {capturing ? (
              <>
                <p className="text-[11px] font-medium tracking-wide text-ink-500 uppercase">{here ? m.panel.capturingHere : m.panel.capturingOther}</p>
                <p className="truncate text-sm text-ink-100" title={snap.tabTitle ?? undefined}>
                  {snap.tabTitle || m.common.untitledTab}
                </p>
              </>
            ) : (
              <>
                <p className="text-[11px] font-medium tracking-wide text-ink-500 uppercase">{m.panel.currentTab}</p>
                <p className="truncate text-sm text-ink-100" title={tab?.title}>
                  {tab?.title || m.common.thisTab}
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
              <StopIcon size={14} /> {m.panel.stop}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => tab?.id && void cmd.start(tab.id)}
              disabled={!tab?.id || Boolean(restricted) || cmd.pending}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3.5 text-sm font-semibold text-accent-ink hover:bg-accent-strong disabled:opacity-40"
            >
              <PlayIcon size={14} /> {cmd.pending ? m.panel.starting : m.panel.start}
            </button>
          )}
        </div>
        {capturing && !here && tab?.id && !restricted && (
          <button type="button" onClick={() => void cmd.start(tab.id!)} className="text-xs text-accent hover:underline" disabled={cmd.pending}>
            {m.panel.switchTab}
          </button>
        )}
        {restricted && !capturing && <p className="text-xs text-accent">{m.errors[restricted]}</p>}
        {capturing && snap.overlayHidden && (
          <button type="button" onClick={() => void cmd.showOverlay()} className="block text-xs text-accent hover:underline">
            {m.panel.showOverlay}
          </button>
        )}
        {missingKey && !capturing && !error && (
          <div data-testid="needs-key" className="rounded-lg bg-ink-850 px-3 py-2.5 text-xs leading-relaxed text-ink-200 ring-1 ring-ink-700">
            <p>
              <span className="font-semibold text-ink-100">{m.common.addKeyTitle}</span>{" "}
              {server.status === "no_server_key" ? m.panel.noServerKey(serverUrl ?? "") : m.panel.noServer(serverUrl ?? "")}
            </p>
            <button type="button" onClick={goToKey} className="mt-1.5 font-semibold text-accent hover:underline">
              {m.common.addKeyLink}
            </button>
          </div>
        )}
        {error && (
          <div role="alert" className="rounded-lg bg-live/10 px-3 py-2 text-xs leading-relaxed text-live ring-1 ring-live/25">
            <p>{error}</p>
            {keyAction && (
              <button type="button" onClick={goToKey} className="mt-1.5 font-semibold underline hover:no-underline">
                {userKey.hasKey ? m.common.checkKey : m.common.addDeepgramKey}
              </button>
            )}
          </div>
        )}
        {warning && !error && <p className="text-xs text-accent">{warning}</p>}
      </section>

      <nav className="flex border-b border-ink-800 px-2" aria-label={m.panel.sections}>
        {(
          [
            ["transcript", m.panel.transcriptTab],
            ["settings", m.panel.settingsTab],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            aria-current={view === v ? "page" : undefined}
            className={`relative -mb-px h-11 flex-1 border-b-2 text-sm font-semibold transition-colors ${
              view === v ? "border-accent text-ink-100" : "border-transparent text-ink-400 hover:text-ink-200"
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
            fileName={snap.tabTitle ? m.panel.fileName(snap.tabTitle) : "heard-transcript"}
            labels={ui.toolbar}
          />
          <TranscriptView
            lines={t.lines}
            caption={t.caption}
            live={capturing}
            query={query}
            timeBase="stream"
            emptyState={capturing ? m.panel.emptyLive : m.panel.emptyIdle}
            labels={ui.transcript}
            translations={t.translation?.target ? t.translation.lines : undefined}
            captionTranslation={t.translation?.target ? t.translation.caption : null}
          />
          <TranslationNotice issue={t.translation?.target ? t.translation.issue : null} className="border-t border-ink-800 px-4 py-2.5" labels={ui.language} />
        </main>
      ) : (
        <main className="heard-scroll min-h-0 flex-1 divide-y divide-ink-800 overflow-y-auto px-4 [&>section]:py-6 [&>section:first-child]:pt-5">
          <KeySection
            masked={userKey.masked}
            serverUrl={serverUrl}
            serverStatus={server.status}
            onRecheck={server.recheck}
            capturing={capturing}
            focusSignal={focusKey}
            t={m}
          />
          <SettingsSection t={m} ui={ui} captionOverride={captionOverride} onCaptionLanguagePicked={() => setCaptionsFollowDub(false)} />
          <section>
            <DubbingControls
              settings={dubbing.settings}
              onSettingsChange={dubbing.setSettings}
              enabled={dubbing.enabled}
              onEnabledChange={dubbing.setDubbing}
              state={dubbing.state}
              sessionRunning={capturing}
              labels={ui.dubbing}
              languageName={ui.language.languageName}
              titleClassName="text-base font-semibold text-ink-100"
              notice={dubbing.issue?.source ? ui.dubbing.translateIssue(ui.language.pair(langName(dubbing.issue.source), langName(dubbing.issue.target))) : null}
            />
          </section>
          <InterfaceLanguageSection t={m} setting={i18n.setting} auto={i18n.auto} onChange={i18n.setLanguage} />
          <ServerUrlSection usingUserKey={userKey.hasKey} t={m} />
        </main>
      )}

      <footer className="border-t border-ink-800 px-4 py-2.5 text-xs leading-relaxed text-ink-400">
        {m.common.privacy}
      </footer>
    </div>
  );
}

function SettingsSection({
  t,
  ui,
  captionOverride,
  onCaptionLanguagePicked,
}: {
  t: ExtensionMessages;
  ui: SharedUiLabels;
  /** Caption language in effect while it follows live dubbing. */
  captionOverride: string | null;
  onCaptionLanguagePicked: () => void;
}) {
  const [settings, setSettings] = useCaptionSettings();
  if (!settings) return null;
  return (
    <section>
      <h2 className="mb-4 text-base font-semibold text-ink-100">{t.style.title}</h2>
      <CaptionSettingsForm
        settings={settings}
        onChange={setSettings}
        showPosition={false}
        captionOverride={captionOverride}
        onCaptionLanguagePick={() => captionOverride && onCaptionLanguagePicked()}
        labels={{ ...ui.settings, language: ui.language }}
      />
      <p className="mt-4 text-sm leading-relaxed text-ink-300">{t.style.note}</p>
    </section>
  );
}

function InterfaceLanguageSection({
  t,
  setting,
  auto,
  onChange,
}: {
  t: ExtensionMessages;
  setting: Locale | "" | null;
  auto: Locale;
  onChange: (value: Locale | "") => void;
}) {
  if (setting === null) return null;
  return (
    <section>
      <h2 id="ui-language-heading" className="mb-1.5 text-base font-semibold text-ink-100">
        {t.interface.title}
      </h2>
      <p className="mb-4 text-sm leading-relaxed text-ink-300">{t.interface.note}</p>
      <Select
        aria-labelledby="ui-language-heading"
        value={setting}
        onChange={(v) => onChange(isLocale(v) ? v : "")}
        options={[
          { value: "", label: t.interface.auto(LOCALE_NAMES[auto]) },
          ...LOCALES.map((l) => ({ value: l, label: LOCALE_NAMES[l], lang: l })),
        ]}
      />
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
  t,
}: {
  t: ExtensionMessages;
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

  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (focusSignal === 0) return;
    setExpanded(true);
    // Wait a frame so the form is rendered before focusing it.
    const raf = requestAnimationFrame(() => {
      sectionRef.current?.scrollIntoView({ block: "start" });
      inputRef.current?.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [focusSignal]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const key = value.trim();
    if (!key) {
      setMessage({ ok: false, text: t.key.empty });
      return;
    }
    if (!looksLikeDeepgramKey(key)) {
      setMessage({ ok: false, text: t.key.malformed });
      return;
    }
    setBusy(true);
    setMessage(null);
    const result = await verifyDeepgramKey(key);
    setBusy(false);
    if (result === "rejected") {
      setMessage({ ok: false, text: t.key.rejected });
      return;
    }
    if (result === "offline") {
      setMessage({ ok: false, text: t.key.offline });
      return;
    }
    await browser.storage.local.set({ [STORAGE_KEYS.deepgramKey]: key });
    setValue("");
    setReveal(false);
    setMessage({ ok: true, text: capturing ? t.key.savedNext : t.key.saved });
  };

  const forget = async () => {
    await browser.storage.local.remove(STORAGE_KEYS.deepgramKey);
    setMessage({ ok: true, text: t.key.removed });
    onRecheck();
  };

  const status = (() => {
    if (masked) return t.key.using(masked);
    const where = serverUrl ?? DEFAULT_HEARD_URL;
    if (serverStatus === "unreachable") return t.key.unreachable(where);
    if (serverStatus === "no_server_key") return t.key.noServerKey(where);
    if (serverStatus === "checking") return t.key.checking(where);
    return t.key.usingServer(where);
  })();
  const statusOk = Boolean(masked) || serverStatus === "ready" || serverStatus === "unknown";
  // The server already works: the own-key form is optional, so keep it folded away.
  const optional = !masked && statusOk;
  const showForm = !optional || expanded;

  return (
    <section ref={sectionRef} aria-labelledby="key-heading">
      <h2 id="key-heading" className="mb-3 text-base font-semibold text-ink-100">
        {t.key.title}
      </h2>
      <p
        data-testid="key-status"
        className="flex items-start gap-2.5 rounded-lg bg-ink-850 px-3 py-2.5 text-sm leading-snug text-ink-100 ring-1 ring-ink-700"
      >
        <span aria-hidden="true" className={`mt-1.5 size-2 shrink-0 rounded-full ${statusOk ? "bg-ok" : "bg-accent"}`} />
        <span className="min-w-0 break-words">{status}</span>
      </p>
      {optional && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          aria-controls="key-form"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:text-accent-strong"
        >
          {t.key.useOwn}
          <ChevronDownIcon size={14} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      )}
      {showForm && (
      <div id="key-form" className="mt-4 space-y-4">
      <p className="text-sm leading-relaxed text-ink-300">
        {t.key.introBefore}
        <a href={DEEPGRAM_CONSOLE_URL} target="_blank" rel="noreferrer" className="font-medium text-accent hover:underline">
          console.deepgram.com
        </a>
        {t.key.introAfter}
      </p>
      <form onSubmit={save} className="space-y-3">
        <label className="block text-sm font-medium text-ink-200" htmlFor="deepgram-key">
          {t.key.label}
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
            placeholder={masked ? t.key.placeholderReplace : t.key.placeholder}
            autoComplete="off"
            spellCheck={false}
            className="h-10 min-w-0 flex-1 rounded-lg bg-ink-850 px-3 font-mono text-sm text-ink-100 ring-1 ring-ink-600 placeholder:font-sans placeholder:text-ink-400 focus:ring-2 focus:ring-accent focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setReveal((r) => !r)}
            aria-pressed={reveal}
            aria-controls="deepgram-key"
            className="h-10 shrink-0 rounded-lg px-3 text-sm font-medium text-ink-200 ring-1 ring-ink-600 hover:bg-ink-800 hover:text-ink-100"
          >
            {reveal ? t.key.hide : t.key.show}
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={busy}
            className="h-10 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-ink hover:bg-accent-strong disabled:opacity-50"
          >
            {busy ? t.key.verifying : t.key.save}
          </button>
          {masked && (
            <button type="button" onClick={() => void forget()} className="text-sm text-ink-300 hover:text-ink-100 hover:underline">
              {t.key.forget}
            </button>
          )}
        </div>
      </form>
      <p className="text-xs leading-relaxed text-ink-400">{t.key.privacy}</p>
      </div>
      )}
      {message && (
        <p role={message.ok ? "status" : "alert"} data-testid="key-message" className={`mt-3 text-sm leading-relaxed ${message.ok ? "text-ok" : "text-live"}`}>
          {message.text}
        </p>
      )}
    </section>
  );
}

function ServerUrlSection({ usingUserKey, t }: { usingUserKey: boolean; t: ExtensionMessages }) {
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
      setMessage({ ok: false, text: t.server.invalid });
      return;
    }
    await browser.storage.local.set({ [STORAGE_KEYS.serverUrl]: normalized });
    setMessage({ ok: true, text: t.server.saved });
  };

  const reset = async () => {
    await browser.storage.local.remove(STORAGE_KEYS.serverUrl);
    setMessage({ ok: true, text: t.server.resetDone });
  };

  return (
    <section>
      <h2 className="mb-1.5 text-base font-semibold text-ink-100">{t.server.title}</h2>
      <p className="mb-4 text-sm leading-relaxed text-ink-300">
        {usingUserKey ? t.server.unused : t.server.about}
      </p>
      <form onSubmit={save} className="flex gap-2">
        <label className="sr-only" htmlFor="server-url">
          {t.server.label}
        </label>
        <input
          id="server-url"
          type="url"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setMessage(null);
          }}
          placeholder={DEFAULT_HEARD_URL}
          spellCheck={false}
          className="h-10 min-w-0 flex-1 rounded-lg bg-ink-850 px-3 font-mono text-sm text-ink-100 ring-1 ring-ink-600 placeholder:text-ink-400 focus:ring-2 focus:ring-accent focus:outline-none"
        />
        <button type="submit" className="h-10 rounded-lg bg-ink-700 px-4 text-sm font-medium text-ink-100 hover:bg-ink-600">
          {t.server.save}
        </button>
      </form>
      <div className="mt-2.5 flex items-center justify-between gap-2 text-sm">
        <span className={message ? (message.ok ? "text-ok" : "text-live") : "text-ink-400"}>{message?.text ?? t.server.defaultIs(DEFAULT_HEARD_URL)}</span>
        {current !== DEFAULT_HEARD_URL && (
          <button type="button" onClick={() => void reset()} className="shrink-0 text-ink-300 hover:text-ink-100 hover:underline">
            {t.server.reset}
          </button>
        )}
      </div>
    </section>
  );
}
