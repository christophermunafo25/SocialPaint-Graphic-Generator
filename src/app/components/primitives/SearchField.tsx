import React, { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { cx, type DemoStateAttr } from "./cx";
import { IconButton } from "./IconButton";

export interface SearchFieldProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  value: string;
  onChange(next: string): void;
  /** Clears the query; the field keeps focus. */
  onClear(): void;
  /** The accessible name of the collapsed button and the field. */
  label: string;
  placeholder?: string;
  /** Moves focus into the field when it opens (on by default). */
  focusOnOpen?: boolean;
  clearLabel?: string;
  /** Large 46 beside Platform Chips (the default), Medium 36 beside other
   * controls. */
  size?: "lg" | "md";
  className?: string;
  "data-demo-state"?: DemoStateAttr;
}

/** Search field (Figma 50:62), for a filter bar. Collapsed it is a square
 * button, 46 at Large and 36 at Medium; open it is the field (440 or 280),
 * with a ghost Small clear button while it holds a query, and the ring sits
 * around the whole field. One box stays mounted in both states, so its
 * width runs open and shut (CJ, 2026-11-25): the query fades in once the
 * box has begun to grow, and the clear button pops in with the first
 * character. Escape on an empty field collapses it and hands focus back to
 * the button. The glyph is 20, as drawn. */
export function SearchField({
  open,
  onOpenChange,
  value,
  onChange,
  onClear,
  label,
  placeholder,
  focusOnOpen = true,
  clearLabel = "Clear search",
  size = "lg",
  className,
  "data-demo-state": demoState,
}: SearchFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(open);
  // Nothing animates on first paint: a page that loads with a query mounts
  // the field open and still. Opening it, or typing, turns the motion on.
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (open !== wasOpen.current) setAnimate(true);
    if (open && !wasOpen.current && focusOnOpen) inputRef.current?.focus();
    if (!open && wasOpen.current && document.activeElement === document.body)
      buttonRef.current?.focus();
    wasOpen.current = open;
  }, [open, focusOnOpen]);

  return (
    <div
      className={cx("ui-search", open && "ui-search--open", className)}
      data-size={size}
      data-animate={animate || undefined}
      data-demo-state={open ? undefined : demoState}
    >
      {open ? (
        <>
          <Search size={20} className="ui-icon" aria-hidden />
          <input
            ref={inputRef}
            type="search"
            aria-label={label}
            placeholder={placeholder}
            value={value}
            onChange={(e) => {
              setAnimate(true);
              onChange(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape" && value === "") {
                e.preventDefault();
                onOpenChange(false);
              }
            }}
            className="ui-reset ui-search__input"
          />
          {value !== "" && (
            <IconButton
              variant="ghost"
              size="sm"
              icon={X}
              label={clearLabel}
              className="ui-search__clear"
              onClick={() => {
                onClear();
                inputRef.current?.focus();
              }}
            />
          )}
        </>
      ) : (
        <button
          ref={buttonRef}
          type="button"
          aria-label={label}
          aria-expanded={false}
          onClick={() => onOpenChange(true)}
          className="ui-reset ui-fill ui-search__trigger"
          data-size={size}
          data-demo-state={demoState}
        >
          <Search size={20} className="ui-icon" aria-hidden />
        </button>
      )}
    </div>
  );
}
