// Gradient CSS from the shared gradient shape (TextGradient). One builder
// for every surface that paints a gradient as CSS: the canvas background,
// rect shapes and text fills. SVG shapes build their own element from the
// same fields (radialGeometry).

import type { TextGradient } from "../types";

const pct = (v: number) => `${Math.round(v * 10000) / 100}%`;

function stopsCss(g: Pick<TextGradient, "stops">): string {
  return g.stops.map((s) => `${s.color} ${Math.round(s.position * 100)}%`).join(", ");
}

/** The radial gradient's centre and radii as fractions of the box, with
 * the defaults filled in: centred, touching the box's sides. */
export function radialGeometry(g: Pick<TextGradient, "center" | "radius">): {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
} {
  return {
    cx: g.center?.x ?? 0.5,
    cy: g.center?.y ?? 0.5,
    rx: g.radius?.x ?? 0.5,
    ry: g.radius?.y ?? 0.5,
  };
}

/** CSS for a gradient. Absent `kind` is linear, exactly the pre-radial
 * output. */
export function gradientCss(g: TextGradient): string {
  if (g.kind === "radial") {
    const { cx, cy, rx, ry } = radialGeometry(g);
    return `radial-gradient(${pct(rx)} ${pct(ry)} at ${pct(cx)} ${pct(cy)}, ${stopsCss(g)})`;
  }
  return `linear-gradient(${g.angle}deg, ${stopsCss(g)})`;
}
