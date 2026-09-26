import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GenerateThreadInput, StoredAssistantTurn, StoredUserTurn } from "../../types";
import { LOCAL_DEV_USER_ID, LocalCompanyStore, LocalGenerateThreadStore } from "./localStores";

// The local backend's GenerateThreadStore, held to the Supabase store's
// contract: own chats only, keyset pages that never skip or repeat, the
// same filters, and no data: value ever written.

const KEY = "brand-portal-dev-db";

/** A minimal in-memory localStorage: the suite runs under node, and db.ts
 * reads the global. */
function installStorage() {
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
  };
  vi.stubGlobal("localStorage", store);
  return backing;
}

const readRaw = (backing: Map<string, string>) =>
  JSON.parse(backing.get(KEY) ?? "{}") as { generateThreads?: Array<Record<string, unknown>> };

const user = (over: Partial<StoredUserTurn> = {}): StoredUserTurn => ({
  id: "u1",
  role: "user",
  text: "We're hiring a Creative Director",
  createdAt: "2026-09-26T10:00:00.000Z",
  variations: 2,
  intent: "brief",
  ...over,
});

const answer = (
  values: Record<string, string> = { headline: "Now hiring" },
): StoredAssistantTurn => ({
  id: "a1",
  role: "assistant",
  createdAt: "2026-09-26T10:00:05.000Z",
  replyTo: "u1",
  phase: "done",
  status: "Here you go.",
  warnings: [],
  drafts: [
    {
      id: "d1",
      proposal: {
        templateId: "t-1",
        templateName: "Now hiring",
        values,
        caption: "Join us.",
        why: "Fits the brief.",
        imageFieldsNeeded: [],
      },
      canvas: { width: 1080, height: 1350 },
      values,
    },
  ],
});

const input = (over: Partial<GenerateThreadInput> = {}): GenerateThreadInput => ({
  title: "Creative Director post",
  platforms: ["instagram"],
  preview: {
    templateId: "t-1",
    values: { headline: "Now hiring" },
    canvas: { width: 1080, height: 1350 },
  },
  turns: [user(), answer()],
  ...over,
});

const COMPANY = "company-a";
const OTHER = "company-b";

let backing: Map<string, string>;
let store: LocalGenerateThreadStore;
let clock = Date.UTC(2026, 8, 26, 10, 0, 0);

/** Each call is one millisecond after the last, unless `same` holds the
 * clock still (a tie). */
const tick = (same = false) => {
  if (!same) clock += 1;
  vi.setSystemTime(clock);
};

