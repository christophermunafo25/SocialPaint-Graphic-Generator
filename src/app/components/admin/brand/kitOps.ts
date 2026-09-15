// Pure kit and asset operations for the two-step Brand Studio: color roles
// (D11) and logo surfaces / per-surface primaries (D12). Pure functions over
// the domain types — no stores, no React — so the rules are testable and the
// pages just apply the returned patches through commit / the asset store.

import type { BrandAsset, BrandColor } from "@/lib/types";
import type { KitShape } from "./kitPlumbing";

export type ColorRole = NonNullable<BrandColor["role"]>;
export type LogoSurface = "dark" | "light";

const SURFACE_ORDER: readonly LogoSurface[] = ["dark", "light"];

/** Set `role` on the color at `key` (null clears it) and clear it from any
 * other color — each role belongs to one color at a time (D11). */
export function assignColorRole(
  colors: BrandColor[],
  key: string,
  role: ColorRole | null,
): BrandColor[] {
  return colors.map((c) => {
    if (c.key === key) {
      const { role: _dropped, ...rest } = c;
      return role ? { ...rest, role } : rest;
    }
    if (role && c.role === role) {
      const { role: _moved, ...rest } = c;
      return rest;
    }
    return c;
  });
}

/** Append the imported colors whose keys are new, dropping any role that
 * would conflict with one already held — an import never moves a role the
 * admin assigned (and two imported colors can't both claim one). Existing
 * entries always win, as before. */
export function mergeImportedColors(existing: BrandColor[], incoming: BrandColor[]): BrandColor[] {
  const taken = new Set(existing.map((c) => c.role).filter(Boolean));
  const fresh: BrandColor[] = [];
  for (const c of incoming) {
    if (existing.some((p) => p.key === c.key)) continue;
    if (c.role && !taken.has(c.role)) {
      taken.add(c.role);
      fresh.push(c);
    } else {
      const { role: _dropped, ...rest } = c;
      fresh.push(rest);
    }
  }
  return fresh.length ? [...existing, ...fresh] : existing;
}

/** A fresh palette entry, named and keyed exactly as the accordion-era
 * studio named them so existing custom_{n} keys keep counting up. */
export function newCustomColor(colors: BrandColor[]): BrandColor {
  const n = colors.filter((c) => c.key.startsWith("custom")).length + 1;
  return { key: `custom_${n}`, name: `Custom ${n}`, hex: "#888888" };
}

/** The surfaces a logo shows on. Absent or empty metadata reads as both —
 * every logo uploaded before D12 shows everywhere. */
export function logoSurfaces(asset: BrandAsset): LogoSurface[] {
  const stored = asset.metadata.surfaces?.filter((s): s is LogoSurface =>
    SURFACE_ORDER.includes(s as LogoSurface),
  );
  if (!stored?.length) return [...SURFACE_ORDER];
  return SURFACE_ORDER.filter((s) => stored.includes(s));
}

/** The metadata patch for a surfaces edit, or null for an empty set — a
 * logo needs at least one surface, and the caller shows the refusal. */
export function setLogoSurfaces(
  _asset: BrandAsset,
  surfaces: LogoSurface[],
): { surfaces: LogoSurface[] } | null {
  const next = SURFACE_ORDER.filter((s) => surfaces.includes(s));
  return next.length ? { surfaces: next } : null;
}

/** primaryLogoAssetId stays the dark primary, falling back to light — the
 * legacy readers (BrandContext, public path) follow the dark surface. */
const legacyPrimary = (dark: string | undefined, light: string | undefined) => dark ?? light;

/** The kit patch that makes `asset` the primary on `surface` — only
 * allowed when the asset shows there; null otherwise. */
export function setPrimaryLogo(
  kit: KitShape,
  asset: BrandAsset,
  surface: LogoSurface,
): Partial<KitShape> | null {
  if (!logoSurfaces(asset).includes(surface)) return null;
  const dark = surface === "dark" ? asset.id : kit.primaryLogoDarkAssetId;
  const light = surface === "light" ? asset.id : kit.primaryLogoLightAssetId;
  return {
    primaryLogoDarkAssetId: dark,
    primaryLogoLightAssetId: light,
    primaryLogoAssetId: legacyPrimary(dark, light),
  };
}

/** The kit patch after removing a logo: a per-surface primary that pointed
 * at it moves to the next remaining logo that shows on that surface, or
 * clears. `remaining` is the library WITHOUT the removed asset. */
export function primaryHandoffOnRemove(
  kit: KitShape,
  removedId: string,
  remaining: BrandAsset[],
): Partial<KitShape> {
  const logos = remaining.filter((a) => a.kind === "logo" && a.id !== removedId);
  const nextFor = (surface: LogoSurface, current: string | undefined) =>
    current === removedId ? logos.find((a) => logoSurfaces(a).includes(surface))?.id : current;
  const dark = nextFor("dark", kit.primaryLogoDarkAssetId);
  const light = nextFor("light", kit.primaryLogoLightAssetId);
  if (dark === kit.primaryLogoDarkAssetId && light === kit.primaryLogoLightAssetId) return {};
  return {
    primaryLogoDarkAssetId: dark,
    primaryLogoLightAssetId: light,
    primaryLogoAssetId: legacyPrimary(dark, light),
  };
}
