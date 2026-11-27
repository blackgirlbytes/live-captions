import { HeroDemo } from "@/components/hero-demo/HeroDemo";
import { HeroPanel } from "@/components/HeroPanel";

/**
 * The home page is one screen: a dark stage with the panel on the left (its nav
 * swaps the panel between Home, How it works, Privacy and the extension) and a
 * working demo of Heard on the right. On narrower screens the two stack.
 */
export default function Home() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 pt-4 pb-10 sm:px-6 sm:pt-6 sm:pb-12 xl:h-dvh xl:max-w-none xl:p-4">
      <div className="hero-stage relative xl:h-full xl:min-h-[44rem] xl:rounded-[32px]">
        <HeroPanel />
        <HeroDemo />
      </div>
    </main>
  );
}
