# Provider policies

Heard embeds third-party players. Each provider's terms decide where captions may be
drawn; the result is encoded in `capabilities` on the provider
(`apps/web/src/lib/providers/*`), and the watch page follows it.

## YouTube

Checked 2026-11-26 against:

- Required Minimum Functionality — https://developers.google.com/youtube/terms/required-minimum-functionality
- YouTube API Services Developer Policies — https://developers.google.com/youtube/terms/developer-policies

### Captions over the player: not allowed

Required Minimum Functionality, "Overlays and frames":

> "You must not display overlays, frames, or other visual elements in front of any part of a YouTube embedded player"

So `youtubeProvider.capabilities.allowsCaptionOverlay = false`:

- Captions render in a caption bar **directly below** the player (same `CaptionText`
  component and the user's caption settings).
- The "Over video" placement option in caption settings is hidden for YouTube; a stored
  `position: "overlay"` is ignored.
- Our own controls (caption settings, transcript download menu) open below the stage, and in
  fullscreen the settings open as a side sheet that shrinks the player instead of covering it.
  The one-time "how to share this tab" dialog is a transient modal over the whole page.
- When the player reports an error we hide the player entirely and show our message in its
  place (rather than drawing on top of it).

### Player size

> "Embedded players must have a viewport that is at least 200px by 200px."

The player is 16:9 and full-width with `min-width: 200px; min-height: 200px`. YouTube also
recommends (not requires) at least 480×270 for 16:9 players; the desktop layout exceeds that.

### Player changes / fullscreen

> "You must not make changes to the YouTube player that are not explicitly described by the API documentation."

We only use documented `playerVars` (`fs=0`, `playsinline=1`, `rel=0`, `start`, `enablejsapi`,
`origin`) and documented player methods. YouTube's own fullscreen is turned off with `fs=0`;
Heard's fullscreen button fullscreens a container that holds the untouched player plus the
caption bar underneath it, so captions stay visible.

### Open question: audio capture

Developer Policies III.I.7 says you must not "separate, isolate, or modify the audio or video
components of any YouTube audiovisual content". Heard analyses the tab's audio output with
the user's explicit permission (Chrome's tab-sharing picker) to produce captions; it doesn't
store, replay or redistribute audio, and the video keeps playing unmodified in YouTube's
player. Whether live transcription of tab audio counts as "isolating" audio is not addressed
explicitly by the policy; a hosted, public deployment should review this with counsel. The
Chrome extension (captions on youtube.com itself, no embed) is not subject to the embedded
player rules above.

### Errors

IFrame `onError` codes are mapped to friendly messages in
`apps/web/src/lib/providers/youtube/index.ts`: 2 (invalid id), 5 (HTML5 player error),
100 (removed/private), 101/150 (embedding disabled → "Open on YouTube" + Heard extension).
