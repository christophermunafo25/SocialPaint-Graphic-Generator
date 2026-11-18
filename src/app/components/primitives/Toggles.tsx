import React, { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { cx, type DemoStateAttr } from "./cx";
import { inputModality } from "./inputModality";
import { motionMs, prefersReducedMotion } from "./motion";
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
 * a 9 by 7 check or an 8 wide dash, at a 1.5 stroke. Both paths are always
 * there, on pathLength 1, and the box's state shows one: a box checked at
 * first paint is simply drawn, and one checked later draws its mark in
 * (PROMPT.md section 7.4). */
function CheckMark() {
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
      <path className="ui-check__mark-check" pathLength={1} d="M3.5 8.5l3 3 6-7" />
      <path className="ui-check__mark-dash" pathLength={1} d="M4 8h8" />
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
      <span
        className="ui-check__box"
        data-on={mixed ? "mixed" : checked ? "true" : undefined}
        aria-hidden
      >
        <CheckMark />
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

/** The one #sp-goo filter every Segmented Control's liquid layer reads:
 * blur the thumb and the drop, then push the alpha so the two read as one
 * liquid (the metaball trick from BYQ's gooey nav, reference/gooey-nav-01).
 * sRGB keeps the fill exactly control/thumb. Added to the document once, on
 * the first control's mount. */
const GOO_ID = "sp-goo";
function ensureGooFilter(): void {
  if (typeof document === "undefined" || document.getElementById(GOO_ID)) return;
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.setAttribute("class", "ui-goo-defs");
  svg.innerHTML =
    `<filter id="${GOO_ID}" x="-20%" y="-60%" width="140%" height="220%" color-interpolation-filters="sRGB">` +
    '<feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />' +
    '<feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10" />' +
    "</filter>";
  document.body.appendChild(svg);
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
 * jump to the ends. It needs a name: aria-label or aria-labelledby.
 *
 * The liquid selection (PROMPT.md section 7.1, reference/liquid-selection.html):
 * the thumb is its own layer under the labels, and when the pointer picks
 * a segment it travels there with a drop of the same color trailing it,
 * fused by the shared #sp-goo filter. The keyboard, reduced motion, first
 * paint, a resize and a change to the options place it at once. Until it
 * is placed the selected segment draws its own fill, so nothing flashes. */
export function SegmentedControl({
  options,
  selectedId,
  onSelect,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  className,
}: SegmentedControlProps) {
  const selectedIndex = options.findIndex((o) => o.id === selectedId);
  const track = useRef<HTMLDivElement>(null);
  // How the next selection was made: a pointer click travels.
  const travelNext = useRef(false);
  const dropTimer = useRef<number | undefined>(undefined);
  const placedAt = useRef<number | null>(null);
  const select = (option: SegmentOption, travel: boolean) => {
    if (option.id === selectedId) return;
    travelNext.current = travel;
    onSelect(option.id);
  };
  const { itemProps } = useRovingSelect(options, selectedIndex, (o) => select(o, false));

  const place = useCallback((travel: boolean) => {
    const el = track.current;
    if (!el) return;
    const segment = el.querySelector<HTMLElement>('.ui-segment[aria-checked="true"]');
    window.clearTimeout(dropTimer.current);
    if (!segment) {
      delete el.dataset.liquid;
      placedAt.current = null;
      return;
    }
    const pad = parseFloat(getComputedStyle(el).paddingLeft) || 0;
    const x = segment.offsetLeft - pad;
    const w = segment.offsetWidth;
    el.style.setProperty("--_thumb-x", `${x}px`);
    el.style.setProperty("--_thumb-w", `${w}px`);
    el.style.setProperty("--_drop-x", `${x + w / 2}px`);
    if (!travel) {
      el.dataset.instant = "";
      el.style.setProperty("--_drop-s", "0");
      el.getBoundingClientRect(); // commit before the transitions return
      requestAnimationFrame(() => delete el.dataset.instant);
    } else {
      // The drop grows where the thumb was, holds while the thumb pulls
      // away, follows on the slower curve and shrinks into the thumb as it
      // lands.
      el.style.setProperty("--_drop-s", "1");
      dropTimer.current = window.setTimeout(
        () => el.style.setProperty("--_drop-s", "0"),
        motionMs(el, "--motion-duration-base"),
      );
    }
    el.dataset.liquid = "";
    placedAt.current = x;
  }, []);

  // Every render that changes the selection or the options places the
  // thumb before paint; only a pointer selection travels.
  const optionsKey = options.map((o) => `${o.id}\u{1f}${o.label}`).join("\u{1e}");
  useLayoutEffect(() => {
    const travel =
      travelNext.current &&
      placedAt.current !== null &&
      inputModality() !== "keyboard" &&
      !prefersReducedMotion();
    travelNext.current = false;
    place(travel);
  }, [selectedId, optionsKey, place]);

  useEffect(ensureGooFilter, []);

  // A resize (fonts settling, the container growing) places it at once.
  useEffect(() => {
    const el = track.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => place(false));
    ro.observe(el);
    return () => ro.disconnect();
  }, [place]);
  useEffect(() => () => window.clearTimeout(dropTimer.current), []);

  return (
    <div
      ref={track}
      role="radiogroup"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className={cx("ui-segmented", className)}
    >
      <span className="ui-segmented__goo" aria-hidden>
        <span className="ui-segmented__blob" />
        <span className="ui-segmented__drop" />
      </span>
      <span className="ui-segmented__thumb" aria-hidden />
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
            // detail is 0 when Space or Enter clicks the button.
            onClick={(e) => select(option, e.detail !== 0)}
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

/** Tabs (Figma 4015:673): text tabs on a hairline, sharing the width of
 * their row equally. With panels (each item names its panelId) it is a
 * tablist; without, it filters in place and is a radio group. Either way:
 * one tab stop, arrows select and wrap. */
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
