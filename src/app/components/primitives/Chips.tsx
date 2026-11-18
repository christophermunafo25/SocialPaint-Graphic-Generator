import React from "react";
import { ChevronRight, LayoutGrid, X } from "lucide-react";
import { platformById, type PlatformId } from "@/lib/templates/platforms";
import { cx, type DemoStateAttr, type IconComponent } from "./cx";

type ButtonAttrs = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  "data-demo-state"?: DemoStateAttr;
};

export interface ChipProps extends ButtonAttrs {
  /** Chosen: the inverse fill. Pass it, true or false, on a chip that
   * toggles, and it sets aria-pressed. Leave it off a chip that only acts
   * (a suggestion). */
  selected?: boolean;
  /** A leading icon, drawn at 16. */
  icon?: IconComponent;
}

/** Chip (Figma 2212:187): a 28 pill on action/neutral with a hairline
 * edge, for a suggestion or one option in a set of choices. Selected takes
 * the inverse fill. The file's chip with a remove button is DetailTag,
 * which holds two controls and so cannot be one button. */
export const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { selected, icon: Icon, className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-pressed={selected}
      className={cx("ui-reset ui-fill ui-ring ui-chip", className)}
      data-selected={selected || undefined}
      {...rest}
    >
      {Icon && <Icon size={16} className="ui-icon" aria-hidden />}
      <span className="t-label-s">{children}</span>
    </button>
  );
});

/** Platform logo (Figma 53:73): the platform's mark at 20 in currentColor;
 * All is the layout grid. The marks are the code's own (platformIcons). */
export function PlatformLogo({
  platform,
  size = 20,
  className,
}: {
  platform: PlatformId | "all";
  size?: number;
  className?: string;
}) {
  if (platform === "all") {
    return <LayoutGrid size={size} className={cx("ui-icon", className)} aria-hidden />;
  }
  const { Icon } = platformById(platform);
  return <Icon width={size} height={size} className={cx("ui-icon", className)} aria-hidden />;
}

export interface PlatformChipProps extends ButtonAttrs {
  platform: PlatformId | "all";
  /** Selected turns the chip inverse, with the tile on action/primary-hover,
   * and the chevron down. */
  selected?: boolean;
  /** Its menu is open; the chevron points down. */
  expanded?: boolean;
  /** Off where the chip is drawn without it (Choose a size, 329:2970): the
   * tile and the label, 8 from the end. */
  chevron?: boolean;
}

/** Platform chip (Figma 53:96): 46 tall at radius/chip, hugging its label,
 * with the platform's mark on a 36 tile and a chevron, flat at rest. The
 * caller gives it its role (radio in a filter group) and its aria state. */
export const PlatformChip = React.forwardRef<HTMLButtonElement, PlatformChipProps>(
  function PlatformChip(
    {
      platform,
      selected = false,
      expanded = false,
      chevron = true,
      className,
      children,
      type = "button",
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cx("ui-reset ui-fill ui-ring ui-platform-chip", className)}
        data-selected={selected || undefined}
        data-expanded={selected || expanded || undefined}
        {...rest}
      >
        <span className="ui-platform-chip__tile">
          <PlatformLogo platform={platform} />
        </span>
        <span className="t-label-xs">{children}</span>
        {chevron && (
          <ChevronRight size={14} className="ui-icon ui-platform-chip__chevron" aria-hidden />
        )}
      </button>
    );
  },
);

export type TagKind = "default" | "overlay" | "outline";

export interface TagProps extends ButtonAttrs {
  /** Default labels a thing (a logo's surface, a type style's role).
   * Overlay sits on a colour or an image. Outline is the quiet one. */
  kind?: TagKind;
  /** A leading icon, drawn at 16. */
  icon?: IconComponent;
}

/** Tag (Figma 2212:143): a 24 pill in Label/XS. A tag is text, not a
 * control. With onClick it is a button (a field the template still needs,
 * in Outline with a plus), which hovers and takes the ring. */
