import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Lock } from "lucide-react";
import { Input } from "../primitives";
import { step, useDismiss, useScrollActiveIntoView } from "../primitives/Select";

// ---------------------------------------------------------------------------
// The font pickers' select. It wears the Select primitive's trigger, floating
// menu and rows, and adds what the primitive does not carry: a search field
// in the menu, a lock on a value a bound style owns, a trigger label of its
// own, and rows previewed in their own face. The machinery (useDismiss,
// step, useScrollActiveIntoView) lives in primitives/Select.
// ---------------------------------------------------------------------------

/** The dropdown surface, the primitive's floating menu. Fixed-positioned
 * off the trigger's rect rather than absolutely positioned inside its
 * container, which may scroll and would clip it. */
export function MenuSurface({
  triggerRef,
  surfaceRef,
  children,
  role,
  id,
  onKeyDown,
  autoFocus,
  minWidth,
}: {
  triggerRef: React.RefObject<HTMLElement | null>;
  surfaceRef: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
  role?: string;
  id?: string;
  onKeyDown?(e: React.KeyboardEvent): void;
  autoFocus?: boolean;
  /** Floor under the trigger-width default — a compact trigger can open a
   * menu whose rows need more room than the trigger occupies. */
  minWidth?: number;
}) {
  // autoFocus is not honoured on a div — focus it explicitly, or the menu's
  // arrow/Enter/Escape handling never receives a key.
  useEffect(() => {
    if (autoFocus) surfaceRef.current?.focus();
  }, [autoFocus, surfaceRef]);

  const rect = triggerRef.current?.getBoundingClientRect();
  const maxHeight = 260;
  const below = rect ? window.innerHeight - rect.bottom - 12 : maxHeight;
  const flip = below < 160 && rect && rect.top > below;
  return (
    <div
      ref={surfaceRef}
      role={role}
      id={id}
      tabIndex={autoFocus ? -1 : undefined}
      onKeyDown={onKeyDown}
      className="ui-menu ui-menu--floating"
      style={{
        left: rect?.left,
        top: flip ? undefined : (rect?.bottom ?? 0) + 4,
        bottom: flip && rect ? window.innerHeight - rect.top + 4 : undefined,
        width: rect?.width,
        minWidth,
        maxHeight: Math.min(maxHeight, Math.max(160, flip ? (rect?.top ?? 0) - 12 : below)),
        outline: "none",
      }}
    >
      {children}
    </div>
  );
}

/** One row in a menu. The label can render in its OWN face via previewStyle —
 * no waiting on the font: it paints in the fallback and upgrades in place
 * when the file lands, which is what keeps a font menu from stalling on
 * open. */
export function MenuRow({
  label,
  fullName,
  icon,
  selected,
  active,
  dimmed,
  previewStyle,
  onSelect,
  onHover,
  id,
}: {
  label: string;
  /** The unabbreviated name, when the visible label leans on a group header
   * for context — screen readers get "Bold Expanded", not a bare "Bold". */
  fullName?: string;
  /** Leading icon (a platform mark, say), sized by the caller. */
  icon?: React.ReactNode;
  selected: boolean;
  active: boolean;
  /** Still selectable, quietly discouraged — a preference the caller will
   * honor loosely rather than an option that would fail. */
  dimmed?: boolean;
  previewStyle?: React.CSSProperties;
  onSelect(): void;
  onHover(): void;
  id?: string;
}) {
  return (
    <div
      id={id}
      role="option"
      aria-label={fullName}
      aria-selected={selected}
      onPointerDown={(e) => {
        e.preventDefault();
        onSelect();
      }}
      onPointerEnter={onHover}
      className="ui-menu-item"
      data-highlighted={active || undefined}
      data-selected={selected || undefined}
      data-dimmed={dimmed || undefined}
    >
      {icon}
      <span className="ui-menu-item__label t-body-m" style={previewStyle}>
        {label}
      </span>
      {selected && <Check size={16} className="ui-icon ui-menu-item__check" aria-hidden />}
    </div>
  );
}

/** The trigger, the primitive Select's Medium trigger. Its value can show
 * in its own face, and a value a bound style owns shows the lock. */
