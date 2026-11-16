import React, { useEffect, useId, useRef, useState } from "react";
import { Check, Copy, Download, Pencil } from "lucide-react";
import { Button } from "./Button";
import { cx, type DemoStateAttr } from "./cx";
import { IconButton } from "./IconButton";
import { Skeleton } from "./Skeleton";
import { SegmentedControl, type SegmentOption } from "./Toggles";

export interface PreviewOverlayProps {
  /** The preview itself (an image or a rendered template). */
  children: React.ReactNode;
  /** Opens the editor. Without it the preview only dims. */
  onEdit?(): void;
  /** The Edit button's name ("Edit Now hiring"). */
  editLabel?: string;
  /** The Edit button, for a caller that returns focus to it. */
  editRef?: React.Ref<HTMLButtonElement>;
  /** Extra attributes for the Edit button (aria-current, a description). */
  editProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  /** The card around the preview is itself the control (a link or a
   * button): the dim and the Edit circle are drawn as part of it, shown on
   * its hover and keyboard focus, `aria-hidden` and never a second button
   * (Brand Studio's cards, PHASE-6 §9 D8). */
  decorative?: boolean;
  /** A smaller Edit circle, for a preview under 80 tall. */
  small?: boolean;
  className?: string;
  "data-demo-state"?: DemoStateAttr;
}

/** The preview hover (104:584): the preview dims under overlay/hover and
 * shows the Edit button on overlay/control. Keyboard focus shows the same
 * look, in place of a ring. Brand Studio's covers, swatches and logo plates
 * use it (decorative, the card around it being the control). */
export function PreviewOverlay({
  children,
  onEdit,
  editLabel = "Edit",
  editRef,
  editProps,
  decorative = false,
  small = false,
  className,
  "data-demo-state": demoState,
}: PreviewOverlayProps) {
  if (decorative) {
    return (
      <span
        className={cx("ui-preview", className)}
        data-decorative
        data-small={small || undefined}
        data-demo-state={demoState}
      >
        {children}
        <span className="ui-preview__overlay" aria-hidden>
          <span className="ui-preview__edit">
            <Pencil size={small ? 16 : 20} className="ui-icon" />
          </span>
        </span>
      </span>
    );
  }
  return (
    <div className={cx("ui-preview", className)} data-demo-state={demoState}>
      {children}
      <div className="ui-preview__overlay">
        {onEdit && (
          <button
            ref={editRef}
            type="button"
            {...editProps}
            aria-label={editLabel}
            onClick={onEdit}
            className="ui-reset ui-preview__edit"
          >
            <Pencil size={20} className="ui-icon" aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}

/** How long Copy caption shows its check after a write lands. */
const COPIED_MS = 1500;

export interface ResultCardProps {
  /** One segment per draft (by platform, PLAN.md Phase 5); the switch shows
   * for two or more. */
  sizes?: SegmentOption[];
  /** The draft the card shows. */
  selectedId?: string | null;
  onSelect?(id: string): void;
  /** The switch's accessible name. */
  sizesLabel?: string;
  /** The shown draft's size ("1080 × 1350"). */
  meta: React.ReactNode;
  /** The shown draft's artwork, fitted to the stage (ResultCardArt). */
  art: React.ReactNode;
  onEdit?(): void;
  editLabel?: string;
  /** The Edit button, for a caller that returns focus to it. */
  editRef?: React.Ref<HTMLButtonElement>;
  /** The editor is open on this card: Edit is aria-current. */
  selected?: boolean;
  /** Download for the shown draft alone. */
  onDownload?(): void;
  downloadLabel?: string;
  /** A download is being made: Download is busy and takes no click. */
  downloadBusy?: boolean;
  /** The shown draft's caption, as written. */
  caption?: string;
  /** The card's own Download, for every draft ("Download both"). Primary
   * where it leads the view (the default), Neutral where another action
   * does (one Primary a view). */
  downloadAll?: { label: string; onClick(): void; busy?: boolean; lead?: boolean };
  /** The artwork's accessible description, never drawn (Generate's
   * provenance line), read with Edit. */
  description?: string;
  className?: string;
}

/**
 * Result card (Figma 2216:287): one turn's posts in the chat, 12 in and 16
 * between its rows. The top row holds the size switch on the left, then
 * the size, Edit and Download (Ghost Small); the stage (340, surface/field)
 * shows the draft the switch picks; then its caption in Body/M, and the
 * footer: Copy caption (Neutral) and the card's Download (Primary).
 *
 * Copy's feedback belongs to the text it copied: the button shows a check
 * and the card says "Caption copied" for 1.5s, and any change to the shown
 * caption (another draft, an edit) drops it at once. A denied write claims
 * nothing.
 */
export function ResultCard({
  sizes,
  selectedId,
  onSelect,
  sizesLabel = "Sizes",
  meta,
  art,
  onEdit,
  editLabel = "Edit",
  editRef,
  selected = false,
  onDownload,
  downloadLabel = "Download",
  downloadBusy = false,
  caption = "",
  downloadAll,
  description,
  className,
}: ResultCardProps) {
  const descriptionId = useId();
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  // During render, so neither the glyph nor the live region shows a copy
  // against other text for a frame.
  if (copied !== null && copied !== caption) setCopied(null);
  const shown = copied !== null;
  const hasCaption = caption.trim().length > 0;
  const showSizes = Boolean(sizes && sizes.length >= 2 && onSelect);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(caption);
    } catch (e) {
      console.warn("clipboard write failed", e);
      return;
    }
    setCopied(caption);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(null), COPIED_MS);
  };

  return (
    <div className={cx("ui-result-card", className)}>
      <div className="ui-result-card__top">
        {showSizes ? (
          <SegmentedControl
            options={sizes!}
            selectedId={selectedId ?? null}
            onSelect={onSelect!}
            aria-label={sizesLabel}
          />
        ) : (
          <span />
        )}
        <div className="ui-result-card__tools">
          <span className="t-caption-m ui-result-card__meta">{meta}</span>
          {onEdit && (
            <IconButton
              ref={editRef}
              variant="ghost"
              size="sm"
              icon={Pencil}
              label={editLabel}
              aria-current={selected || undefined}
              aria-describedby={description ? descriptionId : undefined}
              onClick={onEdit}
            />
          )}
          {onDownload && (
            <IconButton
              variant="ghost"
              size="sm"
              icon={Download}
              label={downloadLabel}
              aria-busy={downloadBusy || undefined}
              aria-disabled={downloadBusy || undefined}
              onClick={() => {
                if (!downloadBusy) onDownload();
              }}
            />
          )}
        </div>
      </div>
      <div className="ui-result-card__stage">{art}</div>
      {/* `hidden`, not sr-only: Edit's aria-describedby still reads it, and
          browse mode does not hear it twice. */}
      {description && onEdit && (
        <span id={descriptionId} hidden>
          {description}
        </span>
      )}
      {hasCaption && <p className="t-body-m ui-result-card__caption">{caption}</p>}
      {(hasCaption || downloadAll) && (
        <div className="ui-result-card__foot">
          {hasCaption && (
            <Button kind="neutral" icon={shown ? Check : Copy} onClick={() => void copy()}>
              Copy caption
            </Button>
          )}
          {downloadAll && (
            <Button
              kind={downloadAll.lead === false ? "neutral" : "primary"}
              icon={Download}
              className="ui-result-card__download"
              aria-busy={downloadAll.busy || undefined}
              aria-disabled={downloadAll.busy || undefined}
              onClick={() => {
                if (!downloadAll.busy) downloadAll.onClick();
              }}
            >
              {downloadAll.label}
            </Button>
          )}
        </div>
      )}
      <span className="sr-only" role="status">
        {shown ? "Caption copied" : ""}
      </span>
    </div>
  );
}

