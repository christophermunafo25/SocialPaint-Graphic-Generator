import React from "react";
import { useColorScheme } from "@/lib/colorScheme";
import mark from "@/assets/socialpaint/mark.svg";
import logoOnLight from "@/assets/socialpaint/logo-on-light.svg";
import logoOnDark from "@/assets/socialpaint/logo-on-dark.svg";

/** The SocialPaint mark — the Voltage monogram from the brand refresh
 * (2026-08-17). One file for both themes: the mark reads in Voltage on
 * light and dark alike, exactly as it does inside the lockup, so it no
 * longer flips with the colour scheme. Used where the full lockup doesn't
 * fit (collapsed nav, dashboard watermark, Generate hero). */
export function BrandMark({ width = 28 }: { width?: number }) {
  return <img src={mark} alt="" aria-hidden style={{ width, height: "auto", display: "block" }} />;
}

/** The official horizontal lockup — Voltage mark + wordmark, the wordmark
 * in Ink on light chrome and White on dark. Shared by the sidebar and the
 * sign-in page. */
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
