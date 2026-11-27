import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import type { BrandAsset, BrandTypeStyle } from "@/lib/types";
import type { KitShape } from "./kitPlumbing";

// SignedImg signs private storage URLs; the cover only needs an img.
vi.mock("../../SignedImg", () => ({
  SignedImg: ({ src }: { src: string }) => <img src={src} alt="" />,
}));

const { CategoryCover, coverFor } = await import("./CategoryCover");
const { categoryCount } = await import("./categories");

const T0 = "2026-11-25T10:00:00.000Z";
const asset = (
  id: string,
  kind: BrandAsset["kind"],
  metadata: Partial<BrandAsset["metadata"]> = {},
): BrandAsset => ({
  id,
  companyId: "co-1",
  kind,
  name: id,
  url: `https://cdn.example/${id}`,
  metadata: metadata as BrandAsset["metadata"],
  createdAt: T0,
});
const style = (
  key: string,
  family: string,
  over: Partial<BrandTypeStyle> = {},
): BrandTypeStyle => ({
  key,
  name: key[0].toUpperCase() + key.slice(1),
  font: { family, source: "custom" },
  ...over,
});
const kit = (over: Partial<KitShape> = {}): KitShape =>
  ({ colors: [], typeStyles: [], ...over }) as unknown as KitShape;
const COLORS = ["#2F3B4C", "#E7EAEF", "#C9A227", "#1A1F26", "#F6F7F9", "#FF0000", "#00FF00"].map(
  (hex, i) => ({ key: `c${i}`, name: `Color ${i}`, hex }),
);

describe("coverFor: an empty category, and Import, keep the shared art", () => {
  it("draws the art for every empty category and always for Import", () => {
    for (const category of ["colors", "logos", "typography", "type-styles", "images"] as const) {
      expect(coverFor(category, kit(), [])).toEqual({ kind: "art" });
    }
    expect(coverFor("import", kit({ colors: COLORS }), [asset("l1", "logo")])).toEqual({
      kind: "art",
    });
  });
});

describe("coverFor: a category with content draws its own cover", () => {
  it("Colors shows up to six swatches, in palette order", () => {
    const cover = coverFor("colors", kit({ colors: COLORS }), []);
    expect(cover).toEqual({ kind: "colors", hexes: COLORS.slice(0, 6).map((c) => c.hex) });
  });

  it("Logos shows the light primary on the light plate", () => {
    const logos = [asset("l1", "logo"), asset("l2", "logo")];
    const cover = coverFor("logos", kit({ primaryLogoLightAssetId: "l2" }), logos);
    expect(cover).toMatchObject({ kind: "logo", plate: "light", asset: { id: "l2" } });
  });

  it("Logos falls back to the dark primary on the dark plate, as its tag asks", () => {
    const logos = [asset("l1", "logo", { surfaces: ["dark"] })];
    const cover = coverFor("logos", kit({ primaryLogoDarkAssetId: "l1" }), logos);
    expect(cover).toMatchObject({ kind: "logo", plate: "dark", asset: { id: "l1" } });
  });

  it("Logos with no primary set shows the first logo on the plate its tag asks for", () => {
    expect(coverFor("logos", kit(), [asset("l1", "logo")])).toMatchObject({
      plate: "light",
      asset: { id: "l1" },
    });
    expect(coverFor("logos", kit(), [asset("l1", "logo", { surfaces: ["dark"] })])).toMatchObject({
      plate: "dark",
    });
  });

  it("Fonts sets Aa in the heading's face, else the first file's family", () => {
    const fonts = [asset("f1", "font", { family: "Acme Sans" })];
    const heading = style("heading", "Acme Display", { useFor: "heading" });
    expect(coverFor("typography", kit({ typeStyles: [heading] }), fonts)).toEqual({
      kind: "font",
      family: "Acme Display",
    });
    // A heading style with no face of its own falls back to the first file.
    const faceless = { ...heading, font: undefined };
    expect(coverFor("typography", kit({ typeStyles: [faceless] }), fonts)).toEqual({
      kind: "font",
      family: "Acme Sans",
    });
    // A file with no family read from it goes by its name, as the Fonts page does.
    expect(
      coverFor("typography", kit({ typeStyles: [faceless] }), [asset("Acme Serif.otf", "font")]),
    ).toEqual({ kind: "font", family: "Acme Serif.otf" });
  });

  it("Fonts keeps the art until a font file is uploaded, whatever the styles use", () => {
    const heading = style("heading", "Inter", { useFor: "heading" });
    expect(coverFor("typography", kit({ typeStyles: [heading] }), [])).toEqual({ kind: "art" });
  });

  it("Type styles shows the first two styles", () => {
    const styles = [style("heading", "A"), style("body", "B"), style("caption", "C")];
    const cover = coverFor("type-styles", kit({ typeStyles: styles }), []);
    expect(cover).toEqual({ kind: "styles", styles: styles.slice(0, 2) });
  });

  it("Images shows up to three photos", () => {
    const images = ["i1", "i2", "i3", "i4"].map((id) => asset(id, "image"));
    const cover = coverFor("images", kit(), [...images, asset("l1", "logo")]);
    expect(cover).toEqual({ kind: "images", assets: images.slice(0, 3) });
  });
});

