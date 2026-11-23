import React, { useId, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { IconButton, SegmentedControl, Switch } from "../primitives";
import { parseHexInput } from "./inspectorValues";

// ---------------------------------------------------------------------------
// The inspector's structure, from the editor's frames (322:380): sections in
// Mono/Eyebrow, each field a Label/XS over a 36 control, fields side by side
// 8 apart, and the scrubbable numeric field on the Input's look. Shared by
// every inspector (field, group, selection, canvas) and the effects list.
// ---------------------------------------------------------------------------

/** The fill picker's labels (FillPicker), which keeps the earlier look until
 * its own pass. The inspector's labels are Label/XS and Mono/Eyebrow. */
export const inspectorLabelStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "var(--type-caption-size)",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  fontWeight: 400,
  // Secondary, not muted: the panel's labels must clear 4.5:1 in both themes
  // (muted lands ~3.5:1 on the dark surface).
  color: "var(--text-secondary)",
};

// --- Gesture tracking -------------------------------------------------------
// While a pointer gesture (scrub, slider or stop drag) is in progress, the
// builder holds history coalescing open so the WHOLE gesture undoes as one
// step — however slowly the pointer moves. Module-scoped because a gesture
// is inherently singular: one pointer, one user.

let gestureDepth = 0;
export const beginInspectorGesture = (): void => {
  gestureDepth += 1;
};
export const endInspectorGesture = (): void => {
  gestureDepth = Math.max(0, gestureDepth - 1);
};
export const inspectorGestureActive = (): boolean => gestureDepth > 0;

/** The fill picker's compact inputs (FillPicker), until its own pass. */
export const compactControlStyle: React.CSSProperties = {
  height: "var(--row-h-compact)",
  padding: "0 var(--space-2xs)",
  fontSize: "var(--type-label-size)",
};

/** One section (322:380): its name in Mono/Eyebrow, then its rows, 12
 * apart. `headerExtra` sits at the end of the name's line (the add and
 * remove of an optional property). */
