// Grain (brand-system Phase 1): the pixels of a seeded noise tile. Pure and
// deterministic, so the same effect paints the same grain in every engine,
// on every run, and in every export. The renderer encodes the tile once as
// a data URL and repeats it over the field or the canvas.
//
// Figma's MONOTONE noise: grains of one color covering `density` of the
// layer, each grain a random strength up to the color's alpha. Averaged,
// it lifts the layer toward the color by alpha x density / 2, which is what
// the Phase 0 measurement found under the GTM panel.

/** Cells per side. One cell is one grain; the tile repeats seamlessly. */
export const NOISE_TILE_CELLS = 128;

/** mulberry32: a small, fast PRNG with a 32-bit state. Enough for grain;
 * the point is that it is identical everywhere. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface NoiseTileSpec {
  /** #RRGGBB or #RRGGBBAA; the alpha is the strongest grain's opacity. */
  color: string;
  /** Share of cells that carry a grain, 0..1. */
  density: number;
  seed?: number;
}

export interface NoiseTile {
  width: number;
  height: number;
  /** RGBA, row-major, NOISE_TILE_CELLS x NOISE_TILE_CELLS. */
  data: Uint8ClampedArray;
}

function rgba(color: string): [number, number, number, number] {
  const hex = color.replace("#", "");
  const n = (i: number) => parseInt(hex.slice(i, i + 2), 16);
  return [n(0), n(2), n(4), hex.length >= 8 ? n(6) : 255];
}

/** The tile's pixels: one per grain. Painted at `size` px per cell. */
export function noiseTile(spec: NoiseTileSpec): NoiseTile {
  const cells = NOISE_TILE_CELLS;
  const data = new Uint8ClampedArray(cells * cells * 4);
  const [r, g, b, a] = rgba(spec.color);
  const density = Math.min(1, Math.max(0, spec.density));
  const random = mulberry32(spec.seed ?? 1);
  for (let i = 0; i < cells * cells; i++) {
    // Two draws per cell, always, so the pattern at one density is the
    // same cells as at another, only fewer of them lit.
    const lit = random() < density;
    const strength = random();
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = lit ? Math.round(a * strength) : 0;
  }
  return { width: cells, height: cells, data };
}

/** A stable key for caching one tile's encoded data URL. */
export function noiseTileKey(spec: NoiseTileSpec): string {
  return `${spec.color.toLowerCase()}|${spec.density}|${spec.seed ?? 1}`;
}
