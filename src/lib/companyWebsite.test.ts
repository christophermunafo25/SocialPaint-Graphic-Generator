import { describe, expect, it } from "vitest";
import { normalizeWebsite, websiteUrl } from "./companyWebsite";

describe("normalizeWebsite", () => {
  it("accepts a bare domain unchanged", () => {
    expect(normalizeWebsite("acme.com")).toBe("acme.com");
  });

  it("strips the protocol", () => {
    expect(normalizeWebsite("https://acme.com")).toBe("acme.com");
    expect(normalizeWebsite("http://acme.com")).toBe("acme.com");
  });

  it("lowercases the host but keeps the path's case", () => {
    expect(normalizeWebsite("HTTPS://Acme.COM/Studio")).toBe("acme.com/Studio");
  });

  it("keeps a path, drops query and fragment, trims trailing slashes", () => {
    expect(normalizeWebsite("acme.com/studio?utm=x#top")).toBe("acme.com/studio");
    expect(normalizeWebsite("acme.com/")).toBe("acme.com");
    expect(normalizeWebsite("acme.com/studio/")).toBe("acme.com/studio");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeWebsite("  acme.com  ")).toBe("acme.com");
  });

  it("accepts subdomains and multi-label hosts", () => {
    expect(normalizeWebsite("www.shop.acme.co.uk")).toBe("www.shop.acme.co.uk");
  });

  it("rejects things that are not a domain", () => {
    expect(normalizeWebsite("")).toBeNull();
    expect(normalizeWebsite("   ")).toBeNull();
    expect(normalizeWebsite("not a url")).toBeNull();
    expect(normalizeWebsite("acme")).toBeNull();
    expect(normalizeWebsite("localhost")).toBeNull();
    expect(normalizeWebsite("127.0.0.1")).toBeNull();
    expect(normalizeWebsite("-bad-.com")).toBeNull();
  });

  it("rejects non-http protocols and credentials", () => {
    expect(normalizeWebsite("ftp://acme.com")).toBeNull();
    expect(normalizeWebsite("javascript:alert(1)")).toBeNull();
    expect(normalizeWebsite("https://user:pass@acme.com")).toBeNull();
    expect(normalizeWebsite("https://acme.com:8080")).toBeNull();
  });
});

describe("websiteUrl", () => {
  it("prefixes https", () => {
    expect(websiteUrl("acme.com/studio")).toBe("https://acme.com/studio");
  });
});
