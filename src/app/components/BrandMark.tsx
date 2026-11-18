import React from "react";
import { LOCKUP_MARK, LOCKUP_MARK_SIZE, LOCKUP_VIEWBOX, LOCKUP_WORDMARK, MARK } from "./brandArt";

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

/** The lockup (CJ's update in the Sidebar, 6243:8529): the mark beside the
 * wordmark, drawn inline on currentColor in --logo-ink, so one lockup is
 * near-black on Light and off-white on Dark. Sized by height. Shared by
 * the sidebar, the mobile bar, the sign-in gate and onboarding. */
export function BrandLockup({
  height = 16,
  scheme,
}: {
  height?: number;
  /** A surface that keeps one theme whatever the app's (the Light gate,
   * PHASE-8B §9 D1) names it; the nested theme recomputes --logo-ink.
   * Otherwise the lockup follows the theme it sits in. */
  scheme?: "light" | "dark";
}) {
  const { width: w, height: h } = LOCKUP_VIEWBOX;
  const width = Math.round(((height * w) / h) * 100) / 100;
  return (
    <span className="sp-brand-lockup" data-theme={scheme}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${w} ${h}`}
        fill="currentColor"
        role="img"
        aria-label="SocialPaint"
        focusable="false"
      >
        <path d={LOCKUP_MARK} />
        {LOCKUP_WORDMARK.map((d) => (
          <path key={d.slice(0, 24)} d={d} />
        ))}
      </svg>
    </span>
  );
}

/** The lockup's mark alone (the collapsed rail's Logo mark, 6112:44073),
 * the same path at the size the rail draws it, in --logo-ink. */
export function BrandLockupMark() {
  return (
    <svg
      className="sp-brand-lockup-mark"
      width={LOCKUP_MARK_SIZE}
      height={LOCKUP_MARK_SIZE}
      viewBox={`0 0 ${LOCKUP_MARK_SIZE} ${LOCKUP_MARK_SIZE}`}
      fill="currentColor"
      aria-hidden
      focusable="false"
    >
      <path d={LOCKUP_MARK} />
    </svg>
  );
}
