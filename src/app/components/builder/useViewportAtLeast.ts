import { useEffect, useState } from "react";

/** The narrowest window the builder works in: the canvas, the palette and
 * the inspector side by side. Below it the builder says so, and New
 * template on the list goes straight there rather than through dialogs
 * whose result the builder couldn't open. */
export const BUILDER_MIN_VIEWPORT_PX = 1024;

/** Whether the window is at least `px` wide, kept current as it resizes. */
export function useViewportAtLeast(px: number): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(`(min-width: ${px}px)`).matches);
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${px}px)`);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [px]);
  return matches;
}
