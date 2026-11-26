import Link from "next/link";
import { Logo } from "@/components/Logo";
import { CAPTURE_STEPS } from "@/components/StepArt";
import { UrlForm } from "@/components/UrlForm";
import { watchHref } from "@/lib/providers";

const EXAMPLES = [
  { label: "TED talk", detail: "Sir Ken Robinson, 19 min", url: "https://www.youtube.com/watch?v=iG9CE55wbtY" },
  { label: "24/7 livestream", detail: "Lofi Girl radio", url: "https://www.youtube.com/watch?v=rFZHOHl-L8A" },
];

const HERO_CAPTION = "So I want to talk about education, and I want to talk about creativity.";

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-1 text-sm">
          <a href="#how" className="hidden rounded-lg px-3 py-2 text-ink-300 hover:text-ink-100 sm:inline">
            How it works
          </a>
          <a href="#extension" className="rounded-lg px-3 py-2 whitespace-nowrap text-ink-300 hover:text-ink-100">
            Chrome extension
          </a>
        </nav>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pt-8 pb-20 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-16 lg:pb-28">
          <div>
            <h1 className="font-display text-[2.6rem] leading-[1.02] font-semibold tracking-[-0.025em] text-balance text-ink-100 sm:text-6xl lg:text-[4.25rem]">
              Live AI captions for any video.
            </h1>
            <p className="mt-5 max-w-[34rem] text-lg leading-relaxed text-ink-300">
              Paste a YouTube video or livestream. Earshot listens along and writes captions as people speak, plus a
              transcript you can search, click to jump back, and download.
            </p>
            <div className="mt-8 max-w-xl">
              <UrlForm autoFocus />
              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                <span className="text-ink-500">Try one:</span>
                {EXAMPLES.map((ex) => (
                  <Link
                    key={ex.url}
                    href={watchHref(ex.url)}
                    className="group inline-flex items-center gap-2 rounded-full bg-ink-850 py-1.5 pr-3.5 pl-3 ring-1 ring-ink-700 transition-colors hover:bg-ink-800 hover:ring-ink-600"
                  >
                    <span className="font-medium text-ink-100">{ex.label}</span>
                    <span className="text-ink-400">{ex.detail}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <HeroPreview />
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-8 border-t border-ink-800 bg-ink-900/60">
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-ink-100 sm:text-4xl">How it works</h2>
            <p className="mt-3 max-w-xl text-ink-300">
              Earshot hears the video through Chrome’s tab sharing, so it works with any video that plays in the page —
              no YouTube captions required.
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
          <div className="rounded-3xl bg-ink-900 p-7 ring-1 ring-ink-800 sm:p-9">
            <h2 className="font-display text-2xl font-semibold tracking-tight text-ink-100">Your audio, your call</h2>
            <ul className="mt-5 space-y-3 text-[0.95rem] leading-relaxed text-ink-300">
              <li>Earshot only hears a tab after you pick it and press Share — and only that tab.</li>
              <li>
                Audio streams to Deepgram for transcription while captions are on. Stop captions, or Chrome’s “Stop
                sharing”, ends it instantly.
              </li>
              <li>Transcripts live in your browser tab and disappear when you close it. Nothing is stored on a server.</li>
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

/** A quiet video frame whose caption writes itself in, word by word. */
function HeroPreview() {
  const words = HERO_CAPTION.split(" ");
  return (
    <figure className="relative" aria-label="Example of an Earshot caption">
      <div className="relative aspect-video overflow-hidden rounded-2xl bg-[radial-gradient(120%_90%_at_30%_20%,#2a2a36_0%,#121219_55%,#08080b_100%)] ring-1 ring-ink-700">
        {/* stage silhouette: a speaker on a lit stage */}
        <svg viewBox="0 0 160 90" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <defs>
            <linearGradient id="spot" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#f5b83d" stopOpacity="0.16" />
              <stop offset="1" stopColor="#f5b83d" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M72 0h16l30 90H42z" fill="url(#spot)" />
          <ellipse cx="80" cy="92" rx="64" ry="14" fill="#f5b83d" opacity="0.06" />
          <circle cx="80" cy="38" r="8.5" fill="#2a2a36" />
          <path d="M61 90c0-22 8-37 19-37s19 15 19 37z" fill="#2a2a36" />
        </svg>
        <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-semibold text-live backdrop-blur">
          <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-live" />
          Live captions
        </div>
      </div>
      {/* Caption bar below the frame, the same way the YouTube player gets it. */}
      <div className="mt-2 flex min-h-[4.6rem] items-center justify-center rounded-xl bg-black px-5 py-3 ring-1 ring-ink-800">
        <p className="text-center text-lg leading-snug font-medium text-white sm:text-xl">
          {words.map((w, i) => (
            <span key={i} className="caption-word" style={{ animationDelay: `${600 + i * 210}ms` }}>
              {w}{" "}
            </span>
          ))}
        </p>
      </div>
      <figcaption className="mt-3 text-sm text-ink-500">Captions appear as words are spoken — usually in under a second.</figcaption>
    </figure>
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
