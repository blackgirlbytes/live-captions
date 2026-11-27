import Link from "next/link";
import { ByokNote } from "@/components/ByokNote";
import { Logo } from "@/components/Logo";
import { CAPTURE_STEPS } from "@/components/StepArt";
import { UrlForm } from "@/components/UrlForm";
import { watchHref } from "@/lib/providers";

const EXAMPLES = [
  { label: "TED talk", detail: "Sir Ken Robinson, 19 min", live: false, url: "https://www.youtube.com/watch?v=iG9CE55wbtY" },
  { label: "24/7 livestream", detail: "Lofi Girl radio", live: true, url: "https://www.youtube.com/watch?v=rFZHOHl-L8A" },
];

const HERO_CAPTION = "So I want to talk about education, and I want to talk about creativity.";

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <main className="flex-1">
        {/*
          Hero: one dark stage. The copy sits on a solid panel on the left; the rest of the
          stage holds real pieces of Earshot (player, extension popup, transcript, controls)
          that arrive one at a time on load.
        */}
        <section className="mx-auto w-full max-w-7xl px-4 pt-4 pb-20 sm:px-6 sm:pt-6 xl:pb-24">
          <div className="hero-stage relative xl:h-[44rem] xl:rounded-[32px]">
            <div className="hero-panel relative z-20 flex flex-col xl:absolute xl:inset-y-4 xl:left-4 xl:w-[calc(50%-1rem)] xl:rounded-[24px] xl:bg-ink-950 xl:px-12 xl:py-10 xl:shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)]">
              <header className="flex items-center justify-between gap-6">
                <Logo />
                <nav className="flex items-center gap-6 text-sm text-ink-400 xl:mr-auto xl:ml-4">
                  <a href="#how" className="hidden hover:text-ink-100 sm:inline">
                    How it works
                  </a>
                  <a href="#privacy" className="hidden hover:text-ink-100 sm:inline">
                    Privacy
                  </a>
                  <a href="#extension" className="whitespace-nowrap hover:text-ink-100 xl:hidden">
                    Chrome extension
                  </a>
                </nav>
              </header>

              <div className="pt-14 sm:pt-20 xl:my-auto xl:pt-0">
                <h1 className="font-display text-[2.75rem] leading-[0.98] font-semibold tracking-[-0.035em] text-balance text-ink-100 sm:text-6xl xl:text-[4rem]">
                  Live AI captions for any video.
                </h1>
                <p className="mt-6 max-w-[29rem] text-[1.0625rem] leading-relaxed text-ink-400">
                  Paste a YouTube video or livestream. Earshot listens along and writes captions as people speak, plus a
                  transcript you can search, click to jump back, and download.
                </p>
                <div className="mt-9 max-w-[32rem]">
                  <UrlForm autoFocus />
                </div>
              </div>

              <div className="mt-10 xl:mt-0">
                <p className="text-sm text-ink-500">Or try one</p>
                <div className="-mx-1.5 mt-3 grid max-w-[33rem] gap-2 sm:grid-cols-2 sm:gap-4">
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
            </div>

            <a
              href="#extension"
              className="hero-pop absolute top-9 right-9 z-20 hidden h-11 items-center rounded-full bg-ink-100 px-5 text-sm font-semibold text-ink-950 transition-colors hover:bg-white xl:inline-flex"
              style={{ animationDelay: "500ms" }}
            >
              Get the Chrome extension
            </a>

            <HeroProduct />
          </div>
        </section>

