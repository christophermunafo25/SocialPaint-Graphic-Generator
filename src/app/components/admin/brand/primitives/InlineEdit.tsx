import React, { useEffect, useRef, useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { IconButton } from "../../../primitives";
import { cx } from "../../../primitives/cx";

export interface InlineEditProps {
  /** The saved text. */
  value: string;
  /** What is being named, for the controls' names ("Rename Logo dark"). */
  label: string;
  /** Saves a changed, non-empty name; an empty or unchanged one is dropped.
   * Resolving to false means the save failed (the page shows its own error),
   * so there is no flash and nothing is read out. */
  onSave(next: string): void | boolean | Promise<void | boolean>;
  /** Open from outside (the row menu's Rename). */
  editing: boolean;
  onEditingChange(editing: boolean): void;
  /** The name's own type step and layout class, on the resting name only. */
  className?: string;
  /** The text's own look (a type style's specimen), on the name and the field. */
  style?: React.CSSProperties;
  /** The column the name sits in (a type style's 240). */
  rootClassName?: string;
  /** Save and Cancel go under the field, for a narrow card. */
  stacked?: boolean;
}

/** Inline edit (CJ's reference, 2026-11-25): the name is a quiet button
 * whose pencil shows on hover and focus. Pressing it swaps the name for a
 * field holding it, selected, with Save and Cancel beside it. Enter or Save
 * keeps the change, Escape or Cancel drops it, and leaving the field keeps
 * it, as the renames here always have. A change that saved flashes the name
 * green and is read out; focus goes back to the name. */
export function InlineEdit({
  value,
  label,
  onSave,
  editing,
  onEditingChange,
  className,
  style,
  rootClassName,
  stacked = false,
}: InlineEditProps) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLButtonElement>(null);
  const closing = useRef(false);
  const [flash, setFlash] = useState(0);
  const [said, setSaid] = useState("");

  useEffect(() => {
    if (!editing) return;
    closing.current = false;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  const close = (save: boolean, refocus: boolean) => {
    if (closing.current) return;
    closing.current = true;
    const next = (inputRef.current?.value ?? value).trim();
    onEditingChange(false);
    if (refocus) requestAnimationFrame(() => nameRef.current?.focus());
    if (!save || !next || next === value) return;
    void Promise.resolve(onSave(next)).then((ok) => {
      if (ok === false) return;
      setFlash((n) => n + 1);
      setSaid(`Renamed to ${next}`);
    });
  };

  return (
    <span
      ref={rootRef}
      className={cx("sp-bs-inline", rootClassName)}
      data-editing={editing || undefined}
      data-flash={flash > 0 ? (flash % 2 ? "a" : "b") : undefined}
      onAnimationEnd={() => setFlash(0)}
    >
      {editing ? (
        <span
          className="sp-bs-inline__edit"
          data-stacked={stacked || undefined}
          onBlur={(e) => {
            const next = e.relatedTarget as Node | null;
            if (next && rootRef.current?.contains(next)) return;
            close(true, false);
          }}
        >
          <input
            ref={inputRef}
            className="ui-reset sp-bs-inline__input"
            style={style}
            aria-label={`Rename ${label}`}
            defaultValue={value}
            spellCheck={false}
            autoComplete="off"
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return;
              if (e.key === "Enter") {
                e.preventDefault();
                close(true, true);
              } else if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                close(false, true);
              }
            }}
          />
          <IconButton
            size="sm"
            icon={Check}
            label="Save"
            className="sp-bs-inline__save"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => close(true, true)}
          />
          <IconButton
            size="sm"
            variant="ghost"
            icon={X}
            label="Cancel"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => close(false, true)}
          />
        </span>
      ) : (
        <button
          ref={nameRef}
          type="button"
          className="ui-reset ui-fill ui-ring sp-bs-inline__name"
          aria-label={`Rename ${label}`}
          onClick={() => onEditingChange(true)}
        >
          <span className={cx("sp-bs-inline__text", className)} style={style}>
            {value}
          </span>
          <Pencil size={16} className="ui-icon sp-bs-inline__pencil" aria-hidden />
        </button>
      )}
      <span className="sp-live" role="status" aria-live="polite">
        {said}
      </span>
    </span>
  );
}
