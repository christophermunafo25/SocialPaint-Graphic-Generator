import { useLayoutEffect, useRef } from "react";

/**
 * Entrance animation, once, when a section scrolls into view.
 *
 * The element is only armed — given its hidden rest state — from inside this
 * effect, so the animation is opt-in on JS actually running. If the script
 * never executes, or an observer never fires, the content is simply visible
 * rather than stuck at `opacity: 0`.
 *
 * Reduced motion is handled in CSS rather than here: the states still change,
 * they just don't travel.
 */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.dataset.reveal = "armed";

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          el.dataset.reveal = "in";
          io.disconnect();
        }
      },
      // A sliver is enough — the row shouldn't wait to be fully on screen.
      { threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return ref;
}

/** Per-item stagger index, capped so a long row's last card doesn't sit and
 *  wait through the whole sequence. */
export const revealIndex = (i: number): React.CSSProperties =>
  ({ "--reveal-i": Math.min(i, 7) }) as React.CSSProperties;
