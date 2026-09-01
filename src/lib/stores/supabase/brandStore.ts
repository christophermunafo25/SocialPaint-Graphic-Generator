import type { BrandAsset, BrandKit } from "../../types";
import type { BrandAssetStore, BrandKitStore } from "../interfaces";
import { BUCKETS, supabase } from "./client";
import { toBrandAsset, toBrandKit, type BrandAssetRow, type BrandKitRow } from "./rows";

export class SupabaseBrandKitStore implements BrandKitStore {
  async getActive(companyId: string): Promise<BrandKit | null> {
    const { data, error } = await supabase()
      .from("brand_kits")
      .select("*")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw error;
    return data ? toBrandKit(data as BrandKitRow) : null;
  }

  async upsert(companyId: string, kit: Omit<BrandKit, "id" | "companyId">): Promise<BrandKit> {
    const existing = await this.getActive(companyId);
    const row = {
      company_id: companyId,
      colors: kit.colors,
      type_styles: kit.typeStyles,
      guidelines: kit.guidelines,
      heading_font: kit.headingFont ?? null,
      body_font: kit.bodyFont ?? null,
      primary_logo_asset_id: kit.primaryLogoAssetId ?? null,
      allow_style_override: kit.allowStyleOverride ?? false,
      allow_off_palette: kit.allowOffPalette ?? true,
      is_active: true,
      updated_at: new Date().toISOString(),
    };
    const q = existing
      ? supabase().from("brand_kits").update(row).eq("id", existing.id).select().single()
      : supabase().from("brand_kits").insert(row).select().single();
    const { data, error } = await q;
    if (error) throw error;
    return toBrandKit(data as BrandKitRow);
  }
}

export class SupabaseBrandAssetStore implements BrandAssetStore {
  async list(companyId: string, kind?: BrandAsset["kind"]): Promise<BrandAsset[]> {
    let q = supabase().from("brand_assets").select("*").eq("company_id", companyId);
    if (kind) q = q.eq("kind", kind);
    const { data, error } = await q.order("created_at");
    if (error) throw error;
    return (data as BrandAssetRow[]).map(toBrandAsset);
  }

  async upload(
    companyId: string,
    kind: BrandAsset["kind"],
    file: File,
    metadata: BrandAsset["metadata"] = {},
  ): Promise<BrandAsset> {
    const path = `${companyId}/${kind}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const up = await supabase().storage.from(BUCKETS.brandAssets).upload(path, file);
    if (up.error) throw up.error;
    const { data, error } = await supabase()
      .from("brand_assets")
      .insert({ company_id: companyId, kind, name: file.name, storage_path: path, metadata })
      .select()
      .single();
    if (error) throw error;
    return toBrandAsset(data as BrandAssetRow);
  }

  async remove(id: string): Promise<void> {
    const { data, error } = await supabase()
      .from("brand_assets")
      .delete()
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) throw error;
    const path = (data as BrandAssetRow | null)?.storage_path;
    if (path && !/^https?:\/\//.test(path)) {
      await supabase().storage.from(BUCKETS.brandAssets).remove([path]);
    }
  }
}
