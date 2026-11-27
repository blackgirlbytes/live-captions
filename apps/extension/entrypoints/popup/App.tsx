import { browser } from "wxt/browser";
import { CaptionsIcon, ExternalIcon, PanelIcon, StatusBadge } from "@heard/shared/react";
import { Wordmark } from "@/components/Logo";
import { needsKey, useActiveTab, useCommands, useServerStatus, useServerUrl, useSession, useUserKey } from "@/components/hooks";
import { restrictedReason, SESSION_KEYS, type SidepanelViewRequest } from "@/utils/config";
import { useI18n } from "@/components/useI18n";
import { describeError, isKeyError, isNeedsKey } from "@/utils/messages";

export default function App() {
  const tab = useActiveTab();
  const { snap, loaded, capturing } = useSession();
  const serverUrl = useServerUrl();
  const userKey = useUserKey();
  const server = useServerStatus(serverUrl, userKey.loaded && !userKey.hasKey);
  const missingKey = needsKey(userKey.hasKey, server.status);
  const cmd = useCommands();
  const { t, ui } = useI18n();

  const status = snap.transcript.status;
  const here = tab?.id !== undefined && snap.tabId === tab.id;
  const onHere = capturing && here;
  const elsewhere = capturing && !here;
  const restricted = restrictedReason(tab?.url);
  const sessionError = here && status === "error" ? snap.transcript.error : null;
  const error = cmd.error ? describeError(t, cmd.error) : sessionError;
  const keyAction = cmd.error ? isNeedsKey(cmd.error) : isKeyError(sessionError);
  // An Heard web app only exists in server mode; hide the link when nothing is there.
  const showWebLink = !userKey.hasKey && (server.status === "ready" || server.status === "no_server_key" || server.status === "unknown");

  const toggle = () => {
    if (!tab?.id) return;
    if (onHere) {
      void cmd.stop();
      return;
    }
    // Starting opens the transcript panel too. sidePanel.open must run synchronously inside the
    // click (user gesture), so it goes first; the popup closes only once capture has started,
    // so a start error stays visible here.
    const panel = browser.sidePanel.open({ tabId: tab.id }).then(
      () => true,
      (err: unknown) => {
        console.warn("Heard: could not open the side panel", err);
        return false;
      },
    );
    void cmd.start(tab.id).then(async (ok) => {
      if (ok && (await panel)) window.close();
    });
  };

  const openPanel = (view?: "settings") => {
    if (!tab?.id) return;
    // Tell the panel which view to show; it reads (and clears) this when it opens.
    if (view) {
      const request: SidepanelViewRequest = { view, windowId: tab.windowId, at: Date.now() };
      void browser.storage.session.set({ [SESSION_KEYS.sidepanelView]: request });
    }
    // Must run synchronously inside the click (user gesture) — no awaits before it.
    browser.sidePanel.open({ tabId: tab.id }).then(
      () => window.close(),
      (err: unknown) => console.warn("Heard: could not open the side panel", err),
    );
  };

  const statusLine = (() => {
    if (!loaded) return t.popup.checking;
    if (restricted) return t.errors[restricted];
    if (onHere) {
      if (status === "live") return t.popup.live;
      if (status === "connecting") return t.popup.connecting;
      if (status === "reconnecting") return t.popup.reconnecting;
      return ui.status.status[status];
    }
    if (elsewhere) return t.popup.elsewhere(snap.tabTitle);
    return t.popup.idle;
  })();

  return (
    <div className="w-[340px] space-y-3 p-4">
      <header className="flex items-center justify-between">
        <Wordmark />
        <StatusBadge status={capturing || here ? status : "idle"} labels={ui.status} />
      </header>

      <section className="rounded-2xl bg-ink-850 p-4 ring-1 ring-ink-700">
        <div className="flex items-center gap-3">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${onHere ? "bg-accent text-accent-ink" : "bg-ink-800 text-ink-300"}`}>
            <CaptionsIcon size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-ink-100">{t.popup.title}</p>
            <p className="truncate text-xs text-ink-400" title={tab?.title}>
              {tab?.title || t.common.thisTab}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={onHere}
            aria-label={onHere ? t.popup.stop : t.popup.start}
            disabled={!tab?.id || Boolean(restricted) || cmd.pending || !loaded}
            onClick={toggle}
            className={`relative h-8 w-14 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40 ${
              onHere ? "bg-accent" : "bg-ink-600"
            }`}
          >
            <span
              className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${onHere ? "left-7" : "left-1"} ${cmd.pending ? "animate-pulse" : ""}`}
            />
          </button>
        </div>
        <p className={`mt-3 text-xs leading-relaxed ${restricted ? "text-accent" : "text-ink-300"}`} aria-live="polite">
          {statusLine}
        </p>
        {error && (
          <div role="alert" className="mt-2 rounded-lg bg-live/10 px-3 py-2 text-xs leading-relaxed text-live ring-1 ring-live/25">
            <p>{error}</p>
            {keyAction && (
              <button type="button" onClick={() => openPanel("settings")} className="mt-1.5 font-semibold underline hover:no-underline">
                {userKey.hasKey ? t.common.checkKey : t.common.addDeepgramKey}
              </button>
            )}
          </div>
        )}
        {missingKey && !capturing && !error && !restricted && (
          <div data-testid="needs-key" className="mt-2 rounded-lg bg-ink-800 px-3 py-2.5 text-xs leading-relaxed text-ink-200">
            <p>
              <span className="font-semibold text-ink-100">{t.common.addKeyTitle}</span>{" "}
              {server.status === "no_server_key" ? t.popup.noServerKey : t.popup.noServer}
            </p>
            <button type="button" onClick={() => openPanel("settings")} className="mt-1.5 font-semibold text-accent hover:underline">
              {t.common.addKeyLink}
            </button>
          </div>
        )}
      </section>

      {onHere && snap.overlayHidden && (
        <button
          type="button"
          onClick={() => void cmd.showOverlay()}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-accent-ink hover:bg-accent-strong"
        >
          <CaptionsIcon size={16} /> {t.popup.showOverlay}
        </button>
      )}

      <div className="grid gap-1.5">
        <button
          type="button"
          onClick={() => openPanel()}
          disabled={!tab?.id}
          className="flex h-10 items-center gap-2.5 rounded-xl px-3 text-sm text-ink-200 ring-1 ring-ink-700 hover:bg-ink-800 disabled:opacity-40"
        >
          <PanelIcon size={16} /> {t.popup.openPanel}
        </button>
        {showWebLink && (
          <button
            type="button"
            onClick={() => serverUrl && void browser.tabs.create({ url: serverUrl })}
            className="flex h-10 items-center gap-2.5 rounded-xl px-3 text-sm text-ink-200 ring-1 ring-ink-700 hover:bg-ink-800"
          >
            <ExternalIcon size={16} /> {t.popup.openWeb}
          </button>
        )}
      </div>

      <p className="text-[11px] leading-relaxed text-ink-500">
        {t.common.privacy}
      </p>
    </div>
  );
}
