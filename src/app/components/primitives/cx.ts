/** Joins class names, skipping empty ones. */
export const cx = (...names: Array<string | false | null | undefined>): string =>
  names.filter(Boolean).join(" ");

/** A demo state /dev/ui can set on a primitive (data-demo-state). */
export type DemoStateAttr = "hover" | "pressed" | "selected" | "open" | "focus";

/** The icon slot: a lucide icon (or any component taking size). The
 * primitive sets the size the file draws: 16 in controls at lucide's own
 * stroke, and 18 in navigation at a 1.5 stroke (the file's 1.125 px). */
export type IconComponent = React.ComponentType<{
  size?: number | string;
  strokeWidth?: number | string;
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
}>;
