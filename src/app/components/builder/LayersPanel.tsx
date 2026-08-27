import React, { useRef, useState } from "react";
import {
  AlignLeft,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Frame,
  GripVertical,
  Image as ImageIcon,
  Lock,
  Shapes,
  Type as TypeIcon,
  Unlock,
} from "lucide-react";
import type { FieldType, LayoutGroup, TemplateField } from "@/lib/types";
import { groupChildRef, parseGroupChildRef } from "@/lib/types";
import { outermostGroupOf } from "@/lib/render/layout";
import { paintOrder } from "./fieldOps";

const ICONS: Record<FieldType, React.ComponentType<{ style?: React.CSSProperties }>> = {
  text: TypeIcon,
  multiline: AlignLeft,
  image: ImageIcon,
  select: ChevronDown,
  shape: Shapes,
};

interface LayersPanelProps {
  fields: TemplateField[];
  groups: LayoutGroup[];
  selectedIds: string[];
  onSelect(ids: string[]): void;
  /** Commit a new BACK-TO-FRONT order of field ids. */
  onPaintOrder(backToFront: string[]): void;
  /** Rename writes `label` and nothing else — never the merge tag. */
  onRename(fieldId: string, label: string): void;
  /** Session-only, both of them. See the note at the foot of the panel. */
  lockedIds: Set<string>;
  hiddenIds: Set<string>;
  onToggleLocked(fieldId: string): void;
  onToggleHidden(fieldId: string): void;
  onContextMenu(e: React.MouseEvent, fieldId: string): void;
}

/** One entry in the paint-order tree. A group is not itself painted, so it
 * takes the z of its frontmost member — that is where the group reads as
 * sitting in the stack, and it is what dragging the group row moves. */
interface Node {
  key: string;
  z: number;
  depth: number;
  /** Every field id underneath, back to front — what a drag actually moves. */
  fieldIds: string[];
  field?: TemplateField;
  group?: LayoutGroup;
  children: Node[];
}

function buildTree(fields: TemplateField[], groups: LayoutGroup[]): Node[] {
  const byKey = new Map(fields.map((f) => [f.fieldKey, f]));
  const zOf = new Map(paintOrder(fields).map((f, i) => [f.id, i]));

  const fieldNode = (f: TemplateField, depth: number): Node => ({
    key: f.id,
    z: zOf.get(f.id) ?? 0,
    depth,
    fieldIds: [f.id],
    field: f,
    children: [],
  });

  const groupNode = (g: LayoutGroup, depth: number, seen: Set<string>): Node | null => {
    if (seen.has(g.id)) return null;
    seen.add(g.id);
    const children: Node[] = [];
    for (const ref of g.children) {
      const nestedId = parseGroupChildRef(ref);
      if (nestedId !== null) {
        const nested = groups.find((x) => x.id === nestedId);
        const node = nested ? groupNode(nested, depth + 1, seen) : null;
        if (node) children.push(node);
        continue;
      }
      const f = byKey.get(ref);
      if (f) children.push(fieldNode(f, depth + 1));
    }
    if (!children.length) return null;
    // Frontmost first, top of the list — the way a layers panel reads.
    children.sort((a, b) => b.z - a.z);
    return {
      key: groupChildRef(g.id),
      z: Math.max(...children.map((c) => c.z)),
      depth,
      // Back to front, so a group drag preserves its members' relative order.
      fieldIds: [...children].reverse().flatMap((c) => c.fieldIds),
      group: g,
      children,
    };
  };

  const roots: Node[] = [];
  const claimed = new Set<string>();
  for (const f of fields) {
    const outer = outermostGroupOf(f.fieldKey, groups);
    if (!outer) {
      roots.push(fieldNode(f, 0));
      continue;
    }
    if (claimed.has(outer.id)) continue;
    claimed.add(outer.id);
    const node = groupNode(outer, 0, new Set());
    if (node) roots.push(node);
  }
  roots.sort((a, b) => b.z - a.z);
  return roots;
}

/** Flatten the tree back into a BACK-TO-FRONT id list — the shape
 * applyPaintOrder wants. */
function flatten(nodes: Node[]): string[] {
  return [...nodes].reverse().flatMap((n) => n.fieldIds);
}

