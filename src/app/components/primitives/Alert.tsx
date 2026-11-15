import React from "react";
import { cx } from "./cx";

export interface AlertProps {
  /** Neutral is a notice, Warning something to act on soon, and Error
   * something that failed. */
  tone?: "neutral" | "error" | "warning";
  /** What happened, in Label/M. */
  title: React.ReactNode;
  /** What to do about it, in Body/M. */
  children?: React.ReactNode;
  className?: string;
}

/** Alert (Figma 2215:302): a message set into the page at radius/md, 16
 * around a title and a line under it. The tone colors the ground and the
 * title; the message stays on text/primary. An error is announced as soon
 * as it shows, and the other tones when the reader gets to them. */
export function Alert({ tone = "neutral", title, children, className }: AlertProps) {
  return (
    <div
      className={cx("ui-alert", className)}
      data-tone={tone}
      role={tone === "error" ? "alert" : "status"}
    >
      <p className="t-label-m ui-alert__title">{title}</p>
      {children && <p className="t-body-m ui-alert__message">{children}</p>}
    </div>
  );
}
