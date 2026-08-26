import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TemplateField } from "../types";
import { clearDraft, draftableKeys, hasDraftableFields, loadDraft, saveDraft } from "./draft";

/** A minimal in-memory localStorage — the suite runs under node, and these
 * tests are about what the draft layer decides to persist, not about any
 * browser's storage implementation. */
function installStorage(impl?: Partial<Storage>) {
  const backing = new Map<string, string>();
  const store: Storage = {
    get length() {
      return backing.size;
    },
    clear: () => backing.clear(),
    getItem: (k) => backing.get(k) ?? null,
    key: (i) => [...backing.keys()][i] ?? null,
    removeItem: (k) => void backing.delete(k),
    setItem: (k, v) => void backing.set(k, v),
    ...impl,
  };
  vi.stubGlobal("window", { localStorage: store });
  return backing;
}

const field = (over: Partial<TemplateField>): TemplateField =>
  ({
    id: over.fieldKey ?? "id",
    label: "Label",
    type: "text",
    fieldKey: "key",
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    ...over,
  }) as TemplateField;

const FIELDS: TemplateField[] = [
  field({ fieldKey: "name", type: "text" }),
  field({ fieldKey: "bio", type: "multiline" }),
  field({ fieldKey: "track", type: "select" }),
  field({ fieldKey: "headshot", type: "image" }),
  field({ fieldKey: "watermark", type: "image", static: true }),
];

beforeEach(() => {
  installStorage();
});

describe("draftableKeys", () => {
  it("keeps text, multiline, and select", () => {
    expect([...draftableKeys(FIELDS)].sort()).toEqual(["bio", "name", "track"]);
  });

  it("excludes image fields, whose values are multi-megabyte data URLs", () => {
    // Persisting one would blow the storage quota and fail on write — in
    // most browsers silently, which is the worst way for a draft not to work.
    expect(draftableKeys(FIELDS).has("headshot")).toBe(false);
  });

  it("excludes fixed elements, which nobody fills in", () => {
    expect(draftableKeys(FIELDS).has("watermark")).toBe(false);
  });
});

describe("hasDraftableFields", () => {
  it("is false when a template is nothing but a photo", () => {
    // The page promises resume only when there is something to resume.
    expect(hasDraftableFields([field({ fieldKey: "headshot", type: "image" })])).toBe(false);
  });

  it("is true as soon as one field holds text", () => {
    expect(hasDraftableFields(FIELDS)).toBe(true);
  });
});

describe("save and load", () => {
  it("round-trips the text a visitor typed", () => {
    saveDraft("tok", FIELDS, { name: "Ada", bio: "Speaker", track: "Platform" });
    expect(loadDraft("tok", FIELDS)).toEqual({ name: "Ada", bio: "Speaker", track: "Platform" });
  });

  it("never persists an image value", () => {
    const backing = installStorage();
    saveDraft("tok", FIELDS, { name: "Ada", headshot: "data:image/png;base64,AAAA" });
    expect([...backing.values()].join()).not.toContain("data:image");
    expect(loadDraft("tok", FIELDS)).toEqual({ name: "Ada" });
  });

  it("keeps two links on one device apart", () => {
    saveDraft("token-a", FIELDS, { name: "Ada" });
    saveDraft("token-b", FIELDS, { name: "Grace" });
    expect(loadDraft("token-a", FIELDS)).toEqual({ name: "Ada" });
    expect(loadDraft("token-b", FIELDS)).toEqual({ name: "Grace" });
  });

  it("drops values for fields the template no longer has", () => {
    // An admin reworked the template between visits; a stale value must not
    // reappear under a reused key.
    saveDraft("tok", FIELDS, { name: "Ada", bio: "Speaker" });
    const reworked = [field({ fieldKey: "name", type: "text" })];
    expect(loadDraft("tok", reworked)).toEqual({ name: "Ada" });
  });

  it("forgets a draft older than a week", () => {
    saveDraft("tok", FIELDS, { name: "Ada" });
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 8 * 24 * 60 * 60 * 1000);
    expect(loadDraft("tok", FIELDS)).toBeNull();
    vi.useRealTimers();
  });

  it("clears rather than storing an empty draft", () => {
    const backing = installStorage();
    saveDraft("tok", FIELDS, { name: "Ada" });
    expect(backing.size).toBe(1);
    saveDraft("tok", FIELDS, { name: "" });
    expect(backing.size).toBe(0);
  });

  it("clears on request", () => {
    saveDraft("tok", FIELDS, { name: "Ada" });
    clearDraft("tok");
    expect(loadDraft("tok", FIELDS)).toBeNull();
  });
});

describe("when storage is unavailable", () => {
  it("treats a throwing store as no draft, never as a broken fill", () => {
    // Private browsing, a full quota, a browser set to block site data.
    installStorage({
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => {
        throw new Error("denied");
      },
    });
    expect(() => saveDraft("tok", FIELDS, { name: "Ada" })).not.toThrow();
    expect(loadDraft("tok", FIELDS)).toBeNull();
    expect(() => clearDraft("tok")).not.toThrow();
  });

  it("treats a corrupt entry as no draft", () => {
    const backing = installStorage();
    saveDraft("tok", FIELDS, { name: "Ada" });
    backing.set([...backing.keys()][0], "{ not json");
    expect(loadDraft("tok", FIELDS)).toBeNull();
  });
});
