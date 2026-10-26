# The ceiling today

Written by brand-system Phase 0 on 2026-10-25, against `main` at 4094a0b (PR 169) plus the Phase 0 branch. It measures what the renderer and the Figma importer can express today for two real designs, with numbers from the fidelity harness (`node scripts/fidelity/fidelity.mjs run`). Changed share is the percentage of pixels where any channel differs from the Figma golden by more than 6. Baselines are the numbers below, approved by CJ on 2026-10-25.

Support levels: **live** means a field property draws it, **workaround** means an admin can approximate it with today's fields, and **missing** means it can't be drawn.

## Since Phase 2

Phase 2 (2026-10-26) gave the builder controls for everything Phase 1 can paint (`docs/brand-system/PHASE-2.md`), so an admin can now add depth without the importer. The six starters carry subtle depth: soft shadows on photo panels, logo cards and calls to action, a 4% grain on Feature and Stat, and a glow on Stat's rule; Dark keeps the grain and drops the shadows. All 12 were re-blessed with CJ's approval: 8 goldens moved, and the Dark Launch, Milestone, Partnership and Event render exactly as before, since Dark drops the shadows. `builder-roundtrip` holds every property the builder writes and renders its per-look effects.

| Fixture | Chromium (exact / blurred) | Firefox     | WebKit      |
| ------------------- | -------------------------- | ----------- | ----------- |
| `builder-roundtrip` | 0.00 / 0.00                | 0.17 / 0.00 | 0.73 / 1.99 |

WebKit's share sits in the outer tail of the badge's glow, the pattern `effects-matrix` shows. The list below is unchanged by Phase 2.

## Since Phase 1

Phase 1 (2026-10-25) added grain, drop shadows and glows, inner shadows, layer blur, center and outside strokes, and radial gradients (`docs/brand-system/PHASE-1.md`, `docs/TEMPLATE_SCHEMA.md`). The Phase 0 sections below are kept as measured, and these are the same frames rebuilt with depth. Each comparison now also reports a **blurred share**: the same threshold after a 4px blur of both images, which keeps tone and shadow and drops grain speckle. Two grain patterns never match pixel for pixel, so even a perfect grain scores high on the exact share.

| Fixture                   | Chromium (exact / blurred) | Firefox       | WebKit        |
| ------------------------- | -------------------------- | ------------- | ------------- |
| `gtm-composer` (Phase 0)  | 22.67 / 18.97              | 26.23 / 23.70 | 26.23 / 23.70 |
| `gtm-composer-depth`      | 11.28 / 0.45               | 11.21 / 0.69  | 6.18 / 0.69   |
| `feature-highlight-depth` | 4.49 / 9.74                | 4.37 / 9.86   | 4.94 / 10.74  |
| `effects-matrix`          | 0.00 / 0.00                | 0.41 / 0.40   | 2.12 / 2.05   |

`gtm-composer-depth` maps Figma's values directly:

- **Grain:** the frame's noise (white at 10%, density 1, size 0.5) as canvas grain.
- **Shadow:** the card's drop shadow (8, 8, blur 32, black at 10%). Figma's shadow blur equals the CSS blur radius.
- **Halo:** a 5px outside stroke in place of the halo shape.

The blurred share fell from about 19 to 24% to under 0.7% on every engine, so the panel's tone and shadow now match Figma. What is left is grain speckle and the ingredients below. `feature-highlight-depth` replaces the white backing rect with a 12px outside stroke and scores identically on both shares. Its blurred share is higher than its exact one because the headline's condensed-width drift spreads under the blur. `effects-matrix` is the parity check: every effect on every field type, blessed from Chromium. WebKit's 2.12% sits in the soft outer tails of drop shadows and glows, whose blur falls off slightly differently.

Found while building: **WebKit misplaces `box-shadow` in html-to-image exports.** html-to-image rasterizes through an SVG foreignObject. A plain div with a 20, 30 box-shadow is drawn correctly on WebKit's live page, but in the exported image the shadow is not where it should be, and an inset box-shadow does not show either. Chromium and Firefox are exact. So no effect paints as box-shadow. Drop shadows are `filter: drop-shadow()`, which exports the same in all three engines, and inner shadows are blurred frames. The cost is that a drop shadow's `spread` is stored but not painted. The same bug would affect any future use of box-shadow in exported graphics.

