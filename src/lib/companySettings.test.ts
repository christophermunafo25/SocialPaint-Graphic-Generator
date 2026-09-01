import { describe, expect, it } from "vitest";
import { isValidSlug, toSlug } from "./companySettings";

describe("slug rules — the same ones onboarding's create applies", () => {
  it("lowercases and collapses runs of anything else to single dashes", () => {
    expect(toSlug("Acme Coffee Co.")).toBe("acme-coffee-co");
    expect(toSlug("  spaced   out  ")).toBe("spaced-out");
    expect(toSlug("Émile & Sons")).toBe("mile-sons");
  });

  it("strips leading and trailing dashes", () => {
    expect(toSlug("-already-dashed-")).toBe("already-dashed");
    expect(toSlug("!!!")).toBe("");
  });

  it("accepts exactly the strings normalization leaves untouched", () => {
    expect(isValidSlug("acme-coffee-co")).toBe(true);
    expect(isValidSlug("a1")).toBe(true);
    expect(isValidSlug("")).toBe(false);
    expect(isValidSlug("Has-Caps")).toBe(false);
    expect(isValidSlug("double--dash")).toBe(false);
    expect(isValidSlug("-leading")).toBe(false);
  });
});
