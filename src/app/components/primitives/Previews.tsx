import React, { useEffect, useId, useRef, useState } from "react";
import { Check, Copy, Download, Pencil } from "lucide-react";
import { Button } from "./Button";
import { cx, type DemoStateAttr } from "./cx";
import { IconButton } from "./IconButton";
import { CONFIRM_MS } from "./motion";
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
  /** The run that made this card has just finished: once its art has
   * decoded it develops in from a blur (PROMPT.md section 7.6). A revisit,
   * a reload and a size switch show the art at once. */
  arrive?: boolean;
  /** Changes each time one of the card's downloads finishes without a
   * failure. Once nothing is busy, the Download that was pressed shows the
   * drawn check for CONFIRM_MS (PROMPT.md section 7.3). */
  downloadedKey?: number;
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
 * the size, Edit and Download (Ghost Small); the stage (340, surface/stage)
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
  downloadedKey,
  arrive = false,
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

  // The arrival: the art waits, unseen, until its images and fonts are
  // ready, then develops in. Only the first art the card shows arrives.
  const stageRef = useRef<HTMLDivElement>(null);
  const [arrival, setArrival] = useState<"pending" | "playing" | null>(arrive ? "pending" : null);
  useEffect(() => {
    if (arrival !== "pending") return;
    let alive = true;
    const stage = stageRef.current;
    const images = stage ? [...stage.querySelectorAll("img")] : [];
    void Promise.all([
      document.fonts?.ready,
      ...images.map((img) => img.decode().catch(() => undefined)),
    ]).then(() => {
      if (alive) setArrival("playing");
    });
    return () => {
      alive = false;
    };
  }, [arrival]);

  // The download check: which Download was pressed, and whether its check
  // shows. It waits until nothing on the card is busy, so Download both
  // confirms once, after its last file.
  const pressed = useRef<"one" | "all">("all");
  const [confirmed, setConfirmed] = useState<"one" | "all" | null>(null);
  const seenKey = useRef(downloadedKey);
  const anyBusy = downloadBusy || Boolean(downloadAll?.busy);
  useEffect(() => {
    if (downloadedKey === seenKey.current || anyBusy) return;
    seenKey.current = downloadedKey;
    setConfirmed(pressed.current);
    const t = window.setTimeout(() => setConfirmed(null), CONFIRM_MS);
    return () => window.clearTimeout(t);
  }, [downloadedKey, anyBusy]);
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
    timer.current = window.setTimeout(() => setCopied(null), CONFIRM_MS);
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
              icon={confirmed === "one" ? Check : Download}
              label={downloadLabel}
              busy={downloadBusy}
              onClick={() => {
                if (downloadBusy) return;
                pressed.current = "one";
                onDownload();
              }}
            />
          )}
        </div>
      </div>
      <div ref={stageRef} className="ui-result-card__stage" data-arrive={arrival ?? undefined}>
        {art}
      </div>
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
              icon={confirmed === "all" ? Check : Download}
              className="ui-result-card__download"
              busy={downloadAll.busy}
              onClick={() => {
                if (downloadAll.busy) return;
                pressed.current = "all";
                downloadAll.onClick();
              }}
            >
              {downloadAll.label}
            </Button>
          )}
        </div>
      )}
      <span className="sr-only" role="status">
        {shown ? "Caption copied" : confirmed ? "Downloaded" : ""}
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

export interface VariationTileProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "name"
> {
  /** The variation's name ("Moss"). */
  name: React.ReactNode;
  /** The template drawn in this variation. */
  thumbnail: React.ReactNode;
  selected?: boolean;
  "data-demo-state"?: DemoStateAttr;
}

/** Variation Tile (Figma 2216:315): one variation in the template chat's
 * picker.
 * Hover rings the thumbnail in border/strong, selected in text/strong, and
 * keyboard focus draws focus/ring on the same pixels. The caller gives it
 * its role (radio in the picker) and aria-checked. */
export const VariationTile = React.forwardRef<HTMLButtonElement, VariationTileProps>(
  function VariationTile(
    { name, thumbnail, selected = false, className, type = "button", ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cx("ui-reset ui-variation-tile", className)}
        data-selected={selected || undefined}
        {...rest}
      >
        <span className="ui-variation-tile__ring">
          <span className="ui-variation-tile__thumb">{thumbnail}</span>
        </span>
        <span className="tu-label-s">{name}</span>
      </button>
    );
  },
);
