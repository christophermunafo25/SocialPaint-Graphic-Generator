import React, { useEffect, useRef, useState } from "react";
import {
  AlignCenter,
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignLeft,
  AlignRight,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  ArrowDownToLine,
  ArrowUpToLine,
  ChevronDown,
  Link as LinkIcon,
  Lock,
  Pin,
  RefreshCw,
  RotateCw,
  Trash2,
  Unlink,
  Unlock,
  Upload,
} from "lucide-react";
import type { BrandKit, CornerRadius, FieldType, TemplateField, TextGradient } from "@/lib/types";
import { stores } from "@/lib/stores";
import { useAuth } from "@/lib/auth/AuthContext";
import { useBrand } from "@/lib/brand/BrandContext";
import { GOOGLE_FONTS } from "@/lib/render/fonts";
import { suggestFieldKey } from "@/lib/caption";
import { useFileDrop } from "@/lib/useFileDrop";
import { getTypeStyle, lockedProperties, ruleSentences } from "@/lib/brand/resolveStyle";
import { ColorControl } from "../ColorControl";
import { GradientEditor } from "./GradientEditor";

interface FieldInspectorProps {
  field: TemplateField;
  allFields: TemplateField[];
  /** Canvas size — the alignment buttons align against these bounds. */
  canvasWidth: number;
  canvasHeight: number;
  onChange(patch: Partial<TemplateField>): void;
  onDelete(): void;
  /** Canvas layer order (separate from the form order in the field list). */
  onBringToFront(): void;
  onSendToBack(): void;
  /** When this matches the shown field's id, focus + select the label input
   * (a just-dropped palette element opens for naming). */
  focusLabelFieldId?: string | null;
}

const FIELD_TYPES: Array<{ value: FieldType; label: string }> = [
  { value: "text", label: "Text (single line)" },
  { value: "multiline", label: "Text (multi-line)" },
  { value: "image", label: "Image" },
  { value: "select", label: "Dropdown" },
  { value: "shape", label: "Shape" },
];

const SHAPE_KINDS: Array<{ value: NonNullable<TemplateField["shape"]>; label: string }> = [
  { value: "rect", label: "Rectangle" },
  { value: "ellipse", label: "Ellipse" },
  { value: "triangle", label: "Triangle" },
  { value: "star", label: "Star" },
];

const labelClass = "sp-eyebrow block mb-1";
const labelStyle: React.CSSProperties = {};
const controlClass = "sp-input";
const controlStyle: React.CSSProperties = {};

// ---------------------------------------------------------------------------
// Collapsible sections — open/closed state persists per section across
// selections and sessions, so the inspector stays the way the admin left it.
// ---------------------------------------------------------------------------

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

function Section({
  id,
  title,
  defaultOpen = true,
  headerExtra,
  children,
}: {
  id: string;
  title: string;
  defaultOpen?: boolean;
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(() => readOpen(id, defaultOpen));
  return (
    <div className="pt-3" style={{ borderTop: "1px solid var(--hairline)" }}>
      <div className="flex items-center justify-between" style={{ paddingBottom: open ? 10 : 2 }}>
        <button
          onClick={() => {
            setOpen(!open);
            writeOpen(id, !open);
          }}
          aria-expanded={open}
          className="flex-1 flex items-center justify-between text-left"
        >
          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{title}</span>
          <ChevronDown
            style={{
              width: 13,
              height: 13,
              color: "var(--fg-3)",
              transform: open ? undefined : "rotate(-90deg)",
              transition: "transform var(--dur-state) var(--ease)",
            }}
          />
        </button>
        {headerExtra}
      </div>
      {open && <div className="space-y-3">{children}</div>}
    </div>
  );
}

/** Figma-style inline-labeled number input: a small prefix ("X", "W", "°")
 * inside the control, value editable next to it. */
function InlineNum({
  prefix,
  value,
  placeholder,
  step,
  onCommit,
  disabled,
}: {
  prefix: string;
  value: number | "";
  placeholder?: string;
  step?: number;
  onCommit(next: number | undefined): void;
  disabled?: boolean;
}) {
  return (
    <label
      className="sp-input flex items-center gap-2"
      style={{ padding: "7px 10px", cursor: disabled ? "default" : "text", opacity: disabled ? 0.5 : 1 }}
    >
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-4)", flexShrink: 0 }}>
        {prefix}
      </span>
      <input
        type="number"
        step={step}
        disabled={disabled}
        className="w-full bg-transparent outline-none border-none"
        style={{ fontSize: 13, color: "var(--ink)", padding: 0 }}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onCommit(e.target.value === "" ? undefined : Number(e.target.value))}
      />
    </label>
  );
}

