import { describe, expect, it } from "vitest";
import { HttpError } from "./http.ts";
import {
  hostOnDomain,
  isOwnStorageUrl,
  redirectAllowed,
  requireEmail,
  requireEnum,
  requireNumber,
  requireOwnStorageRef,
  requireString,
  requireStringArray,
  requireUuid,
  parseFigmaFileKey,
  parseFigmaUrl,
} from "./validate.ts";
import { parseCanvaUrl } from "./canvaMcp.ts";

const status = (fn: () => unknown): number | null => {
  try {
    fn();
    return null;
  } catch (e) {
    return e instanceof HttpError ? e.status : -1;
  }
};

describe("requireUuid", () => {
  it("accepts a well-formed UUID", () => {
    expect(requireUuid("d290f1ee-6c54-4b01-90e6-d701748f0851", "companyId")).toBe(
      "d290f1ee-6c54-4b01-90e6-d701748f0851",
    );
  });
  it("rejects malformed values with 400 naming the field, not the value", () => {
    for (const bad of ["abc", 42, null, undefined, "d290f1ee-6c54-4b01-90e6", {}]) {
      try {
        requireUuid(bad, "companyId");
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(HttpError);
        expect((e as HttpError).status).toBe(400);
        expect((e as HttpError).message).toContain("companyId");
        expect((e as HttpError).message).not.toContain("abc");
      }
    }
  });
});

describe("requireEnum / requireString / requireNumber / requireStringArray", () => {
  it("enum checks against the allowed set", () => {
    expect(requireEnum("admin", "role", ["admin", "member"])).toBe("admin");
    expect(status(() => requireEnum("owner", "role", ["admin", "member"]))).toBe(400);
    expect(status(() => requireEnum(1, "role", ["admin", "member"]))).toBe(400);
  });
  it("string checks type, emptiness, and length", () => {
    expect(requireString("x", "url")).toBe("x");
    expect(status(() => requireString("", "url"))).toBe(400);
    expect(status(() => requireString("a".repeat(10), "url", 5))).toBe(400);
    expect(status(() => requireString(7, "url"))).toBe(400);
  });
  it("number checks finiteness and range", () => {
    expect(requireNumber(1080, "w", { min: 1, max: 20000 })).toBe(1080);
    expect(status(() => requireNumber(Number.NaN, "w", { min: 1, max: 20000 }))).toBe(400);
    expect(status(() => requireNumber("1080", "w", { min: 1, max: 20000 }))).toBe(400);
    expect(status(() => requireNumber(0, "w", { min: 1, max: 20000 }))).toBe(400);
  });
  it("string array checks element types and caps", () => {
    expect(requireStringArray(["1:2"], "excludeNodeIds", { maxItems: 3, maxLen: 10 })).toEqual([
      "1:2",
    ]);
    expect(
      status(() => requireStringArray([], "excludeNodeIds", { maxItems: 3, maxLen: 10 })),
    ).toBe(400);
    expect(
      status(() => requireStringArray([1], "excludeNodeIds", { maxItems: 3, maxLen: 10 })),
    ).toBe(400);
    expect(
      status(() => requireStringArray(["a", "b", "c", "d"], "x", { maxItems: 3, maxLen: 10 })),
    ).toBe(400);
  });
});

describe("requireEmail", () => {
  it("accepts a plausible address and rejects garbage", () => {
    expect(requireEmail("a@b.co", "email")).toBe("a@b.co");
    expect(status(() => requireEmail("not-an-email", "email"))).toBe(400);
    expect(status(() => requireEmail("a b@c.co", "email"))).toBe(400);
  });
});

describe("hostOnDomain", () => {
  it("accepts the domain and subdomains only", () => {
    expect(hostOnDomain("figma.com", "figma.com")).toBe(true);
    expect(hostOnDomain("www.figma.com", "figma.com")).toBe(true);
    expect(hostOnDomain("evilfigma.com", "figma.com")).toBe(false);
    expect(hostOnDomain("figma.com.evil.com", "figma.com")).toBe(false);
  });
});