export function InspectorSection({
  id,
  title,
  headerExtra,
  children,
}: {
  /** Names the section for tests and captures (`data-section`). */
  id: string;
  title: string;
  headerExtra?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const headingId = useId();
  return (
    <section className="sp-insp-section" data-section={id} aria-labelledby={headingId}>
      <div className="sp-insp-section__head">
        <h3 id={headingId} className="t-mono-eyebrow">
          {title}
        </h3>
        {headerExtra}
      </div>
      {children}
    </section>
  );
}

/** One field (322:380's "Field · Type style"): a Label/XS over its control,
 * 6 apart. `full` drops the label for a row that names itself (a fill row,
 * a list of effects). */
export function PropertyRow({
  label,
  full,
  children,
}: {
  label?: React.ReactNode;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="sp-insp-row">
      {label !== undefined && !full && (
        <span className="t-label-xs sp-insp-row__label">{label}</span>
      )}
      <div className="sp-insp-row__control">{children}</div>
    </div>
  );
}

/** Fields side by side, 8 apart: Font and Weight, or Size, Line height and
 * Spacing. Equal columns unless `columns` says otherwise. */
export function PropertyGrid({
  columns,
  children,
}: {
  /** A grid-template-columns value, for unequal columns. */
  columns?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="sp-insp-grid" style={columns ? { gridTemplateColumns: columns } : undefined}>
      {children}
    </div>
  );
}

/** A setting that is on or off, as the Field tab's Team fills in
 * (2289:4772): its name in Label/S, then the switch at the row's end. The
 * whole row is the switch's label. */
export function SwitchRow({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange(next: boolean): void;
}) {
  return (
    <Switch
      className="sp-insp-switch"
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      label={<span className="t-label-s">{label}</span>}
    />
  );
}

/** A small set of choices. Icon options are Ghost Small icon buttons 2
 * apart, as the frame's Align (322:380), working as a radio (pass `value`),
 * as independent toggles (per-option `active`) or as momentary actions
 * (neither). Worded options with a `value` are a Segmented Control, as the
 * frame's Text sizing. */
export function SegmentedIconGroup<T extends string>({
  options,
  value,
  ariaLabel,
  disabled = false,
  stretch = false,
  onSelect,
}: {
  /** Icon options name themselves with `title`; worded ones show `label`. */
  options: Array<{ key: T; Icon?: LucideIcon; label?: string; title?: string; active?: boolean }>;
  value?: T | null;
  ariaLabel: string;
  disabled?: boolean;
  /** The worded control spans its row, its segments sharing the width. */
  stretch?: boolean;
  onSelect(key: T): void;
}) {
  if (value !== undefined && options.every((o) => !o.Icon && o.label)) {
    return (
      <fieldset className="sp-insp-choices" disabled={disabled} data-stretch={stretch || undefined}>
        <SegmentedControl
          aria-label={ariaLabel}
          options={options.map((o) => ({ id: o.key, label: o.label ?? o.key }))}
          selectedId={value}
          onSelect={(id) => onSelect(id as T)}
        />
      </fieldset>
    );
  }
  return (
    <div className="sp-insp-icons" role="group" aria-label={ariaLabel}>
      {options.map(({ key, Icon, label, title, active }) => {
        const on = active ?? (value != null ? value === key : undefined);
        const name = title ?? label ?? key;
        return (
          <IconButton
            key={key}
            variant="ghost"
            size="sm"
            icon={Icon ?? (() => null)}
            label={name}
            title={name}
            disabled={disabled}
            aria-pressed={on}
            selected={Boolean(on)}
            onClick={() => onSelect(key)}
          />
        );
      })}
    </div>
  );
}

interface NumericFieldProps {
  /** Leading in-control label ("X", "W") — also the scrub handle. */
  label?: string;
  /** Leading icon instead of a text label — also the scrub handle. */
  icon?: React.ReactNode;
  /** Unit rendered inside the input's right edge: "°", "%", "px", or none. */
  suffix?: string;
  value: number | undefined;
  /** Multi-select with differing values: shows the mixed placeholder; the
   * first committed value applies to all (caller's concern). */
  mixed?: boolean;
  placeholder?: string;
  /** Decimals shown and stored — enforced on commit, not just display. */
  precision?: number;
  /** Arrow/scrub increment. Shift multiplies by 10. */
  step?: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  /** Empty input commits undefined instead of reverting (optional values). */
  allowEmpty?: boolean;
  /** No box: the value inside another control's row (a fill row's
   * opacity, as drawn). */
  bare?: boolean;
  ariaLabel: string;
  onCommit(next: number | undefined): void;
}

/** The inspector's numeric input. Commit on Enter and blur, revert on
 * Escape, arrows step (shift ×10), and the leading label/icon scrubs the
 * value horizontally, Figma-style. Precision and clamping are enforced on
 * every commit path. */
export function NumericField({
  label,
  icon,
  suffix,
  value,
  mixed = false,
  placeholder,
  precision = 0,
  step = 1,
  min,
  max,
  disabled = false,
  allowEmpty = false,
  bare = false,
  ariaLabel,
  onCommit,
}: NumericFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  /** null = at rest (display the formatted prop value); string = editing. */
  const [draft, setDraft] = useState<string | null>(null);
  /** Escape sets this before blurring — the blur handler still sees the old
   * draft in its closure, so without the flag it would commit the very value
   * Escape just threw away. */
  const cancelling = useRef(false);
  const scrub = useRef<{
    startX: number;
    base: number;
    last: number;
    pendingX: number;
    shift: boolean;
  } | null>(null);
  const scrubRaf = useRef(0);

  const clamp = (n: number): number => {
    if (min !== undefined) n = Math.max(min, n);
    if (max !== undefined) n = Math.min(max, n);
    return Number(n.toFixed(precision));
  };
  // toFixed enforces the precision; Number() drops the trailing zeros it
  // pads with — "45", not "45.00", exactly as a design tool displays it.
  const format = (n: number | undefined): string =>
    n === undefined ? "" : String(Number(n.toFixed(precision)));

  const shown = draft ?? (mixed ? "" : format(value));

  const commitDraft = () => {
    if (draft === null) return;
    const trimmed = draft.trim();
    if (trimmed === "" && allowEmpty) {
      onCommit(undefined);
      setDraft(null);
      return;
    }
    const parsed = Number(trimmed);
    if (trimmed === "" || Number.isNaN(parsed)) {
      setDraft(null); // revert — an input can never be left invalid
      return;
    }
    const next = clamp(parsed);
    if (next !== value) onCommit(next);
    setDraft(null);
  };

  const stepBy = (direction: 1 | -1, big: boolean) => {
    const base =
      draft !== null && !Number.isNaN(Number(draft.trim())) && draft.trim() !== ""
        ? Number(draft.trim())
        : (value ?? 0);
    const next = clamp(base + direction * step * (big ? 10 : 1));
    onCommit(next);
    setDraft(format(next));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    // The builder listens on window for Escape (clear selection) and
    // Delete/Backspace (remove field) — keys handled here stay here.
    e.stopPropagation();
    if (e.key === "Enter") {
      e.preventDefault();
      commitDraft();
      inputRef.current?.select();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelling.current = true;
      setDraft(null);
      inputRef.current?.blur();
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      stepBy(e.key === "ArrowUp" ? 1 : -1, e.shiftKey);
    }
  };

  // --- Scrub-to-change on the leading label/icon --------------------------

  const onScrubDown = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (disabled) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    beginInspectorGesture();
    scrub.current = {
      startX: e.clientX,
      base: value ?? 0,
      last: value ?? 0,
      pendingX: e.clientX,
      shift: e.shiftKey,
    };
  };
  // rAF-throttled like every canvas drag: at most one commit per frame,
  // computed from the latest pointer position.
  const onScrubMove = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (!scrub.current) return;
    scrub.current.pendingX = e.clientX;
    scrub.current.shift = e.shiftKey;
    if (scrubRaf.current) return;
    scrubRaf.current = requestAnimationFrame(() => {
      scrubRaf.current = 0;
      const sc = scrub.current;
      if (!sc) return;
      const dx = sc.pendingX - sc.startX;
      const next = clamp(sc.base + dx * step * (sc.shift ? 10 : 1));
      if (next !== sc.last) {
        sc.last = next;
        onCommit(next);
        setDraft(null);
      }
    });
  };
  const onScrubUp = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (!scrub.current) return;
    // Land exactly where the pointer stopped, then release.
    const sc = scrub.current;
    const next = clamp(sc.base + (e.clientX - sc.startX) * step * (e.shiftKey ? 10 : 1));
    if (next !== sc.last) {
      onCommit(next);
      setDraft(null);
    }
    if (scrubRaf.current) {
      cancelAnimationFrame(scrubRaf.current);
      scrubRaf.current = 0;
    }
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    scrub.current = null;
    endInspectorGesture();
  };

  const leading = icon ?? label;

  return (
    <label
      className={
        bare ? "sp-numfield sp-numfield--bare" : "ui-fill ui-input ui-input--box sp-numfield"
      }
      data-size={bare ? undefined : "md"}
    >
      {leading !== undefined && (
        <span
          className="sp-numfield__lead"
          onPointerDown={onScrubDown}
          onPointerMove={onScrubMove}
          onPointerUp={onScrubUp}
          onPointerCancel={onScrubUp}
          data-disabled={disabled || undefined}
        >
          {leading}
        </span>
      )}
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        disabled={disabled}
        aria-label={ariaLabel}
        className="ui-reset ui-input__control sp-numfield__input"
        value={shown}
        placeholder={mixed ? "Mixed" : placeholder}
        onFocus={(e) => {
          setDraft(mixed ? "" : format(value));
          e.target.select();
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (cancelling.current) {
            cancelling.current = false;
            setDraft(null);
            return;
          }
          commitDraft();
        }}
        onKeyDown={onKeyDown}
      />
      {suffix && <span className="sp-numfield__suffix">{suffix}</span>}
    </label>
  );
}

