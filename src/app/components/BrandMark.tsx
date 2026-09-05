import React from "react";
import { useColorScheme } from "@/lib/colorScheme";
import mark from "@/assets/socialpaint/mark.svg";
import logoOnLight from "@/assets/socialpaint/logo-on-light.svg";
import logoOnDark from "@/assets/socialpaint/logo-on-dark.svg";

/** The SocialPaint mark — the monogram from the brand refresh (2026-08-17).
 * One file for both themes: the mark reads in the brand green on light and
 * dark alike, so it does not flip with the colour scheme. Used where the
 * full lockup doesn't fit (collapsed nav, dashboard watermark, Generate
 * hero). NOTE (2026-09 palette): mark.svg is still drawn in the pre-lock
 * green #9BFF49, not Slime #17FF7E, so it will not match the lockups until
 * a Slime version lands — no replacement was supplied with the palette. */
export function BrandMark({ width = 28 }: { width?: number }) {
  return <img src={mark} alt="" aria-hidden style={{ width, height: "auto", display: "block" }} />;
}

/** The official horizontal lockup (2026-09, 244×44) — Slime mark + wordmark,
 * the wordmark in near-black #0B0B0C on light chrome and white on dark.
 * Rendered by height with width auto, so the aspect ratio lives in the
 * file. Shared by the sidebar and the sign-in page. */
export function BrandLockup({ height = 16 }: { height?: number }) {
  const { resolved } = useColorScheme();
  return (
    <img
      src={resolved === "dark" ? logoOnDark : logoOnLight}
      alt="SocialPaint"
      style={{ height, width: "auto", display: "block" }}
    />
  );
}
