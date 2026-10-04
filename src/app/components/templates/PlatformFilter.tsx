import React, { useRef } from "react";
import type { PlatformFacet } from "@/lib/templates/groups";
import type { PlatformId } from "@/lib/templates/platforms";
import { PlatformChip } from "../primitives";
import { useEdgeFade } from "./useEdgeFade";

/**
 * The library's platform chips (13:5776): All, then one chip per platform,
 * single-select. A radio group rather than a tablist, since the chips
 * filter one region in place instead of swapping panels.
 *
 * Roving tabindex: one stop in the tab order, arrows (and Home and End)
 * move within the group and select as they go, the radio-group contract.
 * The chips scroll horizontally behind the shelves' right-edge fade when
 * they outrun the bar (PHASE-4.md §8). A chip has no menu: selected, its
 * chevron turns down, as the component draws it.
 */
export function PlatformFilter({
  facets,
  selected,
  onSelect,
}: {
  facets: PlatformFacet[];
  /** null is the "All" chip. */
  selected: PlatformId | null;
  onSelect(next: PlatformId | null): void;
}) {
  const { ref, atStart, atEnd } = useEdgeFade<HTMLDivElement>([facets.length]);
  const chipRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const ids: Array<PlatformId | null> = [null, ...facets.map((f) => f.platform.id)];
  const activeIndex = Math.max(0, ids.indexOf(selected));

  const focusAndSelect = (i: number) => {
    onSelect(ids[i]);
    const chip = chipRefs.current[i];
    chip?.focus();
    // focus() leaves a chip that is partly visible where it is, cut off at
    // the rail's edge; the track's scroll padding keeps its ring clear.
    chip?.scrollIntoView({ inline: "nearest", block: "nearest" });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const last = ids.length - 1;
    const next =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? (activeIndex + 1) % ids.length
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? (activeIndex - 1 + ids.length) % ids.length
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? last
              : null;
    if (next === null) return;
    e.preventDefault();
    focusAndSelect(next);
  };

  return (
    <div
      className="sp-lib-rail sp-lib-chips"
      data-at-start={atStart || undefined}
      data-at-end={atEnd || undefined}
    >
      <div
        ref={ref}
        className="sp-lib-rail__track sp-lib-chips__track"
        role="radiogroup"
        aria-label="Filter by platform"
      >
        {ids.map((id, i) => {
          const isSelected = selected === id;
          const label = id === null ? "All" : facets[i - 1].platform.label;
          return (
            <PlatformChip
              key={id ?? "all"}
              ref={(el) => {
                chipRefs.current[i] = el;
              }}
              platform={id ?? "all"}
              selected={isSelected}
              role="radio"
              aria-checked={isSelected}
              tabIndex={i === activeIndex ? 0 : -1}
              onClick={() => onSelect(id)}
              onKeyDown={onKeyDown}
            >
              {label}
            </PlatformChip>
          );
        })}
      </div>
    </div>
  );
}
