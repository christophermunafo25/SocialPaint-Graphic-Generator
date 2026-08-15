import { describe, expect, it } from "vitest";
import { BUCKETS, formatStorageRef, parseStorageRef, toImageSource } from "./storageRef";

const CO = "0b7e6f2a-1111-4222-8333-944445555666";

describe("parseStorageRef", () => {
  it("parses bucket-qualified references", () => {
    expect(parseStorageRef(`brand-assets/${CO}/logo/1-a.png`)).toEqual({
      bucket: "brand-assets",
      path: `${CO}/logo/1-a.png`,
    });
    expect(parseStorageRef(`template-backgrounds/${CO}/bg.png`)).toEqual({
      bucket: "template-backgrounds",
      path: `${CO}/bg.png`,
    });
  });

  it("parses the legacy public URL form (pre-cutover tabs, unmigrated values)", () => {
    expect(
      parseStorageRef(
        `https://abc.supabase.co/storage/v1/object/public/template-backgrounds/${CO}/bg.png`,
      ),
    ).toEqual({ bucket: "template-backgrounds", path: `${CO}/bg.png` });
  });

  it("rejects everything that isn't a reference", () => {
    expect(parseStorageRef("data:image/png;base64,AAAA")).toBeNull();
    expect(parseStorageRef("blob:https://app/123")).toBeNull();
    expect(parseStorageRef("https://elsewhere.example/img.png")).toBeNull();
    expect(parseStorageRef(`${CO}/logo/1-a.png`)).toBeNull(); // bare path: no bucket context
    expect(parseStorageRef("brand-assets/")).toBeNull(); // empty path
    // A signed URL is already fetchable — it must NOT parse as a reference.
    expect(
      parseStorageRef(
        `https://abc.supabase.co/storage/v1/object/sign/brand-assets/${CO}/a.png?token=x`,
      ),
    ).toBeNull();
  });
});

describe("toImageSource", () => {
  it("qualifies bare paths with the column's bucket", () => {
    expect(toImageSource(BUCKETS.brandAssets, `${CO}/logo/1-a.png`)).toBe(
      `brand-assets/${CO}/logo/1-a.png`,
    );
  });

  it("passes through already-qualified references and external URLs", () => {
    expect(toImageSource(BUCKETS.templateBackgrounds, `brand-assets/${CO}/x.png`)).toBe(
      `brand-assets/${CO}/x.png`,
    );
    expect(toImageSource(BUCKETS.templateBackgrounds, "https://elsewhere.example/img.png")).toBe(
      "https://elsewhere.example/img.png",
    );
    expect(toImageSource(BUCKETS.templateBackgrounds, "data:image/png;base64,AAAA")).toBe(
      "data:image/png;base64,AAAA",
    );
  });

  it("collapses legacy public URLs to references", () => {
    expect(
      toImageSource(
        BUCKETS.templateBackgrounds,
        `http://localhost:54321/storage/v1/object/public/brand-assets/${CO}/a.png`,
      ),
    ).toBe(`brand-assets/${CO}/a.png`);
  });
});

describe("formatStorageRef", () => {
  it("round-trips with parse", () => {
    const ref = formatStorageRef(BUCKETS.brandAssets, `${CO}/logo/a.png`);
    expect(parseStorageRef(ref)).toEqual({ bucket: "brand-assets", path: `${CO}/logo/a.png` });
  });
});
