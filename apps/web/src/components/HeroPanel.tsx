"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ByokNote } from "@/components/ByokNote";
import { LogoMark } from "@/components/Logo";
import { CAPTURE_STEPS } from "@/components/StepArt";
import { UrlForm } from "@/components/UrlForm";
import { watchHref } from "@/lib/providers";

const EXAMPLES = [
  { label: "TED talk", detail: "Sir Ken Robinson, 19 min", live: false, url: "https://www.youtube.com/watch?v=iG9CE55wbtY" },
  { label: "24/7 livestream", detail: "Lofi Girl radio", live: true, url: "https://www.youtube.com/watch?v=rFZHOHl-L8A" },
];

export type HeroTab = "home" | "how" | "privacy" | "extension";
const TABS: HeroTab[] = ["home", "how", "privacy", "extension"];
const NAV: { tab: HeroTab; label: string; className?: string }[] = [
  { tab: "how", label: "How it works" },
  { tab: "privacy", label: "Privacy" },
  { tab: "extension", label: "Chrome extension", className: "xl:hidden" },
];

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
      <div className="hero-panel relative z-20 flex flex-col xl:absolute xl:inset-y-4 xl:left-4 xl:w-[calc(50%-1rem)] xl:rounded-[24px] xl:bg-ink-950 xl:px-12 xl:py-10 2xl:px-16 2xl:py-12 xl:shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)]">
        <header className="flex items-center justify-between gap-6">
          <button
            type="button"
            onClick={() => go("home")}
            className="inline-flex shrink-0 items-center gap-2.5 rounded-lg"
            aria-label="Earshot home"
          >
            <LogoMark />
            <span className="font-display text-lg font-semibold tracking-tight text-ink-100">Earshot</span>
          </button>
          <nav className="flex items-center gap-5 text-sm sm:gap-6 xl:mr-auto xl:ml-4" aria-label="Sections">
            {NAV.map((item) => (
              <a
                key={item.tab}
                href={`#${item.tab}`}
                onClick={(e) => {
                  e.preventDefault();
                  go(tab === item.tab ? "home" : item.tab);
                }}
                aria-current={tab === item.tab ? "page" : undefined}
                className={`relative py-1 whitespace-nowrap transition-colors ${
                  tab === item.tab ? "text-ink-100" : "text-ink-400 hover:text-ink-100"
                } ${item.tab === "extension" ? "" : "hidden sm:inline"} ${item.className ?? ""}`}
              >
                {item.label}
                {tab === item.tab && <span className="absolute inset-x-0 -bottom-1 h-0.5 rounded-full bg-accent" />}
              </a>
            ))}
          </nav>
        </header>

        <div key={tab} className="hero-tab flex min-h-0 flex-1 flex-col">
          {tab === "home" && <HomeTab />}
          {tab === "how" && <HowTab onTry={() => go("home")} />}
          {tab === "privacy" && <PrivacyTab />}
          {tab === "extension" && <ExtensionTab />}
        </div>
      </div>

      <a
        href="#extension"
        onClick={(e) => {
          e.preventDefault();
          go(tab === "extension" ? "home" : "extension");
        }}
        aria-current={tab === "extension" ? "page" : undefined}
        className="hero-pop absolute top-9 right-9 z-20 hidden h-11 items-center rounded-full bg-ink-100 px-5 text-sm font-semibold text-ink-950 transition-colors hover:bg-white xl:inline-flex"
        style={{ animationDelay: "500ms" }}
      >
        Get the Chrome extension
      </a>
    </>
  );
}

