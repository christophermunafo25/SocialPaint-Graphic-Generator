// A website's brand, as onboarding holds it before anything is saved
// (PHASE-8B §9 D16). Carried over from the four-step wizard's applyPrefill:
// curated Google families pass, any other family is probed before it's
// offered, and the logo becomes a File for the same upload path a picked
// one takes.

import type { TemplateField } from "../types";
import { GOOGLE_FONTS, verifyMissingFamilies } from "../render/fonts";
import {
  logoToFile,
  type BrandFromWebsiteResult,
  type ExtractedBrandColor,
} from "../brand/brandFromWebsite";
import { DEFAULT_PALETTE } from "../theme";
import { mergeExtractedColors } from "../brand/brandPrefill";
import type { BrandColor } from "../types";

export interface BrandAnswers {
  /** The colours the person sees and edits, up to 8. */
  colors: ExtractedBrandColor[];
  headingFont?: string;
  bodyFont?: string;
  logo: File | null;
  /** The logo's preview URL (an object URL or a data URL). */
  logoPreview: string | null;
}

export const EMPTY_BRAND: BrandAnswers = { colors: [], logo: null, logoPreview: null };

export const MAX_COLORS = 8;

export interface PulledBrand extends BrandAnswers {
  /** What the pull found, for Pulling your brand's statuses. */
  found: { logo: boolean; colors: boolean; fonts: boolean };
  /** Families offered beyond the curated list (probed). */
  extraFonts: string[];
}

const ROLES: ExtractedBrandColor["role"][] = ["primary", "secondary", "accent"];

/** A colour the person added: the next free role, else accent (which the
 * palette merge appends as a roleless extra). */
export function addedColor(existing: ExtractedBrandColor[], hex: string): ExtractedBrandColor {
  const taken = new Set(existing.map((c) => c.role));
  const role = ROLES.find((r) => !taken.has(r)) ?? "accent";
  return { hex, role, name: `Brand color ${existing.length + 1}` };
}

/** The brand kit's palette: the person's colours over the default palette's
 * keyed entries, so the starter templates' role ladder still reads. With no
 * colours, the default palette as it is. */
export function paletteFrom(colors: ExtractedBrandColor[]): BrandColor[] {
  return mergeExtractedColors(DEFAULT_PALETTE, colors);
}

const isCurated = (family: string) => (GOOGLE_FONTS as readonly string[]).includes(family);

async function usableFamily(family: string | null): Promise<string | null> {
  if (!family) return null;
  if (isCurated(family)) return family;
  const missing = await verifyMissingFamilies(
    [{ fontFamily: family } as unknown as TemplateField],
    [],
  );
  return missing.length === 0 ? family : null;
}

/** The pull's answer as onboarding's brand. */
export async function brandFromPull(result: BrandFromWebsiteResult): Promise<PulledBrand> {
  const colors = result.colors.slice(0, MAX_COLORS);
  const headingFont = await usableFamily(result.headingFont);
  const bodyFont = await usableFamily(result.bodyFont);
  let logo: File | null = null;
  let logoPreview: string | null = null;
  if (result.logo) {
    try {
      logo = logoToFile(result.logo);
      logoPreview = `data:${result.logo.contentType};base64,${result.logo.base64}`;
    } catch {
      logo = null;
    }
  }
  const extraFonts = [headingFont, bodyFont].filter((f): f is string => !!f && !isCurated(f));
  return {
    colors,
    headingFont: headingFont ?? undefined,
    bodyFont: bodyFont ?? undefined,
    logo,
    logoPreview,
    extraFonts,
    found: { logo: !!logo, colors: colors.length > 0, fonts: !!(headingFont || bodyFont) },
  };
}
