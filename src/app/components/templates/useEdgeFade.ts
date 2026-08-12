import { useCallback, useEffect, useRef, useState } from "react";

export interface EdgeFade {
  atStart: boolean;
  atEnd: boolean;
  /** Re-measure on demand — after a scroll-by, or when content changes. */
  measure(): void;
}

/** Tracks how far a horizontal track is scrolled so the caller can hide the
 *  fade mask at whichever end has nothing left to reveal. Shared by the
 *  platform chip bar and the template shelves so both behave identically.
 *
 *  `deps` re-measures when the track's contents change — a ResizeObserver on
 *  the track alone misses a change in scrollWidth when the box itself is
 *  unchanged. */
export function useEdgeFade<T extends HTMLElement>(
  deps: unknown[] = [],
): EdgeFade & {
  ref: React.RefObject<T | null>;
} {
  const ref = useRef<T>(null);
  const [state, setState] = useState({ atStart: true, atEnd: true });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setState({ atStart: el.scrollLeft <= 1, atEnd: max <= 1 || el.scrollLeft >= max - 1 });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      ro.disconnect();
    };
  }, [measure]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(measure, deps);

  return { ref, ...state, measure };
}
