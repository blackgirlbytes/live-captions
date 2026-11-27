/**
 * Hand-written CSS for the shadow-root caption overlay. WXT prepends `:host{all:initial}`,
 * so nothing from the host page leaks in. Colors mirror the Heard theme (ink + amber).
 */
export const OVERLAY_CSS = /* css */ `
.box {
  position: fixed;
  z-index: 2147483647;
  box-sizing: border-box;
  padding: 20px 12px 12px;
  border-radius: 14px;
  pointer-events: auto;
  cursor: grab;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  outline: 1.5px dashed transparent;
  outline-offset: -1px;
  transition: outline-color 140ms ease, background-color 140ms ease;
  font-family: Inter, "Segoe UI", system-ui, -apple-system, sans-serif;
}
.box:hover, .box.active, .box:focus-within {
  outline-color: rgba(245, 184, 61, 0.75);
  background-color: rgba(8, 8, 11, 0.28);
}
.box.dragging { cursor: grabbing; }

.live {
  position: absolute;
  top: 6px;
  left: 10px;
  display: flex;
  align-items: center;
  gap: 6px;
  pointer-events: none;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #f5b83d;
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.45);
  animation: heard-pulse 1.6s ease-in-out infinite;
}
.live.on .dot { background: #ff4d5e; }
.label {
  font: 600 10px/1 Inter, "Segoe UI", system-ui, sans-serif;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #efeff5;
  text-shadow: 0 1px 2px #000;
  opacity: 0;
  transition: opacity 140ms ease;
}
.box:hover .label, .box.active .label { opacity: 1; }

.bar {
  position: absolute;
  top: -13px;
  right: 10px;
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 140ms ease;
}
.box:hover .bar, .box.active .bar, .box:focus-within .bar { opacity: 1; }
.btn {
  all: unset;
  box-sizing: border-box;
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: #13131a;
  color: #efeff5;
  border: 1px solid #383846;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.45);
  cursor: pointer;
}
.btn:hover { background: #262632; color: #ffcd62; }
.btn:focus-visible { outline: 2px solid #f5b83d; outline-offset: 1px; }
.btn.grip { cursor: grab; color: #b6b6c6; }

.resize {
  position: absolute;
  right: 2px;
  bottom: 2px;
  width: 16px;
  height: 16px;
  cursor: nwse-resize;
  opacity: 0;
  transition: opacity 140ms ease;
  background:
    linear-gradient(135deg, transparent 0 55%, #f5b83d 55% 62%, transparent 62% 72%, #f5b83d 72% 79%, transparent 79%);
  border-radius: 0 0 10px 0;
}
.box:hover .resize, .box.active .resize { opacity: 1; }

@keyframes heard-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.45; transform: scale(0.8); }
}
@media (prefers-reduced-motion: reduce) {
  .dot { animation: none; }
}
`;