Still not expressible after Phase 1, in the order they now cost:

- **The condensed headline width:** a font catalog gap, about 2 points on `feature-highlight`.
- **Image placement inside the box:** the photo is pre-cropped.
- **Icons that recolor and vector paths:** Phase 3.
- **The importer carrying effects:** Phase 4.
- **A drop shadow's spread.**
- **Inner shadows on text and SVG shapes.**
- **Background blur:** `backdrop-filter` doesn't survive the export.
- **Duo and multi noise, and mesh gradients.**

## gtm-composer

Master UX-UI (`mEJRslarcQDkgPeY6AObi5`), node `200:208` ("sp-auth-panel", Sign in · Light, on page `194:2`), 688 × 1021.

### Ingredients

| Ingredient                  | Figma value                                                                             | Today      | Limited by                                                                                                                                                 |
| --------------------------- | --------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Panel ground                | IMAGE fill (gradient and fluted stripes), scale FILL, radius 20                          | live       | An image field with a radius; the raster can't be recoloured or regenerated, since the gradient isn't a gradient in Figma either                          |
| Grain                       | NOISE on the frame: MONOTONE, white at 10%, density 1, size 0.5                          | missing    | No effect property on fields or the canvas (`src/lib/types.ts:199`, `:434`); `contentBaseStyle` paints opacity only (`SchemaRenderer.tsx:369`)            |
| Composer card               | White, 560 × 110, radius 20                                                               | live       | Rect shape                                                                                                                                                 |
| Composer halo               | 5px OUTSIDE stroke, white at 25%                                                          | workaround | Strokes paint inside the box (`SchemaRenderer.tsx:494-499`); a 570 × 120 shape at radius 25 sits behind the card                                         |
| Composer shadow             | DROP_SHADOW 8, 8, blur 32, black at 10%                                                   | missing    | No shadow property (`types.ts:199`, `SchemaRenderer.tsx:369`)                                                                                              |
| Composer bevels             | Two INNER_SHADOWs, both at 0 alpha in Light                                               | missing    | No inner shadow; invisible in this colourway                                                                                                               |
| Chips and stepper           | `#ECECEC`, radius 7, 28 tall                                                              | live       | Rect shapes plus text                                                                                                                                      |
| Text                        | Inter Tight 400 at 16 (line height 1.5) and 500 at 12 (1.3), cap-trimmed                  | live       | Google family; cap trim reproduced by placing the line box, since Inter Tight's ascent minus cap height equals its descent                                |
| Send button                 | `#17FF7E` circle, 36                                                                      | live       | Ellipse shape                                                                                                                                              |
| Icons                       | Lucide plus, chevron, minus, arrow-up; 1.33 stroke; arrow in Deep Moss `#082A23`          | workaround | No icon element (`FieldType`, `types.ts:184`); SVG images with baked stroke colours                                                                        |
| Decrease button             | 32% opacity                                                                                | live       | `opacity` (0 to 100, `types.ts:230`)                                                                                                                       |
| Rounded panel corners       | Radius 20 on the frame, transparent outside                                               | workaround | The canvas has no radius; the panel image carries it over a transparent `#00000000` ground. Not measured: the compare ignores alpha, so opaque black corners would score the same |

### Changed share

| Engine   | Changed | Heatmap                                              |
| -------- | ------- | ---------------------------------------------------- |
| Chromium | 22.67%  | `test/fidelity/out/chromium/gtm-composer.heatmap.png` |
| Firefox  | 26.23%  | `test/fidelity/out/firefox/gtm-composer.heatmap.png`  |
| WebKit   | 26.23%  | `test/fidelity/out/webkit/gtm-composer.heatmap.png`   |

Where it concentrates (Chromium; Firefox and WebKit follow the same pattern):

