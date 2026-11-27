/**
 * Caption overlay, injected at runtime (chrome.scripting) into the captured tab only.
 * No `matches` → no host permissions and nothing runs on pages the user didn't choose.
 *
 * Rendered in a shadow root so the site's CSS can't touch it (and vice versa). Styles are
 * hand-written (see ./style.ts) — Tailwind v4's @property-based utilities don't apply
 * inside shadow roots.
 */
import { createRoot, type Root } from "react-dom/client";
import { createShadowRootUi } from "wxt/utils/content-script-ui/shadow-root";
import { defineContentScript } from "wxt/utils/define-content-script";
import { browser } from "wxt/browser";
import { EMPTY_CAPTION } from "@heard/shared";
import { isOverlayMessage, sendToBackground } from "@/utils/messages";
import { Overlay, createOverlayStore } from "./Overlay";
import { OVERLAY_CSS } from "./style";

const GUARD = "__heardOverlayMounted";

export default defineContentScript({
  registration: "runtime",
  async main(ctx) {
    const w = window as unknown as Record<string, unknown>;
    if (w[GUARD]) return; // already injected into this document
    w[GUARD] = true;

    const hello = await sendToBackground({ to: "background", type: "overlay-hello" }).catch(() => null);
    if (!hello?.captured) {
      w[GUARD] = false;
      return;
    }

    const store = createOverlayStore({ status: hello.status, caption: hello.caption ?? EMPTY_CAPTION, hidden: hello.hidden });

    const ui = await createShadowRootUi<Root>(ctx, {
      name: "heard-captions",
      position: "inline",
      anchor: () => document.fullscreenElement ?? document.body,
      append: "last",
      css: OVERLAY_CSS,
      onMount(container) {
        const root = createRoot(container);
        root.render(
          <Overlay
            store={store}
            onDismiss={() => {
              store.set({ hidden: true });
              void sendToBackground({ to: "background", type: "overlay-dismissed" }).catch(() => undefined);
            }}
          />,
        );
        return root;
      },
      onRemove(root) {
        root?.unmount();
      },
    });
    ui.mount();

    // Fullscreen video puts one element in the top layer; anything outside it is invisible.
    const onFullscreen = () => {
      const parent = document.fullscreenElement ?? document.body;
      if (ui.shadowHost.parentElement !== parent) parent.appendChild(ui.shadowHost);
    };
    document.addEventListener("fullscreenchange", onFullscreen);

    const onMessage = (msg: unknown) => {
      if (!isOverlayMessage(msg)) return;
      const m = msg;
      switch (m.type) {
        case "event": {
          const e = m.event;
          if (e.type === "caption") store.set({ caption: e.caption });
          else if (e.type === "status") store.set({ status: e.status });
          else if (e.type === "reset") store.set({ caption: EMPTY_CAPTION });
          break;
        }
        case "show":
          store.set({ hidden: false });
          break;
        case "teardown":
          teardown();
          break;
      }
    };
    browser.runtime.onMessage.addListener(onMessage);

    function teardown() {
      browser.runtime.onMessage.removeListener(onMessage);
      document.removeEventListener("fullscreenchange", onFullscreen);
      ui.remove();
      w[GUARD] = false;
    }
    // Extension reloaded/updated: this script is orphaned.
    ctx.onInvalidated(teardown);
  },
});
