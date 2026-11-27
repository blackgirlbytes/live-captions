import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";
import { PCM_WORKLET_SOURCE } from "@heard/shared";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: "Heard — Live AI Captions",
    short_name: "Heard",
    description:
      "Real-time AI captions and a searchable transcript for any video or audio playing in a tab. Powered by Deepgram Nova-3.",
    minimum_chrome_version: "116",
    // Deliberately minimal: no host permissions and no always-on content scripts.
    permissions: ["tabCapture", "offscreen", "sidePanel", "storage", "activeTab", "scripting"],
    icons: { 16: "icon/16.png", 32: "icon/32.png", 48: "icon/48.png", 128: "icon/128.png" },
    action: {
      default_title: "Heard — Live AI Captions",
      default_icon: { 16: "icon/16.png", 32: "icon/32.png" },
    },
  },
  hooks: {
    // Ship the AudioWorklet from the single source of truth in @heard/shared.
    "build:publicAssets": (_wxt, files) => {
      files.push({ relativeDest: "pcm-worklet.js", contents: PCM_WORKLET_SOURCE });
    },
    "prepare:publicPaths": (_wxt, paths) => {
      paths.push("/pcm-worklet.js");
    },
  },
});
