// Colour roles (brand-system Phase 5, D1): which palette colour does which
// job in a graphic. Pure. The admin's corrections live in
// BrandKit.system.color.roles; everything else is derived here at read time,
// from how the team's templates use each colour, then the palette's old
// Primary / Accent labels, then lightness and saturation, and last a neutral
// ramp. Each resolved role says where it came from, so Brand Studio (Phase 6)
// can show what it inferred and what the admin set.

import type { BrandColor, BrandKit, ColorRole, TemplateSchema } from "../../types";
import { luminance, parseHex } from "../../color";
import { hexToHsl, ratio } from "./contrast";
import { mixHex, RAMPS } from "./neutrals";

export const COLOR_ROLES: readonly ColorRole[] = [
  "ground",
  "soft",
  "deep",
  "accent",
  "card",
  "inkOnLight",
  "inkOnDark",
  "emphasis",
];

export type RoleSource = "admin" | "usage" | "legacy" | "derived" | "ramp";

export interface ResolvedRole {
  hex: string;
  /** The palette key behind it; absent for a ramp neutral. */
  key?: string;
  source: RoleSource;
}

export type RoleMap = Record<ColorRole, ResolvedRole>;

/** How often each palette key does each job across a set of templates. */
export type PaletteUsage = Record<string, Partial<Record<ColorRole, number>>>;

const norm = (hex: string): string => hex.slice(0, 7).toUpperCase();
const lum = (hex: string): number => {
  const rgb = parseHex(hex);
  return rgb ? luminance(rgb) : 0;
};
const isLight = (hex: string): boolean => lum(hex) >= 0.5;
const saturation = (hex: string): number => hexToHsl(hex)?.s ?? 0;
/** Saturated enough to read as a brand colour rather than a neutral. */
const isChromatic = (hex: string): boolean => {
  const hsl = hexToHsl(hex);
  return !!hsl && hsl.s >= 35 && hsl.l >= 15 && hsl.l <= 85;
};

/** Area shares that separate a panel from a card from a chip. */
const PANEL_SHARE = 0.25;
const CHIP_SHARE = 0.03;

/** How each palette colour is used in the templates: a light canvas or panel
 * is a ground, a dark one is deep, a mid-size light fill is a card (soft
 * when tinted), a chromatic chip or plate is the accent, and text is ink on
 * the light or dark ground under it (emphasis when it's chromatic). Colours
 * off the palette count for nothing. */
export function paletteUsage(templates: TemplateSchema[], colors: BrandColor[]): PaletteUsage {
  const keyOf = new Map(colors.filter((c) => parseHex(c.hex)).map((c) => [norm(c.hex), c.key]));
  const usage: PaletteUsage = {};
  const count = (hex: string | undefined, role: ColorRole) => {
    if (!hex || !parseHex(hex)) return;
    const key = keyOf.get(norm(hex));
    if (!key) return;
    const entry = (usage[key] ??= {});
    entry[role] = (entry[role] ?? 0) + 1;
  };
  for (const t of templates) {
    const canvasArea = Math.max(1, t.canvasWidth * t.canvasHeight);
    const ground = t.backgroundColor && parseHex(t.backgroundColor) ? t.backgroundColor : undefined;
    if (ground) count(ground, isLight(ground) ? "ground" : "deep");
    const groundIsLight = ground ? isLight(ground) : true;
    for (const f of t.fields) {
      if (f.type === "shape" && f.colorHex && !f.textGradient) {
        const share = (f.width * f.height) / canvasArea;
        const hex = f.colorHex;
        if (share >= PANEL_SHARE) count(hex, isLight(hex) ? "ground" : "deep");
        else if (isChromatic(hex)) count(hex, "accent");
        else if (share >= CHIP_SHARE) {
          count(hex, !isLight(hex) ? "deep" : saturation(hex) >= 12 ? "soft" : "card");
        }
      }
      if (f.type === "text" || f.type === "multiline") {
        if (f.plateColor) count(f.plateColor, isChromatic(f.plateColor) ? "accent" : "card");
        const surface = f.plateColor ?? ground;
        const onLight = surface ? isLight(surface) : groundIsLight;
        if (f.colorHex) {
          count(
            f.colorHex,
            isChromatic(f.colorHex) && !f.plateColor
              ? "emphasis"
              : onLight
                ? "inkOnLight"
                : "inkOnDark",
          );
        }
      }
    }
  }
  return usage;
}