export const TriggerButton = React.forwardRef<
  HTMLButtonElement,
  {
    value: string;
    placeholder?: string;
    disabled?: boolean;
    lockedHint?: boolean;
    previewStyle?: React.CSSProperties;
    ariaLabel: string;
    expanded: boolean;
    controls?: string;
    /** Extra trigger styling. */
    triggerStyle?: React.CSSProperties;
    /** Replaces the primitive's look with the caller's own class. */
    className?: string;
    /** Replaces the trailing chevron; the lock still wins when lockedHint. */
    chevron?: React.ReactNode;
    onOpen(): void;
    onKeyDown?(e: React.KeyboardEvent): void;
  }
>(function TriggerButton(
  {
    value,
    placeholder,
    disabled,
    lockedHint,
    previewStyle,
    ariaLabel,
    expanded,
    controls,
    triggerStyle,
    className,
    chevron,
    onOpen,
    onKeyDown,
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      role="combobox"
      aria-label={ariaLabel}
      aria-expanded={expanded}
      aria-controls={controls}
      aria-haspopup="listbox"
      disabled={disabled}
      onClick={onOpen}
      onKeyDown={onKeyDown}
      className={className ?? "ui-reset ui-fill ui-ring ui-select"}
      data-size={className ? undefined : "md"}
      data-placeholder={value ? undefined : true}
      style={triggerStyle}
    >
      <span className="ui-select__value t-body-m" style={value ? previewStyle : undefined}>
        {value || placeholder}
      </span>
      {lockedHint ? (
        <Lock size={16} className="ui-icon ui-select__chevron" aria-hidden />
      ) : (
        (chevron ?? <ChevronDown size={16} className="ui-icon ui-select__chevron" aria-hidden />)
      )}
    </button>
  );
});

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  /** Screen-reader name when the visible label is abbreviated. */
  ariaLabel?: string;
  /** Options sharing a group render under one hairline-divided header;
   * consecutive in the options array, or the header repeats. */
  group?: string;
  /** Leading icon on the row, sized by the caller. */
  icon?: React.ReactNode;
  /** Row label styling (font menus preview each family in its own face). */
  previewStyle?: React.CSSProperties;
  /** Rendered muted but still selectable — a preference the caller honors
   * loosely, not an option that would fail. Pair with menuCaption. */
  dimmed?: boolean;
}

interface SelectProps<T extends string> {
  /** DOM id prefix for the menu and rows (`${id}-menu`, `${id}-opt-N`). */
  id: string;
  ariaLabel: string;
  value: T | undefined;
  options: Array<SelectOption<T>>;
  onSelect(value: T): void;
  placeholder?: string;
  disabled?: boolean;
  /** Show a lock instead of the chevron (a bound style owns this value). */
  lockedHint?: boolean;
  /** Text shown on the trigger; defaults to the selected option's label.
   * Empty string falls through to the placeholder. */
  triggerLabel?: string;
  triggerPreviewStyle?: React.CSSProperties;
  /** Extra trigger styling. */
  triggerStyle?: React.CSSProperties;
  /** Replaces the trigger's look with the caller's own class. */
  triggerClassName?: string;
  /** Replaces the trigger's trailing chevron. */
  triggerChevron?: React.ReactNode;
  /** Adds the search field; typing filters options by label. */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Shown when a search matches nothing. */
  searchEmptyText?(query: string): string;
  /** Called with the currently visible (filtered) options while open —
   * the font menu uses it to load only the faces on screen. Wrap it in
   * useCallback; it sits in an effect's dependency list. */
  onVisibleOptions?(visible: Array<SelectOption<T>>): void;
  /** Floor on the open menu's width — a compact trigger can open a menu
   * whose rows need more room than the trigger occupies. */
  menuMinWidth?: number;
  /** One caption line pinned under the options — where a dimmed option
   * says what dimming means. */
  menuCaption?: React.ReactNode;
}

/** The general-purpose select. Full keyboard operation: ArrowDown/Enter/Space
 * open it, arrows traverse with wrap-around, Enter (and Space, unless a
 * search field is eating the keystroke) commits, Escape closes and returns
 * focus to the trigger. */
