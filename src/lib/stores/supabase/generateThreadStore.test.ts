import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GenerateThreadInput } from "../../types";
import { decodeThreadCursor, encodeThreadCursor } from "../generateThreads";
import { SupabaseGenerateThreadStore } from "./generateThreadStore";

// The Supabase GenerateThreadStore against a stand-in PostgREST: the real
// supabase-js client, with a fetch that records each request and answers
// from the test. What is pinned here is the request the store builds (the
// columns, the filters, the keyset, the order, limit + 1) and how it reads
// the answer. The policies behind it are proved against Postgres in
// supabase/verify/50_generate_threads.sql.

const h = vi.hoisted(() => ({
  requests: [] as Array<{ method: string; url: URL; accept: string; body: unknown }>,
  answer: (() => []) as (req: { method: string; url: URL }) => unknown,
}));

vi.mock("./client", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient("https://qa.supabase.co", "anon-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input));
        const method = init?.method ?? "GET";
        const headers = new Headers(init?.headers);
        const accept = headers.get("Accept") ?? "";
        const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
        h.requests.push({ method, url, accept, body });
        let data = h.answer({ method, url });
        if (accept.includes("vnd.pgrst.object") && Array.isArray(data)) data = data[0];
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  });
  return { supabase: () => client, isSupabaseConfigured: true };
});

const COMPANY = "c0000000-0000-4000-8000-00000000000a";
const ID = "9e300000-0000-4000-8000-000000000001";

const row = (i: number, over: Record<string, unknown> = {}) => ({
  id: `9e300000-0000-4000-8000-${String(100 - i).padStart(12, "0")}`,
  title: `Chat ${i}`,
  platforms: ["instagram", "linkedin"],
  preview: null,
  created_at: "2026-09-26T10:00:00.123456+00:00",
  updated_at: `2026-09-26T10:${String(59 - i).padStart(2, "0")}:00.123456+00:00`,
  ...over,
});

const input = (over: Partial<GenerateThreadInput> = {}): GenerateThreadInput => ({
  title: "Creative Director post",
  platforms: ["instagram", "linkedin"],
  preview: null,
  turns: [
    {
      id: "u1",
      role: "user",
      text: "We're hiring",
      createdAt: "2026-09-26T10:00:00.000Z",
      variations: 2,
      intent: "brief",
    },
  ],
  ...over,
});

const store = new SupabaseGenerateThreadStore();
const last = () => h.requests[h.requests.length - 1];
const params = (url: URL) => Object.fromEntries(url.searchParams.entries());

beforeEach(() => {
  h.requests.length = 0;
  h.answer = () => [];
});

describe("SupabaseGenerateThreadStore.list", () => {
  it("selects summary columns only, in keyset order, one row past the page", async () => {
    h.answer = () => Array.from({ length: 13 }, (_, i) => row(i));
    const page = await store.list(COMPANY, { limit: 12 });
    const req = last();
    expect(req.method).toBe("GET");
    expect(req.url.pathname).toBe("/rest/v1/generate_threads");
    expect(params(req.url)).toEqual({
      select: "id,title,platforms,preview,created_at,updated_at",
      company_id: `eq.${COMPANY}`,
      order: "updated_at.desc,id.desc",
      limit: "13",
    });
    expect(page.items).toHaveLength(12);
    expect(page.items[0]).not.toHaveProperty("turns");
    // Postgres's own timestamp, microseconds and all, is the cursor's key.
    expect(decodeThreadCursor(page.nextBefore!)).toEqual({
      updatedAt: row(11).updated_at,
      id: row(11).id,
    });
    // Platforms come back in PLATFORMS order.
    expect(page.items[0].platforms).toEqual(["linkedin", "instagram"]);
  });

  it("has no next page when the extra row is not there", async () => {
    h.answer = () => Array.from({ length: 5 }, (_, i) => row(i));
    expect((await store.list(COMPANY, { limit: 12 })).nextBefore).toBeNull();
  });

  it("filters by platform, by a literal title substring, and after the cursor", async () => {
    const before = encodeThreadCursor({ updatedAt: row(11).updated_at, id: row(11).id });
    await store.list(COMPANY, { limit: 12, before, platform: "linkedin", q: " 50%_off " });
    const p = params(last().url);
    expect(p.platforms).toBe("cs.{linkedin}");
    expect(p.title).toBe("ilike.%50\\%\\_off%");
    const t = row(11).updated_at;
    expect(p.updated_at).toBe(`lte.${t}`);
    expect(p.or).toBe(`(updated_at.lt."${t}",and(updated_at.eq."${t}",id.lt."${row(11).id}"))`);
  });

  it("leaves out a blank search", async () => {
    await store.list(COMPANY, { limit: 12, q: "   " });
    expect(params(last().url)).not.toHaveProperty("title");
  });

  it("refuses a cursor it did not issue, before any request", async () => {
    await expect(store.list(COMPANY, { limit: 12, before: "garbage" })).rejects.toThrow();
    expect(h.requests).toHaveLength(0);
  });
});

