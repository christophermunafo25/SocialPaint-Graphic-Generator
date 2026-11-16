import React from "react";
import logoOnDark from "@/assets/socialpaint/logo-on-dark.svg";
import logoOnLight from "@/assets/socialpaint/logo-on-light.svg";
import { MARK } from "./brandArt";

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

/** The lockup's box in CJ's files: 220 by 40. */
const LOCKUP_RATIO = 220 / 40;

/** The lockup: the gradient mark with its grain beside the wordmark, from
 * CJ's two files (2026-11-16). They differ only in the wordmark, light for
 * Dark and dark for Light, so the lockup draws both and shell.css shows the
 * one for the nearest [data-theme], as the theme toggle shows its glyph.
 * Sized by height. Shared by the sidebar, the mobile bar, the sign-in gate
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
  const width = Math.round(height * LOCKUP_RATIO * 100) / 100;
  // The hidden file is display: none, so only the shown one is named.
  return (
    <span className="sp-brand-lockup" data-theme={scheme}>
      <img
        className="sp-brand-lockup__on-light"
        src={logoOnLight}
        width={width}
        height={height}
        alt="SocialPaint"
        draggable={false}
      />
      <img
        className="sp-brand-lockup__on-dark"
        src={logoOnDark}
        width={width}
        height={height}
        alt="SocialPaint"
        draggable={false}
      />
    </span>
  );
}
