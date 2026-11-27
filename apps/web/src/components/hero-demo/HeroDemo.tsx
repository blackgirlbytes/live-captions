"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
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
 * The right side of the hero: real pieces of Heard, composed like a collage.
 *
 * On wide screens the pieces sit on a fixed canvas that scales to fit the stage, so a composition
 * holds at every size. Narrower screens stack the same pieces. They arrive one at a time: the
 * player, its controls, the transcript, then the extension popup.
 */
export function HeroDemo() {
  return (
    <HeroDemoProvider>
      <DemoLayout />
    </HeroDemoProvider>
  );
}

/** A piece's place on the canvas: position, width, optional height, and tilt in degrees. */
interface Spot {
  x: number;
  y: number;
  w?: number;
  h?: number;
  r: number;
}
interface Layout {
  w: number;
  h: number;
  video: Spot;
  controls: Spot;
  transcript: Spot;
  popup: Spot;
}

/*
 * The composition: a tight diagonal from top left to bottom right, each piece tilted a little and
 * tucked against the one before: the video, the transcript just under its controls, then the
 * extension popup over the transcript's bottom corner. Sizes: the video is 16:9 at its
 * width, the controls pill is about 300×52, the popup about 256×150.
 */
const LAYOUT: Layout = {
  w: 560,
  h: 660,
  video: { x: 0, y: 0, w: 440, r: -3 },
  controls: { x: 40, y: 220, r: -2 },
  transcript: { x: 150, y: 262, w: 260, h: 250, r: 1.5 },
  popup: { x: 300, y: 500, w: 256, r: 4 },
};

const MAX_SCALE = 1.4;

/** Scales the wide-screen canvas to fit its box (a CSS variable, so it costs no re-render). */
function useCanvasScale(w: number, h: number) {
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const wide = window.matchMedia("(min-width: 1280px)");
    const update = () => {
      if (!wide.matches) {
        box.style.removeProperty("--demo-scale");
        return;
      }
      const rect = box.getBoundingClientRect();
      const s = Math.min(rect.width / w, rect.height / h, MAX_SCALE);
      box.style.setProperty("--demo-scale", String(Math.max(0.5, s)));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(box);
    wide.addEventListener("change", update);
    return () => {
      ro.disconnect();
      wide.removeEventListener("change", update);
    };
  }, [w, h]);
  return boxRef;
}

function spotStyle(s: Spot): CSSProperties {
  return {
    "--x": `${s.x}px`,
    "--y": `${s.y}px`,
    "--w": s.w ? `${s.w}px` : "auto",
    "--h": s.h ? `${s.h}px` : "auto",
    "--r": `${s.r}deg`,
  } as CSSProperties;
}

/** One piece on the canvas. Below xl it just flows in the stacked column (`className`). */
function Piece({ spot, delay, className = "", children, hidden }: { spot: Spot; delay: number; className?: string; children: ReactNode; hidden?: boolean }) {
  return (
    <div
      hidden={hidden}
      className={`hero-pop relative xl:absolute xl:top-[var(--y)] xl:left-[var(--x)] xl:mt-0 xl:ml-0 xl:h-[var(--h)] xl:w-[var(--w)] xl:max-w-none ${className}`}
      style={{ ...spotStyle(spot), animationDelay: `${delay}ms` }}
    >
      <div className="h-full xl:rotate-[var(--r)]">{children}</div>
    </div>
  );
}

function DemoLayout() {
  const { showTranscript, captionsOn, playing } = useHeroDemo();
  const listening = captionsOn && playing;
  const layout = LAYOUT;
  const boxRef = useCanvasScale(layout.w, layout.h);

  return (
    <>
      <Backdrop className="hidden rounded-[32px] xl:block" />
      <div
        className="relative mt-14 overflow-hidden rounded-[28px] px-5 pt-9 pb-8 sm:px-10 sm:pt-12 sm:pb-12 xl:absolute xl:inset-y-0 xl:right-0 xl:left-[52%] xl:mt-0 xl:overflow-visible xl:rounded-none xl:p-0 2xl:left-[48%]"
        data-hero-demo
        role="group"
        aria-label="Try Heard: a demo player with live captions, the Chrome extension popup and the transcript"
      >
        <Backdrop className="xl:hidden" />

        {/* The box the canvas scales into: clear of the extension button above, with room all round. */}
        <div ref={boxRef} className="relative xl:absolute xl:inset-x-[5%] xl:top-24 xl:bottom-12">
          <div
            className="relative mx-auto flex max-w-[36rem] flex-col xl:absolute xl:top-1/2 xl:left-1/2 xl:block xl:h-[var(--ch)] xl:w-[var(--cw)] xl:max-w-none xl:-translate-x-1/2 xl:-translate-y-1/2 xl:[scale:var(--demo-scale,1)]"
            style={{ "--cw": `${layout.w}px`, "--ch": `${layout.h}px` } as CSSProperties}
          >
            <Piece spot={layout.video} delay={350}>
              <div className="relative">
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
            </Piece>

            <Piece spot={layout.controls} delay={950} className="z-20 mt-4 flex justify-center">
              <PlayerControls />
            </Piece>

            <Piece spot={layout.transcript} delay={1550} hidden={!showTranscript} className="z-10 mt-6 w-full max-w-[19rem]">
              <TranscriptCard />
            </Piece>

            <Piece spot={layout.popup} delay={2150} className="z-30 -mt-4 ml-auto w-[15.5rem]">
              <div className="-rotate-2 xl:rotate-0">
                <ExtensionPopup />
              </div>
            </Piece>
          </div>
        </div>

      </div>
    </>
  );
}
