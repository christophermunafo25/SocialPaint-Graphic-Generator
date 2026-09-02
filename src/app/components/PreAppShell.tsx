import React from "react";

/** The pre-app shell — sign in, account creation, and first-run onboarding
 * all render through it (Figma 148:1421, "Login Page Dark"). A 584px form
 * panel on the left, a Voltage hero panel taking the remainder on the
 * right; the split is a grid, so the 1920 frame is the reference rather
 * than the only viewport (.sp-gate holds the tiers).
 *
 * The shell takes the form column's contents as children and nothing else.
 * It does not know which screen it is showing. Two layouts:
 *
 *  - "split" — the front door. Forces the dark token set on its own root:
 *    data-theme scopes the tokens locally, so ColorSchemeProvider and the
 *    stored preference are untouched, and the app flips to the user's own
 *    theme the moment onboarding finishes (expected, 2026-09-02).
 *  - "solo" — the same panel, centred, no hero, themed like the app. The
 *    in-app "Create company" path, which is a task, not a doorway.
 *
 * `hero` is the image cropped into the right panel, flush right with a
 * band of Voltage exposed on the left (a frame detail, not a bug). Absent,
 * the panel is flat Voltage — no placeholder ever ships in its place. The
 * image is decorative and loads after the form: alt="", lazy, never
 * preloaded or raised in priority. */
export function PreAppShell({
  children,
  hero,
  layout = "split",
}: {
  children: React.ReactNode;
  hero?: string;
  layout?: "split" | "solo";
}) {
  const split = layout === "split";
  return (
    <div className="sp-gate" data-layout={layout} data-theme={split ? "dark" : undefined}>
      <main className="sp-gate__panel">{children}</main>
      {split && (
        <div className="sp-gate__hero" aria-hidden>
          {hero && <img src={hero} alt="" loading="lazy" decoding="async" />}
        </div>
      )}
    </div>
  );
}
