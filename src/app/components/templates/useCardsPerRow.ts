import { useLayoutEffect, useState } from "react";
import { cardsPerRow } from "@/lib/templates/libraryLayout";

/**
 * How many shelf cards one row of the library shows in full, kept current
 * as the page resizes (premium polish D11). It reads the width from the
 * library's body and two values from the stylesheet, so the CSS stays the
 * one source for them: `--_shelf-gap`, the gap between a shelf's cards, and
 * `--_lib-gutter`, the side gutter the body's rows take where the page
 * bleeds to the screen's edge (a phone). Zero until the body is measured.
 */
export function useCardsPerRow(body: HTMLElement | null): number {
  const [perRow, setPerRow] = useState(0);
  useLayoutEffect(() => {
    if (!body) return;
    const measure = () => {
      const style = getComputedStyle(body);
      const gap = parseFloat(style.getPropertyValue("--_shelf-gap")) || 0;
      const gutter = parseFloat(style.getPropertyValue("--_lib-gutter")) || 0;
      setPerRow(cardsPerRow(body.clientWidth - 2 * gutter, gap));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(body);
    return () => observer.disconnect();
  }, [body]);
  return perRow;
}
