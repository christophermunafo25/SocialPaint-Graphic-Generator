import React, { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";

const DEBOUNCE_MS = 150;

/** The catalogue's search field. Types locally and settles into the URL after
 *  150ms, so the address bar stays shareable without one history entry per
 *  keystroke. No submit button — the query IS the state.
 *
 *  `value` is the committed query from the URL; an external change (back,
 *  forward, or the empty-state's Clear action) always wins over the draft. */
export function TemplateSearchField({
  value,
  onChange,
  placeholder = "Search templates, platforms, sizes, or use cases",
  ariaLabel = "Search templates",
}: {
  value: string;
  onChange(next: string): void;
  /** Call-site overrides for reuse outside the template catalogue (the size
   *  gallery searches sizes). The defaults are the catalogue's own strings,
   *  so the Portal call site stays untouched. */
  placeholder?: string;
  ariaLabel?: string;
}) {
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setDraft(value), [value]);

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

  return (
    <div className="sp-searchfield">
      <Search className="sp-searchfield__icon" aria-hidden strokeWidth={1.5} />
      <input
        ref={inputRef}
        type="search"
        className="sp-input sp-searchfield__input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            clear();
          }
        }}
        placeholder={placeholder}
        aria-label={ariaLabel}
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