- **The panel, about 19.5 points: the grain.** The changed pixels fill the saturated green lower left and thin out toward the pale upper right. After a 4px blur of both images, 16.3 points still differ, so most of it is a smooth shift rather than speckle: the golden runs +4.1 red, +0.6 green and +2.0 blue on average. That matches the noise effect's average, a white lift of about 0.1 × 0.5 × (255 − channel). The lift is largest on red over green and smallest on green, which is near 255. The noise sits on the frame, so it also lightens the attach tile (20 against 11) and the send button, while white stays 255.
- **The shadow band, about 1.7 points:** to the right of and below the composer.
- **The rest, under 1 point:** text edges in the composer, the halo's edge, and the composer children lifted by the grain.

## feature-highlight

GTM Graphics dogfood file (`g9mjhQHoPVgYbBIPKR1VsT`), node `62:1210` ("Feature Highlight Post / Light / Green"), 1080 × 1350.

### Ingredients

| Ingredient     | Figma value                                                                                         | Today      | Limited by                                                                                                                                                                                                    |
| -------------- | --------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ground         | White                                                                                                | live       | `backgroundColor`                                                                                                                                                                                             |
| Headline       | Bricolage Grotesque Heading SemiBold Condensed, 130, line height 0.9, −1.3 tracking, `#232323`       | workaround | The font catalog has no axes for Bricolage, so a Google request drops the width (`src/lib/render/fonts.ts:125-127`, `fontCatalog.ts:314-318`); the fixture uploads the closest static cut (wdth 79, wght 586) |
| Photo stack    | Three image layers in a mask group; only `image 9` is visible                                        | workaround | `maskUrl` stretches the mask over the field's own box (`SchemaRenderer.tsx:703-711`) and an image can't be offset inside its box (`objectFit` only, `types.ts:298`, `SchemaRenderer.tsx:733`), so the photo is pre-cropped to the mask box |
| Mask shape     | Alpha mask, 826 × 787 at 254, 482                                                                    | live       | `maskUrl` is a true alpha mask                                                                                                                                                                                |
| Logo           | Two vectors (mark and wordmark), 267 × 46.9                                                          | workaround | No vector or icon element (`types.ts:184`); one SVG image                                                                                                                                                     |
| Card           | `#17FF7E`, radius 25, 534 × 371                                                                      | live       | Rect shape                                                                                                                                                                                                    |
| Card stroke    | 12px white OUTSIDE stroke                                                                            | workaround | Inside strokes only (`SchemaRenderer.tsx:494-499`); a white 558 × 395 rect at radius 37 sits behind the card                                                                                                  |
| Subheading     | Plus Jakarta Sans 700, 40, line height 1.15, −1.6 tracking, Deep Moss                                | live       | Google family                                                                                                                                                                                                 |
| Subcopy        | Plus Jakarta Sans 500, 33.513, line height 1.3, `#272727` at 80%                                     | live       | 8-digit hex                                                                                                                                                                                                   |
| Website line   | Plus Jakarta Sans 500, 35, line height 1.1, −1.4 tracking                                            | live       | Google family                                                                                                                                                                                                 |

### Changed share

| Engine   | Changed | Heatmap                                                   |
| -------- | ------- | --------------------------------------------------------- |
| Chromium | 4.49%   | `test/fidelity/out/chromium/feature-highlight.heatmap.png` |
| Firefox  | 4.37%   | `test/fidelity/out/firefox/feature-highlight.heatmap.png`  |
| WebKit   | 4.94%   | `test/fidelity/out/webkit/feature-highlight.heatmap.png`   |

Where it concentrates (Chromium):

- **Headline, 2.10 points.** The cut is wdth 79 against Figma's condensed width, so the glyphs drift right along each line.
- **Subcopy, 1.34 points.** The lines break in different places ("for" lands on line two here). The subcopy has no tracking in Figma, so the difference is Plus Jakarta Sans as Figma ships it against Google's current build, or text layout itself. No schema property would fix it.
- **Photo, 0.59 points.** Resampling of the pre-cropped photo, plus the mask edge.
- **Subheading, website line and logo, under 0.5 points together:** glyph edges.

Firefox and WebKit concentrate in the same places, and differ only in how they draw the condensed headline: Firefox 1.93 points on the headline, WebKit 2.32. The subcopy (1.34 to 1.35), the photo (0.57 to 0.70) and the subheading (0.36 to 0.37) barely move between engines.

## The importer against these frames

