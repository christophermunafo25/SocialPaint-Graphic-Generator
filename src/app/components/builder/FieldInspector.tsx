import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Check,
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
import { GOOGLE_FONTS, loadGoogleFonts } from "@/lib/render/fonts";
import {
  customFamilyStyles,
  familyStyles,
  nearestStyle,
  styleGroups,
  styleKey,
  styleName,
  toFontStyle,
  type FontStyle,
} from "@/lib/render/fontCatalog";
import { suggestFieldKey } from "@/lib/caption";
import { useFileDrop } from "@/lib/useFileDrop";
import { getTypeStyle, isStyleLocked, lockedProperties, resolveFieldStyle, ruleSentences } from "@/lib/brand/resolveStyle";
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
    <div className="pt-3" style={{ borderTop: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between" style={{ paddingBottom: open ? 10 : 2 }}>
        <button
          onClick={() => {
            setOpen(!open);
            writeOpen(id, !open);
          }}
          aria-expanded={open}
          className="flex-1 flex items-center justify-between text-left"
        >
          <span style={{ fontSize: "var(--type-label-size)", fontWeight: 500, color: "var(--text-primary)" }}>{title}</span>
          <ChevronDown
            style={{
              width: 13,
              height: 13,
              color: "var(--text-muted)",
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
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-disabled)", flexShrink: 0 }}>
        {prefix}
      </span>
      <input
        type="number"
        step={step}
        disabled={disabled}
        className="w-full bg-transparent outline-none border-none"
        style={{ fontSize: "var(--type-label-size)", color: "var(--text-primary)", padding: 0 }}
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
          className="flex items-center justify-center " data-radius-control
          style={{
            width: 30,
            height: 26,
            border: "1px solid",
            borderColor: value === key ? "var(--state-primary)" : "transparent",
            background: value === key ? "var(--accent-wash)" : "transparent",
            color: value === key ? "var(--state-primary)" : "var(--text-secondary)",
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

  // --- Typography helpers --------------------------------------------------

  // The picker shows the RESOLVED face, so a field bound to a type style
  // displays what it actually renders with rather than its own overridden
  // values sitting underneath.
  const resolved = resolveFieldStyle(field, kit);
  const displayFamily = resolved.fontFamily;
  const currentStyle = toFontStyle(resolved.fontWeight, resolved.fontStyle, resolved.fontStretch);
  const fontAssets = useMemo(() => assets.filter((a) => a.kind === "font"), [assets]);

  const familyGroups = useMemo(() => {
    const brand = [
      ...new Set([kit?.headingFont?.family, kit?.bodyFont?.family].filter((f): f is string => Boolean(f))),
    ];
    const uploaded = [...customFamilyStyles(fontAssets).keys()].filter((f) => !brand.includes(f));
    const google = GOOGLE_FONTS.filter((f) => !brand.includes(f) && !uploaded.includes(f));
    return [
      { label: "Brand fonts", families: brand },
      { label: "Uploaded fonts", families: uploaded },
      { label: "Google Fonts", families: google },
    ].filter((g) => g.families.length > 0);
  }, [kit, fontAssets]);

  const fontCatalog = displayFamily ? familyStyles(displayFamily, fontAssets, currentStyle) : null;
  const styleLocked = isStyleLocked(locked);

  /** A style that fixes the weight but not the family narrows the style list
   * to that weight in whatever family is chosen, rather than hiding it. */
  const styleOptions = useMemo(() => {
    if (!fontCatalog) return [];
    const lockedWeight = locked.has("weight") ? boundStyle?.weight : undefined;
    if (lockedWeight === undefined) return fontCatalog.styles;
    const atWeight = nearestStyle({ ...currentStyle, weight: lockedWeight }, fontCatalog.styles);
    return atWeight ? fontCatalog.styles.filter((s) => s.weight === atWeight.weight) : fontCatalog.styles;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontCatalog?.family, fontCatalog?.styles, locked, boundStyle?.weight, styleKey(currentStyle)]);

  /** Never show a style the chosen family does not have. */
  const displayStyle =
    (styleOptions.length > 0 ? nearestStyle(currentStyle, styleOptions) : undefined) ?? currentStyle;

  /** Weight stays absent when it was absent and the face is plain Regular, so
   * choosing a family does not quietly add values to a legacy field. */
  const stylePatch = (s: FontStyle, explicit: boolean): Partial<TemplateField> => ({
    fontWeight: !explicit && field.fontWeight === undefined && s.weight === 400 ? undefined : s.weight,
    fontStyle: s.italic ? "italic" : undefined,
    fontStretch: s.stretch === "normal" ? undefined : s.stretch,
  });

  const changeFamily = (family: string | undefined) => {
    if (!family) {
      onChange({ fontFamily: undefined });
      return;
    }
    // Map onto the nearest style the NEW family has rather than resetting to
    // Regular — same weight where it exists, closest weight where it doesn't,
    // italic and width preserved only where the family offers them.
    const mapped = nearestStyle(currentStyle, familyStyles(family, fontAssets, currentStyle).styles);
    onChange({ fontFamily: family, ...(mapped ? stylePatch(mapped, false) : {}) });
  };

  const changeStyle = (s: FontStyle) => onChange(stylePatch(s, true));

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
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: "var(--space-3xs)" }}>
              Shapes are design-only — members never see them as fields.
            </p>
          </div>
        )}

        {field.type !== "select" && !isShape && (
          <label
            className="flex items-start gap-2 cursor-pointer"
            style={{ fontSize: "var(--type-label-size)", color: "var(--text-primary)" }}
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
              <Pin style={{ width: 11, height: 11, display: "inline", marginRight: "var(--space-3xs)", verticalAlign: "-1px", color: "var(--state-primary)" }} />
              Fixed element
              <span style={{ display: "block", fontSize: 11, color: "var(--text-muted)" }}>
                Stays exactly as designed — members don't see or edit it. You can still move and style it.
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
                border: "1.5px dashed var(--border-strong)",
                borderRadius: "var(--radius-control)",
                fontSize: "var(--type-caption-size)",
                color: "var(--text-secondary)",
              }}
            >
              {uploadingStatic ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" style={{ color: "var(--state-primary)" }} />
              ) : (
                <Upload className="sp-dropzone__icon w-3.5 h-3.5" style={{ color: "var(--state-primary)" }} />
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
                className="flex items-center justify-center " data-radius-control
                style={{ width: 30, height: 26, color: "var(--text-secondary)", border: "1px solid var(--border)" }}
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
          <p style={{ fontSize: 10.5, color: "var(--text-disabled)", marginBottom: 6 }}>
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
              className="grid grid-cols-3 overflow-hidden" data-radius-control
              style={{ border: "1px solid var(--border-strong)" }}
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
                    fontSize: "var(--type-caption-size)",
                    background: resizeMode === key ? "var(--accent-wash)" : "transparent",
                    color: resizeMode === key ? "var(--state-primary)" : "var(--text-secondary)",
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
                  <Lock style={{ width: 12, height: 12, color: "var(--state-primary)" }} />
                ) : (
                  <Unlock style={{ width: 12, height: 12, color: "var(--text-disabled)" }} />
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
                className="mt-2 px-3 py-2 space-y-0.5" data-radius-control
                style={{ background: "var(--accent-wash)", border: "1px solid var(--accent-border)" }}
              >
                {ruleSentences(boundStyle, kit).map((r) => (
                  <p key={r} style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                    <Lock style={{ width: 10, height: 10, display: "inline", marginRight: 5, verticalAlign: "-1px", color: "var(--state-primary)" }} />
                    {r}
                  </p>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className={labelClass} style={labelStyle}>Font</label>
            <FontFamilySelect
              value={displayFamily}
              groups={familyGroups}
              disabled={locked.has("fontFamily")}
              onSelect={changeFamily}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <FontStyleSelect
              family={displayFamily}
              styles={styleOptions}
              value={displayStyle}
              disabled={!displayFamily || styleLocked}
              locked={styleLocked}
              onSelect={changeStyle}
            />
            <InlineNum
              prefix="px"
              value={field.fontSizePx ?? 45}
              disabled={locked.has("fontSizePx")}
              onCommit={(v) => onChange({ fontSizePx: v ?? 45 })}
            />
          </div>
          {fontCatalog && !fontCatalog.verified && (
            <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
              We don't have {displayFamily} on file, so these styles are a guess — upload the
              font in Brand Studio to pick from what it really has.
            </p>
          )}
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
          {/* Swatches bind by palette KEY, not hex — a field picked from the
              brand row re-themes with the kit. */}
          <ColorControl
            ariaLabel="Field text color"
            value={field.colorHex ?? kit?.colors.find((c) => c.key === field.colorKey)?.hex}
            onChange={(hex) =>
              !locked.has("colorKey") &&
              onChange({ colorHex: hex, colorKey: undefined, textGradient: undefined })
            }
            onPickBrandColor={(c) =>
              onChange({ colorKey: c.key, colorHex: undefined, textGradient: undefined })
            }
            selectedColorKey={field.colorKey}
            swatchesDisabled={locked.has("colorKey")}
          />
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

// ---------------------------------------------------------------------------
// Two-step font picker — Figma's model: choose a family, then choose from the
// styles that family ACTUALLY has. The old control paired a family <select>
// with an unconditional 100–900 weight ladder, so picking 700 on a family
// that ships only 400 rendered a synthesized face and exported the wrong one.
// ---------------------------------------------------------------------------

/** Close on outside pointerdown or Escape, and hand focus back to the trigger
 * so Escape leaves the keyboard exactly where it started. */
function useDismiss(
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
 * absolutely positioned inside the inspector, which scrolls and would clip it.
 * Elevation is surface + border, never shadow. */
function MenuSurface({
  triggerRef,
  surfaceRef,
  children,
  role,
  id,
  onKeyDown,
  autoFocus,
}: {
  triggerRef: React.RefObject<HTMLElement | null>;
  surfaceRef: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
  role?: string;
  id?: string;
  onKeyDown?(e: React.KeyboardEvent): void;
  autoFocus?: boolean;
}) {
  // autoFocus is not honoured on a div — focus it explicitly, or the style
  // menu's arrow/Enter/Escape handling never receives a key.
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

/** One row in either menu. The label renders in its OWN face — no waiting on
 * the font: it paints in the fallback and upgrades in place when the file
 * lands, which is what keeps the menu from stalling on open. */
function MenuRow({
  label,
  fullName,
  selected,
  active,
  previewStyle,
  onSelect,
  onHover,
  id,
}: {
  label: string;
  /** The unabbreviated name, when the visible label leans on a group header
   * for context — screen readers get "Bold Expanded", not a bare "Bold". */
  fullName?: string;
  selected: boolean;
  active: boolean;
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
        color: "var(--text-primary)",
        transition: "background var(--dur-state) var(--ease)",
      }}
    >
      <span className="truncate" style={{ fontSize: 13, ...previewStyle }}>
        {label}
      </span>
      {selected && (
        <Check style={{ width: 12, height: 12, flexShrink: 0, color: "var(--state-primary)" }} />
      )}
    </div>
  );
}

const groupLabelStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 9.5,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--text-disabled)",
  padding: "6px 10px 3px",
};

/** The trigger both controls share — looks exactly like the .sp-input select
 * it replaces, so nothing else in the inspector shifts. */
const TriggerButton = React.forwardRef<
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
    onOpen(): void;
    onKeyDown?(e: React.KeyboardEvent): void;
  }
>(function TriggerButton(
  { value, placeholder, disabled, lockedHint, previewStyle, ariaLabel, expanded, controls, onOpen, onKeyDown },
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
      className={`${controlClass} flex items-center justify-between gap-2 text-left`}
      style={{ opacity: disabled ? 0.5 : 1, cursor: disabled ? "default" : "pointer" }}
    >
      <span className="truncate" style={value ? previewStyle : { color: "var(--text-disabled)" }}>
        {value || placeholder}
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
const step = (index: number, delta: number, length: number): number =>
  length === 0 ? -1 : (index + delta + length) % length;

/** Keep the arrow-key cursor visible in a scrolling menu. */
function useScrollActiveIntoView(
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

interface FamilyOption {
  family: string; // "" = default sans-serif
  label: string;
  group: string;
}

/** Control 1 — family. Searchable: brand fonts, then uploaded families, then
 * Google families, each group divided as in Figma's menu. */
function FontFamilySelect({
  value,
  groups,
  disabled,
  onSelect,
}: {
  value: string | undefined;
  groups: Array<{ label: string; families: string[] }>;
  disabled: boolean;
  onSelect(family: string | undefined): void;
}) {
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

  const options: FamilyOption[] = useMemo(() => {
    const all: FamilyOption[] = [{ family: "", label: "Default (sans-serif)", group: "" }];
    for (const g of groups) {
      for (const family of g.families) all.push({ family, label: family, group: g.label });
    }
    const q = query.trim().toLowerCase();
    return q ? all.filter((o) => o.label.toLowerCase().includes(q)) : all;
  }, [groups, query]);

  // Preview each visible family in its own face. One face per family, and
  // only for what is on the list right now, so typing narrows the work.
  useEffect(() => {
    if (!open) return;
    const usage = new Map(
      options
        .filter((o) => o.family)
        .map((o) => {
          const known = familyStyles(o.family);
          const regular = nearestStyle(toFontStyle(400), known.styles);
          return [o.family, regular ? [regular] : []] as const;
        })
        .filter(([, styles]) => styles.length > 0),
    );
    if (usage.size > 0) loadGoogleFonts(usage);
  }, [open, options]);

  useEffect(() => {
    if (!open) return;
    setActive(Math.max(0, options.findIndex((o) => o.family === (value ?? ""))));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = (index: number) => {
    const option = options[index];
    if (!option) return;
    onSelect(option.family || undefined);
    close();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    // Keys handled here stay here. The builder listens on window for Escape
    // (clear selection) and Delete (remove field); without this, dismissing
    // the menu also deselected the field the inspector was editing.
    if (["Escape", "ArrowDown", "ArrowUp", "Enter"].includes(e.key)) e.stopPropagation();
    if (e.key === "Escape") {
      e.preventDefault();
      close(); // closes and restores — no value change
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => step(i, 1, options.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => step(i, -1, options.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      commit(active);
    }
  };

  let lastGroup = "";
  return (
    <>
      <TriggerButton
        ref={triggerRef}
        ariaLabel="Font family"
        value={value ?? ""}
        placeholder="Default (sans-serif)"
        previewStyle={value ? { fontFamily: `"${value}", sans-serif` } : undefined}
        disabled={disabled}
        lockedHint={disabled}
        expanded={open}
        controls="sp-family-menu"
        onOpen={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      />
      {open && (
        <MenuSurface triggerRef={triggerRef} surfaceRef={surfaceRef} id="sp-family-menu">
          <div style={{ padding: "2px 6px 6px" }}>
            <input
              autoFocus
              className={controlClass}
              style={{ padding: "6px 9px", fontSize: 12.5 }}
              placeholder="Search fonts"
              value={query}
              aria-label="Search fonts"
              aria-controls="sp-family-list"
              aria-activedescendant={options[active] ? `sp-family-opt-${active}` : undefined}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
            />
          </div>
          <div role="listbox" id="sp-family-list" aria-label="Font family">
            {options.length === 0 && (
              <p style={{ fontSize: 12, color: "var(--text-muted)", padding: "6px 10px 8px" }}>
                No fonts match “{query}”.
              </p>
            )}
            {options.map((o, i) => {
              const newGroup = o.group !== lastGroup;
              const previousGroup = lastGroup;
              lastGroup = o.group;
              return (
                <React.Fragment key={o.family || "__default"}>
                  {newGroup && o.group && (
                    <div
                      style={{
                        ...groupLabelStyle,
                        borderTop: previousGroup === "" && i === 0 ? undefined : "1px solid var(--border)",
                        marginTop: 4,
                      }}
                    >
                      {o.group}
                    </div>
                  )}
                  <MenuRow
                    id={`sp-family-opt-${i}`}
                    label={o.label}
                    selected={o.family === (value ?? "")}
                    active={i === active}
                    previewStyle={o.family ? { fontFamily: `"${o.family}", sans-serif` } : undefined}
                    onSelect={() => commit(i)}
                    onHover={() => setActive(i)}
                  />
                </React.Fragment>
              );
            })}
          </div>
        </MenuSurface>
      )}
    </>
  );
}

/** Control 2 — style. Lists only the styles the chosen family has, by name,
 * with width groups divided as Figma does. Disabled until a family is chosen. */
function FontStyleSelect({
  family,
  styles,
  value,
  disabled,
  locked,
  onSelect,
}: {
  family: string | undefined;
  styles: FontStyle[];
  value: FontStyle;
  disabled: boolean;
  locked: boolean;
  onSelect(style: FontStyle): void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);
  useDismiss(open, [triggerRef, surfaceRef], () => setOpen(false));
  useScrollActiveIntoView(open, active, surfaceRef);

  const ordered = useMemo(() => styleGroups(styles), [styles]);
  const flat = useMemo(() => ordered.flatMap((g) => g.styles), [ordered]);

  useEffect(() => {
    if (!open) return;
    setActive(Math.max(0, flat.findIndex((s) => styleKey(s) === styleKey(value))));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = (index: number) => {
    const style = flat[index];
    if (!style) return;
    onSelect(style);
    close();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (["Escape", "ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) e.stopPropagation();
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => step(i, 1, flat.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => step(i, -1, flat.length));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      commit(active);
    }
  };

  const faceOf = (style: FontStyle): React.CSSProperties => ({
    fontFamily: family ? `"${family}", sans-serif` : undefined,
    fontWeight: style.weight,
    fontStyle: style.italic ? "italic" : undefined,
    fontStretch: style.stretch === "normal" ? undefined : style.stretch,
  });

  let index = -1;
  return (
    <>
      <TriggerButton
        ref={triggerRef}
        ariaLabel="Font style"
        value={family ? styleName(value) : ""}
        placeholder={family ? "Style" : "Choose a font first"}
        previewStyle={faceOf(value)}
        disabled={disabled}
        lockedHint={locked}
        expanded={open}
        controls="sp-style-menu"
        onOpen={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      />
      {open && (
        <MenuSurface
          triggerRef={triggerRef}
          surfaceRef={surfaceRef}
          id="sp-style-menu"
          role="listbox"
          autoFocus
          onKeyDown={onKeyDown}
        >
          {ordered.map((group, gi) => (
            <React.Fragment key={group.stretch}>
              {group.label && (
                <div
                  style={{
                    ...groupLabelStyle,
                    borderTop: gi === 0 ? undefined : "1px solid var(--border)",
                    marginTop: gi === 0 ? 0 : 4,
                  }}
                >
                  {group.label}
                </div>
              )}
              {group.styles.map((style) => {
                index += 1;
                const i = index;
                return (
                  <MenuRow
                    key={styleKey(style)}
                    // Inside a width group the header already says the width,
                    // so the row carries only the weight — as Figma does.
                    // Ungrouped families keep the full name.
                    label={group.label ? styleName({ ...style, stretch: "normal" }) : styleName(style)}
                    fullName={styleName(style)}
                    selected={styleKey(style) === styleKey(value)}
                    active={i === active}
                    previewStyle={faceOf(style)}
                    onSelect={() => commit(i)}
                    onHover={() => setActive(i)}
                  />
                );
              })}
            </React.Fragment>
          ))}
        </MenuSurface>
      )}
    </>
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
            <LinkIcon className="w-3.5 h-3.5" style={{ color: "var(--state-primary)" }} />
          ) : (
            <Unlink className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
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
                style={{ padding: "6px 6px", fontSize: "var(--type-caption-size)" }}
                value={value?.[c.key] ?? 0}
                title={c.label}
                onChange={(e) => set({ [c.key]: Math.max(0, Number(e.target.value) || 0) })}
              />
              <p className="text-center" style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-disabled)" }}>
                {c.label}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
