import { describe, expect, it } from "vitest";
import type { BrandTypeStyle, FontRef } from "../types";
import { DEFAULT_TYPE_STYLES } from "../theme";
import {
  assignFontRole,
  migrateFontRoles,
  roleFace,
  roleStyle,
  styleFaces,
  withFontRoles,
} from "./fontRoles";

const g = (family: string): FontRef => ({ source: "google", family });
const styles = (): BrandTypeStyle[] => DEFAULT_TYPE_STYLES.map((s) => ({ ...s }));

describe("migrateFontRoles (PHASE-6 §9 D3)", () => {
  it("gives the heading and body styles their roles, and moves nothing when faces agree", () => {
    const out = migrateFontRoles({
      typeStyles: styles(),
      headingFont: g("Montserrat"),
      bodyFont: g("Inter"),
    });
    expect(out.typeStyles.map((s) => [s.key, s.useFor])).toEqual([
      ["heading", "heading"],
      ["subhead", null],
      ["body", "body"],
    ]);
    expect(out.restyled).toEqual([]);
    expect(out.typeStyles.map((s) => s.font?.family)).toEqual([
      "Montserrat",
      "Montserrat",
      "Inter",
    ]);
  });

  it("an onboarded kit: default-faced styles take the chosen faces", () => {
    const custom: FontRef = { source: "custom", family: "Raveo", assetId: "a1" };
    const out = migrateFontRoles({
      typeStyles: styles(),
      headingFont: custom,
      bodyFont: g("DM Sans"),
    });
    expect(out.restyled).toEqual(["heading", "subhead", "body"]);
    expect(out.typeStyles.map((s) => s.font)).toEqual([custom, custom, g("DM Sans")]);
    // Everything else on the style stays.
    expect(out.typeStyles[0].weight).toBe(700);
    expect(out.typeStyles[0].uppercase).toBe(true);
  });

  it("an admin's own face stays", () => {
    const own = styles();
    own[0] = { ...own[0], font: g("Playfair Display") };
    const out = migrateFontRoles({
      typeStyles: own,
      headingFont: g("Oswald"),
      bodyFont: g("Inter"),
    });
    expect(out.typeStyles[0].font).toEqual(g("Playfair Display"));
    expect(out.typeStyles[1].font).toEqual(g("Oswald"));
    expect(out.restyled).toEqual(["subhead"]);
  });

  it("never runs twice: a migrated kit is left as it is, cleared roles included", () => {
    const once = migrateFontRoles({ typeStyles: styles(), headingFont: g("Oswald") }).typeStyles;
    const cleared = assignFontRole(assignFontRole(once, "heading", null), "body", null);
    // An admin later puts Heading back on Montserrat; the rule must not swap it.
    cleared[0] = { ...cleared[0], font: g("Montserrat") };
    const again = migrateFontRoles({ typeStyles: cleared, headingFont: g("Oswald") });
    expect(again.changed).toBe(false);
    expect(again.typeStyles).toBe(cleared);
    expect(roleStyle({ typeStyles: cleared }, "heading")).toBeUndefined();
  });

  it("a kit with no styles reads the defaults, with its faces", () => {
    const kit = { typeStyles: [], headingFont: g("Oswald"), bodyFont: g("Lora") };
    expect(roleFace(kit, "heading")).toEqual(g("Oswald"));
    expect(roleFace(kit, "body")).toEqual(g("Lora"));
    expect(withFontRoles(kit).typeStyles).toEqual([]);
  });

  it("falls back when no style holds a role", () => {
    const kit = { typeStyles: [{ key: "x", name: "X", useFor: null, font: g("Lora") }] };
    expect(roleFace(kit, "heading")).toEqual(g("Montserrat"));
    expect(styleFaces(kit)).toEqual([g("Lora")]);
  });
});

describe("assignFontRole", () => {
  it("moves a role from the style that held it", () => {
    const once = migrateFontRoles({ typeStyles: styles() }).typeStyles;
    const moved = assignFontRole(once, "subhead", "heading");
    expect(moved.map((s) => s.useFor)).toEqual([null, "heading", "body"]);
  });
});

describe("styleFaces", () => {
  it("lists each face the styles use once, role faces first", () => {
    const kit = migrateFontRoles({ typeStyles: styles(), bodyFont: g("Lora") });
    expect(styleFaces(kit).map((f) => f.family)).toEqual(["Montserrat", "Lora"]);
  });
});
