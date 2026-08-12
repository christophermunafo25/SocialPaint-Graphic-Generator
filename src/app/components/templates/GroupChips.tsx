import React, { useRef } from "react";
import { LayoutGrid } from "lucide-react";
import type { TemplateGroup } from "@/lib/templates/groups";
import { useEdgeFade } from "./useEdgeFade";

/**
 * Single-select filter over the catalogue's groups — a radio group rather
 * than a tablist, since these filter one region in place instead of swapping
 * panels.
 *
 * Roving tabindex: one stop in the tab order, arrows move within the group
 * and select as they go, which is the standard radio-group contract.
 */
export function GroupChips({
  groups,
  total,
  selected,
  onSelect,
}: {
  groups: TemplateGroup[];
  total: number;
  /** null is the "All" chip. */
  selected: string | null;
  onSelect(next: string | null): void;
}) {
  const { ref, atStart, atEnd } = useEdgeFade<HTMLDivElement>([groups.length]);
  const chipRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const ids: Array<string | null> = [null, ...groups.map((g) => g.id)];
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
    id: string | null,
    index: number,
    label: string,
    count: number,
    Icon: typeof LayoutGrid,
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
        className="sp-chip"
        data-selected={isSelected || undefined}
        onClick={() => onSelect(id)}
        onKeyDown={onKeyDown}
      >
        <Icon className="sp-chip__icon" strokeWidth={1.5} aria-hidden />
        <span className="sp-chip__label">{label}</span>
        <span className="sp-chip__count">{count}</span>
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
        className="sp-railfade__track sp-chipbar"
        role="radiogroup"
        aria-label="Filter by platform and shape"
      >
        {chip(null, 0, "All", total, LayoutGrid)}
        {groups.map((g, i) => chip(g.id, i + 1, g.label, g.templates.length, g.platform.Icon))}
      </div>
    </div>
  );
}
