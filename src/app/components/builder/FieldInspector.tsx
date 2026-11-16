import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  AlignCenter,
  Blend,
  BringToFront,
  CaseUpper,
  SquareRoundCorner,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  FlipHorizontal2,
  FlipVertical2,
  Link as LinkIcon,
  Lock,
  Minus,
  Plus,
  RotateCw,
  SendToBack,
  ZoomIn,
  Trash2,
  Unlink,
} from "lucide-react";
import type {
  CornerRadius,
  FieldType,
  TemplateField,
  TemplateVariant,
  VariantFieldOverride,
} from "@/lib/types";
import { VARIANT_OVERRIDE_KEYS } from "@/lib/templates/variants";
import { IconGlyph, IconPicker } from "./IconPicker";
import {
  DEFAULT_ICON_WEIGHT,
  MAX_ICON_WEIGHT,
  MIN_ICON_WEIGHT,
  iconTitle,
  withWeight,
} from "@/lib/icons/lucide";
import { hasStrokePaths } from "@/lib/render/vector";
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
import { useSignedUrl } from "@/lib/render/useSignedUrl";
import {
  getTypeStyle,
  isStyleLocked,
  lockedProperties,
  resolveFieldStyle,
  ruleSentences,
} from "@/lib/brand/resolveStyle";
import {
  DEFAULT_FILL_HEX,
  PLATE_PADDING_X_DEFAULT,
  PLATE_PADDING_Y_DEFAULT,
  gradientCss,
} from "../SchemaRenderer";
import { Select as FontSelect, type SelectOption as FontOption } from "./InspectorSelect";
import {
  Button,
  IconButton,
  Input,
  SegmentedControl,
  Select,
  Tabs,
  TextArea,
  Upload,
} from "../primitives";
import { InspectorHeader } from "./InspectorHeader";
import { CROP_RATIOS, cropChoice, keepAlpha } from "./inspectorValues";
import { elementIcon } from "./elementIcons";
import {
  HexRow,
  InspectorSection,
  NumericField,
  PropertyGrid,
  PropertyRow,
  SegmentedIconGroup,
  SwitchRow,
} from "./InspectorControls";
import { AlignControls } from "./AlignControls";
import { fixedPatch, imagePosition, withImagePosition } from "./fieldOps";
import { ColorRow, EffectsEditor } from "./EffectsEditor";
import { normalizeEffects } from "./effectOps";
import { FillPicker, fillSwatchCss, getFill } from "./FillPicker";
import { ImageSourceDialog, pickableAssets } from "../ImageSourceChooser";
import { parseHex, toHex } from "@/lib/color";
import { DEFAULT_FONT_SIZE, DEFAULT_MIN_FONT_SIZE } from "@/lib/render/autoFit";
import { styleFaces } from "@/lib/brand/fontRoles";

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
  /** Variation mode — present when the template has more than one look.
   * The inspector splits into two tabs: "All variations" (geometry, type,
   * guardrails: the shared structure) and "This variation" (fill, gradient,
   * opacity, bound type style, fixed content, visibility: the appearance
   * layer). Every control sits in exactly one tab. Appearance controls read
   * from `merged` — the field as the selected variation renders it — and
   * write through `onOverride`, never onto the shared field. */
  variantMode?: {
    variant: TemplateVariant;
    merged: TemplateField;
    /** Patch this variation's override entry for the field. A key set to
     * undefined reverts that property to the base look; null drops the
     * entry entirely (inherit everything). */
    onOverride(patch: VariantFieldOverride | null): void;
  };
}

const FIELD_TYPES: Array<{ value: FieldType; label: string }> = [
  { value: "text", label: "Text" },
  { value: "multiline", label: "Paragraph" },
  { value: "image", label: "Image" },
  { value: "select", label: "Dropdown" },
  { value: "shape", label: "Shape" },
];

const gradientName = (kind: string | undefined) =>
  kind === "radial" ? "Radial gradient" : "Linear gradient";

const SHAPE_KINDS: Array<{ value: NonNullable<TemplateField["shape"]>; label: string }> = [
  { value: "rect", label: "Rectangle" },
  { value: "ellipse", label: "Ellipse" },
  { value: "triangle", label: "Triangle" },
  { value: "star", label: "Star" },
];

type TextSizingMode = "free" | "shrink" | "fill";

