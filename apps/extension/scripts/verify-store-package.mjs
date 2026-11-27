import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const extension = join(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(extension, ".output", "chrome-mv3");
const manifest = JSON.parse(await readFile(join(output, "manifest.json"), "utf8"));
const pkg = JSON.parse(await readFile(join(extension, "package.json"), "utf8"));
const errors = [];
const expectedPermissions = ["activeTab", "offscreen", "scripting", "sidePanel", "storage", "tabCapture"];

if (manifest.version !== pkg.version) errors.push("manifest version differs from apps/extension/package.json");
if (JSON.stringify([...manifest.permissions].sort()) !== JSON.stringify(expectedPermissions)) {
  errors.push("manifest permissions changed; review the store listing and privacy policy before release");
}
if (manifest.host_permissions?.length) errors.push("manifest requests host permissions");
if (manifest.content_scripts?.length) errors.push("manifest registers always-on content scripts");
if (manifest.externally_connectable) errors.push("manifest allows external messages");
if (!manifest.icons?.[128]) errors.push("manifest has no 128px icon");

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  }));
  return files.flat();
}

const files = await walk(output);
if (!files.includes(join(output, manifest.icons?.[128] ?? ""))) errors.push("128px icon file is missing");
if (files.some((path) => path.endsWith(".map"))) errors.push("source maps are included in the store package");

for (const path of files.filter((name) => /\.(js|html|json)$/.test(name))) {
  if ((await readFile(path, "utf8")).includes("DEEPGRAM_API_KEY")) {
    errors.push("server key variable appears in the extension package");
    break;
  }
}

const locales = await readdir(join(output, "_locales"));
for (const locale of locales) {
  const messages = JSON.parse(await readFile(join(output, "_locales", locale, "messages.json"), "utf8"));
  if (!messages.extName?.message || !messages.extDescription?.message) errors.push(`${locale} is missing store manifest text`);
  if (messages.extDescription?.message.length > 132) errors.push(`${locale} description exceeds 132 characters`);
}

const zip = join(extension, ".output", `heardextension-${pkg.version}-chrome.zip`);
if (!(await stat(zip).catch(() => null))?.isFile()) errors.push("store ZIP is missing");

if (errors.length) {
  for (const error of errors) console.error(`Store package: ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Store package verified: ${zip}`);
}