/** A row of small icon buttons (alignment triplets, etc.). */
function IconRow<T extends string>({
  options,
  value,
  onSelect,
  ariaLabel,
}: {
  options: Array<{ key: T; Icon: typeof AlignLeft; title: string }>;
  value?: T | null;
  onSelect(key: T): void;
  ariaLabel: string;
}) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label={ariaLabel}>
      {options.map(({ key, Icon, title }) => (
        <button
          key={key}
          title={title}
          aria-pressed={value === key}
          onClick={() => onSelect(key)}
          className="flex items-center justify-center rounded-md"
          style={{
            width: 30,
            height: 26,
            border: "1px solid",
            borderColor: value === key ? "var(--solar)" : "transparent",
            background: value === key ? "var(--accent-wash)" : "transparent",
            color: value === key ? "var(--solar)" : "var(--fg-2)",
          }}
        >
          <Icon style={{ width: 14, height: 14 }} />
        </button>
      ))}
    </div>
  );
}

type ResizeMode = "free" | "shrink" | "fixed";

/** Inspector for the selected field, laid out Figma-style: identity, then
 * collapsible Position / Layout / Appearance / Typography / Fill /
 * Member-input sections. */
export function FieldInspector({
  field,
  allFields,
  canvasWidth,
  canvasHeight,
  onChange,
  onDelete,
  onBringToFront,
  onSendToBack,
  focusLabelFieldId,
}: FieldInspectorProps) {
  const { kit, assets } = useBrand();
  const { company } = useAuth();
  const isText = field.type === "text" || field.type === "multiline" || field.type === "select";
  const isShape = field.type === "shape";
  const isStatic = Boolean(field.static);
  const boundStyle = getTypeStyle(kit, field.typeStyleKey);
  const locked = lockedProperties(boundStyle);
  const labelRef = useRef<HTMLInputElement>(null);
  const [uploadingStatic, setUploadingStatic] = useState(false);

  const uploadStaticImage = async (file: File) => {
    if (!company) return;
    setUploadingStatic(true);
    try {
      const url = await stores.templates.uploadBackground(company.id, file, file.name);
      onChange({ staticValue: url });
    } catch (e) {
      console.error("Static image upload failed", e);
    } finally {
      setUploadingStatic(false);
    }
  };

  const staticDrop = useFileDrop((files) => {
    if (files[0]) void uploadStaticImage(files[0]);
  });

  // A freshly-dropped palette element opens for naming immediately; the
  // parent clears focusLabelFieldId once selection moves on, so merely
  // re-selecting a field never steals focus into the label input.
  useEffect(() => {
    if (focusLabelFieldId !== field.id) return;
    labelRef.current?.focus();
    labelRef.current?.select();
  }, [focusLabelFieldId, field.id]);

  const canLockWidth = field.type === "text" || field.type === "multiline";
  const centered = field.anchor === "center";

  // --- Position helpers ----------------------------------------------------

  /** Align the box against the canvas bounds (anchor-aware). */
  const alignH = (pos: "start" | "center" | "end") => {
    const left = pos === "start" ? 0 : pos === "center" ? (canvasWidth - field.width) / 2 : canvasWidth - field.width;
    onChange({ x: Math.round(centered ? left + field.width / 2 : left) });
  };
  const alignV = (pos: "start" | "center" | "end") => {
    const top = pos === "start" ? 0 : pos === "center" ? (canvasHeight - field.height) / 2 : canvasHeight - field.height;
    onChange({ y: Math.round(centered ? top + field.height / 2 : top) });
  };

  /** Switching the anchor converts X/Y so the box stays exactly where it is
   * (the old behavior reinterpreted the coordinates and the box jumped). */
  const changeAnchor = (anchor: "topLeft" | "center") => {
    const was = field.anchor === "center" ? "center" : "topLeft";
    if (anchor === was) return;
    if (anchor === "center") {
      onChange({ anchor: "center", x: Math.round(field.x + field.width / 2), y: Math.round(field.y + field.height / 2) });
    } else {
      onChange({ anchor: "topLeft", x: Math.round(field.x - field.width / 2), y: Math.round(field.y - field.height / 2) });
    }
  };

  // --- Layout helpers ------------------------------------------------------

  const resizeMode: ResizeMode = field.fixedWidth ? "fixed" : field.autoFit ? "shrink" : "free";
  const setResizeMode = (mode: ResizeMode) => {
    if (mode === "free") onChange({ autoFit: undefined, fixedWidth: undefined });
    else if (mode === "shrink") onChange({ autoFit: true, fixedWidth: undefined });
    else onChange({ fixedWidth: true, autoFit: undefined });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="sp-panel-title">Field settings</h3>
        <div className="flex items-center gap-2.5">
          <button onClick={onDelete} title="Delete field">
            <Trash2 className="w-4 h-4" style={{ color: "var(--destructive)" }} />
          </button>
        </div>
      </div>

      {/* Identity — always visible */}
      <div className="space-y-3">
        <div>
          <label className={labelClass} style={labelStyle}>Label</label>
          <input
            ref={labelRef}
            className={controlClass}
            style={controlStyle}
            value={field.label}
            onChange={(e) => {
              const label = e.target.value;
              onChange({
                label,
                fieldKey: suggestFieldKey(label, allFields.filter((f) => f.id !== field.id)),
              });
            }}
          />
          {!isStatic && (
            <p className="text-[10px] mt-1 font-mono" style={{ color: "var(--muted-foreground)" }}>
              caption tag: {"{"}{field.fieldKey}{"}"}
            </p>
          )}
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>Type</label>
          <select
            className={controlClass}
            style={controlStyle}
            value={field.type}
            onChange={(e) => {
              const t = e.target.value as FieldType;
              if (t === "shape") {
                // Shapes are always static design elements with a fill.
                onChange({ type: t, shape: field.shape ?? "rect", static: true, colorHex: field.colorHex ?? "#d9d9d9" });
              } else if (isShape) {
                onChange({ type: t, shape: undefined, static: undefined, staticValue: undefined });
              } else {
                onChange({ type: t });
              }
            }}
          >
            {FIELD_TYPES.filter((t) => !isStatic || isShape || t.value !== "select").map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {isShape && (
          <div>
            <label className={labelClass} style={labelStyle}>Shape</label>
            <select
              className={controlClass}
              style={controlStyle}
              value={field.shape ?? "rect"}
              onChange={(e) => onChange({ shape: e.target.value as TemplateField["shape"] })}
            >
              {SHAPE_KINDS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <p style={{ fontSize: 11, color: "var(--fg-3)", marginTop: 4 }}>
              Shapes are design-only — members never see them as fields.
            </p>
          </div>
        )}

        {field.type !== "select" && !isShape && (
          <label
            className="flex items-start gap-2 cursor-pointer"
            style={{ fontSize: 13, color: "var(--ink)" }}
          >
            <input
              type="checkbox"
              style={{ marginTop: 3 }}
              checked={isStatic}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? { static: true, required: undefined, placeholder: undefined, maxLength: undefined }
                    : { static: undefined, staticValue: undefined },
                )
              }
            />
            <span>
              <Pin style={{ width: 11, height: 11, display: "inline", marginRight: 4, verticalAlign: "-1px", color: "var(--solar)" }} />
              Fixed element
              <span style={{ display: "block", fontSize: 11, color: "var(--fg-3)" }}>
                Baked into the graphic — members don't see or edit it.
              </span>
            </span>
          </label>
        )}

        {isStatic && isText && (
          <div>
            <label className={labelClass} style={labelStyle}>Content</label>
            <textarea
              rows={field.type === "multiline" ? 3 : 1}
              className={controlClass}
              style={{ ...controlStyle, resize: "vertical" }}
              value={field.staticValue ?? ""}
              placeholder="The exact text shown on the graphic"
              onChange={(e) => onChange({ staticValue: e.target.value || undefined })}
            />
          </div>
        )}
        {isStatic && field.type === "image" && (
          <div>
            <label className={labelClass} style={labelStyle}>Image</label>
            <label
              {...staticDrop.bind}
              data-active={staticDrop.active}
              className="sp-dropzone flex items-center justify-center gap-2 cursor-pointer py-2.5"
              style={{
                border: "1.5px dashed var(--hairline-strong)",
                borderRadius: 8,
                fontSize: 12,
                color: "var(--fg-2)",
              }}
            >
              {uploadingStatic ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" style={{ color: "var(--solar)" }} />
              ) : (
                <Upload className="sp-dropzone__icon w-3.5 h-3.5" style={{ color: "var(--solar)" }} />
              )}
              {uploadingStatic ? "Uploading…" : field.staticValue ? "Replace image" : "Upload image"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadStaticImage(f);
                }}
              />
            </label>
          </div>
        )}
      </div>

      {/* Position — canvas alignment, coordinates, rotation */}
      <Section id="position" title="Position">
        <div>
          <label className={labelClass} style={labelStyle}>Alignment</label>
          <div className="flex items-center justify-between gap-2">
            <IconRow
              ariaLabel="Align horizontally on the canvas"
              options={[
                { key: "start", Icon: AlignStartVertical, title: "Align left edge of canvas" },
                { key: "center", Icon: AlignCenterVertical, title: "Center horizontally on canvas" },
                { key: "end", Icon: AlignEndVertical, title: "Align right edge of canvas" },
              ]}
              onSelect={(k) => alignH(k)}
            />
            <IconRow
              ariaLabel="Align vertically on the canvas"
              options={[
                { key: "start", Icon: AlignStartHorizontal, title: "Align top edge of canvas" },
                { key: "center", Icon: AlignCenterHorizontal, title: "Center vertically on canvas" },
                { key: "end", Icon: AlignEndHorizontal, title: "Align bottom edge of canvas" },
              ]}
              onSelect={(k) => alignV(k)}
            />
          </div>
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>Position</label>
          <div className="grid grid-cols-2 gap-2">
            <InlineNum prefix="X" value={Math.round(field.x)} onCommit={(v) => onChange({ x: v ?? 0 })} />
            <InlineNum prefix="Y" value={Math.round(field.y)} onCommit={(v) => onChange({ y: v ?? 0 })} />
          </div>
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>Rotation</label>
          <div className="grid grid-cols-2 gap-2 items-center">
            <InlineNum
              prefix="°"
              value={field.rotation ?? 0}
              onCommit={(v) => onChange({ rotation: v || undefined })}
            />
            <div className="flex items-center gap-1">
              <button
                title="Rotate 90° clockwise"
                onClick={() => onChange({ rotation: (((field.rotation ?? 0) + 90) % 360) || undefined })}
                className="flex items-center justify-center rounded-md"
                style={{ width: 30, height: 26, color: "var(--fg-2)", border: "1px solid var(--hairline)" }}
              >
                <RotateCw style={{ width: 13, height: 13 }} />
              </button>
            </div>
          </div>
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>Anchor point</label>
          <select
            className={controlClass}
            style={controlStyle}
            value={field.anchor ?? "topLeft"}
            onChange={(e) => changeAnchor(e.target.value as "topLeft" | "center")}
          >
            <option value="topLeft">Top-left (X/Y = box corner)</option>
            <option value="center">Center (X/Y = box center)</option>
          </select>
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>Layer order</label>
          <p style={{ fontSize: 10.5, color: "var(--fg-4)", marginBottom: 6 }}>
            What sits on top on the graphic.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button className="sp-btn sp-btn-ghost" onClick={onBringToFront}>
              <ArrowUpToLine className="w-3.5 h-3.5" />
              To front
            </button>
            <button className="sp-btn sp-btn-ghost" onClick={onSendToBack}>
              <ArrowDownToLine className="w-3.5 h-3.5" />
              To back
            </button>
          </div>
        </div>
      </Section>

      {/* Layout — resizing behavior + dimensions */}
      <Section id="layout" title="Layout">
        {canLockWidth && (
          <div>
            <label className={labelClass} style={labelStyle}>Resizing</label>
            <div
              className="grid grid-cols-3 rounded-lg overflow-hidden"
              style={{ border: "1px solid var(--hairline-strong)" }}
              role="group"
              aria-label="Text resizing behavior"
            >
              {(
                [
                  { key: "free", label: "Free", title: "Text renders at its set size — it may escape the box" },
                  { key: "shrink", label: "Shrink", title: "Text shrinks to fit as it gets longer (estimate)" },
                  { key: "fixed", label: "Fixed", title: field.type === "multiline" ? "Text wraps at the box edge and never escapes" : "Text shrinks at exactly the box edge and never escapes" },
                ] as Array<{ key: ResizeMode; label: string; title: string }>
              ).map(({ key, label, title }) => (
                <button
                  key={key}
                  title={title}
                  aria-pressed={resizeMode === key}
                  onClick={() => setResizeMode(key)}
                  className="py-1.5"
                  style={{
                    fontSize: 12,
                    background: resizeMode === key ? "var(--accent-wash)" : "transparent",
                    color: resizeMode === key ? "var(--solar)" : "var(--fg-2)",
                    fontWeight: resizeMode === key ? 500 : 400,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="sp-eyebrow">Dimensions</label>
            {canLockWidth && (
              <button
                onClick={() => setResizeMode(field.fixedWidth ? "free" : "fixed")}
                aria-pressed={Boolean(field.fixedWidth)}
                title={
                  field.fixedWidth
                    ? "Width locked — text never escapes the box. Click to unlock."
                    : "Lock the width — text shrinks/wraps at the box edge."
                }
              >
                {field.fixedWidth ? (
                  <Lock style={{ width: 12, height: 12, color: "var(--solar)" }} />
                ) : (
                  <Unlock style={{ width: 12, height: 12, color: "var(--fg-4)" }} />
                )}
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <InlineNum prefix="W" value={Math.round(field.width)} onCommit={(v) => onChange({ width: v ?? field.width })} />
            <InlineNum prefix="H" value={Math.round(field.height)} onCommit={(v) => onChange({ height: v ?? field.height })} />
          </div>
        </div>
        {isText && field.type !== "select" && resizeMode !== "free" && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelClass} style={labelStyle}>Min text size</label>
              <InlineNum
                prefix="px"
                value={field.minFontSizePx ?? ""}
                placeholder="18"
                onCommit={(v) => onChange({ minFontSizePx: v })}
              />
            </div>
          </div>
        )}
      </Section>

      {/* Appearance — opacity for every element; image rendering extras */}
      <Section id="appearance" title="Appearance">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelClass} style={labelStyle}>Opacity</label>
            <InlineNum
              prefix="%"
              value={field.opacity ?? 100}
              onCommit={(v) =>
                onChange({ opacity: v === undefined || v >= 100 ? undefined : Math.max(0, Math.min(100, v)) })
              }
            />
          </div>
        </div>
        {(field.type === "image" || (isShape && (field.shape ?? "rect") === "rect")) && (
          <CornerRadiusControl
            value={field.cornerRadius}
            onChange={(cornerRadius) => onChange({ cornerRadius })}
          />
        )}
        {field.type === "image" && (
          <div className="grid grid-cols-2 gap-3">
            {!isStatic && (
              <div>
                <label className={labelClass} style={labelStyle}>Crop ratio (w/h)</label>
                <input
                  type="number"
                  step="0.01"
                  className={controlClass}
                  style={controlStyle}
                  value={field.aspectRatio ?? ""}
                  placeholder={`box: ${(field.width / field.height).toFixed(2)}`}
                  onChange={(e) => onChange({ aspectRatio: e.target.value ? Number(e.target.value) : undefined })}
                />
              </div>
            )}
            <div>
              <label className={labelClass} style={labelStyle}>Fit</label>
              <select
                className={controlClass}
                style={controlStyle}
                value={field.objectFit ?? "cover"}
                onChange={(e) => onChange({ objectFit: e.target.value as TemplateField["objectFit"] })}
              >
                <option value="cover">Cover (fill box)</option>
                <option value="contain">Contain (fit inside)</option>
              </select>
            </div>
          </div>
        )}
      </Section>

      {/* Typography */}
      {isText && (
        <Section id="typography" title="Typography">
          <div>
            <label className={labelClass} style={labelStyle}>Saved style (optional)</label>
            <select
              className={controlClass}
              style={controlStyle}
              value={field.typeStyleKey ?? ""}
              onChange={(e) => onChange({ typeStyleKey: e.target.value || undefined })}
            >
              <option value="">None — style freely below</option>
              {(kit?.typeStyles ?? []).map((ts) => (
                <option key={ts.key} value={ts.key}>{ts.name}</option>
              ))}
            </select>
            {boundStyle && (
              <div
                className="mt-2 rounded-lg px-3 py-2 space-y-0.5"
                style={{ background: "var(--accent-wash)", border: "1px solid var(--accent-border)" }}
              >
                {ruleSentences(boundStyle, kit).map((r) => (
                  <p key={r} style={{ fontSize: 11, color: "var(--fg-2)" }}>
                    <Lock style={{ width: 10, height: 10, display: "inline", marginRight: 5, verticalAlign: "-1px", color: "var(--solar)" }} />
                    {r}
                  </p>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>Font</label>
            <FontSelect field={field} kit={kit} locked={locked} onChange={onChange} customFamilies={
              assets.filter((a) => a.kind === "font").map((a) => a.metadata.family ?? a.name)
            } />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              className={controlClass}
              style={controlStyle}
              aria-label="Font weight"
              disabled={locked.has("weight")}
              value={field.fontWeight ?? ""}
              onChange={(e) => onChange({ fontWeight: e.target.value ? Number(e.target.value) : undefined })}
            >
              <option value="">Weight</option>
              {[100, 200, 300, 400, 500, 600, 700, 800, 900].map((w) => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
            <InlineNum
              prefix="px"
              value={field.fontSizePx ?? 45}
              disabled={locked.has("fontSizePx")}
              onCommit={(v) => onChange({ fontSizePx: v ?? 45 })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelClass} style={labelStyle}>Line height</label>
              <InlineNum
                prefix="↕"
                step={0.05}
                value={field.lineHeight ?? ""}
                placeholder="1.1"
                disabled={locked.has("lineHeight")}
                onCommit={(v) => onChange({ lineHeight: v })}
              />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>Letter spacing</label>
              <InlineNum
                prefix="|A|"
                step={0.1}
                value={field.letterSpacingPx ?? ""}
                placeholder="0"
                disabled={locked.has("letterSpacingPx")}
                onCommit={(v) => onChange({ letterSpacingPx: v })}
              />
            </div>
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>Alignment</label>
            <div className="flex items-center justify-between gap-2">
              <IconRow
                ariaLabel="Horizontal text alignment"
                value={field.align ?? "left"}
                options={[
                  { key: "left", Icon: AlignLeft, title: "Align text left" },
                  { key: "center", Icon: AlignCenter, title: "Center text" },
                  { key: "right", Icon: AlignRight, title: "Align text right" },
                ]}
                onSelect={(k) => onChange({ align: k as TemplateField["align"] })}
              />
              <IconRow
                ariaLabel="Vertical text alignment"
                value={field.verticalAlign ?? "middle"}
                options={[
                  { key: "top", Icon: AlignVerticalJustifyStart, title: "Align text to the top of the box" },
                  { key: "middle", Icon: AlignVerticalJustifyCenter, title: "Center text vertically" },
                  { key: "bottom", Icon: AlignVerticalJustifyEnd, title: "Align text to the bottom of the box" },
                ]}
                onSelect={(k) => onChange({ verticalAlign: k === "middle" ? undefined : (k as TemplateField["verticalAlign"]) })}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm" style={{ color: "var(--foreground)" }}>
            <input
              type="checkbox"
              disabled={locked.has("uppercase")}
              checked={field.uppercase ?? false}
              onChange={(e) => onChange({ uppercase: e.target.checked || undefined })}
            />
            Uppercase
          </label>
        </Section>
      )}

      {/* Fill — text color / shape fill */}
      {(isText || isShape) && (
        <Section id="fill" title="Fill">
          <ColorControl
            ariaLabel="Field text color"
            value={field.colorHex ?? kit?.colors.find((c) => c.key === field.colorKey)?.hex}
            onChange={(hex) =>
              !locked.has("colorKey") &&
              onChange({ colorHex: hex, colorKey: undefined, textGradient: undefined })
            }
          />
          {(kit?.colors.length ?? 0) > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="sp-eyebrow" style={{ fontSize: 9 }}>Brand</span>
              {(kit?.colors ?? []).map((c) => (
                <button
                  key={c.key}
                  title={`${c.name} — click to use`}
                  disabled={locked.has("colorKey")}
                  onClick={() => onChange({ colorKey: c.key, colorHex: undefined, textGradient: undefined })}
                  className="w-5 h-5 rounded-md border-2 transition-transform hover:scale-110 cursor-pointer"
                  style={{
                    background: c.hex,
                    borderColor: field.colorKey === c.key ? "var(--ring)" : "var(--hairline)",
                  }}
                />
              ))}
            </div>
          )}
          <GradientEditor
            gradient={field.textGradient}
            disabled={locked.has("colorKey")}
            onChange={(textGradient) => onChange({ textGradient })}
          />
        </Section>
      )}

      {/* Member input — what the member sees in their form; gone on fixed elements */}
      {!isStatic && (
        <Section id="member-input" title="Member input">
          {isText && field.type !== "select" && (
            <div>
              <label className={labelClass} style={labelStyle}>Max characters</label>
              <input
                type="number"
                className={controlClass}
                style={controlStyle}
                disabled={locked.has("maxLength")}
                value={field.maxLength ?? ""}
                placeholder="none"
                onChange={(e) => onChange({ maxLength: e.target.value ? Number(e.target.value) : undefined })}
              />
            </div>
          )}
          {field.type === "select" && (
            <div>
              <label className={labelClass} style={labelStyle}>Options (one per line)</label>
              <textarea
                rows={3}
                className={controlClass}
                style={controlStyle}
                value={(field.options ?? []).join("\n")}
                onChange={(e) =>
                  onChange({ options: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })
                }
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} style={labelStyle}>Placeholder</label>
              <input
                className={controlClass}
                style={controlStyle}
                value={field.placeholder ?? ""}
                onChange={(e) => onChange({ placeholder: e.target.value || undefined })}
              />
            </div>
            <label className="flex items-end gap-2 pb-2 text-sm" style={{ color: "var(--foreground)" }}>
              <input
                type="checkbox"
                checked={field.required ?? false}
                onChange={(e) => onChange({ required: e.target.checked || undefined })}
              />
              Required
            </label>
          </div>
        </Section>
      )}
    </div>
  );
}

function FontSelect({
  field,
  kit,
  customFamilies,
  locked,
  onChange,
}: {
  field: TemplateField;
  kit: BrandKit | null;
  customFamilies: string[];
  locked: Set<string>;
  onChange(patch: Partial<TemplateField>): void;
}) {
  const brandFamilies = [
    ...new Set(
      [kit?.headingFont?.family, kit?.bodyFont?.family, ...customFamilies].filter(
        (f): f is string => Boolean(f),
      ),
    ),
  ];
  const otherFamilies = GOOGLE_FONTS.filter((f) => !brandFamilies.includes(f));
  return (
    <select
      className={controlClass}
      style={controlStyle}
      disabled={locked.has("fontFamily")}
      value={field.fontFamily ?? ""}
      onChange={(e) => onChange({ fontFamily: e.target.value || undefined })}
    >
      <option value="">Default (sans-serif)</option>
      {brandFamilies.length > 0 && (
        <optgroup label="Brand fonts">
          {brandFamilies.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </optgroup>
      )}
      <optgroup label="Google Fonts">
        {otherFamilies.map((f) => (
          <option key={f} value={f}>{f}</option>
        ))}
      </optgroup>
    </select>
  );
}

interface CornerRadiusControlProps {
  value: CornerRadius | undefined;
  onChange(value: CornerRadius | undefined): void;
}

const CORNERS: Array<{ key: keyof CornerRadius; label: string }> = [
  { key: "tl", label: "TL" },
  { key: "tr", label: "TR" },
  { key: "br", label: "BR" },
  { key: "bl", label: "BL" },
];

/** Figma-style corner radius for image fields: one linked value for all four
 * corners, or unlink to set TL/TR/BR/BL independently. Renders identically
 * in the editor preview, the member page, and the exported PNG. */
function CornerRadiusControl({ value, onChange }: CornerRadiusControlProps) {
  const uniform = !value || (value.tl === value.tr && value.tr === value.br && value.br === value.bl);
  const [linked, setLinked] = useState(uniform);

  const set = (patch: Partial<CornerRadius>) => {
    const next = { tl: 0, tr: 0, br: 0, bl: 0, ...value, ...patch };
    const empty = !next.tl && !next.tr && !next.br && !next.bl;
    onChange(empty ? undefined : next);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className={labelClass} style={{ marginBottom: 0 }}>Corner radius (px)</label>
        <button
          onClick={() => {
            if (!linked) {
              // Re-linking collapses to the top-left value.
              const r = value?.tl ?? 0;
              set({ tl: r, tr: r, br: r, bl: r });
            }
            setLinked(!linked);
          }}
          title={linked ? "Unlink corners — set each independently" : "Link corners — one value for all four"}
        >
          {linked ? (
            <LinkIcon className="w-3.5 h-3.5" style={{ color: "var(--solar)" }} />
          ) : (
            <Unlink className="w-3.5 h-3.5" style={{ color: "var(--fg-3)" }} />
          )}
        </button>
      </div>
      {linked ? (
        <input
          type="number"
          min={0}
          className={controlClass}
          value={value?.tl ?? 0}
          onChange={(e) => {
            const r = Math.max(0, Number(e.target.value) || 0);
            set({ tl: r, tr: r, br: r, bl: r });
          }}
        />
      ) : (
        <div className="grid grid-cols-4 gap-1.5">
          {CORNERS.map((c) => (
            <div key={c.key}>
              <input
                type="number"
                min={0}
                className={controlClass}
                style={{ padding: "6px 6px", fontSize: 12 }}
                value={value?.[c.key] ?? 0}
                title={c.label}
                onChange={(e) => set({ [c.key]: Math.max(0, Number(e.target.value) || 0) })}
              />
              <p className="text-center" style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-4)" }}>
                {c.label}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
