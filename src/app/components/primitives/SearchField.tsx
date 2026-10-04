import React, { useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import { cx, type DemoStateAttr } from "./cx";

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
  className?: string;
  "data-demo-state"?: DemoStateAttr;
}

/** Search field (Figma 50:62). Collapsed it is a 50 square button; open it
 * is the field, with a clear button while it holds a query. Escape on an
 * empty field collapses it and hands focus back to the button. */
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
  className,
  "data-demo-state": demoState,
}: SearchFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(open);

  useEffect(() => {
    if (open && !wasOpen.current && focusOnOpen) inputRef.current?.focus();
    if (!open && wasOpen.current && document.activeElement === document.body)
      buttonRef.current?.focus();
    wasOpen.current = open;
  }, [open, focusOnOpen]);

  if (!open) {
    return (
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-expanded={false}
        onClick={() => onOpenChange(true)}
        className={cx("ui-reset ui-tint ui-ring ui-search", className)}
        data-demo-state={demoState}
      >
        <Search size={20} className="ui-icon" aria-hidden />
      </button>
    );
  }
  return (
    <div className={cx("ui-search ui-search--open", className)}>
      <Search size={20} className="ui-icon" aria-hidden />
      <input
        ref={inputRef}
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && value === "") {
            e.preventDefault();
            onOpenChange(false);
          }
        }}
        className="ui-reset ui-ring-none ui-search__input t-body-s"
      />
      {value !== "" && (
        <button
          type="button"
          aria-label={clearLabel}
          onClick={() => {
            onClear();
            inputRef.current?.focus();
          }}
          className="ui-reset ui-ring ui-search__clear"
        >
          <X size={14} className="ui-icon" aria-hidden />
        </button>
      )}
    </div>
  );
}
