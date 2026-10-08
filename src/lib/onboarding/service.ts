// What onboarding saves, apart from the screens that collect it (new look,
// Phase 8b, PHASE-8B §9 D8 and D12). The flow holds every answer in its own
// state and calls this once, when the brand is confirmed, so leaving early
// leaves nothing behind. Built on the ordinary stores, so the dev backend
// and Supabase take the same path.

import type { BrandColor, BrandKit, Company, CompanyProfile, FontRef } from "../types";
import type { Stores } from "../stores/interfaces";
import { DEFAULT_TYPE_STYLES } from "../theme";
import { loadGoogleFonts } from "../render/fonts";
import { inspectFontFile } from "../brand/fontUpload";
import { migrateFontRoles } from "../brand/fontRoles";
import { seedStarterTemplates, type SeedResult } from "../templates/starters/seed";

/** A font file the person added, and the role it takes. */
export interface PendingFont {
  file: File;
  family: string;
  use: "heading" | "body" | "none";
}

export interface BrandDraft {
  colors: BrandColor[];
  /** Google families for the two roles; an uploaded font with that role
   * replaces its family. */
  headingGoogle: string;
  bodyGoogle: string;
  fonts: PendingFont[];
  logo: File | null;
}

export interface WorkspaceDraft {
  name: string;
  slug: string;
  /** Normalised, from the website step or the brand pull. */
  website?: string;
  /** Onboarding's answers about the workspace (D11). */
  profile?: CompanyProfile;
  brand: BrandDraft;
}

export interface CreatedWorkspace {
  company: Company;
  kit: BrandKit;
  /** Null when seeding threw before it could report. */
  seeded: SeedResult | null;
}

/** The URL-safe slug for a workspace name. */
export const slugFor = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Creates the workspace with its creator as admin, then its website, font
 * and logo assets, the brand kit (born with font roles, PHASE-6 §9 D3) and
 * the starter templates.
 *
 * The workspace, assets and kit must all save, or this throws. The website
 * and the starters are best effort: a failed website write or seeding never
 * fails onboarding. Seeding's outcome comes back for the caller to report. */
export async function createWorkspace(
  stores: Pick<Stores, "companies" | "brandAssets" | "brandKits" | "templates">,
  draft: WorkspaceDraft,
): Promise<CreatedWorkspace> {
  // Under RLS, companies.create runs the security-definer
  // create_company_with_admin RPC: the company and the admin membership,
  // atomically.
  const company = await stores.companies.create({ name: draft.name.trim(), slug: draft.slug });

  // The website and the answers are one best-effort update: neither may
  // fail onboarding.
  if (draft.website || draft.profile) {
    try {
      await stores.companies.update(company.id, {
        ...(draft.website ? { website: draft.website } : {}),
        ...(draft.profile ? { profile: draft.profile } : {}),
      });
    } catch (e) {
      console.error("Website and profile save failed", e);
    }
  }

  const { headingFont, bodyFont } = await uploadFonts(stores, company.id, draft.brand);
  loadGoogleFonts(
    [headingFont, bodyFont].filter((f) => f.source === "google").map((f) => f.family),
  );

  let primaryLogoAssetId: string | undefined;
  let logoAssetRef: string | undefined;
  if (draft.brand.logo) {
    const asset = await stores.brandAssets.upload(company.id, "logo", draft.brand.logo);
    primaryLogoAssetId = asset.id;
    logoAssetRef = asset.url;
  }

  const kit = await stores.brandKits.upsert(company.id, {
    colors: draft.brand.colors,
    typeStyles: migrateFontRoles({ typeStyles: DEFAULT_TYPE_STYLES, headingFont, bodyFont })
      .typeStyles,
    guidelines: [],
    headingFont,
    bodyFont,
    primaryLogoAssetId,
  });

  let seeded: SeedResult | null = null;
  try {
    seeded = await seedStarterTemplates(stores, {
      company: { id: company.id, name: company.name, website: draft.website },
      kit,
      logoAssetRef,
    });
    if (seeded.failed.length) console.error("Starter seeding failed for:", seeded.failed);
  } catch (e) {
    console.error("Starter seeding failed", e);
  }

  return { company, kit, seeded };
}

/** Back from Invite your team to Your brand (D12): the workspace exists, so
 * a change saves as an edit. A new logo file uploads; otherwise the kit
 * keeps the logo it has. The starters keep the palette they were seeded
 * with (materialize.ts). */
export async function updateWorkspaceBrand(
  stores: Pick<Stores, "brandAssets" | "brandKits">,
  companyId: string,
  brand: BrandDraft,
  keepLogoAssetId?: string,
): Promise<BrandKit> {
  const { headingFont, bodyFont } = await uploadFonts(stores, companyId, brand);
  let primaryLogoAssetId = keepLogoAssetId;
  if (brand.logo) {
    primaryLogoAssetId = (await stores.brandAssets.upload(companyId, "logo", brand.logo)).id;
  }
  return stores.brandKits.upsert(companyId, {
    colors: brand.colors,
    typeStyles: migrateFontRoles({ typeStyles: DEFAULT_TYPE_STYLES, headingFont, bodyFont })
      .typeStyles,
    guidelines: [],
    headingFont,
    bodyFont,
    primaryLogoAssetId,
  });
}

/** Uploaded font files become brand assets; the ones given a role replace
 * that role's Google family. */
async function uploadFonts(
  stores: Pick<Stores, "brandAssets">,
  companyId: string,
  brand: BrandDraft,
): Promise<{ headingFont: FontRef; bodyFont: FontRef }> {
  let headingFont: FontRef = { source: "google", family: brand.headingGoogle };
  let bodyFont: FontRef = { source: "google", family: brand.bodyGoogle };
  for (const pf of brand.fonts) {
    const check = await inspectFontFile(pf.file);
    if (!check.ok) continue; // validated when added; belt and braces
    const asset = await stores.brandAssets.upload(companyId, "font", pf.file, {
      ...check.metadata,
      family: pf.family,
    });
    const ref: FontRef = { source: "custom", family: pf.family, assetId: asset.id };
    if (pf.use === "heading") headingFont = ref;
    if (pf.use === "body") bodyFont = ref;
  }
  return { headingFont, bodyFont };
}

/** The notice the template list shows when seeding fell short. */
export function seedNoticeFor(seeded: SeedResult | null): string | null {
  if (!seeded) {
    return "Your starter templates could not be created. Use Restore starter templates to try again.";
  }
  if (seeded.failed.length) {
    return "Some starter templates could not be created. Use Restore starter templates to try again.";
  }
  return null;
}

/** The person's own answers: their name (users.name) and role
 * (users.job_role). Best effort, and skipped on the dev backend, which has
 * no accounts: a failed write never fails onboarding. */
export async function savePerson(
  stores: Pick<Stores, "account">,
  userId: string | undefined,
  person: { name: string; role?: string },
): Promise<void> {
  if (!userId || !stores.account.isAvailable()) return;
  try {
    if (person.name.trim()) await stores.account.setDisplayName(userId, person.name.trim());
    if (person.role) await stores.account.setJobRole(userId, person.role);
  } catch (e) {
    console.error("Saving the person's answers failed", e);
  }
}
