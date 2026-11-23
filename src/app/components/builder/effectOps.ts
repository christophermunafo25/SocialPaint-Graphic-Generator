// The builder's effects list (brand-system Phase 2): which effects an
// element can take, what a new one starts as, how a row summarizes it, and
// the clamps every builder write goes through. Pure; the inspector owns the
// controls. Defaults live here, not in TSX, so no hex literal reaches a
// component.

import type { FieldEffect, TemplateField } from "@/lib/types";
import { readEffects } from "@/lib/render/effects";

/** What the add menu offers. A glow is a drop shadow at 0, 0. */
export type EffectKind = "dropShadow" | "glow" | "innerShadow" | "layerBlur" | "noise";

export const EFFECT_LABELS: Record<EffectKind, string> = {
  dropShadow: "Drop shadow",
  glow: "Glow",
  innerShadow: "Inner shadow",
  layerBlur: "Blur",
  noise: "Grain",
};

/** Where the effects list lives: an element (by its type and shape) or the
 * canvas, which takes only grain and an inner shadow. */
export type EffectTarget =
  { kind: "field"; field: Pick<TemplateField, "type" | "shape"> } | { kind: "canvas" };

/** The kinds the renderer paints on this target, in menu order. Inner
 * shadows paint on rect shapes, images and the canvas only. */
export function effectKindsFor(target: EffectTarget): EffectKind[] {
  if (target.kind === "canvas") return ["noise", "innerShadow"];
  const { type, shape } = target.field;
  const inner = type === "image" || (type === "shape" && (shape ?? "rect") === "rect");
  return ["dropShadow", "glow", ...(inner ? (["innerShadow"] as const) : []), "layerBlur", "noise"];
}

/** A drop shadow with no offset reads, and edits, as a glow. */
export function kindOf(effect: FieldEffect): EffectKind {
  if (effect.type === "dropShadow" && effect.x === 0 && effect.y === 0) return "glow";
  return effect.type;
}

/** What a newly added effect starts as. A glow takes the accent it is given
 * (a brand color), else a neutral. */
export function newEffect(kind: EffectKind, accentHex?: string): FieldEffect {
  switch (kind) {
    case "dropShadow":
      return { type: "dropShadow", x: 0, y: 8, blur: 24, color: "#00000026" };
    case "glow": {
      const hex = /^#[0-9a-f]{6}$/i.test(accentHex ?? "") ? accentHex! : "#FFFFFF";
      return { type: "dropShadow", x: 0, y: 0, blur: 32, color: `${hex.toUpperCase()}99` };
    }
    case "innerShadow":
      return { type: "innerShadow", x: 0, y: 4, blur: 12, spread: 0, color: "#00000040" };
    case "layerBlur":
      return { type: "layerBlur", radius: 8 };
    case "noise":
      return { type: "noise", color: "#FFFFFF1A", size: 1, density: 1, seed: 1 };
  }
}

/** A color's hex without its alpha, and its alpha as a percent. */
export function splitColor(color: string): { hex: string; alpha: number } {
  const hex = color.slice(0, 7).toUpperCase();
  const a = color.length >= 9 ? parseInt(color.slice(7, 9), 16) / 255 : 1;
  return { hex, alpha: Math.round(a * 100) };
}

/** A hex plus an alpha percent as #RRGGBBAA. */
export function joinColor(hex: string, alphaPct: number): string {
  const a = Math.round((Math.min(100, Math.max(0, alphaPct)) / 100) * 255);
  return `${hex.slice(0, 7).toUpperCase()}${a.toString(16).padStart(2, "0").toUpperCase()}`;
}

const n = (v: number) => String(Math.round(v * 100) / 100);

/** The one-line summary on an effect's row. */
export function effectSummary(effect: FieldEffect): string {
  switch (kindOf(effect)) {
    case "glow": {
      const e = effect as Extract<FieldEffect, { type: "dropShadow" }>;
      return `${splitColor(e.color).hex.slice(1)} · ${n(e.blur)}`;
    }
    case "dropShadow":
    case "innerShadow": {
      const e = effect as Extract<FieldEffect, { type: "dropShadow" | "innerShadow" }>;
      return `${n(e.x)}, ${n(e.y)} · ${n(e.blur)} · ${splitColor(e.color).alpha}%`;
    }
    case "layerBlur":
      return n((effect as Extract<FieldEffect, { type: "layerBlur" }>).radius);
    case "noise": {
      const e = effect as Extract<FieldEffect, { type: "noise" }>;
      const { hex, alpha } = splitColor(e.color);
      const name = hex === "#FFFFFF" ? "White" : hex === "#000000" ? "Black" : hex.slice(1);
      return `${name} · ${alpha}% · ${n(e.size)}`;
    }
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Every builder write goes through here: malformed entries drop (as the
 * renderer reads them), lengths clamp to sane ranges, and an effect the
 * target can't paint (an inner shadow on text, say) is removed. Undefined
 * for an empty list, so the field carries no `effects` key at all. */
export function normalizeEffects(raw: unknown, target: EffectTarget): FieldEffect[] | undefined {
  const allowed = new Set<FieldEffect["type"]>(
    effectKindsFor(target).map((k) => (k === "glow" ? "dropShadow" : k)),
  );
  const out = readEffects(raw)
    .filter((e) => allowed.has(e.type))
    .map((e): FieldEffect => {
      switch (e.type) {
        case "dropShadow":
        case "innerShadow":
          return {
            ...e,
            x: clamp(e.x, -500, 500),
            y: clamp(e.y, -500, 500),
            blur: clamp(e.blur, 0, 200),
            ...(e.spread !== undefined && { spread: clamp(e.spread, -200, 200) }),
          };
        case "layerBlur":
          return { ...e, radius: clamp(e.radius, 0, 200) };
        case "noise":
          return { ...e, size: clamp(e.size, 0.5, 16), density: clamp(e.density, 0, 1) };
      }
    });
  return out.length ? out : undefined;
}

/** Move the effect at `from` to `to` (drag to reorder). */
export function moveEffect(effects: FieldEffect[], from: number, to: number): FieldEffect[] {
  if (from === to || from < 0 || from >= effects.length) return effects;
  const next = [...effects];
  const [moved] = next.splice(from, 1);
  next.splice(clamp(to, 0, next.length), 0, moved);
  return next;
}
