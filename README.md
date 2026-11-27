# Heard — live AI captions for online video

**Live:** https://live-captions-zeta.vercel.app (bring your own free Deepgram key)

Heard is an open-source web video player and Chrome extension. They add real-time captions and an interactive transcript to online video using **Deepgram Nova-3** streaming speech-to-text. They don't depend on the video platform's own captions.

- **Web platform** (`apps/web`, Next.js): paste a YouTube video or livestream URL and watch it with live captions, plus a searchable transcript with timestamps you can download and click to jump in the video.
- **Chrome extension** (`apps/extension`, WXT, Manifest V3): caption whatever is playing in the current tab. It adds a caption box you can drag and resize, and a transcript side panel.

Both share one transcription core and one set of UI components (`packages/shared`). YouTube is the first provider, but capture and transcription have no YouTube-specific code.

```
live-captions/
├── packages/shared/        # @heard/shared: provider-agnostic core + React UI
│   ├── src/core/           # audio capture → Deepgram socket → transcript assembly
│   │   ├── audio.ts        #   tab MediaStream → AudioWorklet → 16 kHz mono linear16
│   │   ├── deepgram.ts     #   /v1/listen socket, bearer-JWT subprotocol, control msgs
│   │   ├── session.ts      #   TranscriptionSession: reconnect, buffering, pause, seek
│   │   ├── transcript.ts   #   interim/final assembly, dedupe, line splitting, events
│   │   ├── time-map.ts     #   stream time → media time (seekable timestamps)
│   │   ├── format.ts       #   TXT / SRT / VTT export
│   │   └── token.ts        #   fetches short-lived tokens from the Heard server
│   ├── src/react/          # CaptionText, TranscriptView, TranscriptToolbar, settings…
│   └── src/theme.css       # shared visual identity (Tailwind v4 tokens)
├── apps/web/               # Next.js platform + token API (holds the Deepgram key)
│   └── src/lib/providers/  # VideoProvider registry; youtube/ is the only provider so far
├── apps/extension/         # WXT Chrome extension (background, offscreen, overlay, panel, popup)
└── docs/provider-policies.md
```

## How it works

```
 tab audio ──► AudioWorklet (resample to 16 kHz PCM) ──► WebSocket wss://api.deepgram.com/v1/listen
   ▲            (shared/core/audio.ts)                     model=nova-3, interim_results, smart_format
   │                                                        auth: Sec-WebSocket-Protocol: bearer, <JWT>
   │                                                                     │
 web: getDisplayMedia("this tab")                    Results / UtteranceEnd
 ext: chrome.tabCapture → offscreen doc                                  ▼
                                               TranscriptAssembler → lines + live caption
 token: POST /api/deepgram/token ──► Deepgram POST /v1/auth/grant (60 s JWT)
        (apps/web; permanent key never leaves the server)
```

- **Credentials, two modes:**
  - **Server key:** if `DEEPGRAM_API_KEY` is set on the Next.js server, browsers get a 60-second JWT from `POST /api/deepgram/token`. It's used only to open the WebSocket, and every reconnect fetches a new one. The extension calls the same endpoint; CORS allows `chrome-extension://` origins, optionally limited to listed IDs, and there's a per-IP rate limit. **The server key pays for every visitor.**
  - **Bring your own key:** if the server has no key (or a user chooses to), the user pastes their own Deepgram API key. It's stored only in their browser (localStorage, or `chrome.storage.local` in the extension) and sent only to Deepgram, as the WebSocket's `token` subprotocol. Each user pays for their own usage. With a key saved, the extension works on its own, with no Heard server.
- **Interim vs. final results:** interim results update the caption as people speak. Final results are added to a line, and a line is committed when Deepgram detects end of speech (`speech_final` / `UtteranceEnd`). Long continuous speech is split at sentence boundaries so lines stay readable.
- **No duplicate segments:** word timestamps are tracked on one timeline across reconnects. Words that were already finalized are dropped when audio is replayed or re-finalized.
- **Reliability:** if the connection drops, audio is buffered (last 15 s). The app reconnects with exponential backoff and a fresh token, and reconnects right away when the browser comes back online. KeepAlive messages are sent during silence. Stopping sends `CloseStream` and waits for the final words before closing everything.
- **Sync (web):** each audio chunk records the player's `currentTime`. So every line knows its position in the video, and clicking a timestamp seeks there. Pausing the video stops streaming, so silence isn't billed. Seeks are detected and flush the caption.

