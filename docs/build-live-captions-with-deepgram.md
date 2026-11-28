# Build live video captions with Deepgram

In this tutorial, you will follow the path from browser tab audio to live captions, then use the same transcription code in a Chrome extension. Heard is the working project. By the end, you will know what each layer does and how to build a similar feature for another video source.

You will use [Deepgram Nova-3 streaming speech-to-text](https://developers.deepgram.com/docs/live-streaming-audio). Nova-3 fits a captioning app because it returns changing text while someone speaks, final text for a transcript, and word timestamps. The browser sends audio directly to Deepgram. Heard's server never receives the audio or transcript.

You need Node.js 20 or later, npm, desktop Chrome or Edge, and a [Deepgram API key](https://console.deepgram.com). Use a video or livestream with audible speech. You can complete the web steps with your own key and no server key.

## 1. Run a working caption session

Clone the project and start the web app:

```bash
git clone https://github.com/blackgirlbytes/live-captions.git
cd live-captions
npm install
npm run dev:web
```

Open `http://localhost:3100` in Chrome or Edge. Paste a YouTube video or livestream URL that allows embedding. Select **Start captions**, enter your Deepgram key when asked, and select **Choose this tab**. In the browser's sharing dialog, select the Heard tab that contains the video and enable **Also share tab audio**.

You should see words change in the caption bar while the speaker talks. After a pause, the transcript gains a line with a timestamp. Stop captions when you finish. Heard keeps the transcript in memory until you leave or clear it.

The first result proves the full path works:

```text
Browser tab audio → 16 kHz mono PCM → Deepgram WebSocket
                                     ↓
                              live caption + transcript
```

For a new project, build that path before adding search, downloads, or an extension. The next steps show the implementation in the order you can reproduce it.

## 2. Capture audio after a user click

Open [`apps/web/src/lib/capture.ts`](../apps/web/src/lib/capture.ts). The Start button calls `captureTabAudio()` directly from its click handler. That matters because `getDisplayMedia()` needs a user action and shows the browser's own permission dialog.

The essential request is:

```ts
const stream = await navigator.mediaDevices.getDisplayMedia({
	video: true,
	audio: true,
});
```

The browser requires `video: true` for display capture, even though captions need only sound. Heard stops and removes the video track after capture. Check `stream.getAudioTracks().length` before starting transcription. If it is zero, ask the user to start again with tab audio enabled.

Try canceling the sharing dialog, then start again without **Also share tab audio**. You should see different, actionable errors. This check belongs before the Deepgram connection. A silent stream cannot produce captions.

For a player other than YouTube, keep capture separate from player code. Heard's provider interface lives in [`apps/web/src/lib/providers/`](../apps/web/src/lib/providers/). Its adapter reports playback state and current media time. The transcription core accepts any `MediaStream` with an audio track.

## 3. Convert browser audio into the format you declare

The browser's audio sample rate depends on the device. Heard uses an `AudioWorklet` in [`packages/shared/src/core/audio.ts`](../packages/shared/src/core/audio.ts) to mix channels to mono, resample to 16,000 samples per second, and turn floating-point samples into signed 16-bit PCM. It sends a chunk about every 100 ms.

When you send raw PCM, tell Deepgram exactly what the bytes mean. Heard builds this URL in [`packages/shared/src/core/deepgram.ts`](../packages/shared/src/core/deepgram.ts):

```text
wss://api.deepgram.com/v1/listen?model=nova-3&language=multi&encoding=linear16&sample_rate=16000&channels=1&interim_results=true&smart_format=true&endpointing=300&utterance_end_ms=1000&vad_events=true
```

Heard starts with `language=multi` to detect the spoken language. Set a specific language when you know it. The `encoding`, `sample_rate`, and `channels` values must match the audio you send. Deepgram needs the format parameters for [raw audio](https://developers.deepgram.com/docs/determining-your-audio-format-for-live-streaming-audio). If you send containerized audio instead, let its header describe the format and omit `encoding` and `sample_rate`.

To see this layer in action, put a breakpoint in `startPcmCapture()` where `node.port.onmessage` calls `opts.onChunk`. Start captions and inspect one `ArrayBuffer`. A 100 ms chunk of mono 16 kHz `linear16` audio contains about 1,600 samples, or 3,200 bytes. If you see no chunks, fix capture or the audio graph before debugging Deepgram.

## 4. Open a Deepgram stream without exposing a shared key

Browser WebSockets cannot set an `Authorization` header. Heard passes a credential through the WebSocket subprotocol list in [`DeepgramSocket`](../packages/shared/src/core/deepgram.ts):

```ts
const socket = new WebSocket(listenUrl, [credential.type, credential.value]);
socket.binaryType = "arraybuffer";
node.port.onmessage = ({ data }: MessageEvent<ArrayBuffer>) => {
	if (socket.readyState === WebSocket.OPEN) socket.send(data);
};
```

For a user's own Deepgram API key, `credential.type` is `"token"`. The key stays in that user's browser and goes only to Deepgram. Heard's key form stores it in browser storage so the user can reuse it. A small learning app can keep it in memory for one session.

Heard also supports a local server key. The server calls Deepgram's [token grant API](https://developers.deepgram.com/guides/fundamentals/token-based-authentication) to issue a short-lived JWT. The browser opens the socket with `"bearer"` and that JWT. [`POST /api/deepgram/token`](../apps/web/src/app/api/deepgram/token/route.ts) issues a 60-second token, and [`createTokenFetcher()`](../packages/shared/src/core/token.ts) gets a new token for each connection. An open socket can outlive the JWT. A reconnect needs a fresh one.

**Who pays:** the server's `DEEPGRAM_API_KEY` pays for every session that receives a server token. The token route has no sign-in. Keep the owner's key only in `apps/web/.env.local` for private local development. Leave `DEEPGRAM_API_KEY` unset on a public deployment so each visitor uses their own key. Keep the dev server bound to `127.0.0.1`. See the [repository rules](../AGENTS.md) before changing token access.

Start captions and open DevTools **Network**. You should see a connection to `wss://api.deepgram.com/v1/listen`. In own-key mode, there should be no `POST` to Heard's token route. Do not copy the WebSocket handshake or key into an issue, log, or screenshot.

## 5. Turn changing results into stable lines

Deepgram sends `Results` messages over the WebSocket. Read them in [`TranscriptAssembler`](../packages/shared/src/core/transcript.ts). The first alternative contains `transcript` and, on final results, word timestamps.

Treat the two result flags as separate facts:

- `is_final: false` gives you a live guess. Show it in the caption, but allow it to change.
- `is_final: true` gives you stable words. Add them to a pending transcript line.
- `speech_final: true` says Deepgram detected a pause. Commit the pending line.
- `UtteranceEnd` can close a pending line when a word gap is detected.

Start with one pending line and one interim caption:

```ts
if (message.type === "Results") {
	const text = message.channel.alternatives[0]?.transcript ?? "";
	if (message.is_final) {
		if (text) pending.push(text);
		interim = "";
		if (message.speech_final) commitPendingLine();
	} else {
		interim = text;
	}
	showCaption([...pending, interim].filter(Boolean).join(" ") || lastLine);
}
if (message.type === "UtteranceEnd") commitPendingLine();
```

Here, `commitPendingLine()` joins `pending`, saves the result as `lastLine`, adds one transcript line, and clears `pending`. The complete assembler uses final word timestamps, because transcript strings alone are not enough to remove overlap after a reconnect.

Do not wait for `speech_final` before keeping final words. A long stretch of speech can contain several final results before the speaker pauses. [Deepgram's guide to interim results and endpointing](https://developers.deepgram.com/docs/understand-endpointing-interim-results) shows why the flags serve different jobs.

Heard also commits at sentence boundaries once a line grows long. This came from a live test where continuous speech produced one oversized line. The assembler uses word timestamps to reject words it already finalized, including words Deepgram sends again after a reconnect. The caption can contain both final words waiting for a line break and the current interim guess.

Speak continuously for a while, then pause. You should see the caption update before the transcript line is complete. You should also see more than one readable line during a long monologue. Search for a word in the transcript to check that committed lines remain available after the caption changes.

Make one Deepgram change yourself. In [`WatchExperience.tsx`](../apps/web/src/app/watch/WatchExperience.tsx), add `deepgram: { keyterms: ["Deepgram", "Heard"] }` to the `TranscriptionSession` options. Restart captions and inspect the WebSocket URL in DevTools. You should see one `keyterm` parameter for each term. Use terms from the speech you expect, such as a person's name or a product name. Remove the example terms when you finish.

## 6. Keep timestamps tied to the video

Deepgram word times count seconds of audio sent to the stream. They are not the video's `currentTime`. The difference matters when the viewer pauses or seeks.

Record a pair of times for each chunk:

```ts
streamSeconds += pcm.byteLength / 2 / 16000;
timeMap.record(streamSeconds, player.getCurrentTime());
```

`pcm.byteLength / 2` counts 16-bit samples. Dividing by 16,000 gives the chunk's duration in seconds. Use the recorded pairs to turn each final word's stream time into a media position.

Heard records the player's current time as it sends each audio chunk. [`StreamTimeMap`](../packages/shared/src/core/time-map.ts) maps a Deepgram word time back to the media time. [`TranscriptionSession`](../packages/shared/src/core/session.ts) gives that map to the assembler, which adds `mediaStart` and `mediaEnd` to each line. The watch page uses `mediaStart` when you click a timestamp.

Pause the video. Heard stops sending audio but keeps the socket open with a JSON text `KeepAlive` about every three seconds. Deepgram [recommends KeepAlive during audio gaps](https://developers.deepgram.com/docs/audio-keep-alive). Resume playback and watch the transcript continue. Seek to another point and check that old caption text clears before new words appear. The web page calls `markDiscontinuity()` for that jump.

An extension that captions an arbitrary tab may have no player clock. In that case, keep stream timestamps and leave `mediaStart` null. The transcript still tells the reader when words arrived after capture began, but clicking a line cannot seek the source.

## 7. Reuse the core in a Chrome extension

Build the extension:

```bash
npm run build -w @heard/extension
```

Load `apps/extension/.output/chrome-mv3` from `chrome://extensions` with **Developer mode** enabled. Open a tab with speech, select the Heard toolbar icon, add your Deepgram key in the side panel's **Settings**, and turn **AI captions** on. You should see a `LIVE` badge, a caption box on the page, and transcript lines in the side panel.

The extension changes the capture and display surfaces, not the Deepgram pipeline:

1. [`background.ts`](../apps/extension/entrypoints/background.ts) receives the click and gets a tab capture stream ID.
2. [`offscreen/main.ts`](../apps/extension/entrypoints/offscreen/main.ts) opens that stream and starts the shared `TranscriptionSession`.
3. The offscreen document sends transcript events to the background script, caption box, and side panel.

Chrome's tab capture mutes normal tab playback. The offscreen document sets `preservePlayback: true`, so the audio graph routes captured sound back to the speakers. The service worker can sleep, so the offscreen document owns the live session. Only the captured tab receives caption text; the user's key stays inside extension storage and trusted extension messages.

The web app puts captions below an embedded YouTube player. YouTube's embedded player rules prohibit drawing them over it. Read the [provider policy notes](provider-policies.md) before changing caption placement or adding another provider.

## 8. Finish a session without losing its last words

Click **Stop captions** during speech. The last spoken words should still appear in the transcript. Heard stops capture, sends Deepgram `CloseStream` as a JSON text message, waits for the remaining final results, commits pending words, and then releases the media tracks. Closing the socket immediately had cut off the final words in the original build.

Network interruptions need another pass. [`TranscriptionSession`](../packages/shared/src/core/session.ts) buffers up to 15 seconds of recent audio, retries with exponential backoff, gets a fresh credential, and maps the new socket's timestamps onto one continuous stream timeline. The assembler drops overlapping final words. Test this by starting captions, briefly taking the browser offline, then reconnecting. You should see **Reconnecting**, followed by **Live** and continuing lines.

Run the project tests when you change capture, socket handling, or transcript assembly:

```bash
npm test
npm run typecheck
```

For an end-to-end Deepgram check with real audio, use the [live test instructions](../README.md#testing). The original build used that check to find the stop and line-length bugs. Unit tests alone did not show how the stream behaved with continuous speech.

You now have the reusable shape: get an audio track with permission, convert it to a known format, open a Nova-3 stream with a credential owned by the right person, and separate live caption guesses from committed transcript lines. Add a new player by implementing the provider adapter. Add another display surface by consuming the same transcript events.

