import React from "react";
import { cx } from "./cx";

export interface TooltipProps {
  /** The point ("Tue, Sep 8"). */
  label: React.ReactNode;
  /** The reading ("56 exports"). */
  value: React.ReactNode;
  className?: string;
}

/** Tooltip (Figma 58:434): the chart tooltip, label then value. The chart
 * places it; it has no behavior of its own. (The hint bubble beside a
 * control is Tooltip.tsx, which has no Master component.) */
export function Tooltip({ label, value, className }: TooltipProps) {
  return (
    <div className={cx("ui-tooltip", className)} role="tooltip">
      <span className="t-caption-s ui-tooltip__label">{label}</span>
      <span className="t-label-s">{value}</span>
    </div>
  );
}

export interface ToastProps {
  message: React.ReactNode;
  /** The optional action ("Undo"). */
  actionLabel?: string;
  onAction?(): void;
  className?: string;
}

/** Toast (Figma 58:431): a confirmation with an optional action. A polite
 * status, so it is read out without taking focus. The action is a text
 * button with the hover tint and the 2px-out ring (the file draws plain
 * text; PHASE-2 §8). */
export function Toast({ message, actionLabel, onAction, className }: ToastProps) {
  return (
    <div className={cx("ui-toast", className)} role="status">
      <span className="t-body-s">{message}</span>
      {actionLabel && (
        <button
          type="button"
          onClick={onAction}
          className="ui-reset ui-tint ui-ring ui-toast__action"
        >
          <span className="t-button-m">{actionLabel}</span>
        </button>
      )}
    </div>
  );
}
