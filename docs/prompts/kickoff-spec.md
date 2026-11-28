# Kickoff spec for Heard

This is the spec that started Heard. It was drafted in ChatGPT and pasted into Claude Code as the first prompt. It is reproduced here unchanged. To use it, copy the block and paste it after the prompt in [step 2 of the prompting tutorial](../build-heard-by-prompting-an-agent.md#2-hand-the-spec-to-the-agent).

```text
Build an AI-Powered Video Player and Chrome Extension
Overview
Build an open-source AI-powered video viewing platform and companion Chrome extension that use Deepgram to generate real-time captions and interactive transcripts.
Start with YouTube, supporting both livestreams and prerecorded videos. However, architect the application with the expectation that additional video providers will be supported in the future.
The goal is to make online video more accessible without relying on a video platform's native captioning capabilities.
1. Web Platform
Create a web application where users can paste a YouTube video or livestream URL and watch it with Deepgram-powered captions.
Video playback

* Accept YouTube video and livestream URLs.
* Use the official YouTube embedded player.
* Support standard video playback controls.
* Use permission-based browser tab audio capture to access audio.
* Provide clear instructions for enabling audio capture.
* Handle unsupported URLs and videos that cannot be embedded.

Do not require a YouTube Data API key for basic playback.
Keep video provider-specific logic separate from transcription logic so additional providers, such as Twitch, Vimeo, and direct video URLs, can be introduced later.
Real-time captions
Use Deepgram Nova-3 streaming speech-to-text to generate captions during video playback.

* Display captions over the video where permitted, or immediately below it.
* Support interim and final transcription results.
* Automatically update captions as people speak.
* Allow users to enable and disable captions.
* Allow users to customize caption font size and background.
* Keep captions synchronized with playback as closely as possible.
* Handle paused videos, seeking, and audio capture interruptions.

Live transcript
Display a transcript alongside the video player.

* Update the transcript in real time.
* Include timestamps.
* Automatically scroll as new text appears.
* Allow users to search the transcript.
* Allow users to copy or download the transcript.
* Support navigating to timestamps in seekable videos when synchronization is available.

2. Chrome Extension
Build a Chrome extension that allows users to generate captions directly on websites without visiting the standalone platform.
Initially, prioritize testing and supporting YouTube, but avoid coupling the audio capture and transcription implementation to YouTube.
Audio capture

* Capture audio from the active browser tab using Chrome's tab capture capabilities.
* Require explicit user interaction before starting audio capture.
* Preserve normal audio playback.
* Allow users to start and stop transcription.
* Stop capturing audio when the associated tab is closed.

Caption overlay
Display real-time captions directly on the webpage.
The caption overlay should be:

* Draggable
* Resizable
* Customizable
* Easy to dismiss
* Visually isolated from the website's existing styles

Side panel
Create a Chrome side panel containing:

* Live transcript
* Transcript search
* Caption settings
* Start and stop controls
* Transcript downloads

Extension popup
Create a simple popup that allows users to:

* Enable or disable AI captions.
* Open the transcript side panel.
* View transcription status.
* Open the standalone web platform.

3. Technical Architecture
Use TypeScript and React for both applications.
Recommended technologies:

* Next.js for the web platform
* WXT for Chrome extension development
* Tailwind CSS for styling
* Deepgram JavaScript SDK
* Chrome Manifest V3
* Web Audio API
* WebSockets

Share transcription logic, types, and reusable UI components between the web application and Chrome extension where practical.
Keep the architecture simple. Avoid introducing unnecessary services, packages, dependencies, or abstractions.
Use Deepgram Nova-3 for continuous audio transcription.
Keep permanent Deepgram API credentials server-side. Use short-lived access tokens or a secure backend connection for browser-based transcription.
4. Design
The application should feel like a polished consumer video platform rather than a technical demo.
Use:

* A modern, dark-first interface
* Clean typography
* An immersive video player
* A prominent video URL input
* A collapsible transcript panel
* Minimal, intuitive controls
* Responsive layouts
* Accessible caption styling

The Chrome extension should share the same visual identity as the web platform.
Prioritize simplicity and usability.
5. Privacy and Reliability

* Only capture audio with explicit user permission.
* Clearly indicate when transcription is active.
* Do not permanently store transcripts by default.
* Request only necessary browser permissions.
* Handle network interruptions and reconnect when appropriate.
* Prevent duplicate transcript segments.
* Clean up audio streams and WebSocket connections when transcription ends.
* Verify and respect third-party video provider policies and restrictions.

6. Implementation Order
Phase 1: Web Platform

1. Create the application and video player interface.
2. Implement YouTube video and livestream playback.
3. Implement browser tab audio capture.
4. Integrate Deepgram streaming transcription.
5. Display real-time captions.
6. Implement the searchable and downloadable transcript.
7. Polish the viewing experience.

Phase 2: Chrome Extension

1. Create the Chrome extension.
2. Implement active tab audio capture.
3. Reuse the Deepgram transcription logic.
4. Build the floating caption overlay.
5. Implement the transcript side panel.
6. Test with YouTube videos and livestreams.
7. Polish the extension experience.

7. Future Considerations
Do not implement these features in the initial version, but avoid architectural decisions that would prevent their introduction later.

* Additional video providers
* Real-time caption translation
* Local video and audio uploads
* AI-powered video summaries
* Conversational video assistants using Deepgram Flux
* Multilingual audio dubbing using Deepgram TTS

8. Development Requirements
Build a fully functional product, not a visual prototype.

* Use real Deepgram API integrations.
* Do not use mocked transcripts or simulated transcription responses in the production experience.
* Do not create nonfunctional UI controls.
* Consult official documentation for current API capabilities and browser restrictions.
* Include clear setup instructions and environment variable configuration.
* Include instructions for loading the Chrome extension locally.
* Document known limitations.
* Test the core audio capture and transcription workflows.

Prioritize getting an end-to-end working transcription experience before adding secondary features.
The initial product should accomplish one thing exceptionally well: allow users to watch videos with real-time AI-powered captions and transcripts, starting with YouTube.
```
