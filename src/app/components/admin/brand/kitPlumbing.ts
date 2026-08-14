// Shared plumbing for Brand Studio's per-category detail screens: the kit
// save path (each detail saves its own slice, merged over the rest of the
// kit so nothing else moves) and the binding usage maps that power the
// usage labels and the impact confirmation.

import { useState } from "react";
import type { BrandKit, TemplateSchema } from "@/lib/types";
import { stores } from "@/lib/stores";
import { useAsync } from "@/lib/useAsync";
import { useAuth } from "@/lib/auth/AuthContext";
import { useBrand } from "@/lib/brand/BrandContext";
import { DEFAULT_PALETTE, DEFAULT_TYPE_STYLES } from "@/lib/theme";

export type KitShape = Omit<BrandKit, "id" | "companyId">;

/** The kit as a detail screen should treat it — saved values with the same
 * defaults the old single-screen editor applied. */
export function kitShape(kit: BrandKit | null): KitShape {
  return {
    colors: kit?.colors ?? DEFAULT_PALETTE,
    typeStyles: kit?.typeStyles?.length ? kit.typeStyles : DEFAULT_TYPE_STYLES,
    // Guidelines have no surface anymore but the data is preserved — every
    // save carries them through untouched.
    guidelines: kit?.guidelines ?? [],
    headingFont: kit?.headingFont ?? { source: "google", family: "Montserrat" },
    bodyFont: kit?.bodyFont ?? { source: "google", family: "Inter" },
    primaryLogoAssetId: kit?.primaryLogoAssetId,
  };
}

/** Save one category's slice: the patch lands over the saved kit, so a
 * colors save can never clobber an unrelated typography edit. */
export function useKitSave() {
  const { company } = useAuth();
  const { kit, assets, refresh } = useBrand();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (patch: Partial<KitShape>): Promise<boolean> => {
    if (!company) return false;
    setSaving(true);
    setError(null);
    try {
      await stores.brandKits.upsert(company.id, { ...kitShape(kit), ...patch });
      await refresh(); // re-theme the app + reload fonts immediately
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1500);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  return { company, kit, assets, refresh, saving, saved, error, setError, save };
}

/** Fields/templates bound to one style or color key. */
export interface BindingUsage {
  fields: number;
  templateNames: string[];
}

export const usageLabel = (u: BindingUsage | undefined): string =>
  !u || u.fields === 0
    ? "Not used yet"
    : `Used by ${u.fields} field${u.fields === 1 ? "" : "s"} in ${u.templateNames.length} template${u.templateNames.length === 1 ? "" : "s"}`;

/** The blast radius: which fields across which templates bind to each type
 * style. Fields carry no palette binding of their own — a palette color
 * reaches templates only THROUGH a type style that names it, so color usage
 * derives from style usage. If loading is slow or fails, callers simply
 * render without counts. */
export function useBrandBindings(kit: BrandKit | null) {
  const { company } = useAuth();
  const templatesState = useAsync<TemplateSchema[]>(
    () => (company ? stores.templates.listAll(company.id) : Promise.resolve([])),
    [company],
  );
  const templates = templatesState.status === "ready" ? templatesState.data : null;

  const styleUse = new Map<string, BindingUsage>();
  const colorUse = new Map<string, BindingUsage>();
  const add = (map: Map<string, BindingUsage>, key: string, templateName: string) => {
    const u = map.get(key) ?? { fields: 0, templateNames: [] };
    u.fields += 1;
    if (!u.templateNames.includes(templateName)) u.templateNames.push(templateName);
    map.set(key, u);
  };
  const styleColor = new Map(
    (kit?.typeStyles ?? []).filter((s) => s.colorKey).map((s) => [s.key, s.colorKey!]),
  );
  for (const t of templates ?? []) {
    for (const f of t.fields) {
      if (!f.typeStyleKey) continue;
      add(styleUse, f.typeStyleKey, t.name);
      const ck = styleColor.get(f.typeStyleKey);
      if (ck) add(colorUse, ck, t.name);
    }
  }
  return { templates, styleUse, colorUse };
}

/** Pending impact confirmation for a save that restyles bound fields. */
export interface Impact {
  fields: number;
  templateNames: string[];
  removals: boolean;
}

export function summarizeImpact(affected: BindingUsage[], removals: boolean): Impact | null {
  if (!affected.length) return null;
  const names = [...new Set(affected.flatMap((u) => u.templateNames))];
  return { fields: affected.reduce((n, u) => n + u.fields, 0), templateNames: names, removals };
}
