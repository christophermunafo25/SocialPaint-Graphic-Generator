import { describe, expect, it } from "vitest";
import type { BrandSystem } from "../../types";
import { toBrandKit, type BrandKitRow } from "./rows";

const row: BrandKitRow = {
  id: "k1",
  company_id: "c1",
  colors: [{ key: "ink", name: "Ink", hex: "#111111" }],
  type_styles: [],
  guidelines: [],
  heading_font: null,
  body_font: null,
  primary_logo_asset_id: null,
  primary_logo_dark_asset_id: null,
  primary_logo_light_asset_id: null,
  allow_style_override: null,
  allow_off_palette: null,
};

describe("brand kit rows", () => {
  it("reads the design system (migration 0052)", () => {
    const system: BrandSystem = {
      version: 1,
      color: { roles: { inkOnLight: "ink" }, neutrals: "warm" },
      type: { ratio: 3.2 },
    };
    expect(toBrandKit({ ...row, system }).system).toEqual(system);
  });

  it("reads a row from before the column, or a null one, as no system", () => {
    expect(toBrandKit(row).system).toBeUndefined();
    expect(toBrandKit({ ...row, system: null }).system).toBeUndefined();
  });
});
