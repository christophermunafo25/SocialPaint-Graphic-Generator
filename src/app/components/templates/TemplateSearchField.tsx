import React, { useEffect, useId, useRef, useState } from "react";
import { Search, X } from "lucide-react";

const DEBOUNCE_MS = 150;

/** The catalogue's search field. Types locally and settles into the URL after
 *  150ms, so the address bar stays shareable without one history entry per
 *  keystroke. No submit button — the query IS the state.
 *
 *  Rests as an icon-only square in line with the filters and grows rightward
 *  into the field when opened. The input stays mounted in both states: the
 *  glyph button and the input live in one box whose width animates, so the
 *  interaction reads as one object opening. A field holding a committed query
 *  never collapses — a filter the user can't see is a filter they can't undo.
 *
 *  `value` is the committed query from the URL; an external change (back,
 *  forward, or the empty-state's Clear action) always wins over the draft. */
export function TemplateSearchField({
  value,
  onChange,
  placeholder = "Search templates, platforms, sizes, or use cases",
  ariaLabel = "Search templates",
  collapsible = true,
}: {
  value: string;
  onChange(next: string): void;
  /** Call-site overrides for reuse outside the template catalogue (the size
   *  gallery searches sizes). The defaults are the catalogue's own strings,
   *  so the Portal call site stays untouched. */
  placeholder?: string;
  ariaLabel?: string;
  /** Escape hatch during rollout: false pins the field open permanently. */
  collapsible?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const [open, setOpen] = useState(!collapsible || value !== "");
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputId = useId();

  useEffect(() => setDraft(value), [value]);

  // A committed query arriving from outside (back/forward) reopens the field.
  useEffect(() => {
    if (value !== "") setOpen(true);
  }, [value]);

  useEffect(() => {
    if (draft === value) return;
    const id = window.setTimeout(() => onChange(draft), DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [draft, value, onChange]);

  const clear = () => {
    setDraft("");
    onChange("");
    inputRef.current?.focus();
  };

  const openField = () => {
    setOpen(true);
    // Next frame, once the input is interactive; preventScroll because the
    // sticky filter bar makes a naive focus jump the page.
    requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
  };

  const collapse = () => {
    if (!collapsible) return;
    setOpen(false);
  };

  return (
    <div
      className="sp-searchfield"
      data-open={open || undefined}
      onBlur={(e) => {
        const next = e.relatedTarget as Node | null;
        if (next && e.currentTarget.contains(next)) return;
        if (draft === "" && value === "") collapse();
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className="sp-searchfield__trigger"
        aria-expanded={open}
        aria-controls={inputId}
        aria-label={ariaLabel}
        onClick={() => (open ? inputRef.current?.focus({ preventScroll: true }) : openField())}
      >
        <Search className="sp-searchfield__icon" aria-hidden strokeWidth={1.5} />
      </button>
      <input
        ref={inputRef}
        id={inputId}
        type="search"
        className="sp-searchfield__input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Escape") return;
          if (draft !== "") {
            // Clear but stay open and focused; swallow the key so an
            // enclosing dialog doesn't also close.
            e.preventDefault();
            e.stopPropagation();
            clear();
          } else if (collapsible) {
            e.preventDefault();
            e.stopPropagation();
            collapse();
            triggerRef.current?.focus({ preventScroll: true });
          }
        }}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-hidden={open ? undefined : true}
        tabIndex={open ? undefined : -1}
        autoComplete="off"
        spellCheck={false}
      />
      {draft && (
        <button
          type="button"
          className="sp-searchfield__clear"
          onClick={clear}
          aria-label="Clear search"
        >
          <X style={{ width: 15, height: 15 }} strokeWidth={1.5} />
        </button>
      )}
    </div>
  );
}
