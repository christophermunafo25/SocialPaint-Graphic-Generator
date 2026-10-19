import React from "react";
import { BrandLockup } from "./BrandMark";
import { AuthPanel } from "./auth/AuthPanel";
import { PRIVACY, TERMS } from "@/lib/legal";

/** The way in: the sign-in gate and onboarding (new look, Phase 8b; Figma
 * 194:2 and 257:2). A column (the logo, the form centred between two
 * flexible spacers, the legal links) beside the sp-auth-panel art and the
 * card centred on it. Always Light (PHASE-8B §9 D1): the root carries
 * data-theme, so the app's stored theme is untouched and takes over once
 * the person is in. The panel narrows from 1440 to 1024 and goes below
 * (D7). Styles are in src/styles/auth.css. */
export function PreAppShell({
  children,
  panel,
  width = "form",
}: {
  children: React.ReactNode;
  /** The card on the art: the gate's composer, onboarding's workspace
   * preview. */
  panel?: React.ReactNode;
  /** "form" is the gate's 400 column, "wide" onboarding's 480. */
  width?: "form" | "wide";
}) {
  return (
    <div className="sp-auth" data-theme="light" data-width={width}>
      <div className="sp-auth__column">
        <header className="sp-auth__header">
          <BrandLockup height={26} scheme="light" />
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
