# Heard — Chrome extension

Real-time Deepgram Nova-3 captions and a searchable transcript for whatever is playing in a browser tab: YouTube, Twitch, LinkedIn Live, X Live, TikTok Live, Instagram Live, podcasts, lectures, video calls in a tab. Nothing in capture or transcription is site-specific.

It works **standalone with your own Deepgram API key** (no server at all), or with a Heard server that hands out short-lived tokens.

Built with [WXT](https://wxt.dev) (Manifest V3), React 19 and Tailwind v4. Transcription, transcript assembly, exporters and most UI come from `@heard/shared` (`packages/shared`).

For a store release, use the [Chrome Web Store publishing guide](../../docs/publish-chrome-extension.md). The [public extension privacy policy](https://live-captions-zeta.vercel.app/extension/privacy) describes the data flow after the site deploys it.

## How it works

```
popup / side panel ──start(tabId)──► background (service worker)
                                      │ chrome.tabCapture.getMediaStreamId({ targetTabId })
                                      │ chrome.offscreen.createDocument(USER_MEDIA)
                                      ▼
                                   offscreen document  ◄── source of truth (status, lines, captured tab)
                                      │ getUserMedia(chromeMediaSource: "tab") → TranscriptionSession
                                      │   AudioWorklet (pcm-worklet.js) → 16 kHz PCM → Deepgram WebSocket
                                      │   auth: your own key (if saved), else a short-lived token
                                      │         from POST {server}/api/deepgram/token
                                      ▼ runtime broadcast: TranscriptEvent
             ┌────────────────────────┴───────────────────────┐
   popup / side panel (apply events with reduceTranscript)    background → chrome.tabs.sendMessage
                                                                → caption overlay in the captured tab
```

- **background** (`entrypoints/background.ts`): one capture at a time. It keeps no state of its own; it asks the offscreen document (`get-state`) whenever it needs to know something, so the service worker can be suspended at any time. It sets a red **LIVE** badge on the captured tab, injects the overlay, relays caption events to it, stops when the tab closes, and re-injects the overlay after a full navigation when Chrome allows it.
- **offscreen document** (`entrypoints/offscreen/`): the only place audio is handled. It runs `TranscriptionSession` with `preservePlayback: true`, because `tabCapture` mutes the tab unless the audio is routed back to the speakers. Transcripts stay in memory and are never written to storage.
- **overlay** (`entrypoints/overlay.content/`): a runtime-registered content script, injected only into the tab you start. It renders in a shadow root with hand-written CSS. You can drag it, resize it from the corner, and close it with ×. It applies your caption settings as you change them, moves into the fullscreen element when a video goes fullscreen, and remembers its position.
- **side panel** (`entrypoints/sidepanel/`): Start/Stop, the live transcript with search, copy and download (TXT/SRT/VTT), and **Settings**: your Deepgram key, the server URL and caption style.
- **popup** (`entrypoints/popup/`): the main on/off switch for the current tab, plus "Show captions overlay", "Open transcript panel" and (in server mode) "Open Heard web". When no key is available it says so and links straight to the key setting.
- **messages** (`utils/messages.ts`): the typed message protocol between all of the above.

The AudioWorklet file `pcm-worklet.js` is generated at build time from `PCM_WORKLET_SOURCE` in `@heard/shared` (a `build:publicAssets` hook in `wxt.config.ts`), so there's a single source.

### Live dubbing

The **Live dubbing** switch in the side panel's Settings tab speaks the transcript in another language. The panel turns final lines into phrases and translates them with Chrome's translator, then sends them over a port (`heard-dub`) to the offscreen document. The offscreen document synthesizes them with Deepgram Flux TTS (`wss://api.deepgram.com/v2/speak`, same credential as the captions) and plays them. Because playback happens there, `tabCapture` never records the dub. The captured audio's playback path has its own gain node, so the original drops to a fixed 10% while dubbing and Deepgram still hears full-level audio. The overlay content script reports the page video's play, pause and seek. Closing the panel turns dubbing off and restores the original. Design, measurements and limits: [docs/live-dubbing.md](../../docs/live-dubbing.md).

## Build & develop

From the repo root (npm workspaces):

```bash
npm install                      # once, at the repo root
npm run build -w @heard/extension   # → apps/extension/.output/chrome-mv3
npm run dev -w @heard/extension     # WXT dev mode with auto-reload
```

Or inside `apps/extension`: `npx wxt build`, `npx wxt` (dev), `npx tsc --noEmit` (typecheck), `npx wxt zip` (store zip).

Icons in `public/icon/` are generated by `node scripts/make-icons.mjs` (no dependencies needed).

## Load it in Chrome

1. Build (see above).
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and select `apps/extension/.output/chrome-mv3`. The build prints this folder's full path (and on a Mac copies it to your clipboard). The folder starts with a dot, so the file picker hides it: on a Mac press **Cmd+Shift+G** and paste the path; on Linux press **Ctrl+L** and paste it (or **Ctrl+H** to show hidden folders); on Windows the folder is visible, or paste the path into the picker's address bar.
4. Pin Heard from the puzzle-piece menu so the icon (and its LIVE badge) stays visible.

After rebuilding, click the reload icon on the extension's card.

## Deepgram access: your own key, or a Heard server

The extension needs one of two things to talk to Deepgram. **A saved key always wins.**

### Standalone: bring your own key (no server)

1. Create a key at [console.deepgram.com](https://console.deepgram.com/). Make a **dedicated key for Heard** with the fewest permissions (Member or lower) and an **expiry date**, so you can revoke it without touching anything else.
2. Open the side panel → **Settings** → **Deepgram key**, paste it and press **Verify & save**. Heard briefly opens a Deepgram streaming socket to check the key (Deepgram's REST API doesn't allow browser requests). Rejected, malformed or unverifiable (offline) keys are not saved.
3. The status line reads "Using your key (••••last4)". **Forget key** removes it.

That's it: no Heard server, no build-time config. Usage is billed to your Deepgram account. If Deepgram rejects a saved key when you start (deleted or expired), captions stop with an error and a **Check your key** button instead of retrying.

How it flows: the background service worker reads the key from `chrome.storage.local` when you press Start and passes it to the offscreen document in the `start` message (`credential: { kind: "user-key" }`). The offscreen document opens `wss://api.deepgram.com/v1/listen` with Deepgram's `token` subprotocol. No host permission is needed for that WebSocket.

**Privacy**
- The key is stored only in this browser profile (`chrome.storage.local`), is never synced, and is only ever sent to Deepgram. It never goes to a Heard server or anywhere else.
- It is never logged, never shown in full after saving (only the last 4 characters), and never sent to web pages or the caption overlay. Content scripts never receive it in a message. The only message that carries it is the background → offscreen `start` command.
- Like anything in extension storage, it is readable by someone with access to your Chrome profile on disk. That's why a dedicated, limited, expiring key is recommended.

### Server mode (Heard token endpoint)

With no key saved, each connect asks the Heard web app for a short-lived token, and the permanent key stays on the server:

- `POST {HEARD_URL}/api/deepgram/token` with body `{}` returns `{ access_token, expires_in }` (503 `{ code: "no_server_key" }` when the server has no key).
- `GET {HEARD_URL}/api/deepgram/token` returns `{ serverKey: boolean }`. The popup, side panel and Start use it to tell up front whether the server can help. If the server is unreachable or has no key, they explain that a key is needed and link to the key setting instead of failing later with a network error.
- The server allows CORS from `chrome-extension://` origins.

Server URL:
- **Default:** `http://localhost:3100`. Run the web app with `npm run dev:web` from the repo root, with `DEEPGRAM_API_KEY` in `apps/web/.env.local`.
- **At build time:** `WXT_HEARD_URL=https://heard.example.com npx wxt build`.
- **At runtime:** side panel → **Settings** → **Server URL**. The value is saved in `chrome.storage.local` and used the next time you press Start. **Reset** returns to the build-time default. It's ignored while your own key is saved.

Remote server URLs must use HTTPS. Plain HTTP is accepted only for `localhost`, `127.0.0.1`, and `::1` during local development, because a token sent over remote HTTP could be intercepted.

## Manual test checklist

Run it once in each mode: with your own key and no server, and with no key and the web app running at the server URL.

**Key setup**
- [ ] No key and no server: the popup and side panel say a key is needed. The popup's **Add your key** opens the side panel on the key field.
- [ ] A wrong key shows "Deepgram rejected this key" and isn't saved. A good key shows "Using your key (••••last4)".
- [ ] Show/Hide reveals and hides the pasted key. **Forget key** returns to server mode.
- [ ] A saved key that has since been deleted in the Deepgram console: Start ends with an "API key" error and a **Check your key** button.

**YouTube VOD**
- [ ] Open a YouTube video and play it. Click the Heard icon and turn on **AI captions**.
- [ ] The badge shows a red **LIVE**, the popup says "Captioning this tab's audio", and you can **still hear** the video.
- [ ] The caption box appears near the bottom of the page within 1–2 s of speech, and interim words update as people talk.
- [ ] Drag the box: it stays inside the viewport. Drag the corner: the width changes. Reload the page: the box comes back in the same place.
- [ ] Clicks on the YouTube player and page outside the box still work.
- [ ] Press **f** for fullscreen: captions stay visible over the video. Exit fullscreen: they're still there.
- [ ] Click × on the box: it disappears, and the popup now offers **Show captions overlay**, which brings it back.
- [ ] **Open transcript panel**: lines arrive with timestamps. Search highlights matches. Copy works. Download produces TXT, SRT and VTT files.
- [ ] Change the caption style (size, background, color, font, lines) in the side panel: the box updates live.
- [ ] Pause the video, then resume: captions continue. Seek: there are no duplicated lines.
- [ ] Click a different video on YouTube (in-page navigation): captions keep flowing. Do a full reload: the overlay comes back.
- [ ] Turn captions off in the popup: the badge clears, the overlay disappears, and Chrome's "sharing this tab" indicator goes away. The side panel keeps the transcript until it's closed.
- [ ] Close the captured tab while it's live: capture stops and the badge clears.

**YouTube livestream**
- [ ] Open a live stream and start captions: latency stays low over several minutes.
- [ ] Turn Wi-Fi off for ~5 s, then back on: the status goes to "Reconnecting" and then returns to "Live", and no audio from the gap is duplicated.
- [ ] Leave it running for 10+ minutes, including with the side panel and popup closed (the service worker gets suspended). Captions keep coming, and reopening the popup or panel shows the correct state.

**Other streaming platforms**

Nothing in the extension is site-specific, so each of these should work like YouTube. Run the core checks on each: captions start, `LIVE` badge, the box sits on the right video and follows it, the site's own fullscreen keeps the box visible, clicks outside the box still work, in-page navigation to another stream, and Stop clears everything.

- [ ] **Twitch:** a live channel (`twitch.tv/<channel>`) and a past broadcast (`twitch.tv/videos/<id>`). Also theater mode and the pre-roll ad.
- [ ] **LinkedIn Live:** an event page and a live post in the feed. With several videos in the feed, the box picks the one you're listening to.
- [ ] **X Live:** `x.com/i/broadcasts/<id>` and a live post in the timeline.
- [ ] **TikTok Live:** `tiktok.com/@<user>/live`. The 9:16 video gets a box centered on it, raised above the comments, with normal-size text.
- [ ] **Instagram Live:** `instagram.com/<user>/live` (signed in). Same portrait checks as TikTok.
- [ ] **Muted autoplay** (X, LinkedIn, Instagram): start captions on a muted video. The box says to unmute; unmuting removes the hint and captions start.

**Edge cases**
- [ ] On `chrome://extensions` or the Chrome Web Store, the toggle is disabled with an explanation.
- [ ] Start on tab A, then start on tab B: A stops (badge cleared) and B starts.
- [ ] With no key and the server URL pointing at a dead server, Start says a Deepgram key is needed and offers **Add your Deepgram key**.

### Live dubbing

- [ ] **Live dubbing** is off and disabled until captions start, and says so.
- [ ] Turning it on: the original drops to about 10%, the status goes Connecting → Listening → Translating → Playing dubbed audio, and the delay shows.
- [ ] In a two-person interview, the speakers get different voices, a lower one for the lower-sounding speaker. A voice may be a placeholder for the first phrase, then stays put.
- [ ] With **Show captions in** set to the spoken language, turning dubbing on switches the captions and transcript to the dub language (originals under each transcript line), and the picker says it follows dubbing. Picking a caption language while dubbing keeps that choice; turning dubbing off restores the saved one.
- [ ] **Accent** appears only for English, Portuguese, German and Dutch. Changing it switches at the next phrase. The original stays at about 10% and captions keep coming.
- [ ] Seeking or pausing the video stops the dub straight away and drops queued phrases; playing resumes it.
- [ ] Changing **Hear it in** drops what was queued and continues in the new language.
- [ ] Turning it off stops speech immediately and restores the original volume.
- [ ] Closing the side panel while dubbing restores the original volume.
- [ ] With a revoked key, dubbing shows "Dubbing unavailable", the original comes back, and captions continue.
- [ ] Automated: `npm run e2e:dubbing -w @heard/extension` with `E2E_USER_KEY` after a build.

## Permissions

| Permission  | Why |
|-------------|-----|
| `tabCapture` | Capture the audio of the tab you start, and only that tab. |
| `offscreen`  | MV3 service workers can't use `getUserMedia`, Web Audio or long-lived WebSockets. An offscreen document (reason `USER_MEDIA`) runs the capture and the Deepgram connection. |
| `sidePanel`  | Live transcript, search/export and settings. |
| `storage`    | Caption style, overlay position, server URL and your Deepgram key (`chrome.storage.local`). Transcripts are never stored. |
| `activeTab`  | Clicking the Heard icon grants temporary access to the current tab. That's what lets Chrome allow `tabCapture` and overlay injection without host permissions. |
| `scripting`  | Inject the caption overlay into the captured tab on demand. |

There are **no host permissions** and **no always-on content scripts**. Heard reads nothing on pages you don't start it on. Connecting to Deepgram with your own key needs no extra permission: WebSockets from extension pages aren't subject to host permissions or CORS.

## Known limitations

- **tabCapture invocation rule.** Chrome only grants `tabCapture` for a tab after you've invoked the extension on that tab, for example by clicking the toolbar icon. Starting from the popup always works. Starting from the side panel works once the icon has been clicked on that tab. Otherwise the panel shows "Click the Heard toolbar icon on this tab, then Start."
- **One tab at a time.** Starting on another tab stops the current capture.
- **DRM / protected audio.** Some streaming sites (e.g. Netflix, some Widevine-protected players) deliver silent audio to tab capture, so there's nothing to transcribe.
- **Restricted pages.** `chrome://` pages, the Chrome Web Store, other extensions' pages and the PDF viewer can't be captured or scripted.
- **Overlay after navigation.** The `activeTab` grant may end when the captured tab navigates to another page (especially cross-origin). Capture continues and the transcript keeps flowing in the side panel, but the overlay can only be re-injected if Chrome still allows it. Click the Heard icon and choose "Show captions overlay" to bring it back.
- **Service worker suspension.** Handled by design: the offscreen document owns all state and the background re-reads it on wake. The badge is per-tab, and Chrome resets it on navigation; the background restores it when the page finishes loading.
- **Transcript lifetime.** Transcripts live only in memory. Stopping closes the offscreen document. An open side panel keeps showing the last transcript, but closing it (or the browser) discards it. Download first if you need a copy.
- **Timestamps** are "time since capture started" (stream time), not video time, because capture is site-agnostic.
- **Headless automation:** tab audio is silent in headless Chrome, so end-to-end tests that need real transcripts must run headful.
