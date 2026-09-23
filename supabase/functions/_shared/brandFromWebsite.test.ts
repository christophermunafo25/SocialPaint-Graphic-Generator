import { describe, expect, it } from "vitest";
import {
  BrandExtractionError,
  cleanFontFamily,
  extractEvidence,
  isAllowedLogoHost,
  isPrivateAddress,
  isTargetProblem,
  parseTargetUrl,
  validateExtraction,
} from "./brandFromWebsite.ts";

describe("parseTargetUrl", () => {
  it("accepts a bare domain and upgrades to https", () => {
    const url = parseTargetUrl("acme.com/about");
    expect(isTargetProblem(url)).toBe(false);
    expect((url as URL).toString()).toBe("https://acme.com/about");
  });
  it("upgrades http to https", () => {
    const url = parseTargetUrl("http://acme.com");
    expect((url as URL).protocol).toBe("https:");
  });
  it("refuses non-http protocols, credentials, and odd ports", () => {
    expect(isTargetProblem(parseTargetUrl("ftp://acme.com"))).toBe(true);
    expect(isTargetProblem(parseTargetUrl("https://user:pw@acme.com"))).toBe(true);
    expect(isTargetProblem(parseTargetUrl("https://acme.com:8443"))).toBe(true);
  });
  it("refuses IP literals and dotless hosts", () => {
    expect(isTargetProblem(parseTargetUrl("https://127.0.0.1"))).toBe(true);
    expect(isTargetProblem(parseTargetUrl("https://10.0.0.5/x"))).toBe(true);
    expect(isTargetProblem(parseTargetUrl("https://localhost"))).toBe(true);
    expect(isTargetProblem(parseTargetUrl("https://[::1]/"))).toBe(true);
  });
});

describe("isPrivateAddress", () => {
  it("flags loopback, private, link-local, CGNAT, and reserved v4", () => {
    for (const ip of [
      "127.0.0.1",
      "10.1.2.3",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "224.0.0.1",
      "::ffff:192.168.0.1",
    ]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });
  it("flags v6 loopback, link-local, and ULA", () => {
    for (const ip of ["::1", "::", "fe80::1", "fc00::1", "fd12:3456::1"]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });
  it("passes public addresses", () => {
    for (const ip of ["93.184.216.34", "1.1.1.1", "172.32.0.1", "2606:2800:220:1::1"]) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });
});

describe("isAllowedLogoHost", () => {
  it("allows same host and subdomains either way", () => {
    expect(isAllowedLogoHost("acme.com", "acme.com")).toBe(true);
    expect(isAllowedLogoHost("cdn.acme.com", "acme.com")).toBe(true);
    expect(isAllowedLogoHost("acme.com", "www.acme.com")).toBe(true);
  });
  it("refuses everything else", () => {
    expect(isAllowedLogoHost("evil.com", "acme.com")).toBe(false);
    expect(isAllowedLogoHost("notacme.com", "acme.com")).toBe(false);
  });
});

describe("extractEvidence", () => {
  const page = new URL("https://acme.com/");
  const html = `
    <html><head>
      <title>Acme &amp; Co</title>
      <meta property="og:site_name" content="Acme Studios">
      <meta property="og:image" content="https://acme.com/og.png">
      <meta name="theme-color" content="#123456">
      <link rel="icon" href="/favicon.svg">
      <link rel="apple-touch-icon" href="/touch.png">
      <link rel="stylesheet" href="/main.css">
      <link rel="stylesheet" href="https://cdn.other.com/vendor.css">
      <style>:root{--brand:#ABCDEF}</style>
    </head><body></body></html>`;
  it("reads title, meta, icons, same-origin stylesheets, inline css", () => {
    const e = extractEvidence(html, page);
    expect(e.title).toBe("Acme & Co");
    expect(e.siteName).toBe("Acme Studios");
    expect(e.ogImage).toBe("https://acme.com/og.png");
    expect(e.themeColor).toBe("#123456");
    expect(e.icons).toEqual(["/favicon.svg", "/touch.png"]);
    expect(e.stylesheets).toEqual(["https://acme.com/main.css"]);
    expect(e.inlineCss).toContain("--brand:#ABCDEF");
  });
});

describe("cleanFontFamily", () => {
  it("strips quotes and fallback lists", () => {
    expect(cleanFontFamily('"Neue Haas", Helvetica, sans-serif')).toBe("Neue Haas");
    expect(cleanFontFamily("Inter")).toBe("Inter");
  });
  it("rejects generics, junk, and over-length names", () => {
    expect(cleanFontFamily("sans-serif")).toBeNull();
    expect(cleanFontFamily("<script>")).toBeNull();
    expect(cleanFontFamily("x".repeat(41))).toBeNull();
    expect(cleanFontFamily(42)).toBeNull();
  });
});

describe("validateExtraction", () => {
  const good = {
    companyName: "Acme Studios",
    colors: [
      { hex: "#112233", role: "primary", name: "Navy" },
      { hex: "#ff9900", role: "accent", name: "Orange" },
    ],
    headingFont: '"Archivo", sans-serif',
    bodyFont: null,
    logoUrl: "https://cdn.acme.com/logo.svg",
  };

  it("cleans and passes a good extraction", () => {
    const out = validateExtraction(good, "acme.com");
    expect(out.companyName).toBe("Acme Studios");
    expect(out.colors).toEqual([
      { hex: "#112233", role: "primary", name: "Navy" },
      { hex: "#FF9900", role: "accent", name: "Orange" },
    ]);
    expect(out.headingFont).toBe("Archivo");
    expect(out.bodyFont).toBeNull();
    expect(out.logoUrl).toBe("https://cdn.acme.com/logo.svg");
  });

  it("dedupes and caps colors at 8", () => {
    const colors = Array.from({ length: 12 }, (_, i) => ({
      hex: `#00000${(i % 10).toString(16).toUpperCase()}`,
      role: "primary",
      name: `c${i}`,
    }));
    const out = validateExtraction({ ...good, colors }, "acme.com");
    expect(out.colors.length).toBeLessThanOrEqual(8);
    expect(new Set(out.colors.map((c) => c.hex)).size).toBe(out.colors.length);
  });

  it("rejects bad hexes, roles, off-domain logos, and empty names", () => {
    expect(() =>
      validateExtraction(
        { ...good, colors: [{ hex: "red", role: "primary", name: "x" }] },
        "acme.com",
      ),
    ).toThrow(BrandExtractionError);
    expect(() =>
      validateExtraction(
        { ...good, colors: [{ hex: "#112233", role: "brandest", name: "x" }] },
        "acme.com",
      ),
    ).toThrow(BrandExtractionError);
    expect(() =>
      validateExtraction({ ...good, logoUrl: "https://evil.com/logo.png" }, "acme.com"),
    ).toThrow(BrandExtractionError);
    expect(() => validateExtraction({ ...good, companyName: "" }, "acme.com")).toThrow(
      BrandExtractionError,
    );
  });

  it("collects every problem for the retry round", () => {
    try {
      validateExtraction({ companyName: "", colors: [], logoUrl: "nope" }, "acme.com");
      expect.unreachable();
    } catch (e) {
      expect((e as BrandExtractionError).errors.length).toBeGreaterThanOrEqual(3);
    }
  });
});
