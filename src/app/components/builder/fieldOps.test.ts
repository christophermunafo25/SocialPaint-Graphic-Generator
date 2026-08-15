import { describe, expect, it } from "vitest";
import {
  applyClipboardStyle,
  clearStyleClipboard,
  clipboardHasStyle,
  copyStyle,
  isSvgSource,
  logoFieldFromAsset,
  svgIntrinsicSize,
} from "./fieldOps";
import type { TemplateField } from "@/lib/types";

const asset = {
  id: "asset-1",
  name: "SocialPaint-Primary.png",
  url: "https://cdn.example.com/logo.png",
};
const canvas = { width: 1440, height: 1440 };
const center = { x: 720, y: 720 };

describe("logoFieldFromAsset", () => {
  it("always defaults to contain — a logo never crops", () => {
    const f = logoFieldFromAsset(asset, { width: 800, height: 400 }, center, [], canvas);
    expect(f.objectFit).toBe("contain");
  });

  it("lands fixed with the artwork as its static value", () => {
    const f = logoFieldFromAsset(asset, null, center, [], canvas);
    expect(f.type).toBe("image");
    expect(f.static).toBe(true);
    expect(f.staticValue).toBe(asset.url);
  });

  it("sizes the box to the artwork's aspect ratio (landscape)", () => {
    const f = logoFieldFromAsset(asset, { width: 800, height: 400 }, center, [], canvas);
    expect(f.width).toBe(360);
    expect(f.height).toBe(180);
    expect(f.aspectRatio).toBe(2);
  });

  it("sizes the box to the artwork's aspect ratio (portrait)", () => {
    const f = logoFieldFromAsset(asset, { width: 300, height: 600 }, center, [], canvas);
    expect(f.width).toBe(180);
    expect(f.height).toBe(360);
  });

  it("falls back to a square box when the natural size is unknown", () => {
    const f = logoFieldFromAsset(asset, null, center, [], canvas);
    expect(f.width).toBe(360);
    expect(f.height).toBe(360);
    expect(f.aspectRatio).toBeUndefined();
  });

  it("clamps into a small canvas without distorting the ratio", () => {
    const small = { width: 200, height: 400 };
    const f = logoFieldFromAsset(asset, { width: 800, height: 400 }, center, [], small);
    expect(f.width).toBeLessThanOrEqual(small.width);
    expect(f.height).toBeLessThanOrEqual(small.height);
    expect(f.width / f.height).toBeCloseTo(2, 1);
    expect(f.x).toBeGreaterThanOrEqual(0);
    expect(f.y).toBeGreaterThanOrEqual(0);
  });

  it("centers on the drop point, clamped inside the canvas", () => {
    const f = logoFieldFromAsset(asset, { width: 400, height: 400 }, { x: 0, y: 0 }, [], canvas);
    expect(f.x).toBe(0);
    expect(f.y).toBe(0);
  });

  it("labels from the asset filename, deduplicated against existing fields", () => {
    const f = logoFieldFromAsset(asset, null, center, [], canvas);
    expect(f.label).toBe("SocialPaint-Primary");
    const existing = [{ ...f }] as TemplateField[];
    const f2 = logoFieldFromAsset(asset, null, center, existing, canvas);
    expect(f2.label).toBe("SocialPaint-Primary copy");
  });
});

