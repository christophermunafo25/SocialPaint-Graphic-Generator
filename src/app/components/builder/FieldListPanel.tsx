import React, { useRef, useState } from "react";
import {
  AlignLeft,
  ChevronDown,
  ChevronRight,
  Frame,
  GripVertical,
  Image as ImageIcon,
  Pin,
  Shapes,
  Type as TypeIcon,
} from "lucide-react";
import type { FieldType, LayoutGroup, TemplateField } from "@/lib/types";
import { groupChildRef, parseGroupChildRef } from "@/lib/types";
import { outermostGroupOf, parentGroupOf } from "@/lib/render/layout";

const ICONS: Record<FieldType, React.ComponentType<{ style?: React.CSSProperties }>> = {
  text: TypeIcon,
  multiline: AlignLeft,
  image: ImageIcon,
  select: ChevronDown,
  shape: Shapes,
};

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

/** The Fields step's list: every field in member-form order, with grouped
 * fields nested under their stack (in STACK order — their form-step numbers
 * still read from the flat order, which grouping never changes). Click to
 * select (canvas-synced), ⌘/Ctrl-click multi-selects, drag the grip to
 * reorder: an ungrouped row or a whole group reorders the FORM; a row inside
 * a group reorders the STACK. */
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

  // Form-step numbers come from the FLAT fields order — nesting is display.
  const stepNoById = new Map<string, number | null>();
  {
    let n = 0;
    for (const f of fields) stepNoById.set(f.id, f.static ? null : ++n);
  }

  const byKey = new Map(fields.map((f) => [f.fieldKey, f]));
  const rows: Row[] = [];
  const seenGroups = new Set<string>();
  const pushGroup = (g: LayoutGroup, depth: number) => {
    seenGroups.add(g.id);
    rows.push({ kind: "group", group: g, depth });
    if (collapsed.has(g.id)) return;
    for (const ref of g.children) {
      const nestedId = parseGroupChildRef(ref);
      if (nestedId) {
        const nested = groups.find((x) => x.id === nestedId);
        if (nested && !seenGroups.has(nested.id)) pushGroup(nested, depth + 1);
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
  for (const f of fields) {
    const outer = outermostGroupOf(f.fieldKey, groups);
    if (!outer) {
      rows.push({ kind: "field", field: f, stepNo: stepNoById.get(f.id) ?? null, depth: 0 });
    } else if (!seenGroups.has(outer.id)) {
      pushGroup(outer, 0);
    }
  }

  /** Position of a field in the flat fields array. */
  const flatIndex = (fieldId: string) => fields.findIndex((f) => f.id === fieldId);

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
      const rest = g.children.filter((r) => r !== src.ref);
      const at = rest.indexOf(targetRef);
      if (at < 0) return;
      rest.splice(at, 0, src.ref);
      onReorderChildren(g.id, rest);
      return;
    }

    // FORM reorder: moving a single ungrouped field, or a group's fields as
    // one contiguous block, to the target row's position in the flat order.
    const targetField =
      target.kind === "field"
        ? target.field
        : fields.find((f) => target.group.children.includes(f.fieldKey));
    if (!targetField) return;
    const targetIdx = flatIndex(targetField.id);

    if (src.kind === "field") {
      const from = flatIndex(src.fieldId);
      if (from < 0 || from === targetIdx) return;
      const next = [...fields];
      const [moved] = next.splice(from, 1);
      next.splice(targetIdx, 0, moved);
      onReorder(next);
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
    const block = fields.filter((f) => memberKeys.has(f.fieldKey));
    const rest = fields.filter((f) => !memberKeys.has(f.fieldKey));
    const at = rest.findIndex((f) => f.id === targetField.id);
    if (at < 0) return;
    rest.splice(at, 0, ...block);
    onReorder(rest);
  };

  const rowKey = (r: Row) => (r.kind === "group" ? `g:${r.group.id}` : r.field.id);

  return (
    <div className="sp-card p-3 space-y-2">
      <div className="flex items-baseline justify-between">
        <h3 className="sp-eyebrow">Form order</h3>
        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
          The order your team fills these in.
        </span>
      </div>
      {fields.length === 0 ? (
        <p
          className="py-4 text-center"
          style={{ fontSize: "var(--type-caption-size)", color: "var(--text-muted)" }}
        >
          No fields yet — drag an element onto the canvas.
        </p>
      ) : (
        <div className="space-y-1">
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
                  draggable
                  onDragStart={() => {
                    if (r.depth === 0) {
                      dragSrc.current = { kind: "group", groupId: r.group.id };
                    } else {
                      // A nested group reorders within its PARENT's stack.
                      const parent = parentGroupOf(r.group.id, groups);
                      dragSrc.current = parent
                        ? { kind: "child", groupId: parent.id, ref: gref }
                        : { kind: "group", groupId: r.group.id };
                    }
                  }}
                  onDragOver={(e) => {
                    if (!dragSrc.current) return;
                    e.preventDefault();
                    setOverKey(key);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    drop(r);
                  }}
                  onDragEnd={() => drop(r)}
                  onClick={() => onSelect([gref])}
                  className="flex items-center gap-2 px-2 py-2 cursor-pointer"
                  style={{
                    marginLeft: r.depth * 14,
                    borderRadius: "var(--radius-control)",
                    border: `1px solid ${isSelected ? "var(--state-primary)" : "var(--border)"}`,
                    background: isSelected
                      ? "var(--accent-wash)"
                      : isOver
                        ? "var(--bg-raised)"
                        : "var(--bg-surface)",
                  }}
                >
                  <GripVertical
                    style={{
                      width: 13,
                      height: 13,
                      color: "var(--text-disabled)",
                      flexShrink: 0,
                      cursor: "grab",
                    }}
                  />
                  <button
                    aria-label={isCollapsed ? "Expand group" : "Collapse group"}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCollapsed((prev) => {
                        const next = new Set(prev);
                        if (next.has(r.group.id)) next.delete(r.group.id);
                        else next.add(r.group.id);
                        return next;
                      });
                    }}
                    className="flex items-center"
                    style={{ width: 16, flexShrink: 0, color: "var(--text-muted)" }}
                  >
                    {isCollapsed ? (
                      <ChevronRight style={{ width: 12, height: 12 }} />
                    ) : (
                      <ChevronDown style={{ width: 12, height: 12 }} />
                    )}
                  </button>
                  <Frame
                    style={{ width: 13, height: 13, color: "var(--text-muted)", flexShrink: 0 }}
                  />
                  <span
                    className="flex-1 truncate"
                    style={{ fontSize: 12.5, color: "var(--text-primary)" }}
                  >
                    {r.group.name}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 9.5,
                      color: "var(--text-disabled)",
                    }}
                  >
                    {r.group.mode === "free" ? "group" : "auto layout"}
                  </span>
                </div>
              );
            }
            const f = r.field;
            const Icon = ICONS[f.type];
            const isSelected = selectedIds.includes(f.id);
            return (
              <div
                key={key}
                draggable
                onDragStart={() => {
                  dragSrc.current = r.group
                    ? { kind: "child", groupId: r.group.id, ref: f.fieldKey }
                    : { kind: "field", fieldId: f.id };
                }}
                onDragOver={(e) => {
                  if (!dragSrc.current) return;
                  e.preventDefault();
                  setOverKey(key);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  drop(r);
                }}
                onDragEnd={() => drop(r)}
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
                className="flex items-center gap-2 px-2 py-2 cursor-pointer"
                style={{
                  marginLeft: r.depth * 14,
                  borderRadius: "var(--radius-control)",
                  border: `1px solid ${isSelected ? "var(--state-primary)" : "var(--border)"}`,
                  background: isSelected
                    ? "var(--accent-wash)"
                    : isOver
                      ? "var(--bg-raised)"
                      : "var(--bg-surface)",
                }}
              >
                <GripVertical
                  style={{
                    width: 13,
                    height: 13,
                    color: "var(--text-disabled)",
                    flexShrink: 0,
                    cursor: "grab",
                  }}
                />
                <span
                  className="flex items-center"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    color: "var(--text-muted)",
                    width: 16,
                    flexShrink: 0,
                  }}
                >
                  {r.stepNo === null ? (
                    <Pin style={{ width: 11, height: 11, color: "var(--state-primary)" }} />
                  ) : (
                    String(r.stepNo).padStart(2, "0")
                  )}
                </span>
                <Icon
                  style={{ width: 13, height: 13, color: "var(--text-muted)", flexShrink: 0 }}
                />
                <span
                  className="flex-1 truncate"
                  style={{ fontSize: 12.5, color: "var(--text-primary)" }}
                >
                  {f.label}
                </span>
                <span
                  className="truncate"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 9.5,
                    color: "var(--text-disabled)",
                    maxWidth: 90,
                  }}
                >
                  {f.static ? "fixed" : `{${f.fieldKey}}`}
                </span>
              </div>
            );
          })}
        </div>
      )}
      <p style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
        Drag to reorder the form. Rows inside a stack reorder the stack instead. Layer order — what
        sits on top on the graphic — is separate: use "To front / To back" in the inspector.
      </p>
    </div>
  );
}
