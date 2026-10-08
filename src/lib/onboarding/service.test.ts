import { describe, expect, it, vi } from "vitest";
import type { Stores } from "../stores/interfaces";

vi.mock("../render/fonts", () => ({ loadGoogleFonts: vi.fn() }));
vi.mock("../brand/fontUpload", () => ({
  inspectFontFile: vi.fn(async () => ({ ok: true, metadata: { format: "woff2" } })),
}));
const seed = vi.fn();
vi.mock("../templates/starters/seed", () => ({
  seedStarterTemplates: (...args: unknown[]) => seed(...args),
}));

const { createWorkspace, savePerson, seedNoticeFor, slugFor } = await import("./service");

function fakeStores(overrides: { website?: () => Promise<never> } = {}) {
  const company = { id: "c1", name: "Acme Studios", slug: "acme-studios" };
  const calls: string[] = [];
  const stores = {
    companies: {
      create: vi.fn(async () => (calls.push("create"), company)),
      update: vi.fn(overrides.website ?? (async () => (calls.push("website"), company))),
    },
    brandAssets: {
      upload: vi.fn(async (_c: string, kind: string) => {
        calls.push(`upload:${kind}`);
        return { id: `${kind}-1`, url: `${kind}.png` };
      }),
    },
    brandKits: {
      upsert: vi.fn(async (_c: string, kit: object) => (calls.push("kit"), { id: "k1", ...kit })),
    },
    templates: {},
  } as unknown as Pick<Stores, "companies" | "brandAssets" | "brandKits" | "templates">;
  return { stores, calls };
}

const brand = {
  colors: [],
  headingGoogle: "Montserrat",
  bodyGoogle: "Inter",
  fonts: [],
  logo: null,
};

describe("createWorkspace", () => {
  it("creates the workspace, website, logo, kit and starters in order", async () => {
    seed.mockResolvedValue({ created: ["a"], existing: [], failed: [] });
    const { stores, calls } = fakeStores();
    const logo = new File(["x"], "logo.png", { type: "image/png" });
    const result = await createWorkspace(stores, {
      name: " Acme Studios ",
      slug: "acme-studios",
      website: "https://acme.example",
      brand: { ...brand, logo },
    });
    expect(calls).toEqual(["create", "website", "upload:logo", "kit"]);
    expect(stores.companies.create).toHaveBeenCalledWith({
      name: "Acme Studios",
      slug: "acme-studios",
    });
    const kit = vi.mocked(stores.brandKits.upsert).mock.calls[0][1];
    expect(kit.primaryLogoAssetId).toBe("logo-1");
    expect(kit.typeStyles.some((s) => s.useFor === "heading")).toBe(true);
    expect(seed).toHaveBeenCalledOnce();
    expect(result.seeded?.created).toEqual(["a"]);
  });

  it("gives an uploaded font its role", async () => {
    seed.mockResolvedValue({ created: [], existing: [], failed: [] });
    const { stores } = fakeStores();
    const file = new File(["f"], "brand.woff2");
    await createWorkspace(stores, {
      name: "Acme",
      slug: "acme",
      brand: { ...brand, fonts: [{ file, family: "Brand Sans", use: "heading" }] },
    });
    const kit = vi.mocked(stores.brandKits.upsert).mock.calls[0][1];
    expect(kit.headingFont).toEqual({ source: "custom", family: "Brand Sans", assetId: "font-1" });
    expect(kit.bodyFont).toEqual({ source: "google", family: "Inter" });
  });

  it("never fails on the website or on seeding", async () => {
    seed.mockRejectedValue(new Error("seed down"));
    const { stores } = fakeStores({ website: async () => Promise.reject(new Error("no")) });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await createWorkspace(stores, {
      name: "Acme",
      slug: "acme",
      website: "https://acme.example",
      brand,
    });
    expect(result.company.id).toBe("c1");
    expect(result.seeded).toBeNull();
    expect(seedNoticeFor(result.seeded)).toMatch(/could not be created/);
    spy.mockRestore();
  });
});

describe("answers", () => {
  it("saves the workspace profile with the website", async () => {
    seed.mockResolvedValue({ created: [], existing: [], failed: [] });
    const { stores } = fakeStores();
    await createWorkspace(stores, {
      name: "Acme",
      slug: "acme",
      website: "https://acme.example",
      profile: { setupFor: "company", teamSize: "11_50" },
      brand,
    });
    expect(stores.companies.update).toHaveBeenCalledWith("c1", {
      website: "https://acme.example",
      profile: { setupFor: "company", teamSize: "11_50" },
    });
  });

  it("saves the person's name and role, and skips without accounts", async () => {
    const account = {
      isAvailable: vi.fn(() => true),
      setDisplayName: vi.fn(async () => {}),
      setJobRole: vi.fn(async () => {}),
    };
    const stores = { account } as unknown as Pick<Stores, "account">;
    await savePerson(stores, "u1", { name: " Jordan Lee ", role: "marketing" });
    expect(account.setDisplayName).toHaveBeenCalledWith("u1", "Jordan Lee");
    expect(account.setJobRole).toHaveBeenCalledWith("u1", "marketing");
    account.isAvailable.mockReturnValue(false);
    account.setDisplayName.mockClear();
    await savePerson(stores, "u1", { name: "Jordan" });
    expect(account.setDisplayName).not.toHaveBeenCalled();
  });
});

describe("slugFor and seedNoticeFor", () => {
  it("slugs a name", () => {
    expect(slugFor("  Acme & Co. Studios! ")).toBe("acme-co-studios");
  });
  it("says nothing when every starter landed", () => {
    expect(seedNoticeFor({ created: ["a"], existing: [], failed: [] })).toBeNull();
    expect(
      seedNoticeFor({ created: [], existing: [], failed: [{ starterKey: "a", error: "x" }] }),
    ).toMatch(/Some starter templates/);
  });
});
