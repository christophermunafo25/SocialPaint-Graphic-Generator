import { describe, expect, it } from "vitest";
import { parseCanvaCdf } from "./canvaCdf.ts";

/** The observed grammar, from a real Signature template (see the build spec).
 * The RECT here is deliberately in bleed (negative-adjacent, exceeds the
 * page box) and locked; the TEXT is rotated and unlocked. */
const FIXTURE = `# Page 1 (FIXED) [PBFthtH8QVxBZNvT]
Dimensions: 940×788
Background: #ff9e18 replaceable=true

## TEXT [PBFthtH8QVxBZNvT-LBgw8XVRxrplsxFZ]
pos: 609.4960883153524,459.6126418605012 size: 312.3293940737078×54.76386 rotation: 8.373994748024865 opacity: 1
regions:
  [0] "Name" fontSize=46.1807 fontWeight=normal fontStyle=normal color=#003b71 textAlign=center decoration=none strikethrough=none link="" listMarker=none level=0 lineHeight=1.4 letterSpacing=0 fontRef=YAGgTiJKm_0,0

## RECT [PBFthtH8QVxBZNvT-LB1GL4XDZwynZhhv]
pos: 13.115373029313275,803.7523728946542 size: 282.104×630.4 rotation: 0 opacity: 1 locked: true
fill: IMAGE mediaId=MAF38MLi4k4 imageBox=(0,0 282.104×630.4 rotation=0) replaceable=true flipX=false flipY=false
stroke: weight=0 color=#000000

## SHAPE [PBFthtH8QVxBZNvT-LBYv4QqcKDX7SxjN]
pos: -12.5,40 size: 430.4×500 rotation: 0 opacity: 1
viewBox: 0,0 430.4×500
path[0]: d="M0 0 L430 0 L430 500 Z" fill=#f2f1eb replaceable=false stroke=none cornerRounding=0
`;

describe("canva CDF parsing", () => {
  const parsed = parseCanvaCdf(FIXTURE);

  it("reads the page dimensions", () => {
    expect(parsed.canvasWidth).toBe(940);
    expect(parsed.canvasHeight).toBe(788);
  });

  it("finds one element of each kind", () => {
    const kinds = parsed.elements.map((e) => e.kind).sort();
    expect(kinds).toEqual(["image", "shape", "text"]);
  });

  it("keeps the full bracketed locator as sourceId", () => {
    expect(parsed.elements.map((e) => e.sourceId)).toEqual([
      "PBFthtH8QVxBZNvT-LBgw8XVRxrplsxFZ",
      "PBFthtH8QVxBZNvT-LB1GL4XDZwynZhhv",
      "PBFthtH8QVxBZNvT-LBYv4QqcKDX7SxjN",
    ]);
  });

  it("parses exact geometry, × separator and all", () => {
    const text = parsed.elements[0];
    expect(text.x).toBeCloseTo(609.4960883153524, 10);
    expect(text.y).toBeCloseTo(459.6126418605012, 10);
    expect(text.width).toBeCloseTo(312.3293940737078, 10);
    expect(text.height).toBeCloseTo(54.76386, 10);
    expect(text.rotation).toBeCloseTo(8.373994748024865, 10);
  });

  it("maps text styling: weight names, color, align, lineHeight", () => {
    const text = parsed.elements[0];
    expect(text.text).toBe("Name");
    expect(text.fontSizePx).toBeCloseTo(46.1807, 4);
    expect(text.fontWeight).toBe(400);
    expect(text.colorHex).toBe("#003B71");
    expect(text.align).toBe("center");
    expect(text.lineHeight).toBeCloseTo(1.4, 4);
  });

  it("never maps fontRef to a fontFamily, and warns once about it", () => {
    expect(parsed.elements[0].fontFamily).toBeUndefined();
    expect(parsed.warnings.filter((w) => w.includes("font id"))).toHaveLength(1);
  });

  it("maps locked and replaceable to source intent", () => {
    const image = parsed.elements[1];
    expect(image.kind).toBe("image");
    expect(image.sourceLocked).toBe(true);
    expect(image.sourceReplaceable).toBe(true);
    // absence of locked means unlocked — the signal that matters most
    expect(parsed.elements[0].sourceLocked).toBeUndefined();
  });

  it("passes bleed coordinates through untouched", () => {
    const image = parsed.elements[1];
    expect(image.y).toBeCloseTo(803.7523728946542, 10); // beyond the 788 page box
    const shape = parsed.elements[2];
    expect(shape.x).toBe(-12.5); // negative
  });

  it("reads a shape's fill from its first path", () => {
    expect(parsed.elements[2].colorHex).toBe("#F2F1EB");
  });

  it("skips unknown element types with a warning rather than throwing", () => {
    const withUnknown = FIXTURE + `\n## VIDEO [PBF-LBvideo123]\npos: 0,0 size: 100×100 rotation: 0 opacity: 1\n`;
    const out = parseCanvaCdf(withUnknown);
    expect(out.elements).toHaveLength(3);
    expect(out.warnings.some((w) => w.includes('"VIDEO"'))).toBe(true);
  });

  it("repeated mediaIds at different positions stay distinct elements", () => {
    const dup = FIXTURE + `\n## RECT [PBF-LBcopy2]\npos: 400,100 size: 282.104×630.4 rotation: 0 opacity: 1\nfill: IMAGE mediaId=MAF38MLi4k4 imageBox=(0,0 282.104×630.4 rotation=0) replaceable=true flipX=false flipY=false\n`;
    const out = parseCanvaCdf(dup);
    expect(out.elements.filter((e) => e.kind === "image")).toHaveLength(2);
  });

  it("only imports page 1 of a multi-page design", () => {
    const twoPages = FIXTURE + `\n# Page 2 (FIXED) [PBF2]\nDimensions: 940×788\n\n## TEXT [PBF2-LBx]\npos: 0,0 size: 100×40 rotation: 0 opacity: 1\nregions:\n  [0] "Page two" fontSize=20 fontWeight=bold fontStyle=normal color=#000000 textAlign=left lineHeight=1.2 letterSpacing=0 fontRef=Z,0\n`;
    const out = parseCanvaCdf(twoPages);
    expect(out.elements).toHaveLength(3);
    expect(out.warnings.some((w) => w.includes("multiple pages"))).toBe(true);
  });

  it("maps fontWeight=bold to 700", () => {
    const bold = FIXTURE.replace("fontWeight=normal", "fontWeight=bold");
    expect(parseCanvaCdf(bold).elements[0].fontWeight).toBe(700);
  });
});
