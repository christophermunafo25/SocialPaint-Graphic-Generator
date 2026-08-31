import React from "react";
import mark from "@/assets/socialpaint/mark.svg";

/** The SocialPaint mark — the Voltage monogram from the brand refresh
 * (2026-08-17). One file for both themes: the mark reads in Voltage on
 * light and dark alike, exactly as it does inside the lockup, so it no
 * longer flips with the colour scheme. Used where the full lockup doesn't
 * fit (collapsed nav, dashboard watermark, Generate hero). */
export function BrandMark({ width = 28 }: { width?: number }) {
  return <img src={mark} alt="" aria-hidden style={{ width, height: "auto", display: "block" }} />;
}
