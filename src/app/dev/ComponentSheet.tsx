import React from "react";
import { SHEET_GROUPS } from "./sheetGroups";

const MODES = ["light", "dark"] as const;

/** The working sheet under the boards, in both themes side by side: the
 * keyboard ring held on every control, live controls to click and Tab
 * through, and the Product components that keep their earlier look until
 * their own phases. It has no Figma counterpart. */
export function ComponentSheet() {
  return (
    <section className="dev-ui-sheet" aria-label="Working sheet">
      {MODES.map((mode) => (
        <div key={mode} className="dev-ui-sheet__mode" data-theme={mode}>
          <h2 className="t-title-section">{mode === "light" ? "Light" : "Dark"}</h2>
          {SHEET_GROUPS.map((group) => (
            <div key={group.title} className="dev-ui-sheet__group">
              <h3 className="t-title-group">{group.title}</h3>
              {group.render()}
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}
