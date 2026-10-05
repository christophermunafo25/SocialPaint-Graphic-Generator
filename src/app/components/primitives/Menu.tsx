import React, { useRef } from "react";
import * as ContextMenu from "@radix-ui/react-context-menu";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronRight } from "lucide-react";
import { cx, type DemoStateAttr, type IconComponent } from "./cx";
import { RowMenuTrigger } from "./IconButton";

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

/** One action in a row's menu. `checked` present (true or false) makes it a
 * radio item with a check on the current one; `destructive` draws it in the
 * error red (an action Undo can't bring back, PHASE-6 §9 D6). */
export interface RowMenuAction {
  label: string;
  onSelect(): void;
  disabled?: boolean;
  destructive?: boolean;
  checked?: boolean;
  /** The action moves focus itself (it opens an editor), so the menu
   * doesn't hand focus back to its trigger as it closes. */
  movesFocus?: boolean;
}

/** A group of actions, with an optional label above it; groups are
 * separated by a divider. */
export interface RowMenuGroup {
  label?: string;
  items: RowMenuAction[];
}

type MenuKit = {
  Item: typeof DropdownMenu.Item;
  Label: typeof DropdownMenu.Label;
  Separator: typeof DropdownMenu.Separator;
};

const DROPDOWN: MenuKit = DropdownMenu;
const CONTEXT: MenuKit = ContextMenu as unknown as MenuKit;

function RowMenuItems({
  groups,
  kit,
  onChosen,
}: {
  groups: RowMenuGroup[];
  kit: MenuKit;
  onChosen(item: RowMenuAction): void;
}) {
  return (
    <>
      {groups.map((g, gi) => (
        <React.Fragment key={gi}>
          {gi > 0 && <kit.Separator className="ui-menu-divider" />}
          {g.label && <kit.Label className="ui-menu-label t-label-xs t-trim">{g.label}</kit.Label>}
          {g.items.map((item) => (
            <kit.Item
              key={item.label}
              className="ui-menu-item"
              disabled={item.disabled}
              // Only a choice overrides Radix's own role: an explicit
              // undefined would erase "menuitem".
              {...(item.checked !== undefined
                ? { role: "menuitemradio", "aria-checked": item.checked }
                : {})}
              data-selected={item.checked || undefined}
              data-destructive={item.destructive || undefined}
              onSelect={() => {
                onChosen(item);
                item.onSelect();
              }}
            >
              <MenuItemContent selected={item.checked}>{item.label}</MenuItemContent>
            </kit.Item>
          ))}
        </React.Fragment>
      ))}
    </>
  );
}

/** A row's "More actions" menu (Row menu trigger 44:29 and Menu 57:423):
 * the ellipsis trigger, shown at rest, and its menu, aligned to the
 * trigger's end. Wrap the row in `RowContextMenu` with the same groups so
 * a right-click opens the same menu at the pointer (PHASE-6 §9 D7). */
export function RowMenu({
  groups,
  label,
  className,
}: {
  groups: RowMenuGroup[];
  /** Names the trigger and the menu: "More actions for Montserrat". */
  label: string;
  className?: string;
}) {
  const chosen = useRef<RowMenuAction | null>(null);
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <RowMenuTrigger label={label} className={className} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="ui-menu ui-menu--popover"
          align="end"
          sideOffset={4}
          collisionPadding={8}
          aria-label={label}
          onCloseAutoFocus={(e) => {
            if (chosen.current?.movesFocus) e.preventDefault();
            chosen.current = null;
          }}
        >
          <RowMenuItems groups={groups} kit={DROPDOWN} onChosen={(i) => (chosen.current = i)} />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/** Right-click on `children` (a card or row) opens its menu at the pointer,
 * as the trigger's does: the arrows move, Escape closes. */
export function RowContextMenu({
  groups,
  label,
  children,
  disabled = false,
}: {
  groups: RowMenuGroup[];
  label: string;
  /** One element; it receives the context-menu handler. */
  children: React.ReactElement;
  /** While the row is being edited, the browser's own menu shows instead. */
  disabled?: boolean;
}) {
  const chosen = useRef<RowMenuAction | null>(null);
  return (
    <ContextMenu.Root modal={false}>
      <ContextMenu.Trigger asChild disabled={disabled}>
        {children}
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content
          className="ui-menu ui-menu--popover"
          collisionPadding={8}
          aria-label={label}
          onCloseAutoFocus={(e) => {
            if (chosen.current?.movesFocus) e.preventDefault();
            chosen.current = null;
          }}
        >
          <RowMenuItems groups={groups} kit={CONTEXT} onChosen={(i) => (chosen.current = i)} />
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
