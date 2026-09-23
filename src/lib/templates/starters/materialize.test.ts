import { describe, expect, it } from "vitest";
import type { BrandColor, BrandKit, TemplateField } from "../../types";
import { contrastRatio, parseHex } from "../../color";
import { applyVariant } from "../variants";
import { STARTER_BLUEPRINTS } from "./index";
import {
  ACCENT_ON_SURFACE_MIN,
  ON_ACCENT_MIN,
  materializeStarter,
  pickAccent,
  pickOnAccent,
  resolveSlots,
  walkAccent,
  type MaterializeContext,
} from "./materialize";
import { ACCENT_FALLBACK, NEUTRALS_DARK, NEUTRALS_LIGHT } from "./neutrals";

const ratio = (a: string, b: string): number => contrastRatio(parseHex(a)!, parseHex(b)!);

const kit = (colors: BrandColor[], extra: Partial<BrandKit> = {}): BrandKit => ({
  id: "kit-1",
  companyId: "co-1",
  colors,
  typeStyles: [],
  guidelines: [],
  headingFont: { source: "google", family: "Montserrat" },
  bodyFont: { source: "google", family: "Inter" },
  ...extra,
});

const REFERENCE_COLORS: BrandColor[] = [
  { key: "primary", name: "Primary", hex: "#2F3B4C", role: "primary" },
  { key: "secondary", name: "Secondary", hex: "#E7EAEF", role: "secondary" },
  { key: "accent", name: "Accent", hex: "#C9A227", role: "accent" },
  { key: "text", name: "Text", hex: "#1A1F26" },
];

const ctx = (over: Partial<MaterializeContext> = {}): MaterializeContext => ({
  company: { id: "co-1", name: "Acme Studios", website: "acme.com" },
  kit: kit(REFERENCE_COLORS),
  logoAssetRef: "brand-assets/co-1/logo/1-acme.png",
  seededAt: "2026-09-18T00:00:00.000Z",
  ...over,
});

describe("pickAccent", () => {
  it("prefers the accent role", () => {
    expect(pickAccent(REFERENCE_COLORS)).toBe("#C9A227");
  });
  it("falls to secondary, then primary", () => {
    expect(pickAccent(REFERENCE_COLORS.filter((c) => c.role !== "accent"))).toBe("#E7EAEF");
    expect(pickAccent(REFERENCE_COLORS.filter((c) => c.role === "primary"))).toBe("#2F3B4C");
  });
  it("falls to the first parseable entry when no roles are set", () => {
    expect(
      pickAccent([
        { key: "x", name: "Broken", hex: "not-a-hex" },
        { key: "y", name: "Teal", hex: "#0B7A75" },
      ]),
    ).toBe("#0B7A75");
  });
  it("falls to the Appendix B fallback on an empty or unparseable palette", () => {
    expect(pickAccent([])).toBe(ACCENT_FALLBACK);
    expect(pickAccent([{ key: "x", name: "Broken", hex: "nope" }])).toBe(ACCENT_FALLBACK);
  });
  it("skips a roled entry whose hex does not parse", () => {
    expect(
      pickAccent([
        { key: "a", name: "Accent", hex: "junk", role: "accent" },
        { key: "b", name: "Secondary", hex: "#336699", role: "secondary" },
      ]),
    ).toBe("#336699");
  });
});

describe("walkAccent on nasty palettes", () => {
  const nasty = ["#FFEB3B", "#FAFAFA", "#050505", "#FFFFFF", "#00FF00", "#8A8A8A"];
  it("lands every accent at or above the floor on the light surface", () => {
    for (const hex of nasty) {
      const walked = walkAccent(hex, NEUTRALS_LIGHT.surface);
      expect(ratio(walked, NEUTRALS_LIGHT.surface), `${hex} -> ${walked}`).toBeGreaterThanOrEqual(
        ACCENT_ON_SURFACE_MIN,
      );
    }
  });
  it("lands every accent at or above the floor on the dark surface", () => {
    for (const hex of nasty) {
      const walked = walkAccent(hex, NEUTRALS_DARK.surface);
      expect(ratio(walked, NEUTRALS_DARK.surface), `${hex} -> ${walked}`).toBeGreaterThanOrEqual(
        ACCENT_ON_SURFACE_MIN,
      );
    }
  });
  it("leaves an already-passing accent untouched", () => {
    expect(walkAccent("#0B7A75", NEUTRALS_LIGHT.surface)).toBe("#0B7A75");
  });
  it("walks a light-surface failure darker, keeping the hue", () => {
    const walked = walkAccent("#FFEB3B", NEUTRALS_LIGHT.surface);
    expect(walked).not.toBe("#FFEB3B");
    expect(walked).not.toBe(ACCENT_FALLBACK);
  });
  it("falls back for an unparseable input", () => {
    expect(walkAccent("junk", NEUTRALS_LIGHT.surface)).toBe(ACCENT_FALLBACK);
  });
});