/** A draft's artwork on the Result card's stage: as large as fits at its
 * own ratio, centred. The fit is CSS (the stage is a size container), so
 * nothing measures in JS. */
export function ResultCardArt({
  ratio,
  children,
}: {
  /** Width over height. */
  ratio: number;
  children: React.ReactNode;
}) {
  return (
    <span className="ui-result-card__art" style={{ "--fit-ratio": ratio } as React.CSSProperties}>
      {/* 1px of overscan: the renderer's contain rounds a hair short of the
          box. */}
      <span className="ui-result-card__overscan">{children}</span>
    </span>
  );
}

/** The Result card while its drafts build (2216:278, State=Loading): the
 * switch's block when more than one draft is coming, the size's bar, the
 * stage, two caption lines and the footer's two buttons, all Skeletons.
 * Decoration only; the status sentence carries the progress. */
export function ResultCardSkeleton({ withSizes = true }: { withSizes?: boolean }) {
  return (
    <div className="ui-result-card" data-state="loading" aria-hidden>
      <div className="ui-result-card__top">
        {withSizes ? <Skeleton shape="block" width={164} height={36} /> : <span />}
        <Skeleton width={120} />
      </div>
      <Skeleton shape="block" height={340} />
      <span className="ui-result-card__lines">
        <Skeleton height={10} width="100%" />
        <Skeleton height={10} width={420} />
      </span>
      <div className="ui-result-card__foot" data-spread>
        <Skeleton shape="block" width={138} height={36} radius="sm" />
        <Skeleton shape="block" width={148} height={36} radius="sm" />
      </div>
    </div>
  );
}

export interface LookTileProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "name"> {
  /** The look's name ("Moss"). */
  name: React.ReactNode;
  /** The template drawn in this look. */
  thumbnail: React.ReactNode;
  selected?: boolean;
  "data-demo-state"?: DemoStateAttr;
}

/** Look tile (Figma 104:996): one look in the template chat's picker.
 * Hover rings the thumbnail in border/strong, selected in text/strong, and
 * keyboard focus draws focus/ring on the same pixels. The caller gives it
 * its role (radio in the picker) and aria-checked. */
export const LookTile = React.forwardRef<HTMLButtonElement, LookTileProps>(function LookTile(
  { name, thumbnail, selected = false, className, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx("ui-reset ui-look-tile", className)}
      data-selected={selected || undefined}
      {...rest}
    >
      <span className="ui-look-tile__ring">
        <span className="ui-look-tile__thumb">{thumbnail}</span>
      </span>
      <span className="tu-label-s">{name}</span>
    </button>
  );
});
