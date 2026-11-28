"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { LanguagePicker } from "@/components/LanguagePicker";
import { LogoMark } from "@/components/Logo";
import { useT } from "@/i18n/I18nProvider";
import { StepArtPicker, StepArtStart } from "@/components/StepArt";
import { UrlForm } from "@/components/UrlForm";
import { EXTENSION_STORE_URL } from "@/lib/links";
import { watchHref } from "@/lib/providers";

const EXAMPLES: { label: string; detail: "msRachel" | "skyNews"; live: boolean; url: string }[] = [
  { label: "Ms Rachel", detail: "msRachel", live: true, url: "https://www.youtube.com/watch?v=jBvzOfT8_44" },
  { label: "Sky News", detail: "skyNews", live: true, url: "https://www.youtube.com/watch?v=53SxFKpbKDE" },
];

export type HeroTab = "home" | "how" | "privacy";
const TABS: HeroTab[] = ["home", "how", "privacy"];
const NAV: Exclude<HeroTab, "home">[] = ["how", "privacy"];

function tabFromHash(): HeroTab {
  const h = window.location.hash.slice(1);
  return (TABS as string[]).includes(h) ? (h as HeroTab) : "home";
}

/**
 * The left panel of the home page. Its sections act as tabs: the nav swaps the
 * panel's content instead of scrolling, and the URL hash keeps the tab linkable.
 */
