import React from "react";
import "./devUi.css";
import { ComponentSheet } from "./ComponentSheet";
import { RENDERERS } from "./renderers";
import { STATE_ROWS, isEmptyCell, isFamily, type StateRow } from "./statesTable";

/** The header rules of the Interaction states table (105:642), verbatim. */
const RULES = [
  "Static is the confirmed look of each element, in Light and Dark.",
  "Hover lays state/hover over the element: ink at 5% in Light and white at 6% in Dark. Fills that flip between modes, like the primary button, take state/hover-inverse, and Slime or red fills take state/hover-on-color. Hover changes nothing else.",
  "Pressed is for actions and doubles the tint.",
  "Selected is for things that stay chosen. Its fill depends on the surface underneath: state/selected on raised surfaces, control/fill on the page, the thumb in a track, and ink for chips. The label goes to full ink. Open menus and focused fields count as selected, and a selected item keeps its look on hover.",
  "Disabled is 40% opacity with no hover. Previews dim under Deep Moss at 35% with the Edit button on hover, and picker tiles take a ring.",
  "Focus is the code’s keyboard ring: a 1px line of focus/ring, ink in Light and white in Dark. Most elements draw it 2px outside the edge; chips, tags, track items, rail items and look tiles draw it against the edge. Text fields show the caret, and menu items and previews show their hover look.",
];

const MODES = ["light", "dark"] as const;
const STATE_HEADS = ["Static", "Hover", "Selected or pressed", "Focus"];

function Row({ row }: { row: StateRow }) {
  const render = RENDERERS[row.name];
  return (
    <div className="dev-ui-row">
      <div className="dev-ui-row__label">
        <span className="t-label-l">{row.name}</span>
        <span className="t-caption-m dev-ui-row__caption">{row.caption}</span>
      </div>
      {MODES.map((mode) => (
        <div key={mode} className="dev-ui-row__mode" data-theme={mode}>
          {row.cells.map((cell, i) =>
            isEmptyCell(cell) ? (
              <div key={i} className="dev-ui-cell dev-ui-cell--empty">
                <span className="t-caption-s dev-ui-cell__caption">{cell.empty}</span>
              </div>
            ) : (
              <div key={i} className="dev-ui-cell" data-surface={row.surface}>
                <div className="dev-ui-cell__element">{render?.(cell.state)}</div>
                <span className="t-caption-s dev-ui-cell__caption">{cell.caption}</span>
              </div>
            ),
          )}
        </div>
      ))}
    </div>
  );
}

/** /dev/ui (development builds only): the Figma file's Interaction states
 * table rebuilt from the primitives, 3172 wide like the frame, then the
 * component sheet. The table pins its own themes (Light columns, Dark
 * columns), so it reads the same whatever theme the app is in. */
export function DevUiPage() {
  return (
    <div className="dev-ui">
      <section className="dev-ui-states" data-theme="light" aria-label="Interaction states">
        <header className="dev-ui-states__header">
          <h1 className="t-title-page">Interaction states</h1>
          <div className="dev-ui-states__rules">
            {RULES.map((rule) => (
              <p key={rule} className="t-body-m">
                {rule}
              </p>
            ))}
          </div>
        </header>
        <div className="dev-ui-table">
          <div className="dev-ui-row dev-ui-row--head">
            <div className="dev-ui-row__label dev-ui-row__label--head">
              <span className="t-label-m">Element</span>
            </div>
            {MODES.map((mode) => (
              <div key={mode} className="dev-ui-row__mode dev-ui-row__mode--head" data-theme={mode}>
                <span className="t-label-l">{mode === "light" ? "Light" : "Dark"}</span>
                <div className="dev-ui-row__states">
                  {STATE_HEADS.map((s) => (
                    <span key={s} className="t-caption-m">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {STATE_ROWS.map((row) =>
            isFamily(row) ? (
              <div key={row.family} className="dev-ui-row dev-ui-row--family">
                <div className="dev-ui-row__label dev-ui-row__label--family">
                  <h2 className="t-title-card">{row.family}</h2>
                </div>
                {MODES.map((mode) => (
                  <div key={mode} className="dev-ui-row__mode" data-theme={mode} />
                ))}
              </div>
            ) : (
              <Row key={row.name} row={row} />
            ),
          )}
        </div>
      </section>
      <ComponentSheet />
    </div>
  );
}
