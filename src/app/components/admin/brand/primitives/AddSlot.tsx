import React from "react";
import { useFileDrop } from "@/lib/useFileDrop";

interface AddSlotProps {
  /** Rendered as "+ {label}" — pass "Add color", "Add logo", … */
  label: string;
  /** Optional mono detail line, e.g. "SVG or PNG". */
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

/** The dashed "+ Add" slot that ends every collection (D10). */
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
      <span className="sp-add-slot__label">+ {label}</span>
      {detail && <span className="sp-add-slot__detail">{detail}</span>}
    </>
  );

  if (onFiles) {
    return (
      <label {...drop.bind} data-active={drop.active} className="sp-add-slot" style={style}>
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
    <button type="button" className="sp-add-slot" style={style} onClick={onClick}>
      {body}
    </button>
  );
}
