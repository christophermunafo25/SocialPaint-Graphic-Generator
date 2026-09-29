import { describe, expect, it } from "vitest";
import { isRequiredField } from "./fieldRules";
// The Deno copy, imported without its extension so tsc accepts it. The same
// table runs against both so the two can never drift apart.
import { isRequiredField as isRequiredFieldDeno } from "../../../supabase/functions/_shared/fieldRules";

type Case = [
  name: string,
  field: {
    type: "text" | "multiline" | "select" | "image" | "shape";
    static?: boolean;
    optional?: boolean;
  },
  required: boolean,
];

const CASES: Case[] = [
  ["fixed text", { type: "text", static: true }, false],
  ["fixed multiline", { type: "multiline", static: true }, false],
  ["non-fixed text", { type: "text" }, true],
  ["non-fixed multiline", { type: "multiline", static: undefined }, true],
  ["non-fixed dropdown", { type: "select", static: false }, true],
  ["a fixed shape", { type: "shape", static: true }, false],
  ["a shape", { type: "shape" }, false],
  ["a non-fixed image", { type: "image" }, true],
  ["a fixed image", { type: "image", static: true }, false],
  ["optional text", { type: "text", optional: true }, false],
  ["optional multiline", { type: "multiline", optional: true }, false],
  ["an optional dropdown", { type: "select", optional: true }, false],
  ["an optional image", { type: "image", optional: true }, false],
  ["text with optional explicitly off", { type: "text", optional: false }, true],
  ["fixed and optional text", { type: "text", static: true, optional: true }, false],
];

describe.each([
  ["src", isRequiredField],
  ["deno", isRequiredFieldDeno],
])("isRequiredField (%s copy)", (_copy, fn) => {
  it.each(CASES)("%s", (_name, field, required) => {
    expect(fn(field)).toBe(required);
  });
});
