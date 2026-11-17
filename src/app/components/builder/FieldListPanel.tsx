import React, { useRef, useState } from "react";
import { ChevronDown, ChevronRight, GripVertical } from "lucide-react";
import type { LayoutGroup, TemplateField } from "@/lib/types";
import { groupChildRef, parseGroupChildRef } from "@/lib/types";
import { outermostGroupOf, parentGroupOf } from "@/lib/render/layout";
import { isRequiredField } from "@/lib/templates/fieldRules";
import { mergeVisibleOrder, mergeVisibleRefs } from "./formOrder";

interface FieldListPanelProps {
  fields: TemplateField[];
  groups: LayoutGroup[];
  selectedIds: string[];
  onSelect(ids: string[]): void;
  /** Reorder = the member FORM order (canvas z-order is separate). */
  onReorder(fields: TemplateField[]): void;
  /** Reorder a group's STACK order (a third ordering — not the form order). */
  onReorderChildren(groupId: string, children: string[]): void;
  onContextMenu(e: React.MouseEvent, fieldId: string): void;
}

type Row =
  | {
      kind: "field";
      field: TemplateField;
      stepNo: number | null;
      depth: number;
      group?: LayoutGroup;
    }
  | { kind: "group"; group: LayoutGroup; depth: number };

type DragSource =
  | { kind: "field"; fieldId: string }
  | { kind: "group"; groupId: string }
  | { kind: "child"; groupId: string; ref: string };

/** What the member actually sees a control for. Fixed elements and shapes
 * never reach the form. */
const inForm = (f: TemplateField) => !f.static && f.type !== "shape" && f.type !== "icon";

/** The Form tab's list, in Form Rows (321:64): the fields your team fills in,
 * in the order they fill them in, each with its number and "Optional" when
 * it may be left empty. Grouped fields nest under their stack (in STACK
 * order; their numbers still read from the flat order, which grouping never
 * changes). Fixed elements and shapes are not listed; the Layers tab is
 * where every element lives. Click to select (canvas-synced), Cmd or Ctrl
 * click multi-selects, and a drag reorders: an ungrouped row or a whole
 * group reorders the FORM, a row inside a group reorders the STACK.
 * Filtering is display only: every reorder still emits the complete array,
 * with the hidden elements exactly where they were (see formOrder.ts). */
