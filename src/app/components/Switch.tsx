import React from "react";

/** App-wide on/off switch — the design system's core Switch pattern (pill
 * track, sliding knob, hidden native checkbox with switch semantics) built
 * on platform tokens; see .sp-switch in socialpaint.css. The label column
 * usually lives outside (PropertyRow); `label` is for standalone uses. */
export function Switch({
  checked,
  onChange,
  disabled = false,
  ariaLabel,
  label,
}: {
  checked: boolean;
  onChange(next: boolean): void;
  disabled?: boolean;
  ariaLabel?: string;
  label?: React.ReactNode;
}) {
  return (
    <label className="sp-switch" data-disabled={disabled || undefined}>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="sp-switch__track" aria-hidden>
        <span className="sp-switch__knob" />
      </span>
      {label}
    </label>
  );
}