{/* How it works */}
        <section id="how" className="scroll-mt-8 border-t border-ink-800 bg-ink-900/60">
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-ink-100 sm:text-4xl">How it works</h2>
            <p className="mt-3 max-w-xl text-ink-300">
              Earshot hears the video through Chrome’s tab sharing, so it works with any video that plays in the page.
              No YouTube captions required.
            </p>
            <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
              {[
                {
                  title: "Paste a link",
                  body: "Any YouTube video, Short or livestream. It plays right here in Earshot’s player.",
                  Art: PasteArt,
                },
                CAPTURE_STEPS[0],
                { ...CAPTURE_STEPS[1], body: "In Chrome’s picker choose “This tab” and keep “Also share tab audio” switched on." },
              ].map((step, i) => (
                <li key={step.title}>
                  <step.Art />
                  <div className="mt-5 flex gap-4">
                    <span className="font-display text-2xl leading-none font-semibold text-accent tabular-nums">{i + 1}</span>
                    <div>
                      <h3 className="font-semibold text-ink-100">{step.title}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-ink-400">{step.body}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Privacy + extension */}
        <section className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-20 sm:px-6 md:grid-cols-2">
          <div id="privacy" className="scroll-mt-8 rounded-3xl bg-ink-900 p-7 ring-1 ring-ink-800 sm:p-9">
            <h2 className="font-display text-2xl font-semibold tracking-tight text-ink-100">Your audio, your call</h2>
            <ul className="mt-5 space-y-3 text-[0.95rem] leading-relaxed text-ink-300">
              <li>Earshot only hears a tab after you pick it and press Share, and it only hears that tab.</li>
              <li>
                Audio streams to Deepgram for transcription while captions are on. Stop captions, or Chrome’s “Stop
                sharing”, ends it instantly.
              </li>
              <li>Transcripts live in your browser tab and disappear when you close it. Nothing is stored on a server.</li>
              <ByokNote />
            </ul>
          </div>
          <div id="extension" className="scroll-mt-8 rounded-3xl bg-ink-900 p-7 ring-1 ring-ink-800 sm:p-9">
            <h2 className="font-display text-2xl font-semibold tracking-tight text-ink-100">Captions on youtube.com itself</h2>
            <p className="mt-3 text-[0.95rem] leading-relaxed text-ink-300">
              Some videos can’t be played outside YouTube. The Earshot Chrome extension captions them right on
              youtube.com, with a side panel transcript.
            </p>
            <ol className="mt-5 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-ink-300 marker:text-ink-500">
              <li>
                Build it: <code className="rounded bg-ink-800 px-1.5 py-0.5 text-ink-100">npm run build -w @earshot/extension</code>
              </li>
              <li>
                Open <code className="rounded bg-ink-800 px-1.5 py-0.5 text-ink-100">chrome://extensions</code> and turn on
                Developer mode.
              </li>
              <li>
                Click Load unpacked and choose{" "}
                <code className="rounded bg-ink-800 px-1.5 py-0.5 text-ink-100">apps/extension/.output/chrome-mv3</code>.
              </li>
            </ol>
            <p className="mt-4 text-sm text-ink-400">Full setup is in the README’s “Chrome extension” section.</p>
          </div>
        </section>
      </main>

      <footer className="border-t border-ink-800">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-ink-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>Earshot is open source. Speech recognition by Deepgram Nova-3.</span>
          <span>Works in Chrome and Edge on desktop.</span>
        </div>
      </footer>
    </div>
  );
}

/** The stage backdrop: a dim room with warm stage light, like the paused frame of a talk. */
function Backdrop({ className = "" }: { className?: string }) {
  return <div className={`hero-backdrop hero-focus pointer-events-none absolute inset-0 ${className}`} aria-hidden="true" />;
}

/**
 * The right side of the hero: real pieces of Earshot, laid out like a collage.
 * The player with live captions, the Chrome extension popup, the transcript
 * panel and the player controls arrive in that order.
 */
function HeroProduct() {
  return (
    <>
      <Backdrop className="hidden rounded-[32px] xl:block" />
      <div
        className="relative mt-14 overflow-hidden rounded-[28px] px-5 pt-9 pb-7 sm:px-10 sm:pt-12 sm:pb-10 lg:grid lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-start lg:gap-x-10 xl:block xl:absolute xl:inset-y-0 xl:right-0 xl:left-1/2 xl:mt-0 xl:overflow-visible xl:rounded-none xl:p-0"
        role="img"
        aria-label="Earshot's player with live captions, the Chrome extension popup, the transcript and the player controls"
      >
        <Backdrop className="xl:hidden" />

        {/* Player */}
        <div className="hero-pop relative lg:col-start-1 lg:row-start-1 xl:absolute xl:top-32 xl:left-[7%] xl:w-[66%]" style={{ animationDelay: "500ms" }}>
          <VideoFrame />
          <span
            className="absolute -top-4 -left-3 grid h-11 w-11 place-items-center rounded-full bg-ink-950 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.9)] ring-1 ring-white/10"
            title="Listening"
          >
            <span className="flex h-4 items-center gap-[3px]">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className="hero-bar w-[3px] rounded-full bg-accent" style={{ animationDelay: `${i * 140}ms` }} />
              ))}
            </span>
          </span>
        </div>

        <div className="relative mt-5 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-4 lg:flex-col lg:justify-start lg:gap-6 xl:static xl:contents">
          {/* Chrome extension popup */}
          <div
            className="hero-pop relative z-10 -mt-8 ml-auto w-[15.5rem] sm:order-2 sm:mt-0 sm:ml-0 lg:order-none xl:absolute xl:top-[21rem] xl:right-[5%]"
            style={{ animationDelay: "1500ms" }}
          >
            <div className="rotate-[2.5deg]">
              <ExtensionPopup />
            </div>
          </div>

          {/* Transcript */}
          <div
            className="hero-pop relative w-full max-w-[17.5rem] sm:mt-6 lg:mt-0 lg:max-w-none xl:absolute xl:top-[26rem] xl:left-[7%] xl:mt-0 xl:w-[17.5rem]"
            style={{ animationDelay: "2000ms" }}
          >
            <TranscriptCard />
          </div>
        </div>

        {/* Player controls */}
        <div className="hero-pop relative mt-7 flex justify-center lg:col-start-1 lg:row-start-2 xl:absolute xl:right-[5%] xl:bottom-10 xl:mt-0" style={{ animationDelay: "900ms" }}>
          <PlayerControls />
        </div>
      </div>
    </>
  );
}

