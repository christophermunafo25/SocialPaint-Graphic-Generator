import React from "react";
import { Select } from "../../primitives";

export interface FilterOption {
  /** null is "all" (the filter's first entry). */
  value: string | null;
  label: string;
}

/** The select's value for "all": its options are strings. */
const ALL = "";

/** One of Insights' filters (6095:1036): a Select 159 wide, the current
 * choice checked in its list. Choosing one replaces the filter in
 * the URL. */
export function FilterMenu({
  name,
  value,
  options,
  onChange,
}: {
  /** "Date range", "Template": names the control for assistive tech. */
  name: string;
  value: string | null;
  options: FilterOption[];
  onChange(value: string | null): void;
}) {
  const current = options.find((o) => o.value === value) ?? options[0];
  return (
    <Select
      className="sp-in-filter"
      ariaLabel={name}
      value={current.value ?? ALL}
      options={options.map((o) => ({ value: o.value ?? ALL, label: o.label }))}
      onSelect={(next) => onChange(next === ALL ? null : next)}
      menuMinWidth={200}
    />
  );
}
