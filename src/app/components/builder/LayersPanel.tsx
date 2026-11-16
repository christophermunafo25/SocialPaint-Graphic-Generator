import React, { useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Columns3,
  Eye,
  EyeOff,
  Group as GroupGlyph,
  Lock,
  Pin,
  Rows3,
} from "lucide-react";
import type { LayoutGroup, TemplateField } from "@/lib/types";
import { groupChildRef, parseGroupChildRef } from "@/lib/types";
import { outermostGroupOf } from "@/lib/render/layout";
import { paintOrder } from "./fieldOps";
import { elementIcon } from "./elementIcons";
import { IconButton, Input } from "../primitives";

interface LayersPanelProps {
  fields: TemplateField[];
  groups: LayoutGroup[];
  selectedIds: string[];
  onSelect(ids: string[]): void;
  /** Commit a new BACK-TO-FRONT order of field ids. */
  onPaintOrder(backToFront: string[]): void;
  /** Rename writes `label` and nothing else — never the merge tag. */
  onRename(fieldId: string, label: string): void;
  /** Hide and pin are editing aids for this session only: never saved, never
   * in the export, never in what your team sees. Pinned is `lockedIds`: the
   * element can't be selected or dragged on the canvas. */
  lockedIds: Set<string>;
  hiddenIds: Set<string>;
  onToggleLocked(fieldId: string): void;
  onToggleHidden(fieldId: string): void;
  onContextMenu(e: React.MouseEvent, fieldId: string): void;
  /** True for an image that is one of the brand's logos. */
  isLogo?(field: TemplateField): boolean;
}

const groupGlyph = (g: LayoutGroup) =>
  g.mode === "stack" ? (g.direction === "horizontal" ? Columns3 : Rows3) : GroupGlyph;

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

/** The Layers list (322:203): paint order, frontmost at the top, in Layer
 * Rows (321:30). A fixed element carries the lock, as drawn; your team never
 * edits it. Hide and Pin show on a row's hover or focus, and stay while
 * they are on. A drag reorders siblings and rewrites zIndex, nothing else;
 * the Form tab's order is separate. Double-click or F2 renames. */
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
  isLogo,
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

  if (!rows.length) return null;

  const select = (e: React.MouseEvent, key: string, isSelected: boolean) => {
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      onSelect(isSelected ? selectedIds.filter((id) => id !== key) : [...selectedIds, key]);
    } else {
      onSelect([key]);
    }
  };

  const toggleCollapsed = (groupId: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });

  return (
    <div className="sp-layers" role="list" aria-label="Layers">
      {rows.map((n) => {
        const f = n.field;
        const g = n.group;
        const isSelected = selectedIds.includes(n.key);
        const isOver = overKey === n.key && dragKey.current !== null;
        const isCollapsed = g ? collapsed.has(g.id) : false;
        const locked = f ? lockedIds.has(f.id) : false;
        const hidden = f ? hiddenIds.has(f.id) : false;
        const isRenaming = Boolean(f && renaming === f.id);
        const Icon = f ? elementIcon(f, isLogo?.(f) ?? false) : g ? groupGlyph(g) : GroupGlyph;
        const name = f ? f.label : (g?.name ?? "");
        return (
          <div
            key={n.key}
            role="listitem"
            className="sp-layer"
            data-selected={isSelected || undefined}
            data-over={isOver || undefined}
            data-muted={hidden || undefined}
            style={{ "--layer-depth": n.depth } as React.CSSProperties}
            draggable={!isRenaming}
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
            onClick={(e) => select(e, n.key, isSelected)}
            onDoubleClick={() => f && setRenaming(f.id)}
            onContextMenu={(e) => f && onContextMenu(e, f.id)}
          >
            {g && (
              <button
                type="button"
                className="ui-reset ui-ring sp-layer__twisty"
                aria-expanded={!isCollapsed}
                aria-label={`${g.name}, ${isCollapsed ? "expand" : "collapse"}`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleCollapsed(g.id);
                }}
              >
                {isCollapsed ? (
                  <ChevronRight size={16} className="ui-icon" aria-hidden />
                ) : (
                  <ChevronDown size={16} className="ui-icon" aria-hidden />
                )}
              </button>
            )}
            {isRenaming && f ? (
              <span className="sp-layer__main">
                <Icon size={16} className="ui-icon" aria-hidden />
                <Input
                  size="sm"
                  autoFocus
                  defaultValue={f.label}
                  aria-label="Name"
                  className="sp-layer__rename"
                  onClick={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => e.stopPropagation()}
                  onBlur={(e) => {
                    const next = e.currentTarget.value.trim();
                    if (next && next !== f.label) onRename(f.id, next);
                    setRenaming(null);
                  }}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") e.currentTarget.blur();
                    if (e.key === "Escape") {
                      e.currentTarget.value = f.label;
                      e.currentTarget.blur();
                    }
                  }}
                />
              </span>
            ) : (
              <button
                type="button"
                className="ui-reset ui-ring sp-layer__main"
                aria-pressed={isSelected}
                aria-label={f?.static ? `${name}, fixed` : undefined}
                onKeyDown={(e) => {
                  if (e.key === "F2" && f) {
                    e.preventDefault();
                    setRenaming(f.id);
                  }
                }}
              >
                <Icon size={16} className="ui-icon" aria-hidden />
                <span className="t-body-s sp-layer__name">{name}</span>
              </button>
            )}
            {f && !isRenaming && (
              <span className="sp-layer__aids">
                <IconButton
                  variant="ghost"
                  size="sm"
                  icon={hidden ? EyeOff : Eye}
                  label={`Hide ${f.label}`}
                  aria-pressed={hidden}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleHidden(f.id);
                  }}
                />
                <IconButton
                  variant="ghost"
                  size="sm"
                  icon={Pin}
                  label={`Pin ${f.label}`}
                  aria-pressed={locked}
                  selected={locked}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleLocked(f.id);
                  }}
                />
              </span>
            )}
            {f?.static && <Lock size={16} className="ui-icon sp-layer__fixed" aria-hidden />}
          </div>
        );
      })}
    </div>
  );
}
