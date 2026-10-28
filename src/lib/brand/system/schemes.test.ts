import { describe, expect, it } from "vitest";
import type { BrandKit } from "../../types";
import { ratio } from "./contrast";
import { INK_MIN, LARGE_MIN, SCHEMES, resolveScheme, schemeSupport } from "./schemes";

const kit = (colors: BrandKit["colors"]): BrandKit => ({
  id: "k",
  companyId: "c",
  typeStyles: [],
  guidelines: [],
  colors,
});

const SAMPLE = kit([
  { key: "primary", name: "Primary", hex: "#2F3B4C" },
  { key: "secondary", name: "Secondary", hex: "#E7EAEF" },
  { key: "accent", name: "Accent", hex: "#C9A227" },
  { key: "text", name: "Text", hex: "#1A1F26" },
  { key: "background", name: "Background", hex: "#F6F7F9" },
]);

describe("resolveScheme", () => {
  it("lands every pairing over its floor on every scheme it passes", () => {
    for (const id of SCHEMES) {
      const s = resolveScheme(SAMPLE, id);
      if (!s.passes) continue;
      const { ground, ink, inkMuted, accent, onAccent } = s.colors;
      expect(ratio(ink, ground)).toBeGreaterThanOrEqual(INK_MIN);
      expect(ratio(inkMuted, ground)).toBeGreaterThanOrEqual(INK_MIN);
      expect(ratio(accent, ground)).toBeGreaterThanOrEqual(LARGE_MIN);
      expect(ratio(onAccent, accent)).toBeGreaterThanOrEqual(LARGE_MIN);
    }
  });

  it("supports every scheme for the sample brand", () => {
    for (const id of SCHEMES) expect(resolveScheme(SAMPLE, id).passes).toBe(true);
  });

  it("swaps an ink that can't read for one that can", () => {
    // The admin set a pale grey as ink on light; the light scheme can't use
    // it on white, so it swaps to (or walks toward) a legible ink.
    const pale = {
      ...SAMPLE,
      system: { version: 1 as const, color: { roles: { inkOnLight: "secondary" } } },
    };
    const s = resolveScheme(pale, "light");
    expect(s.fixed).toContain("ink");
    expect(ratio(s.colors.ink, s.colors.ground)).toBeGreaterThanOrEqual(INK_MIN);
  });

  it("leaves a palette that already reads alone", () => {
    expect(resolveScheme(SAMPLE, "dark").fixed).toEqual([]);
  });

  it("maps Light and Dark onto the ground and the deep colour", () => {
    expect(resolveScheme(SAMPLE, "light").colors).toMatchObject({
      ground: "#F6F7F9",
      ink: "#1A1F26",
    });
    expect(resolveScheme(SAMPLE, "dark").colors.ground).toBe("#2F3B4C");
  });

  it("walks a pale accent until it reads on a light ground, and says so", () => {
    const pale = kit([
      { key: "bg", name: "Bg", hex: "#FFFFFF" },
      { key: "ink", name: "Ink", hex: "#111111" },
      { key: "lime", name: "Lime", hex: "#C8F560", role: "accent" },
    ]);
    const light = resolveScheme(pale, "light");
    expect(light.fixed).toContain("accent");
    expect(light.colors.accent).not.toBe("#C8F560");
    expect(ratio(light.colors.accent, light.colors.ground)).toBeGreaterThanOrEqual(LARGE_MIN);
  });

  it("puts readable ink on an accent ground", () => {
    const s = resolveScheme(SAMPLE, "accent");
    expect(s.colors.ground).toBe("#C9A227");
    expect(ratio(s.colors.ink, s.colors.ground)).toBeGreaterThanOrEqual(INK_MIN);
  });
});

describe("schemeSupport", () => {
  it("enables every passing scheme until the admin chooses", () => {
    const support = schemeSupport(SAMPLE);
    for (const id of SCHEMES) expect(support[id].enabled).toBe(support[id].passes);
  });

  it("follows the admin's choice", () => {
    const chosen = {
      ...SAMPLE,
      system: { version: 1 as const, schemes: { enabled: ["light" as const] } },
    };
    const support = schemeSupport(chosen);
    expect(support.light.enabled).toBe(true);
    expect(support.dark.enabled).toBe(false);
  });
});
