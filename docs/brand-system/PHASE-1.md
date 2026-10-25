# Brand system, Phase 1: depth in the renderer

You are working in the SocialPaint repo. This phase teaches `SchemaRenderer` the depth cues `CEILING.md` measured as missing: grain, shadows, glow, layer blur, outside and center strokes, and radial gradients. They arrive as optional field and canvas properties that export the same in Chromium, Firefox and WebKit. Builder controls are Phase 2 and the importer is Phase 4.

Read these in full before planning: `CLAUDE.md`, `docs/brand-system/PLAN.md`, `docs/brand-system/RULES.md`, `docs/brand-system/CEILING.md`, `.claude/skills/field-property/SKILL.md` and this prompt.

## Decisions this phase rests on

Decided by CJ on 2026-10-25:

- **D7:** yes, depth first.
- **Colourways may change effects:** a variant can replace a field's whole effects list, and the canvas list.
- **Mesh gradients wait** for a later phase with a real design to measure against.
- **Property shapes:** approved as listed below, at this phase's recon gate.

## Property shapes

All optional. Absent renders exactly as today.

```ts
// src/lib/types.ts
export type FieldEffect =
  | { type: "dropShadow"; x: number; y: number; blur: number; spread?: number; color: string } // #RRGGBBAA; glow is 0, 0 with a brand color
  | { type: "innerShadow"; x: number; y: number; blur: number; spread?: number; color: string } // rect shapes and images only
  | { type: "layerBlur"; radius: number }
  | { type: "noise"; color: string; size: number; density: number; seed?: number }; // Figma MONOTONE noise

TemplateField.effects?: FieldEffect[]; // painted in list order
TemplateField.strokeAlign?: "inside" | "center" | "outside"; // absent = inside
TemplateSchema.canvasEffects?: FieldEffect[]; // noise and innerShadow; canvas noise paints over every field
TemplateVariant.canvasEffects?: FieldEffect[];
VariantFieldOverride.effects?: FieldEffect[];
TextGradient.kind?: "linear" | "radial"; // absent = linear
TextGradient.center?: { x: number; y: number }; // 0..1 of the box
TextGradient.radius?: { x: number; y: number }; // 0..1 of the box
```

Storage is migration **0048**, reserved in `PLAN.md`:

- `template_fields.effects jsonb`
- `template_fields.stroke_align text`
- `templates.canvas_effects jsonb`

Out of scope:

- Background blur: `backdrop-filter` doesn't survive html-to-image's foreignObject.
- Duo and multi noise.
- Mesh gradients.
- Builder controls (Phase 2).
- The importer carrying effects (Phase 4).

## How each renders

- **Effects never change layout.** `src/lib/render/layout.ts` stays untouched.
- **Shadows and glow:**
  - Every field type uses `filter: drop-shadow()`. Nothing paints as `box-shadow`: WebKit misplaces it when html-to-image exports through an SVG foreignObject (found while building; the planned box-shadow approach was dropped). A drop shadow's spread is therefore not painted.
  - Images take the filter on a wrapper outside the masked, clipped element.
  - `innerShadow` is a blurred frame drawn inside the clip of rects, the image box and the canvas, and is ignored elsewhere.
- **Layer blur:** `filter: blur()`.
- **Noise:**
  - A deterministic seeded tile from a pure module (`src/lib/render/noise.ts`).
  - Encoded once as a data URL and painted as a repeating overlay, clipped to the field.
  - Canvas noise is one overlay above every field.
- **Stroke alignment:**
  - Rects use an `outline` offset to straddle or hug the edge (one paint, so no seam).
  - SVG shapes draw the stroke unclipped, with a mask that keeps the outside half.
- **Radial gradients:**
  - `gradientCss` builds them for the canvas, rects and text.
  - SVG shapes get a `<radialGradient>`.
- **Malformed entries:** dropped at render time (`src/lib/render/effects.ts`).

## What not to touch

- `src/lib/render/layout.ts`, `canvasGesture.ts`, the builder inspector and overlay editor (Phase 2), the importer (`extract.ts`, `figmaLayers.ts`, `src/lib/figma/**`; Phase 4).
- Any committed migration. Add 0048 only.
- `package.json` dependencies.

## Steps

Commit after each step with `npm run verify` green.

0. **This prompt:** add it, set D7 in `PLAN.md`, reserve 0048, and mark Phase 1 in progress.
1. **Types and pure helpers:** the shapes above, `effects.ts`, `noise.ts`, and radial `gradientCss`, with unit tests.
2. **Storage and wiring:** every file in the `field-property` skill, plus the spots it misses:
   - `rescale.ts`;
   - the `fieldOps.ts` style lists;
   - `_shared/publicTemplate.ts` (override keys, the template allowlist, `publicVariant`) and the `public-template` select;
   - `_shared/autobuildValidate.ts` (keep a gradient's `kind`);
   - `docs/TEMPLATE_SCHEMA.md`, which also lacks the 0034 to 0036 properties.

   Also `templateStore.ts` for `canvas_effects`.
3. **Radial gradients and stroke alignment** in the renderer.
4. **Shadows, glow, inner shadow, blur and noise** in the renderer, on every field type and the canvas.
5. **Harness and fixtures:**
   - A blurred second metric with its own `blurBaseline`.
   - `kind: "synthetic"` fixtures, blessed from Chromium.
   - `goldenFrom`.
   - `effects-matrix`, `gtm-composer-depth` (canvas noise, the card's drop shadow, an outside stroke in place of the halo) and `feature-highlight-depth`.
   - Run all three engines. The 14 Phase 0 fixtures must not move.
   - **Gate:** report both metrics and the heatmaps, and stop until CJ approves the new baselines.
6. **Close-out:**
   - Update `CEILING.md`, set Phase 1 to Done, and fix the `field-property` skill.
   - Run `phase-reviewer` and `fidelity-checker` and fix their must-fix findings.
   - Open the pull request.

## Deploy order

Field saves delete and re-insert every column, so the app must not reach production before 0048 is applied. CJ runs `supabase db push` before the merge, and `public-template` is redeployed after it.

## Done when

- **Absent means today:** the 14 Phase 0 fixtures sit at their baselines.
- **Export parity:** `effects-matrix` stays within a small cross-engine band.
- **Depth closes the gap:** `gtm-composer-depth` is clearly below `gtm-composer` on the blurred metric on every engine.
