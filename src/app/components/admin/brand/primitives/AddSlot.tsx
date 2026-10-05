import React from "react";
import { useFileDrop } from "@/lib/useFileDrop";

interface AddSlotProps {
  /** Rendered as "+ {label}" — pass "Add color", "Add logo", … */
  label: string;
  /** Optional detail line, e.g. "SVG or PNG". */
  detail?: string;
  /** Without `onFiles`: a plain button. */
  onClick?(): void;
  /** With `onFiles`: the slot opens a file picker on click and accepts a
   * drag-and-drop — drag is never required, the picker always works. */
  onFiles?(files: File[]): void;
  accept?: string;
  multiple?: boolean;
  style?: React.CSSProperties;
}

/** The dashed "+ Add" slot that ends every collection (13:9455): radius 20,
 * a 1px dashed edge in text/secondary, the label in Button/M. A file slot
 * takes a drop too, and lights up under one (PHASE-6 §9 D9). */
export function AddSlot({
  label,
  detail,
  onClick,
  onFiles,
  accept,
  multiple,
  style,
}: AddSlotProps) {
  const drop = useFileDrop((files) => onFiles?.(files));

  const body = (
    <>
      <span className="t-button-m sp-bs-add__label">+ {label}</span>
      {detail && <span className="t-label-xs sp-bs-add__detail">{detail}</span>}
    </>
  );

  if (onFiles) {
    return (
      <label {...drop.bind} data-active={drop.active} className="ui-ring sp-bs-add" style={style}>
        {body}
        {/* sr-only, not hidden: a display:none input can't take keyboard
            focus, and the slot must open from the keyboard too. */}
        <input
          type="file"
          className="sr-only"
          accept={accept}
          multiple={multiple}
          aria-label={label}
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length) onFiles(files);
            e.target.value = "";
          }}
        />
      </label>
    );
  }

  return (
    <button type="button" className="ui-reset ui-ring sp-bs-add" style={style} onClick={onClick}>
      {body}
    </button>
  );
}
