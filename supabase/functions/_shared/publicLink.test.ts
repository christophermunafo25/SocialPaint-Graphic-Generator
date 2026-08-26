import { describe, expect, it } from "vitest";
import {
  MAX_TOKEN_CHARS,
  TOKEN_BYTES,
  clientIp,
  fontAssetFamily,
  hashToken,
  mintToken,
  parseStorageRef,
  refWithImpliedBucket,
  referencedColorKeys,
  referencedFontFamilies,
  referencedTypeStyleKeys,
  schemaAssetRefs,
} from "./publicLink.ts";

describe("mintToken", () => {
  it("produces 256 bits as url-safe base64 with no padding", () => {
    const token = mintToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    // 32 bytes → ceil(32/3)*4 = 44 chars, minus one '=' of padding.
    expect(token).toHaveLength(43);
    expect(TOKEN_BYTES).toBe(32);
    expect(token.length).toBeLessThan(MAX_TOKEN_CHARS);
  });

  it("does not repeat", () => {
    const seen = new Set(Array.from({ length: 500 }, () => mintToken()));
    expect(seen.size).toBe(500);
  });
});

describe("hashToken", () => {
  it("is sha-256 hex", async () => {
    // Known vector: sha256("abc").
    expect(await hashToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("gives different tokens different hashes", async () => {
    const a = await hashToken(mintToken());
    const b = await hashToken(mintToken());
    expect(a).not.toBe(b);
    expect(a).toHaveLength(64);
  });
});

describe("parseStorageRef", () => {
  it("parses bucket-qualified references", () => {
    expect(parseStorageRef("brand-assets/co-uuid/logo.png")).toEqual({
      bucket: "brand-assets",
      path: "co-uuid/logo.png",
    });
    expect(parseStorageRef("template-backgrounds/co-uuid/bg.png")).toEqual({
      bucket: "template-backgrounds",
      path: "co-uuid/bg.png",
    });
  });

  it("parses the legacy public-URL form", () => {
    expect(
      parseStorageRef("https://x.supabase.co/storage/v1/object/public/brand-assets/a/b.png"),
    ).toEqual({ bucket: "brand-assets", path: "a/b.png" });
  });

  it("does NOT match a signed URL", () => {
    // Load-bearing: the payload replaces references with signed URLs, and the
    // browser's resolver must let those through untouched rather than trying
    // to sign them again with an anonymous client.
    expect(
      parseStorageRef(
        "https://x.supabase.co/storage/v1/object/sign/brand-assets/a/b.png?token=eyJ",
      ),
    ).toBeNull();
  });

  it("returns null for anything that is not one of our objects", () => {
    expect(parseStorageRef("data:image/png;base64,AAAA")).toBeNull();
    expect(parseStorageRef("https://cdn.example.com/logo.png")).toBeNull();
    expect(parseStorageRef("")).toBeNull();
    expect(parseStorageRef(null)).toBeNull();
    expect(parseStorageRef("brand-assets/")).toBeNull();
  });
});

describe("refWithImpliedBucket", () => {
  it("gives a bare legacy path the column's bucket", () => {
    expect(refWithImpliedBucket("template-backgrounds", "co-uuid/bg.png")).toEqual({
      bucket: "template-backgrounds",
      path: "co-uuid/bg.png",
    });
  });

  it("leaves a genuinely external URL alone", () => {
    expect(refWithImpliedBucket("brand-assets", "https://cdn.example.com/a.png")).toBeNull();
    expect(refWithImpliedBucket("brand-assets", "data:image/png;base64,AA")).toBeNull();
  });

  it("keeps an explicit bucket over the implied one", () => {
    expect(refWithImpliedBucket("template-backgrounds", "brand-assets/a/b.png")).toEqual({
      bucket: "brand-assets",
      path: "a/b.png",
    });
  });
});

const TYPE_STYLES = [
  { key: "heading", font: { source: "custom", family: "Cooper Display" }, colorKey: "ink" },
  { key: "subhead", font: { source: "google", family: "Inter" }, colorKey: "accent" },
  { key: "unused", font: { source: "google", family: "Oswald" }, colorKey: "secret" },
];

describe("what a schema references", () => {
  const fields = [
    { type: "text", type_style_key: "heading", font_family: "Ignored When Bound" },
    { type: "text", type_style_key: null, font_family: "Archivo" },
    { type: "image", type_style_key: null, font_family: null },
  ];

  it("collects only the bound type styles", () => {
    expect([...referencedTypeStyleKeys(fields)]).toEqual(["heading"]);
  });

  it("collects only the palette keys a bound style names", () => {
    // "accent" and "secret" belong to styles nothing binds to, so they never
    // leave the tenant. A field's own colour is a copied hex and carries no
    // palette binding at all.
    expect([...referencedColorKeys(fields, TYPE_STYLES)]).toEqual(["ink"]);
  });

  it("resolves a bound style's family over the field's own", () => {
    const families = referencedFontFamilies(fields, TYPE_STYLES);
    expect([...families].sort()).toEqual(["Archivo", "Cooper Display"]);
    expect(families.has("Ignored When Bound")).toBe(false);
    expect(families.has("Oswald")).toBe(false);
  });
});

describe("fontAssetFamily", () => {
  it("prefers the metadata family", () => {
    expect(
      fontAssetFamily({ name: "Cooper-Bold.woff2", metadata: { family: "Cooper Display" } }),
    ).toBe("Cooper Display");
  });

  it("falls back to the filename without its extension", () => {
    // Must match registerCustomFont in src/lib/render/fonts.ts exactly — a
    // mismatch means a font is filtered out of the payload and the graphic
    // exports in a fallback typeface.
    expect(fontAssetFamily({ name: "Cooper-Bold.woff2", metadata: {} })).toBe("Cooper-Bold");
    expect(fontAssetFamily({ name: "Cooper-Bold", metadata: null })).toBe("Cooper-Bold");
  });
});

describe("schemaAssetRefs", () => {
  it("collects the background and static images, deduplicated", () => {
    const refs = schemaAssetRefs("template-backgrounds/co/bg.png", [
      { type: "image", static_value: "brand-assets/co/logo.png" },
      { type: "image", static_value: "brand-assets/co/logo.png" },
      { type: "text", static_value: "brand-assets/co/never.png" },
    ]);
    expect(refs).toHaveLength(2);
    expect(refs.map((r) => r.path).sort()).toEqual(["co/bg.png", "co/logo.png"]);
  });

  it("ignores a member-filled image, which is a data URL and never in storage", () => {
    expect(schemaAssetRefs(null, [{ type: "image", static_value: null }])).toEqual([]);
  });
});

describe("clientIp", () => {
  it("takes the first hop of x-forwarded-for", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }))).toBe(
      "203.0.113.9",
    );
  });

  it("falls back through the edge headers, then to a constant", () => {
    expect(clientIp(new Headers({ "cf-connecting-ip": "203.0.113.9" }))).toBe("203.0.113.9");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
