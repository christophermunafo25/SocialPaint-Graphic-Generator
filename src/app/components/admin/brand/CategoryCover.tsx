import React from "react";
import type { BrandAsset, BrandTypeStyle } from "@/lib/types";
import { roleStyle } from "@/lib/brand/fontRoles";
import type { BrandCategory } from "../../../router";
import { SignedImg } from "../../SignedImg";
import { logoSurfaces, type LogoSurface } from "./kitOps";
import type { KitShape } from "./kitPlumbing";

/** What an overview card's cover draws (premium polish D15): the
 * workspace's own content once its category has some, on a fixed plate
 * that never inverts with the theme, and the shared SocialPaint art for an
 * empty category and for Import. */
export type Cover =
  | { kind: "art" }
  | { kind: "colors"; hexes: string[] }
  | { kind: "logo"; asset: BrandAsset; plate: LogoSurface }
  | { kind: "font"; family: string }
  | { kind: "styles"; styles: BrandTypeStyle[] }
  | { kind: "images"; assets: BrandAsset[] };

/** The most of each a cover shows. */
export const COVER_LIMIT = { colors: 6, styles: 2, images: 3 } as const;

/** The logo a cover shows and the plate under it: the primary for light
 * grounds on the light plate, else the primary for dark grounds on the
 * dark plate, else the first logo on the plate its tag asks for (light
 * when it shows on both). */
function coverLogo(
  draft: KitShape,
  logos: BrandAsset[],
): { asset: BrandAsset; plate: LogoSurface } {
  const shows = (a: BrandAsset, s: LogoSurface) => logoSurfaces(a).includes(s);
  const byId = (id: string | undefined) => (id ? logos.find((a) => a.id === id) : undefined);
  const light = byId(draft.primaryLogoLightAssetId ?? draft.primaryLogoAssetId);
  if (light && shows(light, "light")) return { asset: light, plate: "light" };
  const dark = byId(draft.primaryLogoDarkAssetId ?? draft.primaryLogoAssetId);
  if (dark && shows(dark, "dark")) return { asset: dark, plate: "dark" };
  const first = logos[0];
  return { asset: first, plate: shows(first, "light") ? "light" : "dark" };
}

/** Which cover a category gets, from what the overview counts for it, so a
 * cover and its count line always agree. Pure, so every state is testable. */
export function coverFor(category: BrandCategory, draft: KitShape, assets: BrandAsset[]): Cover {
  const ofKind = (kind: BrandAsset["kind"]) => assets.filter((a) => a.kind === kind);
  switch (category) {
    case "colors":
      return draft.colors.length
        ? { kind: "colors", hexes: draft.colors.slice(0, COVER_LIMIT.colors).map((c) => c.hex) }
        : { kind: "art" };
    case "logos": {
      const logos = ofKind("logo");
      return logos.length ? { kind: "logo", ...coverLogo(draft, logos) } : { kind: "art" };
    }
    case "typography": {
      // Fonts counts the uploaded files; its cover sets "Aa" in the
      // heading's face, else in the first file's family.
      const fonts = ofKind("font");
      if (!fonts.length) return { kind: "art" };
      // The first file's family reads as the Fonts page reads it: its
      // metadata, else its name.
      const family =
        roleStyle(draft, "heading")?.font?.family ?? fonts[0].metadata.family ?? fonts[0].name;
      return { kind: "font", family };
    }
    case "type-styles":
      return draft.typeStyles.length
        ? { kind: "styles", styles: draft.typeStyles.slice(0, COVER_LIMIT.styles) }
        : { kind: "art" };
    case "images": {
      const images = ofKind("image");
      return images.length
        ? { kind: "images", assets: images.slice(0, COVER_LIMIT.images) }
        : { kind: "art" };
    }
    case "import":
      return { kind: "art" };
  }
}

/** A tenant face for the Fonts cover's "Aa": the workspace's family, never
 * chrome type (built here, as the Fonts page builds its own specimen's). */
function familyFace(family: string): React.CSSProperties {
  return { fontFamily: `"${family}", sans-serif` };
}

/** A type style's face for a specimen line: its family, weight, italic,
 * width and case. Its size never comes along (the cover sets one for each
 * line), and nothing here reaches chrome text: the face sits on the line
 * alone. */
function specimenFace(style: BrandTypeStyle): React.CSSProperties {
  return {
    fontFamily: style.font ? `"${style.font.family}", sans-serif` : undefined,
    fontWeight: style.weight,
    fontStyle: style.fontStyle,
    fontStretch: style.fontStretch,
    textTransform: style.uppercase ? "uppercase" : undefined,
  };
}

/** The cover's content: the shared art, or the workspace's own. Decoration
 * (the card's link names the category), so it is hidden from assistive
 * tech. */
export function CategoryCover({ cover, art }: { cover: Cover; art: string }) {
  switch (cover.kind) {
    case "art":
      return <img src={art} alt="" />;
    case "colors":
      return (
        <span className="sp-bs-cover" data-kind="colors" aria-hidden>
          {cover.hexes.map((hex, i) => (
            <span key={i} className="sp-bs-cover__swatch" style={{ background: hex }} />
          ))}
        </span>
      );
    case "logo":
      return (
        <span className="sp-bs-cover" data-kind="logo" data-plate={cover.plate} aria-hidden>
          <SignedImg src={cover.asset.url} alt="" />
        </span>
      );
    case "font":
      return (
        <span className="sp-bs-cover" data-kind="font" aria-hidden>
          <span className="sp-bs-cover__aa" style={familyFace(cover.family)}>
            Aa
          </span>
        </span>
      );
    case "styles":
      return (
        <span className="sp-bs-cover" data-kind="styles" aria-hidden>
          {cover.styles.map((style, i) => (
            <span
              key={style.key}
              className="sp-bs-cover__line"
              data-line={i === 0 ? "first" : "second"}
              style={specimenFace(style)}
            >
              {style.name}
            </span>
          ))}
        </span>
      );
    case "images":
      return (
        <span className="sp-bs-cover" data-kind="images" aria-hidden>
          {cover.assets.map((asset) => (
            <SignedImg key={asset.id} src={asset.url} alt="" />
          ))}
        </span>
      );
  }
}
