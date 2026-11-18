import React from "react";
import { ArrowUp, Square } from "lucide-react";
import { cx, type DemoStateAttr, type IconComponent } from "./cx";
import { IconSlot } from "./IconSlot";

export type ButtonKind = "primary" | "neutral" | "ghost" | "destructive";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Primary is the one action a view leads with. Neutral is every other
   * action, on the page or on a raised surface. Ghost has no fill until it
   * is hovered. Destructive deletes. */
  kind?: ButtonKind;
  /** Small 28, Medium 36, Large 44. */
  size?: ButtonSize;
  /** A leading icon, drawn at 16. A change of icon crossfades in its slot,
   * and Check draws itself in (Copy to Check). */
  icon?: IconComponent;
  /** Work is under way: the button takes aria-busy and aria-disabled and
   * ignores clicks, and once the wait passes 400 ms its icon slot shows a
   * spinner. */
  busy?: boolean;
  /** A trailing icon, drawn at 16. */
  trailingIcon?: IconComponent;
  "data-demo-state"?: DemoStateAttr;
}

/** Button (Figma 2206:542). Each state is a color of its kind's own;
 * disabled is action/disabled under text/disabled; focus is the 2 px ring,
 * 2 px out. */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    kind = "neutral",
    size = "md",
    icon,
    busy = false,
    trailingIcon: TrailingIcon,
    className,
    children,
    type = "button",
    onClick,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx("ui-reset ui-fill ui-ring ui-btn", className)}
      data-kind={kind}
      data-size={size}
      aria-busy={busy || undefined}
      aria-disabled={busy || undefined}
      {...rest}
      onClick={(e) => {
        if (busy) return;
        onClick?.(e);
      }}
    >
      {icon && <IconSlot icon={icon} busy={busy} />}
      <span className={size === "sm" ? "t-label-s" : "t-label-m"}>{children}</span>
      {TrailingIcon && <TrailingIcon size={16} className="ui-icon" aria-hidden />}
    </button>
  );
});

export interface SendButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Send shows the arrow; Stop, while a run is going, the square. */
  action?: "send" | "stop";
  /** The accessible name ("Send", "Stop"). */
  label: string;
  "data-demo-state"?: DemoStateAttr;
}

/** Send button (Figma 2206:754): a 36 circle on action/accent with its
 * glyph on action/on-accent, in both themes. */
export const SendButton = React.forwardRef<HTMLButtonElement, SendButtonProps>(function SendButton(
  { action = "send", label, className, type = "button", ...rest },
  ref,
) {
  const Glyph = action === "send" ? ArrowUp : Square;
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      className={cx("ui-reset ui-fill ui-ring ui-send", className)}
      data-action={action}
      {...rest}
    >
      <Glyph size={16} className="ui-icon" aria-hidden />
    </button>
  );
});
