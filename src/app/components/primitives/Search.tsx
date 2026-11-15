import React, { useRef } from "react";
import { Search as SearchIcon, X } from "lucide-react";
import { cx, type DemoStateAttr } from "./cx";

export interface SearchProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "size" | "type" | "value" | "onChange"
> {
  value: string;
  onChange(next: string): void;
  /** Clears the query; the field keeps focus. Without it, clearing calls
   * onChange with an empty string. */
  onClear?(): void;
  /** The accessible name of the field. */
  label: string;
  clearLabel?: string;
  "data-demo-state"?: DemoStateAttr;
}

/** Search (Figma 2207:455): a field that is always open, 36 tall on
 * surface/field, with the search icon before the query and a clear button
 * while it holds one. It goes where search is the main control of a panel
 * or picker; the collapsing one in a filter bar is SearchField. `className`
 * and the demo state go to the box, and everything else to the input. */
export const Search = React.forwardRef<HTMLInputElement, SearchProps>(function Search(
  {
    value,
    onChange,
    onClear,
    label,
    clearLabel = "Clear search",
    className,
    "data-demo-state": demoState,
    ...rest
  },
  ref,
) {
  const inner = useRef<HTMLInputElement | null>(null);
  return (
    <span
      className={cx("ui-fill ui-ring ui-input ui-input--box", className)}
      data-size="md"
      data-demo-state={demoState}
    >
      <SearchIcon size={16} className="ui-icon ui-input__icon" aria-hidden />
      <input
        ref={(el) => {
          inner.current = el;
          if (typeof ref === "function") ref(el);
          else if (ref) ref.current = el;
        }}
        type="search"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="ui-reset ui-input__control"
        {...rest}
      />
      {value !== "" && (
        <button
          type="button"
          aria-label={clearLabel}
          onClick={() => {
            if (onClear) onClear();
            else onChange("");
            inner.current?.focus();
          }}
          className="ui-reset ui-ring ui-input__clear"
        >
          <X size={16} className="ui-icon" aria-hidden />
        </button>
      )}
    </span>
  );
});
