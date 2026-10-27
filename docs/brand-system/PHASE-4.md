# Brand system, Phase 4: import fidelity

You are working in the SocialPaint repo. Phases 1 to 3 gave the renderer depth, the builder controls for it, and an icon field. The Figma importer still flattens all of it:

- **Effects:** the root frame's noise is dropped, and a container with a shadow or an outside stroke bakes into the background plate.
- **Vectors:** logos and icons lift as raster images.
- **Gradients:** radial gradients land as linear or flat.
- **Masked photos:** a masked photo is the group's own render, so the designer's crop is baked in.

An import can only be checked by hand today. This phase adds an offline replay of the real importer against the saved `figma-node.json` trees, so the fidelity harness measures imports, and then closes those gaps. Done when the GTM composer and Feature Highlight frames import as live layers that match their goldens.

Read these in full before planning:

- `CLAUDE.md`
- `docs/brand-system/PLAN.md`
- `docs/brand-system/RULES.md`
- `docs/brand-system/CEILING.md`, especially "The importer against these frames"
- `docs/design/new-look/RULES.md`
- `.claude/skills/field-property/SKILL.md`
- this prompt

## Decisions

Decided by CJ on 2026-10-27:

1. **A photo crop property.** A masked or cropped photo keeps the designer's crop and stays replaceable by members.
2. **Vectors import as icon fields.** Each path keeps its own colour. Line icons arrive as outlines, so their weight is fixed after import. Anything the converter can't express stays a raster image, as today.
3. **The done bar.** Each imported frame scores no worse than its hand-built `-depth` fixture (within the 0.25-point tolerance) on both shares and all three engines.

## Gates

- **Gate A:** CJ approves the Figma proposal for the crop rows, "Builder · Crop (proposal)".
- **Gate B:** CJ approves the `-import` and `crop-matrix` baselines.

## The shape (approved with the plan, 2026-10-27)

```ts
// TemplateField, image fields only
imageRect?: { x: number; y: number; width: number; height: number };
```

- **What it means.** These are fractions of the box. The image is fitted into this rect with `objectFit` (cover by default) and clipped by the box, its corners and its mask. A member's replacement photo lands in the same rect, as in Figma. Absent, the rect is the box itself, which is today's behaviour.
- **Resizing.** Fractions need no rescale code.
- **Colourways.** The key is structural, so a colourway never moves a crop.
- **Storage.** Migration 0050 adds a nullable `template_fields.image_rect jsonb`.
- **The import response.** It gains `canvasEffects`, the root frame's effects. `DesignImportResult` is not frozen.

Nothing else frozen changes: effects, `strokeAlign`, radial `TextGradient`, the icon `vector` and `canvasEffects` already exist.

## What exists to build on

- **The server half:**
  - `supabase/functions/figma-import/index.ts` fetches the tree once (with `geometry=paths`).
  - `walk` (`_shared/extract.ts`) suggests the fields.
  - The function then renders image and mask nodes, and resolves image fills.
- **The client half:**
  - `landImport` in `TemplateBuilder.tsx` lands the fields.
  - `figma-layers` runs `decomposeFrame` (`_shared/figmaLayers.ts`) for the units the lifted fields leave behind.
  - `composeFigmaBackground` (`src/lib/figma/composeLayers.ts`) paints those units into the plate.
  - `mergeOverlayFields` (`overlayFields.ts`) lifts the units that paint above a field.
- **Shared predicates.** `isRasterLeaf`, `isVectorArtwork`, `shapeContainerFill`, `pillContainer` and `liftDescends` are shared by the walk and the decompose. They must keep answering identically, or an element paints twice.
- **The saved trees:**
  - `test/fidelity/fixtures/gtm-composer/figma-node.json` and `feature-highlight/figma-node.json` carry `fillGeometry` and `strokeGeometry` for every vector.
  - The fidelity dev page loads fixtures asynchronously (`src/app/dev/DevRenderPage.tsx`).

## What not to touch

