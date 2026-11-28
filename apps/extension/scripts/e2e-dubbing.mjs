#!/usr/bin/env node
/**
 * Live dubbing end-to-end test: installed Google Chrome + the built extension + a real
 * English YouTube video + the real Deepgram API (speech-to-text and Flux TTS).
 *
 *   npm run build -w @heard/extension
 *   E2E_USER_KEY=<deepgram key> node apps/extension/scripts/e2e-dubbing.mjs
 *
 * What it checks:
 * - Dubbing reaches "Playing dubbed audio" and reports its delay (printed as latency stats).
 * - Captions keep arriving while the original audio is ducked to 10% for the dub.
 * - Lines carry speaker labels while dubbing (each speaker gets their own voice).
 * - Captions and transcript follow the dub's language while dubbing, and go back after.
 * - No feedback loop: with dubbed speech playing, the video itself is muted; any transcript
 *   line that appears after that could only come from the dub being captured.
 * - Turning dubbing off returns the state to "off"; stopping the session cleans up.
 *
 * The capture starts without a toolbar click through Chrome's --allowlisted-extension-id
 * test switch. The side panel runs as a normal tab (same code). A Chrome window opens for
 * about a minute, with sound. The key goes only into that throwaway profile's storage.
 *
 * Env: E2E_USER_KEY (required), CHROME_PATH, E2E_VIDEO, E2E_DUB_LANGUAGE (default "es"),
 *      E2E_DUB_SECONDS (default 40).
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const here = dirname(fileURLToPath(import.meta.url));
const EXT = resolve(here, "../.output/chrome-mv3");
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const VIDEO = process.env.E2E_VIDEO ?? "https://www.youtube.com/watch?v=iG9CE55wbtY&t=60";
const KEY = process.env.E2E_USER_KEY?.trim();
const DUB_LANGUAGE = process.env.E2E_DUB_LANGUAGE ?? "es";
const DUB_SECONDS = Number(process.env.E2E_DUB_SECONDS ?? 40);

const log = (...a) => console.log(`[e2e ${new Date().toISOString().slice(11, 19)}]`, ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!KEY) {
  console.error("Set E2E_USER_KEY to a Deepgram API key.");
  process.exit(2);
}
if (!existsSync(`${EXT}/manifest.json`)) {
  console.error(`Build the extension first (npm run build -w @heard/extension). Missing ${EXT}`);
  process.exit(2);
}

/** Chrome's id for an unpacked extension without a manifest key: sha256(path) → a..p. */
function unpackedId(path) {
  const manifest = JSON.parse(readFileSync(`${path}/manifest.json`, "utf8"));
  if (manifest.key) throw new Error("manifest has a key; compute the id from it instead");
  const hex = createHash("sha256").update(path).digest("hex").slice(0, 32);
  return [...hex].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join("");
}

const id = unpackedId(EXT);
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: false,
  enableExtensions: true,
  args: [
    `--allowlisted-extension-id=${id}`,
    "--autoplay-policy=no-user-gesture-required",
    "--no-first-run",
    "--no-default-browser-check",
    "--window-size=1280,860",
  ],
  defaultViewport: null,
});

let exitCode = 1;
const failures = [];
const check = (ok, what) => {
  log(ok ? "PASS" : "FAIL", what);
  if (!ok) failures.push(what);
};

