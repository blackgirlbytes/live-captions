import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Chrome extension privacy policy",
  description: "How the Heard Chrome extension handles tab audio, transcripts, and Deepgram API keys.",
};

export default function ExtensionPrivacyPage() {
  return (
    <main lang="en" className="mx-auto max-w-3xl px-5 py-12 text-ink-200 sm:py-20">
      <Link href="/" className="text-sm font-semibold text-accent hover:underline">← Heard</Link>
      <article className="mt-10 space-y-9 leading-7">
        <header>
          <h1 className="font-display text-4xl font-semibold tracking-tight text-ink-100">Heard Chrome extension privacy policy</h1>
          <p className="mt-3 text-sm text-ink-400">Last updated November 27, 2026</p>
        </header>

        <section className="space-y-3">
          <h2 className="font-display text-2xl font-semibold text-ink-100">What Heard does</h2>
          <p>Heard makes live captions and a transcript from the audio of the browser tab you choose. Capture starts only when you turn on captions for that tab. The toolbar shows a LIVE badge while capture runs.</p>
          <p>Heard sends that tab’s audio directly from your browser to Deepgram for speech recognition. Audio may contain personal conversations or other sensitive information. Use Heard only for audio that you are allowed to transcribe.</p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl font-semibold text-ink-100">Data the extension handles</h2>
          <ul className="list-disc space-y-2 pl-6">
            <li><strong className="text-ink-100">Tab audio and transcript:</strong> Heard captures audio from the selected tab and shows Deepgram’s text response as captions and transcript lines. Heard does not capture tabs in the background before you start it.</li>
            <li><strong className="text-ink-100">Current tab details:</strong> Heard checks the active tab’s URL to avoid pages Chrome blocks. It shows the tab title in the popup and transcript panel. It does not collect browsing history.</li>
            <li><strong className="text-ink-100">Deepgram API key:</strong> If you add your own key, Heard keeps it in <code>chrome.storage.local</code> in your browser profile. Heard sends it only to Deepgram to verify it and to open the transcription connection. The extension does not send your key to a Heard server or a web page.</li>
            <li><strong className="text-ink-100">Preferences:</strong> Heard saves caption style, overlay position, interface language, and an optional server URL in <code>chrome.storage.local</code>. Chrome does not sync that storage across your devices.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl font-semibold text-ink-100">Where data goes</h2>
          <p>Audio goes to <a href="https://deepgram.com/privacy" className="text-accent hover:underline">Deepgram</a> over an encrypted WebSocket. Deepgram processes the audio and returns transcript text. Deepgram’s retention and use of that data depend on its terms and your Deepgram account settings.</p>
          <p>If you have no saved key, Heard checks the configured Heard server for token access. The default server URL is <code>http://localhost:3100</code>. A server that has a Deepgram key can issue a short-lived token, which the extension uses with Deepgram. These requests do not contain tab audio, transcript text, or your personal Deepgram key. The server can see the request’s network address. Public Heard deployments do not have a server key by default.</p>
          <p>If you turn on caption translation, Chrome’s built-in Translator processes transcript text on your device. Chrome may download a language model for the selected language pair. Heard does not send transcript text to a translation server.</p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl font-semibold text-ink-100">Storage and control</h2>
          <p>Heard keeps transcripts in extension memory, not in browser storage or on a Heard server. Stopping capture closes the audio session. An open transcript panel can continue to show the last transcript until you close the panel. You can copy or download a transcript if you choose.</p>
          <p>Use <strong className="text-ink-100">Forget key</strong> in Settings to remove your saved Deepgram key. Change or reset other settings in the panel, or remove the extension to clear its local data. Stop captions in the popup or panel to end audio capture.</p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl font-semibold text-ink-100">Limited use</h2>
          <p>Heard uses data obtained through Chrome APIs only to provide live captions, a transcript, and related controls. Heard does not sell this data, use it for advertising, or give its developer access to your audio or transcript. Heard’s use of information received from Chrome APIs adheres to the Chrome Web Store User Data Policy, including its Limited Use requirements.</p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl font-semibold text-ink-100">Questions</h2>
          <p>For privacy questions or a report about the extension, <a href="https://github.com/blackgirlbytes/live-captions/issues/new" className="text-accent hover:underline">open a Heard issue on GitHub</a>. Do not include an API key, audio, or private transcript in a public issue.</p>
        </section>
      </article>
    </main>
  );
}
