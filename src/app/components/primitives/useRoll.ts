import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

/** How far the number travels, and the two halves' timing: the old value
 * eases out, the new one overshoots in (Variations, generate-chat PROMPT). */
const ROLL_PX = 18;
const OUT = { duration: 130, easing: "ease-in" } as const;
const IN = { duration: 190, easing: "cubic-bezier(0.3, 1.5, 0.5, 1)" } as const;

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const cancelRoll = (el: HTMLElement) => {
  if (typeof el.getAnimations === "function") el.getAnimations().forEach((a) => a.cancel());
};

/** A number that rolls to its new value: the old one leaves upward on a
 * step up (downward on a step down), the new one arrives from the other
 * side with a small overshoot. Returns the value to show, which trails
 * `value` by the out half, and the ref for the element that moves. Under
 * reduced motion, or without Web Animations, it swaps at once. */
export function useRoll(value: number) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);
  const shownRef = useRef(value);
  // The in half still to play once `shown` has swapped: 1 up, -1 down.
  const pendingIn = useRef<0 | 1 | -1>(0);

  useEffect(() => {
    const from = shownRef.current;
    const el = ref.current;
    if (value === from) {
      // Stepped back before the old number had left: put it back at rest.
      if (el) cancelRoll(el);
      return;
    }
    const swap = (dir: 0 | 1 | -1) => {
      pendingIn.current = dir;
      shownRef.current = value;
      setShown(value);
    };
    if (!el || typeof el.animate !== "function" || prefersReducedMotion()) {
      swap(0);
      return;
    }
    const dir = value > from ? 1 : -1;
    cancelRoll(el);
    const out = el.animate(
      [
        { transform: "translateY(0)", opacity: 1 },
        { transform: `translateY(${-dir * ROLL_PX}px)`, opacity: 0 },
      ],
      { ...OUT, fill: "forwards" },
    );
    let live = true;
    out.finished.then(
      () => {
        // Commit the new text here: left to a batched render, a click
        // landing first would read the advanced shownRef while the old
        // number is still on screen, and the count and the display would
        // disagree for good.
        if (live) flushSync(() => swap(dir));
      },
      () => {}, // cancelled by a newer step, which takes over
    );
    return () => {
      live = false;
    };
  }, [value]);

  // The in half runs after the new text commits, before paint, so the new
  // number never flashes at rest between the halves.
  useLayoutEffect(() => {
    const dir = pendingIn.current;
    const el = ref.current;
    if (!dir || !el) return;
    pendingIn.current = 0;
    cancelRoll(el);
    el.animate(
      [
        { transform: `translateY(${dir * ROLL_PX}px)`, opacity: 0 },
        { transform: "translateY(0)", opacity: 1 },
      ],
      IN,
    );
  }, [shown]);

  return { ref, shown };
}
