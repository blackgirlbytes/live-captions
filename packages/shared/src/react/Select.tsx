import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { CheckIcon, ChevronDownIcon } from "./icons";

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  /** BCP 47 tag for the label's own language (e.g. a language's native name). */
  lang?: string;
}

export interface SelectProps<T extends string = string> {
  value: T;
  /** Called synchronously inside the click/keydown handler, so it still counts as a user gesture. */
  onChange: (value: T) => void;
  options: ReadonlyArray<SelectOption<T>>;
  /** Accessible name, when there's no visible label to point at. */
  label?: string;
  /** Id of a visible label element. */
  "aria-labelledby"?: string;
  /** `field` is a full-width form control; `compact` is a borderless menu button (e.g. a header language picker). */
  variant?: "field" | "compact";
  /** Shown before the value (compact variant). */
  icon?: ReactNode;
  className?: string;
  id?: string;
}

const PANEL_MAX = 256; // max-h-64
const PANEL_MIN = 160;
const GAP = 4;

/**
 * A dark, styled replacement for the native `<select>`, whose OS popup clashes with the app.
 * Button + popup listbox (APG "collapsible listbox"): focus moves into the listbox while it's open.
 * The panel is positioned absolutely inside the wrapper (no portal), so it works in the
 * extension's side panel and in shadow roots.
 */
