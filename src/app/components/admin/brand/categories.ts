// The two-step studio's category table: order, display names, and the
// counts the overview shows. The `typography` route key survives from the
// accordion era and displays as "Fonts" (D4).

import type { BrandAsset } from "@/lib/types";
import type { BrandCategory } from "../../../router";
import type { BrandDraft } from "./kitPlumbing";

/** Overview order (D3). */
export const CATEGORY_ORDER: readonly BrandCategory[] = [
  "colors",
  "logos",
  "typography",
  "type-styles",
  "images",
  "import",
];

export const CATEGORY_TITLES: Record<BrandCategory, string> = {
  colors: "Colors",
  logos: "Logos",
  typography: "Fonts",
  "type-styles": "Type styles",
  images: "Images",
  import: "Import",
};

/** The rows the Fonts page shows: the heading face, the body face (one row
 * when they are the same family), then uploaded font assets not already
 * listed as one of the faces. The overview's FONTS count matches. */
export function fontRowCount(draft: BrandDraft["draft"], assets: BrandAsset[]): number {
  const fontAssets = assets.filter((a) => a.kind === "font");
  const headingFamily = draft.headingFont?.family;
  const bodyFamily = draft.bodyFont?.family;
  const faceRows = headingFamily && bodyFamily && headingFamily === bodyFamily ? 1 : 2;
  const listed = new Set(
    [draft.headingFont, draft.bodyFont]
      .filter((f) => f?.source === "custom")
      .map((f) => f?.assetId),
  );
  return faceRows + fontAssets.filter((a) => !listed.has(a.id)).length;
}

/** The overview card's mono count line. Zero anywhere reads "EMPTY"; Import
 * has no count and names its sources instead. */
export function categoryCount(
  category: BrandCategory,
  draft: BrandDraft["draft"],
  assets: BrandAsset[],
): string {
  const n = (count: number, noun: string) => (count === 0 ? "EMPTY" : `${count} ${noun}`);
  switch (category) {
    case "colors":
      return n(draft.colors.length, "COLORS");
    case "logos":
      return n(assets.filter((a) => a.kind === "logo").length, "LOGOS");
    case "typography":
      return n(fontRowCount(draft, assets), "FONTS");
    case "type-styles":
      return n(draft.typeStyles.length, "STYLES");
    case "images":
      return n(assets.filter((a) => a.kind === "image").length, "IMAGES");
    case "import":
      return "FIGMA OR JSON";
  }
}