interface HexRowProps {
  /** The swatch's CSS background. */
  swatch: string;
  /** Names the swatch, which opens the picker ("Edit fill"). */
  swatchLabel: string;
  expanded?: boolean;
  onSwatch(): void;
  /** The colour as #RRGGBB or #RRGGBBAA. The row shows its six digits;
   * the alpha belongs to the opacity after it. */
  hex?: string;
  /** Shown in place of a hex (a gradient's kind). */
  text?: string;
  /** Names the hex input ("Fill hex value"). */
  hexLabel?: string;
  disabled?: boolean;
  /** A typed hex, as #RRGGBB, or #RRGGBBAA when eight digits were typed. */
  onHex?(hex: string): void;
  /** What follows the hex: the opacity, a stroke's width. */
  children?: React.ReactNode;
}

/** A colour on one line, as the frame's fill row (322:380): 40 tall on
 * surface/field, the swatch that opens the picker, the hex in Mono/S, and
 * what follows it at the end. */
export const HexRow = React.forwardRef<HTMLButtonElement, HexRowProps>(function HexRow(
  { swatch, swatchLabel, expanded, onSwatch, hex, text, hexLabel, disabled, onHex, children },
  ref,
) {
  const shown = hex?.replace(/^#/, "").slice(0, 6).toUpperCase() ?? "";
  return (
    <div className="sp-hexrow" data-disabled={disabled || undefined}>
      <button
        ref={ref}
        type="button"
        className="ui-reset ui-ring sp-hexrow__swatch"
        style={{ background: swatch }}
        aria-label={swatchLabel}
        aria-expanded={expanded}
        disabled={disabled}
        onClick={onSwatch}
      />
      {hex !== undefined ? (
        <input
          key={shown}
          type="text"
          spellCheck={false}
          aria-label={hexLabel}
          disabled={disabled}
          className="ui-reset sp-hexrow__hex"
          defaultValue={shown}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              e.currentTarget.value = shown;
              e.currentTarget.blur();
            }
          }}
          onBlur={(e) => {
            const hex = parseHexInput(e.target.value);
            if (hex) onHex?.(hex);
            else e.target.value = shown;
          }}
        />
      ) : (
        <span className="t-body-s sp-hexrow__text">{text}</span>
      )}
      {children}
    </div>
  );
});
