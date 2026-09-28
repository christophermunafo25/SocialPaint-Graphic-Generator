import React, { useId } from "react";

type SuggestionChipProps = {
  label: string;
  /** Set only on chips that pin something (Start from): the chip becomes a
   * toggle button and `true` draws the selected look. Left undefined, the
   * chip is a plain action (Try next) with no aria-pressed at all. */
  pressed?: boolean;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children">;

/** A one-line suggestion under the composer or a finished turn (Figma
 * "Generate · Chat", sp-chip 322:749): 36 tall at the 9 radius, a 13px
 * Regular label. The surface is the chip's, not the button's: a white chip
 * on --shadow-rest in light, the canvas floor inside the chip edge in dark,
 * so it never reads as a solid ChatButton. A pressed chip takes the app's
 * neutral selection (--chip-bg-selected / --chip-fg-selected), the same
 * inverted fill as a selected platform chip. */
export function SuggestionChip({
  label,
  pressed,
  type = "button",
  className,
  ...rest
}: SuggestionChipProps) {
  return (
    <button
      type={type}
      className={className ? `sp-chat-chip ${className}` : "sp-chat-chip"}
      aria-pressed={typeof pressed === "boolean" ? pressed : undefined}
      data-selected={pressed || undefined}
      {...rest}
    >
      <span className="sp-chat-chip__label">{label}</span>
    </button>
  );
}

/** The "Start from" and "Try next" rows (Figma "Generate · Chat", frames 01
 * and 05): a muted row label, then the chips, 8px apart and wrapping onto
 * more lines when they run out of room. The label names the group for
 * assistive tech. Start from is centred under the composer; Try next sits
 * at the start of the turn. */
export function ChipRow({
  label,
  align = "start",
  children,
}: {
  label: string;
  /** Horizontal placement of the row's contents. */
  align?: "start" | "center";
  children: React.ReactNode;
}) {
  const labelId = useId();
  return (
    <div className="sp-chat-chiprow" role="group" aria-labelledby={labelId} data-align={align}>
      <span id={labelId} className="sp-chat-chiprow__label">
        {label}
      </span>
      {children}
    </div>
  );
}