function VideoFrame() {
  const words = HERO_CAPTION.split(" ");
  return (
    <div className="relative aspect-video overflow-hidden rounded-2xl bg-[#0b0b10] shadow-[0_30px_60px_-24px_rgba(0,0,0,0.95)] ring-1 ring-white/10">
      <svg viewBox="0 0 160 90" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id="hero-spot" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f5b83d" stopOpacity="0.22" />
            <stop offset="1" stopColor="#f5b83d" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="hero-floor" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#f5b83d" stopOpacity="0.16" />
            <stop offset="1" stopColor="#f5b83d" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="160" height="90" fill="#101016" />
        <path d="M72 0h16l30 90H42z" fill="url(#hero-spot)" />
        <ellipse cx="80" cy="89" rx="50" ry="8" fill="url(#hero-floor)" />
        <circle cx="80" cy="44" r="7.5" fill="#2c2b36" />
        <path d="M63 90c0-20 7.5-34 17-34s17 14 17 34z" fill="#2c2b36" />
      </svg>

      <span className="absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-live backdrop-blur">
        <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-live" />
        Live captions
      </span>

      <p className="absolute inset-x-3 bottom-5 text-center text-[12.5px] leading-[1.75] font-medium text-white sm:bottom-6 sm:text-sm">
        {/* Each word carries its own caption background, so the bar grows as words arrive. */}
        {words.map((w, i) => (
          <span
            key={i}
            className={`caption-word bg-black/85 py-[3px] ${i === 0 ? "rounded-l pl-2" : ""} ${i === words.length - 1 ? "rounded-r pr-2" : ""}`}
            style={{ animationDelay: `${1000 + i * 180}ms` }}
          >
            {w}
            {i < words.length - 1 ? " " : ""}
          </span>
        ))}
      </p>

      <div className="absolute inset-x-0 bottom-0 h-[3px] bg-white/10">
        <div className="h-full w-[38%] bg-accent" />
      </div>
    </div>
  );
}

