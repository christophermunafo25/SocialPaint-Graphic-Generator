import React from "react";
import { Check, type LucideIcon } from "lucide-react";
import { cx } from "./cx";
import { useRovingSelect } from "./roving";

export interface OptionTileOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  /** A 16 lucide icon, or a node (a platform mark). */
  icon?: LucideIcon | React.ReactNode;
}

type Layout = "grid" | "full" | "hug";

interface TileProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  description?: string;
  icon?: LucideIcon | React.ReactNode;
  selected: boolean;
  /** Static demo state for /dev/ui. */
  "data-demo-state"?: "hover" | "focus";
}

const isIcon = (icon: unknown): icon is LucideIcon =>
  typeof icon === "function" || (typeof icon === "object" && icon !== null && "render" in icon);

/** Option tile (Figma 257:4145): a choice in onboarding's questions.
 * Default is raised (Elevation/Small), hover lays state/hover over it,
 * selected is sunken with the check. The check's space is kept in every
 * state, so a hug row never rewraps when a tile is chosen (PHASE-8B §8). */
export const OptionTile = React.forwardRef<HTMLButtonElement, TileProps>(function OptionTile(
  { label, description, icon, selected, className, type = "button", ...rest },
  ref,
) {
  const Icon = isIcon(icon) ? icon : null;
  return (
    <button
      ref={ref}
      type={type}
      className={cx("ui-reset ui-tint ui-ring ui-option-tile", className)}
      data-selected={selected || undefined}
      {...rest}
    >
      {Icon ? (
        <Icon size={16} className="ui-icon" aria-hidden />
      ) : icon ? (
        <span className="ui-option-tile__mark" aria-hidden>
          {icon as React.ReactNode}
        </span>
      ) : null}
      <span className="ui-option-tile__text">
        <span className="t-label-m">{label}</span>
        {description && <span className="t-caption-s ui-option-tile__desc">{description}</span>}
      </span>
      <Check size={16} className="ui-icon ui-option-tile__check" aria-hidden />
    </button>
  );
});

interface GroupBase<T extends string> {
  /** The question that labels the group. */
  "aria-labelledby"?: string;
  "aria-label"?: string;
  options: ReadonlyArray<OptionTileOption<T>>;
  /** grid: two columns (234 at 480); full: one per row; hug: a wrapping
   * row of tiles as wide as their label. */
  layout: Layout;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  className?: string;
}

/** One answer of several: a radio group, one tab stop, the arrows move and
 * choose (PHASE-8B §9 D13). */
export function OptionRadioGroup<T extends string>({
  options,
  value,
  onChange,
  layout,
  className,
  ...aria
}: GroupBase<T> & { value: T | undefined; onChange(value: T): void }) {
  const selectedIndex = options.findIndex((o) => o.value === value);
  const { itemProps } = useRovingSelect(options, selectedIndex, (o) => onChange(o.value));
  return (
    <div
      role="radiogroup"
      className={cx("ui-option-group", className)}
      data-layout={layout}
      {...aria}
    >
      {options.map((o, i) => {
        const { ref, ...roving } = itemProps(i);
        return (
          <OptionTile
            key={o.value}
            ref={ref}
            {...roving}
            role="radio"
            aria-checked={o.value === value}
            selected={o.value === value}
            label={o.label}
            description={o.description}
            icon={o.icon}
            onClick={() => onChange(o.value)}
          />
        );
      })}
    </div>
  );
}

/** Any number of answers: a group of checkboxes, each its own tab stop,
 * Space or Enter toggles. */
export function OptionCheckboxGroup<T extends string>({
  options,
  values,
  onChange,
  layout,
  className,
  ...aria
}: GroupBase<T> & { values: readonly T[]; onChange(values: T[]): void }) {
  return (
    <div role="group" className={cx("ui-option-group", className)} data-layout={layout} {...aria}>
      {options.map((o) => {
        const on = values.includes(o.value);
        return (
          <OptionTile
            key={o.value}
            role="checkbox"
            aria-checked={on}
            selected={on}
            label={o.label}
            description={o.description}
            icon={o.icon}
            onClick={() =>
              onChange(on ? values.filter((v) => v !== o.value) : [...values, o.value])
            }
          />
        );
      })}
    </div>
  );
}
