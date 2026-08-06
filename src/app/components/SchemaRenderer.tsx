import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { BrandKit, FieldValues, TemplateField, TemplateSchema } from "@/lib/types";
import { useDataUrl } from "@/lib/render/useDataUrl";
import { fittedFontSize, fixedWidthFontSize } from "@/lib/render/autoFit";
import { resolveFieldStyle } from "@/lib/brand/resolveStyle";
import { loadGoogleFonts, schemaFontUsage } from "@/lib/render/fonts";
import { exportSchemaPng, type ExportOutcome } from "@/lib/render/exportPng";
import { stores } from "@/lib/stores";

export interface SchemaRendererHandle {
  /** Renders the canvas to PNG and hands it to the user. Records a
   * `download` usage event on success (unless instrument={false}). */
  exportPng(): Promise<ExportOutcome>;
}

interface SchemaRendererProps {
  schema: TemplateSchema;
  values: FieldValues;
  brandKit: BrandKit | null;
  /** Record open/download usage events (default true; builder previews pass false). */
  instrument?: boolean;
  /** Optional overlay painted in canvas space (Template Builder field boxes). */
  overlay?: React.ReactNode;
}

/** Renders ANY TemplateSchema onto a live-scaled canvas sized from
 * schema.canvasWidth/Height, using the coordinate/scale/export technique
 * ported from the reference Signature generators. The ONLY thing member input
 * changes is field content — positions and styling are locked in the schema. */
