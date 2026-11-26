#!/usr/bin/env node
/**
 * Real-audio end-to-end test: drives installed Google Chrome with puppeteer-core, opens the
 * watch page on a speech-heavy YouTube video, clicks "Start captions", lets Chrome auto-accept
 * the "share this tab" prompt, and waits for Deepgram transcript lines to appear.
 *
 *   EARSHOT_URL=http://localhost:3100 npm run e2e -w @earshot/web
 *
 * Env: EARSHOT_URL (default http://localhost:3100), CHROME_PATH, E2E_VIDEO (YouTube URL),
 *      E2E_HEADLESS=1 for headless (YouTube usually refuses to play there: player error 5),
 *      E2E_TIMEOUT_MS (default 45000).
 *
 * Runs headful by default: a Chrome window opens for ~30 s. Start the web app first.
 */
import puppeteer from "puppeteer-core";

const BASE = (process.env.EARSHOT_URL ?? "http://localhost:3100").replace(/\/$/, "");
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const VIDEO = process.env.E2E_VIDEO ?? "https://www.youtube.com/watch?v=iG9CE55wbtY&t=60";
const HEADLESS = process.env.E2E_HEADLESS === "1";
const TIMEOUT = Number(process.env.E2E_TIMEOUT_MS ?? 45000);

let page;
const log = (...a) => console.log(`[e2e ${new Date().toISOString().slice(11, 19)}]`, ...a);

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: HEADLESS,
  args: [
    "--auto-accept-this-tab-capture",
    "--autoplay-policy=no-user-gesture-required",
    "--no-first-run",
    "--no-default-browser-check",
    "--window-size=1440,900",
  ],
  defaultViewport: { width: 1440, height: 900 },
});

let exitCode = 1;
try {
  page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  const url = `${BASE}/watch?url=${encodeURIComponent(VIDEO)}`;
  log("open", url);
  await page.goto(url, { waitUntil: "domcontentloaded" });

  // Wait for the YouTube iframe or an error panel.
  await page.waitForSelector('iframe[src*="youtube.com/embed"], [data-error-code]', { timeout: 20000 });
  const blocked = await page.$("[data-error-code]");
  if (blocked) throw new Error(`YouTube player error ${await blocked.evaluate((el) => el.dataset.errorCode)}`);
  log("player iframe mounted");

  await clickButton(page, "Start captions");
  await clickButton(page, "Choose this tab"); // start guide → getDisplayMedia (auto-accepted)
  log("requested tab capture");

  await page.waitForFunction(
    () => {
      const status = document.querySelector('[aria-label^="Transcription "]')?.getAttribute("aria-label") ?? "";
      const alert = document.querySelector('[role="alert"]')?.textContent ?? "";
      return /live|paused|connecting/.test(status) || alert.length > 0;
    },
    { timeout: 15000 },
  );
  const alert = await page.$eval('[role="alert"]', (el) => el.textContent).catch(() => null);
  if (alert) throw new Error(`Capture failed: ${alert}`);
  log("session status:", await statusText(page));

  log(`waiting up to ${TIMEOUT / 1000}s for transcript lines…`);
  await page.waitForFunction(
    () =>
      document.querySelector("[data-error-code]") ||
      document.querySelectorAll('[role="log"] ol > li p:not(.italic)').length >= 2,
    { timeout: TIMEOUT, polling: 500 },
  );
  const playerError = await page.$eval("[data-error-code]", (el) => el.dataset.errorCode).catch(() => null);
  if (playerError) throw new Error(`YouTube player error ${playerError} during playback${HEADLESS ? " (expected in headless Chrome; run headful)" : ""}`);

  const lines = await page.$$eval('[role="log"] ol > li', (lis) =>
    lis.map((li) => li.innerText.replace(/\s+/g, " ").trim()).filter(Boolean),
  );
  const seekable = await page.$$eval('[role="log"] ol > li button[title^="Jump to"]', (b) => b.length);
  const caption = await page.$eval('[role="status"][aria-live="off"]', (el) => el.textContent?.trim() ?? "").catch(() => "");
  log("status:", await statusText(page));
  log(`transcript lines (${lines.length}, ${seekable} seekable):`);
  for (const l of lines.slice(0, 8)) console.log("   ", l);
  log("caption bar:", JSON.stringify(caption.slice(0, 120)));

  // Clean stop.
  await clickButton(page, "Stop captions");
  await page.waitForFunction(() => /off/i.test(document.querySelector('[aria-label^="Transcription "]')?.getAttribute("aria-label") ?? ""), {
    timeout: 10000,
  });
  log("stopped cleanly; status:", await statusText(page));
  if (errors.length) log("page errors:", errors.slice(0, 5));
  log("PASS");
  exitCode = 0;
} catch (err) {
  log("FAIL:", err.message);
  try {
    log("status at failure:", await statusText(page));
    const diag = await page.evaluate(() => ({
      lines: document.querySelectorAll('[role="log"] ol > li').length,
      caption: document.querySelector('[role="status"][aria-live="off"]')?.textContent?.trim().slice(0, 120) ?? "",
      alerts: [...document.querySelectorAll('[role="alert"]')].map((a) => a.textContent?.trim()),
    }));
    log("diagnostics:", JSON.stringify(diag));
    if (process.env.E2E_SCREENSHOT) {
      await page.screenshot({ path: process.env.E2E_SCREENSHOT });
      log("screenshot:", process.env.E2E_SCREENSHOT);
    }
    if (errors.length) log("page errors:", errors.slice(0, 5));
  } catch {
    /* page gone */
  }
} finally {
  await browser.close();
  process.exit(exitCode);
}

async function clickButton(page, text) {
  const handle = await page.waitForFunction(
    (t) => [...document.querySelectorAll("button")].find((b) => b.textContent?.trim().includes(t) && !b.disabled),
    { timeout: 15000 },
    text,
  );
  await handle.asElement().click();
}

async function statusText(page) {
  return page.$eval('[aria-label^="Transcription "]', (el) => el.getAttribute("aria-label")).catch(() => "?");
}
