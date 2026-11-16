import React from "react";
import { LOCKUP_MARK, LOCKUP_VIEWBOX, LOCKUP_WORDMARK, MARK } from "./brandArt";

/** The SocialPaint mark alone (Logo Mark, 61:467): the four-field mark, 20
 * square in the file, in text/secondary. Drawn inline on currentColor, so
 * it follows the theme it sits in. Generate's assistant byline and the
 * public link page's footer place it; each keeps its size. */
export function BrandMark({ width = 20 }: { width?: number }) {
  return (
    <svg
      className="sp-brand-mark"
      width={width}
      height={width}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
      focusable="false"
    >
      <path d={MARK} fillRule="evenodd" clipRule="evenodd" />
    </svg>
  );
}

/** The lockup (Logo, 54:66): the mark and the wordmark in one colour,
 * text/primary, so it reads dark in Light and white in Dark (CJ,
 * 2026-11-15: as every frame draws it). Drawn inline on currentColor and
 * sized by height. Shared by the sidebar, the mobile bar, the sign-in gate
 * and onboarding. */
export function BrandLockup({
  height = 16,
  scheme,
}: {
  height?: number;
  /** A surface that keeps one theme whatever the app's (the Light gate,
   * PHASE-8B §9 D1) names it; otherwise the lockup follows the theme it
   * sits in. */
  scheme?: "light" | "dark";
}) {
  const width = Math.round(((height * LOCKUP_VIEWBOX.width) / LOCKUP_VIEWBOX.height) * 100) / 100;
  return (
    <svg
      className="sp-brand-lockup"
      data-theme={scheme}
      width={width}
      height={height}
      viewBox={`0 0 ${LOCKUP_VIEWBOX.width} ${LOCKUP_VIEWBOX.height}`}
      fill="currentColor"
      role="img"
      aria-label="SocialPaint"
      focusable="false"
    >
      <path d={LOCKUP_MARK} fillRule="evenodd" clipRule="evenodd" />
      {LOCKUP_WORDMARK.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}
