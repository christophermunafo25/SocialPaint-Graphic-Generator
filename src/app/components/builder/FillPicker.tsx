import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, RotateCw, ArrowLeftRight } from "lucide-react";
import type { BrandColor, BrandKit, TemplateField, TextGradient } from "@/lib/types";
import { DEFAULT_FILL_HEX, gradientCss } from "../SchemaRenderer";
import {
  formatColor,
  hsvToRgb,
  parseColor,
  parseHex,
  rgbToHsv,
  toHex,
  type ColorFormat,
  type HSV,
} from "@/lib/color";
import { useRouter } from "../../router";
import {
  NumericField,
  beginInspectorGesture,
  compactControlStyle,
  endInspectorGesture,
  inspectorLabelStyle,
} from "./InspectorControls";

// ---------------------------------------------------------------------------
// Fill picker — Figma's fill structure (swatch row → popover with tabs, fill
// type, SV square / hue / alpha, brand + recent swatches, gradient stop
// editing) built entirely on SocialPaint tokens. Only fill types the render
// pipeline can actually produce are offered: solid and linear gradient.
// Alpha rides inside 8-digit hex, so no schema change is involved anywhere.
// ---------------------------------------------------------------------------

/** The structured view over the field's flat fill properties. */
export type Fill =
  | { type: "solid"; hex: string; colorKey?: string }
  | { type: "gradient"; gradient: TextGradient };

export function getFill(field: TemplateField, kit: BrandKit | null): Fill | null {
  if (field.textGradient?.stops.length) return { type: "gradient", gradient: field.textGradient };
  if (field.colorKey) {
    const hex = kit?.colors.find((c) => c.key === field.colorKey)?.hex;
    if (hex) return { type: "solid", hex: hex.toUpperCase(), colorKey: field.colorKey };
  }
  if (field.colorHex) return { type: "solid", hex: field.colorHex.toUpperCase() };
  return null;
}

// --- Recent colors — persisted per workspace, most recent first ------------

const RECENT_CAP = 12;
const recentKey = (companyId: string) => `sp-recent-colors:${companyId}`;

export function readRecentColors(companyId: string | undefined): string[] {
  if (!companyId) return [];
  try {
    const list = JSON.parse(localStorage.getItem(recentKey(companyId)) ?? "[]");
    return Array.isArray(list) ? list.filter((c): c is string => typeof c === "string").slice(0, RECENT_CAP) : [];
  } catch {
    return [];
  }
}

export function pushRecentColor(companyId: string | undefined, hex: string): void {
  if (!companyId) return;
  try {
    const list = readRecentColors(companyId).filter((c) => c.toUpperCase() !== hex.toUpperCase());
    list.unshift(hex.toUpperCase());
    localStorage.setItem(recentKey(companyId), JSON.stringify(list.slice(0, RECENT_CAP)));
  } catch {
    // persistence is best-effort
  }
}

// --- Shared bits -----------------------------------------------------------

/** Checkerboard under translucent color — on the never-inverting white
 * imagery plate so alpha reads the same in both themes. */
const checkerCss =
  "repeating-conic-gradient(var(--border-strong) 0% 25%, transparent 0% 50%) 0 0 / 12px 12px, var(--bg-plate)";

function Swatch({
  css,
  size = 24,
  title,
  ariaLabel,
  disabled,
  selected,
  onClick,
}: {
  css: string;
  size?: number;
  title?: string;
  ariaLabel: string;
  disabled?: boolean;
  selected?: boolean;
  onClick?(): void;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={ariaLabel}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: "var(--radius-control)",
        border: selected ? "2px solid var(--ring)" : "1px solid var(--border-strong)",
        background: `${css}, ${checkerCss}`,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    />
  );
}

const HEX_ROW_RE = /^#?([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/;