describe("parseFigmaUrl host pinning", () => {
  it("accepts real Figma frame links", () => {
    expect(parseFigmaUrl("https://www.figma.com/design/AbC123/My-File?node-id=12-34")).toEqual({
      fileKey: "AbC123",
      nodeId: "12:34",
    });
    expect(parseFigmaUrl("https://figma.com/file/AbC123?node-id=1-2")).toEqual({
      fileKey: "AbC123",
      nodeId: "1:2",
    });
  });
  it("rejects figma.com-shaped paths on other hosts", () => {
    expect(parseFigmaUrl("https://evil.com/figma.com/design/AbC123?node-id=1-2")).toBeNull();
    expect(parseFigmaUrl("https://figma.com.evil.com/design/AbC123?node-id=1-2")).toBeNull();
    expect(parseFigmaUrl("http://figma.com/design/AbC123?node-id=1-2")).toBeNull();
    expect(parseFigmaUrl("not a url")).toBeNull();
  });
  it("rejects node ids with path-hostile characters", () => {
    expect(parseFigmaUrl("https://figma.com/design/AbC123?node-id=1-2%2F..%2Fetc")).toBeNull();
  });
  it("file-key parser follows the same rules", () => {
    expect(parseFigmaFileKey("https://www.figma.com/file/AbC123/whatever")).toBe("AbC123");
    expect(parseFigmaFileKey("https://evil.com/file/AbC123")).toBeNull();
  });
});

describe("parseCanvaUrl host pinning", () => {
  it("accepts real Canva design links", () => {
    expect(parseCanvaUrl("https://www.canva.com/design/DAF_abc-123/view")).toEqual({
      designId: "DAF_abc-123",
    });
  });
  it("rejects canva.com-shaped paths on other hosts", () => {
    expect(parseCanvaUrl("https://evil.com/canva.com/design/DAF123")).toBeNull();
    expect(parseCanvaUrl("https://canva.com.evil.com/design/DAF123")).toBeNull();
    expect(parseCanvaUrl("http://canva.com/design/DAF123")).toBeNull();
  });
});

describe("redirectAllowed", () => {
  const CSV = "https://www.socialpaint.ai,http://localhost:*";
  it("accepts redirects landing on an allowlisted origin", () => {
    expect(redirectAllowed(CSV, "https://www.socialpaint.ai/?canva_oauth=1")).toBe(true);
    expect(redirectAllowed(CSV, "http://localhost:5173/invite")).toBe(true);
  });
  it("rejects external or malformed targets", () => {
    expect(redirectAllowed(CSV, "https://phish.example/login")).toBe(false);
    expect(redirectAllowed(CSV, "javascript:alert(1)")).toBe(false);
    expect(redirectAllowed(CSV, "not a url")).toBe(false);
    expect(redirectAllowed("", "https://www.socialpaint.ai/")).toBe(false);
  });
});

describe("isOwnStorageUrl", () => {
  const SB = "https://abcd1234.supabase.co";
  it("accepts our own public bucket URLs", () => {
    expect(
      isOwnStorageUrl(
        `${SB}/storage/v1/object/public/template-backgrounds/c1/bg.png`,
        SB,
        "template-backgrounds",
      ),
    ).toBe(true);
  });
  it("rejects other hosts, buckets, and non-public paths", () => {
    expect(
      isOwnStorageUrl(
        "https://evil.com/storage/v1/object/public/template-backgrounds/x.png",
        SB,
        "template-backgrounds",
      ),
    ).toBe(false);
    expect(
      isOwnStorageUrl(
        `${SB}/storage/v1/object/public/other-bucket/x.png`,
        SB,
        "template-backgrounds",
      ),
    ).toBe(false);
    expect(
      isOwnStorageUrl(
        `${SB}/storage/v1/object/sign/template-backgrounds/x.png`,
        SB,
        "template-backgrounds",
      ),
    ).toBe(false);
    expect(
      isOwnStorageUrl("http://169.254.169.254/latest/meta-data", SB, "template-backgrounds"),
    ).toBe(false);
  });
});

describe("requireOwnStorageRef", () => {
  it("accepts references into the named bucket", () => {
    expect(requireOwnStorageRef("template-backgrounds/c1/bg.png", "f", "template-backgrounds")).toBe(
      "template-backgrounds/c1/bg.png",
    );
  });
  it("rejects other buckets, traversal, arbitrary URLs, and empty paths", () => {
    expect(() =>
      requireOwnStorageRef("brand-assets/c1/logo.png", "f", "template-backgrounds"),
    ).toThrow();
    expect(() =>
      requireOwnStorageRef("template-backgrounds/../secrets", "f", "template-backgrounds"),
    ).toThrow();
    expect(() =>
      requireOwnStorageRef("https://evil.com/img.png", "f", "template-backgrounds"),
    ).toThrow();
    expect(() =>
      requireOwnStorageRef("http://169.254.169.254/latest/meta-data", "f", "template-backgrounds"),
    ).toThrow();
    expect(() => requireOwnStorageRef("template-backgrounds/", "f", "template-backgrounds")).toThrow();
  });
  // The legacy own-public-URL branch reads SUPABASE_URL from Deno.env, which
  // doesn't exist under vitest — it collapses to "must be uploaded" there,
  // so the normalization path is covered by isOwnStorageUrl above.
});
