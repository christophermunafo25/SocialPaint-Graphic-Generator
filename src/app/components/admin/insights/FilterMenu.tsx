import React from "react";
import { Filter, Menu, MenuItem } from "../../primitives";

export interface FilterOption {
  /** null is "all" (the filter's first entry). */
  value: string | null;
  label: string;
}

/** One of Insights' filters (13:911): the Filter primitive opening a menu
 * of choices, the current one checked. Choosing one replaces the filter in
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
    <Menu
      aria-label={name}
      minWidth={200}
      trigger={<Filter aria-label={`${name}: ${current.label}`}>{current.label}</Filter>}
    >
      {options.map((o) => (
        <MenuItem
          key={o.value ?? "all"}
          selected={o.value === current.value}
          onSelect={() => onChange(o.value)}
        >
          {o.label}
        </MenuItem>
      ))}
    </Menu>
  );
}
