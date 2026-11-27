import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";
import { PCM_WORKLET_SOURCE } from "@heard/shared";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    // Name and description in Chrome's language: public/_locales/<locale>/messages.json.
    name: "__MSG_extName__",
    short_name: "Heard",
    description: "__MSG_extDescription__",
    default_locale: "en",
    minimum_chrome_version: "116",
    // Deliberately minimal: no host permissions and no always-on content scripts.
    permissions: ["tabCapture", "offscreen", "sidePanel", "storage", "activeTab", "scripting"],
    icons: { 16: "icon/16.png", 32: "icon/32.png", 48: "icon/48.png", 128: "icon/128.png" },
    action: {
      default_title: "__MSG_extName__",
      default_icon: { 16: "icon/16.png", 32: "icon/32.png" },
    },
  },
  hooks: {
    // WXT fills the toolbar tooltip from the popup's <title>; use the translated name instead.
    "build:manifestGenerated": (_wxt, manifest) => {
      if (manifest.action) manifest.action.default_title = "__MSG_extName__";
    },
    // Ship the AudioWorklet from the single source of truth in @heard/shared.
    "build:publicAssets": (_wxt, files) => {
      files.push({ relativeDest: "pcm-worklet.js", contents: PCM_WORKLET_SOURCE });
    },
    "prepare:publicPaths": (_wxt, paths) => {
      paths.push("/pcm-worklet.js");
    },
  },
});
