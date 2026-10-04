import React from "react";
import { ChevronRight, LayoutGrid, Plus, X } from "lucide-react";
import { platformById, type PlatformId } from "@/lib/templates/platforms";
import { cx, type DemoStateAttr, type IconComponent } from "./cx";

type ButtonAttrs = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  "data-demo-state"?: DemoStateAttr;
};

/** Chip (Figma 98:515): a suggestion under a result, on the page. */
export const Chip = React.forwardRef<HTMLButtonElement, ButtonAttrs>(function Chip(
  { className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx("ui-reset ui-tint ui-ring-tight ui-chip", className)}
      {...rest}
    >
      <span className="t-button-s">{children}</span>
    </button>
  );
});

export interface ChoiceChipProps extends ButtonAttrs {
  /** Chosen: ink, with the label inverse. Sets aria-pressed. */
  selected: boolean;
}

/** Choice chip (Figma 98:532): one option in a set of choices, a toggle
 * button (aria-pressed). Its focus ring sits 2px out, as drawn. */
export const ChoiceChip = React.forwardRef<HTMLButtonElement, ChoiceChipProps>(function ChoiceChip(
  { selected, className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-pressed={selected}
      className={cx("ui-reset ui-tint ui-ring ui-choice-chip", className)}
      data-selected={selected || undefined}
      {...rest}
    >
      <span className="t-label-xs">{children}</span>
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
  /** Selected turns the chip ink, the mark Slime and the chevron down. */
  selected?: boolean;
  /** Its menu is open; the chevron points down. */
  expanded?: boolean;
}

/** Platform chip (Figma 53:96): a tile with the platform's mark, the label
 * and a chevron, 50 tall on control/fill. The caller gives it its role
 * (radio in a filter group) and its aria state. */
export const PlatformChip = React.forwardRef<HTMLButtonElement, PlatformChipProps>(
  function PlatformChip(
    { platform, selected = false, expanded = false, className, children, type = "button", ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cx("ui-reset ui-tint ui-ring-tight ui-platform-chip", className)}
        data-selected={selected || undefined}
        data-expanded={selected || expanded || undefined}
        {...rest}
      >
        <span className="ui-platform-chip__tile">
          <PlatformLogo platform={platform} />
        </span>
        <span className="t-button-m t-trim">{children}</span>
        <ChevronRight size={14} className="ui-icon ui-platform-chip__chevron" aria-hidden />
      </button>
    );
  },
);

export type TagKind = "default" | "overlay" | "filter" | "missing";

export interface TagProps extends ButtonAttrs {
  /** Default labels logos and fonts; Overlay sits on a colour or an image.
   * Both are text, not controls. Filter (a search suggestion) and Missing
   * (a field the template still needs) are buttons. */
  kind?: TagKind;
}

/** Tag (Figma 52:63). */
export const Tag = React.forwardRef<HTMLButtonElement, TagProps>(function Tag(
  { kind = "default", className, children, type = "button", ...rest },
  ref,
) {
  const textClass = kind === "overlay" ? "t-caption-xs" : "t-caption-s";
  if (kind === "default" || kind === "overlay") {
    return (
      <span className={cx("ui-tag", className)} data-kind={kind}>
        <span className={textClass}>{children}</span>
      </span>
    );
  }
  return (
    <button
      ref={ref}
      type={type}
      className={cx("ui-reset ui-tint ui-ring-tight ui-tag", className)}
      data-kind={kind}
      {...rest}
    >
      {kind === "missing" && <Plus size={10} className="ui-icon" aria-hidden />}
      <span className={textClass}>{children}</span>
    </button>
  );
});

export interface DetailTagProps {
  /** Editable is in the composer, with its remove button; Sent is how it
   * reads inside a sent message. */
  state?: "editable" | "sent";
  children: React.ReactNode;
  /** A leading icon, drawn at 15 as the frame draws it. */
  icon?: IconComponent;
  onRemove?(): void;
  /** The remove button's name, e.g. "Remove socialpaint.ai/careers". */
  removeLabel?: string;
  className?: string;
  "data-demo-state"?: DemoStateAttr;
}

/** Detail tag (Figma 61:464). Keyboard focus lands on the remove button,
 * whose ring sits 2px out around its 14 glyph; the hit area reaches 24. */
export function DetailTag({
  state = "editable",
  children,
  icon: Icon,
  onRemove,
  removeLabel = "Remove",
  className,
  "data-demo-state": demoState,
}: DetailTagProps) {
  return (
    <span
      className={cx("ui-tint ui-detail-tag", className)}
      data-state={state}
      data-demo-state={demoState}
    >
      {Icon && <Icon size={15} className="ui-icon" aria-hidden />}
      <span className="t-caption-s t-trim">{children}</span>
      {state === "editable" && (
        <button
          type="button"
          aria-label={removeLabel}
          onClick={onRemove}
          className="ui-reset ui-ring ui-detail-tag__remove"
        >
          <X size={14} className="ui-icon" aria-hidden />
        </button>
      )}
    </span>
  );
}

export interface StatusProps {
  /** Positive for connected integrations, Active for live links, Neutral for
   * everything else. */
  tone: "positive" | "active" | "neutral";
  size?: "default" | "sm";
  children: React.ReactNode;
  className?: string;
}

/** Status (Figma 52:51): a pill naming a state. Text, not a control. */
export function Status({ tone, size = "default", children, className }: StatusProps) {
  return (
    <span className={cx("ui-status", className)} data-tone={tone} data-size={size}>
      <span className={size === "sm" ? "t-label-xxs" : "t-label-xs"}>{children}</span>
    </span>
  );
}
