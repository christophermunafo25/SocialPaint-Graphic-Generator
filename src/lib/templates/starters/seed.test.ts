import { describe, expect, it } from "vitest";
import type { BrandKit, NewTemplateInput, TemplateSchema } from "../../types";
import type { Stores, TemplateStore } from "../../stores/interfaces";
import { STARTER_BLUEPRINTS } from "./index";
import { seedStarterTemplates, type SeedContext } from "./seed";

const kit: BrandKit = {
  id: "kit-1",
  companyId: "co-1",
  colors: [{ key: "accent", name: "Accent", hex: "#C9A227", role: "accent" }],
  typeStyles: [],
  guidelines: [],
};

const ctx: SeedContext = { company: { id: "co-1", name: "Acme" }, kit };

/** A template row that claims one starterKey, as listAll would return it. */
const seededRow = (starterKey: string): TemplateSchema =>
  ({
    id: `t-${starterKey}`,
    autobuildMeta: {
      model: "starter",
      sourceKind: "starter",
      generatedAt: "2026-01-01T00:00:00.000Z",
      elementCount: 1,
      editableCount: 1,
      source: "starter",
      starterKey,
      starterVersion: 1,
      seededAt: "2026-01-01T00:00:00.000Z",
    },
  }) as TemplateSchema;

function fakeStore(overrides: Partial<TemplateStore> = {}): {
  stores: Pick<Stores, "templates">;
  created: NewTemplateInput[];
} {
  const created: NewTemplateInput[] = [];
  const templates = {
    listAll: () => Promise.resolve([] as TemplateSchema[]),
    create: (input: NewTemplateInput) => {
      created.push(input);
      return Promise.resolve({ ...input, id: `t-${created.length}` } as TemplateSchema);
    },
    ...overrides,
  } as TemplateStore;
  return { stores: { templates }, created };
}

describe("seedStarterTemplates", () => {
  it("creates all six for an empty company", async () => {
    const { stores, created } = fakeStore();
    const result = await seedStarterTemplates(stores, ctx);
    expect(result.created).toEqual(STARTER_BLUEPRINTS.map((b) => b.starterKey));
    expect(result.existing).toEqual([]);
    expect(result.failed).toEqual([]);
    expect(created).toHaveLength(6);
    expect(created.every((c) => c.status === "published")).toBe(true);
  });

  it("skips starterKeys already present, so a second run is a no-op", async () => {
    const { stores, created } = fakeStore({
      listAll: () => Promise.resolve(STARTER_BLUEPRINTS.map((b) => seededRow(b.starterKey))),
    });
    const result = await seedStarterTemplates(stores, ctx);
    expect(result.created).toEqual([]);
    expect(result.existing).toHaveLength(6);
    expect(created).toHaveLength(0);
  });

  it("recreates only the missing ones (restore after delete)", async () => {
    const { stores, created } = fakeStore({
      listAll: () =>
        Promise.resolve(
          STARTER_BLUEPRINTS.filter((b) => b.starterKey !== "stat-05").map((b) =>
            seededRow(b.starterKey),
          ),
        ),
    });
    const result = await seedStarterTemplates(stores, ctx);
    expect(result.created).toEqual(["stat-05"]);
    expect(created).toHaveLength(1);
  });

  it("collects per-template failures without throwing or stopping", async () => {
    const { stores, created } = fakeStore();
    const original = stores.templates.create.bind(stores.templates);
    let n = 0;
    stores.templates.create = (input) => {
      n += 1;
      return n === 2 ? Promise.reject(new Error("insert refused")) : original(input);
    };
    const result = await seedStarterTemplates(stores, ctx);
    expect(result.created).toHaveLength(5);
    expect(result.failed).toEqual([
      { starterKey: STARTER_BLUEPRINTS[1].starterKey, error: "insert refused" },
    ]);
    expect(created).toHaveLength(5);
  });

  it("reports everything failed when the existing set cannot be read", async () => {
    const { stores, created } = fakeStore({
      listAll: () => Promise.reject(new Error("network down")),
    });
    const result = await seedStarterTemplates(stores, ctx);
    expect(result.created).toEqual([]);
    expect(result.failed).toHaveLength(6);
    expect(created).toHaveLength(0);
  });

  it("ignores non-starter autobuild templates when computing the present set", async () => {
    const { stores, created } = fakeStore({
      listAll: () =>
        Promise.resolve([
          {
            id: "t-ai",
            autobuildMeta: {
              model: "claude-sonnet-4-6",
              sourceKind: "figma",
              generatedAt: "2026-01-01T00:00:00.000Z",
              elementCount: 4,
              editableCount: 2,
            },
          } as TemplateSchema,
        ]),
    });
    const result = await seedStarterTemplates(stores, ctx);
    expect(result.created).toHaveLength(6);
    expect(created).toHaveLength(6);
  });
});