describe("pickOnAccent", () => {
  it("clears 4.5 whenever one candidate can", () => {
    for (const accent of ["#0B7A75", "#B58900", "#2F3B4C", "#E2452C", "#F1F0EC"]) {
      const on = pickOnAccent(accent);
      expect(ratio(on, accent), `${accent} -> ${on}`).toBeGreaterThanOrEqual(ON_ACCENT_MIN);
    }
  });
  it("picks the better candidate when neither clears (mid-gray accent)", () => {
    const on = pickOnAccent("#757575");
    expect(["#111112", "#FFFFFF"]).toContain(on);
  });
});

describe("resolveSlots", () => {
  it("computes a passing accent pair for a single-yellow palette", () => {
    const slots = resolveSlots([{ key: "y", name: "Yellow", hex: "#FFE600" }]);
    expect(ratio(slots.light.accent, slots.light.surface)).toBeGreaterThanOrEqual(
      ACCENT_ON_SURFACE_MIN,
    );
    expect(ratio(slots.dark.accent, slots.dark.surface)).toBeGreaterThanOrEqual(
      ACCENT_ON_SURFACE_MIN,
    );
    expect(ratio(slots.light.onAccent, slots.light.accent)).toBeGreaterThanOrEqual(ON_ACCENT_MIN);
    expect(ratio(slots.dark.onAccent, slots.dark.accent)).toBeGreaterThanOrEqual(ON_ACCENT_MIN);
  });
  it("keeps the neutrals fixed regardless of palette", () => {
    const slots = resolveSlots([{ key: "p", name: "Pink", hex: "#FF69B4" }]);
    expect(slots.light.ink).toBe(NEUTRALS_LIGHT.ink);
    expect(slots.dark.border).toBe(NEUTRALS_DARK.border);
  });
});

describe("materializeStarter", () => {
  it("materializes all six blueprints for the reference kit (snapshot)", () => {
    const inputs = STARTER_BLUEPRINTS.map((b) => materializeStarter(b, ctx()));
    expect(inputs).toMatchSnapshot();
  });

  it("stamps starter provenance and publishes", () => {
    const input = materializeStarter(STARTER_BLUEPRINTS[0], ctx());
    expect(input.status).toBe("published");
    expect(input.autobuildMeta).toMatchObject({
      model: "starter",
      sourceKind: "starter",
      source: "starter",
      starterKey: "launch-01",
      starterVersion: 1,
      seededAt: "2026-09-18T00:00:00.000Z",
    });
  });

  it("injects the logo as a static image with its border frame", () => {
    const input = materializeStarter(STARTER_BLUEPRINTS[0], ctx());
    const logo = input.fields.find((f) => f.fieldKey === "logo");
    expect(logo?.static).toBe(true);
    expect(logo?.staticValue).toBe("brand-assets/co-1/logo/1-acme.png");
    const frame = input.fields.find((f) => f.fieldKey === "logo_frame");
    expect(frame?.strokeColor).toBe(NEUTRALS_LIGHT.border);
    expect(frame?.strokeWidthPx).toBe(1);
  });

  it("omits the logo and its frame when the tenant has none", () => {
    const input = materializeStarter(STARTER_BLUEPRINTS[0], ctx({ logoAssetRef: undefined }));
    expect(input.fields.some((f) => f.fieldKey === "logo")).toBe(false);
    expect(input.fields.some((f) => f.fieldKey === "logo_frame")).toBe(false);
  });

  it("keeps the partnership logo slot editable when the tenant has no logo", () => {
    const partnership = STARTER_BLUEPRINTS.find((b) => b.starterKey === "partnership-04")!;
    const input = materializeStarter(partnership, ctx({ logoAssetRef: undefined }));
    const logo = input.fields.find((f) => f.fieldKey === "logo");
    expect(logo).toBeDefined();
    expect(logo?.static).toBeUndefined();
    expect(logo?.placeholder).toBe("Add your logo");
    expect(input.fields.some((f) => f.fieldKey === "logo_frame")).toBe(true);
  });

  it("drops URL fields when the tenant has no website", () => {
    const noSite = ctx({ company: { id: "co-1", name: "Acme Studios" } });
    for (const blueprint of STARTER_BLUEPRINTS) {
      const input = materializeStarter(blueprint, noSite);
      expect(
        input.fields.some((f) => f.fieldKey === "url"),
        blueprint.starterKey,
      ).toBe(false);
    }
  });

  it("rewrites the event CTA without the website clause", () => {
    const event = STARTER_BLUEPRINTS.find((b) => b.starterKey === "event-06")!;
    const noSite = ctx({ company: { id: "co-1", name: "Acme Studios" } });
    const cta = materializeStarter(event, noSite).fields.find((f) => f.fieldKey === "cta");
    expect(cta?.placeholder).toBe("Save your seat");
  });

  it("fills text tokens with the company name and website", () => {
    const input = materializeStarter(STARTER_BLUEPRINTS[0], ctx());
    expect(input.captionTemplate).toBe("Acme Studios just launched something new.");
    const url = input.fields.find((f) => f.fieldKey === "url");
    expect(url?.staticValue).toBe("acme.com/launch");
  });

  it("keeps shrink guardrails under a very long company name", () => {
    const partnership = STARTER_BLUEPRINTS.find((b) => b.starterKey === "partnership-04")!;
    const long = ctx({
      company: {
        id: "co-1",
        name: "The Extremely Long Multinational Conglomerate of Amalgamated Industries",
        website: "acme.com",
      },
    });
    const headline = materializeStarter(partnership, long).fields.find(
      (f) => f.fieldKey === "headline",
    );
    expect(headline?.placeholder).toContain("Amalgamated Industries");
    expect(headline?.textSizing).toBe("shrink");
    expect(headline?.minFontSizePx).toBe(31);
  });

  it("ships Light as the default variant and Dark with only appearance keys", () => {
    const appearance = new Set(["colorHex", "plateColor", "strokeColor"]);
    for (const blueprint of STARTER_BLUEPRINTS) {
      const input = materializeStarter(blueprint, ctx());
      expect(input.variants).toHaveLength(2);
      const [light, dark] = input.variants!;
      expect(light).toMatchObject({ id: "light", isDefault: true, overrides: {} });
      expect(dark.id).toBe("dark");
      expect(dark.backgroundColor).toBe(NEUTRALS_DARK.surface);
      for (const [fieldKey, over] of Object.entries(dark.overrides)) {
        expect(Object.keys(over).length, `${blueprint.starterKey}:${fieldKey}`).toBeGreaterThan(0);
        for (const key of Object.keys(over)) {
          expect(appearance.has(key), `${blueprint.starterKey}:${fieldKey}:${key}`).toBe(true);
        }
      }
    }
  });

  it("recolors the CTA plate and the logo-slot border in Dark", () => {
    const input = materializeStarter(STARTER_BLUEPRINTS[0], ctx());
    const dark = input.variants!.find((v) => v.id === "dark")!;
    const slots = resolveSlots(REFERENCE_COLORS);
    expect(dark.overrides.cta?.plateColor).toBe(slots.dark.accent);
    // Only keys that DIFFER between colorways are written: for this palette
    // both onAccent values resolve to the same near-black, so no colorHex
    // override exists — the merge falls through to the shared base value.
    if (slots.dark.onAccent !== slots.light.onAccent) {
      expect(dark.overrides.cta?.colorHex).toBe(slots.dark.onAccent);
    } else {
      expect(dark.overrides.cta?.colorHex).toBeUndefined();
    }
    expect(dark.overrides.logo_frame?.strokeColor).toBe(NEUTRALS_DARK.border);
  });

  it("bakes literal hexes only: no slot names leak into fields", () => {
    const slotNames = new Set([
      "surface",
      "surfaceAlt",
      "ink",
      "inkMuted",
      "accent",
      "onAccent",
      "border",
    ]);
    for (const blueprint of STARTER_BLUEPRINTS) {
      const input = materializeStarter(blueprint, ctx());
      for (const f of input.fields) {
        for (const v of [f.colorHex, f.plateColor, f.strokeColor]) {
          if (v !== undefined) expect(slotNames.has(v)).toBe(false);
        }
      }
    }
  });
});

