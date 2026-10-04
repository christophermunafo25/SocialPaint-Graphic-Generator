import React from "react";
import { Download, Pencil } from "lucide-react";
import { cx, type DemoStateAttr } from "./cx";
import { IconButton } from "./IconButton";

export interface PreviewOverlayProps {
  /** The preview itself (an image or a rendered template). */
  children: React.ReactNode;
  /** Opens the editor. Without it the preview only dims. */
  onEdit?(): void;
  /** The Edit button's name ("Edit Now hiring"). */
  editLabel?: string;
  /** The Edit button, for a caller that returns focus to it. */
  editRef?: React.Ref<HTMLButtonElement>;
  className?: string;
  "data-demo-state"?: DemoStateAttr;
}

/** The preview hover (Result card 104:584, and every template, recent and
 * history preview): the preview dims under overlay/hover (Deep Moss at
 * 35%) and shows the Edit button on overlay/control. Keyboard focus shows
 * the same look, in place of a ring. */
export function PreviewOverlay({
  children,
  onEdit,
  editLabel = "Edit",
  editRef,
  className,
  "data-demo-state": demoState,
}: PreviewOverlayProps) {
  return (
    <div className={cx("ui-preview", className)} data-demo-state={demoState}>
      {children}
      <div className="ui-preview__overlay">
        {onEdit && (
          <button
            ref={editRef}
            type="button"
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

export interface ResultCardProps {
  title: React.ReactNode;
  /** The size line ("1080 × 1350"). */
  meta: React.ReactNode;
  /** The rendered post. */
  preview: React.ReactNode;
  onEdit?(): void;
  editLabel?: string;
  editRef?: React.Ref<HTMLButtonElement>;
  onDownload?(): void;
  downloadLabel?: string;
  /** A download is being made: Download is busy and takes no click. */
  downloadBusy?: boolean;
  /** The preview's frame, for a caller that sizes it (a width and an
   * aspect ratio). */
  previewStyle?: React.CSSProperties;
  className?: string;
  "data-demo-state"?: DemoStateAttr;
}

/** Result card (Figma 104:602): a generated post in the chat. The
 * download is the Filled Icon button at its standard 32 (the file draws
 * this one at 34; PHASE-2 §8). */
export function ResultCard({
  title,
  meta,
  preview,
  onEdit,
  editLabel,
  editRef,
  onDownload,
  downloadLabel = "Download",
  downloadBusy = false,
  previewStyle,
  className,
  "data-demo-state": demoState,
}: ResultCardProps) {
  return (
    <div className={cx("ui-result-card", className)} style={previewStyle}>
      <PreviewOverlay
        onEdit={onEdit}
        editLabel={editLabel}
        editRef={editRef}
        data-demo-state={demoState}
      >
        {preview}
      </PreviewOverlay>
      <div className="ui-result-card__meta">
        <div className="ui-result-card__text">
          <span className="t-label-l">{title}</span>
          <span className="t-label-xs ui-result-card__size">{meta}</span>
        </div>
        {onDownload && (
          <IconButton
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
      <span className="t-control-s">{name}</span>
    </button>
  );
});
