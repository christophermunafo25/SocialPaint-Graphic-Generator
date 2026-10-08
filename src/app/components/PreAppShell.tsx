import React from "react";
import { BrandLockup } from "./BrandMark";
import { AuthPanel } from "./auth/AuthPanel";
import { PRIVACY, TERMS } from "@/lib/legal";

/** The pre-app shell — sign in, account creation, and first-run onboarding
 * all render through it (Figma 148:1421, "Login Page Dark"). A 584px form
 * panel on the left, a Slime hero panel taking the remainder on the
 * right; the split is a grid, so the 1920 frame is the reference rather
 * than the only viewport (.sp-gate holds the tiers: the hero leaves at
 * --bp-xl rather than shrinking to a sliver).
 *
 * The shell takes the form column's contents as children and nothing else.
 * It does not know which screen it is showing. Two layouts and two tones:
 *
 *  - "split" — the front door: the panel beside the hero. Sign in, sign
 *    up, forgot, set password.
 *  - "solo" — the same panel alone, centred on the canvas, no hero. Once
 *    the user has hit Create account the picture has done its job: check
 *    email and first-run onboarding sit in the middle of the screen
 *    (2026-09-02, at Chris's direction), as does the in-app "Create
 *    company" task.
 *
 *  - tone "dark" (default) forces the dark token set on the shell's own
 *    root: data-theme scopes the tokens locally, so ColorSchemeProvider and
 *    the stored preference are untouched, and the app flips to the user's
 *    own theme the moment onboarding finishes (expected, 2026-09-02).
 *  - tone "app" themes with the app — the in-app "Create company" path,
 *    which is a task, not a doorway.
 *  - tone "light" forces the light token set the same way — the redesigned
 *    gate and first-run onboarding ("Auth · Gate Light", 2026-09-18).
 *
 * `backdrop` is the full-bleed orbit artwork behind the light card,
 * decorative like the hero: alt="", lazy, hidden below 768 in CSS.
 *
 * `hero` is the image cropped into the right panel, flush right with a
 * band of Slime exposed on the left (a frame detail, not a bug). Absent,
 * the panel is flat Slime — no placeholder ever ships in its place. The
 * shipped hero is Chris's own composition from the Figma file (2026-09-02),
 * the frame's window at 2× (1848×1738) as WebP without alpha: the corner
 * is the panel's job and the Slime behind the cut-out is flattened in.
 * The image is decorative and loads after the form: alt="", lazy, never
 * preloaded or raised in priority. */
export function PreAppShell({
  children,
  hero,
  backdrop,
  layout = "split",
  tone = "dark",
  width = "form",
  panel,
}: {
  children: React.ReactNode;
  hero?: string;
  backdrop?: string;
  /** "auth" is the new look's way in (PHASE-8B, Figma 194:2 and 257:2):
   * the logo, the form and the legal links in a column beside the art
   * panel, always Light. "split" and "solo" are the earlier layouts, kept
   * until nothing renders them (PHASE-8B §9 D9). */
  layout?: "split" | "solo" | "auth";
  /** The card the auth layout's panel centres on its art: the gate's
   * composer, onboarding's workspace preview. */
  panel?: React.ReactNode;
  tone?: "dark" | "app" | "light";
  /** "form" is the 584 column of the auth frames; "wide" is the 1220 card
   * of the onboarding frames (154:1576 → 158:267), whose 833 content column
   * holds the four-up swatch grid. In the auth layout, "form" is the gate's
   * 400 column and "wide" onboarding's 480. */
  width?: "form" | "wide";
}) {
  if (layout === "auth") {
    return (
      <div className="sp-auth" data-theme="light" data-width={width}>
        <div className="sp-auth__column">
          <header className="sp-auth__header">
            <BrandLockup height={24} scheme="light" />
          </header>
          <main className="sp-auth__form">{children}</main>
          <footer className="sp-auth__footer t-caption-s">
            <a className="sp-auth__legal" href={TERMS.href}>
              {TERMS.label}
            </a>
            <a className="sp-auth__legal" href={PRIVACY.href}>
              {PRIVACY.label}
            </a>
          </footer>
        </div>
        <AuthPanel>{panel}</AuthPanel>
      </div>
    );
  }
  const split = layout === "split";
  return (
    <div
      className="sp-gate"
      data-layout={layout}
      data-width={width}
      data-theme={tone === "app" ? undefined : tone}
    >
      {backdrop && (
        <img
          className="sp-gate__backdrop"
          src={backdrop}
          alt=""
          loading="lazy"
          decoding="async"
          aria-hidden
        />
      )}
      <main className="sp-gate__panel">{children}</main>
      {split && (
        <div className="sp-gate__hero" aria-hidden>
          {hero && <img src={hero} alt="" loading="lazy" decoding="async" />}
        </div>
      )}
    </div>
  );
}
