import type { NewTemplateInput, TemplateSchema, TemplateStatus } from "../../types";
import type { TemplateStore } from "../interfaces";
import { BUCKETS, publicUrl, supabase } from "./client";
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
    if (patch.captionTemplate !== undefined) row.caption_template = patch.captionTemplate;
    if ("autobuildMeta" in patch) row.autobuild_meta = patch.autobuildMeta ?? null;
    const { error } = await supabase().from("templates").update(row).eq("id", id);
    if (error) throw error;
    if (patch.fields) await this.replaceFields(id, patch as Pick<NewTemplateInput, "fields">);
    return (await this.get(id))!;
  }

  private async replaceFields(templateId: string, input: Pick<NewTemplateInput, "fields">) {
    const del = await supabase().from("template_fields").delete().eq("template_id", templateId);
    if (del.error) throw del.error;
    if (!input.fields.length) return;
    const rows = input.fields.map((f, i) => fieldToRow(templateId, f, i));
    const ins = await supabase().from("template_fields").insert(rows);
    if (ins.error) throw ins.error;
  }

  async duplicate(id: string, name: string): Promise<TemplateSchema> {
    const source = await this.get(id);
    if (!source) throw new Error(`Template ${id} not found`);
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = source;
    // create() inserts fields via fieldToRow, which omits ids — the database
    // mints new field row ids. fieldKeys stay EXACTLY as-is so caption merge
    // tags keep working; backgroundUrl is copied by reference.
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
    const { error } = await supabase().from("templates").delete().eq("id", id);
    if (error) throw error;
  }

  async uploadBackground(companyId: string, file: Blob, name: string): Promise<string> {
    const path = `${companyId}/${Date.now()}-${name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error } = await supabase()
      .storage.from(BUCKETS.templateBackgrounds)
      .upload(path, file, { upsert: false });
    if (error) throw error;
    return publicUrl(BUCKETS.templateBackgrounds, path);
  }
}