export const SchemaRenderer = forwardRef<SchemaRendererHandle, SchemaRendererProps>(
  function SchemaRenderer({ schema, values, brandKit, instrument = true, overlay }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);
    const backgroundDataUrl = useDataUrl(schema.backgroundUrl || undefined);

    // Live scale-to-fit, generalized from the reference's parentWidth/1440.
    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      const update = () => {
        setScale(Math.min(el.offsetWidth / schema.canvasWidth, el.offsetHeight / schema.canvasHeight, 1));
      };
      update();
      const observer = new ResizeObserver(update);
      observer.observe(el);
      return () => observer.disconnect();
    }, [schema.canvasWidth, schema.canvasHeight]);

    // Best-effort load of every family the schema references (imported
    // Figma fonts and type-style-bound fonts included) so fields render in
    // their designed typeface.
    useEffect(() => {
      loadGoogleFonts(schemaFontUsage(schema, brandKit));
    }, [schema, brandKit]);

    // Fixed-width fitting measures real glyphs — re-render once webfonts
    // finish loading so measurements switch from the fallback font's metrics.
    const [, setFontsReady] = useState(0);
    useEffect(() => {
      let mounted = true;
      document.fonts?.ready.then(() => mounted && setFontsReady(1));
      return () => {
        mounted = false;
      };
    }, []);

    // One instrumentation point covers every template (Feature 3).
    useEffect(() => {
      if (instrument) void stores.usage.record(schema.companyId, schema.id, "open");
    }, [instrument, schema.companyId, schema.id]);

    const exportPng = useCallback(async () => {
      if (!canvasRef.current) throw new Error("Canvas not mounted");
      const outcome = await exportSchemaPng(schema, canvasRef.current, brandKit);
      // A dismissed share sheet produced no graphic — don't count it.
      if (instrument && outcome !== "canceled") {
        void stores.usage.record(schema.companyId, schema.id, "download");
      }
      return outcome;
    }, [schema, instrument, brandKit]);

    useImperativeHandle(ref, () => ({ exportPng }), [exportPng]);

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
              background: schemaBackgroundCss(schema),
            }}
          >
            {backgroundDataUrl && (
              <img
                src={backgroundDataUrl}
                alt=""
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
              />
            )}
            {schema.fields.map((field) => (
              <FieldBox
                key={field.id}
                field={field}
                value={values[field.fieldKey]}
                brandKit={brandKit}
              />
            ))}
          </div>
          {overlay && (
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>{overlay}</div>
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

function boxStyle(field: TemplateField): React.CSSProperties {
  // Three positioning patterns from the reference generators: plain absolute
  // boxes, center-anchored boxes (translate(-50%,-50%)), rotated content.
  // Positioning ONLY — appearance (including opacity) lives on the content,
  // so the builder can host content inside its own screen-space boxes.
  const transforms: string[] = [];
  if (field.anchor === "center") transforms.push("translate(-50%, -50%)");
  if (field.rotation) transforms.push(`rotate(${field.rotation}deg)`);
  return {
    position: "absolute",
    left: field.x,
    top: field.y,
    width: field.width,
    height: field.height,
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
    opacity: field.opacity !== undefined ? Math.max(0, Math.min(100, field.opacity)) / 100 : undefined,
    // Flip mirrors the CONTENT inside the box (after box rotation), so it
    // rides along in the builder's interaction boxes and the PNG export the
    // same way opacity does.
    transform: field.flipX || field.flipY ? `scale(${field.flipX ? -1 : 1}, ${field.flipY ? -1 : 1})` : undefined,
  };
}

/** CSS linear-gradient from the shared gradient shape. */
export function gradientCss(g: { angle: number; stops: Array<{ position: number; color: string }> }): string {
  return `linear-gradient(${g.angle}deg, ${g.stops
    .map((s) => `${s.color} ${Math.round(s.position * 100)}%`)
    .join(", ")})`;
}

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

export function cornerRadiusCss(field: TemplateField): string | undefined {
  const r = field.cornerRadius;
  if (!r || (!r.tl && !r.tr && !r.br && !r.bl)) return undefined;
  return `${r.tl}px ${r.tr}px ${r.br}px ${r.bl}px`;
}

interface FieldBoxProps {
  field: TemplateField;
  value: string | undefined;
  brandKit: BrandKit | null;
}

/** Positioning wrapper (boxStyle) around the field's visual content. The
 * single member-preview/export render path — behavior must stay identical. */
export function FieldBox({ field, value, brandKit }: FieldBoxProps) {
  return (
    <div style={boxStyle(field)}>
      <FieldBoxContent field={field} value={value} brandKit={brandKit} />
    </div>
  );
}

/** Content-only variant: identical visuals rendered at the origin, filling a
 * parent sized to field.width × field.height. The builder hosts this inside
 * its screen-space interaction boxes so content moves with the box during
 * drags — no second source of truth, no catch-up jump on release. */
export function FieldBoxContent({ field, value, brandKit }: FieldBoxProps) {
  // Static elements carry their own fixed content — member values never apply.
  const effective = field.static ? field.staticValue : value;
  if (field.type === "shape") {
    return <ShapeFieldBox field={field} brandKit={brandKit} />;
  }
  if (field.type === "image") {
    return <ImageFieldBox field={field} value={effective} />;
  }
  return <TextFieldBox field={field} value={effective} brandKit={brandKit} />;
}

/** 5-point star, unit square. */
const STAR_POINTS = "50,0 61,35 98,35 68,57 79,91 50,70 21,91 32,57 2,35 39,35";

/** Decorative shape: fill = gradient → brand color key → hex. Rects render
 * as plain divs (corner radius applies); ellipse/triangle/star render as
 * inline SVG so gradients survive the PNG export. */
function ShapeFieldBox({ field, brandKit }: { field: TemplateField; brandKit: BrandKit | null }) {
  const kind = field.shape ?? "rect";
  const solid = resolveColor(field.colorKey, field.colorHex, brandKit);
  const g = field.textGradient?.stops.length ? field.textGradient : undefined;

  if (kind === "rect") {
    return (
      <div
        style={{
          ...contentBaseStyle(field),
          background: g ? gradientCss(g) : solid,
          borderRadius: cornerRadiusCss(field),
        }}
      />
    );
  }

  const gradId = `sp-shape-grad-${field.id}`;
  const paint = g ? `url(#${gradId})` : solid;
  return (
    <div style={contentBaseStyle(field)}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: "100%", height: "100%", display: "block" }}>
        {g && (
          <defs>
            <linearGradient id={gradId} gradientTransform={`rotate(${((g.angle - 90) % 360 + 360) % 360}, 0.5, 0.5)`}>
              {g.stops.map((s, i) => (
                <stop key={i} offset={`${Math.round(s.position * 100)}%`} stopColor={s.color} />
              ))}
            </linearGradient>
          </defs>
        )}
        {kind === "ellipse" && <ellipse cx="50" cy="50" rx="50" ry="50" fill={paint} />}
        {kind === "triangle" && <polygon points="50,0 100,100 0,100" fill={paint} />}
        {kind === "star" && <polygon points={STAR_POINTS} fill={paint} />}
      </svg>
    </div>
  );
}

