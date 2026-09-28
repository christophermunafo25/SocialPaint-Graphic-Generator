import React from "react";
import { CardGlyph } from "./icons";

/** A round action on a Generate card (Figma "Generate · Chat",
 * sp-card-action 308:366, Action Edit / Download / Copy × Size Regular /
 * Compact): 32px (28 compact) on the sunken fill, a lucide glyph in a 16px
 * box (14 compact) at the Figma's footprint (CardGlyph), in the primary ink.
 * `label` is the accessible name ("Copy caption"). `done` swaps the glyph
 * for a check, for the moment after a copy lands; the caller owns the
 * timing and the spoken status. */
export function CardAction({
  action,
  size = "regular",
  label,
  done = false,
  type = "button",
  className,
  ...rest
}: {
  action: "edit" | "download" | "copy";
  size?: "regular" | "compact";
  label: string;
  done?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={className ? `sp-chat-icon-btn ${className}` : "sp-chat-icon-btn"}
      data-preset="card-action"
      data-size={size}
      aria-label={label}
      {...rest}
    >
      <CardGlyph glyph={done ? "check" : action} compact={size === "compact"} />
    </button>
  );
}