/** Editable hex text (mono) committing on Enter/blur, reverting on Escape. */
function HexInput({
  value,
  disabled,
  ariaLabel,
  onCommit,
}: {
  value: string;
  disabled?: boolean;
  ariaLabel: string;
  onCommit(hex: string): void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const m = HEX_ROW_RE.exec(draft.trim());
    if (m) onCommit(`#${m[1].toUpperCase()}${m[2] ? m[2].toUpperCase() : ""}`);
    setDraft(null);
  };
  return (
    <input
      type="text"
      spellCheck={false}
      disabled={disabled}
      aria-label={ariaLabel}
      className="sp-input"
      style={{
        ...compactControlStyle,
        fontFamily: "var(--font-mono)",
        fontSize: "var(--type-caption-size)",
        minWidth: 0,
        flex: 1,
      }}
      value={draft ?? value}
      onFocus={(e) => {
        setDraft(value);
        e.target.select();
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          setDraft(null);
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}

/** Horizontal drag surface (hue / alpha sliders, and the SV square's x/y). */
function useDrag2D(onMove: (x: number, y: number) => void) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const apply = useCallback(
    (e: PointerEvent | React.PointerEvent) => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      onMove(
        Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
        Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
      );
    },
    [onMove],
  );
  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    beginInspectorGesture();
    apply(e);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (dragging.current) apply(e);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    dragging.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    endInspectorGesture();
  };
  return { ref, handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp } };
}

const sliderHandle: React.CSSProperties = {
  position: "absolute",
  top: "50%",
  width: 12,
  height: 12,
  borderRadius: "50%",
  border: "2px solid var(--bg-plate)",
  boxShadow: "0 0 0 1px var(--border-strong)",
  transform: "translate(-50%, -50%)",
  pointerEvents: "none",
};

// --- The popover -----------------------------------------------------------

interface FillPickerProps {
  anchorRef: React.RefObject<HTMLElement | null>;
  field: TemplateField;
  kit: BrandKit | null;
  companyId: string | undefined;
  /** Brand rules lock the fill — everything renders read-only. */
  locked: boolean;
  onChange(patch: Partial<TemplateField>): void;
  onClose(): void;
}

