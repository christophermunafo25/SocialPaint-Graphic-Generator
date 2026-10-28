import { describe, expect, it } from "vitest";
import type { BrandKit, TemplateField, TemplateSchema } from "../../types";
import { deriveColorRoles, paletteUsage } from "./roles";

/** The sample workspace's palette (scripts/new-look/fixtures/dev-workspace.json). */
const SAMPLE: BrandKit = {
  id: "k",
  companyId: "c",
  typeStyles: [],
  guidelines: [],
  colors: [
    { key: "primary", name: "Primary", hex: "#2F3B4C" },
    { key: "secondary", name: "Secondary", hex: "#E7EAEF" },
    { key: "accent", name: "Accent", hex: "#C9A227" },
    { key: "text", name: "Text", hex: "#1A1F26" },
    { key: "background", name: "Background", hex: "#F6F7F9" },
  ],
};

const field = (over: Partial<TemplateField>): TemplateField => ({
  id: Math.random().toString(36),
  label: "f",
  fieldKey: "f",
  type: "shape",
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  ...over,
});

const template = (fields: TemplateField[], backgroundColor = "#F6F7F9"): TemplateSchema => ({
  id: "t",
  companyId: "c",
  name: "t",
  description: "",
  category: "",
  tags: [],
  status: "published",
  canvasWidth: 1080,
  canvasHeight: 1350,
  backgroundUrl: "",
  backgroundColor,
  captionTemplate: "",
  createdAt: "",
  updatedAt: "",
  fields,
});

describe("deriveColorRoles", () => {
  it("reads the sample palette by lightness and saturation", () => {
    const roles = deriveColorRoles(SAMPLE);
    expect(roles.ground).toMatchObject({ key: "background", source: "derived" });
    expect(roles.inkOnLight).toMatchObject({ key: "text", source: "derived" });
    expect(roles.deep).toMatchObject({ key: "primary", source: "derived" });
    expect(roles.accent).toMatchObject({ key: "accent", source: "derived" });
    expect(roles.soft).toMatchObject({ key: "secondary", source: "derived" });
    expect(roles.emphasis).toMatchObject({ hex: "#C9A227" });
    expect(roles.card.source).toBe("ramp");
    expect(roles.inkOnDark.source).toBe("ramp");
  });

  it("puts the admin's corrections first", () => {
    const kit = {
      ...SAMPLE,
      system: { version: 1 as const, color: { roles: { accent: "primary" } } },
    };
    const roles = deriveColorRoles(kit);
    expect(roles.accent).toMatchObject({ key: "primary", source: "admin" });
  });

  it("lets the templates decide where Secondary goes", () => {
    const kit: BrandKit = {
      ...SAMPLE,
      colors: SAMPLE.colors.map((c) =>
        c.key === "secondary" ? { ...c, hex: "#232A33", role: "secondary" as const } : c,
      ),
    };
    // Secondary is the body ink on every post.
    const usage = paletteUsage(
      [
        template([field({ type: "multiline", colorHex: "#232A33" })]),
        template([field({ type: "text", colorHex: "#232A33" })]),
      ],
      kit.colors,
    );
    expect(deriveColorRoles(kit, usage).inkOnLight).toMatchObject({
      key: "secondary",
      source: "usage",
    });
  });

  it("reads the old labels when nothing else decides", () => {
    const kit: BrandKit = {
      ...SAMPLE,
      colors: [
        { key: "a", name: "A", hex: "#3366CC", role: "primary" },
        { key: "b", name: "B", hex: "#FF5A1F", role: "accent" },
      ],
    };
    const roles = deriveColorRoles(kit);
    expect(roles.accent).toMatchObject({ key: "b", source: "legacy" });
    expect(roles.deep).toMatchObject({ key: "a", source: "legacy" });
  });

  it("fills every role from the ramp when the palette is empty", () => {
    const roles = deriveColorRoles({ ...SAMPLE, colors: [] });
    expect(
      Object.values(roles).every((r) => r.source === "ramp" && /^#[0-9A-F]{6}$/.test(r.hex)),
    ).toBe(true);
  });
});

describe("paletteUsage", () => {
  it("classifies grounds, panels, chips, plates and ink by size and surface", () => {
    const usage = paletteUsage(
      [
        template(
          [
            // A full-bleed dark panel.
            field({ width: 1080, height: 700, colorHex: "#2F3B4C" }),
            // A gold call-to-action chip.
            field({ width: 200, height: 60, colorHex: "#C9A227" }),
            // Text on the light ground.
            field({ type: "text", colorHex: "#1A1F26" }),
            // Gold text: emphasis.
            field({ type: "text", colorHex: "#C9A227" }),
            // An off-palette fill counts for nothing.
            field({ width: 200, height: 60, colorHex: "#00FF00" }),
          ],
          "#F6F7F9",
        ),
      ],
      SAMPLE.colors,
    );
    expect(usage).toEqual({
      background: { ground: 1 },
      primary: { deep: 1 },
      accent: { accent: 1, emphasis: 1 },
      text: { inkOnLight: 1 },
    });
  });
});