From running `walk` (`supabase/functions/_shared/extract.ts`) and `decomposeFrame` (`supabase/functions/_shared/figmaLayers.ts`) offline against each `figma-node.json`, and reading `src/lib/figma/composeLayers.ts`. `figma-import` walks the root's children, renders image and mask nodes, and ships a flat frame PNG; the builder then recomposes the background from `decomposeFrame` units, and that plate replaces the flat render. Items marked inferred depend on Figma's render API or the browser and were not executed.

### gtm-composer

- **Fields (11, all static):**
  - **Text:** the four text layers (Inter Tight, weight, size, line height, `textSizing: "shrink"`).
  - **Lifted as image fields:** five whole-object vector lifts, made from Figma node renders with no radius, fill or path data. These are the attach button, chevron, decrease (opacity 32), increase and send button.
  - **Shapes:** two rect shapes for the platform select and the stepper (`#ECECEC`, radius 7).
  - **The Composer** is not a field: its stroke and effects fail `shapeContainerFill` (`extract.ts:303-304`), so the walk descends into it.
- **Baked into the background:**
  - The panel's image fill (root fills always go to the plate, `figmaLayers.ts:454`).
  - The composer's white fill and its outside stroke (`figmaLayers.ts:313-335`, `:413-419`).
  - The empty Tags frame.
- **Warnings:** `"Composer": effects on this container can't be reproduced exactly.` (`figmaLayers.ts:416-418`). Inferred: the empty Tags frame may add `this layer could not be rendered — it was skipped.` (`supabase/functions/figma-layers/index.ts:124-129`).
- **Dropped silently:**
  - **The noise.** `decomposeFrame` never reads the root's effects (`figmaLayers.ts:454-455`). The flat first background has the grain, but the recomposed plate replaces it.
  - **Shadows:** the drop and inner shadows, beyond the one container warning.
  - **Vector paths:** they are only set on unlifted VECTOR units (`figmaLayers.ts:395-400`), and `pruneTree` strips `fillGeometry` (`:485`).
  - **The panel image:** it can never become a replaceable field.
- **Outside stroke:** shifted 2.5px out, but rounded to whole pixels (61.5 to 62) and kept at radius 20 where it needs 22.5 (`figmaLayers.ts:318-333`).
- **Inferred:** a Figma node render may already include the layer's opacity, so the decrease button could draw at about 10% instead of 32%.

### feature-highlight

