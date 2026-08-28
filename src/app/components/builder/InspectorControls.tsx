import React, { useRef, useState } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";

// ---------------------------------------------------------------------------
// Inspector primitives — the Figma-style structure (sections, property rows,
// scrubbabale numeric fields) built entirely in SocialPaint tokens. Shared by
// every section of the field settings panel; nothing here hardcodes a color,
// radius, or off-scale spacing value.
// ---------------------------------------------------------------------------

/** Section and field labels: ALL CAPS mono at the DS's sanctioned 0.04em
 * tracking, caption step, muted. One definition so headers, row labels, and
 * unit suffixes can never drift apart. */
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

/** Squeezes an .sp-input (select, text input) onto the compact row height.
 * The 38px form floor stays everywhere else; the inspector runs denser. */
export const compactControlStyle: React.CSSProperties = {
  height: "var(--row-h-compact)",
  padding: "0 var(--space-2xs)",
  fontSize: "var(--type-label-size)",
};

// Open/closed state persists per section across selections and sessions, so
// the inspector stays the way the admin left it. (Same store the previous
// inspector used — existing preferences carry over.)
const SECTIONS_KEY = "sp-inspector-open";

const readOpen = (id: string, fallback: boolean): boolean => {
  try {
    const m = JSON.parse(localStorage.getItem(SECTIONS_KEY) ?? "{}") as Record<string, boolean>;
    return typeof m[id] === "boolean" ? m[id] : fallback;
  } catch {
    return fallback;
  }
};

const writeOpen = (id: string, open: boolean): void => {
  try {
    const m = JSON.parse(localStorage.getItem(SECTIONS_KEY) ?? "{}") as Record<string, boolean>;
    m[id] = open;
    localStorage.setItem(SECTIONS_KEY, JSON.stringify(m));
  } catch {
    // persistence is best-effort
  }
};

/** One collapsible section of the inspector: hairline top border, 12px
 * vertical padding, mono uppercase header. The panel is one flat surface —
 * no cards, no elevation inside. */
