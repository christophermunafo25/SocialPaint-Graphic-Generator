# Brand system, Phase 2: depth in the builder

You are working in the SocialPaint repo. Phase 1 taught `SchemaRenderer` grain, drop shadows and glows, inner shadows, layer blur, center and outside strokes, radial gradients and canvas effects (`docs/brand-system/PHASE-1.md`, `docs/TEMPLATE_SCHEMA.md`). This phase gives the template builder controls for all of them and gives the starters subtle depth. Done when builder edits round-trip through save and export.

Read these in full before planning: `CLAUDE.md`, `docs/brand-system/PLAN.md`, `docs/brand-system/RULES.md`, `docs/brand-system/CEILING.md` ("Since Phase 1"), `docs/design/new-look/RULES.md`, `.claude/skills/field-property/SKILL.md` and this prompt.

## Decisions

Decided by CJ on 2026-10-25:

1. **Design in Figma first.** The controls are drafted as frames on a new page in Master UX-UI (`mEJRslarcQDkgPeY6AObi5`), "Builder · Depth (proposal)", and approved before any UI code.
2. **Starters gain subtle depth now.** CJ approves the look before the starter fixtures are re-blessed.
3. **Colourways stay optional.** A template never needs a colourway. Stroke, plate and effects controls always show and edit the template directly. In a template that already has colourways, changing a color or an effect for one look is an option on the "This variation" tab, never a requirement.

## What exists to build on

- **Inspector:**
  - Pieces: `FieldInspector.tsx` (sections and rows from `InspectorControls.tsx`).
  - Patterns to copy: the stroke and plate rows (swatch, hex input, `NumericField`, Plus/Minus) and the gradient stops list in `FillPicker.tsx`.
  - Edits: `onChange` writes the template; `look()` routes to the selected look when the template has colourways.
- **Overrides:** `effects` is already a whole-list variation override and `strokeAlign` is structural (`src/lib/templates/variants.ts`). The save path already sends `canvasEffects` (`TemplateBuilder.tsx` `doSave`, `templateStore.ts`).
- **Gaps:**
  - The edit canvas (`FieldOverlayEditor.tsx`, which contains a NUL byte, so search it with `grep -a`) clips every field's content, so shadows and outside strokes are cut off while editing.
  - It paints no canvas effects.
  - The Stroke and Plate rows are hidden in templates with colourways.
- **Helpers to reuse:** `readEffects`, `filterCss`, `innerShadowFrames`, `scaleEffects` (`src/lib/render/effects.ts`), `noiseLayerCss` (`noise.ts`), `gradientCss` and `radialGeometry` (`gradient.ts`).

## What not to touch

- `SchemaRenderer.tsx` beyond what the edit canvas needs to share.
- `src/lib/render/layout.ts`, `canvasGesture.ts`, the importer (`extract.ts`, `figmaLayers.ts`, `src/lib/figma/**`).
- The generate and autobuild tool schemas (generated depth is Track D).
- Migrations: none are needed.
- `package.json` dependencies.

## Steps

Commit after each step with `npm run verify` green, and stop at each gate.

1. **Figma proposal.** In the inspector's visual language and the new-look tokens, build frames for:
   - **The Effects section:**
     - empty, with a Plus menu offering Drop shadow, Glow, Inner shadow, Blur, Grain;
     - filled, one row per effect in paint order with its fields, remove and reorder.
   - **The stroke position control** (Inside, Center, Outside).
   - **The fill picker's Linear and Radial switch** with radial centre and size.
   - **Canvas grain and inner shadow** in the empty-selection rail.
   - **The same rows on a look's "This variation" tab**, with "Use base".

   List every new string as proposed copy. **Gate A:** stop until CJ approves.
2. **Edit canvas shows depth:**
   - Unclip fields with effects or a center or outside stroke.
   - Paint canvas effects under the selection chrome (inner shadow over the background, grain over the fields, below handles).
3. **Inspector controls** built to the approved frames:
   - the Effects section;
   - stroke position;
   - radial in the fill picker and the canvas background;
   - canvas effects in the rail;
   - the Stroke and Plate rows shown in every template, with colors per look only on "This variation".
4. **Validators:**
   - A pure `normalizeEffects` clamps what the builder writes, and keeps inner shadows off field types that can't paint them.
   - One non-blocking builder warning when a shadow or outside stroke is cut off at the canvas edge.
5. **Starters:**
   - Effects on `StarterField`, with slot colors plus alpha, resolved per Light and Dark; optional canvas effects on `StarterBlueprint`.
   - A proposed subtle depth per starter, rendered in Light and Dark.
   - **Gate B:** stop until CJ approves the look.
   - Then update snapshots and tests, bump `STARTER_VERSION`, and re-bless the 12 starter fixtures with their baselines.
6. **Round-trip proof:**
   - A store test (save and read back every new property, including a per-look effect).
   - A `builder-roundtrip` fixture on three engines.
   - A live pass in the browser pane: add each effect, save, reload, export.
7. **Close-out:**
   - Docs and `PLAN.md`.
   - Run `phase-reviewer` and `fidelity-checker`.
   - Open the pull request.

## Deploy order

Saves now write the 0048 columns whenever a template uses effects, so migration 0048 must be applied in production before this phase merges.

## Done when

- **Round trip:** every new property set in the builder survives save, reload and export.
- **Unclipped canvas:** the edit canvas shows depth without clipping.
- **Fixtures:**
  - The non-starter fixtures don't move.
  - The starter fixtures move only with CJ's approval.
  - `builder-roundtrip` passes on all three engines.
