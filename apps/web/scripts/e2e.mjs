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
 * Bring-your-own-key modes:
 *   E2E_USER_KEY=<key>  Enter this Deepgram key in the app before starting: through the "Add your
 *                       Deepgram key" dialog when the server has no key, otherwise through
 *                       Settings → "Use my own Deepgram key". Asserts the key never reaches the
 *                       Earshot server and no server token is requested. The key is never logged.
 *   E2E_BAD_KEY=1       Against a server without a key: asserts the dialog rejects a malformed
 *                       key and a well-formed fake key (Deepgram's "didn't accept" message). No capture.
 *
 * Runs headful by default: a Chrome window opens for ~30 s. Start the web app first.
 */
import puppeteer from "puppeteer-core";

const BASE = (process.env.EARSHOT_URL ?? "http://localhost:3100").replace(/\/$/, "");
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const VIDEO = process.env.E2E_VIDEO ?? "https://www.youtube.com/watch?v=iG9CE55wbtY&t=60";
const HEADLESS = process.env.E2E_HEADLESS === "1";
const TIMEOUT = Number(process.env.E2E_TIMEOUT_MS ?? 45000);
const USER_KEY = process.env.E2E_USER_KEY?.trim() || null;
const BAD_KEY = process.env.E2E_BAD_KEY === "1";

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
const errors = [];
try {
  page = await browser.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  // BYOK: the user's key must only ever go to Deepgram, and no server token should be minted.
  const leaks = [];
  let tokenPosts = 0;
  page.on("request", (req) => {
    const u = req.url();
    if (!u.startsWith(BASE)) return;
    if (req.method() === "POST" && u.includes("/api/deepgram/token")) tokenPosts += 1;
    if (USER_KEY) {
      const blob = [u, req.postData() ?? "", JSON.stringify(req.headers())].join("\n");
      if (blob.includes(USER_KEY)) leaks.push(`${req.method()} ${new URL(u).pathname}`);
    }
  });

  const serverKey = (await (await fetch(`${BASE}/api/deepgram/token`)).json()).serverKey;
  log("GET /api/deepgram/token → serverKey:", serverKey);

  const url = `${BASE}/watch?url=${encodeURIComponent(VIDEO)}`;
  log("open", url);
  await page.goto(url, { waitUntil: "domcontentloaded" });

  // Wait for the YouTube iframe or an error panel.
  await page.waitForSelector('iframe[src*="youtube.com/embed"], [data-error-code]', { timeout: 20000 });
  const blocked = await page.$("[data-error-code]");
  if (blocked) throw new Error(`YouTube player error ${await blocked.evaluate((el) => el.dataset.errorCode)}`);
  log("player iframe mounted");

  if (BAD_KEY) {
    if (serverKey !== false) throw new Error("E2E_BAD_KEY needs a server without DEEPGRAM_API_KEY");
    await clickButton(page, "Start captions");
    const input = await page.waitForSelector('[role="dialog"] input[placeholder="Paste your key"]', { timeout: 10000 });
    log("key dialog shown");
    await input.type("not-a-key");
    await clickButton(page, "Verify & save");
    const malformed = await waitForAlert(page, /doesn.t look like a Deepgram API key/);
    log("malformed key →", JSON.stringify(malformed));
    await input.evaluate((el) => el.select());
    await input.type([...Array(40)].map(() => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join(""));
    await clickButton(page, "Verify & save");
    const rejected = await waitForAlert(page, /didn.t accept that key/, 15000);
    log("fake key →", JSON.stringify(rejected));
    const saved = await page.evaluate(() => localStorage.getItem("earshot:deepgram-key"));
    if (saved) throw new Error("A rejected key was saved");
    if (tokenPosts) throw new Error(`Unexpected server token requests: ${tokenPosts}`);
  } else {
    await captureFlow(page, serverKey, errors, leaks, () => tokenPosts);
  }
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

/** Start captions (through the key dialog or settings when E2E_USER_KEY is set) and assert transcript lines. */
async function captureFlow(page, serverKey, errors, leaks, tokenPosts) {
  if (USER_KEY && serverKey === true) {
    // Server has a key: opt into the user's own key from settings.
    await clickButton(page, "Settings", "aria");
    await clickButton(page, "Use my own Deepgram key");
    await fillKeyAndSave(page);
    await page.waitForFunction(() => document.querySelector("[data-key-mode]")?.getAttribute("data-key-mode") === "user", { timeout: 15000 });
    // Redact even the masked last-4 the UI shows.
    log("settings:", (await page.$eval("[data-key-mode]", (el) => el.textContent?.trim() ?? "")).replace(/•+\S{4}/, "••••xxxx"));
    await page.keyboard.press("Escape");
  }

  await clickButton(page, "Start captions");
  if (USER_KEY && serverKey !== true) {
    await page.waitForSelector('[role="dialog"] input[placeholder="Paste your key"]', { timeout: 10000 });
    log("key dialog shown");
    await fillKeyAndSave(page);
    log("key verified and saved");
  } else if (!USER_KEY && serverKey === false) {
    throw new Error("Server has no Deepgram key: set E2E_USER_KEY to test bring-your-own-key mode");
  }
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
  if (USER_KEY) {
    if (leaks.length) throw new Error(`User key was sent to the Earshot server: ${leaks.join(", ")}`);
    if (tokenPosts()) throw new Error(`Server tokens were requested in user-key mode (${tokenPosts()})`);
    const mode = await page.evaluate(() => (localStorage.getItem("earshot:deepgram-key") ? "saved in localStorage" : "missing"));
    log(`user key ${mode}; never sent to Earshot; 0 server token requests`);
  } else {
    log("server token requests:", tokenPosts());
  }
  if (errors.length) log("page errors:", errors.slice(0, 5));
}

async function clickButton(page, text, by = "text") {
  const handle = await page.waitForFunction(
    (t, by) =>
      [...document.querySelectorAll("button")].find(
        (b) => (by === "aria" ? b.getAttribute("aria-label") === t : b.textContent?.trim().includes(t)) && !b.disabled,
      ),
    { timeout: 15000 },
    text,
    by,
  );
  await handle.asElement().click();
}

async function fillKeyAndSave(page) {
  const input = await page.waitForSelector('input[placeholder="Paste your key"]', { timeout: 10000 });
  await input.type(USER_KEY);
  await clickButton(page, "Verify & save");
  await page.waitForFunction(
    () => !document.querySelector('input[placeholder="Paste your key"]') || document.querySelector('[role="alert"]'),
    { timeout: 15000 },
  );
  const alert = await page.$eval('[role="dialog"] [role="alert"]', (el) => el.textContent).catch(() => null);
  if (alert) throw new Error(`Key not accepted: ${alert}`);
}

async function waitForAlert(page, re, timeout = 5000) {
  const h = await page.waitForFunction(
    (src) => [...document.querySelectorAll('[role="dialog"] [role="alert"]')].map((a) => a.textContent).find((t) => new RegExp(src).test(t ?? "")),
    { timeout },
    re.source,
  );
  return h.jsonValue();
}

async function statusText(page) {
  return page.$eval('[aria-label^="Transcription "]', (el) => el.getAttribute("aria-label")).catch(() => "?");
}
