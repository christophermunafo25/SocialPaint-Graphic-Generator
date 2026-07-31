import React, { useCallback, useEffect, useRef, useState } from "react";
import { Check, Pencil, X } from "lucide-react";

interface InlineEditProps {
  /** The committed value. Keep this fed from the source of truth — the
   *  component only holds a value of its own while a save is in flight. */
  value: string;
  /** Commit. May be async; a rejection rolls the row back to `value`. */
  onSave(next: string): void | Promise<void>;
  /** Eyebrow above the value. Omit for a bare inline title. */
  label?: string;
  /** "Rename Employee anniversary post" — describes the action, not the value. */
  ariaLabel: string;
  /** Defaults to `label`, then `ariaLabel`. */
  inputAriaLabel?: string;
  /** Shown, muted, when the value is empty. */
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
  /** Fires on open and close. Use it to get neighbouring controls out of the
   *  way — a cramped input is the usual failure of inline edit in a toolbar. */
  onEditingChange?(editing: boolean): void;
  className?: string;
  /** Type treatment for the value and the input — they share it so the swap
   *  doesn't reflow. Use for display-face titles. */
  valueStyle?: React.CSSProperties;
  iconSize?: number;
}

/** Click-to-edit-in-place. The value reads as plain text with a pencil that
 *  fades in on hover/focus; clicking swaps in a pre-filled input with save and
 *  cancel. Enter saves, Escape cancels, clicking away saves, and a lime flash
 *  confirms. Styling lives in socialpaint.css under `.sp-inline-edit`.
 *
 *  Empty input is treated as "no change", not as a delete — nothing here can
 *  be blanked by accident. */
export function InlineEdit({
  value,
  onSave,
  label,
  ariaLabel,
  inputAriaLabel,
  placeholder = "Untitled",
  maxLength,
  disabled = false,
  onEditingChange,
  className,
  valueStyle,
  iconSize = 14,
}: InlineEditProps) {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState(value);
  /** Optimistic value while a save is in flight; null when settled. */
  const [pending, setPending] = useState<string | null>(null);
  const [flashing, setFlashing] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const rootRef = useRef<HTMLDivElement>(null);
  const displayRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const flashTimer = useRef<number | undefined>(undefined);

  const shown = pending ?? value;
  /** What the screen reader calls this field. */
  const fieldName = inputAriaLabel ?? label ?? ariaLabel;
  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => () => window.clearTimeout(flashTimer.current), []);

  // Hold the optimistic value until the prop catches up, so a save that round-
  // trips through a store doesn't flicker back to the old name in between.
  useEffect(() => {
    if (pending !== null && value === pending) setPending(null);
  }, [value, pending]);

  // Focus and select on open, so typing replaces the current value.
  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  const enterEdit = () => {
    if (disabled) return;
    setInputVal(shown);
    setEditing(true);
    onEditingChange?.(true);
  };

  const exitEdit = useCallback(
    (save: boolean) => {
      setEditing(false);
      onEditingChange?.(false);
      // Focus goes back to where the click landed, not into nowhere.
      requestAnimationFrame(() => displayRef.current?.focus());

      const next = inputVal.trim();
      if (!save || !next || next === shown) return;

      setPending(next);
      setAnnouncement(`${fieldName} saved: ${next}`);

      setFlashing(false);
      requestAnimationFrame(() => {
        setFlashing(true);
        if (reducedMotion) {
          window.clearTimeout(flashTimer.current);
          flashTimer.current = window.setTimeout(() => setFlashing(false), 400);
        }
      });

      void (async () => {
        try {
          await onSave(next);
        } catch (e) {
          console.error("Inline edit save failed", e);
          setAnnouncement(`Couldn't save ${fieldName}.`);
          setPending(null); // roll back to the prop
        }
      })();
    },
    [inputVal, shown, fieldName, onSave, onEditingChange, reducedMotion],
  );

  // Clicking away commits, the way a rename does everywhere else in the app.
  // Save and cancel live inside the root, so their own clicks never trip this.
  useEffect(() => {
    if (!editing) return;
    const onDocDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      exitEdit(true);
    };
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("touchstart", onDocDown);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("touchstart", onDocDown);
    };
  }, [editing, exitEdit]);

  return (
    <div
      ref={rootRef}
      className={`sp-inline-edit${className ? ` ${className}` : ""}`}
      data-flash={flashing ? "true" : undefined}
      onAnimationEnd={() => {
        if (!reducedMotion) setFlashing(false);
      }}
    >
      {label && <span className="sp-inline-edit__label">{label}</span>}

      {editing ? (
        <div className="sp-inline-edit__edit-row">
          <input
            ref={inputRef}
            type="text"
            className="sp-inline-edit__input"
            style={valueStyle}
            aria-label={inputAriaLabel ?? label ?? ariaLabel}
            autoComplete="off"
            spellCheck={false}
            maxLength={maxLength}
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                exitEdit(true);
              } else if (e.key === "Escape") {
                e.preventDefault();
                exitEdit(false);
              }
            }}
          />
          <button
            type="button"
            className="sp-inline-edit__save"
            aria-label="Save"
            onClick={() => exitEdit(true)}
          >
            <Check style={{ width: iconSize, height: iconSize }} />
          </button>
          <button
            type="button"
            className="sp-inline-edit__cancel"
            aria-label="Cancel"
            onClick={() => exitEdit(false)}
          >
            <X style={{ width: iconSize, height: iconSize }} />
          </button>
        </div>
      ) : (
        <div className="sp-inline-edit__row">
          <button
            ref={displayRef}
            type="button"
            className="sp-inline-edit__display"
            aria-label={ariaLabel}
            disabled={disabled}
            onClick={enterEdit}
          >
            <span
              className="sp-inline-edit__value"
              style={{ ...valueStyle, ...(shown.trim() ? null : { color: "var(--text-disabled)" }) }}
            >
              {shown.trim() || placeholder}
            </span>
            {!disabled && (
              <span className="sp-inline-edit__icon" aria-hidden="true">
                <Pencil style={{ width: iconSize, height: iconSize }} />
              </span>
            )}
          </button>
        </div>
      )}

      <div className="sp-inline-edit__live" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </div>
  );
}

/** Stacked card of labelled `InlineEdit` rows, divided by hairlines. */
export function InlineEditGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`sp-inline-edit-group${className ? ` ${className}` : ""}`}>{children}</div>
  );
}
