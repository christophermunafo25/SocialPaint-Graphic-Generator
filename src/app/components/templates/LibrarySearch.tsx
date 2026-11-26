import React, { useEffect, useState } from "react";
import { SearchField } from "../primitives";
import { cx } from "../primitives/cx";

const DEBOUNCE_MS = 150;

/**
 * The library's search (13:5776 collapsed, 13:6511 open), on the Search
 * field primitive. It types locally and settles into the URL after 150ms,
 * so the address stays shareable without a history entry per keystroke.
 *
 * Collapsed it is the Medium 36 square, beside the chips in every filter
 * bar (CJ, 2026-11-25); it opens into the 280 field. A field
 * holding a query never collapses (a filter you can't see is one you can't
 * undo); an empty one collapses when focus leaves it, or on Escape.
 *
 * `value` is the committed query from the URL: an outside change (back,
 * forward, Clear) wins over the draft.
 */
export function LibrarySearch({
  value,
  onChange,
  label = "Search templates",
  placeholder = "Search templates, platforms, sizes, or use cases",
  size = "md",
  className,
}: {
  value: string;
  onChange(next: string): void;
  /** The field's name; History's is "Search chats". */
  label?: string;
  placeholder?: string;
  /** Medium in every filter bar; Large is the 46 field. */
  size?: "lg" | "md";
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [open, setOpen] = useState(value !== "");

  useEffect(() => setDraft(value), [value]);
  // A committed query arriving from outside reopens the field.
  useEffect(() => {
    if (value !== "") setOpen(true);
  }, [value]);

  useEffect(() => {
    if (draft === value) return;
    const id = window.setTimeout(() => onChange(draft), DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [draft, value, onChange]);

  return (
    <div
      className={cx("sp-lib-search", className)}
      onBlur={(e) => {
        const next = e.relatedTarget as Node | null;
        if (next && e.currentTarget.contains(next)) return;
        if (draft === "" && value === "") setOpen(false);
      }}
    >
      <SearchField
        open={open}
        onOpenChange={(next) => setOpen(next || draft !== "")}
        value={draft}
        onChange={setDraft}
        onClear={() => {
          setDraft("");
          onChange("");
        }}
        label={label}
        placeholder={placeholder}
        size={size}
      />
    </div>
  );
}
