import React from "react";
import { ArrowUp, Plus } from "lucide-react";
import { cx, type DemoStateAttr, type IconComponent } from "./cx";

export type ButtonKind = "primary" | "neutral" | "neutralOnPage" | "destructive";
export type ButtonSize = "lg" | "md" | "default" | "sm";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Primary is the one action a view leads with. Neutral sits inside cards
   * and panels, Neutral on page on the page itself. Destructive deletes. */
  kind?: ButtonKind;
  /** Large 44, Medium 40, Default 36, Small 28. */
  size?: ButtonSize;
  /** A leading icon, drawn at 16 (14 at Small). A busy button passes its
   * spinner here with aria-busy; the file draws no loading variant. */
  icon?: IconComponent;
  "data-demo-state"?: DemoStateAttr;
}

/** Button (Figma 43:123). Hover and pressed lay the kind's tint over its
 * fill; disabled is 40% with no hover; focus is the 2px-out ring. */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { kind = "neutral", size = "default", icon: Icon, className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx("ui-reset ui-tint ui-ring ui-btn", className)}
      data-kind={kind}
      data-size={size}
      {...rest}
    >
      {Icon && <Icon size={size === "sm" ? 14 : 16} className="ui-icon" aria-hidden />}
      <span className={size === "sm" ? "t-button-s" : "t-button-m"}>{children}</span>
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

/** Send button (Figma 44:9): Slime with a Deep Moss glyph in both themes. */
export const SendButton = React.forwardRef<HTMLButtonElement, SendButtonProps>(function SendButton(
  { action = "send", label, className, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      className={cx("ui-reset ui-tint ui-ring ui-send", className)}
      data-action={action}
      {...rest}
    >
      {action === "send" ? (
        <ArrowUp size={16} className="ui-icon" aria-hidden />
      ) : (
        <span className="ui-send__stop" aria-hidden />
      )}
    </button>
  );
});

export interface AttachButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** The accessible name ("Attach"). */
  label: string;
  "data-demo-state"?: DemoStateAttr;
}

/** Attach button (Figma 102:569): the composer's plus, inverse in each
 * theme. It opens the attach menu, so callers pass aria-haspopup and
 * aria-expanded. */
export const AttachButton = React.forwardRef<HTMLButtonElement, AttachButtonProps>(
  function AttachButton({ label, className, type = "button", ...rest }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        aria-label={label}
        className={cx("ui-reset ui-tint ui-ring ui-attach", className)}
        {...rest}
      >
        <Plus size={14} className="ui-icon" aria-hidden />
      </button>
    );
  },
);
