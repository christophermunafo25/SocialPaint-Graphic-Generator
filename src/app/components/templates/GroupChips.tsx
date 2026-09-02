import React, { useRef } from "react";
import { ChevronRight, LayoutGrid } from "lucide-react";
import type { PlatformFacet } from "@/lib/templates/groups";
import type { PlatformIcon } from "@/lib/templates/platformIcons";
import type { PlatformId } from "@/lib/templates/platforms";
import { useEdgeFade } from "./useEdgeFade";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * Single-select filter over the catalogue's platforms — a radio group rather
 * than a tablist, since these filter one region in place instead of swapping
 * panels. One chip per platform, every shape: the shelves below stay grouped
 * down to the shape, the chip does not.
 *
 * Roving tabindex: one stop in the tab order, arrows move within the group
 * and select as they go, which is the standard radio-group contract.
 *
 * Each chip carries the platform's mark twice — the mono rendition at rest,
 * the colour one once the tile lights on hover or selection. Both sit in
 * the same 24px box so the swap never shifts layout; a platform with no
 * colour mark simply keeps its mono, which the lit tile turns white.
 */
export function GroupChips({
  facets,
  total,
  selected,
  onSelect,
}: {
  facets: PlatformFacet[];
  total: number;
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
    chipRefs.current[i]?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      focusAndSelect((activeIndex + 1) % ids.length);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      focusAndSelect((activeIndex - 1 + ids.length) % ids.length);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusAndSelect(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focusAndSelect(ids.length - 1);
    }
  };

  const chip = (
    id: PlatformId | null,
    index: number,
    label: string,
    count: number,
    Icon: PlatformIcon,
    ColorIcon?: PlatformIcon,
  ) => {
    const isSelected = selected === id;
    return (
      <button
        key={id ?? "all"}
        ref={(el) => {
          chipRefs.current[index] = el;
        }}
        type="button"
        role="radio"
        aria-checked={isSelected}
        tabIndex={isSelected ? 0 : -1}
        className="sp-platform-chip"
        data-selected={isSelected || undefined}
        onClick={() => onSelect(id)}
        onKeyDown={onKeyDown}
      >
        {/* The marks are decoration; the name is the label and the count. */}
        <span
          className="sp-platform-chip__tile"
          data-has-color={ColorIcon ? true : undefined}
          aria-hidden
        >
          <Icon className="sp-platform-chip__mark sp-platform-chip__mark--mono" strokeWidth={1.5} />
          {ColorIcon && (
            <ColorIcon className="sp-platform-chip__mark sp-platform-chip__mark--color" />
          )}
        </span>
        <span className="sp-platform-chip__text">
          <span className="sp-platform-chip__label">{label}</span>
          <span className="sp-platform-chip__count">{plural(count, "template")}</span>
        </span>
        <ChevronRight className="sp-platform-chip__chevron" strokeWidth={1.5} aria-hidden />
      </button>
    );
  };

  return (
    <div
      className="sp-railfade"
      data-at-start={atStart || undefined}
      data-at-end={atEnd || undefined}
    >
      <div
        ref={ref}
        className="sp-railfade__track sp-platform-chipbar"
        role="radiogroup"
        aria-label="Filter by platform"
      >
        {chip(null, 0, "All", total, LayoutGrid)}
        {facets.map((f, i) =>
          chip(
            f.platform.id,
            i + 1,
            f.platform.label,
            f.count,
            f.platform.Icon,
            f.platform.ColorIcon,
          ),
        )}
      </div>
    </div>
  );
}
