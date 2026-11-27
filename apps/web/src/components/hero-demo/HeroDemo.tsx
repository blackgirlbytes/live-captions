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
 * The right side of the hero: real pieces of Heard, laid out like a collage.
 * They arrive one at a time: the player, its controls, the transcript, then the
 * Chrome extension popup. All but the player sit at a slight tilt.
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
        className="relative mt-14 flex flex-col overflow-hidden rounded-[28px] px-5 pt-9 pb-7 sm:px-10 sm:pt-12 sm:pb-10 lg:grid lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-start lg:gap-x-10 lg:gap-y-6 lg:[grid-template-areas:'video_popup'_'video_transcript'_'controls_transcript'] xl:absolute xl:inset-y-0 xl:right-0 xl:left-[46%] xl:mt-0 xl:content-center xl:items-stretch xl:gap-x-5 xl:gap-y-0 xl:overflow-visible xl:rounded-none xl:px-[4%] xl:pt-24 xl:pb-16 xl:grid-cols-[minmax(0,1fr)_14rem] xl:[grid-template-areas:'video_transcript'_'controls_popup'] 2xl:left-[41%] 2xl:px-[4%] 2xl:grid-cols-[minmax(0,1fr)_20rem] 2xl:gap-x-6"
        data-hero-demo
        role="group"
        aria-label="Try Heard: a demo player with live captions, the Chrome extension popup and the transcript"
      >
        <Backdrop className="xl:hidden" />

        {/* Player */}
        <div className="hero-pop relative lg:self-start lg:[grid-area:video]" style={{ animationDelay: "350ms" }}>
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

        {/* Chrome extension popup: overlaps the player on small screens, sits under it on wide ones */}
        <div
          className="hero-pop relative z-10 -mt-8 ml-auto w-[15.5rem] lg:mt-0 lg:ml-0 lg:w-full lg:[grid-area:popup] xl:mt-7 xl:self-start"
          style={{ animationDelay: "2150ms" }}
        >
          <div className="rotate-[2.5deg] xl:-rotate-[2.5deg]">
            <ExtensionPopup />
          </div>
        </div>

        {/* Transcript, beside the player like the real watch page (the transcript button hides it) */}
        <div
          hidden={!showTranscript}
          className="hero-pop relative mt-5 w-full max-w-[17.5rem] lg:mt-0 lg:max-w-none lg:[grid-area:transcript] xl:h-0 xl:min-h-full"
          style={{ animationDelay: "1550ms" }}
        >
          <div className="h-full lg:rotate-[1.5deg]">
            <TranscriptCard />
          </div>
        </div>

        {/* Player controls */}
        <div
          className="hero-pop relative mt-7 flex justify-center lg:mt-0 lg:[grid-area:controls] xl:mt-7 xl:self-center"
          style={{ animationDelay: "950ms" }}
        >
          <div className="-rotate-1">
            <PlayerControls />
          </div>
        </div>
      </div>
    </>
  );
}
