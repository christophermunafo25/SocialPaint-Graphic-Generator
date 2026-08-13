import type { BrandKit } from "./types";

/** Expose the active tenant's brand kit as --brand-* CSS variables.
 *
 * The platform chrome is styled by the SocialPaint design system
 * (src/styles/socialpaint.css) and is NOT re-themed per tenant — tenant
 * brand expression lives in the template graphics, the brand-kit pickers,
 * and --brand-* accents on template-adjacent surfaces. */
const touched = new Set<string>();

export function applyBrandTheme(kit: BrandKit | null): void {
  const root = document.documentElement;
  // Reset anything a previously selected tenant set.
  for (const name of touched) root.style.removeProperty(name);
  touched.clear();
  if (!kit) return;

  for (const color of kit.colors) {
    const brandVar = `--brand-${color.key}`;
    root.style.setProperty(brandVar, color.hex);
    touched.add(brandVar);
  }
  if (kit.headingFont) {
    root.style.setProperty("--brand-font-heading", `"${kit.headingFont.family}", sans-serif`);
    touched.add("--brand-font-heading");
  }
  if (kit.bodyFont) {
    root.style.setProperty("--brand-font-body", `"${kit.bodyFont.family}", sans-serif`);
    touched.add("--brand-font-body");
  }
}

/** Sensible starting type styles offered by onboarding — pure defaults the
 * user renames, edits, extends without limit. */
export const DEFAULT_TYPE_STYLES = [
  {
    key: "heading",
    name: "Heading",
    font: { source: "google" as const, family: "Montserrat" },
    weight: 700,
    uppercase: true,
    colorKey: "text",
    textSizing: "shrink" as const,
  },
  {
    key: "subhead",
    name: "Subhead",
    font: { source: "google" as const, family: "Montserrat" },
    weight: 600,
    colorKey: "text",
  },
  {
    key: "body",
    name: "Body",
    font: { source: "google" as const, family: "Inter" },
    weight: 400,
    colorKey: "text",
    maxLength: 200,
  },
];

/** Sensible starting palette offered by onboarding — the user overrides these;
 * nothing brand-specific ships. */
export const DEFAULT_PALETTE = [
  { key: "primary", name: "Primary", hex: "#2F3B4C" },
  { key: "secondary", name: "Secondary", hex: "#E7EAEF" },
  { key: "accent", name: "Accent", hex: "#C9A227" },
  { key: "text", name: "Text", hex: "#1A1F26" },
  { key: "background", name: "Background", hex: "#F6F7F9" },
];
