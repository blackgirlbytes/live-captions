# Plan: supporting more streaming platforms

Covers Twitch, LinkedIn Live, X (Twitter) Live, TikTok Live and Instagram Live.

## Progress (2026-11-28)

| Item | State |
|---|---|
| Track 3: other links point to the extension | Done. `providers/extension-only.ts`, translated in all six languages, tested in `apps/web/test/providers.test.ts` |
| Track 2: Twitch provider | Done. `providers/twitch/`. Live channel tested in the browser on `127.0.0.1:3100`; parse tests added. Twitch Developer Services Agreement still unread. |
| Track 1.2 portrait video | Done in `apps/extension/utils/video-geometry.ts` (generic rule, no per-site code), with tests |
| Track 1.3 muted hint | Done: the caption box says to unmute when the main video plays muted |
| Track 1.4 main-video pick | Done: playing + audible + near the center wins; tested |
| Track 1.6 policy notes | Done in `docs/provider-policies.md` |
| Track 1.1 manual pass on the five sites | **Not done.** Needs the unpacked extension in a real Chrome; checklist is in `apps/extension/README.md` |
| Track 1.5 store listing copy | **Not done** on purpose: wait for 1.1 and the terms review before naming platforms in the listing |

Heard runs in two places, and each needs different work:

| Surface | How it captures | What a new platform needs |
|---|---|---|
| **Chrome extension** (`apps/extension`) | `tabCapture` on whatever tab you're on. The caption box attaches to the page's largest `<video>`. | Usually nothing in capture or transcription. Test the overlay on each site and fix what breaks. |
| **Web app** (`apps/web`) | Embeds the provider's player and captures the tab with `getDisplayMedia`. | An official, embeddable player and a `VideoProvider` in `apps/web/src/lib/providers/`. |

## Summary

| Platform | Extension | Web app | Why |
|---|---|---|---|
| Twitch | Test and polish | **Add a provider** | Official `Twitch.Player` JS API for live channels and VODs |
| LinkedIn Live | Test and polish | Not supported. Point to the extension | No official live embed |
| X Live | Test and polish | Not supported. Point to the extension | X embeds posts, not broadcasts |
| TikTok Live | Test and polish (vertical video) | Not supported. Point to the extension | oEmbed covers videos and profiles, not LIVE |
| Instagram Live | Test and polish (vertical video) | Not supported. Point to the extension | No public live embed |

So the work has three tracks. Each one can ship by itself:

1. **Extension: verify and harden on all five sites** (biggest reach, least code).
2. **Web app: Twitch provider** (the only new embed).
3. **Web app: recognize the other four links** and send people to the extension instead of
   "Heard doesn't recognize that link".

---

## Track 1: Extension on all five platforms

No permission changes. The extension keeps its minimal permission set (`tabCapture`,
`offscreen`, `sidePanel`, `storage`, `activeTab`, `scripting`, no host permissions), which
`verify-store-package.mjs` enforces. Don't add per-site host permissions or always-on content
scripts for this work.

### 1.1 Manual test pass

Add one section per platform to the manual checklist in `apps/extension/README.md`, matching
the existing "YouTube livestream" section:

| Platform | Test URL shape | Notes |
|---|---|---|
| Twitch | `twitch.tv/<channel>` (live), `twitch.tv/videos/<id>` (VOD) | Theater mode, fullscreen, ads at the start (separate `<video>`?), channel raids that navigate in-page |
| LinkedIn Live | `linkedin.com/events/...`, `linkedin.com/video/live/urn:li:ugcPost:...`, live post in the feed | The feed has many `<video>`s; check the box picks the live one. Autoplay starts muted. |
| X Live | `x.com/i/broadcasts/<id>`, live post in the timeline | Starts muted; the broadcast page has chat beside the video |
| TikTok Live | `tiktok.com/@<user>/live` | 9:16 video, comments and gifts drawn over the video |
| Instagram Live | `instagram.com/<user>/live` (desktop web, signed in) | 9:16 video, comments drawn over the video |

For each one, check:

