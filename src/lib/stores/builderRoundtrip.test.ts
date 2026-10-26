import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NewTemplateInput, TemplateSchema } from "../types";
import fixture from "../../../test/fidelity/fixtures/builder-roundtrip/fixture.json";
import { normalizeEffects } from "../../app/components/builder/effectOps";
import { LocalTemplateStore } from "./local/localStores";
import { fieldToRow, toTemplate, type TemplateFieldRow, type TemplateRow } from "./supabase/rows";

// Brand-system Phase 2: every property the builder writes (effects, stroke
// position, a radial fill, canvas effects and a per-look effect) survives a
// save and a read back. The template is the builder-roundtrip fidelity
// fixture, so the same schema is what the export check renders.

const saved = fixture.schema as unknown as TemplateSchema;
const { id: _id, createdAt: _c, updatedAt: _u, ...input } = saved;
const draft = input as NewTemplateInput;

/** The parts a save is responsible for (ids and timestamps are minted). */
const design = (t: TemplateSchema) => ({
  backgroundGradient: t.backgroundGradient,
  canvasEffects: t.canvasEffects,
  variants: t.variants,
  fields: t.fields.map(({ id: _fid, ...f }) => f),
});

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
}

describe("builder round trip", () => {
  beforeEach(installStorage);
  afterEach(() => vi.unstubAllGlobals());

  it("uses only values the builder's validator keeps as they are", () => {
    for (const f of draft.fields) {
      expect(normalizeEffects(f.effects, { kind: "field", field: f }), f.fieldKey).toEqual(
        f.effects,
      );
    }
    expect(normalizeEffects(draft.canvasEffects, { kind: "canvas" })).toEqual(draft.canvasEffects);
  });

  it("saves and reads back through the local store", async () => {
    const store = new LocalTemplateStore();
    const created = await store.create(draft);
    await store.update(created.id, { ...draft, name: "Saved again" });
    const back = await store.get(created.id);
    expect(back && design(back)).toEqual(design(saved));
  });

  it("saves and reads back through the Supabase rows", () => {
    // The columns create() writes (templateStore.ts), then the read mapper.
    const row: TemplateRow = {
      id: "t1",
      company_id: draft.companyId,
      name: draft.name,
      description: draft.description,
      category: draft.category,
      tags: draft.tags,
      status: draft.status,
      canvas_width: draft.canvasWidth,
      canvas_height: draft.canvasHeight,
      background_storage_path: null,
      background_color: draft.backgroundColor ?? null,
      background_gradient: draft.backgroundGradient ?? null,
      layout_groups: null,
      variants: draft.variants ?? null,
      canvas_effects: draft.canvasEffects,
      caption_template: draft.captionTemplate,
      autobuild_meta: null,
      created_at: saved.createdAt,
      updated_at: saved.updatedAt,
      template_fields: draft.fields.map(
        (f, i) => ({ id: f.id, ...fieldToRow("t1", f, i) }) as TemplateFieldRow,
      ),
    };
    const back = toTemplate(JSON.parse(JSON.stringify(row)) as TemplateRow);
    expect(design(back)).toEqual(design(saved));
    expect(back.fields.map((f) => f.strokeAlign)).toEqual([
      "outside",
      "center",
      undefined,
      undefined,
    ]);
    expect(back.variants?.find((v) => v.id === "night")?.overrides.card.effects).toEqual([
      { type: "dropShadow", x: 0, y: 16, blur: 40, color: "#3D7BFF66" },
    ]);
  });
});
