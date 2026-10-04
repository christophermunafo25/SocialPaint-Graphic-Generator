import React from "react";
import { cx, type DemoStateAttr, type IconComponent } from "./cx";

export interface NavItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconComponent;
  /** The page showing; sets aria-current="page". */
  selected?: boolean;
  "data-demo-state"?: DemoStateAttr;
}

/** Nav item (Figma 54:83): a sidebar row. Selected takes state/selected,
 * label and icon in full ink; focus is the 2px-out ring. */
export const NavItem = React.forwardRef<HTMLButtonElement, NavItemProps>(function NavItem(
  { icon: Icon, selected = false, className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-current={selected ? "page" : undefined}
      className={cx("ui-reset ui-tint ui-ring ui-nav-item", className)}
      data-selected={selected || undefined}
      {...rest}
    >
      <Icon size={18} className="ui-icon" aria-hidden />
      <span className="t-label-m">{children}</span>
    </button>
  );
});

/** Settings rail item (Figma 54:100): a Nav item on the page, so Selected
 * takes control/fill, and its focus ring sits against the edge. */
export const SettingsRailItem = React.forwardRef<HTMLButtonElement, NavItemProps>(
  function SettingsRailItem(
    { icon: Icon, selected = false, className, children, type = "button", ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        aria-current={selected ? "page" : undefined}
        className={cx("ui-reset ui-tint ui-ring-tight ui-nav-item ui-rail-item", className)}
        data-selected={selected || undefined}
        {...rest}
      >
        <Icon size={18} className="ui-icon" aria-hidden />
        <span className="t-label-m">{children}</span>
      </button>
    );
  },
);

export interface AvatarProps {
  /** One or two letters. */
  initials: string;
  /** Large (38, with a hairline) is the sidebar account; Default is 32. */
  size?: "lg" | "default";
  /** Square is the workspace tile. */
  shape?: "circle" | "square";
  /** The name it stands for, when nothing beside it says so. Without it the
   * avatar is decorative. */
  label?: string;
  className?: string;
}

/** Avatar (Figma 54:62): initials on surface/sunken. */
export function Avatar({
  initials,
  size = "default",
  shape = "circle",
  label,
  className,
}: AvatarProps) {
  return (
    <span
      className={cx("ui-avatar t-label-xs", className)}
      data-size={size}
      data-shape={shape}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      {initials}
    </span>
  );
}
