import type { NewTemplateInput, TemplateSchema, TemplateStatus } from "../../types";
import type { TemplateStore } from "../interfaces";
import { BUCKETS, supabase } from "./client";
import { formatStorageRef } from "../storageRef";
import { fieldToRow, toTemplate, type TemplateRow } from "./rows";

const SELECT = "*, template_fields(*)";

export class SupabaseTemplateStore implements TemplateStore {
  async listPublished(companyId: string): Promise<TemplateSchema[]> {
    return this.listWhere(companyId, "published");
  }

  async listAll(companyId: string): Promise<TemplateSchema[]> {
    return this.listWhere(companyId);
  }

  private async listWhere(companyId: string, status?: TemplateStatus): Promise<TemplateSchema[]> {
    let q = supabase().from("templates").select(SELECT).eq("company_id", companyId);
    if (status) q = q.eq("status", status);
    const { data, error } = await q.order("updated_at", { ascending: false });
    if (error) throw error;
    return (data as TemplateRow[]).map(toTemplate);
  }

  async get(id: string): Promise<TemplateSchema | null> {
    const { data, error } = await supabase()
      .from("templates")
      .select(SELECT)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? toTemplate(data as TemplateRow) : null;
  }

  async create(input: NewTemplateInput): Promise<TemplateSchema> {
    const { data, error } = await supabase()
      .from("templates")
      .insert({
        company_id: input.companyId,
        name: input.name,
        description: input.description,
        category: input.category,
        tags: input.tags,
        status: input.status,
        canvas_width: input.canvasWidth,
        canvas_height: input.canvasHeight,
        background_storage_path: input.backgroundUrl || null,
        background_color: input.backgroundColor ?? null,
        background_gradient: input.backgroundGradient ?? null,
        layout_groups: input.layoutGroups ?? null,
        variants: input.variants ?? null,
        // Named only when set, so a template without canvas effects inserts
        // the same columns it did before migration 0048.
        ...(input.canvasEffects?.length && { canvas_effects: input.canvasEffects }),
        caption_template: input.captionTemplate,
        autobuild_meta: input.autobuildMeta ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    const id = (data as TemplateRow).id;
    await this.replaceFields(id, input);
    return (await this.get(id))!;
  }

  async update(id: string, patch: Partial<NewTemplateInput>): Promise<TemplateSchema> {
    const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.description !== undefined) row.description = patch.description;
    if (patch.category !== undefined) row.category = patch.category;
    if (patch.tags !== undefined) row.tags = patch.tags;
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.canvasWidth !== undefined) row.canvas_width = patch.canvasWidth;
    if (patch.canvasHeight !== undefined) row.canvas_height = patch.canvasHeight;
    if (patch.backgroundUrl !== undefined)
      row.background_storage_path = patch.backgroundUrl || null;
    if ("backgroundColor" in patch) row.background_color = patch.backgroundColor ?? null;
    if ("backgroundGradient" in patch) row.background_gradient = patch.backgroundGradient ?? null;
    if ("layoutGroups" in patch) row.layout_groups = patch.layoutGroups ?? null;
    // Empty and absent both mean single-variant: the column goes back to null.
    if ("variants" in patch) row.variants = patch.variants?.length ? patch.variants : null;
    // Written only when the patch names it, like the other jsonb blobs; an
    // empty or absent list clears it. A draft read from a null column has no
    // key (toTemplate), so an ordinary save never names the 0048 column.
    if ("canvasEffects" in patch)
      row.canvas_effects = patch.canvasEffects?.length ? patch.canvasEffects : null;
    if (patch.captionTemplate !== undefined) row.caption_template = patch.captionTemplate;
    if ("autobuildMeta" in patch) row.autobuild_meta = patch.autobuildMeta ?? null;
    // familyId is never written here, only through setFamily: a builder save
    // carries its whole draft and must not undo a change made in the Sizes
    // dialog. A size change can still meet templates_family_size_key.
    const { error } = await supabase().from("templates").update(row).eq("id", id);
    if (error) throw error;
    if (patch.fields) await this.replaceFields(id, patch as Pick<NewTemplateInput, "fields">);
    return (await this.get(id))!;
  }