export const Tag = React.forwardRef<HTMLButtonElement, TagProps>(function Tag(
  { kind = "default", icon: Icon, className, children, type = "button", ...rest },
  ref,
) {
  const content = (
    <>
      {Icon && <Icon size={16} className="ui-icon" aria-hidden />}
      <span className="t-label-xs">{children}</span>
    </>
  );
  if (!rest.onClick) {
    // A text tag is a span: it keeps what describes it, not a button's props.
    return (
      <span
        className={cx("ui-tag", className)}
        data-kind={kind}
        id={rest.id}
        title={rest.title}
        style={rest.style}
        role={rest.role}
        aria-hidden={rest["aria-hidden"]}
        aria-label={rest["aria-label"]}
      >
        {content}
      </span>
    );
  }
  return (
    <button
      ref={ref}
      type={type}
      className={cx("ui-reset ui-fill ui-ring ui-tag", className)}
      data-kind={kind}
      {...rest}
    >
      {content}
    </button>
  );
});

export interface DetailTagProps {
  /** Editable is in the composer, with its remove button; Sent is how it
   * reads inside a sent message. */
  state?: "editable" | "sent";
  children: React.ReactNode;
  /** A leading icon, drawn at 16. */
  icon?: IconComponent;
  onRemove?(): void;
  /** The remove button's name, e.g. "Remove socialpaint.ai/careers". */
  removeLabel?: string;
  /** Editable only: the value becomes a button that edits the detail
   * (Generate, PHASE-5 section 9 D4). */
  onEdit?(event: React.MouseEvent<HTMLButtonElement>): void;
  /** The value button's name, e.g. "Edit Link: socialpaint.ai/careers". */
  editLabel?: string;
  className?: string;
  "data-demo-state"?: DemoStateAttr;
}

/** A detail on a message. Editable, in the composer, it is the file's Chip
 * with its remove button (2212:187): the chip's look around two controls,
 * the value (a button when it can be edited) and the remove button, whose
 * 16 glyph has a 24 hit area. Sent, inside a message, it is a Default Tag
 * (2212:143). */
export function DetailTag({
  state = "editable",
  children,
  icon: Icon,
  onRemove,
  removeLabel = "Remove",
  onEdit,
  editLabel,
  className,
  "data-demo-state": demoState,
}: DetailTagProps) {
  if (state === "sent") {
    return (
      <span className={cx("ui-tag ui-detail-tag", className)} data-kind="default" data-state="sent">
        {Icon && <Icon size={16} className="ui-icon" aria-hidden />}
        <span className="t-label-xs">{children}</span>
      </span>
    );
  }
  return (
    <span
      className={cx("ui-fill ui-chip ui-detail-tag", className)}
      data-state="editable"
      data-demo-state={demoState}
    >
      {Icon && <Icon size={16} className="ui-icon" aria-hidden />}
      {onEdit ? (
        <button
          type="button"
          aria-label={editLabel}
          onClick={onEdit}
          className="ui-reset ui-ring ui-detail-tag__value t-label-s"
        >
          {children}
        </button>
      ) : (
        <span className="ui-detail-tag__value t-label-s">{children}</span>
      )}
      <button
        type="button"
        aria-label={removeLabel}
        onClick={onRemove}
        className="ui-reset ui-ring ui-detail-tag__remove"
      >
        <X size={16} className="ui-icon" aria-hidden />
      </button>
    </span>
  );
}

export type BadgeTone =
  "positive" | "active" | "neutral" | "error" | "warning" | "blue" | "purple" | "pink" | "warm";

export interface BadgeProps {
  /** Positive for connected integrations, Active for live links, Neutral
   * for everything else that names a state, Error and Warning for a
   * problem. Blue, Purple, Pink and Warm stand for a chart series. */
  tone: BadgeTone;
  /** A leading icon, drawn at 16. */
  icon?: IconComponent;
  children: React.ReactNode;
  className?: string;
}

/** Badge (Figma 2212:130): a 24 pill in Label/XS naming a state. Text, not
 * a control. */
export function Badge({ tone, icon: Icon, children, className }: BadgeProps) {
  return (
    <span className={cx("ui-badge", className)} data-tone={tone}>
      {Icon && <Icon size={16} className="ui-icon" aria-hidden />}
      <span className="t-label-xs">{children}</span>
    </span>
  );
}
