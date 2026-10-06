import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { step, useDismiss, useScrollActiveIntoView } from "../ui/Select";
import { cx, type DemoStateAttr } from "./cx";

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  /** Screen-reader name when the visible label is abbreviated. */
  ariaLabel?: string;
  /** Options sharing a group render under one label; keep them consecutive. */
  group?: string;
  /** A leading mark (a platform logo), sized by the caller. */
  icon?: React.ReactNode;
  /** Still pickable, quietly discouraged. Pair with menuCaption. */
  dimmed?: boolean;
}

export interface SelectProps<T extends string> {
  /** DOM id prefix for the listbox and its options. Generated if absent. */
  id?: string;
  ariaLabel: string;
  value: T | undefined;
  options: Array<SelectOption<T>>;
  onSelect(value: T): void;
  placeholder?: string;
  disabled?: boolean;
  /** Default 36, Large 40 (the one that sits beside inputs in forms). */
  size?: "default" | "lg";
  /** Floor on the open menu's width. */
  menuMinWidth?: number;
  /** One line pinned under the options (what dimming means). */
  menuCaption?: React.ReactNode;
  className?: string;
  "data-demo-state"?: DemoStateAttr;
}

type Variant = "field" | "compact";

/** The listbox machinery both selects share, carried over from ui/Select:
 * ArrowDown, Enter or Space open it; the arrows move with wrap-around;
 * Enter or Space commit; Escape and an outside press close it and hand
 * focus back to the trigger. */
function SelectBase<T extends string>({
  variant,
  id: idProp,
  ariaLabel,
  value,
  options,
  onSelect,
  placeholder,
  disabled,
  size = "default",
  menuMinWidth,
  menuCaption,
  className,
  "data-demo-state": demoState,
}: SelectProps<T> & { variant: Variant }) {
  const fallbackId = useId();
  const id = idProp ?? `ui-select${fallbackId}`;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);
  const dismissRefs = useMemo(() => [triggerRef, surfaceRef], []);
  useDismiss(open, dismissRefs, () => setOpen(false));
  useScrollActiveIntoView(open, active, surfaceRef);

  const pendingActive = useRef<number | null>(null);
  useEffect(() => {
    if (!open) return;
    setActive(
      pendingActive.current ??
        Math.max(
          0,
          options.findIndex((o) => o.value === value),
        ),
    );
    pendingActive.current = null;
    surfaceRef.current?.focus();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Type-ahead (PHASE-7 §9 D7): letters typed within half a second build a
  // prefix; the first option whose label starts with it becomes active, as
  // in a native select. Typing the same letter again steps through the
  // options that start with it.
  const typed = useRef({ text: "", at: 0 });
  const typeAhead = (key: string, from: number): number | null => {
    const now = Date.now();
    const fresh = now - typed.current.at > 500;
    const text = (fresh ? "" : typed.current.text) + key.toLowerCase();
    typed.current = { text, at: now };
    const repeat = text.length > 1 && [...text].every((c) => c === text[0]);
    const prefix = repeat ? text[0] : text;
    const start = repeat || text.length === 1 ? from + 1 : from;
    for (let n = 0; n < options.length; n++) {
      const i = (start + n) % options.length;
      if (options[i].label.toLowerCase().startsWith(prefix)) return i;
    }
    return null;
  };
  const isTypeAheadKey = (e: React.KeyboardEvent) =>
    e.key.length === 1 && e.key !== " " && !e.metaKey && !e.ctrlKey && !e.altKey;

  const commit = (index: number) => {
    const option = options[index];
    if (!option) return;
    onSelect(option.value);
    close();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (["Escape", "ArrowDown", "ArrowUp", "Enter", " ", "Home", "End"].includes(e.key)) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (e.key === "Escape") close();
    else if (e.key === "ArrowDown") setActive((i) => step(i, 1, options.length));
    else if (e.key === "ArrowUp") setActive((i) => step(i, -1, options.length));
    else if (e.key === "Home") setActive(0);
    else if (e.key === "End") setActive(options.length - 1);
    else if (e.key === "Enter" || e.key === " ") commit(active);
    else if (isTypeAheadKey(e)) {
      const match = typeAhead(e.key, active);
      if (match !== null) setActive(match);
    }
  };

  const selected = options.find((o) => o.value === value);
  const rect = open ? triggerRef.current?.getBoundingClientRect() : undefined;

  let lastGroup = "";
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-list` : undefined}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            setOpen(true);
          } else if (!open && isTypeAheadKey(e)) {
            // Typing on the closed trigger opens the list at the match.
            e.preventDefault();
            const from = Math.max(
              0,
              options.findIndex((o) => o.value === value),
            );
            const match = typeAhead(e.key, from);
            pendingActive.current = match;
            setOpen(true);
          }
        }}
        className={cx(
          "ui-reset ui-tint ui-ring",
          variant === "field" ? "ui-select" : "ui-compact-select",
          className,
        )}
        data-size={variant === "field" ? size : undefined}
        data-placeholder={selected ? undefined : true}
        data-demo-state={demoState}
      >
        <span className={cx("ui-select__value", variant === "field" ? "t-body-s" : "t-button-s")}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown size={16} className="ui-icon ui-select__chevron" aria-hidden />
      </button>
      {open && rect && (
        <div
          ref={surfaceRef}
          id={`${id}-list`}
          role="listbox"
          aria-label={ariaLabel}
          tabIndex={-1}
          aria-activedescendant={options[active] ? `${id}-opt-${active}` : undefined}
          onKeyDown={onKeyDown}
          className="ui-menu ui-menu--floating"
          style={{
            left: rect.left,
            top: rect.bottom + 4,
            minWidth: Math.max(rect.width, menuMinWidth ?? 0),
          }}
        >
          {options.map((o, i) => {
            const group = o.group ?? "";
            const header = group && group !== lastGroup;
            lastGroup = group;
            return (
              <React.Fragment key={o.value}>
                {header && <div className="ui-menu-label t-label-xs t-trim">{group}</div>}
                <div
                  id={`${id}-opt-${i}`}
                  role="option"
                  aria-selected={o.value === value}
                  aria-label={o.ariaLabel}
                  className="ui-menu-item"
                  data-highlighted={i === active || undefined}
                  data-selected={o.value === value || undefined}
                  data-dimmed={o.dimmed || undefined}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    commit(i);
                  }}
                  onPointerEnter={() => setActive(i)}
                >
                  {o.icon}
                  <span className="ui-menu-item__label t-body-s t-trim">{o.label}</span>
                  {o.value === value && (
                    <Check size={16} className="ui-icon ui-menu-item__check" aria-hidden />
                  )}
                </div>
              </React.Fragment>
            );
          })}
          {menuCaption && <p className="ui-menu__caption t-caption-s">{menuCaption}</p>}
        </div>
      )}
    </>
  );
}

/** Select (Figma 49:40): input/fill, the pressed tint while open. */
export function Select<T extends string>(props: SelectProps<T>) {
  return <SelectBase variant="field" {...props} />;
}

/** Compact select (Figma 99:568): 28 tall on surface/sunken, for toolbars
 * (the composer's platform). */
export function CompactSelect<T extends string>(props: Omit<SelectProps<T>, "size">) {
  return <SelectBase variant="compact" {...props} />;
}