export function Select<T extends string = string>({
  value,
  onChange,
  options,
  label,
  "aria-labelledby": labelledBy,
  variant = "field",
  icon,
  className = "",
  id,
}: SelectProps<T>) {
  const autoId = useId();
  const baseId = id ?? autoId;
  const listId = `${baseId}-list`;
  const valueId = `${baseId}-value`;
  const optionId = (i: number) => `${baseId}-opt-${i}`;

  const wrapper = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [placement, setPlacement] = useState<{ above: boolean; maxHeight: number }>({ above: false, maxHeight: PANEL_MAX });
  const typed = useRef({ text: "", at: 0 });

  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const selected = options[selectedIndex];

  const openAt = (index: number) => {
    setActive(index);
    setOpen(true);
  };
  const close = (refocus: boolean) => {
    setOpen(false);
    typed.current.text = "";
    if (refocus) button.current?.focus();
  };
  const pick = (index: number) => {
    const opt = options[index];
    close(true);
    if (opt && opt.value !== value) onChange(opt.value);
  };

  // Place the panel below the trigger unless the visible area (viewport, or a scrolling
  // ancestor's box) has more room above. Then focus it and show the selected option.
  useLayoutEffect(() => {
    if (!open || !button.current || !list.current) return;
    const rect = button.current.getBoundingClientRect();
    const { top, bottom } = visibleBounds(button.current);
    const below = bottom - rect.bottom - GAP * 2;
    const aboveRoom = rect.top - top - GAP * 2;
    const wanted = Math.min(PANEL_MAX, list.current.scrollHeight);
    const above = below < wanted && aboveRoom > below;
    const room = above ? aboveRoom : below;
    setPlacement({ above, maxHeight: Math.min(PANEL_MAX, Math.max(PANEL_MIN, room)) });
    list.current.focus({ preventScroll: true });
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !list.current) return;
    const el = list.current.children[selectedIndex] as HTMLElement | undefined;
    if (el) list.current.scrollTop = el.offsetTop - list.current.clientHeight / 2 + el.offsetHeight / 2;
    // If the panel runs past a scrolling container's edge, bring it into view.
    list.current.scrollIntoView({ block: "nearest" });
  }, [open, placement]);

  // Keep the keyboard-active option visible without scrolling anything outside the list.
  useEffect(() => {
    if (!open || !list.current) return;
    const el = list.current.children[active] as HTMLElement | undefined;
    if (!el) return;
    const l = list.current;
    if (el.offsetTop < l.scrollTop) l.scrollTop = el.offsetTop - GAP;
    else if (el.offsetTop + el.offsetHeight > l.scrollTop + l.clientHeight) l.scrollTop = el.offsetTop + el.offsetHeight - l.clientHeight + GAP;
  }, [active, open]);

  // Click outside closes. composedPath() sees through shadow roots.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (wrapper.current && !e.composedPath().includes(wrapper.current)) close(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open]);

  /** Type-ahead: letters typed within half a second build a prefix; repeating one letter cycles. */
  const typeahead = (key: string, from: number): number | null => {
    const now = Date.now();
    const t = typed.current;
    t.text = now - t.at > 500 ? key : t.text + key;
    t.at = now;
    const query = fold(t.text);
    const cycling = [...query].every((c) => c === query[0]);
    const needle = cycling ? query[0]! : query;
    const start = cycling ? from + 1 : from;
    for (let n = 0; n < options.length; n++) {
      const i = (start + n) % options.length;
      if (fold(options[i]!.label).startsWith(needle)) return i;
    }
    return null;
  };
  const isPrintable = (e: KeyboardEvent) => e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;

  const onButtonKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (open) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      openAt(selectedIndex);
    } else if (isPrintable(e) && e.key !== " ") {
      const i = typeahead(e.key, selectedIndex);
      e.preventDefault();
      openAt(i ?? selectedIndex);
    }
  };

  const onListKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    const last = options.length - 1;
    const move = (i: number) => {
      e.preventDefault();
      setActive(Math.max(0, Math.min(last, i)));
    };
    switch (e.key) {
      case "ArrowDown":
        return move(active + 1);
      case "ArrowUp":
        return move(active - 1);
      case "Home":
        return move(0);
      case "End":
        return move(last);
      case "PageDown":
        return move(active + 8);
      case "PageUp":
        return move(active - 8);
      case "Enter":
        e.preventDefault();
        return pick(active);
      case " ":
        e.preventDefault();
        // A space in the middle of type-ahead is part of the name ("Chinese (Trad…").
        if (typed.current.text && Date.now() - typed.current.at < 500) {
          const i = typeahead(" ", active);
          if (i !== null) setActive(i);
          return;
        }
        return pick(active);
      case "Escape":
        e.preventDefault();
        // Don't let an enclosing panel/dialog close on the same Escape.
        e.stopPropagation();
        return close(true);
      case "Tab":
        // Let focus move on; just close.
        return close(false);
      default:
        if (isPrintable(e)) {
          e.preventDefault();
          const i = typeahead(e.key, active);
          if (i !== null) setActive(i);
        }
    }
  };

  const compact = variant === "compact";
  const trigger = compact
    ? "inline-flex cursor-pointer items-center gap-1.5 rounded-lg py-1 pr-1.5 pl-2 text-inherit transition-colors hover:bg-ink-900 focus-visible:bg-ink-900 focus-visible:outline-2 focus-visible:outline-accent"
    : `flex h-9 w-full cursor-pointer items-center gap-2 rounded-lg bg-ink-850 pr-2 pl-2.5 text-left text-sm text-ink-100 ring-1 transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
        open ? "ring-ink-500" : "ring-ink-700 hover:ring-ink-600"
      }`;
  const panel = `heard-scroll absolute z-50 overflow-y-auto overscroll-contain rounded-lg bg-ink-850 p-1 text-sm shadow-xl shadow-black/50 ring-1 ring-ink-700 focus:outline-none ${
    placement.above ? "bottom-full mb-1" : "top-full mt-1"
  } ${compact ? "right-0 w-max max-w-[min(18rem,calc(100vw-2rem))] min-w-full" : "inset-x-0"}`;

  return (
    <div ref={wrapper} className={`relative ${compact ? "inline-block" : "w-full"} ${className}`}>
      <button
        ref={button}
        id={baseId}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={label}
        aria-labelledby={label ? undefined : labelledBy ? `${labelledBy} ${valueId}` : undefined}
        onClick={() => (open ? close(true) : openAt(selectedIndex))}
        onKeyDown={onButtonKeyDown}
        className={trigger}
      >
        {icon}
        <span id={valueId} lang={selected?.lang} className="min-w-0 flex-1 truncate">
          {selected?.label}
        </span>
        <ChevronDownIcon size={compact ? 13 : 15} className={`shrink-0 text-ink-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul
          ref={list}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-label={label}
          aria-labelledby={label ? undefined : labelledBy}
          aria-activedescendant={optionId(active)}
          onKeyDown={onListKeyDown}
          onBlur={(e) => {
            const to = e.relatedTarget as Node | null;
            if (to && wrapper.current && !wrapper.current.contains(to)) close(false);
          }}
          className={panel}
          style={{ maxHeight: placement.maxHeight }}
        >
          {options.map((o, i) => {
            const isSelected = i === selectedIndex;
            const isActive = i === active;
            return (
              <li
                key={o.value}
                id={optionId(i)}
                role="option"
                aria-selected={isSelected}
                lang={o.lang}
                onPointerMove={() => i !== active && setActive(i)}
                onClick={() => pick(i)}
                className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 select-none ${isActive ? "bg-ink-700" : ""} ${
                  isSelected ? "font-medium text-accent" : "text-ink-200"
                }`}
              >
                <span className="min-w-0 flex-1 truncate">{o.label}</span>
                {isSelected ? <CheckIcon size={14} className="shrink-0" /> : <span className="w-3.5 shrink-0" aria-hidden="true" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** The part of the viewport not hidden by a scrolling/clipping ancestor (crosses shadow roots). */
function visibleBounds(el: Element): { top: number; bottom: number } {
  let top = 0;
  let bottom = window.innerHeight;
  let node: Element | null = parentOf(el);
  while (node && node !== document.documentElement) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY !== "visible") {
      const r = node.getBoundingClientRect();
      top = Math.max(top, r.top);
      bottom = Math.min(bottom, r.bottom);
    }
    node = parentOf(node);
  }
  return { top, bottom };
}

function parentOf(el: Element): Element | null {
  if (el.parentElement) return el.parentElement;
  const root = el.getRootNode();
  return root instanceof ShadowRoot ? root.host : null;
}

function fold(s: string) {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase();
}
