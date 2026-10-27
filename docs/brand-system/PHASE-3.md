# Brand system, Phase 3: icons and vectors

You are working in the SocialPaint repo. A template can't hold an icon or a vector today. An icon has to be an uploaded SVG image with its color baked in, so it can't recolor for a dark look. The GTM composer's five Lucide icons and the Feature Highlight logo are both stuck that way (`docs/brand-system/CEILING.md`). This phase adds an icon field that draws from path data and recolors like any other field. Done when fixtures with icons and vectors match their goldens.

Read these in full before planning:

- `CLAUDE.md`
- `docs/brand-system/PLAN.md`
- `docs/brand-system/RULES.md`
- `docs/brand-system/CEILING.md`
- `docs/design/new-look/RULES.md`
- `.claude/skills/field-property/SKILL.md`
- this prompt

## Decisions

Decided by CJ on 2026-10-26:

1. **A new field type, `icon`.** It holds path data, so it covers Lucide icons and vector art such as a logo.
2. **Lucide only.** Lucide is already installed (`lucide-react`), and its line weight takes any value, so it can follow the brand's body weight later. No new package.
3. **Design in Figma first.** The icon picker and the icon inspector rows are drafted on a new page in Master UX-UI (`mEJRslarcQDkgPeY6AObi5`), "Builder · Icons (proposal)", and approved before any UI code.
4. **Uploaded SVG to vector comes later,** with Phase 4 import or the brand icon set.

In this phase an icon recolors the way every field does: its color is baked hex, and a colourway overrides it per look. Binding to color roles waits for D1 and Phase 5.

## The shape (approved with the plan, 2026-10-26)

```ts
export type FieldType = "text" | "multiline" | "image" | "select" | "shape" | "icon";

export interface FieldVector {
  viewBox: [number, number, number, number]; // minX, minY, width, height
  paths: VectorPath[];
  stroke?: { width: number; cap?: "butt" | "round" | "square"; join?: "miter" | "round" | "bevel" };
  source?: { set: "lucide"; name: string };
}

export interface VectorPath {
  d: string;
  paint?: "fill" | "stroke"; // absent: fill
  fillRule?: "nonzero" | "evenodd"; // absent: nonzero
  colorHex?: string; // absent: the field's color
}

// TemplateField
vector?: FieldVector; // icon fields only
```

- **Color and other properties.** An icon uses the existing `colorHex` (default `#111111`, as for shapes), `textGradient`, `opacity`, `effects` (no inner shadow), flips and rotation.
- **Always static.** It is never required and never member input.
- **Colourways.** `vector` is structural; a colourway may change the color, gradient, opacity, effects and visibility.
- **Storage.** Migration 0049 adds `'icon'` to the `field_type` enum and a nullable `template_fields.vector jsonb`.

## What exists to build on

- **Shapes are the model.**
  - `ShapeFieldBox` in `SchemaRenderer.tsx` draws ellipses, triangles and stars as inline SVG. It has gradient and radial defs, the filter wrapper for drop shadow, glow and blur, and noise patterns.
  - Shapes are static, non-text fields, so every place that special-cases `"shape"` is a place `icon` has to be handled.
- **Lucide's data.** Each `lucide-react/dist/esm/icons/*.js` module exports `__iconNode`, a list of SVG elements (`path`, `circle`, `rect`, `line`, `polyline`, `polygon`, `ellipse`) on a 24 viewBox. `lucide-react/dynamicIconImports` lazy-loads them by name.
- **The fixtures that need this:**
  - `gtm-composer-depth` holds five 16 px Lucide-style SVG icons with a 1.33 stroke.
  - `feature-highlight-depth` holds the logo as one SVG image of filled paths.

## What not to touch

- **The importer** (`extract.ts`, `figmaLayers.ts`, `src/lib/figma/**`). Importing Figma vectors as icon fields is Phase 4.
- **The generate and autobuild tool schemas.** Their validators must skip icon rows safely, and nothing more.
- **Brand Studio**: there is no Icons page yet.
- **Color roles.**
- **Starters.**
- **`package.json` dependencies.**
- **`src/lib/render/layout.ts`**, unless the icon's painted box needs it.

## Steps

Commit after each step with `npm run verify` green, and stop at each gate.

1. **Figma proposal.** In the inspector's visual language and the new-look tokens, build frames for:
   - "Icon" in the element palette;
   - the icon picker (search, grid, the empty and no-results states);
   - the inspector rows for a selected icon (Icon with Change, Color, Weight for line icons, Effects);
   - the same rows on a look's "This variation" tab, with "Use base".

   List every new string as proposed copy. **Gate A:** stop until CJ approves.
2. **Type, storage and wiring.** Follow the `field-property` skill end to end:
   - the type and migration 0049;
   - the rows mapper, written only when set;
   - the variant classification;
   - `fieldRules` and its `_shared` twin;
   - every `"shape"` special case;
   - the edge-function lists;
   - the builder style lists.
3. **The renderer:**
   - An `IconFieldBox` draws the vector as inline SVG, fitted inside the box with its aspect ratio kept.
     - Fill paths are filled.
     - Stroke paths are drawn with the vector's width, cap and join.
     - A path's own color wins over the field color.
     - Gradient, effects and grain are reused from the shape path.
   - Path data is sanitized when read (`readVector`, with tests).
   - The edit canvas unclips icons with effects.
4. **The builder,** built to the approved frames:
   - A Lucide catalog that lazy-loads icons, and `iconNodeToVector`, which converts Lucide's elements to paths (tested).
   - The palette entry and the picker.
   - The inspector rows.
   - The look tab with "Use base".
5. **Fixtures:**
   - Rebuild the GTM composer icons and the Feature Highlight logo in their -depth fixtures as icon fields.
   - Add a synthetic `icons-matrix` fixture: sizes, weights, a gradient, effects, a flip, and a Night look that recolors.
   - Add a round-trip store test.
   - **Gate B:** stop until CJ approves the new goldens and baselines.
6. **Close-out:**
   - Update `TEMPLATE_SCHEMA.md`, `CEILING.md` ("Since Phase 3") and `PLAN.md`.
   - Run `phase-reviewer` and `fidelity-checker`.
   - Open the pull request.

## Deploy order

Saves write the new enum value and the `vector` column as soon as a template has an icon, so migration 0049 must be applied in production before this phase merges, and `public-template` is redeployed after.

## Done when

- **Icons in the builder:** an admin can add a Lucide icon, change it, recolor it, set its weight and give it depth, and it survives save, reload and export.
- **Colourways:** a colourway recolors an icon per look.
- **Fixtures:**
  - The -depth fixtures draw their icons and logo as vectors and stay within baseline.
  - `icons-matrix` passes on all three engines.
  - Every other fixture is unchanged.
