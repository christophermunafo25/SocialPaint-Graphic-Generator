import { describe, expect, it } from "vitest";
import { PUBLIC_LINK_PREFIX, publicLinkToken, publicLinkUrl } from "./route";

describe("publicLinkToken", () => {
  it("reads the token from a public-link path", () => {
    expect(publicLinkToken("/l/AbC-123_xyz")).toBe("AbC-123_xyz");
  });

  it("returns null for every normal app route", () => {
    // main.tsx branches on this, so a false positive here would send a
    // signed-in member to the anonymous page.
    for (const path of [
      "/",
      "/templates",
      "/templates/8f1c0f5e-1111-4444-8888-aaaaaaaaaaaa",
      "/template-builder/new",
      "/brand-studio/colors",
      "/insights",
      "/settings",
      "/login",
    ]) {
      expect(publicLinkToken(path)).toBeNull();
    }
  });

  it("takes only the first segment, so nothing rides along behind the token", () => {
    expect(publicLinkToken("/l/TOKEN/../../admin")).toBe("TOKEN");
    expect(publicLinkToken("/l/TOKEN/anything")).toBe("TOKEN");
    expect(publicLinkToken("/l/TOKEN/")).toBe("TOKEN");
  });

  it("returns null for an empty or absent token", () => {
    expect(publicLinkToken("/l/")).toBeNull();
    expect(publicLinkToken("/l")).toBeNull();
    expect(publicLinkToken("")).toBeNull();
  });

  it("decodes a percent-encoded token and survives a malformed escape", () => {
    expect(publicLinkToken("/l/a%2Db")).toBe("a-b");
    // A broken escape is not a token; it takes the same unavailable page a
    // revoked one does rather than throwing into a blank tab.
    expect(publicLinkToken("/l/%E0%A4%A")).toBeNull();
  });

  it("refuses an absurdly long path segment", () => {
    expect(publicLinkToken(`/l/${"x".repeat(257)}`)).toBeNull();
    expect(publicLinkToken(`/l/${"x".repeat(256)}`)).toHaveLength(256);
  });
});

describe("publicLinkUrl", () => {
  it("puts the token in the path, never a query string", () => {
    const url = publicLinkUrl("https://app.example.com", "AbC-123_xyz");
    expect(url).toBe("https://app.example.com/l/AbC-123_xyz");
    expect(url).not.toContain("?");
  });

  it("round-trips through the parser", () => {
    const token = "AbC-123_xyz";
    const url = new URL(publicLinkUrl("https://app.example.com", token));
    expect(publicLinkToken(url.pathname)).toBe(token);
  });

  it("uses the shared prefix", () => {
    expect(publicLinkUrl("https://x.test", "t")).toContain(PUBLIC_LINK_PREFIX);
  });
});
