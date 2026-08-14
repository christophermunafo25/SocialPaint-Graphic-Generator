import { describe, expect, it } from "vitest";
import { originAllowed, originMatchesEntry } from "./http.ts";

const CSV =
  "https://www.socialpaint.ai,https://socialpaint.ai,https://socialpaint-graphic-generator-*.vercel.app,http://localhost:*";

describe("originMatchesEntry", () => {
  it("matches exact origins only", () => {
    expect(originMatchesEntry("https://www.socialpaint.ai", "https://www.socialpaint.ai")).toBe(
      true,
    );
    expect(
      originMatchesEntry("https://www.socialpaint.ai", "https://www.socialpaint.ai.evil.com"),
    ).toBe(false);
    expect(originMatchesEntry("https://www.socialpaint.ai", "https://evil.com")).toBe(false);
  });

  it("wildcard matches one run of [A-Za-z0-9-], never a dot or slash", () => {
    const entry = "https://socialpaint-graphic-generator-*.vercel.app";
    expect(
      originMatchesEntry(entry, "https://socialpaint-graphic-generator-abc123-team.vercel.app"),
    ).toBe(true);
    expect(
      originMatchesEntry(entry, "https://socialpaint-graphic-generator-x.evil.vercel.app"),
    ).toBe(false);
    expect(originMatchesEntry(entry, "https://socialpaint-graphic-generator-.vercel.app")).toBe(
      false,
    );
    expect(
      originMatchesEntry(entry, "https://socialpaint-graphic-generator-a.vercel.app.evil.com"),
    ).toBe(false);
  });

  it("wildcard covers localhost ports", () => {
    expect(originMatchesEntry("http://localhost:*", "http://localhost:5173")).toBe(true);
    expect(originMatchesEntry("http://localhost:*", "http://localhost:5173.evil.com")).toBe(false);
    expect(originMatchesEntry("http://localhost:*", "https://localhost:5173")).toBe(false);
  });

  it("dots in entries are literal, not regex wildcards", () => {
    expect(originMatchesEntry("https://socialpaint.ai", "https://socialpaintxai")).toBe(false);
  });

  it("empty entries never match", () => {
    expect(originMatchesEntry("", "")).toBe(false);
    expect(originMatchesEntry(" ", "")).toBe(false);
  });
});

describe("originAllowed", () => {
  it("accepts each configured origin and rejects strangers", () => {
    expect(originAllowed(CSV, "https://www.socialpaint.ai")).toBe(true);
    expect(originAllowed(CSV, "https://socialpaint.ai")).toBe(true);
    expect(originAllowed(CSV, "http://localhost:5173")).toBe(true);
    expect(originAllowed(CSV, "https://evil.example")).toBe(false);
    expect(originAllowed(CSV, "null")).toBe(false);
  });

  it("fails closed on an empty allowlist or missing origin", () => {
    expect(originAllowed("", "https://www.socialpaint.ai")).toBe(false);
    expect(originAllowed(CSV, "")).toBe(false);
  });

  it("tolerates whitespace around entries", () => {
    expect(originAllowed("https://a.example , https://b.example", "https://b.example")).toBe(true);
  });
});
