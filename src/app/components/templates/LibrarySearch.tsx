import React, { useEffect, useState } from "react";
import { SearchField } from "../primitives";

const DEBOUNCE_MS = 150;

/**
 * The library's search (13:5776 collapsed, 13:6511 open), on the Search
 * field primitive. It types locally and settles into the URL after 150ms,
 * so the address stays shareable without a history entry per keystroke.
 *
 * Collapsed it is the 50 square; it opens into the 440 field. A field
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
}: {
  value: string;
  onChange(next: string): void;
  /** The field's name; History's is "Search chats". */
  label?: string;
  placeholder?: string;
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
      className="sp-lib-search"
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
      />
    </div>
  );
}