- [ ] Captions start after clicking the toolbar icon; `LIVE` badge shows.
- [ ] Caption box sits on the right video and follows it when scrolling or changing layout.
- [ ] Fullscreen (the site's own button): the box stays visible.
- [ ] Clicks on the player and page outside the box still work.
- [ ] Muted player: we show a clear hint instead of silently producing nothing (see 1.3).
- [ ] In-page navigation to another stream: captions keep flowing or stop cleanly.
- [ ] Stop: badge clears, no leftover overlay.

### 1.2 Vertical video (TikTok, Instagram)

`onVideo()` in `apps/extension/entrypoints/overlay.content/Overlay.tsx` sizes the box at 82% of
the video's width, with a `MIN_WIDTH` floor, and scales the font by video height. On a narrow
9:16 player this can overflow the frame or produce very large text.

- Detect portrait video (`height > width`).
- Base font scale on width for portrait video, and allow the box to be wider than the video
  when needed, centered on it.
- Consider placing the box above the bottom ~25% of the frame, where TikTok and Instagram draw
  comments and the input bar.

### 1.3 Muted playback hint

X, LinkedIn and Instagram autoplay muted. Tab capture then records silence and the user sees
no captions. Ideas, cheapest first:

- If Deepgram returns nothing for N seconds and the main `<video>` has `muted` or
  `volume === 0`, show "Unmute the video to get captions" in the caption box.
- This only reads the `<video>` element the overlay already tracks; no new permissions.

### 1.4 Main-video detection

`findMainVideo` picks the largest visible `<video>`, playing ones first. Feeds (LinkedIn, X)
can contain several playing previews. If testing shows wrong picks, prefer the video that has
audio (not muted) and is closest to the viewport center. Keep it generic; avoid per-site
selectors unless a site truly needs one.

### 1.5 Copy and store listing

- Extension README intro already says it isn't site-specific; add the five platforms as
  examples.
- Review `docs/chrome-web-store-listing.md` and `public/_locales/*/messages.json` for
  YouTube-only wording. Store copy must not claim affiliation with any platform; naming them
  as examples ("works on Twitch, LinkedIn Live, …") is fine but check each brand's naming
  rules before it goes into the listing.

### 1.6 Policies

Add a short section per platform to `docs/provider-policies.md` covering the extension
use-case (user's own browser, user-initiated tab capture, nothing stored or redistributed),
the same way the YouTube section covers it. Note any terms that mention automated access or
recording, so the owner can decide before a store release.

---

## Track 2: Twitch provider for the web app

Source: [Twitch: Embedding Video and Clips](https://dev.twitch.tv/docs/embed/video-and-clips/),
[Twitch: Embed overview](https://dev.twitch.tv/docs/embed/).

### 2.1 What Twitch offers

- `Twitch.Player` JS API (`https://player.twitch.tv/js/embed/v1.js`) for **live channels**
  (`channel`) and **VODs** (`video`, `v`-prefixed id).
- Methods: `play()`, `pause()`, `seek()`, `getCurrentTime()`, `getEnded()`, `getChannel()`,
  `getVideo()`.
- Events: `READY`, `PLAY`, `PLAYING`, `PAUSE`, `ENDED`, `ONLINE`, `OFFLINE`,
  `PLAYBACK_BLOCKED`, `SEEK`.
- `getCurrentTime()` and `seek()` **work only for VODs**, not live streams.
- **Clips** (`clips.twitch.tv/...`, `twitch.tv/<ch>/clip/...`) only have a plain iframe with no
  JS API.

### 2.2 Rules that shape the design

| Rule | Effect on Heard |
|---|---|
| Embeds "should not be obscured in any way" (rule 1.3) | `allowsCaptionOverlay: false`. Captions go in the bar below the player, as for YouTube. |
| "Must utilize only Twitch-approved player elements" | Don't hide or restyle Twitch's controls. Heard's fullscreen wraps player + caption bar, like YouTube. |
| Minimum 400×300 | `minPlayerSize: { width: 400, height: 300 }`. Check the mobile/narrow layout honors it. |
| `parent` must list the embedding domain | Pass `window.location.hostname`. Verify `127.0.0.1` works for local dev. |
| HTTPS required | Fine for deployments; check local dev over HTTP on loopback. If Twitch refuses it, document the workaround. |

Read the Twitch Developer Services Agreement before shipping and record the findings in
`docs/provider-policies.md` under a new "Twitch" section.

### 2.3 Implementation

New files, following `providers/youtube/`:

```
apps/web/src/lib/providers/twitch/
  embed-api.ts   # load player.twitch.tv/js/embed/v1.js once, typed Twitch.Player
  parse.ts       # URL → ParsedVideo | ParseProblem
  index.ts       # twitchProvider: capabilities, parse, mount → PlayerAdapter
```

Register it in `PROVIDERS` in `apps/web/src/lib/providers/index.ts` and update the
"doesn't recognize that link" message and the `UrlForm` placeholder / i18n strings.

**Parsing**

| Input | Result |
|---|---|
| `twitch.tv/<channel>` | live channel, `maybeLive: true` |
| `twitch.tv/videos/<id>` (`?t=1h2m3s`) | VOD, `startSeconds` from `t` |
| `m.twitch.tv/...`, `www.twitch.tv/...` | same as above |
| `twitch.tv/<channel>/clip/<slug>`, `clips.twitch.tv/<slug>` | `ParseProblem`: clips aren't supported yet (no JS API); suggest the extension |
| `twitch.tv/directory/...`, `/settings`, other reserved paths | `null` or `ParseProblem` |

**Adapter**

- `getCurrentTime()`: for VODs, the player's time. For live, return a value the watch page
  treats as "no media time" so transcript lines aren't seekable. `StreamTimeMap` and
  `getMediaTime` already accept `null`; check `WatchExperience.tsx` handles a provider that
  never reports live time (the YouTube live path reports a DVR time instead).
- `seekTo()`: VOD only; no-op for live.
- `isLive()`: true when `channel` was used and the stream is `ONLINE`.
- `getState()`: map `PLAY`/`PLAYING` → playing, `PAUSE` → paused, `ENDED`/`OFFLINE` → ended.
- `getTitle()`: channel name or VOD id (the embed API doesn't expose titles; don't add the
  Helix API, which needs a client id).
- Errors: `OFFLINE` at start → friendly "This channel isn't live right now" with
  "Open on Twitch"; `PLAYBACK_BLOCKED` → prompt to press play.

**Content Security Policy:** if `apps/web/src/proxy.ts` or `next.config.ts` sets a CSP, allow
`player.twitch.tv` (script + frame) and `embed.twitch.tv`.

### 2.4 Tests

- Unit tests for `parse.ts` (all URL shapes above, `t=` parsing, clips, reserved paths).
- Extend `apps/web/scripts/e2e.mjs` with an optional Twitch VOD run (live channels are
  unpredictable in CI).
- Manual: one live channel, one VOD with `?t=`, one offline channel, one clip link.

---

## Track 3: Recognize the other links in the web app

LinkedIn Live, X Live, TikTok Live and Instagram Live have no official embed, so the web app
can't play them. Today a pasted link gets the generic "doesn't recognize that link" message.

Add parse-only providers (or one `externalOnly` list) that match these hosts and return a
`ParseProblem` with a clear message, for example:

> "LinkedIn Live can't be embedded here. Open it on LinkedIn and use the Heard Chrome
> extension to caption it."

with an "Open on LinkedIn" link and the extension install link. Hosts to match:
`linkedin.com`, `x.com` / `twitter.com`, `tiktok.com`, `instagram.com`.

Don't scrape, proxy or re-host any of these streams to get around the missing embed.

---

## Order of work

1. **Track 1.1** test pass on all five sites. Record what breaks.
2. **Track 3**: small, and immediately improves the web app's message.
3. **Track 1.2–1.4** fixes for whatever 1.1 found (vertical video likely).
4. **Track 2** Twitch provider, after reading the Twitch Developer Services Agreement.
5. **Track 1.5–1.6** copy, store listing and policy doc updates, before the next store
   release.

## Out of scope for now

- Twitch clips on the web app (no JS API).
- Mobile apps for any platform (no tab capture on mobile browsers).
- Using platform APIs that need sign-in or a client id (Twitch Helix, X API, Meta Graph).
- Changing who pays for Deepgram usage: the `DEEPGRAM_API_KEY` rules in `AGENTS.md` apply
  unchanged to every platform.

## Open questions

- ~~Does Twitch's `parent` check accept `127.0.0.1` over HTTP for local dev?~~ Yes: a live
  channel loaded and played on `http://127.0.0.1:3100` (2026-11-28).
- Do any of the five platforms' terms restrict capturing or transcribing a stream's audio in
  the viewer's own browser? (Same open question as YouTube Developer Policy III.I.7.) Still
  open; needs someone to read the terms, ideally counsel before a public launch.
- Is the generic portrait-video rule enough to keep captions clear of TikTok's and
  Instagram's comments? Decide during the Track 1.1 manual pass; add a per-site tweak only if
  it isn't.
