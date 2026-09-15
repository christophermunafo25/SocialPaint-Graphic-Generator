import React from "react";

interface TagProps {
  /** "solid" is the one tag look (D13); "off" outlines an unselected
   * option inside editors only. */
  tone?: "solid" | "off";
  /** The same tag sitting on imagery or an arbitrary tenant colour takes
   * the fixed deep scrim (N5) so its glyphs stay legible on any swatch. */
  onMedia?: boolean;
  children: React.ReactNode;
}

/** The studio tag: a 14px mono pill. Presentation only — for a tag that
 * acts as a radio or checkbox, use TagChoice. */
export function Tag({ tone = "solid", onMedia = false, children }: TagProps) {
  const cls =
    tone === "off"
      ? "sp-tag--solid sp-tag--off"
      : onMedia
        ? "sp-tag--solid sp-tag--on-media"
        : "sp-tag--solid";
  return <span className={cls}>{children}</span>;
}
