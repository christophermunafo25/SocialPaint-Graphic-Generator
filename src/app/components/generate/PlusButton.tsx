import React, { forwardRef } from "react";
import { Tooltip } from "../Tooltip";
import { PlusGlyph } from "./icons";

/** The tooltip's copy, on every plus in both chats (PROMPT §11.3). */
export const PLUS_TOOLTIP = "Add photos and files";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

/** The chat box's plus (Figma sp-plus 431:30, Open): a 28px rounded square
 * at --radius-tag on --gen-inverse with a 14px plus in --gen-on-inverse. It
 * opens the attach menu, so it names itself "Add" as a menu button and
 * reports `expanded`. Hover and pressed keep the fill; focus draws the chat
 * controls' ring. The tooltip "Add details, photos and more" shows to its
 * right and stays shut while the menu is open. */
export const PlusButton = forwardRef<HTMLButtonElement, { expanded: boolean } & ButtonProps>(
  function PlusButton({ expanded, type = "button", className, ...rest }, ref) {
    return (
      <Tooltip content={PLUS_TOOLTIP} placement="right" gap={4} suppressed={expanded}>
        <button
          ref={ref}
          type={type}
          className={className ? `sp-plus ${className}` : "sp-plus"}
          aria-label="Add"
          aria-haspopup="menu"
          aria-expanded={expanded}
          {...rest}
        >
          <PlusGlyph aria-hidden />
        </button>
      </Tooltip>
    );
  },
);
