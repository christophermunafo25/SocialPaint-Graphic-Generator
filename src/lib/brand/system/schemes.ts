// Schemes (brand-system Phase 5): one brand rendered on several grounds.
// Pure. Each scheme maps the brand's colour roles onto the colours a graphic
// paints with, then fixes what can't be read: ink must clear 4.5:1 on its
// ground (3:1 at display sizes), the accent 3:1, and ink on the accent
// 3:1, since what sits on an accent plate (a call to action, a chip label) is
// large text. A failing ink is swapped for the other ink, then walked; a failing
// accent is walked. What still fails marks the scheme unsupported.

import type { BrandKit, SchemeId } from "../../types";
import { luminance, parseHex } from "../../color";
import { hexToHsl, ratio, walkTone } from "./contrast";
import { mixHex } from "./neutrals";
import { deriveColorRoles, type PaletteUsage, type RoleMap } from "./roles";

export const SCHEMES: readonly SchemeId[] = ["light", "dark", "brand", "accent", "tonal"];

/** Body ink on its ground. */
export const INK_MIN = 4.5;
/** Display-size ink, and the accent, on the ground. */
export const LARGE_MIN = 3;

/** The colours a graphic paints with on one scheme. */
export interface SchemeColors {
  ground: string;
  card: string;
  soft: string;
  ink: string;
  inkMuted: string;
  accent: string;
  onAccent: string;
  emphasis: string;
}

export interface ResolvedScheme {
  id: SchemeId;
  colors: SchemeColors;
  /** True when every pairing clears its floor after the fixes. */
  passes: boolean;
  /** Which colours a fix changed, so Brand Studio can say so. */
  fixed: Array<keyof SchemeColors>;
}

const lum = (hex: string): number => {
  const rgb = parseHex(hex);
  return rgb ? luminance(rgb) : 0;
};
const isLight = (hex: string): boolean => lum(hex) >= 0.5;
const isChromatic = (hex: string): boolean => {
  const hsl = hexToHsl(hex);
  return !!hsl && hsl.s >= 35 && hsl.l >= 15 && hsl.l <= 85;
};

/** The candidate with the best contrast on `surface`. */
const bestOn = (surface: string, ...candidates: string[]): string =>
  candidates.reduce((best, c) => (ratio(c, surface) > ratio(best, surface) ? c : best));

/** The scheme's grounds and inks before any fix. */
function base(id: SchemeId, r: RoleMap): Omit<SchemeColors, "inkMuted" | "onAccent"> {
  const g = (role: keyof RoleMap) => r[role].hex;
  switch (id) {
    case "light":
      return {
        ground: g("ground"),
        card: g("card"),
        soft: g("soft"),
        ink: g("inkOnLight"),
        accent: g("accent"),
        emphasis: g("emphasis"),
      };
    case "dark":
      return {
        ground: g("deep"),
        card: mixHex(g("deep"), g("inkOnDark"), 0.08),
        soft: mixHex(g("deep"), g("inkOnDark"), 0.14),
        ink: g("inkOnDark"),
        accent: g("accent"),
        emphasis: g("emphasis"),
      };
    case "brand": {
      // The brand's own colour as the ground: the deep colour when it is a
      // colour at all, else the accent.
      const ground = isChromatic(g("deep")) ? g("deep") : g("accent");
      const ink = bestOn(ground, g("inkOnLight"), g("inkOnDark"));
      const accent = ground === g("accent") ? bestOn(ground, g("ground"), g("deep")) : g("accent");
      return {
        ground,
        card: mixHex(ground, ink, 0.1),
        soft: mixHex(ground, ink, 0.16),
        ink,
        accent,
        emphasis: accent,
      };
    }
    case "accent": {
      const ground = g("accent");
      const ink = bestOn(ground, g("inkOnLight"), g("inkOnDark"));
      return {
        ground,
        card: mixHex(ground, ink, 0.12),
        soft: mixHex(ground, ink, 0.2),
        ink,
        // On an accent ground the ink is the emphasis.
        accent: ink,
        emphasis: ink,
      };
    }
    case "tonal": {
      // A tint of the brand: the soft colour when the palette has one, else
      // the accent mixed into the ground.
      const ground = r.soft.source === "ramp" ? mixHex(g("ground"), g("accent"), 0.12) : g("soft");
      const ink = bestOn(ground, g("inkOnLight"), g("deep"));
      return {
        ground,
        card: mixHex(ground, g("card"), 0.5),
        soft: mixHex(ground, ink, 0.06),
        ink,
        accent: g("accent"),
        emphasis: g("emphasis"),
      };
    }
  }
}

/** One scheme's colours for a kit, contrast-fixed. */
export function resolveScheme(
  kit: BrandKit,
  id: SchemeId,
  usage?: PaletteUsage,
  roles: RoleMap = deriveColorRoles(kit, usage),
): ResolvedScheme {
  const c = base(id, roles);
  const fixed: Array<keyof SchemeColors> = [];
  let passes = true;

  // Ink: swap to the other ink, then walk.
  if (ratio(c.ink, c.ground) < INK_MIN) {
    const other = isLight(c.ground) ? roles.inkOnLight.hex : roles.inkOnDark.hex;
    const walked = ratio(other, c.ground) >= INK_MIN ? other : walkTone(c.ink, c.ground, INK_MIN);
    if (walked) {
      c.ink = walked;
      fixed.push("ink");
    } else passes = false;
  }
  // Accent and emphasis: walk toward legibility on the ground.
  for (const key of ["accent", "emphasis"] as const) {
    if (ratio(c[key], c.ground) < LARGE_MIN) {
      const walked = walkTone(c[key], c.ground, LARGE_MIN);
      if (walked) {
        c[key] = walked;
        fixed.push(key);
      } else passes = false;
    }
  }
  // Muted ink: as far toward the ground as body contrast allows.
  let inkMuted = c.ink;
  for (const t of [0.35, 0.28, 0.2, 0.12]) {
    const candidate = mixHex(c.ink, c.ground, t);
    if (ratio(candidate, c.ground) >= INK_MIN) {
      inkMuted = candidate;
      break;
    }
  }
  // Ink on the accent: whichever of the scheme's inks and ground reads best.
  const onAccent = bestOn(c.accent, c.ink, c.ground, roles.inkOnLight.hex, roles.inkOnDark.hex);
  if (ratio(onAccent, c.accent) < LARGE_MIN) passes = false;

  return { id, colors: { ...c, inkMuted, onAccent }, passes, fixed };
}

/** Which schemes the brand can support, and whether the admin enabled
 * them (absent `enabled`: every passing scheme). */
export function schemeSupport(
  kit: BrandKit,
  usage?: PaletteUsage,
): Record<SchemeId, { passes: boolean; enabled: boolean }> {
  const roles = deriveColorRoles(kit, usage);
  const enabled = kit.system?.schemes?.enabled;
  return Object.fromEntries(
    SCHEMES.map((id) => {
      const passes = resolveScheme(kit, id, usage, roles).passes;
      return [id, { passes, enabled: enabled ? enabled.includes(id) : passes }];
    }),
  ) as Record<SchemeId, { passes: boolean; enabled: boolean }>;
}
