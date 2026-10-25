import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { BrandKit, FieldValues, TemplateField, TemplateSchema } from "@/lib/types";
import { ErrorBoundary, FieldCrashFallback } from "./ErrorBoundary";
import { useDataUrl } from "@/lib/render/useDataUrl";
import { createCanvasMeasurer, fitText } from "@/lib/render/autoFit";
import {
  PLATE_PADDING_X_DEFAULT,
  PLATE_PADDING_Y_DEFAULT,
  computeLayout,
  renderedText,
  type Rect,
} from "@/lib/render/layout";
import { resolveFieldStyle } from "@/lib/brand/resolveStyle";
import {
  ensureSchemaFontsLoaded,
  fontUsageLoaded,
  loadGoogleFonts,
  schemaFontUsage,
} from "@/lib/render/fonts";
import { exportSchemaPng, renderSchemaBlob, type ExportOutcome } from "@/lib/render/exportPng";
import { applyVariantToSchema, getVariant, hiddenFieldKeys } from "@/lib/templates/variants";
import { isLeftOff, paintsNothing, type EmptyFieldsMode } from "@/lib/render/emptyFields";
import { stores } from "@/lib/stores";
import { gradientCss, radialGeometry } from "@/lib/render/gradient";
import {
  filterCss,
  innerShadowFrames,
  noiseEffects,
  readEffects,
  readStrokeAlign,
} from "@/lib/render/effects";
import { NOISE_TILE_CELLS, noiseLayerCss, noiseTileDataUrl } from "@/lib/render/noise";
import type { CornerRadius, FieldEffect } from "@/lib/types";

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

export interface SchemaRendererHandle {
  /** Renders the canvas to PNG and hands it to the user. Records a
   * `download` usage event on success (unless instrument={false}). */
  exportPng(): Promise<ExportOutcome>;
  /** The PNG bytes and nothing else: no delivery, no usage event. Bulk
   * export's per-row call — the same rasterization path exportPng takes,
   * which is what makes a bulk PNG identical to a downloaded one. */
  renderBlob(): Promise<Blob>;
}

interface SchemaRendererProps {
  schema: TemplateSchema;
  values: FieldValues;
  brandKit: BrandKit | null;
  /** Record open/download usage events (default true; builder previews pass false). */
  instrument?: boolean;
  /** Optional overlay painted in canvas space (Template Builder field boxes).
   * A function gets the layout's field rects (by field id, canvas px) and
   * the live scale, for chrome that sits on laid-out fields and keeps its
   * on-screen size (the chat's Missing markers). Never exported. */
  overlay?:
    | React.ReactNode
    | ((ctx: { rects: ReadonlyMap<string, Rect>; scale: number }) => React.ReactNode);
  /** Layout warnings for the hosting page (e.g. text that can't fit at its
   * minimum size). Called whenever the layout pass re-runs. */
  onWarnings?(warnings: string[]): void;
  /** Which of the template's variations (colourways) to paint. Resolved
   * ONCE here: the fields and background are merged before anything
   * downstream sees them, so resolveFieldStyle, autoFit, the layout pass
   * and the export all run on an already-merged schema and stay unaware of
   * variations. Absent, unknown, or on a template with no variations, the
   * default look renders — a single-variant template is byte for byte the
   * pre-feature path. */
  variantId?: string | null;
  /** What an empty member field does (render/emptyFields): "placeholder"
   * (default) paints its placeholder, "hideOptional" leaves an empty
   * optional field off, "chat" also paints nothing for an empty required
   * one while keeping its slot. Layout and painting read the same mode, so
   * measurement always agrees with what is painted and exported. */
  emptyFields?: EmptyFieldsMode;
}

/** Renders ANY TemplateSchema onto a live-scaled canvas sized from
 * schema.canvasWidth/Height, using the coordinate/scale/export technique
 * ported from the reference Signature generators. The ONLY thing member input
 * changes is field content — positions and styling are locked in the schema. */