- **Font naming.** That includes mapping "Bricolage Grotesque Heading" onto a Google family and width (the font catalog), and the missing-font bake. The replay registers the fixture's font under Figma's family name.
- **The generate and autobuild tool schemas and validators.** They skip the new properties safely, and nothing more.
- **Canva export of crops.**
- **Brand Studio, colour roles, starters and `package.json` dependencies.**
- **Figma variables and styles (Phase 8), uploading SVG sets, and background blur.**

## Steps

Commit after each step with `npm run verify` green, and stop at each gate.

1. **Offline replay.**
   - **Shared halves:**
     - The network-free half of `figma-import` becomes a pure `importFrame(root)`. It returns the fields, the canvas effects, the warnings, and the renders and fills it needs.
     - The z-stacking in `landImport` becomes a pure helper.
   - **New fixture kind, `"import"`.** It names a saved tree, `goldenFrom`, and an `assets` map. The dev page replays the real code path: `importFrame`, then `decomposeFrame`, then `composeFigmaBackground`, then the overlay merge.
   - **Fetching assets.** `goldens.mjs fill` fetches an image fill by ref.
   - **New fixtures:** add `gtm-composer-import` and `feature-highlight-import`, then record where today's importer stands.
2. **`imageRect`:** follow the field-property skill end to end:
   - the type, migration 0050, rows, variants and rescale;
   - the docs.
3. **The renderer.** `ImageFieldBox` places the image at the rect. A synthetic `crop-matrix` fixture checks it on all three engines.
4. **The builder, Figma first:**
   - On a new Master UX-UI page (`mEJRslarcQDkgPeY6AObi5`), "Builder · Crop (proposal)", draw:
     - the image inspector's Zoom, X and Y rows and "Reset crop";
     - the look tab's read-only rows;
     - every new string.
   - **Gate A.** Then build the rows to the approved frames.
5. **Effects, strokes and gradients as properties:**
   - **Effects.** Map Figma's effects onto `FieldEffect` for every lifted node, and the root's effects onto `canvasEffects`.
   - **Containers.** A container with one solid stroke and representable effects lifts as a rect shape.
   - **Strokes.** They keep their alignment through `strokeAlign`.
   - **Radial gradients.** They become radial `TextGradient`s in the walk and the overlay fields, and are drawn elliptically in the plate.
6. **Vectors as icon fields.** `vectorOf` converts a vector-artwork subtree's fill and stroke geometry into one `FieldVector`:
   - it composes each node's transform into the root's space;
   - it gives every path its own colour;
   - it falls back to today's raster lift for anything it can't express.
7. **Photos with their crop:**
   - **A mask group** lands as the top image's bare fill, with `imageRect` and the mask render.
   - **A cropped image fill** lands as its bare fill with `imageRect`.
8. **Fixtures:**
   - The `-import` fixtures must reach their `-depth` baselines.
   - Every other fixture must stay unchanged.
   - Unit tests cover each mapper.
   - **Gate B.**
9. **Close-out:**
   - **Docs:** `TEMPLATE_SCHEMA.md`, `CEILING.md` ("Since Phase 4") and `PLAN.md`.
   - **Review:** run `phase-reviewer` and `fidelity-checker`.
   - **PR:** open the pull request.

## Deploy order

- **Before merge:** saves write `image_rect` as soon as a template has a crop, so migration 0050 must be applied in production first.
- **After merge:** deploy `figma-import`, `figma-layers` and `public-template`.

## Done when

- **Live imports.** The GTM composer and Feature Highlight frames import as live layers, which means:
  - the noise lands as canvas grain;
  - the Composer lands as a shape with its outside stroke and shadow;
  - the icons and the logo land as icon fields;
  - the photo lands replaceable, with its crop and mask.
- **Fidelity.**
  - Both `-import` fixtures score within their `-depth` baselines on all three engines.
  - `crop-matrix` passes.
  - Every other fixture is unchanged.
- **The builder.** An admin can change and reset a crop, and it survives save, reload and export.
