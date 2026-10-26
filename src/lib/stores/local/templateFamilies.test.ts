import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NewTemplateInput } from "../../types";
import { LocalTemplateStore } from "./localStores";

// The local backend's size families, held to the Supabase store's contract
// and the templates_family_size_key index (migration 0049).

function installStorage() {
  const backing = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    get length() {
      return backing.size;
    },
    clear: () => backing.clear(),
    getItem: (k: string) => backing.get(k) ?? null,
    key: (i: number) => [...backing.keys()][i] ?? null,
    removeItem: (k: string) => void backing.delete(k),
    setItem: (k: string, v: string) => void backing.set(k, v),
  });
}

const input = (canvasWidth: number, canvasHeight: number): NewTemplateInput => ({
  companyId: "co",
  name: `T ${canvasWidth}x${canvasHeight}`,
  description: "",
  category: "",
  tags: [],
  status: "draft",
  canvasWidth,
  canvasHeight,
  backgroundUrl: "",
  fields: [],
  captionTemplate: "",
});

describe("LocalTemplateStore size families", () => {
  let store: LocalTemplateStore;
  beforeEach(() => {
    installStorage();
    store = new LocalTemplateStore();
  });

  it("joins, lists oldest first, and leaves updatedAt alone", async () => {
    const a = await store.create(input(1080, 1350));
    const b = await store.create(input(1080, 1920));
    await store.setFamily([a.id, b.id], "fam");
    const family = await store.listFamily("co", "fam");
    expect(family.map((t) => t.id)).toEqual([a.id, b.id]);
    expect(family[0].updatedAt).toBe(a.updatedAt);
    expect(await store.listFamily("other", "fam")).toEqual([]);
  });

  it("never writes familyId through create, update or duplicate", async () => {
    const a = await store.create({ ...input(1080, 1350), familyId: "sneaky" });
    expect(a.familyId).toBeUndefined();
    await store.setFamily([a.id], "fam");
    const updated = await store.update(a.id, { name: "Renamed", familyId: undefined });
    expect(updated.familyId).toBe("fam");
    const copy = await store.duplicate(a.id, "Copy");
    expect(copy.familyId).toBeUndefined();
  });

  it("refuses a second member at a size the family has, on join and on resize", async () => {
    const a = await store.create(input(1080, 1350));
    const b = await store.create(input(1080, 1920));
    const c = await store.create(input(1080, 1350));
    await store.setFamily([a.id, b.id], "fam");
    await expect(store.setFamily([c.id], "fam")).rejects.toThrow("templates_family_size_key");
    expect((await store.get(c.id))!.familyId).toBeUndefined();
    await expect(store.update(b.id, { canvasHeight: 1350 })).rejects.toThrow(
      "templates_family_size_key",
    );
    expect((await store.get(b.id))!.canvasHeight).toBe(1920);
  });

  it("dissolves a family left with one member, on unlink and on delete", async () => {
    const a = await store.create(input(1080, 1350));
    const b = await store.create(input(1080, 1920));
    const c = await store.create(input(1200, 627));
    await store.setFamily([a.id, b.id, c.id], "fam");
    await store.setFamily([c.id], null);
    expect((await store.listFamily("co", "fam")).length).toBe(2);
    await store.delete(b.id);
    expect(await store.listFamily("co", "fam")).toEqual([]);
    expect((await store.get(a.id))!.familyId).toBeUndefined();
  });
});
