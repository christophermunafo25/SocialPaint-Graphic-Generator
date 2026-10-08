import React from "react";
import { useColorScheme } from "@/lib/colorScheme";
import mark from "@/assets/socialpaint/mark.svg";
import logoOnLight from "@/assets/socialpaint/logo-on-light.svg";
import logoOnDark from "@/assets/socialpaint/logo-on-dark.svg";

/** The SocialPaint mark — the monogram from the brand refresh (2026-08-17),
 * redrawn in Slime #17FF7E for the 2026-09 palette (a 40×40 cut of the
 * same path the lockups carry). One file for both themes: the mark reads
 * in Slime on light and dark alike, so it does not flip with the colour
 * scheme. Used where the full lockup doesn't fit (collapsed nav, dashboard
 * watermark, the Generate chat's assistant byline, sign-in, onboarding,
 * public footer). */
export function BrandMark({ width = 28 }: { width?: number }) {
  return <img src={mark} alt="" aria-hidden style={{ width, height: "auto", display: "block" }} />;
}

/** The official horizontal lockup (2026-09, 244×44) — Slime mark + wordmark,
 * the wordmark in near-black #0B0B0C on light chrome and white on dark.
 * Rendered by height with width auto, so the aspect ratio lives in the
 * file. Shared by the sidebar, the sign-in gate and onboarding. */
export function BrandLockup({
  height = 16,
  scheme,
}: {
  height?: number;
  /** A surface that keeps one theme whatever the app's (the Light gate,
   * PHASE-8B §9 D1) names it; otherwise the lockup follows the app. */
  scheme?: "light" | "dark";
}) {
  return scheme ? (
    <LockupImage height={height} scheme={scheme} />
  ) : (
    <ThemedLockup height={height} />
  );
}

function ThemedLockup({ height }: { height: number }) {
  const { resolved } = useColorScheme();
  return <LockupImage height={height} scheme={resolved === "dark" ? "dark" : "light"} />;
}

function LockupImage({ height, scheme }: { height: number; scheme: "light" | "dark" }) {
  return (
    <img
      src={scheme === "dark" ? logoOnDark : logoOnLight}
      alt="SocialPaint"
      style={{ height, width: "auto", display: "block" }}
    />
  );
}