/** The palette key used most for `role`, or undefined. */
function mostUsed(usage: PaletteUsage, role: ColorRole): string | undefined {
  let best: string | undefined;
  let n = 0;
  for (const [key, roles] of Object.entries(usage)) {
    const c = roles[role] ?? 0;
    if (c > n) {
      best = key;
      n = c;
    }
  }
  return best;
}

/** Every role resolved for a kit. `usage` (from paletteUsage) lets the
 * team's own templates decide; without it the palette alone does. */
export function deriveColorRoles(kit: BrandKit, usage?: PaletteUsage): RoleMap {
  const palette = kit.colors.filter((c) => parseHex(c.hex));
  const byKey = new Map(palette.map((c) => [c.key, c]));
  const out: Partial<RoleMap> = {};
  const set = (role: ColorRole, c: BrandColor | undefined, source: RoleSource) => {
    if (c && !out[role]) out[role] = { hex: norm(c.hex), key: c.key, source };
  };

  // 1. The admin's corrections.
  for (const [role, key] of Object.entries(kit.system?.color?.roles ?? {})) {
    set(role as ColorRole, byKey.get(key as string), "admin");
  }
  // 2. How the templates use each colour. This is where Secondary lands.
  if (usage) {
    for (const role of COLOR_ROLES) {
      const key = mostUsed(usage, role);
      set(role, key ? byKey.get(key) : undefined, "usage");
    }
  }
  // 3. The old labels: Accent stays the accent, Primary is the deep brand
  // colour. Secondary has no clean mapping, so only use decides it.
  set(
    "accent",
    palette.find((c) => c.role === "accent"),
    "legacy",
  );
  set(
    "deep",
    palette.find((c) => c.role === "primary"),
    "legacy",
  );

  // 4. Lightness and saturation, over colours no role holds yet.
  const taken = () => new Set(Object.values(out).map((r) => r?.key));
  const free = () => palette.filter((c) => !taken().has(c.key));
  const byLum = (cs: BrandColor[]) => [...cs].sort((a, b) => lum(b.hex) - lum(a.hex));
  if (!out.ground) {
    const light = byLum(free()).filter((c) => lum(c.hex) >= 0.8);
    set("ground", light[0], "derived");
  }
  if (!out.inkOnLight) {
    const ground = out.ground?.hex ?? RAMPS.mono.ground;
    const inks = byLum(free())
      .reverse()
      .filter((c) => ratio(c.hex, ground) >= 4.5);
    set("inkOnLight", inks[0], "derived");
  }
  if (!out.accent) {
    const chroma = free()
      .filter((c) => isChromatic(c.hex))
      .sort((a, b) => saturation(b.hex) - saturation(a.hex));
    set("accent", chroma[0], "derived");
  }
  if (!out.deep) {
    const dark = byLum(free())
      .reverse()
      .filter((c) => lum(c.hex) < 0.2);
    set("deep", dark[0], "derived");
  }
  if (!out.soft) {
    const groundHex = out.ground?.hex;
    const soft = byLum(free()).filter(
      (c) => lum(c.hex) >= 0.6 && (!groundHex || norm(c.hex) !== groundHex),
    );
    set("soft", soft[0], "derived");
  }
  if (!out.emphasis && out.accent) out.emphasis = { ...out.accent, source: "derived" };

  // 5. A neutral ramp, built from the ground and ink when they exist, for
  // whatever the palette doesn't cover.
  const ramp = RAMPS[kit.system?.color?.neutrals ?? "mono"];
  const ground = out.ground?.hex ?? ramp.ground;
  const ink = out.inkOnLight?.hex ?? ramp.inkOnLight;
  const fromRamp: Record<ColorRole, string> = {
    ground,
    inkOnLight: ink,
    soft: mixHex(ground, ink, 0.06),
    card: mixHex(ground, ramp.card, 0.5),
    deep: mixHex(ink, ground, 0.08),
    inkOnDark: isLight(ground) ? mixHex(ground, ramp.inkOnDark, 0.5) : ramp.inkOnDark,
    accent: ramp.accent,
    emphasis: out.accent?.hex ?? ramp.accent,
  };
  for (const role of COLOR_ROLES) {
    if (!out[role]) out[role] = { hex: norm(fromRamp[role]), source: "ramp" };
  }
  return out as RoleMap;
}
