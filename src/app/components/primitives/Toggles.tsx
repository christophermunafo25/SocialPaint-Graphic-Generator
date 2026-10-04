import React from "react";
import { cx, type DemoStateAttr } from "./cx";
import { useRovingSelect } from "./roving";

export interface SwitchProps {
  checked: boolean;
  onChange(next: boolean): void;
  disabled?: boolean;
  /** The accessible name when the label lives elsewhere (a settings row). */
  ariaLabel?: string;
  /** A label beside the switch, for standalone uses. */
  label?: React.ReactNode;
  className?: string;
  "data-demo-state"?: DemoStateAttr;
}

/** Switch (Figma 49:45): a hidden native checkbox with switch semantics
 * over the track, as Switch.tsx builds it, so Space toggles it and a label
 * click does too. */
export function Switch({
  checked,
  onChange,
  disabled = false,
  ariaLabel,
  label,
  className,
  "data-demo-state": demoState,
}: SwitchProps) {
  return (
    <label
      className={cx("ui-switch", className)}
      data-checked={checked || undefined}
      data-disabled={disabled || undefined}
      data-demo-state={demoState}
    >
      <input
        type="checkbox"
        role="switch"
        className="ui-switch__input"
        checked={checked}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="ui-switch__track" aria-hidden>
        <span className="ui-switch__knob" />
      </span>
      {label}
    </label>
  );
}

export interface SegmentProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  "data-demo-state"?: DemoStateAttr;
}

/** Segment (Figma 49:50): one option on a control/track. Selected rides the
 * thumb under Elevation/Thumb. SegmentedControl gives it its role and
 * keyboard; on its own it is only a look. */
export const Segment = React.forwardRef<HTMLButtonElement, SegmentProps>(function Segment(
  { selected = false, className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx("ui-reset ui-tint ui-ring-tight ui-segment", className)}
      data-selected={selected || undefined}
      {...rest}
    >
      <span className="t-control-s">{children}</span>
    </button>
  );
});

export interface SegmentOption {
  id: string;
  label: string;
  /** The whole label as a tooltip, for segments too narrow to show it. */
  title?: string;
}

export interface SegmentedControlProps {
  options: SegmentOption[];
  selectedId: string | null;
  onSelect(id: string): void;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  className?: string;
}

/** Segmented control (Figma 49:51): a radio group of Segments with
 * SegmentSwitch's keyboard (one tab stop, arrows select and wrap, Home and
 * End). It needs a name: aria-label or aria-labelledby. */
export function SegmentedControl({
  options,
  selectedId,
  onSelect,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  className,
}: SegmentedControlProps) {
  const selectedIndex = options.findIndex((o) => o.id === selectedId);
  const { itemProps } = useRovingSelect(options, selectedIndex, (o) => onSelect(o.id));
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className={cx("ui-segmented", className)}
    >
      {options.map((option, i) => {
        const selected = option.id === selectedId;
        const { ref, ...roving } = itemProps(i);
        return (
          <Segment
            key={option.id}
            ref={ref}
            role="radio"
            aria-checked={selected}
            selected={selected}
            title={option.title}
            onClick={() => onSelect(option.id)}
            {...roving}
          >
            {option.label}
          </Segment>
        );
      })}
    </div>
  );
}

/** The series colours a tab's dot can take. */
export type TabDot = "green" | "blue" | "purple" | "pink" | "warm";

export interface TabProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  /** A series dot before the label (the chart a tab stands for). */
  dot?: TabDot;
  "data-demo-state"?: DemoStateAttr;
}

/** Tab (Figma 49:62): like a Segment, a size up, with an optional dot. Tabs
 * gives it its role and keyboard; on its own it is only a look. */
export const Tab = React.forwardRef<HTMLButtonElement, TabProps>(function Tab(
  { selected = false, dot, className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx("ui-reset ui-tint ui-ring-tight ui-tab", className)}
      data-selected={selected || undefined}
      {...rest}
    >
      {dot && <span className="ui-tab__dot" data-dot={dot} aria-hidden />}
      <span className="t-control-m">{children}</span>
    </button>
  );
});

export interface TabItem {
  id: string;
  label: string;
  dot?: TabDot;
  /** The id of the panel this tab shows, when it switches panels. */
  panelId?: string;
}

export interface TabsProps {
  items: TabItem[];
  selectedId: string | null;
  onSelect(id: string): void;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  className?: string;
}

/** Tabs (Figma 49:63). With panels (each item names its panelId) it is a
 * tablist; without, it filters in place and is a radio group, like the
 * Segmented control. Either way: one tab stop, arrows select and wrap. */
export function Tabs({
  items,
  selectedId,
  onSelect,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  className,
}: TabsProps) {
  const selectedIndex = items.findIndex((t) => t.id === selectedId);
  const { itemProps } = useRovingSelect(items, selectedIndex, (t) => onSelect(t.id));
  const panels = items.some((t) => t.panelId);
  return (
    <div
      role={panels ? "tablist" : "radiogroup"}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className={cx("ui-tabs", className)}
    >
      {items.map((item, i) => {
        const selected = item.id === selectedId;
        const { ref, ...roving } = itemProps(i);
        return (
          <Tab
            key={item.id}
            ref={ref}
            dot={item.dot}
            selected={selected}
            {...(panels
              ? { role: "tab", "aria-selected": selected, "aria-controls": item.panelId }
              : { role: "radio", "aria-checked": selected })}
            onClick={() => onSelect(item.id)}
            {...roving}
          >
            {item.label}
          </Tab>
        );
      })}
    </div>
  );
}
