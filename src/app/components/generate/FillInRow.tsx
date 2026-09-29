import React from "react";
import { MissingTag } from "./DetailTag";

/** The Fill in row (template-chat PROMPT §12.5, Figma frame 03): "Fill in"
 * then one Missing tag per empty member field of the draft's look, required
 * first in form order, then optional ones with " · optional". Each is a
 * button named "Add {label}" that opens the editor on that field. The row
 * updates as fields fill and is not drawn when nothing is missing. */
export function FillInRow({
  entries,
  onFill,
}: {
  /** `key` is what onFill gets back: a fieldKey, or a linked group's id. */
  entries: Array<{ key: string; label: string; optional: boolean }>;
  onFill(key: string): void;
}) {
  if (entries.length === 0) return null;
  return (
    <div className="sp-chat-fillin">
      <span className="sp-chat-fillin__label" id={undefined}>
        Fill in
      </span>
      <ul className="sp-chat-fillin__tags" aria-label="Fill in">
        {entries.map((e) => (
          <li key={e.key}>
            <MissingTag label={e.label} optional={e.optional} onClick={() => onFill(e.key)} />
          </li>
        ))}
      </ul>
    </div>
  );
}
