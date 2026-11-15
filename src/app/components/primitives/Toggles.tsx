import React, { useEffect, useRef } from "react";
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

/** Switch (Figma 2211:90): a hidden native checkbox with switch semantics
 * over a 36 by 20 track, so Space toggles it and a label click does too.
 * On is control/on; off is a track filled with border/control. Hover draws
 * a halo behind the track. */
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

/** The mark inside a checked box, drawn on the 16 box as the file draws it:
 * a 9 by 7 check or an 8 wide dash, at a 1.5 stroke. */
function CheckMark({ mixed }: { mixed: boolean }) {
  return (
    <svg
      className="ui-check__mark"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {mixed ? <path d="M4 8h8" /> : <path d="M3.5 8.5l3 3 6-7" />}
    </svg>
  );
}

interface CheckShared {
  /** The label beside the mark, in Body/M. Without one, pass `ariaLabel`. */
  label?: React.ReactNode;
  ariaLabel?: string;
  disabled?: boolean;
  /** For a native form, and to group radios. */
  name?: string;
  value?: string;
  id?: string;
  className?: string;
  "data-demo-state"?: DemoStateAttr;
}

export interface CheckboxProps extends CheckShared {
  /** "mixed" is the state of a parent whose children are part on. */
  checked: boolean | "mixed";
  /** A mixed box turns on. */
  onChange(next: boolean): void;
}

/** Checkbox (Figma 2211:148): a 16 box with a Body/M label. A hidden native
 * checkbox sits over it, so Space toggles it, a label click does too, and
 * Mixed is the platform's own indeterminate state. */
export function Checkbox({
  checked,
  onChange,
  label,
  ariaLabel,
  disabled = false,
  name,
  value,
  id,
  className,
  "data-demo-state": demoState,
}: CheckboxProps) {
  const input = useRef<HTMLInputElement>(null);
  const mixed = checked === "mixed";
  useEffect(() => {
    if (input.current) input.current.indeterminate = mixed;
  }, [mixed]);
  return (
    <label
      className={cx("ui-check", className)}
      data-kind="checkbox"
      data-disabled={disabled || undefined}
      data-demo-state={demoState}
    >
      <input
        ref={input}
        type="checkbox"
        className="ui-check__input"
        id={id}
        name={name}
        value={value}
        checked={checked === true}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="ui-check__box" data-on={checked !== false || undefined} aria-hidden>
        {checked !== false && <CheckMark mixed={mixed} />}
      </span>
      {label !== undefined && <span className="t-body-m">{label}</span>}
    </label>
  );
}

export interface RadioProps extends CheckShared {
  checked: boolean;
  /** Called when this radio becomes the chosen one. */
  onChange(): void;
}

/** Radio (Figma 2211:187): a 16 circle with a Body/M label, over a hidden
 * native radio. Radios that share a `name` are one group: the arrow keys
 * move between them and choose as they go. */
export function Radio({
  checked,
  onChange,
  label,
  ariaLabel,
  disabled = false,
  name,
  value,
  id,
  className,
  "data-demo-state": demoState,
}: RadioProps) {
  return (
    <label
      className={cx("ui-check", className)}
      data-kind="radio"
      data-disabled={disabled || undefined}
      data-demo-state={demoState}
    >
      <input
        type="radio"
        className="ui-check__input"
        id={id}
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => {
          if (e.target.checked) onChange();
        }}
      />
      <span className="ui-check__box" data-on={checked || undefined} aria-hidden>
        {checked && <span className="ui-check__dot" />}
      </span>
      {label !== undefined && <span className="t-body-m">{label}</span>}
    </label>
  );
}

/** The series colours a segment's dot can take. */
export type SegmentDot = "green" | "blue" | "purple" | "pink" | "warm";

export interface SegmentProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  /** A 6 dot before the label (the chart series a segment stands for). */
  dot?: SegmentDot;
  "data-demo-state"?: DemoStateAttr;
}

/** Segment (Figma 2211:211): one option on a control/track, 28 tall.
 * Selected rides control/thumb under Elevation/Thumb. SegmentedControl
 * gives it its role and keyboard; on its own it is only a look. */
export const Segment = React.forwardRef<HTMLButtonElement, SegmentProps>(function Segment(
  { selected = false, dot, className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx("ui-reset ui-fill ui-ring ui-segment", className)}
      data-selected={selected || undefined}
      {...rest}
    >
      {dot && <span className="ui-segment__dot" data-dot={dot} aria-hidden />}
      <span className="t-label-s">{children}</span>
    </button>
  );
});

export interface SegmentOption {
  id: string;
  label: string;
  /** The whole label as a tooltip, for segments too narrow to show it. */
  title?: string;
  dot?: SegmentDot;
}

export interface SegmentedControlProps {
  options: SegmentOption[];
  selectedId: string | null;
  onSelect(id: string): void;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  className?: string;
}

/** Segmented control (Figma 2211:213): a radio group of Segments on a 36
 * track, with one tab stop: the arrows select and wrap, and Home and End
 * jump to the ends. It needs a name: aria-label or aria-labelledby. */
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
            dot={option.dot}
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

export interface TabProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  "data-demo-state"?: DemoStateAttr;
}

/** Tab (Figma 4015:635): a text tab in Label/M. The selected one carries
 * the underline. Tabs gives it its role and keyboard; on its own it is only
 * a look. */
export const Tab = React.forwardRef<HTMLButtonElement, TabProps>(function Tab(
  { selected = false, className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx("ui-reset ui-ring ui-tab", className)}
      data-selected={selected || undefined}
      {...rest}
    >
      <span className="t-label-m">{children}</span>
    </button>
  );
});

export interface TabItem {
  id: string;
  label: string;
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

/** Tabs (Figma 4015:673): text tabs on a hairline. With panels (each item
 * names its panelId) it is a tablist; without, it filters in place and is a
 * radio group. Either way: one tab stop, arrows select and wrap. */
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
