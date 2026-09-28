import React, { useId } from "react";
import type { FieldValues, TemplateSchema } from "@/lib/types";
import { aspectRatioOf } from "@/lib/templates/platforms";
import { platformLabelFor } from "@/lib/generate/draftView";
import { EditOverlay } from "../admin/brand/primitives/EditOverlay";
import { TemplateThumbnail } from "../TemplateThumbnail";
import { DownloadButton } from "./IconButton";

export type DraftCardSize = "regular" | "compact";

/** The preview's fixed height per card size (Figma sp-result-card 284:91):
 * 264 in the thread, 184 once the editor narrows the chat. */
const PREVIEW_HEIGHT: Record<DraftCardSize, number> = { regular: 264, compact: 184 };

/** What the card adds around its preview across its width: the 8px frame
 * on each side (7px of padding inside the recipe's 1px frame). */
const CARD_FRAME = 16;

/** The preview well's size for a draft `aspect` (width ÷ height) wide: the
 * size's fixed height with the width from the ratio. When that width would
 * push the card past `maxWidth` (the chat column), the width pins to the
 * room left inside the frame and the height follows instead. Shared with
 * DraftCardSkeleton so a skeleton and the card that replaces it agree to
 * the pixel. */
export function draftPreviewSize(
  aspect: number,
  size: DraftCardSize,
  maxWidth?: number,
): { width: number; height: number } {
  const height = PREVIEW_HEIGHT[size];
  const width = Math.round(height * aspect);
  if (maxWidth === undefined || width + CARD_FRAME <= maxWidth) return { width, height };
  const pinned = Math.max(0, Math.floor(maxWidth - CARD_FRAME));
  return { width: pinned, height: Math.round(pinned / aspect) };
}

/** The geometry the card's CSS reads: the well's size as two custom
 * properties, from which the stylesheet derives the card's own width. */
export function draftGeometry(size: { width: number; height: number }): React.CSSProperties {
  return {
    "--draft-preview-w": `${size.width}px`,
    "--draft-preview-h": `${size.height}px`,
  } as React.CSSProperties;
}

/** The well's shape when the canvas is unknown (a gone template whose size
 * was never stored): the skeleton's first-slot 4:5. */
const UNKNOWN_ASPECT = 4 / 5;

/** "1080 × 1350 · 4:5", with the multiplication sign. */
function sizeMeta(width: number, height: number): string {
  return `${width} × ${height} · ${aspectRatioOf(width, height)}`;
}

/** The meta line under the title (PROMPT §7.14): the size on a Regular
 * card, the platform on a Compact one, as the Figma draws it (CJ's call,
 * §15 item 17), falling back to the size when the canvas maps to no
 * platform. */
function draftMeta(size: DraftCardSize, width: number, height: number): string {
  const platform = size === "compact" ? platformLabelFor({ width, height }) : null;
  return platform ?? sizeMeta(width, height);
}

/**
 * One draft in an assistant turn (Figma "Generate · Chat", sp-result-card
 * 284:91: Format × Size Regular/Compact × State Default/Hover). A card on
 * the surface recipe with the preview well on top and a title row below.
 *
 * The well's height is fixed by `size` and its width follows `canvas`, so
 * every size in the catalogue gets its own shape; `maxWidth` (the chat
 * column) clamps a wide one. The preview is the edit control: a button
 * carrying the Brand Studio hover/focus overlay, named `Edit "<name>"`.
 * Download sits in the title row. `values` are painted as given, so the
 * caller merges the turn's photo into its target slot first.
 *
 * The meta line reads "1080 × 1350 · 4:5" on a Regular card and the
 * platform ("Instagram") on a Compact one, which is all a 163px card fits;
 * a canvas that maps to no platform keeps the size there too.
 *
 * `schema` null means the template is gone (unpublished or deleted since
 * the chat was saved): the well says so in place of the preview, and the
 * card can be neither edited nor downloaded. Pass the stored canvas when
 * there is one so the card keeps its shape; with `canvas` null too, the
 * well falls back to 4:5 and the meta line is left out.
 *
 * `selected` marks the draft the editor is open on: an inside outline in
 * the inverse ink on the card's edge (the CSS explains why it is the
 * recipe's frame rather than an inset ring), and `aria-current` on the
 * preview button so assistive tech hears which draft is being edited.
 * Light and dark come from tokens.
 */