/** Mirrors the extension's popup (apps/extension/entrypoints/popup). */
function ExtensionPopup() {
  return (
    <div className="rounded-[20px] bg-ink-900 p-3.5 shadow-[0_30px_60px_-24px_rgba(0,0,0,0.95)] ring-1 ring-white/[0.08]">
      <div className="flex items-center justify-between px-0.5">
        <span className="font-display text-[15px] font-semibold tracking-tight text-ink-100">Earshot</span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-live/15 px-2 py-0.5 text-[11px] font-semibold text-live">
          <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-live" />
          Live
        </span>
      </div>
      <div className="mt-3 rounded-2xl bg-ink-850 p-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent text-accent-ink">
            <CaptionsGlyph />
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block text-[13px] font-semibold text-ink-100">AI captions</span>
            <span className="block truncate text-[11px] text-ink-400">Do schools kill creativity?</span>
          </span>
          <span className="relative h-6 w-10 shrink-0 rounded-full bg-accent">
            <span className="absolute top-1 left-5 h-4 w-4 rounded-full bg-white shadow" />
          </span>
        </div>
        <p className="mt-2.5 text-[11px] leading-relaxed text-ink-300">Captioning this tab on youtube.com</p>
      </div>
    </div>
  );
}

const TRANSCRIPT = [
  { t: "0:12", text: "Good morning. How are you?" },
  { t: "0:24", text: "It's been great, hasn't it?" },
  { t: "0:38", text: "So I want to talk about education…", now: true },
];

function TranscriptCard() {
  return (
    <div className="rounded-[20px] bg-ink-900 p-4 shadow-[0_30px_60px_-24px_rgba(0,0,0,0.95)] ring-1 ring-white/[0.08]">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-ink-100">Transcript</span>
        <span className="text-[11px] text-ink-500">Download</span>
      </div>
      <ol className="mt-3 space-y-0.5 text-[12.5px] leading-snug">
        {TRANSCRIPT.map((line) => (
          <li
            key={line.t}
            className={`flex gap-3 rounded-lg px-2 py-1.5 ${line.now ? "bg-accent/10 text-ink-100" : "text-ink-400"}`}
          >
            <span className={`tabular-nums ${line.now ? "text-accent" : "text-ink-500"}`}>{line.t}</span>
            <span>{line.text}</span>
          </li>
        ))}
      </ol>
      <div className="mt-3 flex h-9 items-center gap-2 rounded-xl bg-ink-850 pr-1 pl-3 text-[12px] text-ink-500">
        <span className="flex-1">Search the transcript</span>
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-ink-700 text-ink-200">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m20 20-4-4" />
          </svg>
        </span>
      </div>
    </div>
  );
}

function PlayerControls() {
  return (
    <div className="flex items-center gap-1 rounded-full bg-ink-950/90 p-1.5 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.95)] ring-1 ring-white/[0.08] backdrop-blur">
      <span className="inline-flex h-9 items-center gap-2 rounded-full bg-live/15 px-3.5 text-[13px] font-semibold text-live">
        <span className="h-2 w-2 rounded-[3px] bg-live" />
        Stop captions
      </span>
      <ToolIcon active>
        <rect x="3" y="6" width="18" height="12" rx="2.5" />
        <path d="M10 10.5a2 2 0 1 0 0 3M16 10.5a2 2 0 1 0 0 3" />
      </ToolIcon>
      <ToolIcon>
        <path d="M5 7h14M5 12h14M5 17h9" />
      </ToolIcon>
      <ToolIcon>
        <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
      </ToolIcon>
    </div>
  );
}

function CaptionsGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="6" width="18" height="12" rx="2.5" />
      <path d="M10 10.5a2 2 0 1 0 0 3M16 10.5a2 2 0 1 0 0 3" />
    </svg>
  );
}

function ToolIcon({ children, active = false }: { children: React.ReactNode; active?: boolean }) {
  return (
    <span className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${active ? "bg-ink-800 text-ink-100" : "text-ink-400"}`}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </span>
  );
}

function PasteArt() {
  return (
    <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl bg-ink-900 ring-1 ring-ink-700" aria-hidden="true">
      <div className="absolute inset-x-4 top-1/2 flex -translate-y-1/2 items-center gap-2 rounded-lg bg-ink-800 p-1.5 ring-1 ring-accent/60">
        <span className="ml-1.5 truncate font-mono text-[10px] text-ink-300">youtube.com/watch?v=iG9CE55wbtY</span>
        <span className="ml-auto rounded-md bg-accent px-2 py-1 text-[10px] font-semibold text-accent-ink">Watch</span>
      </div>
    </div>
  );
}