beforeEach(() => {
  vi.useFakeTimers();
  backing = installStorage();
  store = new LocalGenerateThreadStore();
  clock = Date.UTC(2026, 8, 26, 10, 0, 0);
  tick();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("LocalGenerateThreadStore", () => {
  it("creates a chat for the dev user and reads it back whole", async () => {
    const created = await store.create(COMPANY, input({ platforms: ["instagram", "linkedin"] }));
    expect(created.id).toBeTruthy();
    expect(created.createdAt).toBe(created.updatedAt);
    // Platforms come back in PLATFORMS order, whatever order they went in.
    expect(created.platforms).toEqual(["linkedin", "instagram"]);
    expect(await store.get(COMPANY, created.id)).toEqual(created);
    expect(readRaw(backing).generateThreads?.[0]).toMatchObject({
      companyId: COMPANY,
      userId: LOCAL_DEV_USER_ID,
    });
  });

  it("does not hand back the caller's own turns array", async () => {
    const turns = [user(), answer()];
    const created = await store.create(COMPANY, input({ turns }));
    expect(created.turns).toEqual(turns);
    expect(created.turns).not.toBe(turns);
  });

  it("scopes every read and write to the company and the dev user", async () => {
    const mine = await store.create(COMPANY, input());
    const raw = readRaw(backing);
    // Rows nobody could write through this store: another member's chat in
    // the same company, and a chat in another company.
    raw.generateThreads!.push(
      { ...raw.generateThreads![0], id: "theirs", userId: "someone-else" },
      { ...raw.generateThreads![0], id: "elsewhere", companyId: OTHER },
    );
    backing.set(KEY, JSON.stringify(raw));

    const page = await store.list(COMPANY, { limit: 12 });
    expect(page.items.map((t) => t.id)).toEqual([mine.id]);
    expect(await store.get(COMPANY, "theirs")).toBeNull();
    expect(await store.get(COMPANY, "elsewhere")).toBeNull();
    expect(await store.get(OTHER, mine.id)).toBeNull();
    await expect(store.update(COMPANY, "theirs", input({ title: "Hijacked" }))).rejects.toThrow();
    await store.remove(COMPANY, "theirs");
    await store.remove(OTHER, mine.id);
    const after = readRaw(backing).generateThreads!;
    expect(after.map((t) => t.id).sort()).toEqual(["elsewhere", mine.id, "theirs"].sort());
    expect(after.find((t) => t.id === "theirs")?.title).toBe("Creative Director post");
  });

  it("lists summaries without turns, newest first", async () => {
    const a = await store.create(COMPANY, input({ title: "First" }));
    tick();
    const b = await store.create(COMPANY, input({ title: "Second" }));
    const page = await store.list(COMPANY, { limit: 12 });
    expect(page.items.map((t) => t.id)).toEqual([b.id, a.id]);
    expect(page.items[0]).not.toHaveProperty("turns");
    expect(page.nextBefore).toBeNull();
  });

  it("pages in order, never skipping or repeating chats saved in the same instant", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 29; i++) {
      tick(i % 4 !== 0); // runs of four chats share a timestamp
      ids.push((await store.create(COMPANY, input({ title: `Chat ${i}` }))).id);
    }
    const seen: string[] = [];
    const sizes: number[] = [];
    let before: string | undefined;
    for (let guard = 0; guard < 10; guard++) {
      const page = await store.list(COMPANY, { limit: 12, before });
      seen.push(...page.items.map((t) => t.id));
      sizes.push(page.items.length);
      if (!page.nextBefore) break;
      before = page.nextBefore;
    }
    expect(sizes).toEqual([12, 12, 5]);
    expect(new Set(seen).size).toBe(29);
    expect([...seen].sort()).toEqual([...ids].sort());
    const all = await store.list(COMPANY, { limit: 100 });
    expect(all.items.map((t) => t.id)).toEqual(seen);
  });

  it("stops without an empty page when the count is an exact multiple", async () => {
    for (let i = 0; i < 8; i++) {
      tick();
      await store.create(COMPANY, input({ title: `Chat ${i}` }));
    }
    const first = await store.list(COMPANY, { limit: 4 });
    const second = await store.list(COMPANY, { limit: 4, before: first.nextBefore! });
    expect(second.items).toHaveLength(4);
    expect(second.nextBefore).toBeNull();
  });

  it("refuses a cursor it did not issue", async () => {
    await expect(store.list(COMPANY, { limit: 12, before: "garbage" })).rejects.toThrow();
  });

  it("filters by platform and by a case-insensitive title substring", async () => {
    await store.create(
      COMPANY,
      input({ title: "Creative Director post", platforms: ["instagram"] }),
    );
    tick();
    await store.create(COMPANY, input({ title: "Webinar promo", platforms: ["linkedin"] }));
    tick();
    await store.create(
      COMPANY,
      input({ title: "50% off week", platforms: ["linkedin", "facebook"] }),
    );

    const titles = async (opts: Parameters<LocalGenerateThreadStore["list"]>[1]) =>
      (await store.list(COMPANY, opts)).items.map((t) => t.title);

    expect(await titles({ limit: 12, platform: "linkedin" })).toEqual([
      "50% off week",
      "Webinar promo",
    ]);
    expect(await titles({ limit: 12, q: "  DIRECTOR " })).toEqual(["Creative Director post"]);
    expect(await titles({ limit: 12, q: "%" })).toEqual(["50% off week"]);
    expect(await titles({ limit: 12, platform: "instagram", q: "webinar" })).toEqual([]);
  });

  it("reports the platforms in use, distinct and in PLATFORMS order", async () => {
    await store.create(COMPANY, input({ platforms: ["facebook"] }));
    await store.create(COMPANY, input({ platforms: ["instagram", "linkedin"] }));
    await store.create(OTHER, input({ platforms: ["x"] }));
    expect(await store.platformsInUse(COMPANY)).toEqual(["linkedin", "instagram", "facebook"]);
    expect(await store.platformsInUse("empty-company")).toEqual([]);
  });

  it("updates in place, stamping updatedAt so the chat moves to the top", async () => {
    const a = await store.create(COMPANY, input({ title: "First" }));
    tick();
    const b = await store.create(COMPANY, input({ title: "Second" }));
    tick();
    await store.update(COMPANY, a.id, input({ title: "First, revised" }));
    const page = await store.list(COMPANY, { limit: 12 });
    expect(page.items.map((t) => t.id)).toEqual([a.id, b.id]);
    const reread = await store.get(COMPANY, a.id);
    expect(reread?.title).toBe("First, revised");
    expect(reread?.createdAt).toBe(a.createdAt);
    expect(reread!.updatedAt > a.updatedAt).toBe(true);
  });

  it("throws when updating a chat that is gone", async () => {
    await expect(store.update(COMPANY, "missing", input())).rejects.toThrow(/not found/);
  });

  it("refuses to write a data: value anywhere, on create and on update", async () => {
    const photo = "data:image/jpeg;base64,/9j/4AAQ";
    await expect(
      store.create(COMPANY, input({ turns: [user(), answer({ headshot: photo })] })),
    ).rejects.toThrow();
    expect(readRaw(backing).generateThreads ?? []).toHaveLength(0);

    const saved = await store.create(COMPANY, input());
    await expect(
      store.update(
        COMPANY,
        saved.id,
        input({ preview: { values: { photo }, canvas: { width: 1, height: 1 } } }),
      ),
    ).rejects.toThrow();
    expect(backing.get(KEY)).not.toContain("data:");
  });

  it("clamps a title to the column's 120 characters", async () => {
    const created = await store.create(COMPANY, input({ title: "t".repeat(200) }));
    expect(created.title).toHaveLength(120);
  });

  it("removes a chat", async () => {
    const a = await store.create(COMPANY, input());
    await store.remove(COMPANY, a.id);
    expect(await store.get(COMPANY, a.id)).toBeNull();
  });

  it("goes with its company, as the schema's cascade does", async () => {
    const companies = new LocalCompanyStore();
    const company = await companies.create({ name: "Acme", slug: "acme" });
    const survivor = await store.create(OTHER, input());
    await store.create(company.id, input());
    await companies.delete(company.id);
    expect((await store.list(company.id, { limit: 12 })).items).toEqual([]);
    expect(await store.get(OTHER, survivor.id)).not.toBeNull();
  });

  it("upgrades a dev database written before chats existed", async () => {
    backing.set(KEY, JSON.stringify({ companies: [], templates: [] }));
    expect(await store.list(COMPANY, { limit: 12 })).toEqual({ items: [], nextBefore: null });
    const created = await store.create(COMPANY, input());
    expect(await store.get(COMPANY, created.id)).not.toBeNull();
  });
});
