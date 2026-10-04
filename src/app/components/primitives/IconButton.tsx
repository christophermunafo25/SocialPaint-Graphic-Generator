import React, { useId } from "react";
import { Ellipsis, Minus, Moon, Plus, Sun } from "lucide-react";
import { cx, type DemoStateAttr, type IconComponent } from "./cx";

interface IconOnlyProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** The accessible name. Icon-only controls have no visible label. */
  label: string;
  "data-demo-state"?: DemoStateAttr;
}

export interface IconButtonProps extends IconOnlyProps {
  /** Filled is a sunken circle; Ghost has no fill until hovered. */
  variant?: "filled" | "ghost";
  icon: IconComponent;
  /** Ghost only: the button stands for something showing (Settings open).
   * Use it on raised surfaces, where state/selected reads. The caller sets
   * aria-pressed or aria-current to match. */
  selected?: boolean;
}

/** Icon button (Figma 95:516), 32 square with a 16 icon. */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { variant = "filled", icon: Icon, label, selected, className, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      className={cx("ui-reset ui-tint ui-ring ui-iconbtn", className)}
      data-variant={variant}
      data-selected={selected || undefined}
      {...rest}
    >
      <Icon size={16} className="ui-icon" aria-hidden />
    </button>
  );
});

/** Row menu trigger (Figma 44:29): the ellipsis that opens a row's menu.
 * The caller passes aria-haspopup and aria-expanded; while open it holds
 * surface/sunken. */
export const RowMenuTrigger = React.forwardRef<HTMLButtonElement, IconOnlyProps>(
  function RowMenuTrigger({ label, className, type = "button", ...rest }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        aria-label={label}
        className={cx("ui-reset ui-tint ui-ring ui-rowmenu", className)}
        {...rest}
      >
        <Ellipsis size={16} className="ui-icon" aria-hidden />
      </button>
    );
  },
);

/** Theme toggle (Figma 102:574): a sunken circle showing the sun in Light
 * and the moon in Dark. The glyph follows the nearest [data-theme] in CSS,
 * so a toggle inside a nested theme shows that theme's glyph. The glyphs
 * are the sidebar's own (lucide at 15, stroke 1.5). */
export const ThemeToggle = React.forwardRef<HTMLButtonElement, IconOnlyProps>(function ThemeToggle(
  { label, className, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      className={cx("ui-reset ui-tint ui-ring ui-theme-toggle", className)}
      {...rest}
    >
      <Sun size={15} strokeWidth={1.5} className="ui-icon ui-theme-toggle__sun" aria-hidden />
      <Moon size={15} strokeWidth={1.5} className="ui-icon ui-theme-toggle__moon" aria-hidden />
    </button>
  );
});

export interface StepperButtonProps extends IconOnlyProps {
  icon: IconComponent;
}

/** Stepper button (Figma 100:544). Disabled stays focusable (aria-disabled)
 * and ignores clicks, so stepping to the end of the range never drops
 * keyboard focus onto the page. It dims to 32%, as drawn. */
export const StepperButton = React.forwardRef<HTMLButtonElement, StepperButtonProps>(
  function StepperButton(
    { icon: Icon, label, disabled, onClick, className, type = "button", ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        aria-label={label}
        aria-disabled={disabled || undefined}
        onClick={(e) => {
          if (disabled) return;
          onClick?.(e);
        }}
        className={cx("ui-reset ui-tint ui-ring ui-stepbtn", className)}
        {...rest}
      >
        <Icon size={16} className="ui-icon" aria-hidden />
      </button>
    );
  },
);

export interface StepperProps {
  /** The visible label ("Variations"); it also names the group. */
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

/** Stepper (Figma 100:545): a label, Decrease, the value and Increase on a
 * sunken track. The value is a polite live region, so each step is read
 * out. */
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
  const labelId = useId();
  return (
    <div role="group" aria-labelledby={labelId} className={cx("ui-stepper", className)}>
      <span id={labelId} className="t-button-s">
        {label}
      </span>
      <span className="ui-stepper__controls">
        <StepperButton
          icon={Minus}
          label={decreaseLabel}
          disabled={disabled || value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
        />
        <span className="ui-stepper__value t-button-s" aria-live="polite">
          {value}
        </span>
        <StepperButton
          icon={Plus}
          label={increaseLabel}
          disabled={disabled || value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
        />
      </span>
    </div>
  );
}
