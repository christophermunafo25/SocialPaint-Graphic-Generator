import React from "react";
import { Tag } from "./Tag";

interface TagChoiceProps {
  /** "radio" inside a role="radiogroup" parent, "checkbox" standalone. */
  role: "radio" | "checkbox";
  checked: boolean;
  /** For a radio this is always called with true; for a checkbox, with the
   * toggled value. The caller owns refusals (e.g. "at least one surface"). */
  onChange(next: boolean): void;
  disabled?: boolean;
  children: React.ReactNode;
}

/** A tag acting as a radio or checkbox: solid when checked, outlined when
 * not, with `aria-checked` carrying the state so colour is never the only
 * signal. The pill is 14px; a pseudo-element grows the hit area to 24px. */
export function TagChoice({ role, checked, onChange, disabled = false, children }: TagChoiceProps) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={checked}
      disabled={disabled}
      className="sp-tag-choice"
      onClick={() => onChange(role === "radio" ? true : !checked)}
    >
      <Tag tone={checked ? "solid" : "off"}>{children}</Tag>
    </button>
  );
}