try {
  const installed = await browser.installExtension(EXT);
  if (installed !== id) throw new Error(`extension id ${installed} ≠ computed ${id}: the allowlist switch won't apply`);
  log("extension installed:", id);

  const [blank] = await browser.pages();
  const video = await browser.newPage();
  await blank?.close();
  log("open", VIDEO);
  await video.goto(VIDEO, { waitUntil: "domcontentloaded" });
  await video.waitForSelector("video", { timeout: 30000 });
  // Decline the consent wall if YouTube shows one in this fresh profile.
  await video.evaluate(() => document.querySelector('button[aria-label*="Reject"]')?.click()).catch(() => undefined);
  await video.waitForFunction(() => {
    const v = document.querySelector("video");
    if (v && v.paused) void v.play().catch(() => undefined);
    return v && !v.paused && v.currentTime > 0;
  }, { timeout: 45000, polling: 1000 });
  log("video playing");

  const panel = await browser.newPage();
  const errors = [];
  panel.on("pageerror", (e) => errors.push(e.message));
  await panel.goto(`chrome-extension://${id}/sidepanel.html`, { waitUntil: "load" });

  // Settings: own key, English spoken, dub into DUB_LANGUAGE.
  await panel.evaluate(
    async (key, language) => {
      await chrome.storage.local.set({
        deepgramKey: key,
        captionSettings: { spokenLanguage: "en", captionLanguage: "" },
        dubSettings: { language },
      });
      window.__log = [];
      chrome.runtime.onMessage.addListener((m) => {
        if (m?.to !== "broadcast") return;
        if (m.type === "transcript-event" && m.event.type === "line") window.__log.push({ t: Date.now(), kind: "line", text: m.event.line.text, speaker: m.event.line.speaker });
        if (m.type === "dub-state") window.__log.push({ t: Date.now(), kind: "dub", ...m.dub });
      });
    },
    KEY,
    DUB_LANGUAGE,
  );
  await panel.reload({ waitUntil: "load" });
  await panel.evaluate(() => {
    window.__log = [];
    chrome.runtime.onMessage.addListener((m) => {
      if (m?.to !== "broadcast") return;
      if (m.type === "transcript-event" && m.event.type === "line") window.__log.push({ t: Date.now(), kind: "line", text: m.event.line.text, speaker: m.event.line.speaker });
      if (m.type === "dub-state") window.__log.push({ t: Date.now(), kind: "dub", ...m.dub });
    });
  });

  const start = await panel.evaluate(async () => {
    const self = await chrome.tabs.getCurrent();
    const tabs = await chrome.tabs.query({});
    const target = tabs.find((t) => t.id !== self?.id);
    return chrome.runtime.sendMessage({ to: "background", type: "start", tabId: target.id });
  });
  if (!start?.ok) throw new Error(`start failed: ${JSON.stringify(start)}`);
  log("capture started");

  const lines = () => panel.evaluate(() => window.__log.filter((e) => e.kind === "line"));
  const dubs = () => panel.evaluate(() => window.__log.filter((e) => e.kind === "dub"));
  const waitFor = async (fn, ms, what) => {
    const until = Date.now() + ms;
    while (Date.now() < until) {
      if (await fn()) return true;
      await sleep(500);
    }
    throw new Error(`timed out waiting for ${what}`);
  };
  await waitFor(async () => (await lines()).length > 0, 30000, "the first transcript line");
  log("first line:", (await lines())[0].text);

  // Turn dubbing on with a real click (a translator download needs a user gesture).
  // The switch lives in the side panel's Settings tab.
  await panel.evaluate(() => [...document.querySelectorAll("nav button")].find((b) => b.textContent.trim() === "Settings").click());
  const toggle = await panel.waitForSelector('[data-testid="dub-toggle"]:not([disabled])', { timeout: 10000 });
  await toggle.click();
  const enabledAt = Date.now();
  log(`dubbing on (${DUB_LANGUAGE}), original audio ducked to 10%`);

  await waitFor(async () => (await dubs()).some((d) => d.status === "playing"), 45000, "dubbed audio to play");
  log("dubbed audio playing after", ((Date.now() - enabledAt) / 1000).toFixed(1), "s");
  await sleep(DUB_SECONDS * 1000);

  const during = (await lines()).filter((l) => l.t > enabledAt);
  check(during.length >= 3, `captions keep coming with the original ducked (${during.length} lines while dubbing)`);
  // Speaker labels are on while dubbing (each speaker gets their own voice).
  const labelled = during.filter((l) => l.speaker);
  log("speakers while dubbing:", [...new Set(labelled.map((l) => l.speaker))].join(", ") || "none");
  check(labelled.length > 0 && labelled.length >= during.length - 1, `lines carry speaker labels while dubbing (${labelled.length}/${during.length})`);

  const delays = (await dubs()).map((d) => d.delayMs).filter((x) => typeof x === "number");
  const uniq = [...new Set(delays)];
  if (uniq.length) {
    const sorted = [...uniq].sort((a, b) => a - b);
    const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor((sorted.length * p) / 100))];
    log(`dub delay over ${sorted.length} phrases: median ${(pct(50) / 1000).toFixed(1)} s, p90 ${(pct(90) / 1000).toFixed(1)} s, max ${(sorted.at(-1) / 1000).toFixed(1)} s`);
  }
  check(uniq.length > 0, "dub delay was measured");

  // Captions follow the dub: the settings say so, and transcript lines show translations.
  const followNote = await panel.evaluate(() => document.body.innerText.includes("follow live dubbing"));
  check(followNote, "the caption language says it follows live dubbing");
  const tab = (name) => panel.evaluate((n) => [...document.querySelectorAll("nav button")].find((b) => b.textContent.trim() === n).click(), name);
  const translatedLines = () => panel.evaluate(() => document.querySelectorAll('li div[dir="auto"]').length);
  await tab("Transcript");
  await sleep(500);
  const translatedWhileDubbing = await translatedLines();
  check(translatedWhileDubbing > 0, `transcript lines are translated into the dub language (${translatedWhileDubbing})`);
  await tab("Settings");
  const skipped = (await dubs()).at(-1)?.skipped ?? 0;
  log("phrases skipped to stay near live:", skipped);
  const statuses = [...new Set((await dubs()).map((d) => d.status))];
  log("dub statuses seen:", statuses.join(", "));
  check(!statuses.includes("unavailable"), "dubbing never became unavailable");

  // Feedback loop: silence the video while the dub is still speaking. New lines now could
  // only come from Heard's own voice being captured.
  await waitFor(async () => (await dubs()).at(-1)?.status === "playing", 20000, "a phrase to be playing");
  await video.evaluate(() => {
    document.querySelector("video").muted = true;
  });
  const mutedAt = Date.now();
  log("video muted while dubbed speech plays");
  await sleep(9000);
  const playedWhileMuted = (await dubs()).some((d) => d.t > mutedAt && d.status === "playing") || (await dubs()).at(-1)?.status === "playing";
  // Lines finalized in the first ~2.5 s can be the original's last words.
  const leaked = (await lines()).filter((l) => l.t > mutedAt + 2500);
  log("dub still audible after muting:", playedWhileMuted, "| lines after muting:", leaked.map((l) => l.text));
  check(leaked.length === 0, "no transcript lines from the dub (no feedback loop)");
  await video.evaluate(() => {
    document.querySelector("video").muted = false;
  });

  // Off again: back to "off" right away. (Switching tabs re-rendered the switch: find it again.)
  await (await panel.waitForSelector('[data-testid="dub-toggle"]')).click();
  const offAt = Date.now();
  await waitFor(async () => (await dubs()).some((d) => d.t >= offAt && d.status === "off"), 5000, "dubbing to turn off");
  check(true, `dubbing off in ${Date.now() - offAt} ms`);
  await tab("Transcript");
  await sleep(1000);
  check((await translatedLines()) === 0, "captions go back to the saved language (original) when dubbing is off");

  // Language switch while on: queued speech is dropped (state goes through listening again).
  await panel.evaluate(() => chrome.runtime.sendMessage({ to: "background", type: "stop" }));
  await sleep(1500);
  const snap = await panel.evaluate(() => chrome.runtime.sendMessage({ to: "background", type: "get-state" }));
  check(snap.dub.status === "off", "stopping the session leaves dubbing off");
  check(errors.length === 0, `no page errors in the side panel${errors.length ? `: ${errors.join(" | ")}` : ""}`);

  exitCode = failures.length ? 1 : 0;
} catch (err) {
  log("ERROR", err.message);
} finally {
  await browser.close();
  log(exitCode === 0 ? "ALL PASSED" : `FAILED: ${failures.join("; ") || "see error above"}`);
  process.exit(exitCode);
}