export function HeroPanel() {
  const [tab, setTab] = useState<HeroTab>("home");
  const t = useT("common");

  useEffect(() => {
    setTab(tabFromHash());
    const onHash = () => setTab(tabFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const go = useCallback((next: HeroTab) => {
    setTab(next);
    const url = next === "home" ? window.location.pathname + window.location.search : `#${next}`;
    window.history.replaceState(null, "", url);
  }, []);

  return (
    <>
      <div className="hero-panel relative z-20 flex flex-col xl:absolute xl:inset-y-4 xl:left-4 xl:w-[calc(52%-1rem)] 2xl:w-[calc(48%-1rem)] xl:rounded-[24px] xl:bg-ink-950 xl:px-12 xl:py-10 2xl:px-16 2xl:py-12 xl:shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)]">
        <header className="flex items-center justify-between gap-6">
          <button
            type="button"
            onClick={() => go("home")}
            className="inline-flex shrink-0 items-center gap-2.5 rounded-lg"
            aria-label={t.nav.home}
          >
            <LogoMark />
            <span className="font-display text-lg font-semibold tracking-tight text-ink-100">Heard</span>
          </button>
          <nav className="flex items-center gap-5 text-sm sm:gap-6 xl:mr-auto xl:ml-4 2xl:ml-6 2xl:gap-8 2xl:text-base" aria-label={t.nav.sections}>
            {NAV.map((item) => (
              <a
                key={item}
                href={`#${item}`}
                onClick={(e) => {
                  e.preventDefault();
                  go(tab === item ? "home" : item);
                }}
                aria-current={tab === item ? "page" : undefined}
                className={`relative hidden rounded-sm py-1 whitespace-nowrap transition-colors focus-visible:outline-offset-[6px] sm:inline ${
                  tab === item ? "text-ink-100" : "text-ink-400 hover:text-ink-100"
                }`}
              >
                {t.nav[item]}
                {tab === item && <span className="absolute inset-x-0 -bottom-1 h-0.5 rounded-full bg-accent" />}
              </a>
            ))}
            {/* On smaller screens the "Get the Chrome extension" pill is hidden, so the nav links to the store. */}
            <a
              href={EXTENSION_STORE_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-sm py-1 whitespace-nowrap text-ink-400 transition-colors hover:text-ink-100 focus-visible:outline-offset-[6px] xl:hidden"
            >
              {t.nav.extension}
            </a>
          </nav>
          <LanguagePicker className="ml-auto xl:ml-0" />
        </header>

        <div key={tab} className="hero-tab flex min-h-0 flex-1 flex-col">
          {tab === "home" && <HomeTab />}
          {tab === "how" && <HowTab onTry={() => go("home")} />}
          {tab === "privacy" && <PrivacyTab />}
        </div>
      </div>

      <a
        href={EXTENSION_STORE_URL}
        target="_blank"
        rel="noreferrer"
        className="hero-pop absolute top-9 right-9 z-20 hidden h-11 items-center rounded-full bg-ink-100 px-5 text-sm font-semibold text-ink-950 transition-colors hover:bg-white xl:inline-flex"
        style={{ animationDelay: "500ms" }}
      >
        {t.nav.getExtension}
      </a>
    </>
  );
}

function HomeTab() {
  const t = useT("home");
  return (
    <>
      <div className="pt-14 sm:pt-20 xl:my-auto xl:py-8">
        <h1 className="font-display text-[2.75rem] leading-[0.98] font-semibold tracking-[-0.035em] text-balance text-ink-100 sm:text-6xl xl:text-[4rem] 2xl:text-[5.25rem]">
          {t.hero.title}
        </h1>
        <p className="mt-6 max-w-[29rem] text-[1.0625rem] leading-relaxed text-ink-400 2xl:max-w-[36rem] 2xl:text-xl">
          {t.hero.body}
        </p>
        <div className="mt-9 max-w-[32rem] 2xl:max-w-[36rem]">
          <UrlForm autoFocus />
        </div>
      </div>

      <div className="mt-10 xl:mt-0">
        <p className="text-sm text-ink-500">{t.hero.orTry}</p>
        <div className="-mx-1.5 mt-3 grid max-w-[33rem] 2xl:max-w-[37rem] gap-2 sm:grid-cols-2 sm:gap-4">
          {EXAMPLES.map((ex) => (
            <Link
              key={ex.url}
              href={watchHref(ex.url)}
              className="group flex items-center gap-3 rounded-2xl p-1.5 pr-3 transition-colors hover:bg-ink-900"
            >
              <span
                className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ring-1 ring-white/10 ${
                  ex.live ? "bg-live/15 text-live" : "bg-ink-800 text-ink-100"
                }`}
                aria-hidden="true"
              >
                {ex.live ? (
                  <span className="h-2.5 w-2.5 animate-pulse-dot rounded-full bg-live" />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7 4.5v15l13-7.5z" />
                  </svg>
                )}
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block font-medium text-ink-100">{ex.label}</span>
                <span className="block truncate text-sm text-ink-500 group-hover:text-ink-400">{t.examples[ex.detail]}</span>
              </span>
            </Link>
          ))}
        </div>
        <Link href="/extension/privacy" className="mt-5 inline-block text-xs text-ink-500 underline-offset-4 hover:text-ink-200 hover:underline">
          {t.privacy.policyLink}
        </Link>
      </div>
    </>
  );
}

/**
 * Shared frame for the non-home tabs. The title sits at the same fixed spot below the nav on every
 * tab (not centered), so switching tabs never moves the headline.
 */
function TabBody({
  title,
  intro,
  children,
  footer,
  hideIntroWhenShort = false,
}: {
  title: string;
  intro?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Drop the intro on short desktop screens so long content still fits the panel. */
  hideIntroWhenShort?: boolean;
}) {
  return (
    <>
      <div className="pt-14 sm:pt-20 xl:pt-12 2xl:pt-16">
        <h2 className="font-display text-[2.5rem] leading-[1.02] font-semibold tracking-[-0.03em] text-balance text-ink-100 sm:text-5xl xl:text-[3rem] 2xl:text-[3.75rem]">
          {title}
        </h2>
        {intro && (
          <p className={`mt-4 max-w-[28rem] ${hideIntroWhenShort ? "xl:[@media(max-height:820px)]:hidden" : ""} text-[1.0625rem] leading-normal text-pretty text-ink-400 2xl:max-w-[34rem] 2xl:text-xl`}>{intro}</p>
        )}
        <div className="mt-9 2xl:mt-12">{children}</div>
      </div>
      {footer && <div className="mt-10 text-sm text-ink-500 xl:mt-auto xl:pt-8">{footer}</div>}
    </>
  );
}

/** A short list of points: a bold line and one plain sentence each. Numbered only when it is a sequence. */
/** Slight, alternating tilts for the step pictures, so they read as pieces laid on the page. */
const ART_TILT = ["-rotate-2", "rotate-[1.5deg]", "-rotate-1"];

function Points({ items, numbered = false }: { items: { title: string; body: ReactNode; art?: ReactNode }[]; numbered?: boolean }) {
  return (
    <ol className="max-w-[32rem] space-y-5 xl:space-y-4 2xl:max-w-[38rem] 2xl:space-y-6">
      {items.map((item, i) => (
        <li key={item.title} className="hero-step flex items-center gap-6" style={{ animationDelay: `${120 + i * 160}ms` }}>
          {item.art && <div className={`hidden w-36 shrink-0 sm:block 2xl:w-44 ${ART_TILT[i % ART_TILT.length]}`}>{item.art}</div>}
          <div className="flex min-w-0 flex-1 gap-4">
            {numbered && (
              <span className="font-display text-lg leading-7 font-semibold text-accent tabular-nums 2xl:text-xl 2xl:leading-8">{i + 1}</span>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="font-display text-lg leading-7 font-semibold tracking-tight text-ink-100 2xl:text-xl 2xl:leading-8">{item.title}</h3>
              <div className="mt-0.5 text-[0.9375rem] leading-snug text-pretty text-ink-400 2xl:text-lg">{item.body}</div>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function HowTab({ onTry }: { onTry: () => void }) {
  const t = useT("home").how;
  return (
    <TabBody title={t.title} intro={t.intro}>
      <Points
        numbered
        items={[
          {
            title: t.pasteTitle,
            body: (
              <>
                {t.pasteBody}{" "}
                <button type="button" onClick={onTry} className="rounded-sm font-medium text-accent underline-offset-4 hover:underline">
                  {t.pasteNow}
                </button>
              </>
            ),
            art: <PasteArt />,
          },
          { title: t.startTitle, body: t.startBody, art: <StepArtStart /> },
          { title: t.shareTitle, body: t.shareBody, art: <StepArtPicker /> },
        ]}
      />
    </TabBody>
  );
}

const frame = "relative aspect-[16/10] w-full overflow-hidden rounded-xl bg-ink-900 ring-1 ring-ink-700";

/** Audio leaves the tab for Deepgram only while captions are on. */
function SendArt() {
  const t = useT("home").privacy;
  return (
    <div className={frame} aria-hidden="true">
      <div className="absolute inset-0 flex items-center justify-center gap-2 px-3 pt-4">
        <span className="rounded-md bg-ink-800 px-2 py-1 text-[10px] font-medium text-ink-200 ring-1 ring-ink-600">{t.artTab}</span>
        <span className="h-0.5 w-8 rounded-full bg-accent" />
        <span className="rounded-md bg-accent px-2 py-1 text-[10px] font-semibold text-accent-ink">Deepgram</span>
      </div>
      <span className="absolute top-2.5 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-live/15 px-2 py-0.5 text-[9px] font-semibold text-live">
        <span className="h-1 w-1 rounded-full bg-live" />
        {t.artCaptionsOn}
      </span>
    </div>
  );
}

/** Close the tab and the transcript is gone. */
function NoSaveArt() {
  return (
    <div className={frame} aria-hidden="true">
      <div className="absolute inset-3 rounded-lg bg-ink-800 p-2.5 ring-1 ring-ink-600">
        <div className="h-1.5 w-12 rounded-full bg-ink-600" />
        <div className="mt-2 h-1.5 w-20 rounded-full bg-ink-700" />
        <div className="mt-1.5 h-1.5 w-16 rounded-full bg-ink-700" />
      </div>
      <span className="absolute top-1/2 left-1/2 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-accent text-accent-ink shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-accent)_25%,transparent)]">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </span>
    </div>
  );
}

function PrivacyTab() {
  const t = useT("home").privacy;
  return (
    <TabBody title={t.title} intro={t.intro} footer={
      <div className="space-y-2">
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <a
            href="https://github.com/blackgirlbytes/live-captions"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-sm text-ink-300 underline-offset-4 hover:text-ink-100 hover:underline"
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            {t.openSource}
          </a>
          <span>
            {t.captionsBy}{" "}
            <a href="https://deepgram.com" target="_blank" rel="noreferrer" className="rounded-sm text-ink-300 underline-offset-4 hover:text-ink-100 hover:underline">
              Deepgram Nova-3
            </a>
            {t.captionsAfter}
          </span>
        </p>
        <p><Link href="/extension/privacy" className="text-ink-300 underline-offset-4 hover:text-ink-100 hover:underline">{t.policyLink}</Link></p>
      </div>
      }
    >
      <Points
        items={[
          { title: t.onlyTabTitle, body: t.onlyTabBody, art: <StepArtPicker /> },
          { title: t.sentTitle, body: t.sentBody, art: <SendArt /> },
          { title: t.savedTitle, body: t.savedBody, art: <NoSaveArt /> },
        ]}
      />
    </TabBody>
  );
}

function PasteArt() {
  const t = useT("home").form;
  return (
    <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl bg-ink-900 ring-1 ring-ink-700" aria-hidden="true">
      <div className="absolute inset-x-3 top-1/2 flex -translate-y-1/2 items-center gap-2 rounded-lg bg-ink-800 p-1.5 ring-1 ring-accent/60">
        <span className="ml-1 truncate text-[10px] text-ink-300">youtube.com/watch?v=53SxFKpbKDE</span>
        <span className="ml-auto rounded-md bg-accent px-2 py-1 text-[10px] font-semibold text-accent-ink">{t.watch}</span>
      </div>
    </div>
  );
}
