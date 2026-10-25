import { describe, expect, it } from "vitest";
import { gradientCss, radialGeometry } from "./gradient";

const stops = [
  { position: 0, color: "#17FF7E" },
  { position: 1, color: "#082A23" },
];

describe("gradientCss", () => {
  it("builds exactly the pre-radial CSS when kind is absent", () => {
    expect(gradientCss({ angle: 135, stops })).toBe(
      "linear-gradient(135deg, #17FF7E 0%, #082A23 100%)",
    );
    expect(gradientCss({ angle: 135, stops, kind: "linear" })).toBe(
      "linear-gradient(135deg, #17FF7E 0%, #082A23 100%)",
    );
  });

  it("centres a radial gradient on the box by default", () => {
    expect(gradientCss({ angle: 0, stops, kind: "radial" })).toBe(
      "radial-gradient(50% 50% at 50% 50%, #17FF7E 0%, #082A23 100%)",
    );
  });

  it("places a corner glow by centre and radii, ignoring the angle", () => {
    expect(
      gradientCss({
        angle: 90,
        stops,
        kind: "radial",
        center: { x: 1, y: 0 },
        radius: { x: 0.8, y: 0.6 },
      }),
    ).toBe("radial-gradient(80% 60% at 100% 0%, #17FF7E 0%, #082A23 100%)");
  });
});

describe("radialGeometry", () => {
  it("fills the defaults it leaves out", () => {
    expect(radialGeometry({ center: { x: 0.2, y: 0.3 } })).toEqual({
      cx: 0.2,
      cy: 0.3,
      rx: 0.5,
      ry: 0.5,
    });
  });
});
