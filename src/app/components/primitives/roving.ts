import type React from "react";
import { useRef } from "react";

/** One-of-N keyboard model, carried over from generate/SegmentSwitch.tsx:
 * the group is one tab stop, on the selected item (or the first when none
 * matches). The arrows move and select as they go, wrapping at the ends
 * (Right and Down forward, Left and Up back), Home and End jump to the
 * first and last, and focus follows the selection. */
export function useRovingSelect<T>(
  items: readonly T[],
  selectedIndex: number,
  select: (item: T) => void,
) {
  const refs = useRef<Array<HTMLElement | null>>([]);
  const active = Math.max(0, selectedIndex);

  const move = (i: number) => {
    select(items[i]);
    refs.current[i]?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const n = items.length;
    if (n === 0) return;
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (active + 1) % n;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (active - 1 + n) % n;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = n - 1;
    if (next === null) return;
    e.preventDefault();
    move(next);
  };

  const itemProps = (i: number) => ({
    ref: (el: HTMLElement | null) => {
      refs.current[i] = el;
    },
    tabIndex: i === active ? 0 : -1,
    onKeyDown,
  });

  return { itemProps };
}