function TextFieldBox({ field, value, brandKit }: FieldBoxProps) {
  // Brand rules engine: properties defined by the bound type style win.
  const style = resolveFieldStyle(field, brandKit);
  // Fixed elements ARE the graphic: their content (falling back to the label)
  // always paints at full strength — the dimmed treatment is only for
  // placeholders a member has yet to fill.
  const text = value || (field.static ? field.label : field.placeholder || field.label);
  const atFullStrength = Boolean(value) || Boolean(field.static);
  // Fixed width: the box edge is a hard constraint — single-line text shrinks
  // (real glyph measurement) at exactly the point it would escape; multi-line
  // wraps as usual. Both clip so nothing ever leaves the box.
  const singleLine = field.type !== "multiline";
  const fontSize =
    field.fixedWidth && singleLine
      ? fixedWidthFontSize({ width: field.width, ...style }, text)
      : fittedFontSize({ width: field.width, ...style }, text);
  const justify =
    field.align === "center" ? "center" : field.align === "right" ? "flex-end" : "flex-start";
  const alignItems =
    field.verticalAlign === "top" ? "flex-start" : field.verticalAlign === "bottom" ? "flex-end" : "center";
  return (
    <div
      style={{
        ...contentBaseStyle(field),
        display: "flex",
        alignItems,
        justifyContent: justify,
        overflow: field.fixedWidth ? "hidden" : undefined,
      }}
    >
      <p
        style={{
          fontFamily: style.fontFamily ? `"${style.fontFamily}", sans-serif` : "sans-serif",
          fontWeight: style.fontWeight,
          // Absent stays absent — a legacy field sets neither, so the browser
          // picks exactly the face it picked before these existed.
          fontStyle: style.fontStyle,
          fontStretch: style.fontStretch,
          fontSize,
          color: resolveColor(style.colorKey, style.colorHex, brandKit),
          opacity: atFullStrength ? 1 : 0.55, // placeholder shows the real styling, dimmed
          ...(style.textGradient?.stops.length
            ? {
                backgroundImage: `linear-gradient(${style.textGradient.angle}deg, ${style.textGradient.stops
                  .map((s) => `${s.color} ${Math.round(s.position * 100)}%`)
                  .join(", ")})`,
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }
            : {}),
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
    </div>
  );
}

function ImageFieldBox({ field, value }: { field: TemplateField; value: string | undefined }) {
  return (
    <div
      style={{
        ...contentBaseStyle(field),
        overflow: "hidden",
        borderRadius: cornerRadiusCss(field),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: value ? undefined : "rgba(0,0,0,0.06)",
        border: value ? undefined : "1.5px dashed rgba(0,0,0,0.25)",
      }}
    >
      {value ? (
        <img
          src={value}
          alt={field.label}
          style={{ width: "100%", height: "100%", objectFit: field.objectFit ?? "cover" }}
        />
      ) : (
        <span style={{ color: "rgba(0,0,0,0.35)", fontSize: Math.max(18, field.width / 14), textAlign: "center" }}>
          {field.label}
        </span>
      )}
    </div>
  );
}

