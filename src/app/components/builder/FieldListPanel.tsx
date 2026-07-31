import React, { useRef, useState } from "react";
import { AlignLeft, ChevronDown, GripVertical, Image as ImageIcon, Pin, Shapes, Type as TypeIcon } from "lucide-react";
import type { FieldType, TemplateField } from "@/lib/types";

const ICONS: Record<FieldType, React.ComponentType<{ style?: React.CSSProperties }>> = {
  text: TypeIcon,
  multiline: AlignLeft,
  image: ImageIcon,
  select: ChevronDown,
  shape: Shapes,
};

interface FieldListPanelProps {
  fields: TemplateField[];
  selectedIds: string[];
  onSelect(ids: string[]): void;
  /** Reorder = the member FORM order (canvas z-order is separate). */
  onReorder(fields: TemplateField[]): void;
  onContextMenu(e: React.MouseEvent, fieldId: string): void;
}

/** The Fields step's field list: every field, in member-form order. Click to
 * select/edit (syncs with the canvas), ⌘/Ctrl-click for multi-select, drag
 * the grip to reorder the end-user form. */
export function FieldListPanel({ fields, selectedIds, onSelect, onReorder, onContextMenu }: FieldListPanelProps) {
  const dragIndex = useRef<number | null>(null);
  const overIndexRef = useRef<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null); // highlight only

  const drop = () => {
    const from = dragIndex.current;
    const to = overIndexRef.current;
    dragIndex.current = null;
    overIndexRef.current = null;
    setOverIndex(null);
    if (from === null || to === null || from === to) return;
    const next = [...fields];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onReorder(next);
  };

  return (
    <div className="sp-card p-3 space-y-2">
      <div className="flex items-baseline justify-between">
        <h3 className="sp-eyebrow">Form order</h3>
        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>The order your team fills these in.</span>
      </div>
      {fields.length === 0 ? (
        <p className="py-4 text-center" style={{ fontSize: 12, color: "var(--text-muted)" }}>
          No fields yet — drag an element onto the canvas.
        </p>
      ) : (
        <div className="space-y-1">
          {(() => {
            // Form numbering skips fixed elements — they never appear in the
            // member form.
            let formStep = 0;
            return fields.map((f, i) => {
            const Icon = ICONS[f.type];
            const isSelected = selectedIds.includes(f.id);
            const stepNo = f.static ? null : ++formStep;
            return (
              <div
                key={f.id}
                draggable
                onDragStart={(e) => {
                  dragIndex.current = i;
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => {
                  if (dragIndex.current === null) return;
                  e.preventDefault();
                  overIndexRef.current = i;
                  setOverIndex(i);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  drop();
                }}
                onDragEnd={drop}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey) {
                    onSelect(
                      isSelected
                        ? selectedIds.filter((id) => id !== f.id)
                        : [...selectedIds, f.id],
                    );
                  } else {
                    onSelect([f.id]);
                  }
                }}
                onContextMenu={(e) => onContextMenu(e, f.id)}
                className="flex items-center gap-2 px-2 py-2 cursor-pointer"
                style={{
                  borderRadius: 8,
                  border: `1px solid ${isSelected ? "var(--state-primary)" : "var(--border)"}`,
                  background: isSelected
                    ? "var(--accent-wash)"
                    : overIndex === i && dragIndex.current !== null
                      ? "var(--bg-raised)"
                      : "var(--bg-surface)",
                }}
              >
                <GripVertical
                  style={{ width: 13, height: 13, color: "var(--text-disabled)", flexShrink: 0, cursor: "grab" }}
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
                  {stepNo === null ? (
                    <Pin style={{ width: 11, height: 11, color: "var(--state-primary)" }} />
                  ) : (
                    String(stepNo).padStart(2, "0")
                  )}
                </span>
                <Icon style={{ width: 13, height: 13, color: "var(--text-muted)", flexShrink: 0 }} />
                <span className="flex-1 truncate" style={{ fontSize: 12.5, color: "var(--text-primary)" }}>
                  {f.label}
                </span>
                <span
                  className="truncate"
                  style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--text-disabled)", maxWidth: 90 }}
                >
                  {f.static ? "fixed" : `{${f.fieldKey}}`}
                </span>
              </div>
            );
            });
          })()}
        </div>
      )}
      <p style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
        Drag to reorder. Layer order — what sits on top on the graphic — is
        separate: use "To front / To back" in the inspector.
      </p>
    </div>
  );
}
