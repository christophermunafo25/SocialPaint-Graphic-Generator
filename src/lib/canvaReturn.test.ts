import { describe, expect, it } from "vitest";
import { readCanvaReturn } from "./canvaReturn";

describe("readCanvaReturn", () => {
  it("reads a cleanly merged return", () => {
    expect(readCanvaReturn("?canva_oauth=1&code=abc&state=xyz", false)).toEqual({
      code: "abc",
      state: "xyz",
    });
  });

  it("reads a return where the server appended a second question mark", () => {
    expect(readCanvaReturn("?canva_oauth=1?code=abc&state=xyz", false)).toEqual({
      code: "abc",
      state: "xyz",
    });
  });

  it("reads a return where the server dropped our query, only if this tab started it", () => {
    expect(readCanvaReturn("?code=abc&state=xyz", true)).toEqual({ code: "abc", state: "xyz" });
    expect(readCanvaReturn("?code=abc&state=xyz", false)).toBeNull();
  });

  it("treats the marker without a code as cancelled, not as no return", () => {
    expect(readCanvaReturn("?canva_oauth=1", false)).toEqual({});
    expect(readCanvaReturn("?canva_oauth=1&error=access_denied", true)).toEqual({});
  });

  it("decodes values and ignores unrelated queries", () => {
    expect(readCanvaReturn("?canva_oauth=1&code=a%2Fb&state=s%3D1", false)).toEqual({
      code: "a/b",
      state: "s=1",
    });
    expect(readCanvaReturn("?foo=1", true)).toBeNull();
    expect(readCanvaReturn("", true)).toBeNull();
    expect(readCanvaReturn("?canva_oauth=10&code=a&state=b", false)).toBeNull();
  });
});
