import React from "react";
import { cx, type IconComponent } from "./cx";

export interface EmptyStateProps {
  /** Drawn at 18 on a 44 tile. */
  icon: IconComponent;
  /** What is missing, in Title/Card. */
  title: React.ReactNode;
  /** What to do next, in Body/M on text/secondary. */
  children?: React.ReactNode;
  /** One action: a Primary Medium button. */
  action?: React.ReactNode;
  className?: string;
}

/** Empty state (Figma 2215:304): what a list or a page shows before it
 * holds anything. An icon tile, a title, a line and one action, centered
 * and 20 apart with 32 around them. */
export function EmptyState({ icon: Icon, title, children, action, className }: EmptyStateProps) {
  return (
    <div className={cx("ui-empty", className)}>
      <span className="ui-empty__tile" aria-hidden>
        <Icon size={18} strokeWidth={1.5} className="ui-icon" aria-hidden />
      </span>
      <p className="t-title-card ui-empty__title">{title}</p>
      {children && <p className="t-body-m ui-empty__body">{children}</p>}
      {action}
    </div>
  );
}