describe("variant merge: plateColor and strokeColor overrides", () => {
  const base: TemplateField = {
    id: "f1",
    label: "CTA",
    type: "text",
    fieldKey: "cta",
    x: 10,
    y: 20,
    width: 300,
    height: 80,
    plateColor: "#AA0000",
    platePaddingX: 32,
    platePaddingY: 22,
    strokeColor: "#00AA00",
    strokeWidthPx: 2,
    colorHex: "#FFFFFF",
    fontFamily: "Inter",
    fontSizePx: 26,
  };
  const variant = {
    id: "dark",
    name: "Dark",
    overrides: { cta: { plateColor: "#BB1111", strokeColor: "#11BB11" } },
  };

  it("recolors the plate and the stroke", () => {
    const merged = applyVariant(base, variant);
    expect(merged.plateColor).toBe("#BB1111");
    expect(merged.strokeColor).toBe("#11BB11");
  });

  it("passes every other property through untouched", () => {
    const merged = applyVariant(base, variant);
    const { plateColor: _p1, strokeColor: _s1, ...restMerged } = merged;
    const { plateColor: _p2, strokeColor: _s2, ...restBase } = base;
    expect(restMerged).toEqual(restBase);
  });

  it("ignores structural keys smuggled into a stored override blob", () => {
    const smuggled = {
      id: "dark",
      name: "Dark",
      overrides: {
        cta: { plateColor: "#BB1111", platePaddingX: 99, strokeWidthPx: 9, x: 0 },
      },
    };
    const merged = applyVariant(base, smuggled as unknown as typeof variant);
    expect(merged.plateColor).toBe("#BB1111");
    expect(merged.platePaddingX).toBe(32);
    expect(merged.strokeWidthPx).toBe(2);
    expect(merged.x).toBe(10);
  });
});
