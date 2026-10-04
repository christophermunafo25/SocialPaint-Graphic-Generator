import type { DemoStateAttr } from "@/app/components/primitives/cx";
import type { DemoState } from "./statesTable";

/** The data-demo-state a table cell sets: none for Static, and none for the
 * states a component shows through its own props (selected, on). */
export const demo = (state: DemoState): DemoStateAttr | undefined =>
  state === "static" || state === "on" ? undefined : state;
