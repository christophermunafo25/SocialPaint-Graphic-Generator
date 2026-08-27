import React, { useEffect, useRef, useState } from "react";
import { ArrowUp, Group, Trash2, Ungroup } from "lucide-react";
import type { TemplateField } from "@/lib/types";
import { AlignControls } from "./AlignControls";
import { NumericField } from "./InspectorControls";
import { ColorControl } from "../ColorControl";
import type { AlignEdge, Axis } from "./alignOps";

interface SelectionToolbarProps {
  /** How many things are selected — decides which face the toolbar wears. */
  count: number;
  /** The lone selected field, when the selection is exactly one. */
  single: TemplateField | null;
  /** True when the lone selection is a group frame rather than a field. */
  isGroup: boolean;
  groupable: boolean;
  onAlign(axis: Axis, edge: AlignEdge): void;
  onDistribute(axis: Axis): void;
  alignDisabledReason?: string;
  distributeDisabledReason?: string;
  onGroup(): void;
  onUngroup(): void;
  onBringForward(): void;
  onDelete(): void;
  onPatchSingle(patch: Partial<TemplateField>): void;
  /** Properties the bound brand type style owns for the lone selection. */
  singleLocked?: Set<string>;
}

function Divider() {
  return (
    <span
      aria-hidden
      style={{ width: 1, alignSelf: "stretch", background: "var(--border)", margin: "0 2px" }}
    />
  );
}

function ToolbarButton({
  title,
  onClick,
  disabled,
  destructive,
  children,
}: {
  title: string;
  onClick(): void;
  disabled?: boolean;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className="flex items-center justify-center"
      data-radius-control
      style={{
        width: 26,
        height: 26,
        color: destructive ? "var(--destructive)" : "var(--text-secondary)",
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? "default" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

/** The fill swatch, for a single text element. It writes exactly what the
 * inspector's Fill section writes, brand palette included. Two cases are
 * refused rather than fudged: a gradient fill (flattening it silently would
 * destroy work, and it can only be judged where it is visible), and a fill
 * the bound brand type style owns — the rules engine would override the
 * edit at render, so offering it would be a lie. Both say why. */
function FillButton({
  field,
  locked,
  onPatch,
}: {
  field: TemplateField;
  locked: boolean;
  onPatch(patch: Partial<TemplateField>): void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const hasGradient = Boolean(field.textGradient?.stops.length);
  const disabled = hasGradient || locked;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", display: "flex" }}>
      <button
        type="button"
        disabled={disabled}
        title={
          hasGradient
            ? "This element has a gradient fill — edit it in the inspector's Fill section."
            : locked
              ? "The bound type style owns this colour — change it in Brand Studio."
              : "Fill colour"
        }
        aria-label="Fill colour"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-center"
        data-radius-control
        style={{ width: 26, height: 26, opacity: disabled ? 0.4 : 1 }}
      >
        <span
          style={{
            width: 14,
            height: 14,
            borderRadius: 3,
            border: "1px solid var(--border-strong)",
            background: hasGradient ? "var(--bg-hover)" : (field.colorHex ?? "var(--bg-hover)"),
          }}
        />
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 1,
            padding: "var(--space-2xs)",
            background: "var(--bg-surface)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-control)",
            minWidth: 210,
          }}
        >
          {/* Same write the inspector's Fill section makes: a hex, and any
              gradient cleared. Fields carry no colour-key binding. */}
          <ColorControl
            ariaLabel="Fill colour"
            value={field.colorHex}
            onChange={(hex) => onPatch({ colorHex: hex.toUpperCase(), textGradient: undefined })}
          />
        </div>
      )}
    </div>
  );
}

/** The actions an admin reaches for most, put where the work is. It carries
 * whatever suits the current selection and nothing else: align and
 * distribute for several elements, fill and size for one piece of text,
 * grouping where grouping applies, delete always. Everything here also
 * exists in the inspector — this is a shortcut, never the only way. */
export function SelectionToolbar(props: SelectionToolbarProps) {
  const {
    count,
    single,
    isGroup,
    groupable,
    onAlign,
    onDistribute,
    alignDisabledReason,
    distributeDisabledReason,
    onGroup,
    onUngroup,
    onBringForward,
    onDelete,
    onPatchSingle,
    singleLocked,
  } = props;
  const isText = single ? single.type === "text" || single.type === "multiline" : false;

  return (
    <div
      className="flex items-center gap-1"
      role="toolbar"
      aria-label="Selection actions"
      style={{
        padding: 3,
        background: "var(--bg-surface)",
        border: "1px solid var(--border-strong)",
        borderRadius: "var(--radius-control)",
      }}
    >
      {count >= 2 && (
        <>
          <AlignControls
            scope="selection"
            onAlign={onAlign}
            onDistribute={onDistribute}
            alignDisabledReason={alignDisabledReason}
            distributeDisabledReason={distributeDisabledReason}
          />
          <Divider />
        </>
      )}

      {single && isText && (
        <>
          <FillButton
            field={single}
            locked={Boolean(singleLocked?.has("colorKey"))}
            onPatch={onPatchSingle}
          />
          <div style={{ width: 74 }}>
            <NumericField
              label="A"
              ariaLabel="Font size"
              value={single.fontSizePx}
              precision={0}
              min={1}
              max={800}
              disabled={singleLocked?.has("fontSizePx")}
              onCommit={(v) => v !== undefined && onPatchSingle({ fontSizePx: v })}
            />
          </div>
          <Divider />
        </>
      )}

      {groupable && (
        <ToolbarButton title="Group selection" onClick={onGroup}>
          <Group style={{ width: 14, height: 14 }} strokeWidth={1.5} />
        </ToolbarButton>
      )}
      {isGroup && (
        <ToolbarButton title="Ungroup" onClick={onUngroup}>
          <Ungroup style={{ width: 14, height: 14 }} strokeWidth={1.5} />
        </ToolbarButton>
      )}
      {!isGroup && (
        <ToolbarButton title="Bring forward" onClick={onBringForward}>
          <ArrowUp style={{ width: 14, height: 14 }} strokeWidth={1.5} />
        </ToolbarButton>
      )}
      <ToolbarButton title="Delete" onClick={onDelete} destructive>
        <Trash2 style={{ width: 14, height: 14 }} strokeWidth={1.5} />
      </ToolbarButton>
    </div>
  );
}
