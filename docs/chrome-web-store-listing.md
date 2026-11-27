# Chrome Web Store listing reference

Use this text for the English listing. The manifest supplies the name and short description. The dashboard supplies the long description, privacy answers, and images. Keep the dashboard fields consistent with the [public privacy policy](../apps/web/src/app/extension/privacy/page.tsx).

## Product details

**Name:** Heard — Live AI Captions

**Short description:** Real-time AI captions and a searchable transcript for any video or audio playing in a tab. Powered by Deepgram Nova-3.

**Category:** Accessibility

**Long description:**

> Heard adds live captions and a searchable transcript to audio playing in the tab you choose. Start captions from the toolbar. Move or resize the caption box, then open the side panel to search, copy, or download the transcript as TXT, SRT, or VTT.
>
> Heard works on video, livestreams, podcasts, and other tab audio that Chrome allows you to capture. You can choose the spoken language and adjust caption size, color, and background. On supported Chrome versions, Chrome's built-in Translator can show captions in another language using a model on your device.
>
> You need a Deepgram API key. Add your own key in Settings; it stays in this browser and goes only to Deepgram. Deepgram bills usage to your account. A local Heard server can issue short-lived tokens instead if you choose to run one.
>
> When you start captions, Heard sends the selected tab's audio directly to Deepgram for transcription. Heard does not store transcripts or run on tabs you have not started. Read the privacy policy for details.
>
> Limits: one tab at a time; Chrome cannot capture protected media or restricted pages. Transcript timestamps count from the start of capture.

**Homepage and support:** https://github.com/blackgirlbytes/live-captions and https://github.com/blackgirlbytes/live-captions/issues

**Privacy policy URL after deployment:** https://live-captions-zeta.vercel.app/extension/privacy

## Privacy tab

**Single purpose:** Turn the audio of a user-selected tab into live captions and a transcript.

**Data disclosure:** Select the dashboard categories that cover tab audio and derived transcript text, the user's Deepgram API key, and the current tab's URL and title. In the current dashboard wording, review **Website content**, **Authentication information**, **Web browsing activity**, and **Personal communications**. Audio from a call may contain personal communications even though Heard does not identify or collect the participants. Recheck the exact category labels when submitting.

**Use and transfer:** Tab audio goes directly to Deepgram for transcription. The user-supplied API key goes only to Deepgram. The current tab's URL is checked locally to reject restricted pages; its title is shown locally in the interface. The transcript stays in extension memory until the relevant extension view closes. If the user has no key, the extension checks the configured Heard token server. That request contains no audio, transcript, or user key. Optional translation uses Chrome's built-in Translator on the device.

**Limited Use certification:** Confirm the shipped build matches the [Limited Use policy](https://developer.chrome.com/docs/webstore/program-policies/limited-use) before checking the dashboard certification boxes. The public privacy policy includes the required Limited Use disclosure.

## Permission justifications

| Permission | Dashboard explanation |
|---|---|
| `tabCapture` | Capture audio only from the tab where the user starts captions. |
| `offscreen` | Run audio capture and the Deepgram connection in an offscreen document because Manifest V3 service workers cannot host the needed media APIs. |
| `sidePanel` | Show the live transcript, search, downloads, and settings. |
| `storage` | Keep the user's Deepgram key and caption preferences in local extension storage. Transcripts are not stored there. |
| `activeTab` | Get temporary access to the chosen tab after the user invokes Heard. |
| `scripting` | Insert the caption box only into the tab being captioned. |

The manifest requests no host permissions and registers no always-on content script. The listing should not claim that Deepgram has zero retention; its practices depend on the user's Deepgram account and settings.

## Images and reviewer notes

Provide a 128 × 128 icon from `apps/extension/public/icon/128.png`. Capture at least one real 1280 × 800 or 640 × 400 screenshot of the extension with captions and the transcript panel visible. A second screenshot can show the key setup and caption settings. Do not include an API key or private transcript in an image. A 440 × 280 promotional tile is optional in the [current dashboard guide](https://developer.chrome.com/docs/webstore/cws-dashboard-listing); prepare one if you want a richer listing.

In **Test instructions**, say that reviewers can create their own Deepgram key at https://console.deepgram.com, then open the side panel, select **Settings**, and choose **Verify & save**. They can play a permitted video, click the Heard toolbar icon, and turn on **AI captions**. The publisher must decide whether review requires a dedicated test credential. Do not put any credential in this repository or in the public listing.

## Sources

- [Chrome Web Store listing fields](https://developer.chrome.com/docs/webstore/cws-dashboard-listing)
- [Chrome Web Store privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)
- [Chrome Web Store listing requirements](https://developer.chrome.com/docs/webstore/program-policies/listing-requirements/)
- [Chrome Web Store user data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)
- [Chrome Web Store image guidance](https://developer.chrome.com/docs/webstore/images)