describe("SupabaseGenerateThreadStore.platformsInUse", () => {
  it("reads every page of the platforms column and returns the set in PLATFORMS order", async () => {
    let call = 0;
    h.answer = () =>
      ++call === 1
        ? [{ platforms: ["facebook"] }, { platforms: ["instagram", "myspace"] }]
        : call === 2
          ? [{ platforms: ["linkedin"] }, { platforms: null }]
          : [];
    expect(await store.platformsInUse(COMPANY)).toEqual(["linkedin", "instagram", "facebook"]);
    expect(h.requests).toHaveLength(3);
    const offsets = h.requests.map((r) => params(r.url).offset);
    expect(offsets).toEqual(["0", "2", "4"]);
    for (const r of h.requests) {
      expect(params(r.url).select).toBe("platforms");
      expect(params(r.url).company_id).toBe(`eq.${COMPANY}`);
    }
  });
});

describe("SupabaseGenerateThreadStore.get", () => {
  it("answers null for an id no chat could have, without a request", async () => {
    expect(await store.get(COMPANY, "not-a-uuid")).toBeNull();
    expect(h.requests).toHaveLength(0);
  });

  it("reads one chat with its turns", async () => {
    h.answer = () => [{ ...row(0, { id: ID }), turns: input().turns }];
    const rec = await store.get(COMPANY, ID);
    expect(params(last().url)).toMatchObject({
      select: "id,title,platforms,preview,created_at,updated_at,turns",
      company_id: `eq.${COMPANY}`,
      id: `eq.${ID}`,
    });
    expect(rec?.id).toBe(ID);
    expect(rec?.turns).toEqual(input().turns);
  });

  it("answers null when RLS or absence leaves nothing", async () => {
    h.answer = () => [];
    expect(await store.get(COMPANY, ID)).toBeNull();
  });
});

describe("SupabaseGenerateThreadStore writes", () => {
  it("creates in the company, never naming the user, and returns the record", async () => {
    h.answer = ({ method }) => (method === "POST" ? [{ ...row(0, { id: ID }), turns: [] }] : []);
    const rec = await store.create(COMPANY, input({ title: "t".repeat(130) }));
    const req = last();
    expect(req.method).toBe("POST");
    const body = req.body as Record<string, unknown>;
    expect(body.company_id).toBe(COMPANY);
    expect(body).not.toHaveProperty("user_id");
    expect(body.title).toHaveLength(120);
    expect(body.platforms).toEqual(["linkedin", "instagram"]);
    expect(typeof body.updated_at).toBe("string");
    expect(body.turns).toEqual(input().turns);
    expect(rec.id).toBe(ID);
  });

  it("refuses a data: value before any request, on create and on update", async () => {
    const photo = input({
      preview: {
        values: { headshot: "data:image/png;base64,AAAA" },
        canvas: { width: 1, height: 1 },
      },
    });
    await expect(store.create(COMPANY, photo)).rejects.toThrow();
    await expect(store.update(COMPANY, ID, photo)).rejects.toThrow();
    expect(h.requests).toHaveLength(0);
  });

  it("updates in place, stamping updated_at", async () => {
    h.answer = () => [{ id: ID }];
    await store.update(COMPANY, ID, input());
    const req = last();
    expect(req.method).toBe("PATCH");
    expect(params(req.url)).toMatchObject({ company_id: `eq.${COMPANY}`, id: `eq.${ID}` });
    const body = req.body as Record<string, unknown>;
    expect(typeof body.updated_at).toBe("string");
    expect(body).not.toHaveProperty("user_id");
    expect(body).not.toHaveProperty("company_id");
  });

  it("throws when the update matched no chat, so a lost write never reads as saved", async () => {
    h.answer = () => [];
    await expect(store.update(COMPANY, ID, input())).rejects.toThrow(/not found/);
  });

  it("removes one chat in the company", async () => {
    await store.remove(COMPANY, ID);
    const req = last();
    expect(req.method).toBe("DELETE");
    expect(params(req.url)).toMatchObject({ company_id: `eq.${COMPANY}`, id: `eq.${ID}` });
  });
});
