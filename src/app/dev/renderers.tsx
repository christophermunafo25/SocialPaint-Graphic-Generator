import type React from "react";
import type { DemoState } from "./statesTable";

/** Each Interaction states row's primitive, in a given state, keyed by the
 * row's name. Rows without an entry render empty cells. */
export const RENDERERS: Record<string, (state: DemoState) => React.ReactNode> = {};
