import React from "react";
import { Minus, Plus } from "lucide-react";
import { cx, type DemoStateAttr, type IconComponent } from "./cx";
import { useRoll } from "./useRoll";

/** A glyph for each theme: `light` shows in Light and `dark` in Dark. */
export interface ThemedIcon {
  light: IconComponent;
  dark: IconComponent;
}

export interface IconButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> {
  /** The accessible name. Icon-only controls have no visible label. */
  label: string;
  /** Filled is a circle on action/neutral with an edge. Ghost has no fill
   * until it is hovered, and the control radius. */
  variant?: "filled" | "ghost";
  /** Small 28, Medium 36. */
  size?: "sm" | "md";
  /** The glyph, drawn at 16. A pair draws both and CSS shows the one for
   * the nearest [data-theme], so a button inside a nested theme shows that
   * theme's glyph (the theme toggle's sun and moon). */
  icon: IconComponent | ThemedIcon;
  /** The button stands for something showing (Settings while it is open).
   * The caller sets aria-pressed or aria-current to match. A button that
   * opens a menu needs no prop: it holds this look while aria-expanded is
   * true (a row's menu trigger). */
  selected?: boolean;
  /** Disabled, and still focusable: the button takes aria-disabled and
   * ignores clicks, so a control that turns itself off under the keyboard
   * (a stepper at the end of its range) never drops focus onto the page. */
  focusableWhenDisabled?: boolean;
  "data-demo-state"?: DemoStateAttr;
}

const isThemed = (icon: IconComponent | ThemedIcon): icon is ThemedIcon =>
  typeof icon === "object" && icon !== null && "light" in icon && "dark" in icon;

/** Icon button (Figma 2206:686), 28 or 36 square with a 16 glyph. One
 * component covers the plain icon button, a row's menu trigger, the theme
 * toggle, a stepper's buttons and the composer's plus. */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    variant = "filled",
    size = "md",
    icon,
    label,
    selected,
    focusableWhenDisabled = false,
    disabled,
    onClick,
    className,
    type = "button",
    ...rest
  },
  ref,
) {
  const soft = focusableWhenDisabled && disabled;
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      disabled={focusableWhenDisabled ? undefined : disabled}
      aria-disabled={soft || undefined}
      onClick={(e) => {
        if (soft) return;
        onClick?.(e);
      }}
      className={cx("ui-reset ui-fill ui-ring ui-iconbtn", className)}
      data-variant={variant}
      data-size={size}
      data-selected={selected || undefined}
      {...rest}
    >
      {isThemed(icon) ? (
        <>
          <icon.light size={16} className="ui-icon ui-iconbtn__light" aria-hidden />
          <icon.dark size={16} className="ui-icon ui-iconbtn__dark" aria-hidden />
        </>
      ) : (
        React.createElement(icon, { size: 16, className: "ui-icon", "aria-hidden": true })
      )}
    </button>
  );
});

export interface StepperProps {
  /** Names the group ("Variations"). The file draws no word beside the
   * control, so this is its accessible name only. */
  label: string;
  value: number;
  min: number;
  max: number;
  onChange(next: number): void;
  disabled?: boolean;
  decreaseLabel?: string;
  increaseLabel?: string;
  className?: string;
}

/** Stepper (Figma 2211:227): Decrease, the value and Increase in a 36
 * capsule on surface/field. The value is a polite live region, so each step
 * is read out, and it rolls to each new value. At a limit the end button
 * stays focusable (aria-disabled), so focus never drops out of the group. */
export function Stepper({
  label,
  value,
  min,
  max,
  onChange,
  disabled = false,
  decreaseLabel = "Decrease",
  increaseLabel = "Increase",
  className,
}: StepperProps) {
  // The number rolls to each new value (Variations' familiar roll).
  const roll = useRoll(value);
  return (
    <div role="group" aria-label={label} className={cx("ui-stepper", className)}>
      <IconButton
        variant="ghost"
        size="sm"
        icon={Minus}
        label={decreaseLabel}
        focusableWhenDisabled
        disabled={disabled || value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      />
      <span className="ui-stepper__value t-label-s">
        <span ref={roll.ref} className="ui-stepper__num" aria-live="polite">
          {roll.shown}
        </span>
      </span>
      <IconButton
        variant="ghost"
        size="sm"
        icon={Plus}
        label={increaseLabel}
        focusableWhenDisabled
        disabled={disabled || value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      />
    </div>
  );
}
