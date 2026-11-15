import React from "react";
import { cx, type DemoStateAttr, type IconComponent } from "./cx";

export interface NavItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconComponent;
  /** The page showing; sets aria-current="page". */
  selected?: boolean;
  /** Off in the collapsed rail (the component's Show label boolean): the
   * row is the icon alone, 38 wide, and the label becomes its accessible
   * name. The caller adds the tooltip. */
  showLabel?: boolean;
  "data-demo-state"?: DemoStateAttr;
}

/** Nav item (Figma 54:83): a sidebar row. Selected takes state/selected,
 * label and icon in full ink; focus is the 2px-out ring. */
export const NavItem = React.forwardRef<HTMLButtonElement, NavItemProps>(function NavItem(
  { icon: Icon, selected = false, showLabel = true, className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-current={selected ? "page" : undefined}
      aria-label={!showLabel && typeof children === "string" ? children : undefined}
      className={cx("ui-reset ui-tint ui-ring ui-nav-item", className)}
      data-selected={selected || undefined}
      data-icon-only={!showLabel || undefined}
      {...rest}
    >
      <Icon size={18} className="ui-icon" aria-hidden />
      {showLabel && <span className="tu-label-m">{children}</span>}
    </button>
  );
});

/** Settings rail item (Figma 54:100): a Nav item on the page, so Selected
 * takes control/fill, and its focus ring sits against the edge. */
export interface SettingsRailItemProps extends Omit<NavItemProps, "onClick"> {
  onClick?: React.MouseEventHandler<HTMLElement>;
  /** A real link (cmd-click opens the section in a new tab); the caller's
   * onClick handles the in-app click. Without it the item is a button. */
  href?: string;
}

export const SettingsRailItem = React.forwardRef<HTMLElement, SettingsRailItemProps>(
  function SettingsRailItem(
    { icon: Icon, selected = false, className, children, type = "button", href, ...rest },
    ref,
  ) {
    const shared = {
      "aria-current": selected ? ("page" as const) : undefined,
      className: cx("ui-reset ui-tint ui-ring-tight ui-nav-item ui-rail-item", className),
      "data-selected": selected || undefined,
    };
    const content = (
      <>
        <Icon size={18} className="ui-icon" aria-hidden />
        <span className="tu-label-m">{children}</span>
      </>
    );
    if (href !== undefined) {
      return (
        <a
          ref={ref as React.Ref<HTMLAnchorElement>}
          href={href}
          {...shared}
          {...(rest as unknown as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
        >
          {content}
        </a>
      );
    }
    return (
      <button ref={ref as React.Ref<HTMLButtonElement>} type={type} {...shared} {...rest}>
        {content}
      </button>
    );
  },
);

export interface AvatarProps {
  /** One or two letters. */
  initials: string;
  /** Small 28, Medium 36, Large 44. Every avatar the screens place is
   * Medium. */
  size?: "sm" | "md" | "lg";
  /** Square is the workspace tile. */
  shape?: "circle" | "square";
  /** The name it stands for, when nothing beside it says so. Without it the
   * avatar is decorative. */
  label?: string;
  className?: string;
}

const AVATAR_TEXT = { sm: "t-label-xs", md: "t-label-s", lg: "t-label-m" } as const;

/** Avatar (Figma 2212:214): initials on surface/sunken with a hairline
 * edge, in Label/XS, Label/S or Label/M by size. */
export function Avatar({ initials, size = "md", shape = "circle", label, className }: AvatarProps) {
  return (
    <span
      className={cx("ui-avatar", className)}
      data-size={size}
      data-shape={shape}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      <span className={AVATAR_TEXT[size]}>{initials}</span>
    </span>
  );
}
