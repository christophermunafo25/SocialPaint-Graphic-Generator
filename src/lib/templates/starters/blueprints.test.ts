import { describe, expect, it } from "vitest";
import { STARTER_BLUEPRINTS } from "./index";
import { TEXT_TOKENS } from "./types";

describe("starter blueprints", () => {
  it("ships exactly six starters with unique keys", () => {
    expect(STARTER_BLUEPRINTS).toHaveLength(6);
    const keys = STARTER_BLUEPRINTS.map((b) => b.starterKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("keeps fieldKeys unique within each blueprint", () => {
    for (const b of STARTER_BLUEPRINTS) {
      const keys = b.fields.map((f) => f.fieldKey);
      expect(new Set(keys).size, b.starterKey).toBe(keys.length);
    }
  });

  it("matches the Appendix A canvas sizes", () => {
    const sizes = Object.fromEntries(
      STARTER_BLUEPRINTS.map((b) => [b.starterKey, [b.canvasWidth, b.canvasHeight]]),
    );
    expect(sizes).toEqual({
      "launch-01": [1080, 1350],
      "feature-02": [1080, 1080],
      "milestone-03": [1600, 900],
      "partnership-04": [1200, 630],
      "stat-05": [1080, 1080],
      "event-06": [1080, 1920],
    });
  });

  it("uses only the two sanctioned text tokens", () => {
    const tokenRe = /\{[^}]+\}/g;
    for (const b of STARTER_BLUEPRINTS) {
      const texts = [
        b.captionTemplate,
        ...b.fields.flatMap((f) => [f.staticValue, f.placeholder, f.placeholderNoWebsite]),
      ].filter((t): t is string => Boolean(t));
      for (const text of texts) {
        for (const token of text.match(tokenRe) ?? []) {
          expect(TEXT_TOKENS).toContain(token);
        }
      }
    }
  });

  it("points every omitWith at a real sibling", () => {
    for (const b of STARTER_BLUEPRINTS) {
      const keys = new Set(b.fields.map((f) => f.fieldKey));
      for (const f of b.fields) {
        if (f.omitWith) expect(keys.has(f.omitWith), `${b.starterKey}:${f.fieldKey}`).toBe(true);
      }
    }
  });

  it("gives every shrink field a floor at 60% of its ramp size", () => {
    for (const b of STARTER_BLUEPRINTS) {
      for (const f of b.fields) {
        if (f.textSizing !== "shrink") continue;
        expect(f.minFontSizePx, `${b.starterKey}:${f.fieldKey}`).toBe(
          Math.round((f.fontSizePx ?? 0) * 0.6),
        );
      }
    }
  });
});