/** The inspector for the selected element (322:380): its header, then
 * Design and Field. Design holds the frame's Text, Image and Fill sections
 * first, then the ones the frame does not draw (Plate, Stroke, Layout,
 * Layer, Effects); Field holds what your team fills in (2289:4772). */
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
    variantMode,
  } = props;
  const { company } = useAuth();
  const { kit, assets } = useBrand();
  /** The field whose APPEARANCE the panel shows: the variation's merge when
   * in variation mode, the field itself otherwise. Structure always reads
   * from `field` — it is shared and identical either way. */
  const merged = variantMode?.merged ?? field;
  /** In variation mode, whether Effects edits the template's list, which
   * every look starts from, or this look's own. Everything else has one
   * home: shared settings edit the template, a look's colours, opacity,
   * bound style and content edit the look. */
  const [tab, setTab] = useState<"all" | "this">("this");
  /** Appearance writes. In variation mode only the whitelisted keys travel,
   * into the override map; everything else is a shared-structure write and
   * goes through onChange as it always has. */
  const look = useCallback(
    (patch: Partial<TemplateField>, stream?: boolean) => {
      if (!variantMode) {
        onChange(patch, stream);
        return;
      }
      const over: VariantFieldOverride = {};
      for (const key of VARIANT_OVERRIDE_KEYS) {
        if (key in patch) {
          (over as Record<string, unknown>)[key] = (patch as Record<string, unknown>)[key];
        }
      }
      variantMode.onOverride(over);
    },
    [variantMode, onChange],
  );
  const hasOverride = Boolean(variantMode && variantMode.variant.overrides?.[field.fieldKey]);
  const hiddenHere = Boolean(variantMode?.variant.overrides?.[field.fieldKey]?.hidden);
  const isText = field.type === "text" || field.type === "multiline" || field.type === "select";
  const isShape = field.type === "shape";
  const isIcon = field.type === "icon";
  const isStatic = Boolean(field.static);
  /** Children of an auto-layout STACK are placed by it: position is
   * computed, and a text child's main-axis size hugs its content. The
   * inspector says so instead of offering editors that would be silently
   * overridden. Children of a plain group keep their own geometry and get
   * the full editors. */
  const inStack = Boolean(containingGroup) && containingGroup?.mode !== "free";
  const groupVertical = containingGroup?.direction !== "horizontal";
  const mainSizeComputed = inStack && isText;
  const [uploadingStatic, setUploadingStatic] = useState(false);
  /** The image dialog for a fixed image: the brand's images or this device. */
  const [choosingStatic, setChoosingStatic] = useState(false);
  useEffect(() => setChoosingStatic(false), [field.id]);
  /** Custom chosen in Crop, before or after a ratio is typed. */
  const [customCrop, setCustomCrop] = useState(false);
  useEffect(() => setCustomCrop(false), [field.id]);
  const signedStatic = useSignedUrl(
    field.type === "image" && isStatic ? merged.staticValue : undefined,
  );
  /** Design or Field. Shapes and icons are design only, so they have no
   * Field tab. The tab stays put as the selection moves. */
  const hasFieldSide = !isShape && !isIcon;
  const [side, setSide] = useState<"design" | "field">("design");
  const panelId = useId();

  const uploadStaticImage = async (file: File) => {
    if (!company) return;
    setUploadingStatic(true);
    try {
      const url = await stores.templates.uploadBackground(company.id, file, file.name);
      look({ staticValue: url });
    } catch (e) {
      console.error("Static image upload failed", e);
    } finally {
      setUploadingStatic(false);
    }
  };

  // A freshly dropped palette element opens its name for typing (the
  // header's rename); the parent clears focusLabelFieldId once selection
  // moves on, so re-selecting a field never opens it.

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

  // A plated field hugs its content — the box derives from text + padding,
  // so there is nothing for a sizing mode to fit into; the control hides.
  const canSetSizing = (field.type === "text" || field.type === "multiline") && !field.plateColor;
  const setSizingMode = (mode: TextSizingMode) => {
    // A field with no floor of its own shrinks to the 18px default.
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

  const boundStyle = getTypeStyle(kit, merged.typeStyleKey);
  const locked = lockedProperties(boundStyle, kit);
  const resolved = resolveFieldStyle(merged, kit);
  /** The sizing mode the field actually renders with — a bound type style
   * can lock it, exactly like any other locked property. */
  const sizingMode: TextSizingMode = resolved.textSizing ?? "free";
  const sizingLocked = locked.has("textSizing");
  /** What an old absolute floor (or none, which means 18px) works out to
   * as a share of the set size, so nothing changes until the admin types.
   * The base is the set size in Fill mode too. */
  const minTextPlaceholder = String(
    Math.round(
      ((field.minFontSizePx ?? DEFAULT_MIN_FONT_SIZE) /
        (resolved.fontSizePx ?? DEFAULT_FONT_SIZE)) *
        100,
    ),
  );
  const displayFamily = resolved.fontFamily;
  const currentStyle = toFontStyle(resolved.fontWeight, resolved.fontStyle, resolved.fontStretch);
  const fontAssets = useMemo(() => assets.filter((a) => a.kind === "font"), [assets]);

  const familyGroups = useMemo(() => {
    // The faces the type styles use (PHASE-6 §9 D3).
    const brand = [...new Set(styleFaces(kit).map((f) => f.family))];
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

  const hasFill = isText || isShape || isIcon;
  const fill = getFill(merged);
  const fillLocked = locked.has("colorKey");
  const [pickerOpen, setPickerOpen] = useState(false);
  const fillSwatchRef = useRef<HTMLButtonElement>(null);
  const [platePickerOpen, setPlatePickerOpen] = useState(false);
  const plateSwatchRef = useRef<HTMLButtonElement>(null);
  const [strokePickerOpen, setStrokePickerOpen] = useState(false);
  const strokeSwatchRef = useRef<HTMLButtonElement>(null);
  useEffect(() => setPickerOpen(false), [field.id]);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const iconChangeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => setIconPickerOpen(false), [field.id]);
  /** This look sets its own color or gradient for the field. */
  const fillOverridden = Boolean(
    variantMode &&
    (variantMode.variant.overrides?.[field.fieldKey]?.colorHex !== undefined ||
      variantMode.variant.overrides?.[field.fieldKey]?.textGradient !== undefined),
  );

  /** Alpha byte of a solid fill's hex (100 when opaque). */
  const fillAlpha = fill?.type === "solid" ? Math.round((parseHex(fill.hex)?.a ?? 1) * 100) : 100;

  // --- Appearance ----------------------------------------------------------

  /** Text fields that can carry a plate (a pill) — select is a member-input
   * control and never renders a plate. */
  const isTextish = field.type === "text" || field.type === "multiline";
  const hasRadius =
    field.type === "image" ||
    (isShape && (field.shape ?? "rect") === "rect") ||
    (isTextish && Boolean(field.plateColor));
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

  /** Element opacity: Layer in the base panel, the look's own section on
   * This variation. One definition, one home at a time. */
  const opacityField = (
    <NumericField
      icon={<Blend size={16} strokeWidth={1.5} aria-hidden />}
      suffix="%"
      ariaLabel="Opacity"
      precision={0}
      min={0}
      max={100}
      value={merged.opacity ?? 100}
      onCommit={(v) => look({ opacity: v === undefined || v >= 100 ? undefined : v })}
    />
  );

  /** The brand type style binding and its rules. Text in the base panel; the
   * look's own section on This variation (a dark look binds "Headline on
   * dark", say). */
  const typeStyleRows = (
    <>
      <PropertyRow label="Type style">
        <Select
          ariaLabel="Type style"
          value={merged.typeStyleKey ?? ""}
          options={[
            { value: "", label: "None" },
            ...(kit?.typeStyles ?? []).map((ts) => ({ value: ts.key, label: ts.name })),
          ]}
          onSelect={(key) => look({ typeStyleKey: key || undefined })}
        />
      </PropertyRow>
      {boundStyle && (
        <ul className="sp-insp-rules">
          {ruleSentences(boundStyle, kit).map((rule) => (
            <li key={rule} className="t-caption-m">
              <Lock size={12} className="ui-icon" aria-hidden />
              {rule}
            </li>
          ))}
        </ul>
      )}
    </>
  );

  /** A fixed element's content: its text, or its image from the brand or
   * this device. In variation mode it reads the variation's merge and writes
   * its override (a wordmark that flips to white, a logo's colourway). */
  const contentLabel = variantMode ? `Content · ${variantMode.variant.name}` : "Content";
  const staticAsset = assets.find((a) => a.url === merged.staticValue);
  const staticContentRows =
    isStatic && isText ? (
      <PropertyRow label={contentLabel}>
        {field.type === "multiline" ? (
          <TextArea
            aria-label={contentLabel}
            value={merged.staticValue ?? ""}
            onChange={(e) => look({ staticValue: e.target.value || undefined }, true)}
          />
        ) : (
          <Input
            aria-label={contentLabel}
            value={merged.staticValue ?? ""}
            onChange={(e) => look({ staticValue: e.target.value || undefined }, true)}
          />
        )}
      </PropertyRow>
    ) : isStatic && field.type === "image" ? (
      <PropertyRow label={variantMode ? `Image · ${variantMode.variant.name}` : "Image"}>
        <Upload
          placeholder={uploadingStatic ? "Uploading…" : "Add an image"}
          thumbnail={merged.staticValue ? signedStatic.url : null}
          fileName={staticAsset?.name ?? "Image"}
          disabled={uploadingStatic}
          onClick={() => setChoosingStatic(true)}
          onDropFile={(file) => void uploadStaticImage(file)}
        />
        <ImageSourceDialog
          open={choosingStatic}
          onClose={() => setChoosingStatic(false)}
          title={merged.staticValue ? "Replace image" : "Choose an image"}
          assets={pickableAssets(assets)}
          selectedUrl={merged.staticValue}
          onPickAsset={(asset) => look({ staticValue: asset.url })}
          onPickFile={(file) => void uploadStaticImage(file)}
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
        />
      </PropertyRow>
    ) : null;

  /** What your team sees in the form before they type. For a dropdown the
   * same value is the empty option's text. Placeholder is shared structure,
   * never a per-variation override, so it writes through onChange. */
  const isSelect = field.type === "select";
  const placeholderRow = !isStatic && isText && (
    <PropertyRow label={isSelect ? "Empty option" : "Placeholder"}>
      <Input
        aria-label={isSelect ? "Empty option" : "Placeholder"}
        value={field.placeholder ?? ""}
        onChange={(e) => onChange({ placeholder: e.target.value || undefined }, true)}
      />
    </PropertyRow>
  );

  /** Corner radius, one value for all four corners, with the link that
   * splits it; unlinked, the four sit in a grid in the corners they edit. */
  const radiusControl = (
    <>
      <NumericField
        icon={<SquareRoundCorner size={16} strokeWidth={1.5} aria-hidden />}
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
      <IconButton
        variant="ghost"
        size="sm"
        icon={radiusLinked ? LinkIcon : Unlink}
        label="Link the corners"
        aria-pressed={radiusLinked}
        selected={radiusLinked}
        onClick={() => {
          if (!radiusLinked) {
            // Re-linking collapses to the top-left value.
            const rad = field.cornerRadius?.tl ?? 0;
            setRadius({ tl: rad, tr: rad, br: rad, bl: rad });
          }
          setRadiusLinked(!radiusLinked);
        }}
      />
    </>
  );
  const cornersGrid = !radiusLinked && (
    <PropertyGrid columns="repeat(2, minmax(0, 1fr))">
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
    </PropertyGrid>
  );

  /** Crop: Box, a preset, or Custom, which shows the ratio as a number. */
  const cropValue = customCrop ? "custom" : cropChoice(field.aspectRatio);
  const cropOptions = [
    { value: "box", label: "Box" },
    ...CROP_RATIOS.map((r) => ({ value: r.label, label: r.label })),
    { value: "custom", label: "Custom" },
  ];

  const changeType = (t: FieldType) => {
    if (t === field.type) return;
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
  };

  /** The add and remove at the end of an optional property's section name. */
  const addOrRemove = (has: boolean, name: string, add: () => void, remove: () => void) =>
    has ? (
      <IconButton
        variant="ghost"
        size="sm"
        icon={Minus}
        label={`Remove ${name}`}
        onClick={remove}
      />
    ) : (
      <IconButton variant="ghost" size="sm" icon={Plus} label={`Add ${name}`} onClick={add} />
    );

  const isLogo =
    field.type === "image" && assets.some((a) => a.kind === "logo" && a.url === field.staticValue);
  const shownSide = hasFieldSide ? side : "design";

  const design = (
    <>
      {isText && (
        <InspectorSection id="text" title="Text">
          {!variantMode && typeStyleRows}
          <PropertyGrid>
            <PropertyRow label="Font">
              <FontFamilySelect
                value={displayFamily}
                groups={familyGroups}
                disabled={locked.has("fontFamily")}
                onSelect={changeFamily}
              />
            </PropertyRow>
            <PropertyRow label="Weight">
              <FontStyleSelect
                family={displayFamily}
                styles={styleOptions}
                value={displayStyle}
                disabled={!displayFamily || styleLocked}
                locked={styleLocked}
                onSelect={changeStyle}
              />
            </PropertyRow>
          </PropertyGrid>
          {fontCatalog && !fontCatalog.verified && (
            <p className="t-caption-m sp-insp-note">
              We don't have {displayFamily} on file, so its weights are a guess. Upload it in Brand
              Studio for the real ones.
            </p>
          )}
          <PropertyGrid>
            <PropertyRow label="Size">
              <NumericField
                ariaLabel="Font size"
                precision={2}
                min={1}
                disabled={locked.has("fontSizePx")}
                value={field.fontSizePx ?? 45}
                onCommit={(v) => onChange({ fontSizePx: v ?? field.fontSizePx })}
              />
            </PropertyRow>
            <PropertyRow label="Line height">
              <NumericField
                suffix="%"
                ariaLabel="Line height"
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
                ariaLabel="Letter spacing"
                precision={1}
                allowEmpty
                placeholder="0"
                disabled={locked.has("letterSpacingPx")}
                value={field.letterSpacingPx}
                onCommit={(v) => onChange({ letterSpacingPx: v })}
              />
            </PropertyRow>
          </PropertyGrid>
          {sizingMode === "fill" && !field.plateColor && computedFontSize !== undefined && (
            <p className="t-caption-m sp-insp-note">
              The box sets the size: {Math.round(computedFontSize)} px.
            </p>
          )}
          {sizingMode === "shrink" &&
            !field.plateColor &&
            computedFontSize !== undefined &&
            computedFontSize < (resolved.fontSizePx ?? 45) - 0.5 && (
              <p className="t-caption-m sp-insp-note">
                The content fits at {Math.round(computedFontSize)} px.
              </p>
            )}
          <PropertyGrid columns={canSetSizing ? "auto minmax(0, 1fr)" : undefined}>
            <PropertyRow label="Align">
              <SegmentedIconGroup
                ariaLabel="Text alignment"
                value={field.align ?? "left"}
                options={[
                  { key: "left", Icon: AlignLeft, title: "Align left" },
                  { key: "center", Icon: AlignCenter, title: "Align center" },
                  { key: "right", Icon: AlignRight, title: "Align right" },
                ]}
                onSelect={(k) => onChange({ align: k as TemplateField["align"] })}
              />
            </PropertyRow>
            {canSetSizing && (
              <PropertyRow label="Text sizing">
                <SegmentedIconGroup
                  stretch
                  ariaLabel="Text sizing"
                  value={sizingMode}
                  disabled={sizingLocked}
                  options={[
                    { key: "free", label: "Grows" },
                    { key: "shrink", label: "Shrinks" },
                    { key: "fill", label: "Fills" },
                  ]}
                  onSelect={setSizingMode}
                />
              </PropertyRow>
            )}
          </PropertyGrid>
          {sizingLocked && boundStyle && (
            <p className="t-caption-m sp-insp-note">Text sizing is set by {boundStyle.name}.</p>
          )}
          <PropertyGrid
            columns={
              sizingMode !== "free" && !field.plateColor && field.type !== "select"
                ? "auto auto minmax(0, 1fr)"
                : "auto auto"
            }
          >
            {/* A grouped text child hugs its content: there is no free
                vertical space to align within. */}
            {!mainSizeComputed && (
              <PropertyRow label="Vertical">
                <SegmentedIconGroup
                  ariaLabel="Vertical alignment"
                  value={field.verticalAlign ?? "middle"}
                  options={[
                    { key: "top", Icon: AlignVerticalJustifyStart, title: "Align top" },
                    { key: "middle", Icon: AlignVerticalJustifyCenter, title: "Align middle" },
                    { key: "bottom", Icon: AlignVerticalJustifyEnd, title: "Align bottom" },
                  ]}
                  onSelect={(k) =>
                    onChange({
                      verticalAlign:
                        k === "middle" ? undefined : (k as TemplateField["verticalAlign"]),
                    })
                  }
                />
              </PropertyRow>
            )}
            <PropertyRow label="Case">
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
            {/* The floor under Shrinks and Fills, as a share of the set size. */}
            {sizingMode !== "free" && !field.plateColor && field.type !== "select" && (
              <PropertyRow label="Min text">
                <NumericField
                  suffix="%"
                  ariaLabel="Minimum text size"
                  precision={0}
                  min={25}
                  max={100}
                  allowEmpty
                  placeholder={minTextPlaceholder}
                  value={
                    field.minFontScale === undefined
                      ? undefined
                      : Math.round(field.minFontScale * 100)
                  }
                  onCommit={(v) =>
                    onChange(
                      v === undefined
                        ? { minFontScale: undefined }
                        : { minFontScale: v / 100, minFontSizePx: undefined },
                    )
                  }
                />
              </PropertyRow>
            )}
          </PropertyGrid>
        </InspectorSection>
      )}

      {field.type === "image" && (
        <InspectorSection id="image" title="Image">
          <PropertyRow label="Fit">
            <SegmentedIconGroup
              stretch
              ariaLabel="Fit"
              value={field.objectFit ?? "cover"}
              options={[
                { key: "cover", label: "Cover" },
                { key: "contain", label: "Contain" },
              ]}
              onSelect={(k) => onChange({ objectFit: k as TemplateField["objectFit"] })}
            />
          </PropertyRow>
          <PropertyGrid>
            {!isStatic && (
              <PropertyRow label="Crop">
                <Select
                  ariaLabel="Crop"
                  value={cropValue}
                  options={cropOptions}
                  onSelect={(v) => {
                    setCustomCrop(v === "custom");
                    if (v === "box") onChange({ aspectRatio: undefined });
                    const preset = CROP_RATIOS.find((r) => r.label === v);
                    if (preset) onChange({ aspectRatio: preset.ratio });
                  }}
                />
              </PropertyRow>
            )}
            <PropertyRow label="Corners">{radiusControl}</PropertyRow>
          </PropertyGrid>
          {!isStatic && cropValue === "custom" && (
            <PropertyRow label="Ratio">
              <NumericField
                ariaLabel="Crop ratio, width over height"
                precision={2}
                step={0.1}
                min={0.1}
                allowEmpty
                placeholder={(field.width / field.height).toFixed(2)}
                value={field.aspectRatio}
                onCommit={(v) => onChange({ aspectRatio: v })}
              />
            </PropertyRow>
          )}
          {cornersGrid}
          {/* Where the photo sits inside its box. Imports land with the
              designer's position; Reset returns to the plain fit. */}
          <PropertyRow
            label={
              <span className="sp-insp-row__label-row">
                Photo position
                {field.imageRect && (
                  <button
                    type="button"
                    className="ui-reset ui-ring t-label-xs sp-insp-link"
                    onClick={() => onChange({ imageRect: undefined })}
                  >
                    Reset
                  </button>
                )}
              </span>
            }
          >
            {(
              [
                ["zoom", "Zoom", "Photo zoom"],
                ["x", "X", "Photo position X"],
                ["y", "Y", "Photo position Y"],
              ] as const
            ).map(([key, label, ariaLabel]) => (
              <NumericField
                key={key}
                {...(key === "zoom"
                  ? { icon: <ZoomIn size={16} strokeWidth={1.5} aria-hidden /> }
                  : { label })}
                suffix="%"
                ariaLabel={ariaLabel}
                precision={0}
                min={key === "zoom" ? 10 : -1000}
                max={1000}
                value={Math.round(imagePosition(field.imageRect)[key])}
                onCommit={(v) =>
                  v !== undefined &&
                  onChange({ imageRect: withImagePosition(field.imageRect, { [key]: v }) })
                }
              />
            ))}
          </PropertyRow>
          {/* An imported custom-shape mask. Masks arrive from the Figma
              importer; here one can only be removed. */}
          {field.maskUrl && (
            <PropertyRow label="Mask">
              <span className="t-body-s sp-insp-computed">Custom shape</span>
              <IconButton
                variant="ghost"
                size="sm"
                icon={Minus}
                label="Remove the mask"
                onClick={() => onChange({ maskUrl: undefined })}
              />
            </PropertyRow>
          )}
        </InspectorSection>
      )}

      {isIcon && (
        <InspectorSection id="icon" title="Icon">
          <div className="sp-insp-icon-pick">
            {field.vector?.source && <IconGlyph name={field.vector.source.name} size={16} />}
            <span className="t-body-s">
              {field.vector?.source ? iconTitle(field.vector.source.name) : "Vector"}
            </span>
            <Button
              ref={iconChangeRef}
              kind="neutral"
              size="sm"
              aria-haspopup="dialog"
              aria-expanded={iconPickerOpen}
              onClick={() => setIconPickerOpen((o) => !o)}
            >
              Change
            </Button>
          </div>
          {field.vector && hasStrokePaths(field.vector) && (
            <PropertyRow label="Weight">
              <NumericField
                ariaLabel="Weight"
                value={field.vector.stroke?.width ?? DEFAULT_ICON_WEIGHT}
                precision={2}
                step={0.25}
                min={MIN_ICON_WEIGHT}
                max={MAX_ICON_WEIGHT}
                onCommit={(v) => {
                  if (v == null || !field.vector) return;
                  onChange({ vector: withWeight(field.vector, v) });
                }}
              />
            </PropertyRow>
          )}
        </InspectorSection>
      )}

      {isShape && (
        <InspectorSection id="shape" title="Shape">
          <PropertyGrid>
            <PropertyRow label="Shape">
              <Select
                ariaLabel="Shape"
                value={field.shape ?? "rect"}
                options={SHAPE_KINDS}
                onSelect={(v) => onChange({ shape: v })}
              />
            </PropertyRow>
            {hasRadius && <PropertyRow label="Corners">{radiusControl}</PropertyRow>}
          </PropertyGrid>
          {hasRadius && cornersGrid}
          <PropertyRow label="Type">
            <Select
              ariaLabel="Type"
              value={field.type}
              options={FIELD_TYPES}
              onSelect={changeType}
            />
          </PropertyRow>
        </InspectorSection>
      )}

      {hasFill && (
        <InspectorSection
          id="fill"
          title={`${isIcon ? "Color" : "Fill"}${variantMode ? ` · ${variantMode.variant.name}` : ""}`}
          headerExtra={
            fillLocked ? undefined : (
              <span className="sp-insp-actions">
                {variantMode && fillOverridden && (
                  <Button
                    kind="ghost"
                    size="sm"
                    onClick={() =>
                      variantMode.onOverride({ colorHex: undefined, textGradient: undefined })
                    }
                  >
                    Use base
                  </Button>
                )}
                {addOrRemove(
                  Boolean(fill),
                  "fill",
                  () => look({ colorHex: DEFAULT_FILL_HEX, textGradient: undefined }),
                  () => {
                    setPickerOpen(false);
                    look({ colorHex: undefined, textGradient: undefined });
                  },
                )}
              </span>
            )
          }
        >
          {fill && (
            <HexRow
              ref={fillSwatchRef}
              swatch={fillSwatchCss(
                fill.type === "gradient" ? gradientCss({ ...fill.gradient, angle: 90 }) : fill.hex,
                fill.type === "gradient",
              )}
              swatchLabel="Edit fill"
              expanded={pickerOpen}
              onSwatch={() => setPickerOpen((o) => !o)}
              hex={fill.type === "solid" ? fill.hex : undefined}
              text={fill.type === "gradient" ? gradientName(fill.gradient.kind) : undefined}
              hexLabel="Fill hex value"
              disabled={fillLocked}
              onHex={(hex) =>
                fill.type === "solid" &&
                look({ colorHex: keepAlpha(hex, fill.hex), textGradient: undefined })
              }
            >
              {fill.type === "solid" && (
                <NumericField
                  bare
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
                    look({
                      colorHex: toHex({ ...base, a: (v ?? fillAlpha) / 100 }),
                      textGradient: undefined,
                    });
                  }}
                />
              )}
            </HexRow>
          )}
        </InspectorSection>
      )}

      {variantMode && (
        <InspectorSection id="variation" title={`Variation · ${variantMode.variant.name}`}>
          <SwitchRow
            label="Hidden in this variation"
            checked={hiddenHere}
            onChange={(next) => variantMode.onOverride({ hidden: next || undefined })}
          />
          <PropertyRow label="Opacity">{opacityField}</PropertyRow>
          {isText && typeStyleRows}
          {hasOverride && (
            <Button kind="neutral" size="sm" onClick={() => variantMode.onOverride(null)}>
              Use the base styling
            </Button>
          )}
        </InspectorSection>
      )}

      {isTextish && (
        <InspectorSection
          id="plate"
          title="Plate"
          headerExtra={addOrRemove(
            Boolean(field.plateColor),
            "plate",
            () =>
              onChange({
                plateColor: kit?.colors[0]?.hex ?? DEFAULT_FILL_HEX,
                platePaddingX: PLATE_PADDING_X_DEFAULT,
                platePaddingY: PLATE_PADDING_Y_DEFAULT,
              }),
            () =>
              onChange({
                plateColor: undefined,
                platePaddingX: undefined,
                platePaddingY: undefined,
              }),
          )}
        >
          {field.plateColor && (
            <>
              <HexRow
                ref={plateSwatchRef}
                swatch={fillSwatchCss(field.plateColor)}
                swatchLabel="Edit plate color"
                expanded={platePickerOpen}
                onSwatch={() => setPlatePickerOpen((o) => !o)}
                hex={field.plateColor}
                hexLabel="Plate hex value"
                onHex={(hex) => onChange({ plateColor: keepAlpha(hex, field.plateColor ?? hex) })}
              />
              <PropertyRow label="Padding">
                <NumericField
                  label="X"
                  ariaLabel="Plate horizontal padding"
                  precision={0}
                  min={0}
                  value={field.platePaddingX ?? PLATE_PADDING_X_DEFAULT}
                  onCommit={(v) =>
                    onChange({
                      platePaddingX: Math.max(
                        0,
                        v ?? field.platePaddingX ?? PLATE_PADDING_X_DEFAULT,
                      ),
                    })
                  }
                />
                <NumericField
                  label="Y"
                  ariaLabel="Plate vertical padding"
                  precision={0}
                  min={0}
                  value={field.platePaddingY ?? PLATE_PADDING_Y_DEFAULT}
                  onCommit={(v) =>
                    onChange({
                      platePaddingY: Math.max(
                        0,
                        v ?? field.platePaddingY ?? PLATE_PADDING_Y_DEFAULT,
                      ),
                    })
                  }
                />
              </PropertyRow>
              <PropertyRow label="Corners">{radiusControl}</PropertyRow>
              {cornersGrid}
            </>
          )}
        </InspectorSection>
      )}

      {isShape && (
        <InspectorSection
          id="stroke"
          title="Stroke"
          headerExtra={addOrRemove(
            Boolean(field.strokeColor),
            "stroke",
            () => onChange({ strokeColor: DEFAULT_FILL_HEX, strokeWidthPx: 2 }),
            () => {
              setStrokePickerOpen(false);
              onChange({ strokeColor: undefined, strokeWidthPx: undefined });
            },
          )}
        >
          {field.strokeColor && (
            <>
              <HexRow
                ref={strokeSwatchRef}
                swatch={fillSwatchCss(field.strokeColor)}
                swatchLabel="Edit stroke color"
                expanded={strokePickerOpen}
                onSwatch={() => setStrokePickerOpen((o) => !o)}
                hex={field.strokeColor}
                hexLabel="Stroke hex value"
                onHex={(hex) => onChange({ strokeColor: keepAlpha(hex, field.strokeColor ?? hex) })}
              >
                <NumericField
                  bare
                  suffix="px"
                  ariaLabel="Stroke width"
                  precision={0}
                  min={1}
                  value={field.strokeWidthPx ?? 1}
                  onCommit={(v) =>
                    onChange({ strokeWidthPx: Math.max(1, v ?? field.strokeWidthPx ?? 1) })
                  }
                />
              </HexRow>
              <PropertyRow label="Position">
                <SegmentedIconGroup
                  stretch
                  ariaLabel="Stroke position"
                  value={field.strokeAlign ?? "inside"}
                  options={[
                    { key: "inside", label: "Inside" },
                    { key: "center", label: "Center" },
                    { key: "outside", label: "Outside" },
                  ]}
                  onSelect={(align) =>
                    onChange({ strokeAlign: align === "inside" ? undefined : align })
                  }
                />
              </PropertyRow>
            </>
          )}
        </InspectorSection>
      )}

      {/* A look's own stroke and plate colors. Their geometry stays on All. */}
      {variantMode && ((isShape && field.strokeColor) || (isTextish && field.plateColor)) && (
        <InspectorSection
          id="look-strokes"
          title={`${isShape ? "Stroke" : "Plate"} · ${variantMode.variant.name}`}
        >
          {isShape && merged.strokeColor && (
            <ColorRow
              ariaName="Stroke"
              value={merged.strokeColor}
              alpha={false}
              kit={kit}
              companyId={company?.id}
              onChange={(c) => look({ strokeColor: c })}
              onUseBase={
                variantMode.variant.overrides?.[field.fieldKey]?.strokeColor !== undefined
                  ? () => variantMode.onOverride({ strokeColor: undefined })
                  : undefined
              }
            />
          )}
          {isTextish && merged.plateColor && (
            <ColorRow
              ariaName="Plate"
              value={merged.plateColor}
              alpha={false}
              kit={kit}
              companyId={company?.id}
              onChange={(c) => look({ plateColor: c })}
              onUseBase={
                variantMode.variant.overrides?.[field.fieldKey]?.plateColor !== undefined
                  ? () => variantMode.onOverride({ plateColor: undefined })
                  : undefined
              }
            />
          )}
        </InspectorSection>
      )}

      <InspectorSection id="layout" title="Layout">
        {inStack ? (
          <p className="t-body-s sp-insp-note">
            Placed by {containingGroup?.name} at X {Math.round(computedRect?.x ?? field.x)}, Y{" "}
            {Math.round(computedRect?.y ?? field.y)}.
          </p>
        ) : (
          <>
            <PropertyRow label="Align">
              {/* The same control the selection and the floating toolbar
                    use; only the reference frame differs. */}
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
        <PropertyRow label="Size">
          {(mainSizeComputed && !groupVertical) ||
          (isTextish && Boolean(field.plateColor) && field.type !== "multiline") ? (
            <span className="t-body-s sp-insp-computed">
              W {Math.round(computedRect?.width ?? field.width)},{" "}
              {field.plateColor ? "hugs its text" : "set by the group"}
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
          {(mainSizeComputed && groupVertical) ||
          (isText && sizingMode === "free") ||
          (isTextish && Boolean(field.plateColor)) ? (
            <span className="t-body-s sp-insp-computed">
              H {Math.round(computedRect?.height ?? field.height)}, hugs its text
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
          <IconButton
            variant="ghost"
            size="sm"
            icon={constrain ? LinkIcon : Unlink}
            label="Keep the proportions"
            aria-pressed={constrain}
            selected={constrain}
            onClick={() => setConstrain(!constrain)}
          />
        </PropertyRow>
        <PropertyRow label="Rotation">
          <NumericField
            icon={<RotateCw size={16} strokeWidth={1.5} aria-hidden />}
            suffix="°"
            ariaLabel="Rotation"
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
            <Select
              ariaLabel="Anchor"
              value={field.anchor ?? "topLeft"}
              options={[
                { value: "topLeft", label: "Top left corner" },
                { value: "center", label: "Center" },
              ]}
              onSelect={(v) => changeAnchor(v)}
            />
          </PropertyRow>
        )}
      </InspectorSection>

      {!variantMode && (
        <InspectorSection id="layer" title="Layer">
          <PropertyRow label="Opacity">{opacityField}</PropertyRow>
        </InspectorSection>
      )}

      {/* Effects. On All variations (or a template without looks) they edit
          the template, which every look starts from; on This variation they
          replace the look's whole list. */}
      <EffectsEditor
        key={field.id}
        id="effects"
        scope={
          variantMode && (
            <SegmentedControl
              aria-label="Effects for"
              className="sp-builder__span-switch"
              options={[
                { id: "all", label: "All variations" },
                { id: "this", label: "This variation" },
              ]}
              selectedId={tab}
              onSelect={(id) => setTab(id as "all" | "this")}
            />
          )
        }
        effects={variantMode && tab === "this" ? merged.effects : field.effects}
        target={{ kind: "field", field }}
        accentHex={kit?.colors[0]?.hex}
        kit={kit}
        companyId={company?.id}
        onChange={(next) => {
          const normalized = normalizeEffects(next, { kind: "field", field });
          if (variantMode && tab === "this") {
            // An emptied list in a look stays an override: "none here".
            look({ effects: normalized ?? [] });
          } else {
            onChange({ effects: normalized });
          }
        }}
        onUseBase={
          variantMode &&
          tab === "this" &&
          variantMode.variant.overrides?.[field.fieldKey]?.effects !== undefined
            ? () => variantMode.onOverride({ effects: undefined })
            : undefined
        }
      />
    </>
  );

  /** The Field tab (2289:4772): whether your team fills it in, then what
   * they see. Shared structure, except a fixed element's content, which is
   * the selected variation's in variation mode. */
  const fieldSide = (
    <>
      {field.type !== "select" && (
        <SwitchRow
          label="Team fills in"
          checked={!isStatic}
          onChange={(next) => onChange(fixedPatch(field, !next))}
        />
      )}
      <div className="sp-insp-group">
        {staticContentRows}
        {placeholderRow}
        {!isStatic && (
          <SwitchRow
            label="Optional"
            checked={Boolean(field.optional)}
            onChange={(next) => onChange({ optional: next || undefined })}
          />
        )}
        {!isStatic && isTextish && (
          <PropertyRow label="Max characters">
            <NumericField
              ariaLabel="Max characters"
              precision={0}
              min={1}
              allowEmpty
              placeholder="None"
              disabled={locked.has("maxLength")}
              value={field.maxLength}
              onCommit={(v) => onChange({ maxLength: v })}
            />
          </PropertyRow>
        )}
        {!isStatic && isTextish && onWorstCasePreview && (
          <Button kind="neutral" size="sm" onClick={() => onWorstCasePreview(!worstCasePreview)}>
            {worstCasePreview ? "Hide the longest entry" : "Show the longest entry"}
          </Button>
        )}
        {isSelect && (
          <PropertyRow label="Options">
            <TextArea
              aria-label="Options"
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
        <PropertyRow label="Type">
          <Select
            ariaLabel="Type"
            value={field.type}
            options={FIELD_TYPES.filter((t) => !isStatic || t.value !== "select")}
            onSelect={changeType}
          />
        </PropertyRow>
      </div>
    </>
  );

  return (
    <div className="sp-insp">
      <InspectorHeader
        key={field.id}
        icon={elementIcon(field, isLogo)}
        name={field.label}
        renameRequest={focusLabelFieldId === field.id ? field.id : null}
        onRename={(label) =>
          onChange({
            label,
            fieldKey: suggestFieldKey(
              label,
              allFields.filter((f) => f.id !== field.id),
            ),
          })
        }
        actions={[
          {
            items: [
              { label: "Bring to front", icon: BringToFront, onSelect: props.onBringToFront },
              { label: "Send to back", icon: SendToBack, onSelect: props.onSendToBack },
            ],
          },
          { items: [{ label: "Delete", icon: Trash2, destructive: true, onSelect: onDelete }] },
        ]}
      />
      {hasFieldSide && (
        <Tabs
          aria-label="Inspector"
          items={[
            { id: "design", label: "Design", panelId: `${panelId}-design` },
            { id: "field", label: "Field", panelId: `${panelId}-field` },
          ]}
          selectedId={shownSide}
          onSelect={(id) => setSide(id as "design" | "field")}
        />
      )}
      <div
        className="sp-insp-panel"
        id={`${panelId}-${shownSide}`}
        role={hasFieldSide ? "tabpanel" : undefined}
        aria-label={hasFieldSide ? (shownSide === "design" ? "Design" : "Field") : undefined}
      >
        {shownSide === "design" ? design : fieldSide}
      </div>

      {iconPickerOpen && isIcon && (
        <IconPicker
          anchorRef={iconChangeRef}
          side="left"
          selected={field.vector?.source?.name}
          onPick={(name) => {
            setIconPickerOpen(false);
            const weight = field.vector?.stroke?.width ?? DEFAULT_ICON_WEIGHT;
            // A name the builder gave ("Calendar icon") follows the icon; a
            // name the admin typed stays. The field key never changes, so a
            // look's overrides keep pointing at it.
            const oldName = field.vector?.source?.name;
            const autoLabel = oldName !== undefined && field.label === `${iconTitle(oldName)} icon`;
            void import("@/lib/icons/catalog")
              .then((c) => c.loadLucideVector(name, weight))
              .catch(() => null)
              .then((vector) => {
                if (!vector) return;
                onChange(autoLabel ? { vector, label: `${iconTitle(name)} icon` } : { vector });
              });
          }}
          onClose={() => setIconPickerOpen(false)}
        />
      )}

      {pickerOpen && hasFill && (
        <FillPicker
          anchorRef={fillSwatchRef}
          field={merged}
          kit={kit}
          companyId={company?.id}
          locked={fillLocked}
          onChange={look}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {/* The stroke's own picker: the full fill surface pointed at
          strokeColor. A stroke holds one solid color, so the gradient mode
          is hidden. */}
      {strokePickerOpen && isShape && field.strokeColor && (
        <FillPicker
          anchorRef={strokeSwatchRef}
          field={{ ...field, colorHex: field.strokeColor, textGradient: undefined }}
          kit={kit}
          companyId={company?.id}
          locked={false}
          solidOnly
          onChange={(patch) => {
            if (patch.colorHex) onChange({ strokeColor: patch.colorHex });
          }}
          onClose={() => setStrokePickerOpen(false)}
        />
      )}

      {/* The plate's own picker, pointed at plateColor through a proxy field.
          Plates hold one solid color, so the gradient mode is hidden. */}
      {platePickerOpen && isTextish && field.plateColor && (
        <FillPicker
          anchorRef={plateSwatchRef}
          field={{ ...field, colorHex: field.plateColor, textGradient: undefined }}
          kit={kit}
          companyId={company?.id}
          locked={false}
          solidOnly
          onChange={(patch) => {
            if (patch.colorHex) onChange({ plateColor: patch.colorHex });
          }}
          onClose={() => setPlatePickerOpen(false)}
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
// The combobox machinery itself lives in ui/Select; these two wrappers keep
// only what is font-specific — building the option lists, loading the faces
// on screen, and mapping a chosen style back to a field patch.
// ---------------------------------------------------------------------------

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
  const options = useMemo<Array<FontOption<string>>>(() => {
    const all: Array<FontOption<string>> = [{ value: "", label: "Default (sans-serif)" }];
    for (const g of groups) {
      for (const family of g.families) {
        all.push({
          value: family,
          label: family,
          group: g.label,
          previewStyle: { fontFamily: `"${family}", sans-serif` },
        });
      }
    }
    return all;
  }, [groups]);

  // Preview each visible family in its own face. One face per family, and
  // only for what is on the list right now, so typing narrows the work.
  const loadVisible = useCallback((visible: Array<FontOption<string>>) => {
    const usage = new Map(
      visible
        .filter((o) => o.value)
        .map((o) => {
          const known = familyStyles(o.value);
          const regular = nearestStyle(toFontStyle(400), known.styles);
          return [o.value, regular ? [regular] : []] as const;
        })
        .filter(([, styles]) => styles.length > 0),
    );
    if (usage.size > 0) loadGoogleFonts(usage);
  }, []);

  return (
    <FontSelect
      id="sp-family"
      ariaLabel="Font family"
      value={value ?? ""}
      options={options}
      onSelect={(family) => onSelect(family || undefined)}
      placeholder="Default (sans-serif)"
      triggerLabel={value ?? ""}
      triggerPreviewStyle={value ? { fontFamily: `"${value}", sans-serif` } : undefined}
      disabled={disabled}
      lockedHint={disabled}
      searchable
      searchPlaceholder="Search fonts"
      searchEmptyText={(q) => `No fonts match “${q}”.`}
      onVisibleOptions={loadVisible}
    />
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
  const faceOf = useCallback(
    (style: FontStyle): React.CSSProperties => ({
      fontFamily: family ? `"${family}", sans-serif` : undefined,
      fontWeight: style.weight,
      fontStyle: style.italic ? "italic" : undefined,
      fontStretch: style.stretch === "normal" ? undefined : style.stretch,
    }),
    [family],
  );

  const byKey = useMemo(() => new Map(styles.map((s) => [styleKey(s), s])), [styles]);
  const options = useMemo<Array<FontOption<string>>>(
    () =>
      styleGroups(styles).flatMap((group) =>
        group.styles.map((style) => ({
          value: styleKey(style),
          // Inside a width group the header already says the width, so the
          // row carries only the weight — as Figma does. Ungrouped families
          // keep the full name; screen readers always get it.
          label: group.label ? styleName({ ...style, stretch: "normal" }) : styleName(style),
          ariaLabel: styleName(style),
          group: group.label || undefined,
          previewStyle: faceOf(style),
        })),
      ),
    [styles, faceOf],
  );

  return (
    <FontSelect
      id="sp-style"
      ariaLabel="Font style"
      value={styleKey(value)}
      options={options}
      onSelect={(key) => {
        const style = byKey.get(key);
        if (style) onSelect(style);
      }}
      placeholder={family ? "Style" : "Choose a font first"}
      triggerLabel={family ? styleName(value) : ""}
      triggerPreviewStyle={faceOf(value)}
      disabled={disabled}
      lockedHint={locked}
    />
  );
}

// Ordered for the 2×2 spatial grid: top row TL TR, bottom row BL BR —
// each input sits in the corner it edits.
const CORNERS: Array<{ key: keyof CornerRadius; label: string }> = [
  { key: "tl", label: "TL" },
  { key: "tr", label: "TR" },
  { key: "bl", label: "BL" },
  { key: "br", label: "BR" },
];
