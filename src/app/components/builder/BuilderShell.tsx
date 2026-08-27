import React, { useCallback, useEffect, useRef, useState } from "react";
import { PanelLeft, PanelRight } from "lucide-react";
import { startDrag } from "./canvasGesture";

/** Everything the builder remembers about its own chrome is keyed under this
 * prefix and lives in localStorage — never in the template schema. Rail
 * widths are how one admin likes to work, not a property of the design. */
const LS_PREFIX = "sp-builder-";

function readNumber(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    const n = raw === null ? NaN : Number(raw);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

function readFlag(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    return raw === null ? fallback : raw === "1";
  } catch {
    return fallback;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(LS_PREFIX + key, value);
  } catch {
    // persistence is best-effort
  }
}

/** A rail width that survives a reload. Clamped on read as well as on write —
 * a stored value from a wider display must not lock a rail off-screen. */
export function useRailWidth(
  key: string,
  initial: number,
  min: number,
  max: number,
): [number, (px: number) => void] {
  const [width, setWidth] = useState(() => Math.max(min, Math.min(max, readNumber(key, initial))));
  const set = useCallback(
    (px: number) => {
      const clamped = Math.max(min, Math.min(max, Math.round(px)));
      setWidth(clamped);
      write(key, String(clamped));
    },
    [key, min, max],
  );
  return [width, set];
}

/** A collapsed/expanded rail state that survives a reload. */
export function useRailCollapsed(key: string, initial = false): [boolean, (on: boolean) => void] {
  const [collapsed, setCollapsed] = useState(() => readFlag(key, initial));
  const set = useCallback(
    (on: boolean) => {
      setCollapsed(on);
      write(key, on ? "1" : "0");
    },
    [key],
  );
  return [collapsed, set];
}

interface BuilderRailProps {
  side: "left" | "right";
  /** Accessible name, and the tooltip on the collapsed strip's button. */
  label: string;
  width: number;
  onWidth(px: number): void;
  minWidth: number;
  maxWidth: number;
  collapsed: boolean;
  onCollapsed(on: boolean): void;
  /** Rendered in the collapsed strip under the expand button — the tab
   * buttons, so switching tabs is still one click from collapsed. */
  stub?: React.ReactNode;
  children: React.ReactNode;
}

/** One of the builder's two side rails: resizable by its edge grip,
 * collapsible to a strip that keeps the way back where the rail was, and
 * independently scrolling. The grip runs through the same gesture core as
 * the canvas, so a drag that leaves the window still ends cleanly and the
 * builder's shortcuts stay inert while it is live. */
export function BuilderRail({
  side,
  label,
  width,
  onWidth,
  minWidth,
  maxWidth,
  collapsed,
  onCollapsed,
  stub,
  children,
}: BuilderRailProps) {
  const [dragging, setDragging] = useState(false);
  const onWidthRef = useRef(onWidth);
  onWidthRef.current = onWidth;
  const Icon = side === "left" ? PanelLeft : PanelRight;

  if (collapsed) {
    return (
      <div
        className={`sp-builder__rail sp-builder__rail--${side}`}
        style={{ width: 40 }}
        aria-label={label}
      >
        <div className="sp-builder__stub">
          <button
            onClick={() => onCollapsed(false)}
            title={`Show ${label}`}
            aria-label={`Show ${label}`}
            className="sp-icon-btn"
          >
            <Icon style={{ width: 15, height: 15 }} />
          </button>
          {stub}
        </div>
      </div>
    );
  }

  return (
    <section
      className={`sp-builder__rail sp-builder__rail--${side}`}
      style={{ width }}
      aria-label={label}
    >
      {children}
      <div
        className={`sp-builder__grip sp-builder__grip--${side}`}
        data-dragging={dragging}
        role="separator"
        aria-orientation="vertical"
        aria-label={`Resize ${label}`}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          const start = width;
          setDragging(true);
          startDrag(e.nativeEvent, e.currentTarget, {
            threshold: 0,
            onMove: (dx) => {
              const next = side === "left" ? start + dx : start - dx;
              onWidthRef.current(Math.max(minWidth, Math.min(maxWidth, next)));
            },
            onEnd: () => setDragging(false),
            onCancel: () => {
              setDragging(false);
              onWidthRef.current(start);
            },
            onTap: () => setDragging(false),
          });
        }}
        onDoubleClick={() => onCollapsed(true)}
      />
    </section>
  );
}

/** Header row shared by both rails and the step panels: a title, and
 * whatever control belongs on the right of it. */
export function RailHeader({
  title,
  children,
}: {
  title: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header
      className="flex items-center justify-between gap-2 flex-shrink-0"
      style={{
        padding: `var(--space-2xs) var(--space-xs)`,
        borderBottom: "1px solid var(--border)",
        minHeight: 38,
      }}
    >
      <span className="sp-panel-title truncate">{title}</span>
      {children}
    </header>
  );
}

/** Two-way tab strip for a rail. Deliberately literal labels — the whole
 * point of the Layers/Form split is that an admin can tell which ordering
 * they are editing. */
export function RailTabs<T extends string>({
  tabs,
  active,
  onSelect,
}: {
  tabs: Array<{ key: T; label: string; title: string }>;
  active: T;
  onSelect(key: T): void;
}) {
  return (
    <div
      role="tablist"
      className="flex flex-shrink-0"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={on}
            title={t.title}
            onClick={() => onSelect(t.key)}
            className="flex-1 py-2"
            style={{
              fontSize: "var(--type-caption-size)",
              fontWeight: on ? 500 : 400,
              color: on ? "var(--text-primary)" : "var(--text-secondary)",
              background: on ? "var(--bg-hover)" : "transparent",
              borderBottom: on ? "2px solid var(--text-primary)" : "2px solid transparent",
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/** A slide-over panel over the inspector: the Caption, Tags & details, and
 * Name steps. Escape closes it, which is why it takes an onClose. */
export function BuilderSlideOver({
  title,
  width,
  onClose,
  children,
  footer,
}: {
  title: React.ReactNode;
  width: number;
  onClose(): void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <aside
      className="sp-builder__slideover"
      style={{ width }}
      role="region"
      aria-label={typeof title === "string" ? title : undefined}
    >
      <RailHeader title={title}>
        <button
          onClick={onClose}
          className="sp-icon-btn"
          title="Close (Esc)"
          aria-label="Close this step"
        >
          <span aria-hidden style={{ fontSize: 16, lineHeight: 1 }}>
            ×
          </span>
        </button>
      </RailHeader>
      <div className="flex-1 min-h-0 overflow-y-auto" style={{ padding: "var(--space-sm)" }}>
        {children}
      </div>
      {footer && (
        <footer
          className="flex-shrink-0 flex items-center justify-between gap-2"
          style={{
            padding: "var(--space-2xs) var(--space-sm)",
            borderTop: "1px solid var(--border)",
          }}
        >
          {footer}
        </footer>
      )}
    </aside>
  );
}
