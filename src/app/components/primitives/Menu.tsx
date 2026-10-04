import React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronRight } from "lucide-react";
import { cx, type DemoStateAttr, type IconComponent } from "./cx";

export interface MenuProps {
  /** The control that opens it (a RowMenuTrigger, an AttachButton, a
   * Filter). It gets aria-haspopup and aria-expanded from Radix. */
  trigger: React.ReactElement;
  children: React.ReactNode;
  align?: "start" | "center" | "end";
  side?: "top" | "bottom";
  open?: boolean;
  onOpenChange?(open: boolean): void;
  /** Floor on the panel's width (the file draws 200). */
  minWidth?: number;
  "aria-label"?: string;
}

/** Menu (Figma 57:423) on Radix dropdown-menu: Enter, Space or ArrowDown
 * open it, the arrows move (focus is the hover look), Escape closes it and
 * hands focus back to the trigger. */
export function Menu({
  trigger,
  children,
  align = "start",
  side = "bottom",
  open,
  onOpenChange,
  minWidth,
  "aria-label": ariaLabel,
}: MenuProps) {
  return (
    <DropdownMenu.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="ui-menu ui-menu--popover"
          align={align}
          side={side}
          sideOffset={4}
          collisionPadding={8}
          aria-label={ariaLabel}
          style={minWidth ? { minWidth } : undefined}
        >
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export interface MenuItemContentProps {
  icon?: IconComponent;
  children: React.ReactNode;
  /** A quiet second label at the trailing end ("Optional"). */
  meta?: React.ReactNode;
  /** A chevron, for an item that opens more. */
  chevron?: boolean;
  /** The current choice: state/selected with a check. */
  selected?: boolean;
}

function MenuItemContent({ icon: Icon, children, meta, chevron, selected }: MenuItemContentProps) {
  return (
    <>
      {Icon && <Icon size={18} className="ui-icon" aria-hidden />}
      <span className="ui-menu-item__label t-body-s t-trim">{children}</span>
      {meta && <span className="ui-menu-item__meta t-caption-s t-trim">{meta}</span>}
      {chevron && <ChevronRight size={16} className="ui-icon ui-menu-item__chevron" aria-hidden />}
      {selected && <Check size={16} className="ui-icon" aria-hidden />}
    </>
  );
}

export interface MenuItemProps extends MenuItemContentProps {
  onSelect?(event: Event): void;
  disabled?: boolean;
  className?: string;
}

/** Menu item (Figma 96:507): 34 tall, hover and keyboard focus take
 * state/hover, the current choice state/selected with a check. */
export function MenuItem({ onSelect, disabled, className, ...content }: MenuItemProps) {
  return (
    <DropdownMenu.Item
      className={cx("ui-menu-item", className)}
      onSelect={onSelect}
      disabled={disabled}
      data-selected={content.selected || undefined}
    >
      <MenuItemContent {...content} />
    </DropdownMenu.Item>
  );
}

/** Menu label (Figma 57:419): a group's heading inside a menu. */
export function MenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <DropdownMenu.Label className="ui-menu-label t-label-xs t-trim">{children}</DropdownMenu.Label>
  );
}

/** Menu divider (Figma 57:421). */
export function MenuDivider() {
  return <DropdownMenu.Separator className="ui-menu-divider" />;
}

/** A Menu's panel and rows without the menu behind them, for a static
 * picture of a menu (/dev/ui). Real menus use Menu and MenuItem. */
export function MenuPanel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cx("ui-menu", className)}>{children}</div>;
}
export function MenuItemStatic({
  className,
  "data-demo-state": demoState,
  ...content
}: MenuItemContentProps & { className?: string; "data-demo-state"?: DemoStateAttr }) {
  return (
    <div
      className={cx("ui-menu-item", className)}
      data-selected={content.selected || undefined}
      data-demo-state={demoState}
    >
      <MenuItemContent {...content} />
    </div>
  );
}
export function MenuLabelStatic({ children }: { children: React.ReactNode }) {
  return <div className="ui-menu-label t-label-xs t-trim">{children}</div>;
}