describe("style clipboard", () => {
  const headline: TemplateField = {
    id: "src",
    label: "Headline",
    fieldKey: "headline",
    type: "text",
    x: 10,
    y: 20,
    width: 500,
    height: 100,
    fontFamily: "Neuething Sans",
    fontWeight: 800,
    fontStretch: "expanded",
    fontSizePx: 96,
    uppercase: false,
    letterSpacingPx: -1.9,
    lineHeight: 1.2,
    align: "left",
    textSizing: "shrink",
    colorHex: "#F1F1F1",
    textGradient: {
      angle: 135,
      stops: [
        { position: 0, color: "#FF4D12" },
        { position: 1, color: "#FF8235" },
      ],
    },
  };
  const plain: TemplateField = {
    id: "dst",
    label: "Body",
    fieldKey: "body",
    type: "multiline",
    x: 700,
    y: 800,
    width: 400,
    height: 200,
    fontFamily: "Inter Tight",
    fontWeight: 400,
    fontSizePx: 36,
    colorHex: "#121212",
  };

  it("pastes the look, never content or geometry", () => {
    copyStyle(headline);
    const styled = applyClipboardStyle(plain);
    expect(styled.fontFamily).toBe("Neuething Sans");
    expect(styled.fontWeight).toBe(800);
    expect(styled.fontSizePx).toBe(96);
    expect(styled.textGradient?.stops[1].color).toBe("#FF8235");
    // untouched identity + geometry
    expect(styled.id).toBe("dst");
    expect(styled.label).toBe("Body");
    expect(styled.fieldKey).toBe("body");
    expect(styled.type).toBe("multiline");
    expect([styled.x, styled.y, styled.width, styled.height]).toEqual([700, 800, 400, 200]);
  });

  it("clears what the source lacks — adopt the look, don't merge", () => {
    const gradFree: TemplateField = { ...plain, id: "s2", textGradient: { angle: 0, stops: [] } };
    copyStyle(plain);
    const styled = applyClipboardStyle(gradFree);
    expect(styled.textGradient).toBeUndefined();
  });

  it("applies only the type-appropriate subset across kinds", () => {
    copyStyle(headline);
    const image: TemplateField = {
      id: "img",
      label: "Photo",
      fieldKey: "photo",
      type: "image",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      objectFit: "cover",
      cornerRadius: { tl: 8, tr: 8, br: 8, bl: 8 },
    };
    const styled = applyClipboardStyle(image);
    expect(styled.fontFamily).toBeUndefined();
    // source had no image-facing props — the look transfers as "no radius, default fit"
    expect(styled.cornerRadius).toBeUndefined();
    expect(styled.objectFit).toBeUndefined();
    expect(styled.width).toBe(100);
  });

  it("shape fill adopts a text style's color and gradient", () => {
    copyStyle(headline);
    const shape: TemplateField = {
      id: "sh",
      label: "Rect",
      fieldKey: "rect",
      type: "shape",
      shape: "rect",
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      colorHex: "#d9d9d9",
      static: true,
    };
    const styled = applyClipboardStyle(shape);
    expect(styled.colorHex).toBe("#F1F1F1");
    expect(styled.textGradient?.angle).toBe(135);
    expect(styled.static).toBe(true);
    expect(styled.shape).toBe("rect");
  });

  it("empty clipboard is a no-op", () => {
    clearStyleClipboard();
    expect(clipboardHasStyle()).toBe(false);
    expect(applyClipboardStyle(plain)).toEqual(plain);
  });
});

describe("svgIntrinsicSize", () => {
  it("prefers absolute width/height attributes", () => {
    expect(
      svgIntrinsicSize('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="80"></svg>'),
    ).toEqual({ width: 240, height: 80 });
    expect(svgIntrinsicSize('<svg width="240px" height="80px"></svg>')).toEqual({
      width: 240,
      height: 80,
    });
  });

  it("falls back to the viewBox when width/height are missing or relative", () => {
    expect(svgIntrinsicSize('<svg viewBox="0 0 400 100"><rect/></svg>')).toEqual({
      width: 400,
      height: 100,
    });
    // Percentages size against the container, not the artwork.
    expect(svgIntrinsicSize('<svg width="100%" height="100%" viewBox="0,0,50,200"/>')).toEqual({
      width: 50,
      height: 200,
    });
  });

  it("returns null when the document declares nothing trustworthy", () => {
    expect(svgIntrinsicSize('<svg xmlns="http://www.w3.org/2000/svg"><circle r="48"/></svg>')).toBe(
      null,
    );
    expect(svgIntrinsicSize("not svg at all")).toBe(null);
    expect(svgIntrinsicSize('<svg viewBox="0 0 0 100"/>')).toBe(null);
  });
});

describe("isSvgSource", () => {
  it("matches svg files, urls with query strings, and data urls", () => {
    expect(isSvgSource("logo.svg")).toBe(true);
    expect(isSvgSource("https://cdn.example.com/a/logo.SVG?token=x")).toBe(true);
    expect(isSvgSource("data:image/svg+xml;utf8,<svg/>")).toBe(true);
    expect(isSvgSource("logo.png")).toBe(false);
    expect(isSvgSource("https://cdn.example.com/svg-icons/logo.png")).toBe(false);
  });
});