/** Paint order, frontmost at the top: what the graphic actually stacks like.
 * Deliberately a different list from the Form tab beside it — that one is the
 * order members fill things in, and the two are independent. Dragging here
 * rewrites zIndex and nothing else. */
export function LayersPanel({
  fields,
  groups,
  selectedIds,
  onSelect,
  onPaintOrder,
  onRename,
  lockedIds,
  hiddenIds,
  onToggleLocked,
  onToggleHidden,
  onContextMenu,
}: LayersPanelProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [renaming, setRenaming] = useState<string | null>(null);
  const dragKey = useRef<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);

  const roots = buildTree(fields, groups);

  /** Rows to render, honouring collapse. */
  const rows: Node[] = [];
  const walk = (nodes: Node[]) => {
    for (const n of nodes) {
      rows.push(n);
      if (n.group && !collapsed.has(n.group.id)) walk(n.children);
    }
  };
  walk(roots);

  /** Move the dragged node to where the drop landed. Reordering happens
   * among SIBLINGS: a row can change its place in the stack, but a drag
   * never pulls an element into or out of a group — grouping is the group's
   * business, and doing it by accident here would be a nasty surprise. */
  const drop = (target: Node) => {
    const from = dragKey.current;
    dragKey.current = null;
    setOverKey(null);
    if (!from || from === target.key) return;

    const siblingsOf = (key: string): Node[] | null => {
      if (roots.some((n) => n.key === key)) return roots;
      const find = (nodes: Node[]): Node[] | null => {
        for (const n of nodes) {
          if (n.children.some((c) => c.key === key)) return n.children;
          const deeper = find(n.children);
          if (deeper) return deeper;
        }
        return null;
      };
      return find(roots);
    };

    const list = siblingsOf(from);
    if (!list || list !== siblingsOf(target.key)) return;
    const fromIdx = list.findIndex((n) => n.key === from);
    const toIdx = list.findIndex((n) => n.key === target.key);
    if (fromIdx < 0 || toIdx < 0) return;
    const next = [...list];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);

    // Rebuild the whole tree's flat order with this sibling list swapped in.
    const rebuild = (nodes: Node[]): Node[] =>
      nodes === list ? next : nodes.map((n) => ({ ...n, children: rebuild(n.children) }));
    const reordered = rebuild(roots).map((n) => ({
      ...n,
      fieldIds: n.group
        ? [...rebuild(n.children)].reverse().flatMap((c) => c.fieldIds)
        : n.fieldIds,
    }));
    onPaintOrder(flatten(reordered));
  };

  if (!fields.length) {
    return (
      <div className="px-3 py-4">
        <p style={{ fontSize: "var(--type-caption-size)", color: "var(--text-muted)" }}>
          Nothing on the canvas yet. What you add here stacks front to back — the top row paints
          over everything under it.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p style={{ fontSize: 10.5, color: "var(--text-muted)", padding: "0 2px" }}>
        Front to back. Drag a row to change what paints over what — this is the graphic's stacking,
        not the order your team fills things in.
      </p>
      <div className="space-y-1">
        {rows.map((n) => {
          const isGroup = Boolean(n.group);
          const f = n.field;
          const isSelected = selectedIds.includes(n.key);
          const isOver = overKey === n.key && dragKey.current !== null;
          const isCollapsed = n.group ? collapsed.has(n.group.id) : false;
          const locked = f ? lockedIds.has(f.id) : false;
          const hidden = f ? hiddenIds.has(f.id) : false;
          const Icon = f ? (ICONS[f.type] ?? Shapes) : Frame;
          return (
            <div
              key={n.key}
              draggable={renaming !== n.key}
              onDragStart={() => {
                dragKey.current = n.key;
              }}
              onDragOver={(e) => {
                if (!dragKey.current) return;
                e.preventDefault();
                setOverKey(n.key);
              }}
              onDrop={(e) => {
                e.preventDefault();
                drop(n);
              }}
              onDragEnd={() => drop(n)}
              onClick={(e) => {
                if (e.shiftKey || e.metaKey || e.ctrlKey) {
                  onSelect(
                    isSelected ? selectedIds.filter((id) => id !== n.key) : [...selectedIds, n.key],
                  );
                } else {
                  onSelect([n.key]);
                }
              }}
              onDoubleClick={() => f && setRenaming(f.id)}
              onContextMenu={(e) => f && onContextMenu(e, f.id)}
              className="flex items-center gap-1.5 px-2 py-1.5 cursor-pointer"
              style={{
                marginLeft: n.depth * 14,
                borderRadius: "var(--radius-control)",
                border: `1px solid ${isSelected ? "var(--state-primary)" : "var(--border)"}`,
                background: isSelected
                  ? "var(--accent-wash)"
                  : isOver
                    ? "var(--bg-raised)"
                    : "var(--bg-surface)",
                opacity: hidden ? 0.5 : 1,
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
              {isGroup && (
                <button
                  aria-label={isCollapsed ? "Expand group" : "Collapse group"}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCollapsed((prev) => {
                      const nextSet = new Set(prev);
                      if (n.group && nextSet.has(n.group.id)) nextSet.delete(n.group.id);
                      else if (n.group) nextSet.add(n.group.id);
                      return nextSet;
                    });
                  }}
                  className="flex items-center"
                  style={{ width: 14, flexShrink: 0, color: "var(--text-muted)" }}
                >
                  {isCollapsed ? (
                    <ChevronRight style={{ width: 12, height: 12 }} />
                  ) : (
                    <ChevronDown style={{ width: 12, height: 12 }} />
                  )}
                </button>
              )}
              <Icon style={{ width: 13, height: 13, color: "var(--text-muted)", flexShrink: 0 }} />
              {renaming === n.key || (f && renaming === f.id) ? (
                <input
                  autoFocus
                  defaultValue={f?.label ?? ""}
                  aria-label="Element name"
                  onClick={(e) => e.stopPropagation()}
                  onBlur={(e) => {
                    if (f && e.target.value.trim()) onRename(f.id, e.target.value.trim());
                    setRenaming(null);
                  }}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    if (e.key === "Escape") {
                      (e.target as HTMLInputElement).value = f?.label ?? "";
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  className="flex-1 min-w-0"
                  style={{
                    fontSize: 12.5,
                    background: "var(--bg-raised)",
                    border: "1px solid var(--border-strong)",
                    borderRadius: 3,
                    padding: "1px 4px",
                    color: "var(--text-primary)",
                  }}
                />
              ) : (
                <span
                  className="flex-1 truncate"
                  title={f ? `${f.label} — double-click to rename` : n.group?.name}
                  style={{ fontSize: 12.5, color: "var(--text-primary)" }}
                >
                  {f ? f.label : n.group?.name}
                </span>
              )}
              {f && (
                <span
                  title={
                    f.static ? "Fixed — members never see or edit this" : "Members fill this one in"
                  }
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 9.5,
                    color: f.static ? "var(--text-muted)" : "var(--state-primary)",
                    flexShrink: 0,
                  }}
                >
                  {f.static ? "fixed" : "fills in"}
                </span>
              )}
              {f && (
                <>
                  <button
                    aria-label={hidden ? `Show ${f.label}` : `Hide ${f.label} while editing`}
                    title={
                      hidden
                        ? "Show on the canvas again"
                        : "Hide while you work — it still exports and members still see it"
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleHidden(f.id);
                    }}
                    className="flex items-center flex-shrink-0"
                    style={{ width: 16, color: "var(--text-muted)" }}
                  >
                    {hidden ? (
                      <EyeOff style={{ width: 12, height: 12 }} />
                    ) : (
                      <Eye style={{ width: 12, height: 12 }} />
                    )}
                  </button>
                  <button
                    aria-label={locked ? `Unlock ${f.label}` : `Lock ${f.label} while editing`}
                    title={
                      locked
                        ? "Let it be selected on the canvas again"
                        : "Keep it from being selected or dragged while you work"
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleLocked(f.id);
                    }}
                    className="flex items-center flex-shrink-0"
                    style={{
                      width: 16,
                      color: locked ? "var(--text-primary)" : "var(--text-muted)",
                    }}
                  >
                    {locked ? (
                      <Lock style={{ width: 12, height: 12 }} />
                    ) : (
                      <Unlock style={{ width: 12, height: 12 }} />
                    )}
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
      <p style={{ fontSize: 10.5, color: "var(--text-muted)", padding: "0 2px" }}>
        Hiding and locking only affect this editing session. They are never saved, never change the
        exported graphic, and never change what your team sees.
      </p>
    </div>
  );
}
