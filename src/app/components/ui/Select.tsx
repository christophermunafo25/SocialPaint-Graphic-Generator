import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Lock } from "lucide-react";

// ---------------------------------------------------------------------------
// The platform's Select — the accessible combobox extracted from the builder's
// font pickers (FieldInspector), where it was born as Figma's two-step family
// and style menus. One implementation of the machinery: outside-pointerdown
// and Escape dismissal with focus returned to the trigger, combobox/listbox
// roles, arrow-key traversal with wrap-around, an optional search field, and
// per-option preview styles for callers whose rows render in their own face.
//
// Two ways in:
//  - <Select> for a straightforward option list (icons, groups, search).
//  - The primitives (TriggerButton, MenuSurface, MenuRow, useDismiss,
//    useScrollActiveIntoView, step) for callers whose trigger or rows need
//    logic <Select> should not grow.
//
// A native <select> renders the OS menu, which ignores every token in the
// design system and cannot carry icons — that is why this exists.
// ---------------------------------------------------------------------------

/** Close on outside pointerdown or Escape, and hand focus back to the trigger
 * so Escape leaves the keyboard exactly where it started. */
export function useDismiss(
  open: boolean,
  refs: Array<React.RefObject<HTMLElement | null>>,
  onClose: () => void,
) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!refs.some((r) => r.current?.contains(e.target as Node))) onClose();
    };
    window.addEventListener("pointerdown", onDown, true);
    return () => window.removeEventListener("pointerdown", onDown, true);
  }, [open, onClose, refs]);
}

/** The dropdown surface. Fixed-positioned off the trigger's rect rather than
 * absolutely positioned inside its container, which may scroll and would clip
 * it. Elevation is surface + border, never shadow. */
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
      className="fixed z-50 py-1 overflow-y-auto"
      style={{
        left: rect?.left,
        top: flip ? undefined : (rect?.bottom ?? 0) + 4,
        bottom: flip && rect ? window.innerHeight - rect.top + 4 : undefined,
        width: rect?.width,
        minWidth,
        maxHeight: Math.min(maxHeight, Math.max(160, flip ? (rect?.top ?? 0) - 12 : below)),
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-control)",
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
      className="flex items-center justify-between gap-2 px-2.5 py-1.5 cursor-pointer"
      style={{
        background: selected ? "var(--accent-wash)" : active ? "var(--bg-hover)" : "transparent",
        color: dimmed ? "var(--text-muted)" : "var(--text-primary)",
        transition: "background var(--dur-state) var(--ease)",
      }}
    >
      <span className="flex items-center gap-2 min-w-0">
        {icon}
        <span className="truncate" style={{ fontSize: 13, ...previewStyle }}>
          {label}
        </span>
      </span>
      {selected && (
        <Check style={{ width: 12, height: 12, flexShrink: 0, color: "var(--state-primary)" }} />
      )}
    </div>
  );
}

/** Group headers inside a menu: ALL CAPS mono, hairline-divided. */
export const menuGroupLabelStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 9.5,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--text-disabled)",
  padding: "6px 10px 3px",
};

/** The trigger — looks exactly like the .sp-input select it replaces, so
 * nothing around it shifts. */
export const TriggerButton = React.forwardRef<
  HTMLButtonElement,
  {
    value: string;
    placeholder?: string;
    disabled?: boolean;
    lockedHint?: boolean;
    /** Leading icon (the chosen option's mark), sized by the caller. */
    icon?: React.ReactNode;
    previewStyle?: React.CSSProperties;
    ariaLabel: string;
    expanded: boolean;
    controls?: string;
    /** Extra trigger styling (compact rows squeeze it onto their height). */
    triggerStyle?: React.CSSProperties;
    onOpen(): void;
    onKeyDown?(e: React.KeyboardEvent): void;
  }
>(function TriggerButton(
  {
    value,
    placeholder,
    disabled,
    lockedHint,
    icon,
    previewStyle,
    ariaLabel,
    expanded,
    controls,
    triggerStyle,
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
      className="sp-input flex items-center justify-between gap-2 text-left"
      style={{
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "default" : "pointer",
        ...triggerStyle,
      }}
    >
      <span className="flex items-center gap-2 min-w-0">
        {icon}
        <span
          className="truncate"
          style={value ? previewStyle : { color: "var(--text-disabled)" }}
        >
          {value || placeholder}
        </span>
      </span>
      {lockedHint ? (
        <Lock style={{ width: 11, height: 11, flexShrink: 0, color: "var(--state-primary)" }} />
      ) : (
        <ChevronDown style={{ width: 12, height: 12, flexShrink: 0, color: "var(--text-muted)" }} />
      )}
    </button>
  );
});

/** Move an index through a list with wrap-around. */
export const step = (index: number, delta: number, length: number): number =>
  length === 0 ? -1 : (index + delta + length) % length;

/** Keep the arrow-key cursor visible in a scrolling menu. */
export function useScrollActiveIntoView(
  open: boolean,
  active: number,
  surfaceRef: React.RefObject<HTMLDivElement | null>,
) {
  useEffect(() => {
    if (!open) return;
    const rows = surfaceRef.current?.querySelectorAll("[role=option]");
    rows?.[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active, surfaceRef]);
}

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
  /** Leading icon on the trigger (the chosen option's mark). */
  triggerIcon?: React.ReactNode;
  triggerPreviewStyle?: React.CSSProperties;
  /** Extra trigger styling (compact rows squeeze it onto their height). */
  triggerStyle?: React.CSSProperties;
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
  triggerIcon,
  triggerPreviewStyle,
  triggerStyle,
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
    <p
      style={{
        fontSize: "var(--type-caption-size)",
        color: "var(--text-muted)",
        padding: "6px 10px 4px",
        borderTop: "1px solid var(--border)",
        marginTop: 4,
      }}
    >
      {menuCaption}
    </p>
  ) : null;

  let lastGroup = "";
  const rows = visible.map((o, i) => {
    const group = o.group ?? "";
    const newGroup = group !== lastGroup;
    lastGroup = group;
    return (
      <React.Fragment key={o.value}>
        {newGroup && group && (
          <div
            style={{
              ...menuGroupLabelStyle,
              borderTop: i === 0 ? undefined : "1px solid var(--border)",
              marginTop: i === 0 ? 0 : 4,
            }}
          >
            {group}
          </div>
        )}
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
        icon={triggerIcon}
        previewStyle={triggerPreviewStyle}
        disabled={disabled}
        lockedHint={lockedHint}
        expanded={open}
        triggerStyle={triggerStyle}
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
            <div style={{ padding: "2px 6px 6px" }}>
              <input
                autoFocus
                className="sp-input"
                style={{ padding: "6px 9px", fontSize: 12.5 }}
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
                <p style={{ fontSize: 12, color: "var(--text-muted)", padding: "6px 10px 8px" }}>
                  {searchEmptyText(query)}
                </p>
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
