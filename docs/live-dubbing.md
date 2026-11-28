# Live dubbing

Live dubbing lets you listen to a video or livestream in another language. Heard transcribes
the original speech, translates each finished phrase, and speaks it with a Deepgram Flux TTS
voice, while the captions keep working. Each speaker gets their own voice, lower or higher to
match how they sound. It is off by default and has to be switched on for
each session. It aims for a steady interpreter a few seconds behind the speaker. There is no
lip sync, voice cloning or music separation.

It runs in the **Chrome extension** only. The web player doesn't offer it (see
[Web platform](#web-platform)).

## Pipeline

```
tab audio ─► offscreen doc ─┬─► gain node (10% while dubbing) ─► speakers
                            └─► PCM worklet (full level) ─┬─► Deepgram Nova-3 /v1/listen (diarize while dubbing)
                                                          └─► SpeakerPitch (last 30 s)    │ final lines, one speaker each
side panel ◄──────── transcript-event broadcast ◄─────────────────────────────────────────┘
  DubPhrasePipeline: final lines → phrases (one speaker each) → Chrome Translator (on device), in spoken order
        │  port "heard-dub": { segment (with speaker), epoch }
        ▼
offscreen doc  DubOutput: VoiceCaster (speaker + pitch → voice)
                 ─► one FluxSpeaker (wss /v2/speak) per voice ─► DubPlayer (Web Audio, spoken order) ─► speakers
```

| Piece | Where | What it does |
|---|---|---|
| `TranscriptAssembler` | `packages/shared/src/core/transcript.ts` | With speaker labels on, starts a new line whenever the speaker changes and labels it `"<connection>:<speaker>"` (Deepgram numbers speakers per connection). |
| `SpeakerPitch` | `…/dubbing/pitch.ts` | Keeps the last 30 s of the 16 kHz audio sent for transcription. When a labelled line arrives, measures the pitch of its voiced frames (YIN) and keeps a running median per speaker. Only answers "how low or high"; nothing leaves the device. |
| `VoiceCaster` | `…/dubbing/cast.ts` | Picks a voice per speaker within the chosen accent: below 160 Hz a lower voice, otherwise a higher one, each speaker a different voice while the catalog has enough. Before any pitch is known it uses a placeholder, and it can revise that; after 2.5 s of voiced speech the voice is fixed. If the accent has no voice of the needed kind (Irish English has only a higher one), it borrows one from another accent of the language. After a reconnect relabels everyone, speakers get the same voices again in order of appearance. |
| `DubPhrasePipeline` | `packages/shared/src/core/dubbing/phrases.ts` | Takes **final** transcript lines only, so the dub never says something and then corrects it. Groups short fragments (holds up to 0.9 s, 2 s at most) into phrases, never across speakers, and translates them with the same cached on-device translators the captions use. Releases phrases in spoken order. Drops phrases older than 8 s and lines from before dubbing was turned on. |
| `FluxSpeaker` | `…/dubbing/flux-tts.ts` | One persistent `/v2/speak` socket per voice (the first lower and higher voice of the accent are opened as soon as dubbing is turned on so the first phrase doesn't wait for the handshake; other voices open on first use), reopened quietly when Deepgram closes an idle one (after 60 s) or after a seek. Each phrase is a turn (`Speak` + `Flush`). Audio frames are matched to phrases in order, using `SpeechStarted` / `SpeechMetadata`. Phrases that arrive while it's connecting, or beyond 20 turns a minute, are merged into one turn. It reconnects with backoff, and never re-sends a turn that may already have played. Flux has no "clear" message, so cancelling closes the socket. |
| `DubPlayer` | `…/dubbing/player.ts` | Schedules PCM back to back on one Web Audio clock, so phrases can't overlap. Voices synthesize in parallel, so a later phrase's audio waits until every earlier phrase has finished or been dropped; a phrase whose audio never comes is given up once it's too late. Skips a phrase whose first word would start more than 8 s after the original. Measures each phrase's delay. Suspends with the video. Never stores audio. |
| `DubOutput` | `…/dubbing/output.ts` | Speaker + player + the status the UI shows: Connecting, Listening, Translating, Playing dubbed audio, Reconnecting, Dubbing unavailable. Ignores repeated phrases. |
| `DubbingControls` | `packages/shared/src/react/DubbingControls.tsx` | Switch with a one-line status and delay, then language, an accent choice (only for English, Portuguese, German and Dutch), and a note on voices and cost. There's no voice picker: voices follow the speakers. Volumes are fixed (original 10%, dub 100%). In the extension it all lives in the side panel's Settings tab. |

### Why the work is split between the side panel and the offscreen document

Chrome's built-in Translator doesn't run in the offscreen document (it's used for captions in
the side panel for the same reason). Playback has to happen outside the captured tab, so that
`tabCapture` never records the dub. So the side panel translates, and the offscreen document
speaks. They talk over a long-lived port. **When the panel closes, the port closes and the
offscreen document turns dubbing off and restores the original audio**, so you're never left
with a ducked tab and no dub.

### Original audio

`chrome.tabCapture` mutes the tab, and Heard already plays the captured audio back through Web
Audio. That playback path now has its own gain node (`PcmCapture.setPlaybackVolume`). The
worklet reads the source before that gain, so Deepgram hears the same signal at 0% as at
100%. While dubbing, the original drops to a fixed 10%, so the dub is clearly on top while the
speaker's tone, music and other sounds stay faintly audible. The dub plays at full volume. Neither
is adjustable in the UI (your computer's volume moves both together).
It goes back to 100% when dubbing is turned off, when it fails for good, when the panel closes,
or when the session stops.

### Captions and transcript follow the dub

While dubbing is on, the captions on the video and the side panel's transcript switch to the
dubbing language, so what you read matches what you hear. In the transcript, the original
stays underneath each line. The caption language picker shows the dub's language with a note.
Picking a caption language there while dubbing (for example the spoken language, to read the
original while hearing the dub) overrides it until dubbing is turned off. Turning dubbing off
goes back to the saved caption language. Nothing extra is saved.

Captions translate line by line and the dub translates slightly larger phrases with the same
on-device translator, so the wording can differ a little. Captions show up about as soon as
the line is finalized, a couple of seconds before its dubbed audio. As with any change of
caption language, lines from before the switch stay as they were.

The override lives in the side panel (`useSession().setCaptionOverride`, set from
`sidepanel/App.tsx`), which already translates captions for the overlay.

### Keeping it current

- **Seek / new video:** the overlay content script watches the page's main `<video>` (play,
  pause, seeking, replaced). The background also watches the captured tab's URL. Either one
  clears the dub. Every clear bumps an *epoch*. Phrases carry the epoch they were translated
  under, so a phrase that was still being translated during a seek is dropped when it arrives.
- **Pause:** the dub's audio clock is suspended while the video is paused. Paused time doesn't
  count toward the 8-second limit.
- **New language or accent:** queued and in-flight speech is dropped.

### Authentication and cost

Speech synthesis uses the same credential as the captions session: the user's own key (`token`
subprotocol) or a 60-second JWT from the Heard server's token endpoint (`bearer`). There are no
new endpoints or permissions. While dubbing is on, speech-to-text also asks for speaker labels
(`diarize=true`), a Deepgram add-on (about $0.002 per minute at the time of writing; check
[deepgram.com/pricing](https://deepgram.com/pricing)). Turning dubbing on or off reconnects
speech-to-text once to switch it, buffering the audio in between. **Dubbing is billed as Deepgram TTS** (per 1,000 characters of
translated text) on top of speech-to-text, to whichever key the session uses. On a server with
`DEEPGRAM_API_KEY`, that's the server owner (see [AGENTS.md](../AGENTS.md)). The UI says
that dubbing costs extra.

### Languages, accents and voices

A dubbing language has to work for every stage: Chrome's translator can produce it, and Flux
TTS has a voice for it (`DUB_LANGUAGES` / `DUB_VOICES` in `voices.ts`, from
[Deepgram's voice catalog](https://developers.deepgram.com/docs/flux-tts/voices)). That's 35
languages. English, Spanish, French, German, Portuguese, Italian, Dutch, Japanese, Hindi,
Russian, Korean and Chinese have several voices. The Early Access languages have one voice each
and no text normalization, so numbers are read as written. "Chinese (Traditional)" uses the
Taiwanese Mandarin voices.

Accents are stored as region codes on the voices (`US`, `GB`, `IE`, `AU`, `IN`, `BR`, `PT`, `DE`,
`CH`, `NL`, `BE`, …) and shown with the browser's region names in the interface language.

**Limits of matching voices to speakers:**
- Live speaker labels are less reliable than labels on a finished recording. Similar voices can
  be merged, one person can be split in two, and people talking over each other get one label.
  A voice can change mid-conversation when that happens.
- Pitch isn't gender, and voices overlap: expect an occasional lower voice for a higher speaker
  or the other way around. Music under the speech can also pull the estimate.
- The Early Access languages have one voice, so everyone sounds the same there.
- After a speech-to-text reconnect, labels restart. Voices are handed out again in order of
  appearance, so they usually come back the same.

## Web platform

The web player can't dub without breaking a rule, so it doesn't:

- It captures **its own tab** with `getDisplayMedia`. Anything the page plays, including a
  dubbed voice, would be captured and transcribed again. Chrome's `restrictOwnAudio`
  constraint only filters *system-audio* capture, not tab capture.
- The YouTube player is a cross-origin iframe. Its volume is applied **before** capture, so
  turning the original down would also silence the captions, and its audio can't be routed
  through Web Audio.

So the web player has no dubbing option at all. Point people who want dubbing to the extension
instead (for example in its pitch on the home page). A possible future route is
playing the dub from a separate popup window (another tab, so it isn't captured), but the
original audio still couldn't be lowered.

## Measured performance

`apps/extension/scripts/e2e-dubbing.mjs`, installed Chrome 158, a fresh profile, an English
YouTube video dubbed into Spanish (`flux-carmen-es`). This run was made with an earlier build that
still let the original go to 0%, so it also shows that captions work with the original silent:

| | Result |
|---|---|
| First dubbed audio after turning dubbing on | 13.6 s. This includes Chrome downloading the en→es translator in the fresh profile; two phrases were skipped as stale while it did. |
| Delay per phrase (finalized original → dub starts), 3 phrases | median 2.6 s, max 5.1 s |
| Captions during dubbing with original at 0% | kept arriving (5 lines in 40 s; this video has long sentences) |
| Feedback loop (video muted while dub plays) | no new transcript lines |
| Dubbing off → state off | 0.5 s |

The Flux TTS socket alone (`npm run test:live:tts -w @heard/shared`): first audio about
165–180 ms after a phrase is sent on the pre-warmed connection, versus 0.3–0.7 s when the
connection has to be opened first.

Delay is measured from when speech-to-text *finalizes* a line, not from the first word. Long
utterances are only finalized once they end, so the time from the first original word to the
dub is longer by about that line's length. Spanish usually takes longer to say than English,
and Flux TTS speed control is documented for English voices only. So with fast, continuous
speech the queue builds up, and the 8-second rule skips phrases to stay close to live.

## Tests

- `packages/shared/test/dubbing.test.ts`: languages, accents and voices, pitch measurement,
  voice casting per speaker (lower/higher, per accent, locking, after a reconnect), phrases split
  by speaker, ordered playback across voices, phrase grouping, spoken order,
  stale and duplicate phrases, auth subprotocol, turn → phrase mapping, turn budget merging,
  reset, rejected key, reconnect without re-sending, gapless scheduling, stale skipping, pause,
  clear, and status transitions.
- `packages/shared/test/transcript.test.ts`: lines split and labelled by speaker.
- `packages/shared/test/live.flux-tts.test.ts` (needs `DEEPGRAM_API_KEY`): real `/v2/speak`
  with a key and with a granted JWT.
- `packages/shared/test/live.speakers.test.ts` (needs `DEEPGRAM_API_KEY`,
  `npm run test:live:speakers -w @heard/shared`): a two-person conversation made with Flux TTS,
  streamed through real speech-to-text with speaker labels. Measured: both speakers labelled
  correctly on every line, 119 Hz and 217 Hz, cast to a lower and a higher Spanish voice.
- `apps/extension/scripts/e2e-dubbing.mjs` (needs `E2E_USER_KEY`, a built extension, and
  installed Chrome): the full extension flow above, plus speaker labels while dubbing and
  captions/transcript following the dub language and going back when it's off.