## Setup

Requirements: Node 20+ (tested on 22), npm 10, and desktop Google Chrome or Edge 116+.

```bash
npm install
```

```bash
cp apps/web/.env.example apps/web/.env.local
```

For local use, set `DEEPGRAM_API_KEY` in `apps/web/.env.local` (create a key at https://console.deepgram.com, Member role or higher). If you leave it unset, the app asks for a key in the browser instead.

| Variable | Where | Purpose |
|---|---|---|
| `DEEPGRAM_API_KEY` | `apps/web/.env.local` | **Optional.** Server-side key used to mint short-lived tokens; it pays for everyone who uses this server. Unset = each user brings their own key. |
| `HEARD_EXTENSION_IDS` | `apps/web/.env.local` | Optional comma-separated extension IDs allowed to request tokens. Unset = any `chrome-extension://` origin (convenient for unpacked builds; set it in production). |
| `HEARD_TOKEN_RATE_LIMIT` | `apps/web/.env.local` | Optional token requests per IP per minute (default 30). |
| `WXT_HEARD_URL` | env when building the extension | Heard server the extension talks to (default `http://localhost:3100`). It can also be changed later in the side panel. |

### Run the web platform

```bash
npm run dev:web
```

Open http://localhost:3100, paste a YouTube link, press **Start captions**. In Chrome's share dialog choose **This tab** and keep **Also share tab audio** on. The web app uses port **3100** so it won't clash with other local apps on 3000, and listens on `127.0.0.1` only, so other devices on your network can't use your key.

### Deploying publicly

**Don't set `DEEPGRAM_API_KEY` on a public deployment** unless you mean to pay for every visitor's captions. The token endpoint has no sign-in, so anyone who opens the site can spend your key's credit (they never see the key itself). Without it, each visitor is asked for their own free Deepgram key the first time they press Start. If you do host a key on purpose, set `HEARD_EXTENSION_IDS` and add real authentication or quotas. These rules are also in [AGENTS.md](AGENTS.md) for AI coding agents.

**Vercel:** create a project with **Root Directory** `apps/web` (framework Next.js, Node 22) and no environment variables, then deploy from the repo root with `vercel deploy --prod`. The repo's `.vercelignore` keeps local `.env` files from being uploaded, so a key in `apps/web/.env.local` can't leak into a deployment. Afterwards, `GET /api/deepgram/token` on the live site should return `{"serverKey":false}`.

### Build and load the Chrome extension

```bash
npm run build -w @heard/extension
```

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and select `apps/extension/.output/chrome-mv3`. The build prints this folder's full path (and on a Mac copies it to your clipboard). The folder starts with a dot, so the file picker hides it: on a Mac press **Cmd+Shift+G** and paste the path; on Linux press **Ctrl+L** and paste it (or **Ctrl+H** to show hidden folders); on Windows the folder is visible, or paste the path into the picker's address bar.
3. Open the side panel's **Settings** and paste your Deepgram key. (Or skip this and keep the web app running with a server key; the extension then gets tokens from it.)
4. Open a YouTube video, click the Heard toolbar icon, and turn **AI captions** on.

For hot reload during development use `npm run dev:extension`. See [apps/extension/README.md](apps/extension/README.md) for the manual test checklist, permissions rationale and more detail.

For a Chrome Web Store release, follow [the publishing guide](docs/publish-chrome-extension.md). The [listing reference](docs/chrome-web-store-listing.md) includes privacy answers and permission explanations.

## Testing

| Command | What it covers |
|---|---|
| `npm test` | Shared core unit tests: transcript assembly/dedupe/line splitting, session reconnect + buffering + pause, time mapping, the real worklet resampler, exporters. |
| `npm run test:live -w @heard/shared` (with `DEEPGRAM_API_KEY` and `HEARD_TEST_AUDIO=/path/to/speech.wav`) | **Real Deepgram end-to-end test:** a WAV file → real resampler → `TranscriptionSession` → JWT → Nova-3 → transcript lines. |
| `npm run e2e -w @heard/web` (web server running) | **Real browser end-to-end test:** headful Chrome with `--auto-accept-this-tab-capture` opens a YouTube talk, starts captions and checks for seekable transcript lines, a caption and a clean stop. Add `E2E_USER_KEY=<key>` to go through the bring-your-own-key flow, or `E2E_BAD_KEY=1` (against a server without a key) to check that bad keys are rejected. |
| `npm run typecheck` / `npm run build` | Type-checks all workspaces and builds both apps. |

## Privacy

- Audio is captured only after you click Start and pick the tab in the browser's own prompt (web), or click the extension. While captions are on, the web app shows a status badge and the extension shows a `LIVE` toolbar badge.
- Audio goes straight from your browser to Deepgram. The Heard server only issues tokens and never sees audio, text, or a user's own key.
- A user's own key is stored in their browser. Anything that can read that browser storage (a malicious extension, or a script injected into the page) could read it too, so the key forms suggest a dedicated key with minimal permissions and an expiry, and offer **Forget key**.
- Transcripts stay in memory and are never stored. Only caption appearance settings are saved (localStorage / `chrome.storage.local`). Copy or download a transcript if you want to keep it.
- The extension asks only for `tabCapture`, `offscreen`, `sidePanel`, `storage`, `activeTab`, `scripting`. It has no host permissions and no content scripts that run on every page.

## Provider policies

See [docs/provider-policies.md](docs/provider-policies.md). YouTube's Required Minimum Functionality forbids overlays in front of an embedded player. So on the web platform, YouTube captions appear in a caption bar **directly below** the player, and Heard's own fullscreen keeps that bar visible. The doc also flags an **open question** to review before a public deployment: whether transcribing YouTube audio fits Developer Policy III.I.7 ("separate, isolate, or modify the audio or video components").

## Known limitations

- **Browsers:** desktop Chrome/Edge only. Firefox and Safari don't support tab-audio capture through `getDisplayMedia`, and mobile browsers have no tab capture.
- **Caption delay:** captions lag speech by roughly 0.3–1 s (network plus recognition). The video isn't delayed to compensate.
- **Embedding:** videos whose owners disable embedding (YouTube errors 101/150) can't play on the web platform; use the extension on youtube.com instead. `youtube.com/@handle/live` links can't be resolved without the YouTube Data API, so paste the video link.
- **Extension:**
  - Chrome only allows capture after you click the extension on that tab, so starting from the side panel may need one toolbar click first.
  - One tab at a time.
  - DRM-protected players capture as silence.
  - Timestamps count from when capture started, not video time.
  - Transcripts live in the offscreen document and side panel memory.
- **Not run automatically:**
  - The extension's caption box in fullscreen video and recovery after the service worker is suspended. Both are in the extension's manual checklist.
  - Real-audio tests need a visible (headful) Chrome, because headless Chrome captures silent tab audio.
- **Token rate limiting** is in memory, per server process. Use a shared store if you run several instances.
- **Checking a pasted key:** Deepgram's REST API doesn't accept browser requests, so "Verify & save" checks a key by briefly opening a streaming connection. If a firewall or outage blocks Deepgram, that looks the same as a rejected key.

## Extending

- **New video provider (Twitch, Vimeo, direct URLs):** add a `VideoProvider` in `apps/web/src/lib/providers/` (parse the URL, mount a player, report `currentTime`/state, declare `allowsCaptionOverlay`) and register it. Transcription doesn't change.
- **Translation, summaries, Flux voice assistants, TTS dubbing:** `TranscriptionSession` emits small typed `TranscriptEvent`s, so new features can subscribe to lines/captions without touching capture. Deepgram options (`model`, `language`, `keyterms`) are already parameters of the session.
