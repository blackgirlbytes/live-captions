"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { LanguagePicker } from "@/components/LanguagePicker";
import { Logo } from "@/components/Logo";
import { useT } from "@/i18n/I18nProvider";
import { UrlForm } from "@/components/UrlForm";
import { resolveVideo } from "@/lib/providers";

// The player + transcription session are browser-only (YouTube API, AudioWorklet, getDisplayMedia).
const WatchExperience = dynamic(() => import("./WatchExperience").then((m) => m.WatchExperience), {
  ssr: false,
  loading: () => <PlayerSkeleton />,
});

export function WatchShell({ url }: { url: string }) {
  const resolved = url ? resolveVideo(url) : null;
  const t = useT("watch").shell;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-ink-800 bg-ink-950/85 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[1600px] items-center gap-3 px-4 py-2.5 sm:gap-5 sm:px-6">
          <span className="sm:hidden">
            <Logo compact />
          </span>
          <span className="hidden sm:inline-flex">
            <Logo />
          </span>
          <div className="min-w-0 flex-1 sm:max-w-xl">
            <UrlForm key={url} size="compact" initialValue={url} />
          </div>
          <LanguagePicker className="ml-auto shrink-0" />
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        {!resolved ? (
          <Notice title={t.emptyTitle}>
            {t.emptyBefore}
            <Link href="/" className="text-accent underline-offset-2 hover:underline">
              {t.emptyLink}
            </Link>
            {t.emptyAfter}
          </Notice>
        ) : !resolved.ok ? (
          <Notice title={t.badLinkTitle}>{resolved.message}</Notice>
        ) : (
          <WatchExperience key={resolved.video.key} url={url} />
        )}
      </main>
    </div>
  );
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto mt-20 max-w-lg px-6 text-center">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink-100">{title}</h1>
      <p className="mt-3 leading-relaxed text-ink-300">{children}</p>
    </div>
  );
}

function PlayerSkeleton() {
  return (
    <div className="mx-auto grid w-full max-w-[1600px] gap-0 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-6 lg:px-6 lg:py-5">
      <div className="aspect-video min-h-[200px] w-full animate-pulse bg-ink-900 lg:rounded-2xl" />
      <div className="hidden h-[60vh] animate-pulse rounded-2xl bg-ink-900 lg:block" />
    </div>
  );
}
