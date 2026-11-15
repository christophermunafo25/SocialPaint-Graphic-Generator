import React from "react";
import { Switch } from "../../primitives";

/** A setting as one line of text beside its switch (13:14756): the label
 * names the switch; no description under it (PHASE-7 §9). */
export function SwitchRow({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange(next: boolean): void;
}) {
  return (
    <div className="sp-st-switch-row">
      <span className="tu-body-m">{label}</span>
      <Switch checked={checked} disabled={disabled} onChange={onChange} ariaLabel={label} />
    </div>
  );
}

/** The local backend's notice: a section that depends on the Supabase
 * backend says so, in one quiet line, instead of rendering a button that
 * fails (PHASE-7 §9 D11). */
export function DevBackendNotice({ children }: { children: React.ReactNode }) {
  return <p className="tu-body-m sp-st-notice">{children}</p>;
}