export const SchemaRenderer = forwardRef<SchemaRendererHandle, SchemaRendererProps>(
  function SchemaRenderer(
    {
      schema: source,
      values,
      brandKit,
      instrument = true,
      overlay,
      onWarnings,
      variantId,
      emptyFields = "placeholder",
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);
    // THE variation insertion point. Same object as `source` when there is
    // nothing to merge, so every memo below keys exactly as it always did.
    const schema = useMemo(() => applyVariantToSchema(source, variantId), [source, variantId]);
    /** The look actually painted, for the usage events — a stale id records
     * the default it fell back to, never the id that was asked for. */
    const renderedVariantId = getVariant(source, variantId)?.id;
    const hiddenKeys = useMemo(() => hiddenFieldKeys(source, variantId), [source, variantId]);
    const background = useDataUrl(schema.backgroundUrl || undefined);
    const backgroundDataUrl = background.dataUrl;

    // Live scale-to-fit, generalized from the reference's parentWidth/1440.
    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      const update = () => {
        setScale(
          Math.min(el.offsetWidth / schema.canvasWidth, el.offsetHeight / schema.canvasHeight, 1),
        );
      };
      update();
      const observer = new ResizeObserver(update);
      observer.observe(el);
      return () => observer.disconnect();
    }, [schema.canvasWidth, schema.canvasHeight]);

    // Fixed-width fitting and the layout pass measure real glyphs, so every
    // moment a face can land re-keys the measurer (fontsTick) and the layout
    // re-runs with the real metrics instead of the fallback's.
    const [fontsTick, setFontsTick] = useState(0);
    const bumpFonts = useCallback(() => setFontsTick((t) => t + 1), []);

    // Best-effort load of every family the schema references (imported
    // Figma fonts and type-style-bound fonts included) so fields render in
    // their designed typeface — and re-measure once those exact faces have
    // loaded. document.fonts.ready alone is not that moment: it can resolve
    // before this schema's stylesheet has even been injected, and then
    // nothing would ever measure again.
    useEffect(() => {
      let live = true;
      const usage = schemaFontUsage(schema, brandKit);
      loadGoogleFonts(usage);
      void fontUsageLoaded(usage).then(() => live && bumpFonts());
      return () => {
        live = false;
      };
    }, [schema, brandKit, bumpFonts]);

    // Any later face too: an uploaded brand font registered after mount, or
    // a face the browser only fetched once the painted text asked for it.
    useEffect(() => {
      const fonts = document.fonts;
      if (!fonts) return;
      let live = true;
      void fonts.ready.then(() => live && bumpFonts());
      fonts.addEventListener?.("loadingdone", bumpFonts);
      return () => {
        live = false;
        fonts.removeEventListener?.("loadingdone", bumpFonts);
      };
    }, [bumpFonts]);

    // THE layout pass: schema + values in, rects out. One measurer (and its
    // memo) per fonts generation — a webfont landing changes what the same
    // shorthand measures, so the cache must not survive it.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fontsTick deliberately busts the cache
    const measurer = useMemo(() => createCanvasMeasurer(), [fontsTick]);
    const layout = useMemo(
      () => computeLayout(schema, values, brandKit, measurer, { emptyFields, hiddenKeys }),
      [schema, values, brandKit, measurer, emptyFields, hiddenKeys],
    );

    // Surface layout warnings (text at its floor that still overflows) to
    // the hosting page — the member is the only one who can shorten it.
    useEffect(() => {
      onWarnings?.(layout.warnings);
    }, [layout, onWarnings]);

    // One instrumentation point covers every template (Feature 3).
    useEffect(() => {
      if (instrument) {
        void stores.usage.record(schema.companyId, schema.id, "open", undefined, renderedVariantId);
      }
    }, [instrument, schema.companyId, schema.id, renderedVariantId]);

    // Exports rasterize the DOM as committed, so the layout must have been
    // measured with the loaded faces first. settleLayout waits for them,
    // re-keys the measurer, and resolves after React commits that pass and
    // the browser paints it. Same faces measure the same, so a canvas that
    // was already right re-renders identically.
    const commitWaiters = useRef<Array<() => void>>([]);
    useEffect(() => {
      for (const resolve of commitWaiters.current.splice(0)) resolve();
    }, [layout]);
    // An export still waiting when the canvas unmounts must not hang; it
    // proceeds to its "Canvas not mounted" error instead.
    useEffect(
      () => () => {
        for (const resolve of commitWaiters.current.splice(0)) resolve();
      },
      [],
    );
    const settleLayout = useCallback(async () => {
      await ensureSchemaFontsLoaded(schema, brandKit);
      await new Promise<void>((resolve) => {
        commitWaiters.current.push(resolve);
        bumpFonts();
      });
      await nextFrame();
      await nextFrame();
    }, [schema, brandKit, bumpFonts]);

    const exportPng = useCallback(async () => {
      await settleLayout();
      if (!canvasRef.current) throw new Error("Canvas not mounted");
      const outcome = await exportSchemaPng(schema, canvasRef.current, brandKit);
      // A dismissed share sheet produced no graphic — don't count it.
      if (instrument && outcome !== "canceled") {
        void stores.usage.record(
          schema.companyId,
          schema.id,
          "download",
          undefined,
          renderedVariantId,
        );
      }
      return outcome;
    }, [schema, instrument, brandKit, renderedVariantId, settleLayout]);

    const renderBlob = useCallback(async () => {
      await settleLayout();
      if (!canvasRef.current) throw new Error("Canvas not mounted");
      return renderSchemaBlob(schema, canvasRef.current, brandKit);
    }, [schema, brandKit, settleLayout]);

    useImperativeHandle(ref, () => ({ exportPng, renderBlob }), [exportPng, renderBlob]);

    // Canvas effects: an inner shadow and noise. Other types don't apply to
    // the canvas and are ignored.
    const canvasEffects = useMemo(() => readEffects(schema.canvasEffects), [schema.canvasEffects]);
    const canvasInner = innerShadowFrames(canvasEffects);
    const canvasNoise = noiseLayerCss(noiseEffects(canvasEffects));

    return (
      <div
        ref={containerRef}
        className="relative w-full overflow-hidden"
        style={{
          aspectRatio: `${schema.canvasWidth} / ${schema.canvasHeight}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: schema.canvasWidth,
            height: schema.canvasHeight,
            transform: `scale(${scale})`,
            transformOrigin: "center center",
            position: "absolute",
            flexShrink: 0,
          }}
        >
          <div
            ref={canvasRef}
            style={{
              width: schema.canvasWidth,
              height: schema.canvasHeight,
              position: "relative",
              overflow: "hidden",
              // Its own stacking context, so canvas noise (and any field's
              // zIndex) stays under the builder and Generate overlays.
              isolation: "isolate",
              background: schemaBackgroundCss(schema),
            }}
          >
            {schema.backgroundUrl && !backgroundDataUrl && (
              // Not painted yet (or not painted at all) — the export gate
              // reads these markers so it never rasterizes a missing image.
              <div
                data-image-status={background.failed ? "failed" : "loading"}
                data-field-label="the background image"
                style={{ display: "none" }}
              />
            )}
            {backgroundDataUrl && (
              <img
                src={backgroundDataUrl}
                alt=""
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            )}
            {canvasInner.length > 0 && (
              // Under every field: a frame's inner shadow insets its fill.
              <div style={{ ...overlayBase, overflow: "hidden" }}>
                {canvasInner.map((frame, i) => (
                  <div key={i} style={frame} />
                ))}
              </div>
            )}
            {schema.fields.map((field) => {
              const value = values[field.fieldKey];
              // Left off (an empty optional field) or, in a chat, an empty
              // required one: nothing reaches the canvas or the export.
              if (
                isLeftOff(field, value, emptyFields) ||
                paintsNothing(field, value, emptyFields)
              ) {
                return null;
              }
              return (
                <FieldBox
                  key={field.id}
                  field={field}
                  value={value}
                  brandKit={brandKit}
                  templateId={schema.id}
                  rect={layout.fieldRects.get(field.id)}
                  fontSize={layout.fontSizes.get(field.id)}
                />
              );
            })}
            {canvasNoise && (
              // Over every field, as a Figma frame's noise is.
              <div style={{ ...overlayBase, ...canvasNoise, zIndex: CANVAS_NOISE_Z }} />
            )}
          </div>
          {overlay && (
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
              {typeof overlay === "function"
                ? overlay({ rects: layout.fieldRects, scale })
                : overlay}
            </div>
          )}
        </div>
      </div>
    );
  },
);

/** The renderer's fallback fill — what a field with no explicit fill paints
 * with. Canvas DATA, not chrome: the inspector's add-fill and gradient
 * defaults reuse it so there is exactly one source for the value. */
export const DEFAULT_FILL_HEX = "#111111";

/** Text color: a bound type style's palette key (the one live brand
 * channel) resolves against the kit; otherwise the field's own hex. */
function resolveColor(
  colorKey: string | undefined,
  colorHex: string | undefined,
  brandKit: BrandKit | null,
): string {
  if (colorKey) {
    const entry = brandKit?.colors.find((c) => c.key === colorKey);
    if (entry) return entry.hex;
  }
  return colorHex ?? DEFAULT_FILL_HEX;
}

function boxStyle(field: TemplateField, rect?: Rect): React.CSSProperties {
  // Positioning ONLY — appearance (including opacity) lives on the content,
  // so the builder can host content inside its own screen-space boxes.
  //
  // With a layout rect (the normal path) the box positions from the pass's
  // top-left-space output — anchor normalization already happened there, and
  // grouped children get their stacked, hugged rects. The legacy branch
  // (translate(-50%,-50%) for center anchors) covers only a caller with no
  // layout, and resolves to the same painted geometry.
  const transforms: string[] = [];
  if (!rect && field.anchor === "center") transforms.push("translate(-50%, -50%)");
  if (field.rotation) transforms.push(`rotate(${field.rotation}deg)`);
  return {
    position: "absolute",
    left: rect ? rect.x : field.x,
    top: rect ? rect.y : field.y,
    width: rect ? rect.width : field.width,
    height: rect ? rect.height : field.height,
    transform: transforms.join(" ") || undefined,
    // Canvas layer order. Fields array order is the member FORM order; paint
    // order is zIndex (ties fall back to DOM order = form order).
    zIndex: field.zIndex ?? 0,
  };
}

/** Appearance base for a field's content: fills the positioning parent (the
 * FieldBox wrapper or a builder interaction box) and carries element opacity. */
function contentBaseStyle(field: TemplateField): React.CSSProperties {
  return {
    width: "100%",
    height: "100%",
    // Element opacity (0-100, default 100)
    opacity:
      field.opacity !== undefined ? Math.max(0, Math.min(100, field.opacity)) / 100 : undefined,
    // Flip mirrors the CONTENT inside the box (after box rotation), so it
    // rides along in the builder's interaction boxes and the PNG export the
    // same way opacity does.
    transform:
      field.flipX || field.flipY
        ? `scale(${field.flipX ? -1 : 1}, ${field.flipY ? -1 : 1})`
        : undefined,
  };
}

/** CSS for the shared gradient shape, linear or radial
 * (src/lib/render/gradient.ts). Re-exported for the builder's previews. */
export { gradientCss };

/** Canvas base fill: gradient → color → white. A background image (rendered
 * as an <img> above this) still wins visually. Shared with the builder's
 * edit canvas so every surface paints the same base. */
export function schemaBackgroundCss(
  schema: Pick<TemplateSchema, "backgroundColor" | "backgroundGradient">,
): string {
  const g = schema.backgroundGradient;
  if (g?.stops.length) return gradientCss(g);
  return schema.backgroundColor || "#ffffff";
}

/** Corner radius as CSS, in CANVAS pixels — correct anywhere the element is
 * drawn at canvas scale (the renderer, the export, the builder's scaled
 * content layer). A surface measured in SCREEN pixels must pass its display
 * scale, or the radius comes out wrong by exactly that factor. */
export function cornerRadiusCss(field: TemplateField, scale = 1): string | undefined {
  const r = field.cornerRadius;
  if (!r || (!r.tl && !r.tr && !r.br && !r.bl)) return undefined;
  return `${r.tl * scale}px ${r.tr * scale}px ${r.br * scale}px ${r.bl * scale}px`;
}

/** Text-plate corner radius. Unset renders the pill default — an
 * over-large radius the browser clamps to half the plate's height, so the
 * plate stays a true pill as the text grows. Any AUTHORED value wins,
 * all-zero included (a square plate) — which is why this does not reuse
 * cornerRadiusCss's all-zero → undefined collapse. */
export function plateRadiusCss(field: TemplateField, scale = 1): string {
  const r = field.cornerRadius;
  if (!r) return "9999px";
  return `${r.tl * scale}px ${r.tr * scale}px ${r.br * scale}px ${r.bl * scale}px`;
}

// The plate padding defaults live with the layout pass (the box HUGS text
// plus padding, so layout owns them); re-exported here for the inspector.
export { PLATE_PADDING_X_DEFAULT, PLATE_PADDING_Y_DEFAULT };

interface FieldBoxProps {
  field: TemplateField;
  value: string | undefined;
  brandKit: BrandKit | null;
  /** Display rect from the layout pass (top-left space). Absent → the
   * field's authored geometry, exactly as before the pass existed. */
  rect?: Rect;
  /** Text size from the layout pass (reflects shrinkToFit). Absent → the
   * field computes its own, renderer-identical. */
  fontSize?: number;
}

/** Positioning wrapper (boxStyle) around the field's visual content. The
 * single member-preview/export render path — behavior must stay identical.
 * The FIELD boundary lives here: one malformed field degrades to a quiet
 * placeholder in its own box; every other field still renders and a member
 * can still fill the rest of the template. Editing the field (a new object)
 * resets the boundary and re-attempts the render. */
export function FieldBox({
  field,
  value,
  brandKit,
  rect,
  fontSize,
  templateId,
}: FieldBoxProps & { templateId?: string }) {
  return (
    <div style={boxStyle(field, rect)}>
      <ErrorBoundary
        level="field"
        context={{ fieldId: field.id, fieldType: field.type, templateId }}
        resetKeys={[field, value]}
        fallback={() => <FieldCrashFallback width={field.width} height={field.height} />}
      >
        <FieldBoxContent field={field} value={value} brandKit={brandKit} fontSize={fontSize} />
      </ErrorBoundary>
    </div>
  );
}

/** Content-only variant: identical visuals rendered at the origin, filling a
 * parent sized to field.width × field.height. The builder hosts this inside
 * its screen-space interaction boxes so content moves with the box during
 * drags — no second source of truth, no catch-up jump on release. */
export function FieldBoxContent({ field, value, brandKit, fontSize }: FieldBoxProps) {
  // Static elements carry their own fixed content — member values never apply.
  const effective = field.static ? field.staticValue : value;
  if (field.type === "shape") {
    return <ShapeFieldBox field={field} />;
  }
  if (field.type === "image") {
    // A member image field previews its designed artwork until a value
    // arrives — the image twin of a text field's placeholder copy, and what
    // keeps an imported full-bleed photo visible after Fixed is turned off.
    return <ImageFieldBox field={field} value={effective || field.staticValue} />;
  }
  return <TextFieldBox field={field} value={effective} brandKit={brandKit} fontSize={fontSize} />;
}

/** Above any field's zIndex: canvas noise covers the whole graphic. */
const CANVAS_NOISE_Z = 2147483000;

/** An absolutely placed layer filling its parent, never hit-testable. */
const overlayBase: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
};

/** Inner shadows and noise drawn over a box-shaped element's content,
 * clipped to its corner radius. Null when there is neither. */
function BoxOverlay({ effects, radius }: { effects: FieldEffect[]; radius?: CornerRadius }) {
  const frames = innerShadowFrames(effects, radius);
  const noise = noiseLayerCss(noiseEffects(effects));
  if (!frames.length && !noise) return null;
  const r = radius ? `${radius.tl}px ${radius.tr}px ${radius.br}px ${radius.bl}px` : undefined;
  return (
    <div style={{ ...overlayBase, overflow: "hidden", borderRadius: r, ...(noise ?? {}) }}>
      {frames.map((frame, i) => (
        <div key={i} style={frame} />
      ))}
    </div>
  );
}

/** 5-point star, unit square. */
const STAR_POINTS = "50,0 61,35 98,35 68,57 79,91 50,70 21,91 32,57 2,35 39,35";

/** Decorative shape: fill = gradient → hex. Rects render
 * as plain divs (corner radius applies); ellipse/triangle/star render as
 * inline SVG so gradients survive the PNG export. The viewBox is the field's
 * real size, so the stroke stays uniform at any aspect ratio.
 *
 * Strokes sit where strokeAlign says, inside by default (the painted size
 * never exceeds the box). Rects: inside is a border-box border; center and
 * outside are an outline offset to straddle or hug the edge, which grows
 * the corner radius outward exactly as those strokes do. SVG shapes: inside
 * doubles the stroke and clips it to the shape; center draws it unclipped;
 * outside doubles it and masks the shape's interior away. Center and
 * outside paint beyond the box without moving it. */
function ShapeFieldBox({ field }: { field: TemplateField }) {
  const kind = field.shape ?? "rect";
  const stroke = field.strokeColor;
  const strokeW = stroke ? Math.max(1, field.strokeWidthPx ?? 1) : 0;
  const align = readStrokeAlign(field.strokeAlign);
  const effects = readEffects(field.effects);
  // Palette shapes always carry a colorHex; only a stroke-only import leaves
  // it unset, and there the outline IS the artwork — no default grey fill.
  const solid = field.colorHex ?? (stroke ? "transparent" : DEFAULT_FILL_HEX);
  const g = field.textGradient?.stops.length ? field.textGradient : undefined;

  if (kind === "rect") {
    // Center and outside strokes are one outline, offset so it straddles or
    // hugs the edge; it follows the corner radius outward and paints in a
    // single pass, so there is no seam between two halves.
    let stroked: React.CSSProperties = {};
    if (stroke && align === "inside") {
      stroked = { boxSizing: "border-box", border: `${strokeW}px solid ${stroke}` };
    } else if (stroke) {
      stroked = {
        outline: `${strokeW}px solid ${stroke}`,
        outlineOffset: align === "center" ? `${-strokeW / 2}px` : "0px",
      };
    }
    // Drop shadows and blur are the filter; inner shadows and noise
    // overlay the fill inside its corners.
    const radius = cornerRadiusCss(field);
    const rectFilter = filterCss(effects);
    return (
      <div
        style={{
          ...contentBaseStyle(field),
          background: g ? gradientCss(g) : solid,
          borderRadius: radius,
          ...stroked,
          ...(rectFilter ? { filter: rectFilter } : {}),
          ...(effects.length ? { position: "relative" } : {}),
        }}
      >
        {effects.length > 0 && <BoxOverlay effects={effects} radius={field.cornerRadius} />}
      </div>
    );
  }

  const gradId = `sp-shape-grad-${field.id}`;
  const clipId = `sp-shape-clip-${field.id}`;
  const maskId = `sp-shape-mask-${field.id}`;
  const noiseId = `sp-shape-noise-${field.id}`;
  const paint = g ? `url(#${gradId})` : solid;
  const w = field.width;
  const h = field.height;
  const shapeEl = (extra?: React.SVGProps<SVGElement>) => {
    if (kind === "ellipse") {
      return (
        <ellipse
          cx={w / 2}
          cy={h / 2}
          rx={w / 2}
          ry={h / 2}
          {...(extra as React.SVGProps<SVGEllipseElement>)}
        />
      );
    }
    const points =
      kind === "triangle"
        ? `${w / 2},0 ${w},${h} 0,${h}`
        : STAR_POINTS.split(" ")
            .map((p) => {
              const [x, y] = p.split(",").map(Number);
              return `${(x / 100) * w},${(y / 100) * h}`;
            })
            .join(" ");
    return <polygon points={points} {...(extra as React.SVGProps<SVGPolygonElement>)} />;
  };
  const stops = g?.stops.map((s, i) => (
    <stop key={i} offset={`${Math.round(s.position * 100)}%`} stopColor={s.color} />
  ));
  // A stroke that sits outside the box needs the SVG to paint past its
  // viewport; inside strokes keep today's clipped root.
  const beyond = Boolean(stroke) && align !== "inside";
  let strokeEl: React.ReactNode = null;
  if (stroke && align === "inside") {
    strokeEl = shapeEl({
      fill: "none",
      stroke,
      strokeWidth: strokeW * 2,
      clipPath: `url(#${clipId})`,
    });
  } else if (stroke && align === "center") {
    strokeEl = shapeEl({ fill: "none", stroke, strokeWidth: strokeW });
  } else if (stroke) {
    strokeEl = shapeEl({ fill: "none", stroke, strokeWidth: strokeW * 2, mask: `url(#${maskId})` });
  }
  // Drop shadows follow the shape's alpha; the blur follows them. Inner
  // shadows don't apply to these shapes.
  const svgFilter = filterCss(effects);
  const noise = noiseEffects(effects);
  return (
    <div style={{ ...contentBaseStyle(field), ...(svgFilter ? { filter: svgFilter } : {}) }}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          ...(beyond ? { overflow: "visible" } : {}),
        }}
      >
        <defs>
          {g && g.kind === "radial" ? (
            <RadialGradientDef id={gradId} gradient={g}>
              {stops}
            </RadialGradientDef>
          ) : g ? (
            <linearGradient
              id={gradId}
              gradientTransform={`rotate(${(((g.angle - 90) % 360) + 360) % 360}, 0.5, 0.5)`}
            >
              {stops}
            </linearGradient>
          ) : null}
          {stroke && align === "inside" && <clipPath id={clipId}>{shapeEl()}</clipPath>}
          {stroke && align === "outside" && (
            // The mask reaches as far as a mitered corner can (miter limit
            // 4, at twice the stroke width), so sharp tips keep their points.
            <mask
              id={maskId}
              maskUnits="userSpaceOnUse"
              x={-strokeW * 8}
              y={-strokeW * 8}
              width={w + strokeW * 16}
              height={h + strokeW * 16}
            >
              <rect
                x={-strokeW * 8}
                y={-strokeW * 8}
                width={w + strokeW * 16}
                height={h + strokeW * 16}
                fill="white"
              />
              {shapeEl({ fill: "black" })}
            </mask>
          )}
          {noise.map((n, i) => {
            const tile = NOISE_TILE_CELLS * n.size;
            return (
              <pattern
                key={i}
                id={`${noiseId}-${i}`}
                patternUnits="userSpaceOnUse"
                width={tile}
                height={tile}
              >
                <image
                  href={noiseTileDataUrl(n)}
                  width={tile}
                  height={tile}
                  preserveAspectRatio="none"
                  style={{ imageRendering: "pixelated" }}
                />
              </pattern>
            );
          })}
        </defs>
        {shapeEl({ fill: paint })}
        {noise.map((_, i) => (
          <React.Fragment key={i}>{shapeEl({ fill: `url(#${noiseId}-${i})` })}</React.Fragment>
        ))}
        {strokeEl}
      </svg>
    </div>
  );
}

/** An SVG radial gradient matching gradientCss's radial output: centred on
 * `center`, its ellipse `radius` fractions of the box wide and tall. The
 * gradient's own box is the shape's bounding box, so a unit circle scaled
 * by the radii about the centre is that ellipse. */
function RadialGradientDef({
  id,
  gradient,
  children,
}: {
  id: string;
  gradient: NonNullable<TemplateField["textGradient"]>;
  children: React.ReactNode;
}) {
  const { cx, cy, rx, ry } = radialGeometry(gradient);
  return (
    <radialGradient
      id={id}
      cx={cx}
      cy={cy}
      r={1}
      gradientTransform={`translate(${cx} ${cy}) scale(${rx} ${ry}) translate(${-cx} ${-cy})`}
    >
      {children}
    </radialGradient>
  );
}

function TextFieldBox({ field, value, brandKit, fontSize: layoutFontSize }: FieldBoxProps) {
  // Brand rules engine: properties defined by the bound type style win.
  const style = resolveFieldStyle(field, brandKit);
  // Fixed elements ARE the graphic: their content (falling back to the label)
  // always paints at full strength — the dimmed treatment is only for
  // placeholders a member has yet to fill.
  const text = renderedText(field, value);
  const atFullStrength = Boolean(value) || Boolean(field.static);
  // The layout pass owns the size when it ran (identical math, plus
  // shrinkToFit for grouped stacks); the inline computation remains for
  // hosts without a pass (the builder's interaction boxes). Shrink never
  // clips: content that can't fit at the floor overflows visibly and the
  // layout pass warns.
  const fontSize =
    layoutFontSize ??
    fitText(
      {
        ...style,
        // A plate means hug: the box derives from the content, so there is
        // nothing for shrink/fill to fit into — same rule as the layout pass.
        ...(field.plateColor ? { textSizing: "free" as const } : {}),
        multiline: field.type === "multiline",
        width: field.width,
        height: field.height,
      },
      text,
    ).fontSizePx;
  const justify =
    field.align === "center" ? "center" : field.align === "right" ? "flex-end" : "flex-start";
  const alignItems =
    field.verticalAlign === "top"
      ? "flex-start"
      : field.verticalAlign === "bottom"
        ? "flex-end"
        : "center";
  // A plated field's box HUGS the plate (the layout pass sizes it to text +
  // paddings), so the plate fills the box exactly — it can never overflow,
  // and growing the padding grows the box. The text sits inside the plate's
  // padding, placed by the same align/verticalAlign flex the bare box uses.
  const plateStyle: React.CSSProperties | null = field.plateColor
    ? {
        background: field.plateColor,
        borderRadius: plateRadiusCss(field),
        padding: `${field.platePaddingY ?? PLATE_PADDING_Y_DEFAULT}px ${
          field.platePaddingX ?? PLATE_PADDING_X_DEFAULT
        }px`,
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        display: "flex",
        alignItems,
        justifyContent: justify,
      }
    : null;
  // Drop shadows and blur follow the glyphs (and the plate, when there is
  // one); inner shadows don't apply to text.
  const effects = readEffects(field.effects);
  const textFilter = filterCss(effects);
  const textNoise = noiseLayerCss(noiseEffects(effects));
  const textColor = resolveColor(style.colorKey, style.colorHex, brandKit);
  const gradient = style.textGradient?.stops.length ? gradientCss(style.textGradient) : null;
  // A gradient, grain, or both, painted as backgrounds clipped to the
  // glyphs; the grain layers over the fill, the fill is the last layer.
  let glyphFill: React.CSSProperties = {};
  if (textNoise) {
    glyphFill = {
      backgroundImage: `${textNoise.backgroundImage}, ${
        gradient ?? `linear-gradient(${textColor}, ${textColor})`
      }`,
      backgroundSize: `${textNoise.backgroundSize}, 100% 100%`,
      imageRendering: "pixelated",
      WebkitBackgroundClip: "text",
      backgroundClip: "text",
      color: "transparent",
    };
  } else if (gradient) {
    glyphFill = {
      backgroundImage: gradient,
      WebkitBackgroundClip: "text",
      backgroundClip: "text",
      color: "transparent",
    };
  }
  const content = (
    <p
      style={{
        fontFamily: style.fontFamily ? `"${style.fontFamily}", sans-serif` : "sans-serif",
        fontWeight: style.fontWeight,
        // Absent stays absent — a legacy field sets neither, so the browser
        // picks exactly the face it picked before these existed.
        fontStyle: style.fontStyle,
        fontStretch: style.fontStretch,
        fontSize,
        color: textColor,
        opacity: atFullStrength ? 1 : 0.55, // placeholder shows the real styling, dimmed
        ...glyphFill,
        textAlign: field.align ?? "left",
        textTransform: style.uppercase ? "uppercase" : undefined,
        letterSpacing: style.letterSpacingPx ? `${style.letterSpacingPx}px` : undefined,
        lineHeight: style.lineHeight ?? 1.1,
        whiteSpace: field.type === "multiline" ? "pre-wrap" : "nowrap",
        wordBreak: field.type === "multiline" ? "break-word" : undefined,
        width: field.type === "multiline" ? "100%" : undefined,
        margin: 0,
      }}
    >
      {text}
    </p>
  );
  return (
    <div
      style={{
        ...contentBaseStyle(field),
        display: "flex",
        alignItems,
        justifyContent: justify,
        ...(textFilter ? { filter: textFilter } : {}),
      }}
    >
      {plateStyle ? <div style={plateStyle}>{content}</div> : content}
    </div>
  );
}

function ImageFieldBox({ field, value }: { field: TemplateField; value: string | undefined }) {
  // EVERY image the canvas paints has to be a data URL before toPng runs.
  // html-to-image refetches remote sources in an isolated context, and when
  // that fetch fails it substitutes an empty string and resolves happily —
  // so a raw Storage URL here exports as a hole in an otherwise fine
  // graphic, with a success message. Admin artwork arrives as a URL; member
  // uploads are already data URLs and pass straight through.
  const image = useDataUrl(value || undefined);
  // The alpha mask rides the same data-URL pipeline as the image itself —
  // html-to-image can no more fetch a remote mask than a remote photo. While
  // the field paints an image, a loading/failed mask gates the export too:
  // exporting the photo unmasked would be the wrong shape, silently.
  const mask = useDataUrl(field.maskUrl || undefined);
  const status = !value
    ? undefined
    : image.failed || (field.maskUrl ? mask.failed : false)
      ? "failed"
      : image.loading || (field.maskUrl ? mask.loading : false)
        ? "loading"
        : undefined;
  const maskStyle: React.CSSProperties = mask.dataUrl
    ? {
        WebkitMaskImage: `url(${mask.dataUrl})`,
        maskImage: `url(${mask.dataUrl})`,
        WebkitMaskSize: "100% 100%",
        maskSize: "100% 100%",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
      }
    : {};
  // With effects, opacity and flip move to a wrapper outside the clipped,
  // masked box, so drop shadows and blur (on the wrapper) follow the mask's
  // shape instead of being cut off by it; inner shadows and noise overlay
  // the photo inside the mask. Without effects the markup is today's.
  const effects = readEffects(field.effects);
  const box = (
    <div
      data-image-status={status}
      data-field-label={field.label}
      style={{
        ...(effects.length
          ? { width: "100%", height: "100%", position: "relative" }
          : contentBaseStyle(field)),
        overflow: "hidden",
        borderRadius: cornerRadiusCss(field),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: value ? undefined : "rgba(0,0,0,0.06)",
        border: value ? undefined : "1.5px dashed rgba(0,0,0,0.25)",
        ...maskStyle,
      }}
    >
      {image.dataUrl ? (
        <img
          src={image.dataUrl}
          alt={field.label}
          style={{ width: "100%", height: "100%", objectFit: field.objectFit ?? "cover" }}
        />
      ) : value ? null : ( // the export gate above will wait or refuse on the marker. // In flight, or gone. Either way there is nothing to paint yet, and
        <span
          style={{
            color: "rgba(0,0,0,0.35)",
            fontSize: Math.max(18, field.width / 14),
            textAlign: "center",
          }}
        >
          {field.label}
        </span>
      )}
      {effects.length > 0 && <BoxOverlay effects={effects} radius={field.cornerRadius} />}
    </div>
  );
  if (!effects.length) return box;
  const imageFilter = filterCss(effects);
  return (
    <div style={{ ...contentBaseStyle(field), ...(imageFilter ? { filter: imageFilter } : {}) }}>
      {box}
    </div>
  );
}
