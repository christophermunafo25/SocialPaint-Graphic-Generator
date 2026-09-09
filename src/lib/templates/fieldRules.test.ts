import { describe, expect, it } from "vitest";
import { isRequiredField } from "./fieldRules";

describe("isRequiredField", () => {
  it("does not require fixed text", () => {
    expect(isRequiredField({ type: "text", static: true })).toBe(false);
    expect(isRequiredField({ type: "multiline", static: true })).toBe(false);
  });

  it("requires non-fixed text, multiline, and dropdown fields", () => {
    expect(isRequiredField({ type: "text" })).toBe(true);
    expect(isRequiredField({ type: "multiline", static: undefined })).toBe(true);
    expect(isRequiredField({ type: "select", static: false })).toBe(true);
  });

  it("never requires a shape, fixed or not", () => {
    expect(isRequiredField({ type: "shape", static: true })).toBe(false);
    expect(isRequiredField({ type: "shape" })).toBe(false);
  });

  it("requires a non-fixed image", () => {
    expect(isRequiredField({ type: "image" })).toBe(true);
  });

  it("does not require a fixed image", () => {
    expect(isRequiredField({ type: "image", static: true })).toBe(false);
  });
});
