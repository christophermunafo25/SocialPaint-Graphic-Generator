import React from "react";
import type { DetailTagValue } from "@/lib/generate/details";
import { GlobeGlyph, TagPlusGlyph, TagRemoveGlyph } from "./icons";

/** A detail the member added (Figma sp-tag / Field 432:18 and sp-tag / Link
 * 432:40). Only the value is drawn; the label is its accessible name
 * ("Role: Creative Director"). A link leads with a 15px globe.
 *
 *  - In the chat box (`onEdit` given): the tag is a button that reopens its
 *    popover pre-filled, and its x ("Remove {label}") takes it away.
 *    `editing` draws the 1px edge while its popover is open.
 *  - Sent (no `onEdit`): inside the member's bubble, no x, not a control. */
export function DetailTag({
  tag,
  editing = false,
  onEdit,
  onRemove,
  disabled = false,
}: {
  tag: DetailTagValue;
  editing?: boolean;
  onEdit?(): void;
  onRemove?(): void;
  disabled?: boolean;
}) {
  const body = (
    <>
      {tag.kind === "link" && <GlobeGlyph size={15} className="sp-tag__globe" aria-hidden />}
      <span className="sp-tag__value">{tag.value}</span>
    </>
  );
  if (!onEdit) {
    return (
      <span className="sp-tag" data-state="sent" aria-label={`${tag.label}: ${tag.value}`}>
        {body}
      </span>
    );
  }
  return (
    <span className="sp-tag" data-editing={editing || undefined}>
      <button
        type="button"
        className="sp-tag__main"
        aria-label={`${tag.label}: ${tag.value}`}
        aria-haspopup="dialog"
        aria-expanded={editing}
        disabled={disabled}
        onClick={onEdit}
      >
        {body}
      </button>
      {onRemove && (
        <button
          type="button"
          className="sp-tag__remove"
          aria-label={`Remove ${tag.label}`}
          disabled={disabled}
          onClick={onRemove}
        >
          <TagRemoveGlyph aria-hidden />
        </button>
      )}
    </span>
  );
}

/** A detail still to fill (Figma sp-tag / Field, State=Missing): no fill, a
 * dashed edge, a 10px plus and the label. A button named "Add {label}". The
 * Fill in row and the edit stage's markers use it (PROMPT §11.6, §11.13). */
export function MissingTag({
  label,
  optional = false,
  onClick,
  className,
}: {
  label: string;
  optional?: boolean;
  onClick?(): void;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={className ? `sp-tag-missing ${className}` : "sp-tag-missing"}
      aria-label={`Add ${label}`}
      onClick={onClick}
    >
      <TagPlusGlyph aria-hidden />
      <span>
        {label}
        {optional ? " · optional" : ""}
      </span>
    </button>
  );
}
