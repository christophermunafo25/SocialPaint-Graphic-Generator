import { describe, expect, it } from "vitest";
import { routeFor, verdictFor, type VerdictFixture } from "./fidelityVerdict";

describe("routeFor", () => {
  it("renders a light starter by its blueprint key", () => {
    expect(routeFor({ name: "starter-launch-01", kind: "starter" })).toBe(
      "/dev/render/starter-launch-01",
    );
  });

  it("strips the variant suffix and passes the colourway", () => {
    expect(routeFor({ name: "starter-stat-05-dark", kind: "starter", variantId: "dark" })).toBe(
      "/dev/render/starter-stat-05?variant=dark",
    );
  });

  it("keeps a key that merely ends like a variant when no variant is set", () => {
    expect(routeFor({ name: "starter-event-06-dark", kind: "starter" })).toBe(
      "/dev/render/starter-event-06-dark",
    );
  });

  it("renders a figma fixture by its own name, ignoring variantId", () => {
    expect(routeFor({ name: "gtm-composer", kind: "figma", variantId: "dark" })).toBe(
      "/dev/render/gtm-composer",
    );
  });
});

describe("verdictFor", () => {
  const fixture: VerdictFixture = {
    name: "f",
    kind: "figma",
    baseline: { chromium: 4.49, firefox: 4.37 },
  };
  const rendered = { status: "rendered", file: "f.png" } as const;
  const at = (changedPct: number, sizeMatches = true) => ({ changedPct, sizeMatches });

  it("passes within the default 0.25 tolerance either side", () => {
    expect(verdictFor(fixture, "chromium", rendered, at(4.74), true)).toEqual({
      verdict: "pass",
      failed: false,
    });
    expect(verdictFor(fixture, "chromium", rendered, at(4.24), true).verdict).toBe("pass");
  });

  it("fails past the tolerance and reports a clear improvement without failing", () => {
    expect(verdictFor(fixture, "chromium", rendered, at(4.75), false)).toEqual({
      verdict: "worse",
      failed: true,
    });
    expect(verdictFor(fixture, "chromium", rendered, at(4.2), true)).toEqual({
      verdict: "better",
      failed: false,
    });
  });

  it("uses the fixture's own tolerance", () => {
    const loose = { ...fixture, tolerance: 1 };
    expect(verdictFor(loose, "chromium", rendered, at(5.4), true).verdict).toBe("pass");
  });

  it("fails a size change whatever the share", () => {
    expect(verdictFor(fixture, "chromium", rendered, at(0, false), false)).toEqual({
      verdict: "size",
      failed: true,
    });
  });

  it("fails a render error and never fails a missing font", () => {
    expect(verdictFor(fixture, "webkit", { status: "error", message: "x" }, null, false)).toEqual({
      verdict: "error",
      failed: true,
    });
    expect(
      verdictFor(fixture, "webkit", { status: "skipped", reason: "missing font" }, null, true),
    ).toEqual({ verdict: "skipped", failed: false });
  });

  it("fails a missing golden or baseline only when strict", () => {
    expect(verdictFor(fixture, "chromium", rendered, null, true)).toEqual({
      verdict: "no golden",
      failed: true,
    });
    expect(verdictFor(fixture, "chromium", rendered, null, false).failed).toBe(false);
    expect(verdictFor(fixture, "webkit", rendered, at(1), true)).toEqual({
      verdict: "no baseline",
      failed: true,
    });
    expect(verdictFor(fixture, "webkit", rendered, at(1), false).failed).toBe(false);
  });

  it("fails a worse blurred share only where the fixture has a blur baseline", () => {
    const blurred: VerdictFixture = { ...fixture, blurBaseline: { chromium: 2 } };
    const atBlur = (changedPct: number, blurPct: number) => ({
      changedPct,
      blurPct,
      sizeMatches: true,
    });
    expect(verdictFor(blurred, "chromium", rendered, atBlur(4.49, 2.2), true).verdict).toBe("pass");
    expect(verdictFor(blurred, "chromium", rendered, atBlur(4.49, 2.3), true)).toEqual({
      verdict: "worse",
      failed: true,
    });
    // Firefox has an exact baseline but no blurred one: judged on the exact share.
    expect(verdictFor(blurred, "firefox", rendered, atBlur(4.37, 50), true).verdict).toBe("pass");
  });
});
