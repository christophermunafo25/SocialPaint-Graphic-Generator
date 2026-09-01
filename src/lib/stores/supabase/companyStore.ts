import type { CanvasPreset, Company, CompanyPatch } from "../../types";
import type { CompanyStore } from "../interfaces";
import { supabase } from "./client";
import {
  COMPANY_COLUMNS,
  toCanvasPreset,
  toCompany,
  type CanvasPresetRow,
  type CompanyRow,
} from "./rows";

export class SupabaseCompanyStore implements CompanyStore {
  async list(): Promise<Company[]> {
    const { data, error } = await supabase()
      .from("companies")
      .select(COMPANY_COLUMNS)
      .order("name");
    if (error) throw error;
    return (data as unknown as CompanyRow[]).map(toCompany);
  }

  async get(id: string): Promise<Company | null> {
    const { data, error } = await supabase()
      .from("companies")
      .select(COMPANY_COLUMNS)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? toCompany(data as unknown as CompanyRow) : null;
  }

  async create(input: { name: string; slug: string }): Promise<Company> {
    // Under real RLS, companies are only creatable via this security-definer
    // RPC, which also makes the caller an admin member atomically.
    const { data, error } = await supabase().rpc("create_company_with_admin", {
      p_name: input.name,
      p_slug: input.slug,
    });
    if (error) throw error;
    return toCompany(data as unknown as CompanyRow);
  }

  /** Admin-verified server-side: the admin_update_companies RLS policy (0006)
   * is the check — a non-admin's update matches zero rows and surfaces here
   * as "not found or not permitted" rather than silently succeeding. */
  async update(id: string, patch: CompanyPatch): Promise<Company> {
    const row: Record<string, unknown> = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.slug !== undefined) row.slug = patch.slug;
    if (patch.timezone !== undefined) row.timezone = patch.timezone;
    if (patch.linkDefaults !== undefined) {
      row.link_default_allow_uploads = patch.linkDefaults.allowUploads;
      row.link_default_expiry_days = patch.linkDefaults.expiryDays;
      row.link_default_use_cap = patch.linkDefaults.useCap;
    }
    const { data, error } = await supabase()
      .from("companies")
      .update(row)
      .eq("id", id)
      .select(COMPANY_COLUMNS)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Could not update the workspace — admin access is required.");
    return toCompany(data as unknown as CompanyRow);
  }

  /** The delete-company Edge Function verifies admin role and deletes under
   * the service role; the schema's cascades remove every dependent row. */
  async delete(id: string): Promise<void> {
    const { data, error } = await supabase().functions.invoke("delete-company", {
      body: { companyId: id },
    });
    if (error) throw new Error(`Workspace deletion failed: ${error.message}`);
    const body = data as { error?: string };
    if (body?.error) throw new Error(body.error);
  }

  async isSlugAvailable(slug: string, excludeCompanyId: string): Promise<boolean> {
    const { data, error } = await supabase().rpc("slug_available", {
      p_slug: slug,
      p_company_id: excludeCompanyId,
    });
    if (error) throw error;
    return data === true;
  }

  async hasAnyCompany(): Promise<boolean> {
    const { count, error } = await supabase()
      .from("companies")
      .select("id", { count: "exact", head: true });
    if (error) throw error;
    return (count ?? 0) > 0;
  }

  async listCanvasPresets(companyId?: string): Promise<CanvasPreset[]> {
    const presets = await this.globalPresets();
    if (!companyId) return presets;
    const disabled = await this.disabledPresetIds(companyId);
    const filtered = presets.filter((p) => !disabled.has(p.id));
    // A workspace that disabled everything still has to be able to create —
    // fall back to the global list rather than an empty size picker.
    return filtered.length > 0 ? filtered : presets;
  }

  async listCanvasPresetSettings(
    companyId: string,
  ): Promise<Array<{ preset: CanvasPreset; enabled: boolean }>> {
    const [presets, disabled] = await Promise.all([
      this.globalPresets(),
      this.disabledPresetIds(companyId),
    ]);
    return presets.map((preset) => ({ preset, enabled: !disabled.has(preset.id) }));
  }

  async setCanvasPresetEnabled(
    companyId: string,
    presetId: string,
    enabled: boolean,
  ): Promise<void> {
    const { error } = await supabase()
      .from("company_canvas_presets")
      .upsert(
        { company_id: companyId, preset_id: presetId, enabled },
        { onConflict: "company_id,preset_id" },
      );
    if (error) throw error;
  }

  private async globalPresets(): Promise<CanvasPreset[]> {
    const { data, error } = await supabase()
      .from("canvas_presets")
      .select("*")
      .eq("enabled", true)
      .order("id");
    if (error) throw error;
    return (data as CanvasPresetRow[]).map(toCanvasPreset);
  }

  private async disabledPresetIds(companyId: string): Promise<Set<string>> {
    const { data, error } = await supabase()
      .from("company_canvas_presets")
      .select("preset_id")
      .eq("company_id", companyId)
      .eq("enabled", false);
    if (error) throw error;
    return new Set((data as Array<{ preset_id: string }>).map((r) => r.preset_id));
  }
}