export function FillPicker({ anchorRef, field, kit, companyId, locked, onChange, onClose }: FillPickerProps) {
  const { navigate } = useRouter();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<"custom" | "libraries">("custom");
  const fill = getFill(field, kit);
  const mode: "solid" | "gradient" = fill?.type === "gradient" ? "gradient" : "solid";
  const gradient = fill?.type === "gradient" ? fill.gradient : undefined;
  const [stopIndex, setStopIndex] = useState(0);

  /** The hex currently being edited: the solid fill, or the selected stop. */
  const targetHex =
    mode === "gradient"
      ? gradient?.stops[Math.min(stopIndex, (gradient?.stops.length ?? 1) - 1)]?.color ?? DEFAULT_FILL_HEX
      : fill?.type === "solid"
        ? fill.hex
        : DEFAULT_FILL_HEX;

  // HSV state lives locally (hue is ambiguous at zero saturation); it syncs
  // from the target hex whenever a change arrives that we didn't emit.
  const lastEmit = useRef<string | null>(null);
  const [hsv, setHsv] = useState<HSV>(() => rgbToHsv(parseHex(targetHex) ?? { r: 17, g: 17, b: 17, a: 1 }));
  const [alpha, setAlpha] = useState(() => parseHex(targetHex)?.a ?? 1);
  useEffect(() => {
    if (lastEmit.current === targetHex) return;
    const p = parseHex(targetHex);
    if (p) {
      setHsv(rgbToHsv(p));
      setAlpha(p.a);
    }
  }, [targetHex]);

  const [format, setFormat] = useState<ColorFormat>("hex");

  const applyHex = useCallback(
    (hex: string) => {
      lastEmit.current = hex;
      if (mode === "gradient" && gradient) {
        onChange({
          textGradient: {
            ...gradient,
            stops: gradient.stops.map((s, i) => (i === stopIndex ? { ...s, color: hex } : s)),
          },
        });
      } else {
        onChange({ colorHex: hex, colorKey: undefined, textGradient: undefined });
      }
    },
    [mode, gradient, stopIndex, onChange],
  );

  const commitHsv = (next: HSV, nextAlpha = alpha) => {
    setHsv(next);
    setAlpha(nextAlpha);
    applyHex(toHex({ ...hsvToRgb(next), a: nextAlpha }));
  };

  // Remember the custom color for the workspace when the picker closes.
  const close = useCallback(() => {
    const f = getFill(field, kit);
    if (f?.type === "solid" && !f.colorKey) pushRecentColor(companyId, f.hex);
    onClose();
  }, [field, kit, companyId, onClose]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (
        !surfaceRef.current?.contains(e.target as Node) &&
        !anchorRef.current?.contains(e.target as Node)
      ) {
        close();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // The builder also listens for Escape on window (clear selection) —
        // same node, so only the immediate variant actually stops it.
        e.stopImmediatePropagation();
        e.preventDefault();
        close();
      }
    };
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [close, anchorRef]);

  // --- Positioning: to the LEFT of the anchor (the inspector hugs the
  // viewport's right edge), clamped to the viewport vertically.
  const rect = anchorRef.current?.getBoundingClientRect();
  const width = 240;
  const maxHeight = Math.min(560, window.innerHeight - 16);
  const left = rect ? Math.max(8, rect.left - width - 8) : 8;
  const top = rect ? Math.min(Math.max(8, rect.top), window.innerHeight - maxHeight - 8) : 8;

  const sv = useDrag2D((x, y) => commitHsv({ ...hsv, s: x, v: 1 - y }));
  const hue = useDrag2D((x) => commitHsv({ ...hsv, h: x * 360 }));
  const alphaDrag = useDrag2D((x) => commitHsv(hsv, Math.round(x * 100) / 100));

  const rgba = { ...hsvToRgb(hsv), a: alpha };
  const opaqueHex = toHex({ ...rgba, a: 1 });
  const recents = useMemo(() => readRecentColors(companyId), [companyId]);

  const setGradient = (g: TextGradient) => onChange({ textGradient: g, colorHex: undefined, colorKey: undefined });

  const switchMode = (next: "solid" | "gradient") => {
    if (next === mode || locked) return;
    if (next === "gradient") {
      const base = fill?.type === "solid" ? fill.hex.slice(0, 7) : DEFAULT_FILL_HEX;
      setStopIndex(0);
      setGradient({ angle: 90, stops: [{ position: 0, color: base }, { position: 1, color: `${base}00` }] });
    } else {
      const first = gradient?.stops[0]?.color ?? DEFAULT_FILL_HEX;
      onChange({ colorHex: first.slice(0, 7), colorKey: undefined, textGradient: undefined });
    }
  };

  const sortedCommit = (g: TextGradient) =>
    setGradient({ ...g, stops: [...g.stops].sort((a, b) => a.position - b.position) });

  const sectionLabel: React.CSSProperties = { ...inspectorLabelStyle, fontSize: 10 };

  return (
    <div
      ref={surfaceRef}
      role="dialog"
      aria-label="Fill picker"
      className="fixed flex flex-col"
      style={{
        left,
        top,
        width,
        maxHeight,
        overflowY: "auto",
        zIndex: "var(--z-popover)" as unknown as number,
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-card)",
        padding: "var(--space-xs)",
        gap: "var(--space-xs)",
      }}
    >
      {/* Tabs */}
      <div className="flex items-center" style={{ gap: "var(--space-sm)" }}>
        {(["custom", "libraries"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            aria-selected={tab === t}
            role="tab"
            style={{
              ...inspectorLabelStyle,
              color: tab === t ? "var(--text-primary)" : "var(--text-secondary)",
              paddingBottom: 2,
              borderBottom: tab === t ? "1px solid var(--text-primary)" : "1px solid transparent",
            }}
          >
            {t === "custom" ? "Custom" : "Libraries"}
          </button>
        ))}
      </div>

      {tab === "libraries" ? (
        <p style={{ fontSize: "var(--type-caption-size)", color: "var(--text-secondary)" }}>
          Library fills aren't connected yet. Brand colors live under Custom.
        </p>
      ) : (
        <>
          {/* Fill type — only what the pipeline renders: solid, linear gradient */}
          <div className="sp-seg" data-stretch role="group" aria-label="Fill type">
            {(["solid", "gradient"] as const).map((t) => (
              <button
                key={t}
                disabled={locked}
                aria-pressed={mode === t}
                data-active={mode === t || undefined}
                onClick={() => switchMode(t)}
                style={{ textTransform: "capitalize" }}
              >
                {t}
              </button>
            ))}
          </div>

          {mode === "gradient" && gradient && (
            <>
              {/* Live preview bar with draggable stop handles */}
              <GradientBar
                gradient={gradient}
                stopIndex={stopIndex}
                disabled={locked}
                onSelect={setStopIndex}
                onChange={setGradient}
                onDragEnd={() => sortedCommit(gradient)}
              />
              <div className="flex items-center" style={{ gap: "var(--space-2xs)" }}>
                <span style={sectionLabel}>Linear</span>
                <div style={{ flex: 1 }} />
                <NumericField
                  suffix="°"
                  ariaLabel="Gradient angle"
                  precision={0}
                  value={gradient.angle}
                  onCommit={(v) => setGradient({ ...gradient, angle: ((v ?? 0) % 360 + 360) % 360 })}
                />
                <button
                  title="Reverse gradient"
                  disabled={locked}
                  onClick={() =>
                    setGradient({
                      ...gradient,
                      stops: gradient.stops.map((s) => ({ ...s, position: 1 - s.position })).reverse(),
                    })
                  }
                  style={{ color: "var(--text-secondary)", display: "flex" }}
                >
                  <ArrowLeftRight style={{ width: 13, height: 13 }} strokeWidth={1.5} />
                </button>
                <button
                  title="Rotate 90°"
                  disabled={locked}
                  onClick={() => setGradient({ ...gradient, angle: (gradient.angle + 90) % 360 })}
                  style={{ color: "var(--text-secondary)", display: "flex" }}
                >
                  <RotateCw style={{ width: 13, height: 13 }} strokeWidth={1.5} />
                </button>
              </div>

              {/* Stops list */}
              <div className="flex items-center justify-between">
                <span style={sectionLabel}>Stops</span>
                <button
                  title="Add stop"
                  disabled={locked}
                  aria-label="Add gradient stop"
                  onClick={() => {
                    const mid = gradient.stops[stopIndex];
                    const next = { position: 0.5, color: mid?.color ?? DEFAULT_FILL_HEX };
                    sortedCommit({ ...gradient, stops: [...gradient.stops, next] });
                  }}
                  style={{ color: "var(--text-secondary)", display: "flex" }}
                >
                  <Plus style={{ width: 13, height: 13 }} strokeWidth={1.5} />
                </button>
              </div>
              {gradient.stops.map((stop, i) => {
                const p = parseHex(stop.color);
                return (
                  <div key={i} className="flex items-center" style={{ gap: "var(--space-2xs)" }}>
                    <NumericField
                      suffix="%"
                      ariaLabel={`Stop ${i + 1} position`}
                      precision={0}
                      min={0}
                      max={100}
                      value={Math.round(stop.position * 100)}
                      disabled={locked}
                      onCommit={(v) =>
                        sortedCommit({
                          ...gradient,
                          stops: gradient.stops.map((s, j) => (j === i ? { ...s, position: (v ?? 0) / 100 } : s)),
                        })
                      }
                    />
                    <Swatch
                      css={stop.color.slice(0, 7)}
                      ariaLabel={`Edit stop ${i + 1} color`}
                      selected={i === stopIndex}
                      disabled={locked}
                      onClick={() => setStopIndex(i)}
                    />
                    <NumericField
                      suffix="%"
                      ariaLabel={`Stop ${i + 1} opacity`}
                      precision={0}
                      min={0}
                      max={100}
                      value={Math.round((p?.a ?? 1) * 100)}
                      disabled={locked}
                      onCommit={(v) => {
                        const base = parseHex(stop.color);
                        if (!base) return;
                        setGradient({
                          ...gradient,
                          stops: gradient.stops.map((s, j) =>
                            j === i ? { ...s, color: toHex({ ...base, a: (v ?? 100) / 100 }) } : s,
                          ),
                        });
                      }}
                    />
                    <button
                      title="Remove stop"
                      aria-label={`Remove stop ${i + 1}`}
                      disabled={locked || gradient.stops.length <= 2}
                      onClick={() => {
                        sortedCommit({ ...gradient, stops: gradient.stops.filter((_, j) => j !== i) });
                        setStopIndex(0);
                      }}
                      style={{
                        color: gradient.stops.length <= 2 ? "var(--text-disabled)" : "var(--text-muted)",
                        display: "flex",
                        flexShrink: 0,
                      }}
                    >
                      <Minus style={{ width: 13, height: 13 }} strokeWidth={1.5} />
                    </button>
                  </div>
                );
              })}
              <p style={{ fontSize: 10, color: "var(--text-secondary)" }}>
                Editing stop {Math.min(stopIndex, gradient.stops.length - 1) + 1} below.
              </p>
            </>
          )}

          {/* Solid controls — for the solid fill, or the selected stop */}
          <div
            {...sv.handlers}
            ref={sv.ref}
            role="slider"
            aria-label="Saturation and brightness"
            aria-valuetext={`saturation ${Math.round(hsv.s * 100)}%, brightness ${Math.round(hsv.v * 100)}%`}
            style={{
              position: "relative",
              height: 120,
              borderRadius: "var(--radius-control)",
              border: "1px solid var(--border)",
              background: `linear-gradient(to top, black, transparent), linear-gradient(to right, white, hsl(${hsv.h} 100% 50%))`,
              cursor: locked ? "default" : "crosshair",
              touchAction: "none",
              pointerEvents: locked ? "none" : undefined,
            }}
          >
            <span
              style={{
                ...sliderHandle,
                left: `${hsv.s * 100}%`,
                top: `${(1 - hsv.v) * 100}%`,
                background: opaqueHex,
              }}
            />
          </div>
          <div
            {...hue.handlers}
            ref={hue.ref}
            role="slider"
            aria-label="Hue"
            aria-valuenow={Math.round(hsv.h)}
            style={{
              position: "relative",
              height: 12,
              borderRadius: "var(--radius-pill)",
              background:
                "linear-gradient(to right, hsl(0 100% 50%), hsl(60 100% 50%), hsl(120 100% 50%), hsl(180 100% 50%), hsl(240 100% 50%), hsl(300 100% 50%), hsl(360 100% 50%))",
              cursor: locked ? "default" : "pointer",
              touchAction: "none",
              pointerEvents: locked ? "none" : undefined,
            }}
          >
            <span style={{ ...sliderHandle, left: `${(hsv.h / 360) * 100}%`, background: `hsl(${hsv.h} 100% 50%)` }} />
          </div>
          <div
            {...alphaDrag.handlers}
            ref={alphaDrag.ref}
            role="slider"
            aria-label="Alpha"
            aria-valuenow={Math.round(alpha * 100)}
            style={{
              position: "relative",
              height: 12,
              borderRadius: "var(--radius-pill)",
              background: `linear-gradient(to right, transparent, ${opaqueHex}), ${checkerCss}`,
              cursor: locked ? "default" : "pointer",
              touchAction: "none",
              pointerEvents: locked ? "none" : undefined,
            }}
          >
            <span style={{ ...sliderHandle, left: `${alpha * 100}%`, background: opaqueHex }} />
          </div>

          {/* Format + value + alpha */}
          <div className="flex items-center" style={{ gap: "var(--space-2xs)" }}>
            <select
              className="sp-input"
              style={{ ...compactControlStyle, width: 58, flexShrink: 0, padding: "0 var(--space-3xs)" }}
              aria-label="Color format"
              value={format}
              onChange={(e) => setFormat(e.target.value as ColorFormat)}
            >
              <option value="hex">Hex</option>
              <option value="rgb">RGB</option>
              <option value="hsl">HSL</option>
            </select>
            <FormatValueInput
              rgba={rgba}
              format={format}
              disabled={locked}
              onCommit={(rgb) => {
                const next = rgbToHsv(rgb);
                commitHsv(next);
              }}
            />
            <NumericField
              suffix="%"
              ariaLabel="Color opacity"
              precision={0}
              min={0}
              max={100}
              disabled={locked}
              value={Math.round(alpha * 100)}
              onCommit={(v) => commitHsv(hsv, (v ?? 100) / 100)}
            />
          </div>

          {/* Brand colors — one click binds by palette KEY so re-theming
              propagates. Gradient stops take the hex (stops can't bind). */}
          <span style={sectionLabel}>Brand colors</span>
          {(kit?.colors.length ?? 0) > 0 ? (
            <div className="flex flex-wrap" style={{ gap: "var(--space-3xs)" }}>
              {kit!.colors.map((c: BrandColor) => (
                <Swatch
                  key={c.key}
                  css={c.hex}
                  title={c.name}
                  ariaLabel={`Use brand color ${c.name}`}
                  disabled={locked}
                  selected={fill?.type === "solid" && fill.colorKey === c.key}
                  onClick={() => {
                    if (mode === "gradient" && gradient) {
                      applyHex(c.hex.toUpperCase());
                    } else {
                      lastEmit.current = null;
                      onChange({ colorKey: c.key, colorHex: undefined, textGradient: undefined });
                    }
                  }}
                />
              ))}
            </div>
          ) : (
            <p style={{ fontSize: "var(--type-caption-size)", color: "var(--text-secondary)" }}>
              No brand palette yet.{" "}
              <button
                onClick={() => navigate({ name: "brandStudio" })}
                style={{ color: "var(--state-primary)", textDecoration: "underline" }}
              >
                Set one up in Brand Studio
              </button>{" "}
              and every color lands here.
            </p>
          )}

          {/* Recent colors */}
          {recents.length > 0 && (
            <>
              <span style={sectionLabel}>Recent</span>
              <div className="flex flex-wrap" style={{ gap: "var(--space-3xs)" }}>
                {recents.map((hex) => (
                  <Swatch
                    key={hex}
                    css={hex.length > 7 ? hex.slice(0, 7) : hex}
                    title={hex}
                    ariaLabel={`Use recent color ${hex}`}
                    disabled={locked}
                    onClick={() => applyHex(hex)}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

/** The format-aware value input beside the format select. */
function FormatValueInput({
  rgba,
  format,
  disabled,
  onCommit,
}: {
  rgba: { r: number; g: number; b: number; a: number };
  format: ColorFormat;
  disabled?: boolean;
  onCommit(rgb: { r: number; g: number; b: number }): void;
}) {
  const shown = formatColor(rgba, format);
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const parsed = parseColor(draft, format);
    if (parsed) onCommit(parsed);
    setDraft(null);
  };
  return (
    <input
      type="text"
      spellCheck={false}
      disabled={disabled}
      aria-label="Color value"
      className="sp-input"
      style={{
        ...compactControlStyle,
        fontFamily: "var(--font-mono)",
        fontSize: "var(--type-caption-size)",
        minWidth: 0,
        flex: 1,
      }}
      value={draft ?? shown}
      onFocus={(e) => {
        setDraft(shown);
        e.target.select();
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          setDraft(null);
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}

/** Gradient preview strip with draggable stop handles. */
function GradientBar({
  gradient,
  stopIndex,
  disabled,
  onSelect,
  onChange,
  onDragEnd,
}: {
  gradient: TextGradient;
  stopIndex: number;
  disabled?: boolean;
  onSelect(i: number): void;
  onChange(g: TextGradient): void;
  onDragEnd(): void;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<number | null>(null);

  const positionFromEvent = (e: React.PointerEvent): number => {
    const r = barRef.current!.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
  };

  // Preview always reads left→right; the angle field states the real angle.
  const previewCss = gradientCss({ ...gradient, angle: 90, stops: [...gradient.stops].sort((a, b) => a.position - b.position) });

  return (
    <div
      ref={barRef}
      style={{
        position: "relative",
        height: 20,
        borderRadius: "var(--radius-control)",
        border: "1px solid var(--border)",
        background: `${previewCss}, ${checkerCss}`,
      }}
    >
      {gradient.stops.map((stop, i) => (
        <button
          key={i}
          title={`Stop ${i + 1}`}
          aria-label={`Gradient stop ${i + 1} at ${Math.round(stop.position * 100)}%`}
          disabled={disabled}
          onPointerDown={(e) => {
            if (disabled) return;
            e.preventDefault();
            dragging.current = i;
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            beginInspectorGesture();
            onSelect(i);
          }}
          onPointerMove={(e) => {
            if (dragging.current !== i) return;
            const p = positionFromEvent(e);
            onChange({
              ...gradient,
              stops: gradient.stops.map((s, j) => (j === i ? { ...s, position: p } : s)),
            });
          }}
          onPointerUp={(e) => {
            if (dragging.current === i) {
              dragging.current = null;
              (e.target as HTMLElement).releasePointerCapture(e.pointerId);
              endInspectorGesture();
              onDragEnd();
            }
          }}
          onPointerCancel={(e) => {
            if (dragging.current === i) {
              dragging.current = null;
              (e.target as HTMLElement).releasePointerCapture(e.pointerId);
              endInspectorGesture();
              onDragEnd();
            }
          }}
          style={{
            position: "absolute",
            left: `${stop.position * 100}%`,
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: stop.color.slice(0, 7),
            border: i === stopIndex ? "2px solid var(--ring)" : "2px solid var(--bg-plate)",
            boxShadow: "0 0 0 1px var(--border-strong)",
            cursor: disabled ? "default" : "ew-resize",
            touchAction: "none",
          }}
        />
      ))}
    </div>
  );
}
