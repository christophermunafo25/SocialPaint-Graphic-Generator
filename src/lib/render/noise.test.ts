import { describe, expect, it } from "vitest";
import {
  NOISE_TILE_CELLS,
  mulberry32,
  noiseLayerCss,
  noiseTile,
  noiseTileDataUrl,
  noiseTileKey,
} from "./noise";

const alphas = (data: Uint8ClampedArray) => data.filter((_, i) => i % 4 === 3);

describe("mulberry32", () => {
  it("repeats exactly for a seed and differs between seeds", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const c = mulberry32(43);
    const first = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(first);
    expect([c(), c(), c()]).not.toEqual(first);
    for (const v of first) expect(v >= 0 && v < 1).toBe(true);
  });
});

describe("noiseTile", () => {
  const spec = { color: "#FFFFFF1A", density: 1, seed: 7 };

  it("is identical run to run, so an export never changes", () => {
    expect(noiseTile(spec).data).toEqual(noiseTile(spec).data);
    expect(noiseTile({ ...spec, seed: 8 }).data).not.toEqual(noiseTile(spec).data);
  });

  it("paints grains of the color, up to the color's alpha", () => {
    const { width, height, data } = noiseTile(spec);
    expect([width, height]).toEqual([NOISE_TILE_CELLS, NOISE_TILE_CELLS]);
    for (let i = 0; i < data.length; i += 4) {
      expect([data[i], data[i + 1], data[i + 2]]).toEqual([255, 255, 255]);
      expect(data[i + 3]).toBeLessThanOrEqual(0x1a);
    }
  });

  it("averages to alpha x density / 2, the lift Phase 0 measured", () => {
    for (const density of [1, 0.5]) {
      const a = alphas(noiseTile({ color: "#000000C8", density, seed: 3 }).data);
      const mean = a.reduce((s, v) => s + v, 0) / a.length;
      expect(mean).toBeCloseTo((200 * density) / 2, -0.5); // within about 1.5
    }
  });

  it("lights fewer of the same cells at a lower density", () => {
    const full = alphas(noiseTile({ ...spec, density: 1 }).data);
    const half = alphas(noiseTile({ ...spec, density: 0.5 }).data);
    const lit = half.filter((v) => v > 0).length / half.length;
    expect(lit).toBeGreaterThan(0.45);
    expect(lit).toBeLessThan(0.55);
    half.forEach((v, i) => {
      if (v > 0) expect(v).toBe(full[i]);
    });
  });

  it("treats an opaque six-digit color as full strength", () => {
    const a = alphas(noiseTile({ color: "#000000", density: 1, seed: 1 }).data);
    expect(Math.max(...a)).toBeGreaterThan(240);
  });
});

describe("noiseTileKey", () => {
  it("names a tile by everything that changes its pixels", () => {
    expect(noiseTileKey({ color: "#FFFFFF1A", density: 1, seed: 7 })).toBe(
      noiseTileKey({ color: "#ffffff1a", density: 1, seed: 7 }),
    );
    expect(noiseTileKey({ color: "#FFFFFF1A", density: 1 })).not.toBe(
      noiseTileKey({ color: "#FFFFFF1A", density: 0.5 }),
    );
  });
});

describe("noiseLayerCss", () => {
  it("paints each layer's tile at size px per grain, top layer first", () => {
    const fine = { color: "#FFFFFF1A", density: 1, size: 0.5, seed: 1 };
    const coarse = { color: "#00000033", density: 0.5, size: 2, seed: 2 };
    const css = noiseLayerCss([fine, coarse])!;
    const urls = String(css.backgroundImage).split(", ");
    expect(urls).toHaveLength(2);
    expect(urls[0]).toContain(noiseTileDataUrl(coarse));
    expect(urls[1]).toContain(noiseTileDataUrl(fine));
    expect(css.backgroundSize).toBe(`${NOISE_TILE_CELLS * 2}px, ${NOISE_TILE_CELLS * 0.5}px`);
    expect(css.imageRendering).toBe("pixelated");
  });

  it("is undefined with no layers, so the element takes today's path", () => {
    expect(noiseLayerCss([])).toBeUndefined();
  });

  it("encodes a tile once and reuses it", () => {
    const spec = { color: "#FFFFFF1A", density: 1, seed: 9 };
    expect(noiseTileDataUrl(spec)).toBe(noiseTileDataUrl({ ...spec }));
  });
});