export function FieldListPanel({
  fields,
  groups,
  selectedIds,
  onSelect,
  onReorder,
  onReorderChildren,
  onContextMenu,
}: FieldListPanelProps) {
  const dragSrc = useRef<DragSource | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const visible = fields.filter(inForm);

  // Form-step numbers come from the FLAT fields order — nesting is display.
  // Computed over the visible set, which holds nothing fixed, so the numbers
  // run contiguously down the list.
  const stepNoById = new Map<string, number | null>();
  {
    let n = 0;
    for (const f of visible) stepNoById.set(f.id, f.static ? null : ++n);
  }

  const byKey = new Map(visible.map((f) => [f.fieldKey, f]));
  const groupById = new Map(groups.map((g) => [g.id, g]));
  /** A group renders only when something inside it reaches the form. */
  const groupHasForm = (g: LayoutGroup, seen: Set<string>): boolean => {
    if (seen.has(g.id)) return false;
    seen.add(g.id);
    return g.children.some((ref) => {
      const nestedId = parseGroupChildRef(ref);
      if (nestedId) {
        const nested = groupById.get(nestedId);
        return nested ? groupHasForm(nested, seen) : false;
      }
      return byKey.has(ref);
    });
  };
  /** Whether a child ref shows on this tab: a visible field, or a nested
   * group with at least one visible descendant. */
  const refInForm = (ref: string): boolean => {
    const nestedId = parseGroupChildRef(ref);
    if (nestedId) {
      const nested = groupById.get(nestedId);
      return nested ? groupHasForm(nested, new Set()) : false;
    }
    return byKey.has(ref);
  };

  const rows: Row[] = [];
  const seenGroups = new Set<string>();
  const pushGroup = (g: LayoutGroup, depth: number) => {
    seenGroups.add(g.id);
    rows.push({ kind: "group", group: g, depth });
    if (collapsed.has(g.id)) return;
    for (const ref of g.children) {
      const nestedId = parseGroupChildRef(ref);
      if (nestedId) {
        const nested = groupById.get(nestedId);
        if (nested && !seenGroups.has(nested.id) && groupHasForm(nested, new Set())) {
          pushGroup(nested, depth + 1);
        }
        continue;
      }
      const f = byKey.get(ref);
      if (f)
        rows.push({
          kind: "field",
          field: f,
          stepNo: stepNoById.get(f.id) ?? null,
          depth: depth + 1,
          group: g,
        });
    }
  };
  // Walking the visible fields means a group whose members are all fixed is
  // never reached, so it disappears from Form and stays on Layers.
  for (const f of visible) {
    const outer = outermostGroupOf(f.fieldKey, groups);
    if (!outer) {
      rows.push({ kind: "field", field: f, stepNo: stepNoById.get(f.id) ?? null, depth: 0 });
    } else if (!seenGroups.has(outer.id)) {
      pushGroup(outer, 0);
    }
  }

  /** Position of a field in the VISIBLE list. Every splice below runs
   * against that list; mergeVisibleOrder puts the result back into the
   * full array without moving anything that was not shown. */
  const flatIndex = (fieldId: string) => visible.findIndex((f) => f.id === fieldId);

  /** Drop handler: what happens depends on what is dragged over what. */
  const drop = (target: Row) => {
    const src = dragSrc.current;
    dragSrc.current = null;
    setOverKey(null);
    if (!src) return;

    if (src.kind === "child") {
      // Stack reorder — valid only within the same group.
      const g = groups.find((x) => x.id === src.groupId);
      if (!g) return;
      const targetRef =
        target.kind === "field" && target.group?.id === g.id
          ? target.field.fieldKey
          : target.kind === "group" && g.children.includes(groupChildRef(target.group.id))
            ? groupChildRef(target.group.id)
            : null;
      if (!targetRef || targetRef === src.ref) return;
      // The stack can hold refs to fixed elements and shapes this tab does
      // not list. Reorder the shown refs, then put them back into the slots
      // they held, so a hidden child never moves and is never dropped.
      const shown = g.children.filter(refInForm);
      const rest = shown.filter((r) => r !== src.ref);
      const at = rest.indexOf(targetRef);
      if (at < 0) return;
      rest.splice(at, 0, src.ref);
      onReorderChildren(g.id, mergeVisibleRefs(g.children, rest));
      return;
    }

    // FORM reorder: moving a single ungrouped field, or a group's fields as
    // one contiguous block, to the target row's position in the flat order.
    const targetField =
      target.kind === "field"
        ? target.field
        : visible.find((f) => target.group.children.includes(f.fieldKey));
    if (!targetField) return;
    const targetIdx = flatIndex(targetField.id);

    if (src.kind === "field") {
      const from = flatIndex(src.fieldId);
      if (from < 0 || from === targetIdx) return;
      const next = [...visible];
      const [moved] = next.splice(from, 1);
      next.splice(targetIdx, 0, moved);
      onReorder(mergeVisibleOrder(fields, next));
      return;
    }

    const g = groups.find((x) => x.id === src.groupId);
    if (!g) return;
    const memberKeys = new Set<string>();
    const collect = (grp: LayoutGroup) => {
      for (const ref of grp.children) {
        const nid = parseGroupChildRef(ref);
        if (nid) {
          const nested = groups.find((x) => x.id === nid);
          if (nested) collect(nested);
        } else memberKeys.add(ref);
      }
    };
    collect(g);
    if (memberKeys.has(targetField.fieldKey)) return;
    const block = visible.filter((f) => memberKeys.has(f.fieldKey));
    const rest = visible.filter((f) => !memberKeys.has(f.fieldKey));
    const at = rest.findIndex((f) => f.id === targetField.id);
    if (at < 0) return;
    rest.splice(at, 0, ...block);
    onReorder(mergeVisibleOrder(fields, rest));
  };

  const rowKey = (r: Row) => (r.kind === "group" ? `g:${r.group.id}` : r.field.id);

  if (visible.length === 0) {
    return <p className="t-body-s sp-form-rows__empty">Your team has nothing to fill in yet.</p>;
  }

  const dragProps = (r: Row, key: string, start: () => void) => ({
    draggable: true,
    onDragStart: start,
    onDragOver: (e: React.DragEvent) => {
      if (!dragSrc.current) return;
      e.preventDefault();
      setOverKey(key);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      drop(r);
    },
    onDragEnd: () => drop(r),
  });

  return (
    <div className="sp-form-rows" role="list" aria-label="Form">
      {rows.map((r) => {
        const key = rowKey(r);
        const isOver = overKey === key && dragSrc.current !== null;
        if (r.kind === "group") {
          const gref = groupChildRef(r.group.id);
          const isSelected = selectedIds.includes(gref);
          const isCollapsed = collapsed.has(r.group.id);
          return (
            <div
              key={key}
              role="listitem"
              className="sp-form-row"
              data-selected={isSelected || undefined}
              data-over={isOver || undefined}
              style={{ "--layer-depth": r.depth } as React.CSSProperties}
              {...dragProps(r, key, () => {
                if (r.depth === 0) {
                  dragSrc.current = { kind: "group", groupId: r.group.id };
                } else {
                  // A nested group reorders within its PARENT's stack.
                  const parent = parentGroupOf(r.group.id, groups);
                  dragSrc.current = parent
                    ? { kind: "child", groupId: parent.id, ref: gref }
                    : { kind: "group", groupId: r.group.id };
                }
              })}
              onClick={() => onSelect([gref])}
            >
              <GripVertical size={16} className="ui-icon sp-form-row__grip" aria-hidden />
              <button
                type="button"
                className="ui-reset ui-ring sp-form-row__twisty"
                aria-expanded={!isCollapsed}
                aria-label={`${r.group.name}, ${isCollapsed ? "expand" : "collapse"}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setCollapsed((prev) => {
                    const next = new Set(prev);
                    if (next.has(r.group.id)) next.delete(r.group.id);
                    else next.add(r.group.id);
                    return next;
                  });
                }}
              >
                {isCollapsed ? (
                  <ChevronRight size={16} className="ui-icon" aria-hidden />
                ) : (
                  <ChevronDown size={16} className="ui-icon" aria-hidden />
                )}
              </button>
              <button
                type="button"
                className="ui-reset ui-ring sp-form-row__main"
                aria-pressed={isSelected}
              >
                <span className="t-label-s sp-form-row__name">{r.group.name}</span>
              </button>
            </div>
          );
        }
        const f = r.field;
        const isSelected = selectedIds.includes(f.id);
        return (
          <div
            key={key}
            role="listitem"
            className="sp-form-row"
            data-selected={isSelected || undefined}
            data-over={isOver || undefined}
            style={{ "--layer-depth": r.depth } as React.CSSProperties}
            {...dragProps(r, key, () => {
              dragSrc.current = r.group
                ? { kind: "child", groupId: r.group.id, ref: f.fieldKey }
                : { kind: "field", fieldId: f.id };
            })}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey) {
                onSelect(
                  isSelected ? selectedIds.filter((id) => id !== f.id) : [...selectedIds, f.id],
                );
              } else {
                onSelect([f.id]);
              }
            }}
            onContextMenu={(e) => onContextMenu(e, f.id)}
          >
            <GripVertical size={16} className="ui-icon sp-form-row__grip" aria-hidden />
            <button
              type="button"
              className="ui-reset ui-ring sp-form-row__main"
              aria-pressed={isSelected}
            >
              <span className="t-mono-s sp-form-row__number">
                {String(r.stepNo ?? 0).padStart(2, "0")}
              </span>
              <span className="t-label-s sp-form-row__name">{f.label}</span>
              {!isRequiredField(f) && (
                <span className="t-caption-m sp-form-row__meta">Optional</span>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
