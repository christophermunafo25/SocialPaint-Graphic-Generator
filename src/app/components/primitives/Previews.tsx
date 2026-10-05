import React, { useId } from "react";
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

/** The preview hover (Result card 104:584, and every template, recent and
 * history preview): the preview dims under overlay/hover (Deep Moss at
 * 35%) and shows the Edit button on overlay/control. Keyboard focus shows
 * the same look, in place of a ring. */
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
  /** Something must be filled in first: Download draws at 40% and still
   * takes the click, which the caller turns into opening the editor. */
  downloadBlocked?: boolean;
  /** The card the editor is open on: outlined, and the Edit button is
   * aria-current. */
  selected?: boolean;
  /** The preview's accessible description, never drawn (Generate's
   * provenance line). */
  description?: string;
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
  downloadBlocked = false,
  selected = false,
  description,
  previewStyle,
  className,
  "data-demo-state": demoState,
}: ResultCardProps) {
  const descriptionId = useId();
  return (
    <div
      className={cx("ui-result-card", className)}
      style={previewStyle}
      data-selected={selected || undefined}
    >
      <PreviewOverlay
        onEdit={onEdit}
        editLabel={editLabel}
        editRef={editRef}
        editProps={{
          "aria-current": selected || undefined,
          "aria-describedby": description ? descriptionId : undefined,
        }}
        data-demo-state={demoState}
      >
        {preview}
      </PreviewOverlay>
      {/* `hidden`, not sr-only: the Edit button's aria-describedby still
          reads it, and browse mode does not hear it twice. */}
      {description && onEdit && (
        <span id={descriptionId} hidden>
          {description}
        </span>
      )}
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
            aria-disabled={downloadBusy || downloadBlocked || undefined}
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
