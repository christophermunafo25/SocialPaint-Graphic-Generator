import React from "react";
import { SendArrowGlyph } from "./icons";

type SendButtonProps = {
  state: "disabled" | "ready" | "stop";
  /** Called when the Stop state is clicked. */
  onStop?(): void;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children" | "type" | "disabled">;

/** The chat box's 36px round send control (Figma sp-send 431:23, Rest /
 * Hover / Loading × Light / Dark; Template chat PROMPT §11.8). Ready and
 * disabled submit the composer's form ("Generate"); disabled draws the
 * sunken fill with a muted arrow rather than dimming the button. Stop is a
 * plain button ("Stop generating") that calls `onStop` and never submits,
 * so a run can be stopped while the text stays editable. Ready, hover and
 * Stop are the themed --gen-send-* identity fills, never status, and hover
 * is a colour swap with no transition.
 *
 * `state` alone decides whether it is inert, so the props leave out
 * `disabled` (passing it is a type error, not a silent no-op). Disabled is
 * aria-disabled, not the attribute: a run usually ends with the text empty,
 * and a focused button that turns natively disabled drops focus to the
 * body, where PROMPT §9.10 keeps it in place. The composer's submit handler
 * still rejects empty text, since Enter submits without a click.
 * Ready and Stop are one element across the flip, so the later clicks of a
 * double-click (detail > 1) are dropped: one gesture never both starts a
 * run and stops it. */
export function SendButton({ state, onStop, onClick, className, ...rest }: SendButtonProps) {
  const cls = className ? `sp-chat-send ${className}` : "sp-chat-send";
  if (state === "stop") {
    return (
      <button
        {...rest}
        type="button"
        className={cls}
        data-state="stop"
        aria-label="Stop generating"
        onClick={(e) => {
          if (e.detail > 1) return;
          onClick?.(e);
          if (!e.defaultPrevented) onStop?.();
        }}
      >
        {/* The stop glyph (PROMPT §6): a filled 12px square at a 2px corner,
            centred in a 16px box. An SVG, so under forced colours it takes
            the forced text colour the way the arrow does. */}
        <svg width={16} height={16} viewBox="0 0 16 16" aria-hidden>
          <rect x={2} y={2} width={12} height={12} rx={2} fill="currentColor" />
        </svg>
      </button>
    );
  }
  const inert = state === "disabled";
  return (
    <button
      {...rest}
      type="submit"
      className={cls}
      data-state={state}
      aria-label="Generate"
      aria-disabled={inert || undefined}
      onClick={(e) => {
        if (inert || e.detail > 1) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
    >
      <SendArrowGlyph aria-hidden />
    </button>
  );
}
