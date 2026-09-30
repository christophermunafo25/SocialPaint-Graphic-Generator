import React, { forwardRef } from "react";
import { Tooltip } from "../Tooltip";
import { PlusGlyph } from "./icons";

/** The tooltip's copy, on every plus in both chats (PROMPT §11.3). */
export const PLUS_TOOLTIP = "Add details, photos and more";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

/** The chat box's plus (Figma sp-plus 431:30, Open; Hint is Open plus the
 * glow): a 28px rounded square at --radius-tag on --gen-inverse with a 14px
 * plus in --gen-on-inverse. It opens the attach menu, so it names itself
 * "Add" as a menu button and reports `expanded`. Hover and pressed keep the
 * fill; focus draws the chat controls' ring.
 *
 * `hint` turns on the first-run glow (socialpaint.css, the one brand colour
 * that draws attention; the page decides when, PROMPT §12.10). The tooltip
 * "Add details, photos and more" shows to its right and stays shut while
 * the menu is open. */
export const PlusButton = forwardRef<
  HTMLButtonElement,
  { expanded: boolean; hint?: boolean } & ButtonProps
>(function PlusButton({ expanded, hint = false, type = "button", className, ...rest }, ref) {
  return (
    <Tooltip content={PLUS_TOOLTIP} placement="right" gap={4} suppressed={expanded}>
      <button
        ref={ref}
        type={type}
        className={className ? `sp-plus ${className}` : "sp-plus"}
        aria-label="Add"
        aria-haspopup="menu"
        aria-expanded={expanded}
        data-hint={hint || undefined}
        {...rest}
      >
        <PlusGlyph aria-hidden />
      </button>
    </Tooltip>
  );
});