function HomeTab() {
  return (
    <>
      <div className="pt-14 sm:pt-20 xl:my-auto xl:pt-0">
        <h1 className="font-display text-[2.75rem] leading-[0.98] font-semibold tracking-[-0.035em] text-balance text-ink-100 sm:text-6xl xl:text-[4rem] 2xl:text-[4.75rem]">
          Live AI captions for any video.
        </h1>
        <p className="mt-6 max-w-[29rem] text-[1.0625rem] leading-relaxed text-ink-400 2xl:max-w-[34rem] 2xl:text-lg">
          Paste a YouTube video or livestream. Earshot listens along and writes captions as people speak, plus a
          transcript you can search, click to jump back, and download.
        </p>
        <div className="mt-9 max-w-[32rem] 2xl:max-w-[36rem]">
          <UrlForm autoFocus />
        </div>
      </div>

      <div className="mt-10 xl:mt-0">
        <p className="text-sm text-ink-500">Or try one</p>
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
                <span className="block truncate text-sm text-ink-500 group-hover:text-ink-400">{ex.detail}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}

/** Shared frame for the non-home tabs: a title, then content that scrolls inside the panel if it must. */
function TabBody({ title, intro, children }: { title: string; intro: ReactNode; children: ReactNode }) {
  return (
    <div className="earshot-scroll min-h-0 flex-1 pt-14 sm:pt-20 xl:-mr-4 xl:overflow-y-auto xl:pt-16 xl:pr-4">
      <h2 className="font-display text-4xl leading-[1.02] font-semibold tracking-[-0.03em] text-ink-100 sm:text-5xl">{title}</h2>
      <div className="mt-4 max-w-[30rem] leading-relaxed text-ink-400">{intro}</div>
      <div className="mt-9">{children}</div>
    </div>
  );
}

function HowTab({ onTry }: { onTry: () => void }) {
  const steps = [
    { title: "Paste a link", body: "Any YouTube video, Short or livestream. It plays right here in Earshot’s player.", Art: PasteArt },
    CAPTURE_STEPS[0],
    { ...CAPTURE_STEPS[1], body: "In Chrome’s picker choose “This tab” and keep “Also share tab audio” switched on." },
  ];
  return (
    <TabBody
      title="How it works"
      intro="Earshot hears the video through Chrome’s tab sharing, so it works with any video that plays in the page. No YouTube captions required."
    >
      <ol className="space-y-5">
        {steps.map((step, i) => (
          <li key={step.title} className="flex items-center gap-5">
            <div className="w-32 shrink-0 sm:w-48">
              <step.Art />
            </div>
            <div className="flex gap-3">
              <span className="font-display text-xl leading-6 font-semibold text-accent tabular-nums">{i + 1}</span>
              <div>
                <h3 className="leading-6 font-semibold text-ink-100">{step.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-400">{step.body}</p>
              </div>
            </div>
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={onTry}
        className="mt-9 inline-flex h-11 items-center rounded-xl bg-accent px-5 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-strong"
      >
        Paste a link
      </button>
    </TabBody>
  );
}

function PrivacyTab() {
  return (
    <TabBody title="Your audio, your call" intro="Earshot only listens when you ask it to, and keeps nothing.">
      <ul className="max-w-[32rem] space-y-4 leading-relaxed text-ink-300 marker:text-ink-600 [&>li]:pl-1">
        <li>Earshot only hears a tab after you pick it and press Share, and it only hears that tab.</li>
        <li>
          Audio streams to Deepgram for transcription while captions are on. Stop captions, or Chrome’s “Stop sharing”,
          ends it instantly.
        </li>
        <li>Transcripts live in your browser tab and disappear when you close it. Nothing is stored on a server.</li>
        <ByokNote />
      </ul>
      <p className="mt-9 max-w-[32rem] text-sm leading-relaxed text-ink-500">
        Earshot is open source. Speech recognition by Deepgram Nova-3. Works in Chrome and Edge on desktop.
      </p>
    </TabBody>
  );
}

function ExtensionTab() {
  const code = "rounded bg-ink-800 px-1.5 py-0.5 text-[0.85em] text-ink-100";
  return (
    <TabBody
      title="Captions on youtube.com itself"
      intro="Some videos can’t be played outside YouTube. The Earshot Chrome extension captions them right on youtube.com, with a side panel transcript."
    >
      <ol className="max-w-[32rem] list-decimal space-y-3 pl-5 leading-relaxed text-ink-300 marker:text-ink-500">
        <li>
          Build it: <code className={code}>npm run build -w @earshot/extension</code>
        </li>
        <li>
          Open <code className={code}>chrome://extensions</code> and turn on Developer mode.
        </li>
        <li>
          Click Load unpacked and choose <code className={code}>apps/extension/.output/chrome-mv3</code>.
        </li>
      </ol>
      <p className="mt-6 text-sm text-ink-500">Full setup is in the README’s “Chrome extension” section.</p>
    </TabBody>
  );
}

function PasteArt() {
  return (
    <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl bg-ink-900 ring-1 ring-ink-700" aria-hidden="true">
      <div className="absolute inset-x-3 top-1/2 flex -translate-y-1/2 items-center gap-2 rounded-lg bg-ink-800 p-1.5 ring-1 ring-accent/60">
        <span className="ml-1 truncate text-[10px] text-ink-300">youtube.com/watch?v=iG9CE55wbtY</span>
        <span className="ml-auto rounded-md bg-accent px-2 py-1 text-[10px] font-semibold text-accent-ink">Watch</span>
      </div>
    </div>
  );
}
