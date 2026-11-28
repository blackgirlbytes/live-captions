# Build a live captions app by prompting an agent

In this tutorial, you prompt a coding agent to build a live captions app like [Heard](https://github.com/blackgirlbytes/live-captions). The app is a web video player and a Chrome extension. Both turn a browser tab's audio into live captions and a searchable transcript with [Deepgram Nova-3](https://developers.deepgram.com/docs/models-languages-overview) streaming speech-to-text.

Heard was built with Claude Code and Codex. The prompts in this tutorial come from those sessions. The original build took many rounds of feedback, so most prompts here combine several real messages into one. Each step has a **What I actually sent** section with the original messages, lightly cleaned up.

You need:

- A coding agent that can run commands and edit files, such as [Claude Code](https://claude.com/claude-code) or [Codex](https://openai.com/codex).
- Node.js 20 or later, npm, and desktop Chrome or Edge.
- A [Deepgram API key](https://console.deepgram.com).
- A chat model, such as ChatGPT or Claude, to draft the spec.

## 1. Write the spec in a chat model

Before you open the coding agent, write a spec with a chat model. Describe the product, the audience, the build order, and the rules the agent must not break. Ask the chat model to turn that description into a structured spec.

The [Heard kickoff spec](prompts/kickoff-spec.md) was drafted in ChatGPT. Read it before you write your own. These parts did the most work in the build:

- **Implementation order.** Build the web app first, then the extension. Get one working caption before any search, download, or design work.
- **Development requirements.** "Do not use mocked transcripts" and "Do not create nonfunctional UI controls" stop the agent from faking a demo.
- **Future considerations.** Translation and other video providers are listed as later work. The agent kept the code open for them without building them early.
- **Security.** "Keep permanent Deepgram API credentials server-side" set up the token design in step 3.

You should have one document of about 160 lines.

Why a separate chat model: a spec is a thinking task, not a coding task. A chat model is faster for rewrites, and the coding agent starts with a complete brief instead of a request that grows over many turns.

## 2. Hand the spec to the agent

Install the Deepgram skills in your project. A skill is a folder of instructions and reference files that the agent loads when a task needs it. The Deepgram skills include the current API reference, the JavaScript SDK, and working examples.

```bash
npx skills add deepgram/skills -a claude-code
```

```bash
npx skills add deepgram/deepgram-js-sdk -a claude-code
```

For another agent, change the `-a` value to that agent's name. Then open the agent in an empty folder and send this prompt with your spec pasted below it:

```text
Install and use the Deepgram skills: https://github.com/deepgram/skills

Use subagents to handle the tasks in parallel when possible. Once the skills are installed, use them to build the following:

<paste the spec>
```

The agent reads the speech-to-text skills, then splits the work. In the original session, one subagent built the Next.js web app and another built the WXT Chrome extension at the same time. Both used one shared transcription package.

When the agent finishes, start the web app:

```bash
npm run dev:web
```

Open `http://localhost:3100`, paste a YouTube URL, and select **Start captions**. Share the tab with audio. You should see words appear and change in the caption bar while someone speaks. After a pause, the transcript gets a line with a timestamp.

Why the skills matter: an agent that writes Deepgram code from memory can use old SDK calls or wrong parameter names. With the skills, the agent reads the current docs first. The first working build used these Nova-3 settings in [`packages/shared/src/core/deepgram.ts`](../packages/shared/src/core/deepgram.ts):

| Parameter | What it does in Heard |
|---|---|
| `model=nova-3` | Uses Deepgram's streaming model for general speech. |
| `interim_results=true` | Sends partial text while the speaker is mid-sentence, so the caption changes live. |
| `smart_format=true` | Returns punctuation, numbers, and capitals, so the app does no cleanup. |
| `endpointing=300` | Marks speech as final after 300 ms of silence. The transcript breaks at natural pauses. |
| `utterance_end_ms=1000` | Sends an `UtteranceEnd` message after one second without words. Heard commits the line even when background noise keeps the audio from going silent. |
| `vad_events=true` | Tells the app when speech starts. |
| `keyterm` | Boosts names and jargon, so Deepgram spells them correctly. The session code accepts a `keyterms` list, but the UI doesn't set one yet. |

Commit: [`0374470`](https://github.com/blackgirlbytes/live-captions/commit/0374470)

## 3. Ask who pays for Deepgram

The first build worked, but the spec never gave the agent an API key. Ask the agent where its key came from before you share anything.

```text
I didn't give you a Deepgram API key. How were you able to make this work?

If I deploy this, I don't want to pay for other people's Deepgram usage. What's the smoothest way to solve this? Maybe people enter their own key when the app opens.

Build it. Then write the rule in an AGENTS.md so every agent in this repo follows it.
```

The agent explains how the app got a key, adds a key dialog, and writes [`AGENTS.md`](../AGENTS.md). Open the app without a server key. You should see a dialog that asks for your own Deepgram key.

Why this matters: an agent that can't find a credential may search nearby folders for one. Ask how the app authenticates as soon as it works. `AGENTS.md` keeps the answer for later sessions, and other agents read it too. Codex sessions in this repo loaded the same rules the next day without being told.

The app now has two ways to reach Deepgram:

- **Server key.** The Next.js route [`/api/deepgram/token`](../apps/web/src/app/api/deepgram/token/route.ts) calls Deepgram's `POST /v1/auth/grant` endpoint. Deepgram returns a token that expires in 60 seconds. The browser uses the token to open the WebSocket and never sees the permanent key.
- **Bring your own key.** The user's key stays in their browser and goes only to Deepgram. Each user pays for their own usage.

<details>
<summary>What I actually sent</summary>

- "You know, I didn't give you a Deepgram API key. How were you able to make this work?"
- "What if I want people to be able to use this in the future, and I deploy it, but I don't want to pay for their Deepgram usage? What's the smoothest way to solve this? Do I have them input a key when the app opens?"
- "Yes, build it."
- "And what do you mean by 'keep your server key optional'? Does this mean that a user may be able to use my API key?"
- "Can you make that rule in an AGENTS.md? I think I still don't really understand, though."

</details>

Commit: [`4689922`](https://github.com/blackgirlbytes/live-captions/commit/4689922)

## 4. Push to GitHub and deploy

Send two short prompts:

```text
Create a GitHub repo for live captions and push the changes there.
```

```text
Let's deploy on Vercel.
```

You should get a public URL. Open it. The app asks for your Deepgram key because the deployment has no server key.

Why it worked with two lines: the rules from step 3 were already in `AGENTS.md`. Rule 1 says never to set `DEEPGRAM_API_KEY` on a public deployment, and the agent deployed without it. You didn't have to repeat the rule.

Commit: [`000a297`](https://github.com/blackgirlbytes/live-captions/commit/000a297)

## 5. Fix the design with a reference and options

The first landing page worked, but it looked generated. Give the agent a reference, a design skill, the parts to keep, and a request for options.

```text
The landing page looks AI-generated. Point out the AI patterns first, then remove all em dashes.

Then take concepts from this design: <link to a reference design>. I want its layout and animation, not a word-for-word copy. Keep our dark black theme. Use the frontend-design skill. Avoid double borders, off-center elements, and oversized parts.

The hero should fill the screen. "How it works" and "Privacy" should be tabs that replace the hero, not sections below it. Use subagents to make the app examples in the hero interactive.

Show me 7 layout options for the demo, and I'll pick one.
```

Send screenshots with each round of feedback. Circle the problem when you can. You should get a running page and a set of options you can compare in the browser.

Why this shape of prompt: "make it better" gives the agent nothing to aim at. A reference shows the target, the skill gives design rules, and "keep the dark theme" stops it from throwing away work you like. Asking for seven options turns several rounds of "I still don't like it" into one choice. In the original build, that request ended the layout debate with "7 Diagonal".

<details>
<summary>What I actually sent</summary>

These messages came over several sessions:

- "The landing page is super AI-generated. It uses em dashes and has a ton of AI smells. Can you point them out?"
- "For now, just remove all em dashes."
- "I want to take concepts from this design and apply it to Earshot."
- "It looks messy. Please use the frontend design skill. Uncentered, double-layered borders, some things are too big. I was more interested in the animation and layout that the design had. I didn't want to copy it word for word. I liked the dark black vibe we had going on. The spacing is bad. This was super lazy."
- "This should be full screen, and 'How it works' shouldn't be a scroll down but should act as tabs replacing the hero. Also run subagents to make the examples of the app in the hero on the right interactive!"
- "Poorly balanced. I liked when they were a little tilted. Also, can these elements show up one at a time?"
- "No, show me different options, like 7, and then I'll choose one. I prefer a more vertical and tilted look."

</details>

Commits: [`b22bf39`](https://github.com/blackgirlbytes/live-captions/commit/b22bf39), [`8605cfc`](https://github.com/blackgirlbytes/live-captions/commit/8605cfc), [`e4d657b`](https://github.com/blackgirlbytes/live-captions/commit/e4d657b)

## 6. Narrow the product to live streams

Tell the agent who the product is for and which examples prove it.

```text
Right now we present this as captions for any video, but my goal is live streams. Change the hero to say that.

The example videos are wrong. Lofi Girl has no speech, so it doesn't need captions. A recorded TED talk already has generated captions. Use streams where people talk the whole time, like Miss Rachel's channel, which always has a stream going.

Also rename the app from Earshot to Heard everywhere.
```

You should see a new headline and demo videos with nonstop speech.

Why this matters: an agent can't know your product's point. It picks safe, popular examples. Recorded video on YouTube usually has captions already, so the real gap is live streams. Nova-3 streaming fits that gap because it returns text while the stream plays.

<details>
<summary>What I actually sent</summary>

- "Right now we show this as any video can get captions added, but my goal is more streamed video. First off, the example videos it has are not good. Lofi Girl has no actual words, so it wouldn't need captions, and the TED talk video is already recorded and should already have generated captions, so we don't want that. Also the title on the main hero, 'Live AI captions for any video.' Maybe it should be more 'live transcription for any stream'?"
- "Miss Rachel always has a stream going, and they're talking a lot. We should also show supported platforms."
- "This app should be called Heard, not Earshot."

</details>

Commits: [`7235d5f`](https://github.com/blackgirlbytes/live-captions/commit/7235d5f), [`817fb72`](https://github.com/blackgirlbytes/live-captions/commit/817fb72)

## 7. Plan a feature before you build it

For a feature that touches the web app and the extension, ask for a plan first. Then ask what the plan misses.

```text
Make a plan for customizable captions. Subagents can work together.

What am I leaving out?
```

Review the plan and cut what you don't want. Push back when an answer looks shallow:

```text
You don't have to use this approach, but it shows you didn't search hard enough. Search for the best option.
```

Language support came out of this review. Ask the agent how Deepgram handles languages before you decide:

```text
Is it already using language=multi? Can Deepgram translate, or only transcribe?
```

Then build it:

```text
Use Deepgram for any spoken language. If someone speaks Spanish and wants Spanish captions, caption it directly. If they want English captions, use Chrome's built-in Translator API.
```

You should see a language setting. Play a Spanish stream with captions set to Spanish, then to English. Both should show live captions.

Why this split: with `language=multi`, Nova-3 detects the spoken language and follows a speaker who switches languages. Deepgram returns the words as spoken. It doesn't translate. Chrome's Translator API runs on the user's device, so translation adds no server and no extra cost. The setting lives in [`packages/shared/src/core/settings.ts`](../packages/shared/src/core/settings.ts).

<details>
<summary>What I actually sent</summary>

- "Let's make a plan for customizable captions. Subagents can work together."
- "What are things I'm leaving out?"
- "Everything except line spacing and all-caps or sentence case."
- "You don't have to use this approach, but it's proof you didn't search hard enough. Search for the best option."
- "I don't understand. So Deepgram can write in different languages but not translate?"
- "Is it already doing language=multi?"
- "OK, let's implement Deepgram for any language. For example, someone is speaking Spanish and wants Spanish captions. And use Chrome's built-in Translator API for when someone is speaking Spanish but wants English captions."
- "Make a plan for doing this." then "Let's add that language support for the extension using the plan you made."

</details>

Commits: [`5f6ac33`](https://github.com/blackgirlbytes/live-captions/commit/5f6ac33), [`8ddc545`](https://github.com/blackgirlbytes/live-captions/commit/8ddc545)

## 8. Install the extension yourself and report what breaks

Follow your own setup instructions as a new user. Load the extension in Chrome and use it on a live stream. Paste each error and each confusing moment back to the agent.

```text
I followed the extension setup and hit this error:

<paste the terminal output>

Will other users get this issue? I also couldn't find apps/extension/.output/chrome-mv3. Only Cmd+Shift+G worked for me. Add tabbed setup instructions for Windows, Mac, and Linux, like documentation sites do. Show each command in a terminal box people can copy.
```

```text
When I click the extension or turn on captions, open the side panel right away. The captions are too small. In the extension, they should sit on top of the video, not in the middle of the page over the video title.
```

You should see setup tabs for each operating system on the site, and captions over the video in the extension.

Why this matters: the agent tests in its own browser. It doesn't get stuck on a hidden folder, and it doesn't notice captions that cover a video title. You find these problems only when you use the app the way a new user does.

<details>
<summary>What I actually sent</summary>

- "Can't find apps/extension/.output/chrome-mv3."
- "Only Cmd+Shift+G worked for me. I think we need better instructions for folks trying to find that .output folder."
- "Does this also have instructions for Windows and Linux?"
- "Instead, have a tab like Windows / Mac / Linux, kind of like how documentation would do it."
- "Make it look like a terminal for each step that allows people to copy and paste."
- "The extension should open the panel when you toggle on captions, or maybe even when you click the extension. I don't get why I would press Start captions and it wouldn't show the panel."
- "The captions are too small, and they should overlay the video itself when it's using the extension. Right now it's in the middle of the page, and I didn't even realize. It was on top of the video title."

</details>

Commits: [`47f2fcb`](https://github.com/blackgirlbytes/live-captions/commit/47f2fcb), [`26f85af`](https://github.com/blackgirlbytes/live-captions/commit/26f85af), [`bb30a8e`](https://github.com/blackgirlbytes/live-captions/commit/bb30a8e)

## 9. Review with a second agent and prepare the store listing

Open a different agent for the review. A fresh agent with review skills finds problems the building agent stopped seeing. Heard used Codex for this step.

Install review skills first. Heard used these:

- [`code-simplifier`](https://github.com/getsentry/skills/blob/main/skills/code-simplifier/SKILL.md) removes extra code and abstractions.
- [`correct`](https://github.com/cursor/plugins/blob/main/pstack/skills/correct/SKILL.md) checks that the code does what it claims.
- [`no-comments`](https://github.com/cursor/plugins/blob/main/pstack/skills/no-comments/SKILL.md) removes comments that repeat the code.
- [`statechart`](https://github.com/cursor/plugins/blob/main/pstack/skills/statechart/SKILL.md) models states and transitions, such as start, stop, and reconnect.
- [`technical-writing`](https://github.com/cursor/plugins/blob/main/pstack/skills/technical-writing/SKILL.md) applies a writing standard to docs.

Then send:

```text
Use all these skills to review and improve this codebase. Then we want to publish the extension on the Chrome Web Store, so prepare the right documentation for it.
```

When the store dashboard rejects your submission, paste its messages directly into the agent. The Chrome Web Store asks for a justification for each permission and a single-purpose description.

You should get tests for the extension's rules, a script that checks the store package, and [`docs/chrome-web-store-listing.md`](chrome-web-store-listing.md) with text for each store field.

Why a second agent: the review added rules the first build missed. Start and stop commands now run in order, so only the captured tab shows a `LIVE` badge. A remote token server must use HTTPS. The store package must not contain the server key variable. Each rule has a test, and `AGENTS.md` lists them, so later agents keep them.

Commit: [`dfbda9b`](https://github.com/blackgirlbytes/live-captions/commit/dfbda9b)

## Habits that cut the back-and-forth

These habits saved the most turns in the original build:

- Put rules that must never break in `AGENTS.md`, not in a chat message.
- Ask how the app gets its credentials as soon as it works.
- Give a design reference and name the parts to keep.
- Ask for several options when you can't describe what you want.
- Ask "What am I leaving out?" before you approve a plan.
- Use the app as a new user before you call it done.
- Review with a different agent than the one that built the code.

To learn how the captions pipeline works in code, follow [Build live video captions with Deepgram](build-live-captions-with-deepgram.md).