export function InspectorSection({
  id,
  title,
  defaultOpen = true,
  headerExtra,
  children,
}: {
  id: string;
  title: string;
  defaultOpen?: boolean;
  /** Right-aligned header control (e.g. the Fill section's add button). */
  headerExtra?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(() => readOpen(id, defaultOpen));
  return (
    <div style={{ borderTop: "1px solid var(--border)", padding: "var(--space-xs) 0" }}>
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => {
            setOpen(!open);
            writeOpen(id, !open);
          }}
          aria-expanded={open}
          className="flex-1 flex items-center justify-between text-left"
          style={{ minHeight: 20 }}
        >
          <span style={inspectorLabelStyle}>{title}</span>
          <ChevronDown
            style={{
              width: 12,
              height: 12,
              color: "var(--text-muted)",
              transform: open ? undefined : "rotate(-90deg)",
              transition: "transform var(--dur-state) var(--ease)",
            }}
          />
        </button>
        {headerExtra}
      </div>
      {open && children && (
        <div
          className="flex flex-col"
          style={{ gap: "var(--space-2xs)", paddingTop: "var(--space-xs)" }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/** One property line: label column + control column on a compact 32px row.
 * Rows with no label keep the empty column so controls align down the panel;
 * `full` opts a control (font family select, swatch grids) out of the split,
 * and `stack` keeps the label but drops it onto its own line so the control
 * gets the panel's whole width. */
export function PropertyRow({
  label,
  full,
  stack,
  align = "center",
  children,
}: {
  label?: React.ReactNode;
  /** Control spans both columns (no label gutter). */
  full?: boolean;
  /** Label above, control across the full width. For a control whose own
   * labels need more room than the 1fr column leaves — a segmented group of
   * worded options, say, which otherwise wraps every word onto a second
   * line and doubles the row's height. */
  stack?: boolean;
  /** "start" keeps the label on the first line of a tall control (textarea). */
  align?: "center" | "start";
  children: React.ReactNode;
}) {
  if (stack) {
    return (
      <div style={{ display: "grid", gap: "var(--space-3xs)", paddingBlock: "var(--space-3xs)" }}>
        <span style={inspectorLabelStyle}>{label}</span>
        <div className="flex" style={{ gap: "var(--space-2xs)", minWidth: 0 }}>
          {children}
        </div>
      </div>
    );
  }
  if (full) {
    return (
      <div style={{ minHeight: "var(--row-h-compact)", display: "flex", alignItems: "center" }}>
        {children}
      </div>
    );
  }
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "var(--space-3xl) 1fr",
        gap: "var(--space-2xs)",
        alignItems: align,
        minHeight: "var(--row-h-compact)",
      }}
    >
      <span
        style={{
          ...inspectorLabelStyle,
          ...(align === "start" ? { paddingTop: "var(--space-2xs)" } : {}),
        }}
      >
        {label}
      </span>
      <div
        className="flex"
        style={{
          gap: "var(--space-2xs)",
          minWidth: 0,
          alignItems: align === "center" ? "center" : "flex-start",
          flexDirection: "row",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** Segmented group in a shared hairline container (.sp-seg) — icon segments
 * (alignment, flips) or short text segments (resizing modes). Works as a
 * radio (pass `value`), as independent toggles (per-option `active`), or as
 * momentary action buttons (neither). `stretch` fills the row, segments
 * sharing the width equally. */
export function SegmentedIconGroup<T extends string>({
  options,
  value,
  ariaLabel,
  disabled = false,
  stretch = false,
  onSelect,
}: {
  options: Array<{ key: T; Icon?: LucideIcon; label?: string; title: string; active?: boolean }>;
  value?: T | null;
  ariaLabel: string;
  disabled?: boolean;
  stretch?: boolean;
  onSelect(key: T): void;
}) {
  return (
    <div className="sp-seg" data-stretch={stretch || undefined} role="group" aria-label={ariaLabel}>
      {options.map(({ key, Icon, label, title, active }) => (
        <button
          key={key}
          type="button"
          title={title}
          disabled={disabled}
          aria-pressed={active ?? (value != null ? value === key : undefined)}
          data-active={(active ?? value === key) || undefined}
          onClick={() => onSelect(key)}
        >
          {Icon ? <Icon style={{ width: 14, height: 14 }} strokeWidth={1.5} /> : label}
        </button>
      ))}
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
      className="sp-numfield flex items-center flex-1"
      data-disabled={disabled || undefined}
      style={{
        gap: "var(--space-2xs)",
        height: "var(--row-h-compact)",
        padding: "0 var(--space-2xs)",
        minWidth: 0,
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-control)",
        cursor: disabled ? "default" : "text",
        transition: "border-color var(--dur-state) var(--ease)",
      }}
    >
      {leading !== undefined && (
        <span
          onPointerDown={onScrubDown}
          onPointerMove={onScrubMove}
          onPointerUp={onScrubUp}
          onPointerCancel={onScrubUp}
          title={disabled ? undefined : "Drag to change"}
          style={{
            ...inspectorLabelStyle,
            color: disabled ? "var(--text-disabled)" : "var(--text-secondary)",
            flexShrink: 0,
            cursor: disabled ? "default" : "ew-resize",
            touchAction: "none",
            userSelect: "none",
          }}
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
        className="w-full bg-transparent outline-none border-none"
        style={{
          fontSize: "var(--type-label-size)",
          color: disabled ? "var(--text-disabled)" : "var(--text-primary)",
          padding: 0,
          minWidth: 0,
        }}
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
      {suffix && (
        <span
          style={{
            fontSize: "var(--type-label-size)",
            color: disabled ? "var(--text-disabled)" : "var(--text-secondary)",
            flexShrink: 0,
            userSelect: "none",
          }}
        >
          {suffix}
        </span>
      )}
    </label>
  );
}
