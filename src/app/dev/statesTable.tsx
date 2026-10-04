import type React from "react";

/** A state a cell shows. "static" renders with no demo state; the rest set
 * data-demo-state on the primitive, or the prop that state stands for
 * (selected, on, open). */
export type DemoState = "static" | "hover" | "pressed" | "selected" | "open" | "on" | "focus";

/** The surface a cell sits on: the token the frame fills it with. */
export type CellSurface = "raised" | "page" | "sunken" | "track";

export interface StateCell {
  state: DemoState;
  caption: string;
}

/** An empty cell, captioned as the frame captions it. */
export interface EmptyCell {
  empty: string;
}

export interface StateRow {
  /** The row label, verbatim from the frame. */
  name: string;
  /** The caption under the label, verbatim from the frame. */
  caption: string;
  surface: CellSurface;
  cells: [
    StateCell | EmptyCell,
    StateCell | EmptyCell,
    StateCell | EmptyCell,
    StateCell | EmptyCell,
  ];
  /** Renders the primitive in a state. Absent until the primitive exists. */
  render?: (state: DemoState) => React.ReactNode;
}

export interface FamilyRow {
  family: string;
}

const cells = (
  third: StateCell | EmptyCell,
  fourth: StateCell | EmptyCell = { state: "focus", caption: "Focus" },
): StateRow["cells"] => [
  { state: "static", caption: "Static" },
  { state: "hover", caption: "Hover" },
  third,
  fourth,
];
const pressed = { state: "pressed", caption: "Pressed" } as const;
const selected = { state: "selected", caption: "Selected" } as const;
const open = { state: "open", caption: "Open" } as const;
const noSelected = { empty: "No selected state" } as const;
const focusLikeHover = { state: "hover", caption: "Focus looks like hover" } as const;

/** The Interaction states table (Figma 105:641), row by row: labels and
 * captions verbatim, the surface each cell sits on, and the state each
 * column shows. renderers.tsx supplies `render` for each built primitive. */
export const STATE_ROWS: Array<FamilyRow | StateRow> = [
  { family: "Buttons" },
  {
    name: "Button · Primary",
    caption: "button/primary-bg, then state/hover-inverse and state/pressed-inverse",
    surface: "raised",
    cells: cells(pressed),
  },
  {
    name: "Button · Neutral",
    caption: "Inside cards: surface/sunken, then state/hover and state/pressed",
    surface: "raised",
    cells: cells(pressed),
  },
  {
    name: "Button · Neutral on page",
    caption: "On the page: control/fill, then state/hover and state/pressed",
    surface: "page",
    cells: cells(pressed),
  },
  {
    name: "Button · Destructive",
    caption: "state/error, then state/hover-on-color and state/pressed-on-color",
    surface: "raised",
    cells: cells(pressed),
  },
  {
    name: "Send button",
    caption: "accent/green in both modes, then state/hover-on-color and state/pressed-on-color",
    surface: "raised",
    cells: cells(pressed),
  },
  {
    name: "Attach button",
    caption: "surface/inverse, then state/hover-inverse and state/pressed-inverse",
    surface: "raised",
    cells: cells(pressed),
  },
  { family: "Icon buttons" },
  {
    name: "Icon button · Filled",
    caption: "surface/sunken, then state/hover and state/pressed",
    surface: "raised",
    cells: cells(pressed),
  },
  {
    name: "Icon button · Ghost",
    caption: "state/hover, then state/selected with the icon in text/strong",
    surface: "raised",
    cells: cells(selected),
  },
  {
    name: "Row menu trigger",
    caption: "state/hover, then surface/sunken while its menu is open",
    surface: "raised",
    cells: cells(open),
  },
  {
    name: "Theme toggle",
    caption: "surface/sunken, then state/hover and state/pressed",
    surface: "raised",
    cells: cells(pressed),
  },
  {
    name: "Stepper button",
    caption: "state/hover, then state/pressed, on the stepper track",
    surface: "sunken",
    cells: cells(pressed),
  },
  { family: "Chips and tags" },
  {
    name: "Chip",
    caption: "control/fill, then state/hover and state/pressed",
    surface: "page",
    cells: cells(pressed),
  },
  {
    name: "Choice chip",
    caption: "surface/sunken and state/hover, then surface/inverse with text/inverse",
    surface: "raised",
    cells: cells(selected),
  },
  {
    name: "Platform chip",
    caption: "control/fill and state/hover, then chip/selected-bg",
    surface: "page",
    cells: cells(selected),
  },
  {
    name: "Tag · Filter",
    caption: "surface/sunken, then state/hover",
    surface: "page",
    cells: cells(noSelected),
  },
  {
    name: "Detail tag",
    caption: "surface/page, then state/hover",
    surface: "raised",
    cells: cells(noSelected),
  },
  { family: "Fields and pickers" },
  {
    name: "Input",
    caption: "input/fill and state/hover, then the caret while focused",
    surface: "raised",
    cells: cells(
      { state: "focus", caption: "Focused" },
      { state: "focus", caption: "Focus shows the caret" },
    ),
  },
  {
    name: "Select",
    caption: "input/fill and state/hover, then state/pressed while open",
    surface: "raised",
    cells: cells(open),
  },
  {
    name: "Compact select",
    caption: "surface/sunken and state/hover, then state/pressed while open",
    surface: "raised",
    cells: cells(open),
  },
  {
    name: "Filter",
    caption: "control/fill and state/hover, then state/pressed while open",
    surface: "page",
    cells: cells(open),
  },
  {
    name: "Search field",
    caption: "control/fill and state/hover, then the open field",
    surface: "page",
    cells: cells(open),
  },
  { family: "Toggles" },
  {
    name: "Switch",
    caption: "switch/track-off and state/hover, then switch/track-on",
    surface: "raised",
    cells: cells({ state: "on", caption: "On" }),
  },
  {
    name: "Segment",
    caption: "state/hover over control/track, then control/thumb with Elevation/Thumb",
    surface: "track",
    cells: cells(selected),
  },
  {
    name: "Tab",
    caption: "state/hover over control/track, then control/thumb with Elevation/Thumb",
    surface: "track",
    cells: cells(selected),
  },
  { family: "Navigation and menus" },
  {
    name: "Nav item",
    caption: "state/hover, then state/selected with the label in text/strong",
    surface: "raised",
    cells: cells(selected),
  },
  {
    name: "Settings rail item",
    caption: "state/hover, then control/fill with the label in text/strong",
    surface: "page",
    cells: cells(selected),
  },
  {
    name: "Menu item",
    caption: "state/hover, then state/selected with a check",
    surface: "raised",
    cells: cells(selected, focusLikeHover),
  },
  { family: "Previews" },
  {
    name: "Result card",
    caption: "The preview dims under overlay/hover and shows the Edit button",
    surface: "page",
    cells: cells(noSelected, focusLikeHover),
  },
  {
    name: "Look tile",
    caption: "A border/strong ring on hover, then a text/strong ring",
    surface: "sunken",
    cells: cells(selected),
  },
];

export const isFamily = (row: FamilyRow | StateRow): row is FamilyRow => "family" in row;
export const isEmptyCell = (cell: StateCell | EmptyCell): cell is EmptyCell => "empty" in cell;
