// After a build, print the folder to pick in Chrome's "Load unpacked" dialog.
// The folder starts with a dot (.output), so Finder hides it; on macOS we also copy the path.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const dir = resolve(import.meta.dirname, "../.output/chrome-mv3");
if (!existsSync(dir)) process.exit(0);

let copied = false;
if (process.platform === "darwin") {
  try {
    execFileSync("pbcopy", { input: dir });
    copied = true;
  } catch {}
}

const tip = {
  darwin: "In the file picker press Cmd+Shift+G, paste, and press Return.",
  win32: "In the file picker, paste this path into the address bar at the top and press Enter.",
  linux: "In the file picker press Ctrl+L, paste, and press Enter (Ctrl+H shows hidden folders).",
}[process.platform] ?? "Paste this path into the file picker.";
console.log(`\nLoad this folder in chrome://extensions → Load unpacked:\n\n  ${dir}\n\n${copied ? "Copied to your clipboard. " : ""}${tip}\n`);
