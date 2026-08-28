import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlignCenter,
  Blend,
  CaseUpper,
  SquareRoundCorner,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  Check,
  ChevronDown,
  FlipHorizontal2,
  FlipVertical2,
  Link as LinkIcon,
  Lock,
  Minus,
  Plus,
  RefreshCw,
  RotateCw,
  Trash2,
  Unlink,
  Upload,
} from "lucide-react";
import type { CornerRadius, FieldType, TemplateField } from "@/lib/types";
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
import {
  getTypeStyle,
  isStyleLocked,
  lockedProperties,
  resolveFieldStyle,
  ruleSentences,
} from "@/lib/brand/resolveStyle";
import { DEFAULT_FILL_HEX, gradientCss } from "../SchemaRenderer";
import { Switch } from "../Switch";
import {
  InspectorSection,
  NumericField,
  PropertyRow,
  SegmentedIconGroup,
  compactControlStyle,
} from "./InspectorControls";
import { AlignControls } from "./AlignControls";
import { FillPicker, getFill } from "./FillPicker";
import { parseHex, toHex } from "@/lib/color";

interface FieldInspectorProps {
  field: TemplateField;
  allFields: TemplateField[];
  /** Canvas size — the alignment buttons align against these bounds. */
  canvasWidth: number;
  canvasHeight: number;
  /** The auto-layout group DIRECTLY containing this field, when grouped —
   * position (and, for text, main-axis size) become computed, not authored. */
  containingGroup?: import("@/lib/types").LayoutGroup;
  /** This field's rect from the layout pass (shown when values are computed). */
  computedRect?: import("@/lib/render/layout").Rect;
  /** This field's font size from the layout pass — under Shrink it can sit
   * below the set size, and the inspector says so. */
  computedFontSize?: number;
  /** Worst-case preview: while on, the builder canvas fills THIS field with
   * its longest possible entry so the admin sees the mode's consequence. */
  worstCasePreview?: boolean;
  onWorstCasePreview?(on: boolean): void;
  /** `stream` marks a per-keystroke source (text inputs): successive
   * commits coalesce into one undo entry. Discrete commits (numeric fields,
   * toggles) omit it and land one undo entry each. */
  onChange(patch: Partial<TemplateField>, stream?: boolean): void;
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

type TextSizingMode = "free" | "shrink" | "fill";

/** Inspector for the selected field: a flat, hairline-divided stack of
 * collapsible sections — Field, Position, Layout, Appearance, Typography,
 * Fill — built on the InspectorSection / PropertyRow / NumericField
 * primitives. */
/** Wrap an angle into Figma's −180..180 display range. */
const wrapDeg = (n: number): number => ((((n + 180) % 360) + 360) % 360) - 180;

export function FieldInspector(props: FieldInspectorProps) {
  const {
    field,
    allFields,
    canvasWidth,
    canvasHeight,
    containingGroup,
    computedRect,
    computedFontSize,
    worstCasePreview,
    onWorstCasePreview,
    onChange,
    onDelete,
    focusLabelFieldId,
  } = props;
  const { company } = useAuth();
  const { kit, assets } = useBrand();
  const isText = field.type === "text" || field.type === "multiline" || field.type === "select";
  const isShape = field.type === "shape";
  const isStatic = Boolean(field.static);
  /** Children of an auto-layout STACK are placed by it: position is
   * computed, and a text child's main-axis size hugs its content. The
   * inspector says so instead of offering editors that would be silently
   * overridden. Children of a plain group keep their own geometry and get
   * the full editors. */
  const inStack = Boolean(containingGroup) && containingGroup?.mode !== "free";
  const groupVertical = containingGroup?.direction !== "horizontal";
  const mainSizeComputed = inStack && isText;
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

  // Secondary, not muted — teaching copy in the panel clears 4.5:1.
  const hintStyle: React.CSSProperties = {
    fontSize: "var(--type-caption-size)",
    color: "var(--text-secondary)",
  };

  const centered = field.anchor === "center";

  /** Align the box against the canvas bounds (anchor-aware). */
  const alignBoxH = (pos: "start" | "center" | "end") => {
    const left =
      pos === "start"
        ? 0
        : pos === "center"
          ? (canvasWidth - field.width) / 2
          : canvasWidth - field.width;
    onChange({ x: Math.round(centered ? left + field.width / 2 : left) });
  };
  const alignBoxV = (pos: "start" | "center" | "end") => {
    const top =
      pos === "start"
        ? 0
        : pos === "center"
          ? (canvasHeight - field.height) / 2
          : canvasHeight - field.height;
    onChange({ y: Math.round(centered ? top + field.height / 2 : top) });
  };

  const canSetSizing = field.type === "text" || field.type === "multiline";
  const setSizingMode = (mode: TextSizingMode) => {
    onChange({ textSizing: mode === "free" ? undefined : mode });
  };

  /** Constrain-proportions for the W/H pair — a panel behavior (linked
   * editing), not a persisted field property. */
  const [constrain, setConstrain] = useState(false);
  const commitW = (v: number | undefined) => {
    const width = Math.max(1, v ?? field.width);
    if (constrain && field.width > 0) {
      onChange({ width, height: Math.max(1, Math.round(width * (field.height / field.width))) });
    } else {
      onChange({ width });
    }
  };
  const commitH = (v: number | undefined) => {
    const height = Math.max(1, v ?? field.height);
    if (constrain && field.height > 0) {
      onChange({ height, width: Math.max(1, Math.round(height * (field.width / field.height))) });
    } else {
      onChange({ height });
    }
  };

  // --- Typography ----------------------------------------------------------
  // Same resolved-face logic the previous inspector used: the pickers show
  // what a field ACTUALLY renders with (type-style bindings included), and
  // the style list only ever offers faces the chosen family really has.

  const boundStyle = getTypeStyle(kit, field.typeStyleKey);
  const locked = lockedProperties(boundStyle);
  const resolved = resolveFieldStyle(field, kit);
  /** The sizing mode the field actually renders with — a bound type style
   * can lock it, exactly like any other locked property. */
  const sizingMode: TextSizingMode = resolved.textSizing ?? "free";
  const sizingLocked = locked.has("textSizing");
  const displayFamily = resolved.fontFamily;
  const currentStyle = toFontStyle(resolved.fontWeight, resolved.fontStyle, resolved.fontStretch);
  const fontAssets = useMemo(() => assets.filter((a) => a.kind === "font"), [assets]);

  const familyGroups = useMemo(() => {
    const brand = [
      ...new Set(
        [kit?.headingFont?.family, kit?.bodyFont?.family].filter((f): f is string => Boolean(f)),
      ),
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

  const currentStyleKey = styleKey(currentStyle);
  const styleOptions = useMemo(() => {
    if (!fontCatalog) return [];
    const lockedWeight = locked.has("weight") ? boundStyle?.weight : undefined;
    if (lockedWeight === undefined) return fontCatalog.styles;
    const atWeight = nearestStyle({ ...currentStyle, weight: lockedWeight }, fontCatalog.styles);
    return atWeight
      ? fontCatalog.styles.filter((s) => s.weight === atWeight.weight)
      : fontCatalog.styles;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontCatalog?.family, fontCatalog?.styles, locked, boundStyle?.weight, currentStyleKey]);

  const displayStyle =
    (styleOptions.length > 0 ? nearestStyle(currentStyle, styleOptions) : undefined) ??
    currentStyle;

  const stylePatch = (s: FontStyle, explicit: boolean): Partial<TemplateField> => ({
    fontWeight:
      !explicit && field.fontWeight === undefined && s.weight === 400 ? undefined : s.weight,
    fontStyle: s.italic ? "italic" : undefined,
    fontStretch: s.stretch === "normal" ? undefined : s.stretch,
  });

  const changeFamily = (family: string | undefined) => {
    if (!family) {
      onChange({ fontFamily: undefined });
      return;
    }
    const mapped = nearestStyle(
      currentStyle,
      familyStyles(family, fontAssets, currentStyle).styles,
    );
    onChange({ fontFamily: family, ...(mapped ? stylePatch(mapped, false) : {}) });
  };

  const changeStyle = (s: FontStyle) => onChange(stylePatch(s, true));

  // --- Fill -----------------------------------------------------------------

  const hasFill = isText || isShape;
  const fill = getFill(field);
  const fillLocked = locked.has("colorKey");
  const [pickerOpen, setPickerOpen] = useState(false);
  const fillSwatchRef = useRef<HTMLButtonElement>(null);
  useEffect(() => setPickerOpen(false), [field.id]);

  /** Alpha byte of a solid fill's hex (100 when opaque). */
  const fillAlpha = fill?.type === "solid" ? Math.round((parseHex(fill.hex)?.a ?? 1) * 100) : 100;

  // --- Appearance ----------------------------------------------------------

  const hasRadius = field.type === "image" || (isShape && (field.shape ?? "rect") === "rect");
  const r = field.cornerRadius;
  const radiusUniform = !r || (r.tl === r.tr && r.tr === r.br && r.br === r.bl);
  const [radiusLinked, setRadiusLinked] = useState(radiusUniform);
  // Re-derive the link state when the selection moves to another field —
  // the inspector itself never remounts.
  useEffect(() => {
    setRadiusLinked(!field.cornerRadius || radiusUniform);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field.id]);

  const setRadius = (patch: Partial<CornerRadius>) => {
    const next = { tl: 0, tr: 0, br: 0, bl: 0, ...field.cornerRadius, ...patch };
    const empty = !next.tl && !next.tr && !next.br && !next.bl;
    onChange({ cornerRadius: empty ? undefined : next });
  };

  /** Switching the anchor converts X/Y so the box stays exactly where it is. */
  const changeAnchor = (anchor: "topLeft" | "center") => {
    const was = field.anchor === "center" ? "center" : "topLeft";
    if (anchor === was) return;
    if (anchor === "center") {
      onChange({
        anchor: "center",
        x: Math.round(field.x + field.width / 2),
        y: Math.round(field.y + field.height / 2),
      });
    } else {
      onChange({
        anchor: "topLeft",
        x: Math.round(field.x - field.width / 2),
        y: Math.round(field.y - field.height / 2),
      });
    }
  };

  return (
    <div>
      <div
        className="flex items-center justify-between"
        style={{ paddingBottom: "var(--space-xs)" }}
      >
        <h3 className="sp-panel-title">Field settings</h3>
        <button onClick={onDelete} title="Delete field">
          <Trash2 className="w-4 h-4" style={{ color: "var(--destructive)" }} />
        </button>
      </div>

      <InspectorSection id="field" title="Field">
        {/* The field type control that exists today, left in place — same
            options, same static/shape conversion patches. */}
        <PropertyRow label="Type">
          <select
            className="sp-input"
            style={compactControlStyle}
            aria-label="Field type"
            value={field.type}
            onChange={(e) => {
              const t = e.target.value as FieldType;
              if (t === "shape") {
                // Shapes are always static design elements with a fill.
                onChange({
                  type: t,
                  shape: field.shape ?? "rect",
                  static: true,
                  colorHex: field.colorHex ?? "#d9d9d9",
                });
              } else if (isShape) {
                onChange({ type: t, shape: undefined, static: undefined, staticValue: undefined });
              } else {
                onChange({ type: t });
              }
            }}
          >
            {FIELD_TYPES.filter((t) => !isStatic || isShape || t.value !== "select").map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </PropertyRow>

        {isShape && (
          <>
            <PropertyRow label="Shape">
              <select
                className="sp-input"
                style={compactControlStyle}
                aria-label="Shape kind"
                value={field.shape ?? "rect"}
                onChange={(e) => onChange({ shape: e.target.value as TemplateField["shape"] })}
              >
                {SHAPE_KINDS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </PropertyRow>
            <p style={hintStyle}>Shapes are design-only — members never see them as fields.</p>
          </>
        )}

        {/* Field name: shares its default with the member-form placeholder
            (shown as the input's placeholder when the name is empty) but
            writes only label + fieldKey — editing it never touches the
            placeholder. */}
        <PropertyRow label="Name">
          <div className="flex flex-col flex-1" style={{ gap: "var(--space-3xs)", minWidth: 0 }}>
            <input
              ref={labelRef}
              className="sp-input"
              style={compactControlStyle}
              aria-label="Field name"
              value={field.label}
              placeholder={field.placeholder || undefined}
              onChange={(e) => {
                const label = e.target.value;
                onChange(
                  {
                    label,
                    fieldKey: suggestFieldKey(
                      label,
                      allFields.filter((f) => f.id !== field.id),
                    ),
                  },
                  true,
                );
              }}
            />
            {!isStatic && (
              <p className="font-mono" style={{ fontSize: 10, color: "var(--text-secondary)" }}>
                caption tag: {"{"}
                {field.fieldKey}
                {"}"}
              </p>
            )}
          </div>
        </PropertyRow>

        {field.type !== "select" && !isShape && (
          <>
            <PropertyRow label="Fixed">
              <Switch
                checked={isStatic}
                ariaLabel="Fixed element"
                onChange={(next) =>
                  onChange(
                    next
                      ? {
                          static: true,
                          required: undefined,
                          placeholder: undefined,
                          maxLength: undefined,
                        }
                      : {
                          static: undefined,
                          // The designed content survives as the member-facing
                          // preview: images keep their artwork (the renderer
                          // falls back to it), text keeps its copy as the
                          // placeholder.
                          staticValue: field.type === "image" ? field.staticValue : undefined,
                          ...(field.type !== "image" && !field.placeholder && field.staticValue
                            ? { placeholder: field.staticValue.slice(0, 80) }
                            : {}),
                        },
                  )
                }
              />
            </PropertyRow>
            <p style={hintStyle}>
              Fixed elements stay exactly as designed — members don't see or edit them. You can
              still move and style them.
            </p>
          </>
        )}

        {isStatic && isText && (
          <PropertyRow label="Content" align="start">
            <textarea
              rows={field.type === "multiline" ? 3 : 1}
              className="sp-input"
              style={{
                fontSize: "var(--type-label-size)",
                padding: "var(--space-2xs)",
                resize: "vertical",
              }}
              aria-label="Fixed content"
              value={field.staticValue ?? ""}
              placeholder="The exact text shown on the graphic"
              onChange={(e) => onChange({ staticValue: e.target.value || undefined }, true)}
            />
          </PropertyRow>
        )}
        {isStatic && field.type === "image" && (
          <PropertyRow label="Image" align="start">
            <label
              {...staticDrop.bind}
              data-active={staticDrop.active}
              className="sp-dropzone flex flex-1 items-center justify-center gap-2 cursor-pointer"
              style={{
                border: "1.5px dashed var(--border-strong)",
                borderRadius: "var(--radius-control)",
                fontSize: "var(--type-caption-size)",
                color: "var(--text-secondary)",
                minHeight: "var(--row-h-compact)",
              }}
            >
              {uploadingStatic ? (
                <RefreshCw
                  className="w-3.5 h-3.5 animate-spin"
                  style={{ color: "var(--state-primary)" }}
                />
              ) : (
                <Upload
                  className="sp-dropzone__icon w-3.5 h-3.5"
                  style={{ color: "var(--state-primary)" }}
                />
              )}
              {uploadingStatic
                ? "Uploading…"
                : field.staticValue
                  ? "Replace image"
                  : "Upload image"}
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
          </PropertyRow>
        )}
      </InspectorSection>

      <InspectorSection id="position" title="Position">
        {inStack ? (
          // Stacked: the stack places this element. Show where it landed
          // rather than offering editors the layout pass would override.
          <PropertyRow label="Position">
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              X {Math.round(computedRect?.x ?? field.x)} · Y{" "}
              {Math.round(computedRect?.y ?? field.y)} — placed by "{containingGroup?.name}"
            </span>
          </PropertyRow>
        ) : (
          <>
            <PropertyRow label="Align">
              {/* The same control the multi-selection panel and the floating
                  toolbar use — only the reference frame differs. */}
              <AlignControls
                scope="canvas"
                onAlign={(axis, edge) => (axis === "h" ? alignBoxH(edge) : alignBoxV(edge))}
              />
            </PropertyRow>
            <PropertyRow label="Position">
              <NumericField
                label="X"
                ariaLabel="X position"
                precision={0}
                value={field.x}
                onCommit={(v) => onChange({ x: v ?? field.x })}
              />
              <NumericField
                label="Y"
                ariaLabel="Y position"
                precision={0}
                value={field.y}
                onCommit={(v) => onChange({ y: v ?? field.y })}
              />
            </PropertyRow>
          </>
        )}
        <PropertyRow label="Rotate">
          <NumericField
            icon={<RotateCw style={{ width: 12, height: 12 }} strokeWidth={1.5} />}
            suffix="°"
            ariaLabel="Rotation in degrees"
            precision={0}
            value={wrapDeg(field.rotation ?? 0)}
            onCommit={(v) => onChange({ rotation: wrapDeg(v ?? field.rotation ?? 0) || undefined })}
          />
          <SegmentedIconGroup
            ariaLabel="Flip"
            options={[
              {
                key: "flipX",
                Icon: FlipHorizontal2,
                title: "Flip horizontal",
                active: Boolean(field.flipX),
              },
              {
                key: "flipY",
                Icon: FlipVertical2,
                title: "Flip vertical",
                active: Boolean(field.flipY),
              },
            ]}
            onSelect={(k) =>
              k === "flipX"
                ? onChange({ flipX: field.flipX ? undefined : true })
                : onChange({ flipY: field.flipY ? undefined : true })
            }
          />
        </PropertyRow>
        {!inStack && (
          <PropertyRow label="Anchor">
            <select
              className="sp-input"
              style={compactControlStyle}
              aria-label="Anchor point"
              value={field.anchor ?? "topLeft"}
              onChange={(e) => changeAnchor(e.target.value as "topLeft" | "center")}
            >
              <option value="topLeft">Top-left (X/Y = box corner)</option>
              <option value="center">Center (X/Y = box center)</option>
            </select>
          </PropertyRow>
        )}
      </InspectorSection>

      <InspectorSection id="layout" title="Layout">
        {canSetSizing && (
          <>
            {/* Stacked: three worded options need more width than the label
                column leaves, and squeezing them wraps every one onto a
                second line. */}
            <PropertyRow label="Text sizing" stack>
              <SegmentedIconGroup
                stretch
                ariaLabel="Text sizing behavior"
                value={sizingMode}
                disabled={sizingLocked}
                options={[
                  {
                    key: "free",
                    label: "Box grows",
                    title: "The text stays at its set size; the box gets taller as more is entered",
                  },
                  {
                    key: "shrink",
                    label: "Text shrinks",
                    title:
                      "The box stays exactly as drawn; the text gets smaller until it fits — it never grows past its set size",
                  },
                  {
                    key: "fill",
                    label: "Fill box",
                    title:
                      "The box stays exactly as drawn; the text is sized to fill it, growing as well as shrinking",
                  },
                ]}
                onSelect={setSizingMode}
              />
            </PropertyRow>
            {sizingLocked && boundStyle && (
              <p style={hintStyle}>Set by the “{boundStyle.name}” style.</p>
            )}
            {!isStatic && onWorstCasePreview && (
              <PropertyRow label="Preview">
                <button
                  type="button"
                  aria-pressed={worstCasePreview}
                  onClick={() => onWorstCasePreview(!worstCasePreview)}
                  className="sp-input"
                  style={{
                    fontSize: "var(--type-caption-size)",
                    color: worstCasePreview ? "var(--state-primary)" : "var(--text-secondary)",
                    cursor: "pointer",
                  }}
                  title={
                    field.maxLength
                      ? `Fill the canvas preview with a ${field.maxLength}-character entry`
                      : "Fill the canvas preview with a long entry (set Max chars to bound it)"
                  }
                >
                  {worstCasePreview ? "Showing longest entry" : "Show longest entry"}
                </button>
              </PropertyRow>
            )}
          </>
        )}
        <PropertyRow label="Dimensions">
          {mainSizeComputed && !groupVertical ? (
            <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
              W {Math.round(computedRect?.width ?? field.width)} · computed
            </span>
          ) : (
            <NumericField
              label="W"
              ariaLabel="Width"
              precision={0}
              min={1}
              value={field.width}
              onCommit={commitW}
            />
          )}
          {(mainSizeComputed && groupVertical) || (isText && sizingMode === "free") ? (
            <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
              H {Math.round(computedRect?.height ?? field.height)} · hugs content
            </span>
          ) : (
            <NumericField
              label="H"
              ariaLabel="Height"
              precision={0}
              min={1}
              value={field.height}
              onCommit={commitH}
            />
          )}
          <button
            onClick={() => setConstrain(!constrain)}
            aria-pressed={constrain}
            title={
              constrain
                ? "Unlink — edit width and height independently"
                : "Constrain proportions — width and height scale together"
            }
            style={{ flexShrink: 0, display: "flex", alignItems: "center" }}
          >
            {constrain ? (
              <LinkIcon
                style={{ width: 13, height: 13, color: "var(--state-primary)" }}
                strokeWidth={1.5}
              />
            ) : (
              <Unlink
                style={{ width: 13, height: 13, color: "var(--text-muted)" }}
                strokeWidth={1.5}
              />
            )}
          </button>
        </PropertyRow>
        {/* The control that decides whether the chosen mode can fail: the
            size floor under Shrink and Fill, the entry bound under Free. */}
        {isText && field.type !== "select" && sizingMode !== "free" && (
          <PropertyRow label="Min text">
            <NumericField
              suffix="px"
              ariaLabel="Minimum text size"
              precision={0}
              min={1}
              allowEmpty
              placeholder="18"
              value={field.minFontSizePx}
              onCommit={(v) => onChange({ minFontSizePx: v })}
            />
          </PropertyRow>
        )}
        {isText && field.type !== "select" && sizingMode === "free" && !isStatic && (
          <PropertyRow label="Max chars">
            <NumericField
              ariaLabel="Maximum characters"
              precision={0}
              min={1}
              allowEmpty
              placeholder="none"
              disabled={locked.has("maxLength")}
              value={field.maxLength}
              onCommit={(v) => onChange({ maxLength: v })}
            />
          </PropertyRow>
        )}
      </InspectorSection>

      <InspectorSection id="appearance" title="Appearance">
        {/* Opacity + corner radius on one row, X/Y rhythm. Radius appears
            only where the renderer honors it (images, rect shapes). */}
        <PropertyRow>
          <NumericField
            icon={<Blend style={{ width: 12, height: 12 }} strokeWidth={1.5} />}
            suffix="%"
            ariaLabel="Opacity"
            precision={0}
            min={0}
            max={100}
            value={field.opacity ?? 100}
            onCommit={(v) => onChange({ opacity: v === undefined || v >= 100 ? undefined : v })}
          />
          {hasRadius && (
            <>
              <NumericField
                icon={<SquareRoundCorner style={{ width: 12, height: 12 }} strokeWidth={1.5} />}
                suffix="px"
                ariaLabel="Corner radius"
                precision={0}
                min={0}
                value={radiusLinked || radiusUniform ? (field.cornerRadius?.tl ?? 0) : undefined}
                mixed={!radiusLinked && !radiusUniform}
                onCommit={(v) => {
                  const rad = Math.max(0, v ?? field.cornerRadius?.tl ?? 0);
                  setRadius({ tl: rad, tr: rad, br: rad, bl: rad });
                }}
              />
              <button
                onClick={() => {
                  if (!radiusLinked) {
                    // Re-linking collapses to the top-left value.
                    const rad = field.cornerRadius?.tl ?? 0;
                    setRadius({ tl: rad, tr: rad, br: rad, bl: rad });
                  }
                  setRadiusLinked(!radiusLinked);
                }}
                aria-pressed={radiusLinked}
                title={
                  radiusLinked
                    ? "Unlink corners — set each independently"
                    : "Link corners — one value for all four"
                }
                style={{ flexShrink: 0, display: "flex", alignItems: "center" }}
              >
                {radiusLinked ? (
                  <LinkIcon
                    style={{ width: 13, height: 13, color: "var(--state-primary)" }}
                    strokeWidth={1.5}
                  />
                ) : (
                  <Unlink
                    style={{ width: 13, height: 13, color: "var(--text-muted)" }}
                    strokeWidth={1.5}
                  />
                )}
              </button>
            </>
          )}
        </PropertyRow>
        {hasRadius && !radiusLinked && (
          <PropertyRow>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: "var(--space-3xs)",
                flex: 1,
                minWidth: 0,
              }}
            >
              {CORNERS.map((c) => (
                <NumericField
                  key={c.key}
                  label={c.label}
                  ariaLabel={`Corner radius ${c.label}`}
                  precision={0}
                  min={0}
                  value={field.cornerRadius?.[c.key] ?? 0}
                  onCommit={(v) =>
                    setRadius({ [c.key]: Math.max(0, v ?? field.cornerRadius?.[c.key] ?? 0) })
                  }
                />
              ))}
            </div>
          </PropertyRow>
        )}
        {field.type === "image" && (
          <>
            <PropertyRow label="Fit">
              <select
                className="sp-input"
                style={compactControlStyle}
                aria-label="Image fit"
                value={field.objectFit ?? "cover"}
                onChange={(e) =>
                  onChange({ objectFit: e.target.value as TemplateField["objectFit"] })
                }
              >
                <option value="cover">Cover (fill box)</option>
                <option value="contain">Contain (fit inside)</option>
              </select>
            </PropertyRow>
            {!isStatic && (
              <PropertyRow label="Crop ratio">
                <NumericField
                  ariaLabel="Crop ratio (width over height)"
                  precision={2}
                  step={0.1}
                  min={0.1}
                  allowEmpty
                  placeholder={`box: ${(field.width / field.height).toFixed(2)}`}
                  value={field.aspectRatio}
                  onCommit={(v) => onChange({ aspectRatio: v })}
                />
              </PropertyRow>
            )}
          </>
        )}
      </InspectorSection>

      <InspectorSection id="typography" title="Typography">
        {isText && (
          <>
            <PropertyRow label="Type style">
              <select
                className="sp-input"
                style={compactControlStyle}
                aria-label="Saved brand type style"
                value={field.typeStyleKey ?? ""}
                onChange={(e) => onChange({ typeStyleKey: e.target.value || undefined })}
              >
                <option value="">None — style freely</option>
                {(kit?.typeStyles ?? []).map((ts) => (
                  <option key={ts.key} value={ts.key}>
                    {ts.name}
                  </option>
                ))}
              </select>
            </PropertyRow>
            {boundStyle && (
              <div
                className="px-3 py-2 space-y-0.5"
                data-radius-control
                style={{
                  background: "var(--accent-wash)",
                  border: "1px solid var(--accent-border)",
                }}
              >
                {ruleSentences(boundStyle, kit).map((rule) => (
                  <p key={rule} style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                    <Lock
                      style={{
                        width: 10,
                        height: 10,
                        display: "inline",
                        marginRight: 5,
                        verticalAlign: "-1px",
                        color: "var(--state-primary)",
                      }}
                    />
                    {rule}
                  </p>
                ))}
              </div>
            )}
            <PropertyRow full>
              <div style={{ flex: 1, minWidth: 0 }}>
                <FontFamilySelect
                  value={displayFamily}
                  groups={familyGroups}
                  disabled={locked.has("fontFamily")}
                  triggerStyle={compactControlStyle}
                  onSelect={changeFamily}
                />
              </div>
            </PropertyRow>
            <PropertyRow>
              <div style={{ flex: 1.4, minWidth: 0 }}>
                <FontStyleSelect
                  family={displayFamily}
                  styles={styleOptions}
                  value={displayStyle}
                  disabled={!displayFamily || styleLocked}
                  locked={styleLocked}
                  triggerStyle={compactControlStyle}
                  onSelect={changeStyle}
                />
              </div>
              <NumericField
                suffix="px"
                ariaLabel="Font size"
                precision={2}
                min={1}
                disabled={locked.has("fontSizePx")}
                value={field.fontSizePx ?? 45}
                onCommit={(v) => onChange({ fontSizePx: v ?? field.fontSizePx })}
              />
            </PropertyRow>
            {sizingMode === "fill" && computedFontSize !== undefined && (
              <p style={hintStyle}>
                Fill box ignores this — the box sets the size, currently{" "}
                {Math.round(computedFontSize)}px.
              </p>
            )}
            {sizingMode === "shrink" &&
              computedFontSize !== undefined &&
              computedFontSize < (resolved.fontSizePx ?? 45) - 0.5 && (
                <p style={hintStyle}>
                  This is the size at rest — the current content fits at{" "}
                  {Math.round(computedFontSize)}px.
                </p>
              )}
            {fontCatalog && !fontCatalog.verified && (
              <p style={hintStyle}>
                We don't have {displayFamily} on file, so these styles are a guess — upload the font
                in Brand Studio to pick from what it really has.
              </p>
            )}
            <PropertyRow label="Line height">
              <NumericField
                suffix="%"
                ariaLabel="Line height percent"
                precision={0}
                min={0}
                allowEmpty
                placeholder="110"
                disabled={locked.has("lineHeight")}
                value={
                  field.lineHeight === undefined ? undefined : Math.round(field.lineHeight * 100)
                }
                onCommit={(v) => onChange({ lineHeight: v === undefined ? undefined : v / 100 })}
              />
            </PropertyRow>
            <PropertyRow label="Spacing">
              <NumericField
                suffix="px"
                ariaLabel="Letter spacing in pixels"
                precision={1}
                allowEmpty
                placeholder="0"
                disabled={locked.has("letterSpacingPx")}
                value={field.letterSpacingPx}
                onCommit={(v) => onChange({ letterSpacingPx: v })}
              />
            </PropertyRow>
            <PropertyRow label="Align">
              <SegmentedIconGroup
                ariaLabel="Horizontal text alignment"
                value={field.align ?? "left"}
                options={[
                  { key: "left", Icon: AlignLeft, title: "Align text left" },
                  { key: "center", Icon: AlignCenter, title: "Center text" },
                  { key: "right", Icon: AlignRight, title: "Align text right" },
                ]}
                onSelect={(k) => onChange({ align: k as TemplateField["align"] })}
              />
              {/* A grouped text child hugs its content — there is no free
                  vertical space to align within; the STACK's anchor and gap
                  own vertical placement. */}
              {!mainSizeComputed && (
                <SegmentedIconGroup
                  ariaLabel="Vertical text alignment"
                  value={field.verticalAlign ?? "middle"}
                  options={[
                    {
                      key: "top",
                      Icon: AlignVerticalJustifyStart,
                      title: "Align text to the top of the box",
                    },
                    {
                      key: "middle",
                      Icon: AlignVerticalJustifyCenter,
                      title: "Center text vertically",
                    },
                    {
                      key: "bottom",
                      Icon: AlignVerticalJustifyEnd,
                      title: "Align text to the bottom of the box",
                    },
                  ]}
                  onSelect={(k) =>
                    onChange({
                      verticalAlign:
                        k === "middle" ? undefined : (k as TemplateField["verticalAlign"]),
                    })
                  }
                />
              )}
              <SegmentedIconGroup
                ariaLabel="Letter case"
                disabled={locked.has("uppercase")}
                options={[
                  {
                    key: "uppercase",
                    Icon: CaseUpper,
                    title: "Uppercase",
                    active: field.uppercase ?? false,
                  },
                ]}
                onSelect={() => onChange({ uppercase: field.uppercase ? undefined : true })}
              />
            </PropertyRow>
          </>
        )}
      </InspectorSection>

      <InspectorSection
        id="fill"
        title="Fill"
        headerExtra={
          hasFill && !fill && !fillLocked ? (
            <button
              title="Add fill"
              aria-label="Add fill"
              onClick={() => onChange({ colorHex: DEFAULT_FILL_HEX, textGradient: undefined })}
              style={{ color: "var(--text-secondary)", display: "flex" }}
            >
              <Plus style={{ width: 13, height: 13 }} strokeWidth={1.5} />
            </button>
          ) : undefined
        }
      >
        {hasFill &&
          (fill ? (
            <PropertyRow>
              <button
                ref={fillSwatchRef}
                title="Edit fill"
                aria-label="Edit fill"
                aria-expanded={pickerOpen}
                onClick={() => setPickerOpen((o) => !o)}
                style={{
                  width: 24,
                  height: 24,
                  flexShrink: 0,
                  borderRadius: "var(--radius-control)",
                  border: "1px solid var(--border-strong)",
                  background:
                    fill.type === "gradient"
                      ? `${gradientCss({ ...fill.gradient, angle: 90 })}, var(--bg-plate)`
                      : `${fill.hex}, var(--bg-plate)`,
                  cursor: "pointer",
                }}
              />
              {fill.type === "solid" ? (
                <>
                  <input
                    type="text"
                    spellCheck={false}
                    disabled={fillLocked}
                    aria-label="Fill hex value"
                    className="sp-input"
                    style={{
                      ...compactControlStyle,
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--type-caption-size)",
                      minWidth: 0,
                      flex: 1,
                    }}
                    key={`${field.id}:${fill.hex}`}
                    defaultValue={fill.hex}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      if (e.key === "Escape") {
                        (e.target as HTMLInputElement).value = fill.hex;
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    onBlur={(e) => {
                      const m = /^#?([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/.exec(e.target.value.trim());
                      if (m) {
                        onChange({
                          colorHex: `#${m[1].toUpperCase()}${m[2] ? m[2].toUpperCase() : ""}`,
                          textGradient: undefined,
                        });
                      } else {
                        e.target.value = fill.hex;
                      }
                    }}
                  />
                  <NumericField
                    suffix="%"
                    ariaLabel="Fill opacity"
                    precision={0}
                    min={0}
                    max={100}
                    disabled={fillLocked}
                    value={fillAlpha}
                    onCommit={(v) => {
                      const base = parseHex(fill.hex);
                      if (!base) return;
                      onChange({
                        colorHex: toHex({ ...base, a: (v ?? fillAlpha) / 100 }),
                        textGradient: undefined,
                      });
                    }}
                  />
                </>
              ) : (
                <span
                  style={{
                    fontSize: "var(--type-caption-size)",
                    color: "var(--text-secondary)",
                    flex: 1,
                  }}
                >
                  Linear gradient
                </span>
              )}
              <button
                title="Remove fill"
                aria-label="Remove fill"
                disabled={fillLocked}
                onClick={() => {
                  setPickerOpen(false);
                  onChange({ colorHex: undefined, textGradient: undefined });
                }}
                style={{
                  color: fillLocked ? "var(--text-disabled)" : "var(--text-muted)",
                  display: "flex",
                  flexShrink: 0,
                }}
              >
                <Minus style={{ width: 13, height: 13 }} strokeWidth={1.5} />
              </button>
            </PropertyRow>
          ) : (
            <p style={hintStyle}>
              No fill — {isShape ? "the shape falls back to ink" : "text falls back to ink"}. Add
              one with the plus.
            </p>
          ))}
      </InspectorSection>

      {/* Member input — what the member sees in their form; gone on fixed
          elements. Same write paths the old panel used. */}
      {!isStatic && (
        <InspectorSection id="member-input" title="Member input">
          {/* Under Free this control lives in Layout — it bounds how far the
              box can grow, which is that mode's failure question. */}
          {isText && field.type !== "select" && sizingMode !== "free" && (
            <PropertyRow label="Max chars">
              <NumericField
                ariaLabel="Maximum characters"
                precision={0}
                min={1}
                allowEmpty
                placeholder="none"
                disabled={locked.has("maxLength")}
                value={field.maxLength}
                onCommit={(v) => onChange({ maxLength: v })}
              />
            </PropertyRow>
          )}
          {field.type === "select" && (
            <PropertyRow label="Options" align="start">
              <textarea
                rows={3}
                className="sp-input"
                style={{
                  fontSize: "var(--type-label-size)",
                  padding: "var(--space-2xs)",
                  resize: "vertical",
                }}
                aria-label="Dropdown options, one per line"
                value={(field.options ?? []).join("\n")}
                onChange={(e) =>
                  onChange(
                    {
                      options: e.target.value
                        .split("\n")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    },
                    true,
                  )
                }
              />
            </PropertyRow>
          )}
          <PropertyRow label="Placeholder">
            <input
              className="sp-input"
              style={compactControlStyle}
              aria-label="Member form placeholder"
              value={field.placeholder ?? ""}
              onChange={(e) => onChange({ placeholder: e.target.value || undefined }, true)}
            />
          </PropertyRow>
          <PropertyRow label="Required">
            <Switch
              checked={field.required ?? false}
              ariaLabel="Required field"
              onChange={(next) => onChange({ required: next || undefined })}
            />
          </PropertyRow>
        </InspectorSection>
      )}

      {pickerOpen && hasFill && (
        <FillPicker
          anchorRef={fillSwatchRef}
          field={field}
          kit={kit}
          companyId={company?.id}
          locked={fillLocked}
          onChange={onChange}
          onClose={() => setPickerOpen(false)}
        />
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
    /** Extra trigger styling (the inspector squeezes it onto compact rows). */
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
  triggerStyle,
  onSelect,
}: {
  value: string | undefined;
  groups: Array<{ label: string; families: string[] }>;
  disabled: boolean;
  triggerStyle?: React.CSSProperties;
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
    setActive(
      Math.max(
        0,
        options.findIndex((o) => o.family === (value ?? "")),
      ),
    );
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
        triggerStyle={triggerStyle}
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
              className="sp-input"
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
                        borderTop:
                          previousGroup === "" && i === 0 ? undefined : "1px solid var(--border)",
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
                    previewStyle={
                      o.family ? { fontFamily: `"${o.family}", sans-serif` } : undefined
                    }
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
  triggerStyle,
  onSelect,
}: {
  family: string | undefined;
  styles: FontStyle[];
  value: FontStyle;
  disabled: boolean;
  locked: boolean;
  triggerStyle?: React.CSSProperties;
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
    setActive(
      Math.max(
        0,
        flat.findIndex((s) => styleKey(s) === styleKey(value)),
      ),
    );
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
        triggerStyle={triggerStyle}
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
                    label={
                      group.label ? styleName({ ...style, stretch: "normal" }) : styleName(style)
                    }
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

const CORNERS: Array<{ key: keyof CornerRadius; label: string }> = [
  { key: "tl", label: "TL" },
  { key: "tr", label: "TR" },
  { key: "br", label: "BR" },
  { key: "bl", label: "BL" },
];