export function DraftCard({
  name,
  canvas,
  schema,
  values,
  size,
  selected = false,
  maxWidth,
  onEdit,
  onDownload,
  downloading = false,
  previewRef,
  description,
}: {
  /** The template name, or a freestyle draft's design name. */
  name: string;
  /** The draft's canvas size. Null when it is unknown: a gone template
   * whose size was never stored (with a schema, its own size stands in). */
  canvas: { width: number; height: number } | null;
  schema: TemplateSchema | null;
  values: FieldValues;
  size: DraftCardSize;
  selected?: boolean;
  /** The column the card must fit, in px. Absent = never clamps. */
  maxWidth?: number;
  onEdit(): void;
  onDownload(): void;
  /** A card download is exporting: the button dims and reports busy. */
  downloading?: boolean;
  /** For returning focus to the preview when the editor closes. */
  previewRef?: React.Ref<HTMLButtonElement>;
  /** The preview's accessible description, never drawn (the provenance
   * line, PROMPT §9.2). */
  description?: string;
}) {
  const descriptionId = useId();
  const compact = size === "compact";
  const dims =
    canvas ?? (schema ? { width: schema.canvasWidth, height: schema.canvasHeight } : null);
  const well = draftPreviewSize(dims ? dims.width / dims.height : UNKNOWN_ASPECT, size, maxWidth);
  const meta = dims ? draftMeta(size, dims.width, dims.height) : null;

  return (
    <div
      className="sp-card sp-chat-draft"
      data-size={size}
      data-selected={selected || undefined}
      style={draftGeometry(well)}
    >
      {schema ? (
        <button
          ref={previewRef}
          type="button"
          className="sp-chat-draft__preview sp-has-overlay"
          aria-label={`Edit "${name}"`}
          aria-describedby={description ? descriptionId : undefined}
          aria-current={selected || undefined}
          onClick={() => onEdit()}
        >
          {/* Contain: the artwork keeps its own ratio and pins the axis the
              well limits. The well is rounded to whole pixels and the
              renderer scales from rounded offsets, so an exact fit leaves
              a sub-pixel sliver that paints the well as a 1px line along
              one edge (the media card's "inner border", which it hides by
              filling its well with the card colour). Two extra pixels
              cover it at any offset; the well clips one per side, under
              half a percent of the artwork. */}
          <span
            className="sp-chat-draft__art"
            style={{
              aspectRatio: `${schema.canvasWidth} / ${schema.canvasHeight}`,
              ...(schema.canvasWidth / schema.canvasHeight >= well.width / well.height
                ? { width: "calc(100% + 2px)" }
                : { height: "calc(100% + 2px)" }),
            }}
          >
            <TemplateThumbnail template={schema} values={values} />
          </span>
          <EditOverlay small={compact} />
        </button>
      ) : (
        <div className="sp-chat-draft__preview">
          <p className="sp-chat-draft__gone">{name} is no longer available.</p>
        </div>
      )}
      {/* `hidden`, not sr-only: the preview's aria-describedby still reads
          it (a hidden node referenced directly counts), but it stays out
          of the reading order, so browse mode does not hear it twice. No
          preview button, nothing to describe. */}
      {description && schema && (
        <span id={descriptionId} hidden>
          {description}
        </span>
      )}
      <div className="sp-chat-draft__meta">
        <div className="sp-chat-draft__text">
          <p className="sp-chat-draft__title">{name}</p>
          {meta !== null && <p className="sp-chat-draft__sub">{meta}</p>}
        </div>
        <DownloadButton
          size={size}
          templateName={name}
          busy={downloading}
          disabled={!schema}
          onClick={() => onDownload()}
        />
      </div>
    </div>
  );
}
