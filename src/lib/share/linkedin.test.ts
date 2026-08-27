import { describe, expect, it } from "vitest";
import { MAX_POST_CHARS, linkedInComposerUrl } from "./linkedin";

describe("linkedInComposerUrl", () => {
  it("targets the composer, not the link-share endpoint", () => {
    // /sharing/share-offsite/ accepts a URL and cannot carry a caption at
    // all, which is the whole reason this feature exists.
    const url = new URL(linkedInComposerUrl("Hello"));
    expect(url.origin + url.pathname).toBe("https://www.linkedin.com/feed/");
    expect(url.searchParams.get("shareActive")).toBe("true");
  });

  it("carries the caption", () => {
    const url = new URL(linkedInComposerUrl("Thrilled to be speaking at the conference!"));
    expect(url.searchParams.get("text")).toBe("Thrilled to be speaking at the conference!");
  });

  it("encodes characters a caption really contains", () => {
    const caption = "Ada & Grace — 100% ready! #conf2026 @everyone\nSee you there ✨";
    const url = new URL(linkedInComposerUrl(caption));
    // Round-tripping is what matters, not the exact escaping.
    expect(url.searchParams.get("text")).toBe(caption);
    expect(url.href).not.toContain("\n");
  });

  it("trims surrounding whitespace", () => {
    const url = new URL(linkedInComposerUrl("  padded  "));
    expect(url.searchParams.get("text")).toBe("padded");
  });

  it("omits the parameter entirely for an empty caption", () => {
    // A blank `text=` is worse than none: it can leave the composer in a
    // state that looks filled but isn't.
    for (const empty of ["", "   ", "\n"]) {
      const url = new URL(linkedInComposerUrl(empty));
      expect(url.searchParams.has("text")).toBe(false);
      expect(url.searchParams.get("shareActive")).toBe("true");
    }
  });

  it("truncates to LinkedIn's post limit", () => {
    const url = new URL(linkedInComposerUrl("x".repeat(5000)));
    expect(url.searchParams.get("text")).toHaveLength(MAX_POST_CHARS);
    expect(MAX_POST_CHARS).toBeLessThan(3000);
  });

  it("produces a URL every browser will accept", () => {
    // Even at the cap, with worst-case escaping, the URL stays well inside
    // the ~32k a browser handles and the ~8k a server typically accepts.
    expect(linkedInComposerUrl("✨".repeat(MAX_POST_CHARS)).length).toBeLessThan(30_000);
  });
});
