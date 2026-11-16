import { useEffect, type RefObject } from "react";

/** How far an arrow key moves the content. */
const LINE = 40;
const FIELD = "input, textarea, select, [contenteditable]:not([contenteditable='false'])";

/** The keys that scroll a page, for Main's content when nothing in it has
 * focus. At 1024 and wider the frame scrolls Main's content and the
 * document no longer scrolls, so Page Down on the page itself, in the
 * sidebar, in the header row or on the footer links would move nothing.
 * This hands the key to the content, the way the document took it before.
 *
 * Left alone: a key from inside the content (the browser scrolls it), from
 * a field, or from anything outside the app shell (a dialog, a menu or a
 * popover in a portal); a key a handler already took; any key held with
 * Alt, Control or Meta, and Shift with anything but Space. Space scrolls
 * only from the page itself, since on a control it presses the control.
 * Below 1024 the content does not scroll and the browser keeps the key.
 * The jump is instant, as reduced motion wants it anyway. */
export function useFrameKeys(ref: RefObject<HTMLElement | null>, active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const el = ref.current;
      if (!el || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.shiftKey && e.key !== " ") return;
      const target = e.target instanceof Element ? e.target : null;
      const onPage = !target || target === document.body || target === document.documentElement;
      if (target && !onPage) {
        if (!target.closest(".sp-appshell") || el.contains(target) || target.closest(FIELD)) {
          return;
        }
      }
      const page = Math.max(el.clientHeight - LINE, LINE);
      let delta: number;
      switch (e.key) {
        case "PageDown":
          delta = page;
          break;
        case "PageUp":
          delta = -page;
          break;
        case "ArrowDown":
          delta = LINE;
          break;
        case "ArrowUp":
          delta = -LINE;
          break;
        case "Home":
          delta = -el.scrollHeight;
          break;
        case "End":
          delta = el.scrollHeight;
          break;
        case " ":
          if (!onPage) return;
          delta = e.shiftKey ? -page : page;
          break;
        default:
          return;
      }
      const { overflowY } = getComputedStyle(el);
      if (overflowY !== "auto" && overflowY !== "scroll") return;
      if (el.scrollHeight <= el.clientHeight) return;
      e.preventDefault();
      el.scrollTop += delta;
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [ref, active]);
}
