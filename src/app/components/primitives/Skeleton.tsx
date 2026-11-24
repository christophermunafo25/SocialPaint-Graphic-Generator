import React from "react";
import { cx } from "./cx";

/** The corner of what a skeleton stands in for, when it is not the shape's
 * own: a button's radius/sm, a message bubble's radius/lg, a badge's
 * radius/full. */
export type SkeletonRadius = "xs" | "sm" | "md" | "lg" | "full";

export interface SkeletonProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
  /** Line stands in for a line of text, Block for an image or a card and
   * Circle for an avatar. */
  shape?: "line" | "block" | "circle";
  /** In px, or any CSS length. A line and a block take their container's
   * width unless given one. */
  width?: number | string;
  height?: number | string;
  radius?: SkeletonRadius;
}

/** Skeleton (Figma 2215:286): the shape of what is loading, on
 * surface/skeleton, pulsing on motion/duration/pulse. Line is 12 tall at
 * radius/xs, Block 96 tall at radius/md and Circle 36 across. Give it the
 * size of what is coming, so nothing moves when the data lands.
 *
 * It is decoration. The region it sits in says it is busy, once
 * (role status, aria-busy and a label); a skeleton that carries its own
 * label is that region. */
export function Skeleton({
  shape = "line",
  width,
  height,
  radius,
  className,
  style,
  ...rest
}: SkeletonProps) {
  return (
    <span
      aria-hidden={rest["aria-label"] ? undefined : true}
      role={rest["aria-label"] ? "status" : undefined}
      {...rest}
      className={cx("ui-skeleton", className)}
      data-shape={shape}
      data-radius={radius}
      style={{ width, height: height ?? (shape === "circle" ? width : undefined), ...style }}
    />
  );
}

/** A short stack of lines, for a block of text that is loading (a settings
 * card, a form). The widths stagger so the stack reads as prose. */
export function SkeletonLines({
  lines = 3,
  label = "Loading",
}: {
  lines?: number;
  /** null when the region around it already says it is loading. */
  label?: string | null;
}) {
  return (
    <div
      className="ui-skeleton-lines"
      role={label ? "status" : undefined}
      aria-busy={label ? true : undefined}
      aria-label={label ?? undefined}
    >
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} width={`${[62, 44, 54, 36][i % 4]}%`} />
      ))}
    </div>
  );
}

/** List rows that are loading: a round mark and two lines a row, divided
 * like the rows they stand in for. `inset` is each row's padding. */
export function SkeletonRows({
  rows = 3,
  inset = "var(--space-12) var(--space-24)",
  label = "Loading",
}: {
  rows?: number;
  inset?: string;
  /** null when the region around it already says it is loading. */
  label?: string | null;
}) {
  return (
    <div
      className="ui-skeleton-rows"
      role={label ? "status" : undefined}
      aria-busy={label ? true : undefined}
      aria-label={label ?? undefined}
    >
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="ui-skeleton-row" style={{ padding: inset }}>
          <Skeleton shape="circle" width={26} />
          <div className="ui-skeleton-row__text">
            <Skeleton width={i % 2 ? "34%" : "42%"} />
            <Skeleton width={i % 2 ? "22%" : "28%"} height={10} />
          </div>
        </div>
      ))}
    </div>
  );
}