  /** Replace a template's fields. The unique (template_id, field_key)
   * constraint forces delete-before-insert, which risks the worst failure a
   * save can have: a rejected insert (schema drift, bad payload) after a
   * successful delete would WIPE the template. So the old rows are captured
   * first and restored verbatim if the insert fails — a failed save must
   * cost nothing. */
  private async replaceFields(templateId: string, input: Pick<NewTemplateInput, "fields">) {
    const existing = await supabase()
      .from("template_fields")
      .select("*")
      .eq("template_id", templateId);
    if (existing.error) throw existing.error;

    const del = await supabase().from("template_fields").delete().eq("template_id", templateId);
    if (del.error) throw del.error;
    if (!input.fields.length) return;
    const rows = input.fields.map((f, i) => fieldToRow(templateId, f, i));
    const ins = await supabase().from("template_fields").insert(rows);
    if (ins.error) {
      if (existing.data?.length) {
        // Put back the exact rows (ids included) that were just deleted.
        const restore = await supabase().from("template_fields").insert(existing.data);
        if (restore.error) {
          throw new Error(
            `Saving fields failed (${ins.error.message}) and restoring the previous fields ` +
              `also failed (${restore.error.message}) — do not keep editing; contact support.`,
          );
        }
      }
      throw ins.error;
    }
  }

  async duplicate(id: string, name: string): Promise<TemplateSchema> {
    const source = await this.get(id);
    if (!source) throw new Error(`Template ${id} not found`);
    // familyId is dropped too: a plain duplicate never joins a family (a
    // version joins its source's family on its first save at a new size).
    const { id: _id, createdAt: _c, updatedAt: _u, familyId: _f, ...rest } = source;
    // create() inserts fields via fieldToRow, which omits ids — the database
    // mints new field row ids. fieldKeys stay EXACTLY as-is so caption merge
    // tags, layout groups, and variation overrides (all keyed by fieldKey)
    // keep working; backgroundUrl is copied by reference. `rest` carries
    // `variants` across as-is — a colourway set is part of the design.
    return this.create({ ...rest, name, status: "draft" });
  }

  async setStatus(id: string, status: TemplateStatus): Promise<void> {
    const { error } = await supabase()
      .from("templates")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  }

  async delete(id: string): Promise<void> {
    const { data: row, error: readError } = await supabase()
      .from("templates")
      .select("company_id, family_id")
      .eq("id", id)
      .maybeSingle();
    if (readError) throw readError;
    const { error } = await supabase().from("templates").delete().eq("id", id);
    if (error) throw error;
    const family = row as Pick<TemplateRow, "company_id" | "family_id"> | null;
    if (family?.family_id) await this.dissolveIfAlone(family.company_id, family.family_id);
  }

  async listFamily(companyId: string, familyId: string): Promise<TemplateSchema[]> {
    const { data, error } = await supabase()
      .from("templates")
      .select(SELECT)
      .eq("company_id", companyId)
      .eq("family_id", familyId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data as TemplateRow[]).map(toTemplate);
  }

  async setFamily(templateIds: string[], familyId: string | null): Promise<void> {
    if (!templateIds.length) return;
    // The families this unlink leaves behind, read before the write.
    let left: Array<Pick<TemplateRow, "company_id" | "family_id">> = [];
    if (familyId === null) {
      const { data, error } = await supabase()
        .from("templates")
        .select("company_id, family_id")
        .in("id", templateIds)
        .not("family_id", "is", null);
      if (error) throw error;
      left = (data ?? []) as typeof left;
    }
    // One statement, so a join either lands for every row or for none, and
    // updated_at is left alone: linking is not an edit.
    const { error } = await supabase()
      .from("templates")
      .update({ family_id: familyId })
      .in("id", templateIds);
    if (error) throw error;
    const seen = new Set<string>();
    for (const r of left) {
      if (!r.family_id || seen.has(r.family_id)) continue;
      seen.add(r.family_id);
      await this.dissolveIfAlone(r.company_id, r.family_id);
    }
  }

  /** A family of one is no family: clear the last member's id. */
  private async dissolveIfAlone(companyId: string, familyId: string): Promise<void> {
    const { data, error } = await supabase()
      .from("templates")
      .select("id")
      .eq("company_id", companyId)
      .eq("family_id", familyId);
    if (error) throw error;
    const ids = (data ?? []).map((r) => (r as { id: string }).id);
    if (ids.length !== 1) return;
    const { error: clearError } = await supabase()
      .from("templates")
      .update({ family_id: null })
      .eq("id", ids[0]);
    if (clearError) throw clearError;
  }

  async uploadBackground(companyId: string, file: Blob, name: string): Promise<string> {
    const path = `${companyId}/${Date.now()}-${name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error } = await supabase()
      .storage.from(BUCKETS.templateBackgrounds)
      .upload(path, file, { upsert: false });
    if (error) throw error;
    // A storage REFERENCE, not a URL — it gets persisted (background_storage_path,
    // static_value) and signed at render time.
    return formatStorageRef(BUCKETS.templateBackgrounds, path);
  }
}
