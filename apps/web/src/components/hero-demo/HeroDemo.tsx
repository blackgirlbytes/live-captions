"use client";

import { ExtensionPopup } from "./ExtensionPopup";
import { PlayerControls } from "./PlayerControls";
import { HeroDemoProvider, useHeroDemo } from "./state";
import { TranscriptCard } from "./TranscriptCard";
import { VideoFrame } from "./VideoFrame";

/** The stage backdrop: a dim room with warm stage light, like the paused frame of a talk. */
function Backdrop({ className = "" }: { className?: string }) {
  return <div className={`hero-backdrop hero-focus pointer-events-none absolute inset-0 ${className}`} aria-hidden="true" />;
}

/**
 * The right side of the hero: real pieces of Earshot, laid out like a collage.
 * The player with live captions, the Chrome extension popup, the transcript
 * panel and the player controls arrive in that order.
 */
export function HeroDemo() {
  return (
    <HeroDemoProvider>
      <DemoLayout />
    </HeroDemoProvider>
  );
}

function DemoLayout() {
  const { showTranscript, captionsOn, playing } = useHeroDemo();
  const listening = captionsOn && playing;
  return (
    <>
      <Backdrop className="hidden rounded-[32px] xl:block" />
      <div
        className="relative mt-14 overflow-hidden rounded-[28px] px-5 pt-9 pb-7 sm:px-10 sm:pt-12 sm:pb-10 lg:grid lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-start lg:gap-x-10 xl:block xl:absolute xl:inset-y-0 xl:right-0 xl:left-1/2 xl:mt-0 xl:overflow-visible xl:rounded-none xl:p-0"
        data-hero-demo
        role="group"
        aria-label="Try Earshot: a demo player with live captions, the Chrome extension popup and the transcript"
      >
        <Backdrop className="xl:hidden" />

        {/* Player */}
        <div className="hero-pop relative lg:col-start-1 lg:row-start-1 xl:absolute xl:top-[18%] xl:left-[7%] xl:w-[66%] 2xl:w-[62%]" style={{ animationDelay: "500ms" }}>
          <VideoFrame />
          <span
            className="absolute -top-4 -left-3 grid h-11 w-11 place-items-center rounded-full bg-ink-950 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.9)] ring-1 ring-white/10"
            title={listening ? "Listening" : "Not listening"}
          >
            <span className="flex h-4 items-center gap-[3px]">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={`w-[3px] rounded-full transition-colors ${listening ? "hero-bar bg-accent" : "h-1 bg-ink-600"}`}
                  style={{ animationDelay: `${i * 140}ms` }}
                />
              ))}
            </span>
          </span>
        </div>

        <div className="relative mt-5 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-4 lg:flex-col lg:justify-start lg:gap-6 xl:static xl:contents">
          {/* Chrome extension popup */}
          <div
            className="hero-pop relative z-10 -mt-8 ml-auto w-[15.5rem] sm:order-2 sm:mt-0 sm:ml-0 lg:order-none xl:absolute xl:top-[48%] xl:right-[5%] 2xl:w-[18.5rem]"
            style={{ animationDelay: "1500ms" }}
          >
            <div className="rotate-[2.5deg]">
              <ExtensionPopup />
            </div>
          </div>

          {/* Transcript (the player's transcript button hides it) */}
          <div
            hidden={!showTranscript}
            className="hero-pop relative w-full max-w-[17.5rem] sm:mt-6 lg:mt-0 lg:max-w-none xl:absolute xl:top-[59%] xl:left-[7%] xl:mt-0 xl:w-[17.5rem] 2xl:w-[21rem]"
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
