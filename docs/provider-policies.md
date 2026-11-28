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

## Twitch

Checked 2026-11-28 against:

- Embedding Twitch — https://dev.twitch.tv/docs/embed/
- Embedding Video and Clips — https://dev.twitch.tv/docs/embed/video-and-clips/

Not yet read: the Twitch Developer Services Agreement, which the embed docs point to. Read it
before a public deployment.

### Captions over the player: not allowed

Embed rule 1.3 says embeds "should not be obscured in any way by other page elements" and
must use only Twitch-approved player elements. So
`twitchProvider.capabilities.allowsCaptionOverlay = false`, and Twitch gets the same
treatment as YouTube: caption bar below the player, no "Over video" option, Heard's own
fullscreen wraps the untouched player plus the caption bar.

### Player size

Embedded players "must be at least 400x300 pixels"; `minPlayerSize` is 400×300 and the watch
page applies it as `min-width`/`min-height`. On screens narrower than 400px the page scrolls
sideways rather than shrinking the player below the minimum.

### `parent` and HTTPS

The player only plays on domains listed in `parent`; Heard passes `window.location.hostname`.
Twitch says embedding domains must use SSL. Tested 2026-11-28: the local dev server on
`http://127.0.0.1:3100` loads and plays a live channel, so local development needs no
certificate. Public deployments are HTTPS anyway.

### What the API supports

- Live channels (`channel`) and past broadcasts (`video`) through `Twitch.Player`.
- `getCurrentTime()` and `seek()` work only for past broadcasts. For live channels the adapter
  reports `hasTimeline() === false`, so transcript lines use capture time and aren't
  clickable.
- Clips only have a plain iframe with no JS API, so the web app turns clip links away and
  points to the extension.

### Open question: audio capture

Same as YouTube: Heard transcribes the tab's audio in the viewer's own browser, after Chrome's
tab-sharing prompt, and doesn't store or redistribute it. Whether Twitch's terms address this
hasn't been checked.

## LinkedIn Live, X Live, TikTok Live, Instagram Live

Checked 2026-11-28: none of these offers an official embed for live streams (LinkedIn and X
embed posts; TikTok's oEmbed covers videos and profiles, not LIVE; Instagram has no live
embed). The web app therefore doesn't play them. Pasted links get a message that links to the
stream on the platform's own site and to the extension
(`apps/web/src/lib/providers/extension-only.ts`). Never scrape, proxy or re-host these streams
to get around the missing embed.

The Chrome extension captions them on the platforms' own sites, the same way it does on
youtube.com: the viewer starts capture on their own tab, audio goes only to Deepgram, nothing
is stored or redistributed, and the caption box is drawn by the extension in the viewer's
browser (no embedded-player rules apply).

Open question: none of these platforms' terms have been reviewed for automated access or
transcription of stream audio. Review them, as for YouTube III.I.7, before naming the
platforms in the Chrome Web Store listing or a public announcement.
