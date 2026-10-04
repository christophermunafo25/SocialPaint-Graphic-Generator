import React from "react";
import { ChevronDown } from "lucide-react";
import { cx, type DemoStateAttr } from "./cx";

export interface FilterProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** The current filter's label ("Last 30 days"). */
  children: React.ReactNode;
  "data-demo-state"?: DemoStateAttr;
}

/** Filter (Figma 99:547): a dropdown trigger on control/fill, for the page.
 * The caller opens its menu and passes aria-haspopup and aria-expanded;
 * while open it holds the pressed tint. */
export const Filter = React.forwardRef<HTMLButtonElement, FilterProps>(function Filter(
  { children, className, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx("ui-reset ui-tint ui-ring ui-filter", className)}
      {...rest}
    >
      <span className="t-control-m">{children}</span>
      <ChevronDown size={14} className="ui-icon" aria-hidden />
    </button>
  );
});
