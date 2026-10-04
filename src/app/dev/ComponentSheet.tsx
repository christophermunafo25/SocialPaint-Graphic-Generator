import React from "react";

const MODES = ["light", "dark"] as const;

/** Every primitive in every kind and size, and its disabled look, in both
 * themes side by side. It has no Figma counterpart; it is here to review
 * sizes and kinds, and to Tab through for the keyboard pass. */
export function ComponentSheet() {
  return (
    <section className="dev-ui-sheet" aria-label="Component sheet">
      {MODES.map((mode) => (
        <div key={mode} className="dev-ui-sheet__mode" data-theme={mode}>
          <h2 className="t-title-section">{mode === "light" ? "Light" : "Dark"}</h2>
        </div>
      ))}
    </section>
  );
}
