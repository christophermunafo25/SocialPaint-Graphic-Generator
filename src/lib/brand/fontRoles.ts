// Font roles live on type styles (new look, Phase 6, PHASE-6 §9 D3): one
// style is used for Heading and one for Body. The kit's old headingFont /
// bodyFont pointers stay in the table, unread, until Phase 9; the one thing
// that still reads them is the migration below, which turns them into roles.
//
// Readers ask this module for the role style, its face, or every face the
// styles use. Nothing reads kit.headingFont / kit.bodyFont directly.

import type { BrandKit, BrandTypeStyle, FontRef } from "../types";
import { DEFAULT_TYPE_STYLES } from "../theme";

export type FontRole = "heading" | "body";

/** The faces the default styles were created with. A style still on its
 * default face takes the account's chosen face when the roles move; any
 * other face is the admin's own choice and stays. */
const DEFAULT_FACE: Record<string, string> = {
  heading: "Montserrat",
  subhead: "Montserrat",
  body: "Inter",
};
/** Which chosen face a default-faced style takes. */
const FACE_ROLE: Record<string, FontRole> = {
  heading: "heading",
  subhead: "heading",
  body: "body",
};

/** The faces a new text field or a starter slot falls back to when no style
 * holds the role. */
export const ROLE_FALLBACK: Record<FontRole, FontRef> = {
  heading: { source: "google", family: "Montserrat" },
  body: { source: "google", family: "Inter" },
};

type KitFaces = Pick<BrandKit, "typeStyles" | "headingFont" | "bodyFont">;

/** A kit whose styles already carry roles has been migrated: every style
 * then has a `useFor` key, null where it holds no role. */
export const hasFontRoles = (styles: readonly BrandTypeStyle[]): boolean =>
  styles.some((s) => "useFor" in s);

const sameFace = (a: FontRef | undefined, b: FontRef | undefined): boolean =>
  !!a &&
  !!b &&
  a.source === b.source &&
  a.family === b.family &&
  (a.source !== "custom" || a.assetId === b.assetId);

export interface FontRoleMigration {
  typeStyles: BrandTypeStyle[];
  /** Whether anything changed (false for a migrated kit). */
  changed: boolean;
  /** The styles whose face changed: the bound fields that will render in a
   * new face are the fields bound to these. */
  restyled: string[];
}

/**
 * The D3 migration, as one pure rule (the database migration, the local
 * store's upgrade and onboarding all use it; it never runs twice on a kit):
 *
 *  - the styles keyed `heading` and `body` take the Heading and Body roles,
 *    and every other style is marked as holding none;
 *  - a style still on its default face (Montserrat for Heading and Subhead,
 *    Inter for Body) takes the account's chosen face (`headingFont` for
 *    Heading and Subhead, `bodyFont` for Body); any other face stays.
 */
export function migrateFontRoles(kit: KitFaces): FontRoleMigration {
  const styles = kit.typeStyles ?? [];
  if (hasFontRoles(styles)) return { typeStyles: styles, changed: false, restyled: [] };
  const restyled: string[] = [];
  const typeStyles = styles.map((s): BrandTypeStyle => {
    const useFor: FontRole | null = s.key === "heading" || s.key === "body" ? s.key : null;
    const def = DEFAULT_FACE[s.key];
    const chosen = FACE_ROLE[s.key] === "heading" ? kit.headingFont : kit.bodyFont;
    const onDefault = def && s.font?.source === "google" && s.font.family === def;
    if (onDefault && chosen && !sameFace(chosen, s.font)) {
      restyled.push(s.key);
      return { ...s, useFor, font: { ...chosen } };
    }
    return { ...s, useFor };
  });
  return { typeStyles, changed: styles.length > 0, restyled };
}

/** The kit with its roles in place: a stored kit is migrated as it loads,
 * so every reader sees roles even before the database migration runs. */
export function withFontRoles<K extends KitFaces>(kit: K): K {
  const { typeStyles, changed } = migrateFontRoles(kit);
  return changed ? { ...kit, typeStyles } : kit;
}

/** The styles the roles are read from: the kit's own, or the defaults (with
 * the account's faces) for a kit that has none yet. Brand Studio edits
 * these. */
export function typeStylesWithRoles(kit: KitFaces | null | undefined): BrandTypeStyle[] {
  if (!kit) return [];
  if (kit.typeStyles?.length) return withFontRoles(kit).typeStyles;
  return migrateFontRoles({ ...kit, typeStyles: DEFAULT_TYPE_STYLES }).typeStyles;
}

/** The style used for a role, if one holds it. */
export function roleStyle(
  kit: KitFaces | null | undefined,
  role: FontRole,
): BrandTypeStyle | undefined {
  return typeStylesWithRoles(kit).find((s) => s.useFor === role);
}

/** The face for a role: the role style's face, else the fallback. New text
 * in the builder and starter slots copy it (CJ, 2026-10-05: the face, not a
 * binding, so their own colors, weights and sizes stay). */
export function roleFace(kit: KitFaces | null | undefined, role: FontRole): FontRef {
  return roleStyle(kit, role)?.font ?? ROLE_FALLBACK[role];
}

/** Every face the type styles use, once each, the role faces first. */
export function styleFaces(kit: KitFaces | null | undefined): FontRef[] {
  const styles = typeStylesWithRoles(kit);
  const ordered = [
    ...styles.filter((s) => s.useFor === "heading"),
    ...styles.filter((s) => s.useFor === "body"),
    ...styles.filter((s) => s.useFor !== "heading" && s.useFor !== "body"),
  ];
  const out: FontRef[] = [];
  for (const s of ordered) {
    if (s.font && !out.some((f) => sameFace(f, s.font))) out.push(s.font);
  }
  return out;
}

/** Give `role` to the style `key` (null clears its role). One style holds
 * each role, so it moves from the style that held it. */
export function assignFontRole(
  styles: readonly BrandTypeStyle[],
  key: string,
  role: FontRole | null,
): BrandTypeStyle[] {
  return styles.map((s) => {
    if (s.key === key) return { ...s, useFor: role };
    if (role && s.useFor === role) return { ...s, useFor: null };
    return "useFor" in s ? s : { ...s, useFor: null };
  });
}
