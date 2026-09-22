import { describe, expect, it } from "vitest";
import type { BrandColor } from "../types";
import { mergeExtractedColors } from "./brandPrefill";

const DEFAULTS: BrandColor[] = [
  { key: "primary", name: "Primary", hex: "#2F3B4C" },
  { key: "secondary", name: "Secondary", hex: "#E7EAEF" },
  { key: "accent", name: "Accent", hex: "#C9A227" },
  { key: "text", name: "Text", hex: "#1A1F26" },
  { key: "background", name: "Background", hex: "#F6F7F9" },
];

describe("mergeExtractedColors", () => {
  it("recolors the matching defaults and stamps roles", () => {
    const out = mergeExtractedColors(DEFAULTS, [
      { hex: "#112233", role: "primary", name: "Navy" },
      { hex: "#FF9900", role: "accent", name: "Orange" },
    ]);
    expect(out.find((c) => c.key === "primary")).toMatchObject({
      hex: "#112233",
      role: "primary",
    });
    expect(out.find((c) => c.key === "accent")).toMatchObject({ hex: "#FF9900", role: "accent" });
    expect(out.find((c) => c.key === "secondary")?.role).toBeUndefined();
    expect(out).toHaveLength(5);
  });

  it("appends duplicate-role colors as roleless extras, skipping repeated hexes", () => {
    const out = mergeExtractedColors(DEFAULTS, [
      { hex: "#112233", role: "primary", name: "Navy" },
      { hex: "#334455", role: "primary", name: "Slate" },
      { hex: "#112233", role: "primary", name: "Navy again" },
    ]);
    expect(out).toHaveLength(6);
    expect(out[5]).toMatchObject({ key: "web-1", name: "Slate", hex: "#334455" });
    expect(out[5].role).toBeUndefined();
  });

  it("never exceeds the palette cap", () => {
    const extracted = Array.from({ length: 12 }, (_, i) => ({
      hex: `#0000${(10 + i).toString(16).padStart(2, "0").toUpperCase()}`,
      role: "primary" as const,
      name: `c${i}`,
    }));
    expect(mergeExtractedColors(DEFAULTS, extracted).length).toBeLessThanOrEqual(12);
  });

  it("does not mutate the defaults", () => {
    const before = structuredClone(DEFAULTS);
    mergeExtractedColors(DEFAULTS, [{ hex: "#112233", role: "primary", name: "Navy" }]);
    expect(DEFAULTS).toEqual(before);
  });
});