describe("CategoryCover", () => {
  it("puts a tenant's face on the specimen alone", () => {
    const { container } = render(
      <CategoryCover cover={{ kind: "font", family: "Acme Display" }} art="/art.webp" />,
    );
    const aa = container.querySelector(".sp-bs-cover__aa") as HTMLElement;
    expect(aa.textContent).toBe("Aa");
    expect(aa.style.fontFamily).toContain("Acme Display");
    expect((container.firstElementChild as HTMLElement).style.fontFamily).toBe("");
  });

  it("draws a style's face, weight and case on its line, never its size", () => {
    const { container } = render(
      <CategoryCover
        cover={{
          kind: "styles",
          styles: [
            style("heading", "Acme Display", { weight: 700, uppercase: true, fontSizePx: 64 }),
            style("body", "Acme Sans", { weight: 400 }),
          ],
        }}
        art="/art.webp"
      />,
    );
    const [first, second] = Array.from(
      container.querySelectorAll<HTMLElement>(".sp-bs-cover__line"),
    );
    expect(first.textContent).toBe("Heading");
    expect(first.style.fontFamily).toContain("Acme Display");
    expect(first.style.fontWeight).toBe("700");
    expect(first.style.textTransform).toBe("uppercase");
    expect(first.style.fontSize).toBe("");
    expect(second.style.fontFamily).toContain("Acme Sans");
  });

  it("draws the shared art as an image", () => {
    const { container } = render(<CategoryCover cover={{ kind: "art" }} art="/art.webp" />);
    expect(container.querySelector("img")?.getAttribute("src")).toBe("/art.webp");
  });
});

describe("coverFor agrees with the count line", () => {
  it("draws the art exactly when the card says Empty", () => {
    const faceless = { ...style("heading", "X", { useFor: "heading" }), font: undefined };
    const states: Array<[KitShape, BrandAsset[]]> = [
      [kit(), []],
      [kit({ colors: COLORS, typeStyles: [style("heading", "A")] }), []],
      [kit({ typeStyles: [faceless] }), [asset("legacy.ttf", "font")]],
      [
        kit({ colors: COLORS.slice(0, 1) }),
        [asset("l1", "logo"), asset("f1", "font", { family: "Acme Sans" }), asset("i1", "image")],
      ],
    ];
    for (const [draft, assets] of states) {
      for (const category of ["colors", "logos", "typography", "type-styles", "images"] as const) {
        const empty = categoryCount(category, draft, assets) === "Empty";
        expect(coverFor(category, draft, assets).kind === "art").toBe(empty);
      }
    }
  });
});
