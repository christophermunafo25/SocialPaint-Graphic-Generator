import React from "react";
import { cx, type DemoStateAttr } from "./cx";
import { Skeleton } from "./Skeleton";

/** The rows of one table. It gives them their table semantics and needs a
 * name: aria-label or aria-labelledby. */
export function Table({
  children,
  className,
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}) {
  return (
    <div role="table" className={cx("ui-table", className)} {...rest}>
      {children}
    </div>
  );
}

/** A value cell after the primary one: 64 wide in Mono/M. `quiet` sets it
 * on text/secondary, for the lesser of two figures. */
export function TableCell({
  children,
  quiet = false,
}: {
  children: React.ReactNode;
  quiet?: boolean;
}) {
  return (
    <span role="cell" className="t-mono-m ui-table-row__value" data-quiet={quiet || undefined}>
      {children}
    </span>
  );
}

interface TableRowShared {
  className?: string;
  "data-demo-state"?: DemoStateAttr;
}

export type TableRowProps = TableRowShared &
  (
    | {
        loading?: false;
        title: React.ReactNode;
        subtitle?: React.ReactNode;
        /** The value cells: TableCell elements. */
        children?: React.ReactNode;
        /** The row's action: a Neutral Small button. */
        action?: React.ReactNode;
        /** Makes the row itself a control: it takes focus and opens on a
         * click, Enter or Space. A click on its action is the action's. */
        onClick?(): void;
      }
    | {
        /** Loading keeps the row's height and shows the shape of each
         * cell. */
        loading: true;
        /** How many value cells are coming. */
        cells?: number;
        /** Whether an action is coming. */
        action?: boolean;
      }
  );

const fromControl = (e: React.SyntheticEvent): boolean =>
  e.target instanceof Element &&
  e.target !== e.currentTarget &&
  e.target.closest("button, a, input, select, textarea") !== null;

/** Table row (Figma 2215:270): 52 tall at radius/sm with 12 around it and
 * 24 between cells. The primary cell takes the room: a title in Label/M
 * over a subtitle in Caption/M. Value cells and one action follow. The row
 * takes state/hover under the pointer. It goes inside a Table. */
export function TableRow(props: TableRowProps) {
  if (props.loading) {
    const { cells = 2, action = true, className } = props;
    return (
      <div role="row" className={cx("ui-table-row", className)} data-loading>
        <span role="cell" className="ui-table-row__primary" aria-hidden>
          <Skeleton width={160} height={10} />
          <Skeleton width={96} height={8} />
        </span>
        {Array.from({ length: cells }, (_, i) => (
          <span key={i} role="cell" className="ui-table-row__value" aria-hidden>
            <Skeleton width={40} height={10} />
          </span>
        ))}
        {action && (
          <span role="cell" className="ui-table-row__action" aria-hidden>
            <Skeleton width={72} height={28} radius="sm" />
          </span>
        )}
      </div>
    );
  }
  const { title, subtitle, children, action, onClick, className } = props;
  return (
    <div
      role="row"
      className={cx("ui-ring ui-table-row", className)}
      data-demo-state={props["data-demo-state"]}
      data-interactive={onClick ? "" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={
        onClick &&
        ((e) => {
          if (!fromControl(e)) onClick();
        })
      }
      onKeyDown={
        onClick &&
        ((e) => {
          if (fromControl(e) || (e.key !== "Enter" && e.key !== " ")) return;
          e.preventDefault();
          onClick();
        })
      }
    >
      <span role="cell" className="ui-table-row__primary">
        <span className="t-label-m ui-table-row__title">{title}</span>
        {subtitle && <span className="t-caption-m ui-table-row__subtitle">{subtitle}</span>}
      </span>
      {children}
      {action && (
        <span role="cell" className="ui-table-row__action">
          {action}
        </span>
      )}
    </div>
  );
}
