import { describe, expect, it } from "vitest";
import { HttpError } from "./http.ts";
import {
  hostOnDomain,
  isCompanyStorageRef,
  optionalFutureIso,
  optionalInt,
  isOwnStorageUrl,
  redirectAllowed,
  requireEmail,
  requireEnum,
  requireNumber,
  requireOwnStorageRef,
  requireString,
  requireStringArray,
  requireUuid,
  parseCanvaUrl,
  parseFigmaFileKey,
  parseFigmaUrl,
} from "./validate.ts";

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
  it("accepts the address-bar design link, with or without the share token", () => {
    expect(parseCanvaUrl("https://www.canva.com/design/DAF_abc-123/view")).toEqual({
      designId: "DAF_abc-123",
    });
    expect(parseCanvaUrl("https://www.canva.com/design/DAHTcIe6lkk/AbC_dEf/edit?x=1")).toEqual({
      designId: "DAHTcIe6lkk",
    });
    expect(parseCanvaUrl("https://canva.com/design/DAHTcIe6lkk")).toEqual({
      designId: "DAHTcIe6lkk",
    });
  });
  it("names a /d/ share link so the caller can say where the real link is", () => {
    expect(parseCanvaUrl("https://www.canva.com/d/WsEWp9m1vDakHyM")).toEqual({
      shortLink: true,
    });
    expect(parseCanvaUrl("https://www.canva.com/d/LosxJ9VN_9A-bOf/")).toEqual({
      shortLink: true,
    });
  });
  it("rejects canva.com-shaped paths on other hosts, for both path shapes", () => {
    expect(parseCanvaUrl("https://evil.com/canva.com/design/DAF123")).toBeNull();
    expect(parseCanvaUrl("https://canva.com.evil.com/design/DAF123")).toBeNull();
    expect(parseCanvaUrl("https://evilcanva.com/design/DAF123")).toBeNull();
    expect(parseCanvaUrl("http://canva.com/design/DAF123")).toBeNull();
    expect(parseCanvaUrl("https://evil.com/d/WsEWp9m1vDakHyM")).toBeNull();
    expect(parseCanvaUrl("https://canva.com.evil.com/d/WsEWp9m1vDakHyM")).toBeNull();
    expect(parseCanvaUrl("http://www.canva.com/d/WsEWp9m1vDakHyM")).toBeNull();
  });
  it("rejects other canva.com paths and malformed ids", () => {
    expect(parseCanvaUrl("https://www.canva.com/design/")).toBeNull();
    expect(parseCanvaUrl("https://www.canva.com/design/DAF 123/view")).toBeNull();
    expect(parseCanvaUrl("https://www.canva.com/folder/abc")).toBeNull();
    expect(parseCanvaUrl("https://www.canva.com/d/")).toBeNull();
    expect(parseCanvaUrl("not a url")).toBeNull();
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

// Two tenants. Storage paths start with the company id (0006, 0025), so a
// reference names its owner in its first segment.
const CO = "d290f1ee-6c54-4b01-90e6-d701748f0851";
const OTHER = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const BG = "template-backgrounds";

describe("isCompanyStorageRef", () => {
  it("accepts every reference shape the app writes under the company's folder", () => {
    // templateStore.uploadBackground: {companyId}/{Date.now()}-{sanitized name},
    // the path autobuild's image source arrives with.
    const uploaded = `1727500000000-${"My poster (final)!.png".replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    expect(isCompanyStorageRef(`${BG}/${CO}/${uploaded}`, BG, CO)).toBe(true);
    // The sanitizer keeps ".", so dots inside a name survive it: an admin's
    // own "Poster..v2.png" must reach autobuild.
    const dotted = `1727500000000-${"Poster..v2.png".replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    expect(dotted).toBe("1727500000000-Poster..v2.png");
    expect(isCompanyStorageRef(`${BG}/${CO}/${dotted}`, BG, CO)).toBe(true);
    expect(isCompanyStorageRef(`${BG}/${CO}/1727500000000-..hidden.png`, BG, CO)).toBe(true);
    // brandStore.upload: {companyId}/{kind}/{Date.now()}-{sanitized name}
    expect(
      isCompanyStorageRef(`brand-assets/${CO}/logo/1727500000000-logo.svg`, "brand-assets", CO),
    ).toBe(true);
    // template-autobuild's own uploads and figma.ts rehost
    expect(isCompanyStorageRef(`${BG}/${CO}/autobuild-canva-1727500000000.png`, BG, CO)).toBe(true);
    expect(
      isCompanyStorageRef(
        `${BG}/${CO}/autobuild-static-0b7c1d2e-3f40-4a5b-8c6d-7e8f9a0b1c2d.png`,
        BG,
        CO,
      ),
    ).toBe(true);
    expect(isCompanyStorageRef(`${BG}/${CO}/elements/1727500000000-r3.png`, BG, CO)).toBe(true);
  });

  it("rejects a reference under another company's folder", () => {
    expect(isCompanyStorageRef(`${BG}/${OTHER}/bg.png`, BG, CO)).toBe(false);
    expect(isCompanyStorageRef(`${BG}/${OTHER}/elements/1-r0.png`, BG, CO)).toBe(false);
  });

  it("matches the company id in either case, since a uuid is one company either way", () => {
    expect(isCompanyStorageRef(`${BG}/${CO}/bg.png`, BG, CO.toUpperCase())).toBe(true);
    expect(isCompanyStorageRef(`${BG}/${CO.toUpperCase()}/bg.png`, BG, CO)).toBe(true);
  });

  it("rejects a folder that only starts with the company id", () => {
    expect(isCompanyStorageRef(`${BG}/${CO}x/bg.png`, BG, CO)).toBe(false);
    expect(isCompanyStorageRef(`${BG}/${CO}-extra/bg.png`, BG, CO)).toBe(false);
    expect(isCompanyStorageRef(`${BG}/x${CO}/bg.png`, BG, CO)).toBe(false);
  });

  it("rejects the company folder itself, or no folder at all", () => {
    for (const ref of [`${BG}/${CO}`, `${BG}/${CO}/`, `${BG}/`, BG, `${BG}/bg.png`]) {
      expect(isCompanyStorageRef(ref, BG, CO)).toBe(false);
    }
  });

  it("rejects the other bucket, even inside the company's folder", () => {
    expect(isCompanyStorageRef(`brand-assets/${CO}/logo.png`, BG, CO)).toBe(false);
    expect(isCompanyStorageRef(`${BG}x/${CO}/bg.png`, BG, CO)).toBe(false);
  });

  it("rejects every traversal that would climb out of the folder once put in a URL", () => {
    // storage-js puts the path into the request URL unencoded, and the URL
    // parser resolves ".." segments, percent-encoded ones included: each of
    // these passes a plain prefix test and names OTHER's object.
    for (const path of [
      `${CO}/../${OTHER}/bg.png`,
      `${CO}/%2e%2e/${OTHER}/bg.png`,
      `${CO}/.%2E/${OTHER}/bg.png`,
      `${CO}/%2E./${OTHER}/bg.png`,
      `${CO}\\..\\${OTHER}/bg.png`,
      `${CO}/\t../${OTHER}/bg.png`,
      `${CO}/./bg.png`,
      `${CO}/logo/../../${OTHER}/bg.png`,
      `${CO}/..`,
      `${CO}/.`,
    ]) {
      expect(isCompanyStorageRef(`${BG}/${path}`, BG, CO)).toBe(false);
    }
  });

  it("rejects any segment made of dots alone, which no upload path holds", () => {
    for (const path of [`${CO}/.../bg.png`, `${CO}/logo/....`, `${CO}/..../bg.png`]) {
      expect(isCompanyStorageRef(`${BG}/${path}`, BG, CO)).toBe(false);
    }
  });

  it("rejects characters the app never writes into a path", () => {
    for (const name of [
      "bg.png?download",
      "bg.png#x",
      "b g.png",
      "bg%20.png",
      "a//bg.png",
      "bg.png/",
      "bg\u0000.png",
      "bg\n.png",
      "é.png",
    ]) {
      expect(isCompanyStorageRef(`${BG}/${CO}/${name}`, BG, CO)).toBe(false);
    }
  });

  it("fails closed when the company id is not a uuid", () => {
    // An empty id would otherwise turn the prefix into "{bucket}//".
    for (const id of ["", "c1", `${CO}/`, "*"]) {
      expect(isCompanyStorageRef(`${BG}/${id}/bg.png`, BG, id)).toBe(false);
    }
  });
});

describe("requireOwnStorageRef", () => {
  it("accepts references into the named bucket", () => {
    expect(
      requireOwnStorageRef("template-backgrounds/c1/bg.png", "f", "template-backgrounds"),
    ).toBe("template-backgrounds/c1/bg.png");
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
    expect(() =>
      requireOwnStorageRef("template-backgrounds/", "f", "template-backgrounds"),
    ).toThrow();
  });
  // The legacy own-public-URL branch reads SUPABASE_URL from Deno.env, which
  // doesn't exist under vitest — it collapses to "must be uploaded" there,
  // so the normalization path is covered by isOwnStorageUrl above.
});

describe("optionalFutureIso", () => {
  const inAYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

  it("accepts absent, null, and empty as no expiry", () => {
    for (const v of [undefined, null, ""]) {
      expect(optionalFutureIso(v, "expiresAt", { maxYearsAhead: 5 })).toBeUndefined();
    }
  });

  it("normalises a future instant to ISO", () => {
    expect(optionalFutureIso(inAYear, "expiresAt", { maxYearsAhead: 5 })).toBe(inAYear);
  });

  it("refuses the past", () => {
    // A link that expired before it was created is a mistake at the moment
    // of the request, not a link that quietly refuses on its first open.
    expect(() =>
      optionalFutureIso("2020-01-01T00:00:00.000Z", "expiresAt", { maxYearsAhead: 5 }),
    ).toThrow(HttpError);
  });

  it("refuses a stray far-future year", () => {
    expect(() =>
      optionalFutureIso("9999-01-01T00:00:00.000Z", "expiresAt", { maxYearsAhead: 5 }),
    ).toThrow(HttpError);
  });

  it("refuses anything that is not a timestamp", () => {
    for (const v of ["next tuesday", 12345, {}, "x".repeat(41)]) {
      expect(() => optionalFutureIso(v, "expiresAt", { maxYearsAhead: 5 })).toThrow(HttpError);
    }
  });
});

describe("optionalInt", () => {
  it("treats absent and null as no value", () => {
    expect(optionalInt(undefined, "useCap", { min: 1, max: 100 })).toBeUndefined();
    expect(optionalInt(null, "useCap", { min: 1, max: 100 })).toBeUndefined();
  });

  it("accepts a whole number in range", () => {
    expect(optionalInt(50, "useCap", { min: 1, max: 100 })).toBe(50);
  });

  it("refuses zero, negatives, fractions, and out-of-range", () => {
    // Zero would be a link that is dead on arrival, which is a mistake
    // rather than a setting.
    for (const v of [0, -1, 1.5, 101, "50", NaN]) {
      expect(() => optionalInt(v, "useCap", { min: 1, max: 100 })).toThrow(HttpError);
    }
  });
});