export function Select<T extends string>({
  id,
  ariaLabel,
  value,
  options,
  onSelect,
  placeholder,
  disabled,
  lockedHint,
  triggerLabel,
  triggerPreviewStyle,
  triggerStyle,
  triggerClassName,
  triggerChevron,
  searchable,
  searchPlaceholder,
  searchEmptyText,
  onVisibleOptions,
  menuMinWidth,
  menuCaption,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    triggerRef.current?.focus();
  }, []);
  useDismiss(open, [triggerRef, surfaceRef], () => setOpen(false));
  useScrollActiveIntoView(open, active, surfaceRef);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  useEffect(() => {
    if (open && onVisibleOptions) onVisibleOptions(visible);
  }, [open, visible, onVisibleOptions]);

  useEffect(() => {
    if (!open) return;
    setActive(
      Math.max(
        0,
        visible.findIndex((o) => o.value === value),
      ),
    );
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = (index: number) => {
    const option = visible[index];
    if (!option) return;
    onSelect(option.value);
    close();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    // Keys handled here stay here — surfaces like the builder listen on
    // window for Escape and Delete, and dismissing the menu must not also
    // trigger those.
    const handled = searchable
      ? ["Escape", "ArrowDown", "ArrowUp", "Enter"]
      : ["Escape", "ArrowDown", "ArrowUp", "Enter", " "];
    if (handled.includes(e.key)) e.stopPropagation();
    if (e.key === "Escape") {
      e.preventDefault();
      close(); // closes and restores — no value change
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => step(i, 1, visible.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => step(i, -1, visible.length));
    } else if (e.key === "Enter" || (!searchable && e.key === " ")) {
      e.preventDefault();
      commit(active);
    }
  };

  const selected = options.find((o) => o.value === value);
  const shownLabel = triggerLabel !== undefined ? triggerLabel : (selected?.label ?? "");

  const caption = menuCaption ? (
    <p className="ui-menu__caption t-caption-m">{menuCaption}</p>
  ) : null;

  let lastGroup = "";
  const rows = visible.map((o, i) => {
    const group = o.group ?? "";
    const newGroup = group !== lastGroup;
    lastGroup = group;
    return (
      <React.Fragment key={o.value}>
        {newGroup && group && <div className="ui-menu-label t-mono-eyebrow">{group}</div>}
        <MenuRow
          id={`${id}-opt-${i}`}
          label={o.label}
          fullName={o.ariaLabel}
          icon={o.icon}
          selected={o.value === value}
          active={i === active}
          dimmed={o.dimmed}
          previewStyle={o.previewStyle}
          onSelect={() => commit(i)}
          onHover={() => setActive(i)}
        />
      </React.Fragment>
    );
  });

  return (
    <>
      <TriggerButton
        ref={triggerRef}
        ariaLabel={ariaLabel}
        value={shownLabel}
        placeholder={placeholder}
        previewStyle={triggerPreviewStyle}
        disabled={disabled}
        lockedHint={lockedHint}
        expanded={open}
        triggerStyle={triggerStyle}
        className={triggerClassName}
        chevron={triggerChevron}
        controls={`${id}-menu`}
        onOpen={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      />
      {open &&
        (searchable ? (
          <MenuSurface
            triggerRef={triggerRef}
            surfaceRef={surfaceRef}
            id={`${id}-menu`}
            minWidth={menuMinWidth}
          >
            <div className="sp-select-search">
              <Input
                size="sm"
                autoFocus
                placeholder={searchPlaceholder}
                value={query}
                aria-label={searchPlaceholder}
                aria-controls={`${id}-list`}
                aria-activedescendant={visible[active] ? `${id}-opt-${active}` : undefined}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onKeyDown}
              />
            </div>
            <div role="listbox" id={`${id}-list`} aria-label={ariaLabel}>
              {visible.length === 0 && searchEmptyText && (
                <p className="ui-menu__caption t-caption-m">{searchEmptyText(query)}</p>
              )}
              {rows}
            </div>
            {caption}
          </MenuSurface>
        ) : (
          <MenuSurface
            triggerRef={triggerRef}
            surfaceRef={surfaceRef}
            id={`${id}-menu`}
            role="listbox"
            autoFocus
            onKeyDown={onKeyDown}
            minWidth={menuMinWidth}
          >
            {rows}
            {caption}
          </MenuSurface>
        ))}
    </>
  );
}