- **Fields (7):**
  - **Text:** the three Plus Jakarta Sans layers (the subcopy's 80% fill folds to opacity 80, `extract.ts:609`), and the headline as `Bricolage Grotesque Heading` 600 at 130.
  - **The mask group** becomes one image field at the mask's box (254, 482, 826 × 787) with a **true alpha mask** in `maskUrl` (`extract.ts:873-907`; `figma-import` renders the mask node alone, `:172-195`). Its three image layers bake into that one render. Inferred: edge alpha may be applied twice (render alpha times mask alpha).
  - **The logo** becomes a raster image field.
  - **Rectangle 129** becomes a shape with a 12px inside stroke on a box grown 12px per side.
- **Baked into the background:**
  - The white root fill.
  - The headline as well, at its render bounds, when its family is missing. "Bricolage Grotesque Heading" isn't a Google family name, so it counts as missing unless a brand font with exactly that family is uploaded. The field then draws on top in a fallback face, and the builder says `Fonts not available here: Bricolage Grotesque Heading. That text shows its Figma render until you upload them in Brand Studio.`
- **Warnings:** `"Rectangle 129": outside-aligned stroke imported as an inside stroke on a box grown 12px per side.` (info, `extract.ts:719-722`).
- **Dropped silently:**
  - The logo's paths.
  - The separate photo layers and their crops.
  - The root's clip.
- **Outside stroke:** it keeps radius 25, where Figma's outer edge is 37.

### Across both

- Root-frame effects (noise, shadows) never reach the recomposed background, and nothing warns about it.
- Container shadows get one generic warning; fields have no shadow property to carry them.
- No vector path survives into a template.
- Outside strokes are approximated without growing the radius.
- One correction to `strategy/BRAND-SYSTEM.md`, which says masks clip to the mask's bounding box. The template walk already imports an alpha mask as a true alpha mask. Only the background recompose approximates masks with a rectangle (`figmaLayers.ts:428-433`), and neither fixture hits that path.

## What Phase 1 should add

Ordered by visual impact on these fixtures. Every shape is a proposal: `TemplateField` and `TemplateSchema` are frozen, and CJ decides at Phase 1's recon gate. Each property is optional, and absent renders exactly as today.

1. **Grain (about 20 points on gtm-composer).** A noise effect on a field and on the canvas, matching Figma's NOISE parameters so the importer can carry them across unchanged:

   ```ts
   interface NoiseEffect {
     type: "noise";
     mode: "mono" | "duo" | "multi"; // Figma noiseType
     color: string; // #RRGGBBAA; mono uses one color
     secondaryColor?: string; // duo
     size: number; // grain size in px (Figma noiseSize)
     density: number; // 0..1 share of pixels covered
     seed?: number; // fixed pattern, so exports are deterministic
   }
   ```

   It goes in the effects list proposed under item 2, on `TemplateField.effects` and on a new `TemplateSchema.canvasEffects?: FieldEffect[]`. Figma puts this one on a frame, and a canvas-level slot is where it lands when the frame is the graphic. The renderer would draw a seeded noise tile as a data-URL layer, so html-to-image embeds it on every engine.

2. **Shadows (about 1.7 points on gtm-composer).** One effects list on fields, so effects compose in Figma's order:

   ```ts
   type FieldEffect =
     | {
         type: "dropShadow" | "innerShadow";
         x: number;
         y: number;
         blur: number;
         spread?: number;
         color: string; // #RRGGBBAA
       }
     | { type: "layerBlur"; radius: number }
     | { type: "backgroundBlur"; radius: number }
     | NoiseEffect;

   // TemplateField
   effects?: FieldEffect[];
   ```

   Drop shadows paint as CSS `box-shadow` on rects and `filter: drop-shadow()` on SVG shapes and images. Glow is a drop shadow at 0, 0 with the brand colour, so it needs no separate type. Each one needs the export check on Firefox and WebKit, since html-to-image rasterizes filters in an isolated SVG context.

3. **Condensed and expanded Google cuts (about 2 points on feature-highlight).** This needs no type change: `fontStretch` already exists. The catalog needs width axes for the families brands use (Bricolage Grotesque at least) in `GOOGLE_FAMILY_AXES`, so `requestableStyles` stops dropping the width (`fonts.ts:125-127`). The importer also has to map Figma's "Bricolage Grotesque Heading" onto the Google family plus its width and optical size.

4. **Image placement inside the box (about 0.6 points on feature-highlight).** The pre-crop workaround bakes the crop, so a member can't swap the photo:

   ```ts
   // TemplateField, image fields
   imageTransform?: { scale: number; x: number; y: number }; // image size and offset relative to the box, 1 = cover
   maskRect?: { x: number; y: number; width: number; height: number }; // the mask's box inside the field, canvas px
   ```

   One of the two is enough for this fixture. `imageTransform` matches Figma's crop and fills more cases (a re-cropped photo), while `maskRect` matches the importer's mask group geometry directly.

5. **Stroke alignment (workaround today, both fixtures).**

   ```ts
   // TemplateField
   strokeAlign?: "inside" | "center" | "outside"; // absent = inside, today's behaviour
   ```

   An outside stroke paints beyond the box with the radius grown by the stroke width. It replaces the extra shape both fixtures use, and the importer can stop growing the box (`extract.ts:719-722`).

6. **Radial gradients (no impact on these two fixtures; D7 lists them).** The strategy's ground for the GTM panel is a gradient with a corner glow. Here it arrived as a raster image fill, so it scores nothing in this measurement, but a brand gradient can't be expressed without it:

   ```ts
   // TextGradient
   kind?: "linear" | "radial"; // absent = linear
   center?: { x: number; y: number }; // 0..1 of the box, radial
   radius?: { x: number; y: number }; // 0..1 of the box, radial
   ```

Not for Phase 1, recorded so later phases start from it: icons that recolour by role and vector paths (Phase 3, about 0.1 points here), carrying root effects and vector paths through the importer (Phase 4), and the subcopy's line breaks, which look like a font build or layout difference rather than a schema gap.
