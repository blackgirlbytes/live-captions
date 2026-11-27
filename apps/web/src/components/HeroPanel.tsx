"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ByokNote } from "@/components/ByokNote";
import { LogoMark } from "@/components/Logo";
import { StepArtPicker, StepArtStart } from "@/components/StepArt";
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
      <div className="hero-panel relative z-20 flex flex-col xl:absolute xl:inset-y-4 xl:left-4 xl:w-[calc(46%-1rem)] 2xl:w-[calc(41%-1rem)] xl:rounded-[24px] xl:bg-ink-950 xl:px-12 xl:py-10 2xl:px-16 2xl:py-12 xl:shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)]">
        <header className="flex items-center justify-between gap-6">
          <button
            type="button"
            onClick={() => go("home")}
            className="inline-flex shrink-0 items-center gap-2.5 rounded-lg"
            aria-label="Heard home"
          >
            <LogoMark />
            <span className="font-display text-lg font-semibold tracking-tight text-ink-100">Heard</span>
          </button>
          <nav className="flex items-center gap-5 text-sm sm:gap-6 xl:mr-auto xl:ml-4 2xl:ml-6 2xl:gap-8 2xl:text-base" aria-label="Sections">
            {NAV.map((item) => (
              <a
                key={item.tab}
                href={`#${item.tab}`}
                onClick={(e) => {
                  e.preventDefault();
                  go(tab === item.tab ? "home" : item.tab);
                }}
                aria-current={tab === item.tab ? "page" : undefined}
                className={`relative rounded-sm py-1 whitespace-nowrap transition-colors focus-visible:outline-offset-[6px] ${
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
      <div className="pt-14 sm:pt-20 xl:my-auto xl:py-8">
        <h1 className="font-display text-[2.75rem] leading-[0.98] font-semibold tracking-[-0.035em] text-balance text-ink-100 sm:text-6xl xl:text-[4rem] 2xl:text-[5.25rem]">
          Live AI captions for any video.
        </h1>
        <p className="mt-6 max-w-[29rem] text-[1.0625rem] leading-relaxed text-ink-400 2xl:max-w-[36rem] 2xl:text-xl">
          Paste a YouTube video or livestream. Heard captions it as people speak, with a transcript you can
          search and download.
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

/**
 * Shared frame for the non-home tabs. The title sits at the same fixed spot below the nav on every
 * tab (not centered), so switching tabs never moves the headline.
 */
function TabBody({ title, intro, children, footer }: { title: string; intro?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <>
      <div className="pt-14 sm:pt-20 xl:pt-12 2xl:pt-16">
        <h2 className="font-display text-[2.5rem] leading-[1.02] font-semibold tracking-[-0.03em] text-balance text-ink-100 sm:text-5xl xl:text-[3rem] 2xl:text-[3.75rem]">
          {title}
        </h2>
        {intro && (
          <p className="mt-4 max-w-[28rem] text-[1.0625rem] leading-normal text-pretty text-ink-400 2xl:max-w-[34rem] 2xl:text-xl">{intro}</p>
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
          <div className="flex gap-4">
            {numbered && (
              <span className="font-display text-lg leading-7 font-semibold text-accent tabular-nums 2xl:text-xl 2xl:leading-8">{i + 1}</span>
            )}
            <div>
              <h3 className="font-display text-lg leading-7 font-semibold tracking-tight text-ink-100 2xl:text-xl 2xl:leading-8">{item.title}</h3>
              <p className="mt-0.5 text-[0.9375rem] leading-snug text-pretty text-ink-400 2xl:text-lg">{item.body}</p>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function HowTab({ onTry }: { onTry: () => void }) {
  return (
    <TabBody title="How it works" intro="Heard listens to the tab itself, so it works even when a video has no captions.">
      <Points
        numbered
        items={[
          {
            title: "Paste a link",
            body: (
              <>
                Any YouTube video or livestream.{" "}
                <button type="button" onClick={onTry} className="rounded-sm font-medium text-accent underline-offset-4 hover:underline">
                  Paste one now
                </button>
              </>
            ),
            art: <PasteArt />,
          },
          { title: "Click Start captions", body: "Heard asks Chrome for this tab only.", art: <StepArtStart /> },
          { title: "Share the tab’s audio", body: "Pick “This tab” and keep audio on.", art: <StepArtPicker /> },
        ]}
      />
    </TabBody>
  );
}

const PRIVACY = [
  { title: "Only the tab you pick.", body: "Nothing is heard until you choose a tab and press Share." },
  { title: "Only to Deepgram, only while on.", body: "Audio goes to Deepgram for captions and stops when you stop." },
  { title: "Nothing is saved.", body: "Transcripts stay in your tab and vanish when you close it." },
];

function PrivacyTab() {
  return (
    <TabBody title="Privacy" intro="Heard listens only to what you choose to share, and keeps none of it." footer="Heard is open source. Captions by Deepgram Nova-3.">
      <ul className="max-w-[30rem] divide-y divide-ink-800 2xl:max-w-[36rem]">
        {PRIVACY.map((item) => (
          <li key={item.title} className="py-5 first:pt-0 last:pb-0 2xl:py-6">
            <h3 className="font-display text-[1.375rem] leading-tight font-semibold tracking-[-0.02em] text-ink-100 2xl:text-[1.75rem]">
              {item.title}
            </h3>
            <p className="mt-1.5 text-base leading-snug text-pretty text-ink-400 2xl:text-lg">{item.body}</p>
          </li>
        ))}
      </ul>
      <ul className="mt-8 max-w-[30rem] text-sm leading-relaxed text-ink-500 2xl:max-w-[36rem]">
        <ByokNote />
      </ul>
    </TabBody>
  );
}

function ExtensionTab() {
  const code = "rounded-md bg-ink-850 px-1.5 py-0.5 text-[0.9em] text-ink-200";
  return (
    <TabBody
      title="Captions on YouTube itself"
      intro="For videos that won’t play outside youtube.com. Captions appear on the page, with the transcript in a side panel."
      footer="Works in Chrome and Edge on desktop. Full setup is in the README."
    >
      <Points
        numbered
        items={[
          { title: "Build it", body: <code className={code}>npm run build -w @heard/extension</code> },
          { title: "Turn on Developer mode", body: <>In <code className={code}>chrome://extensions</code></> },
          { title: "Load unpacked", body: <code className={code}>apps/extension/.output/chrome-mv3</code> },
        ]}
      />
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
