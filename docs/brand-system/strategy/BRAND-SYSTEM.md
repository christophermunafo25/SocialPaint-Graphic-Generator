# Brand Studio as a complete graphic design system

Written 2026-10-08 against `main` at 9106c8d (PR 168). Grounded in `src/lib/types.ts` (BrandKit, BrandColor, BrandTypeStyle, TemplateVariant), `src/app/components/admin/brand/*`, `src/lib/brand/resolveStyle.ts`, `src/lib/brand/designSystemImport.ts`, `src/lib/templates/starters/*`, `src/app/components/SchemaRenderer.tsx`, `src/lib/render/exportPng.ts`, `supabase/functions/template-generate/index.ts`, `supabase/functions/brand-from-website/index.ts`, migrations 0004, 0023, 0031 and 0032, and the project docs GENERATE-STRATEGY, COLOR-SCHEMES, DESIGN-SYSTEM-RULES and LAYOUT-SKELETONS. Graphical was studied the same day on graphicalui.com and its live editor preview. Updated later on 2026-10-08 with CJ's quality bar, which adds References, the generation loop, the proof plan, and a renderer-first phase order. Where it differs from GENERATE-STRATEGY, it proposes amendments that wait on the decisions below.

## The bar

Set by CJ on 2026-10-08: SocialPaint's AI should use the brand's design system and the marketing team's designs so precisely that whatever it makes reads as the brand team's own work. It acts as a senior-level extension of that team, producing real, complex, layered work that would take a designer or marketer hours.

Working reading: the team's own work sets the bar for craft. A minimal brand gets minimal work and a layered brand gets layered work. The AI never adds complexity the team wouldn't use.

A senior designer on a brand team carries four kinds of knowledge, and SocialPaint needs all four:

| Layer | What it holds | Where it lives |
|---|---|---|
| System | The brand's tokens: the eight pillars below | Brand Studio categories |
| Portfolio | The team's real designs decomposed into recipes: layer stacks with roles, fixed and variable parts, measured specs | References (new) |
| Judgment | Choosing the recipe and assets for a brief, writing to each slot's budget, critiquing the render | Generate: plan, compile, critique |
| Feedback | The team's edits and rejections, turned into rules | Corrections loop, with rules on References |

Precision, concretely:
- **Structure over pictures.** References keep their layers, keyed in the skeleton grammar (`role · kind · key=value`).
- **Relative units.** Sizes and gaps are stored against the canvas or in U, so a recipe carries across canvas sizes.
- **Provenance.** Every learned value shows its source and how consistently the team uses it ("radius 20 in 14 of 15 references").
- **Fixed and variable parts.** What the team never changes is locked; what changes per post is a slot with a budget.
- **Checkable rules.** Anything measurable becomes a validator.
- **Faithful rendering.** The renderer can draw every ingredient the team uses.

## The ceiling today

Your GTM brand reference makes a good test (the "Sign in and sign up" page of Master UX-UI, mEJRslarcQDkgPeY6AObi5 node 194:2): a grainy Green gradient panel at radius 20 with a Lapis corner glow and 10% white grain, a floating white composer at radius 20 with a 25% white halo and a soft 10% shadow, gray chips at radius 7, and a Slime round send button with a Deep Moss arrow.

As live layers, the renderer can draw the panel (a linear gradient on a rounded rect), the composer card, the chips (text plates at radius 7) and the button. The halo needs a second, larger shape behind the card, because strokes paint inside the box only. The grain can only be a fixed texture image, and the arrow is an uploaded image that can't recolor. The corner glow and the shadow can't be drawn at all, since the renderer has no radial gradients, blur or shadows. The missing parts are the depth cues, and depth is what makes layered work read as layered.

The importer has the matching gap. Effects survive only as pixels in the rebuilt background image (`src/lib/figma/composeLayers.ts`), effects on containers can't be reproduced exactly (`figmaLayers.ts` warns about it), masks clip to the mask's bounding box instead of its alpha, and vector paths are recorded for "a future vector-native pass". An imported design looks right, but generation can't touch anything baked into the background.

The AI can only be as layered as the renderer, so renderer and importer fidelity comes first in the phases below.

## The short version

Brand Studio holds a brand's assets: colors, fonts, type styles, logos and images. A design system also holds the rules for combining them on a canvas, such as which color is the ground, how big a headline gets on a story compared with a portrait, how much room surrounds the copy, and what the CTA looks like on a dark post.

SocialPaint has already written most of those rules. The layout skeleton library carries them in brand-neutral form: color roles and five schemes (COLOR-SCHEMES), a type scale per canvas size, a spacing rhythm, radius families, element kinds and 18 composition rules (DESIGN-SYSTEM-RULES, LAYOUT-SKELETONS). The starter templates already resolve symbolic color and font slots into a light base and a Dark variant. Two things are missing. Each tenant needs a place to set its own values for the parameters those rules leave open, which is what the eight pillars below are. The team's own designs also need to become recipes the AI composes from, which is what References adds.

Graphical's product lines up with SocialPaint piece for piece:

| Graphical | SocialPaint |
|---|---|
| Theme (colors, scale, fonts, corners, borders, shadows, icons, motion) | Brand Studio |
| Real components on Base UI | Skeleton element kinds (plate, pill, card, logo slot, icon tile) and the tenant's own templates |
| `GUI.md`, theme references and three agent skills | Brand profile, rules engine and validators feeding Generate and template chat |
| "The agent you already use" | SocialPaint's own generation, plus a possible brand connector for outside tools |

## How Graphical works

Observed on graphicalui.com and its editor preview, 2026-10-08.

- **What it sells.** A visual theme builder for people building apps with coding agents. You style a theme, then install it through the shadcn registry or download it. The download carries theme tokens for light and dark, React components built on Base UI, and agent context: `GUI.md`, detailed theme references, a setup prompt and three skills (building new screens, adapting existing UI to the theme, reviewing for inconsistent styles). The theme files work with any framework. One-time price of $49, shown as reduced from $99. Made by Josh Puckett and Adam Michela; it showed up on Hacker News around 2026-10-05.
- **Two levels of control.**
  - Quick Theme panel: Style (Base plus five presets named Felt, Canvas, Jelly, Paper and Alloy, each a full theme with its own palette, neutrals, typeface and icon set), Character, Motion (Snappy, Gentle or None), a palette strip with a custom hex, Neutrals (Mono or Warm), Primary action (Neutral or Brand), and Typography and Icons, each with a Free or Licensed switch.
  - Detailed editor behind "Edit": Colors, Scale, Fonts, Corners, Borders, Shadows, Icons, Motion.
- **Character is the standout control.** A square pad with Quiet to Bold on one axis and Compact to Airy on the other (two 0 to 100 ranges). Dragging it moves many tokens together. At Bold and Compact the preview switched to solid black selections, heavier type and tight spacing; at Quiet and Airy it went to larger, lighter type with generous padding and rounder containers.
- **The preview is real UI.** A wall of product cards (a payment card, a nav, filters, a chat, a type specimen, the palette) restyles live. A Components tab shows the live component gallery (accordion, alert dialog, autocomplete, avatar, buttons in Primary, Secondary, Outline, Ghost and Danger, checkboxes), and a light and dark toggle flips everything.

What transfers to SocialPaint is the packaging: a system the team configures once, mostly through a few high-level dials, delivered in a form AI follows. Interactive component states and status colors are interface concepts; their graphic equivalents are covered under pillars 1 and 7.

## The eight pillars for graphics

Each pillar lists what exists today, what the pillar means for a social graphic, and what to build.

### 1. Colors

**Today.** Unlimited swatches with a name and hex (`BrandColor`). Primary, Secondary and Accent each belong to one color at a time (`assignColorRole`, kitOps.ts). The editing card reads contrast against ink #0b0b0c and white (contrast.ts). Settings can snap off-palette colors to the nearest palette color (`clampToPalette`, resolveStyle.ts), though only text colors and gradient stops go through it; shape fills and strokes, text plates and the canvas background are never clamped (SchemaRenderer.tsx), which is a hole in enforcement worth closing alongside this work. Fields copy a hex at pick time and keep no link to the palette (migration 0023); type styles are the one live channel (`colorKey`). Freestyle generation gets the palette as a flat list, so the model guesses which color is the ground and which is the accent (GENERATE-STRATEGY).

**For graphics.** Posts have no success, warning or error states, and brand colors carry no semantic meaning, so status colors drop out. A post needs surface and ink roles instead: ground, soft, deep, accent, card, ink on light, ink on dark and emphasis, the role list COLOR-SCHEMES defines. Approved pairings (which ink and accent sit on which fill, checked at 4.5:1 for body and 3:1 at 44 px and up) and a color ratio (ground, support and accent, with the accent saved for the CTA and the logo) complete it.

**Build.**
- Color roles mapped onto palette keys. Derive them first (the website pull already returns primary, secondary and accent; the brand profile learns grounds and accents from published templates), then let the admin correct them.
- A neutral ramp derived from the ground and ink when the palette has none, with a temperature choice (cool, mono or warm), the same idea as Graphical's Neutrals switch. The starters' fixed neutrals (`starters/neutrals.ts`) are the current fallback.
- Pairings computed by contrast and shown on the Colors page as pass or fail, with the derived fixes COLOR-SCHEMES describes (a deeper or lighter tone, or a swapped ink). The starters' `walkAccent` and `pickOnAccent` already do this for the accent.
- Brand gradients as named assets whose stops reference palette keys, so a tenant can keep its gradients the way your brand file keeps Green, Blue, Pink, Warm and Dusk.

### 2. Light and dark

**Today.** Logos carry dark and light surface tags with a primary per surface (0032). Templates can hold colourways (0031), each built by hand as hex overrides. A type style has one color, so a heading on a dark post needs a second style ("Headline on dark" in the `VariantFieldOverride` comment). The one automatic light and dark today is the starter templates: blueprints carry symbolic slots (surface, surfaceAlt, ink, inkMuted, accent, onAccent, border, defined in `starters/types.ts`), and `materialize.ts` bakes a Light base plus a Dark variant from two slot tables, with fixed neutrals and the tenant's accent walked for contrast. Drift is deliberate there: to pick up a new palette, a tenant deletes a starter and restores it ("Restore starters").

**For graphics.** One brand rendered on several grounds. COLOR-SCHEMES defines five: Light, Dark, Brand, Accent and Tonal. Every role resolves per scheme, so one Heading style works on every ground, the logo picks its surface variant, and a tinted chip knows what to become on dark (your dark Insights treatment, where a tint becomes the family's bright color at low strength with type in its light tint, is this kind of rule).

**Build.**
- A pure scheme resolver: kit plus scheme in, role hexes out, with the contrast fixes applied. The compose compiler in GENERATE-STRATEGY calls it at compile time.
- A "Light & dark" page that shows the brand on each scheme as small specimens, flags failing pairs and switches off schemes the brand can't support.
- In the template builder, "Add colourway" offers Light, Dark and Brand. It infers each field's role the way the skeleton engine's ROLE pass does (the frame fill is the ground, text takes the on-role of the surface beneath it, accent-colored text takes emphasis) and writes an ordinary `TemplateVariant` with baked hex overrides. This generalizes the starter materializer from fixed neutrals plus one accent to the tenant's full role map, and it keeps the 2026-08 unlink decision whole: nothing published restyles itself when the brand changes.

### 3. Typography

**Today.** Fonts is the file library (uploads, Google families, variable-font cuts read by fontInspect.ts). Type styles lock font, weight, italic, width, color, size, max characters, letter spacing, line height, uppercase and sizing mode, and one style each holds Heading and Body (`useFor`). Size and tracking are absolute pixels.

**For graphics.** The same brand renders at 1080×1350, 1080×1080, 1080×1920 and 1200×627, so a heading fixed at 32 px fits one canvas and fails the others. The skeleton engine already sizes by role per canvas (hero, h1, h2, h3, body, small, label, button and stat), with floors of 32 px at 1080 wide and 34 px on landscape, and rule 3 keeps the headline at least 2.8 times the body. Graphical's "interface text and data" has a graphic twin too: stat posts, prices and dates want a number style with tabular figures.

**Build.**
- Type roles (Display, Headline, Subhead, Body, Label, CTA, Number) bound to type styles, extending `useFor` past heading and body.
- A canvas-relative scale: the engine's per-size table as the default, the tenant's ratio (how loud the headline is against the body) applied on top, and the floors enforced.
- Tracking as a percent of size so it scales. Fixed pixel sizes stay available as an override.

### 4. Spacing and scale

**Today.** Nothing in Brand Studio. The tokens importer recognizes spacing groups and skips them (designSystemImport.ts). Spacing lives per template in field geometry and layout-group gaps, and in the skeleton engine: margins of 80 on feed, 72 on story sides and 64 on landscape; a rhythm unit U of 48 at 1080 wide (28 on landscape) with gaps from 0.5U to 1.7U; the story safe band; and a logo slot of 220 × 72 with clear space of half its height.

**For graphics.** Platform rules (safe zones, type floors) stay fixed. What a brand owns is density: how much air surrounds its copy, how big its logo sits and how many words a post carries. Graphical's Character pad fits here. Compact to Airy scales the margin (the reference set measured 63 to 92 px at 1080 wide), the rhythm unit and the word budget. Quiet to Bold moves accent use, headline weight, the headline-to-body ratio and how often the brand reaches for a Brand or Accent ground.

**Build.**
- `layout` settings: density, margin, logo size, clear space and preferred corner, all clamped to the engine's ranges.
- A Character control that writes Layout, Type and Elements values together. For a tenant with published templates, the brand profile places the starting point where their own work already sits.
- The compose compiler and the checks read these, and the builder can offer brand margins as guides.

### 5. Icons

**Today.** None. There is no icon element (`FieldType` is text, multiline, image, select or shape), so an icon has to be an uploaded image with a fixed color that can't flip for dark grounds. Skeletons use icons in detail rows (event, location), feature cards and icon tiles.

**For graphics.** One family per brand in one style (outline, filled or duotone), with a weight that follows the body weight, sizes on multiples of 8, the icon at about 60 percent of its tile (Knowledge Base, section 7), and a color role so it recolors per scheme.

**Build.**
- An icon element in the renderer: an SVG recolored by role and sized on the scale.
- A curated set of open families that come in several weights, so icon weight can follow the brand's body weight (Phosphor's six weights, Material Symbols' variable weight and fill), plus uploading the brand's own SVG set.

### 6. Shape and effects

**Today.** Per element: corner radius (per corner) on images, rect shapes and text plates; inner strokes on shapes (0034); text plates and pills (0035); image masks (0036); opacity; and linear gradients on the canvas, shapes and text. Nothing is set at brand level, so every template picks its own radius. Live elements get no shadows, blur, grain, or radial and mesh gradients: SchemaRenderer only emits linear gradients, and PNG export runs through html-to-image. Figma imports keep radial gradients and shadows only as pixels baked into the rebuilt background PNG (`src/lib/figma/composeLayers.ts`), so they can't be edited or recolored.

**For graphics.**
- A radius family: square, or one container radius of 16 to 32 with inner elements at about half and pills fully round (rule 7).
- A keyline stroke weight for outline pills, plates and dividers.
- A depth style: none, soft shadow or lifted card.
- Texture: grain amount for gradient grounds.
- Gradient uses: photo fades, a light ground wash and corner glows on dark (rule 8). Photo fades work as a gradient mask on the photo, matching your rule against fading with an overlay; the mask path from 0036 carries that.
- Photo treatment: which cut shapes the brand allows and how strong the scrim gets when copy sits on a photo.

**Build.** `shape` and `effects` settings on the kit, plus renderer work for shadow, grain and radial or mesh gradients. Each new effect needs a PNG export check on Safari and Firefox, since html-to-image rasterizes in an isolated SVG context where filters and blend modes can drift.

### 7. Component states

**Today.** Element kinds exist piecemeal in the builder (plates, pills, stroked shapes, masked photos, fixed logos) and as kinds in the skeleton grammar (`pill`, `outline-pill`, `plate`, `outline-plate`, `icon`, `logo`, `scrim`, `container`). No brand defines what its CTA or its chip looks like, so every template draws them again.

**For graphics.** A post has no hover or press. Graphic elements have two kinds of state instead:
- **Surface states.** Each element is defined once and renders correctly on Light, Dark, Brand and photo grounds: the CTA on a deep ground, the chip on a tint, the stat tile on a photo.
- **Content states.** Each element has defined behavior with short and long copy, with and without a photo, and when an optional field is empty. Parts of this exist already (`textSizing`, `minFontScale`, empty optional fields left off the graphic by `render/emptyFields`, group `shrinkToFit`).

The elements worth defining are the CTA (filled, outline, or text with an arrow), chip or tag, plate, card or panel, stat tile, eyebrow, quote block, name bar, icon tile, divider and the logo slot. Graphical's "Primary action: Neutral or Brand" maps straight onto the CTA: ink or the brand accent.

**Build.**
- `elements` settings per kind: the variant, fill and label roles, padding on the rhythm, radius from the family, and icon placement (`label-then-icon`).
- The compose compiler instantiates them from skeleton slots.
- The builder gets an insert menu for brand elements that drops a pre-styled CTA, chip or card with baked values.

### 8. Motion

**Today.** Graphics export as PNG only (exportPng.ts). `motionTokens.ts` styles the app's own interface. Video generation is on the roadmap.

**For graphics.** Animated posts for stories and reels: a motion preset (Graphical's Snappy, Gentle and None translate directly), an entrance per element kind (photo first, headline next, CTA last), stagger and easing, a logo reveal, and the Knowledge Base's loop rule (3 seconds or less, ending on a still frame with the brand and the CTA).

**Build.** The largest lift, because it needs an animated export path (MP4 and GIF from the schema over time). Spec the tokens now so Elements leaves room for an entrance on each kind, and launch the page together with the export.

## What a graphic system needs beyond Graphical's eight

- **Logos.** Add clear space and minimum size (rule 15) and a preferred corner.
- **Media** (today's Images, widened). Layered work runs on assets: photos tagged by subject, crop and mood; cut-outs made by background removal; product UI captures; illustrations and stickers; textures and patterns. A photo direction (a short description plus reference images) steers picks, and steers generated imagery where the brand allows it.
- **Composition.** Rails (header and footer habits), logo corner, layering habits and skeleton affinity. References below captures these directly from the team's work.
- **Voice.** Caption tone, headline formulas and sample captions. The free-text guidelines are still stored (`guidelines`, with no surface since the two-step studio), and Generate already sends them to the model.

## References and recipes

This is the portfolio layer, and the piece that makes output read as the team's.

- **Sources.** Figma frames (full structure), SocialPaint's own published templates (full structure), and Canva exports or images (flat, rebuilt by auto-build, so approximate until a Canva integration carries structure).
- **Decomposition.** Each reference becomes a recipe in the skeleton format. Layers are keyed with `role · kind · key=value`, assigned by heuristics and a model pass and confirmed by the admin in a short review. Auto layout and anchors are kept, colors map to roles, text maps to type roles, member copy becomes slots with `max` and `lines`, and fixed layers (textures, decoration, cut-outs) stay as they are. Teams that work in Figma can also name layers in the grammar themselves for exact control.
- **One format for recipes and skeletons.** The compose compiler, the fit checks and the audits from GENERATE-STRATEGY run on both. Team recipes rank first, and skeletons cover use cases the team hasn't designed yet.
- **Composite elements.** Multi-layer components that recur across references (a floating UI card with chips, a photo cut-out with its glow and shadow, a stat badge) become Elements the compiler can place in new layouts.
- **Coverage.** A grid of use cases (hiring, event, launch, quote, stat, announcement and the rest) shows how many references each has and whether they are structured or rebuilt, so the team sees where generation will lean on skeletons.
- **What we learned.** The brand profile read-out, every value with provenance and consistency.
- **Rules.** The team's rules, written or learned from corrections, machine-checkable wherever possible.

## Generation that works like a senior designer

This proposes an amendment to GENERATE-STRATEGY, which composes from brand-neutral skeletons first.

1. **Plan.** Read the brief, pick one to three recipes from the team's references by use case and similarity (skeletons as fallback), pick the scheme, choose or prepare assets (a library photo, a cut-out, a product UI capture, generated imagery where the brand allows it), and write copy in the team's voice to each slot's budget.
2. **Compile.** Deterministic assembly of the recipe with the new content and the Brand Studio tokens: text fitted by measurement, and the layout re-flowed for the requested size through the recipe's auto layout and anchors. Re-flowing a portrait into a story or a LinkedIn image is a large share of the hours a designer would spend.
3. **Critique.** The client renders the draft (SchemaRenderer already renders to a blob in the browser through `renderSchemaBlob`, so no server renderer is needed) and sends the PNG with the three nearest team references to a critique function. It returns edits from a fixed vocabulary: swap the scheme, shorten a slot, re-crop, resize the photo within its range, switch an element variant, or swap the recipe. At most two rounds, with the deterministic checks gating every round.
4. **Learn.** Edits and rejections on drafts are stored as diffs, and repeated ones become proposed rules the admin approves. This is the loop your showstoperr learn-from-corrections mode runs, inside the product.

Two earlier calls would change with this (decisions 8 and 9). The 2026-09-18 "no agent for now" stance would give way to a bounded critique loop on Generate's new designs, while template fills keep today's measure-and-repair. Rules 11 and 12 in DESIGN-SYSTEM-RULES (one layering move, no decoration) would become the default for brands without references, with a brand's own references setting its layering budget and decorative vocabulary.

## Proof

- **Blind test per tenant.** Mix 20 generated posts with 20 of the team's real ones and ask the marketing lead which they made. The bar is picks near chance.
- **SocialPaint is tenant one.** Its Brand Studio plus the GTM Graphics file (pcB1gQKe7VC7nNmFJwSBGE) has to produce GTM posts you would publish unchanged.
- **Hours saved.** For each accepted draft, the team's estimate of how long it would have taken by hand.
- **Fixture tenants.** The three fixture tenants in GENERATE-STRATEGY's eval harness, extended with layered references.

## What to borrow from Graphical

1. **Two levels.** A few dials set a complete system, with detail one level down. Most tenant admins are marketing generalists, so the dials matter even more here than for Graphical's audience.
2. **A starting point taken from the tenant.** Graphical starts from five canned styles. SocialPaint can start from the brand itself. The website pull already fetches up to two same-origin stylesheets plus the inline CSS and sends them to the model, so radius, shadow, spacing and weight evidence is in hand and only the extraction schema needs to ask for it. The tokens importer can consume the spacing, radius, shadow, duration and easing groups it currently skips, and the brand profile reads the team's templates.
3. **The Character pad**, mapped onto graphic values as described in pillar 4.
4. **Specimens.** Graphical's preview is real UI restyled live. Brand Studio dropped its live preview in 2026-09, so each new page should render its own values as the content, the way Colors shows swatches and Logos shows logo tiles: a CTA on each ground, a radius specimen, a scheme tile.
5. **Context for AI.** Graphical hands the system to outside agents. SocialPaint's own generation is the main consumer. A later option is a brand connector or brand file that a tenant's other AI tools can read, which fits the idea of AI working inside a human-built system.

## Proposed overview

Twelve cards keep the even three-column grid:

| | | |
|---|---|---|
| Colors | Light & dark | Logos |
| Fonts | Type styles | Media |
| Icons | Layout | Shape & effects |
| Elements | Motion | References |

References takes Import's place (importing a design system or a design both happen there), and Images widens into Media. Most new cards start filled in from the website pull, the imports, the references and the brand profile, so the setup strip can keep counting what it counts today (colors, logos, type styles and images) plus at least one reference. Card meta lines can show the current value ("Rounded 24", "Airy", "Snappy", "15 references") where the existing cards show counts.

## Data model sketch

One versioned jsonb column on `brand_kits`, following the single-blob pattern of `templates.variants` (0031) and `layout_groups` (0020):

```ts
interface BrandSystem {
  version: 1;
  character?: { boldness: number; density: number }; // 0 to 100 each
  color: {
    roles: Partial<Record<ColorRole, string>>; // role -> palette key
    neutrals?: "cool" | "mono" | "warm";
    gradients: Array<{
      key: string;
      name: string;
      kind: "linear" | "radial" | "mesh";
      angle?: number;
      stops: Array<{ position: number; colorKey: string; alpha?: number }>;
    }>;
  };
  schemes: { enabled: SchemeId[]; preferred?: SchemeId }; // Light, Dark, Brand, Accent, Tonal
  type: { ratio: number; roles: Partial<Record<TypeRole, string>> }; // role -> type style key
  layout: {
    margin?: number;
    logo?: { maxW: number; maxH: number; clear: number; corner?: Corner };
  };
  shape: { radius: number; inner?: number; pills: boolean; stroke?: number };
  effects: { depth: "none" | "soft" | "lifted"; grain?: number; scrim?: number; photoCuts?: string[] };
  elements: Partial<Record<ElementKind, ElementSpec>>;
  icons?: { family: string; style: "outline" | "filled" | "duotone"; weight?: number } | { uploaded: true };
  motion?: { preset: "snappy" | "gentle" | "none" };
}
```

Values left unset fall back to the skeleton engine's defaults, so an empty system renders the way generation works today.

References need their own table, since a tenant can hold dozens and each recipe is a sizable document:

```ts
interface BrandReference {
  id: string;
  companyId: string;
  source: "figma" | "template" | "canva" | "image";
  sourceRef: string; // Figma file key and node id, template id, or asset id
  fidelity: "structured" | "rebuilt";
  useCase?: string; // hiring, event, launch, quote, stat...
  canvas: { width: number; height: number };
  recipe: Recipe; // the same shape as a parsed skeleton: keyed layers, auto layout, slots, fixed layers
  approved: boolean; // the admin confirmed the decomposition
  createdAt: string;
}
```

Code facts to respect when this becomes a prompt:
- `kitShape()` (kitPlumbing.ts) rebuilds the whole kit on every autosave, and the store writes every column. The new column has to ride `kitShape`, `SupabaseBrandKitStore.upsert` and `toBrandKit`, or autosave silently resets it (the existing comment on `allowStyleOverride` warns about the same trap).
- `designSystemImport.ts` already detects spacing, radius, shadow, elevation, duration and easing groups and returns them in `skipped`.
- `template-generate` reads only `colors, type_styles, guidelines` from `brand_kits`, so every pillar added here is new signal for Generate.
- Colourways belong in `TemplateVariant` overrides (0031), which are appearance-only and keyed by `fieldKey`. `starters/materialize.ts` is the working reference for writing them from slot tables.

## Where each pillar gets used

| Pillar | Generate (compose) | Template builder | Checks |
|---|---|---|---|
| Colors, Light & dark | Roles resolve per scheme at compile | Role-aware picker, generated colourways | Contrast per text block on its real surface |
| Type | Sizes per canvas from roles and ratio | New text fields start at the brand size for the canvas | Floors, headline at least 2.8 times body |
| Layout | Margins, rhythm, logo slot | Brand margin guides | Margins, logo clear space, safe band |
| Shape & effects | Radius and depth on panels, plates and photos | Defaults for new shapes, plates and photos | One radius family per post |
| Elements | CTA, chip, plate and card from slots | Insert brand element | Accent only on the CTA, one panel or a full plate (rule 5) |
| Icons | Icon slots in detail rows and tiles | Icon element | One family and weight per post |
| Motion | Entrance per element kind | Animation preview | Loop length, ends on a still with the CTA |
| References | Team recipes ranked first, composite elements placed in new layouts | Save a template as a reference | The skeleton fit and audit checks, run on recipes |

## Decisions for you

These change the brand model or schemas, so they're yours before any prompt gets written.

1. **Color roles.** Replace the Primary, Secondary and Accent union with the COLOR-SCHEMES roles, derived first and corrected by the admin. Secondary has no clean mapping (in your own kit it holds Ink 900, a neutral), so the migration needs a rule for it. This overlaps decision 1 in GENERATE-STRATEGY.
2. **Colourways.** Generated colourways write baked hex (keeps the 2026-08 unlink; recommended), or templates bind to schemes live. A reviewed "Reapply brand" action can recover the rebrand benefit later either way.
3. **Type sizes.** The engine's per-canvas table plus one ratio (one number to tune), or a full per-canvas table the admin edits. Separately, whether a type style's color becomes a role, which changes the one channel that is already live.
4. **Storage.** One versioned `system` column on `brand_kits` (recommended) or a column per pillar, plus a `brand_references` table.
5. **Character.** Whether to adopt the pad, and whether it sits on the Layout page or above the overview grid.
6. **Overview.** The twelve cards and their names, with References in Import's place and Images widened into Media.
7. **Renderer first.** Depth (shadow, blur and glow, radial and mesh gradients, grain, outside strokes) moves to the first phase, since the bar can't be met without it. The animated export path still comes last.
8. **Critique loop.** A bounded render-critique loop on Generate's new designs now, which reverses the 2026-09-18 "no agent for now" stance for that path. It adds a vision call or two per draft, which matters against volume pricing.
9. **Layering budget.** Rules 11 and 12 become the default for brands without references, and each brand's references set its own layering budget and decorative vocabulary.
10. **Generated imagery.** Off unless the brand turns it on, since some brands won't want generated people in their posts.

## Suggested phases

1. **Renderer and importer fidelity.** Shadows, blur and glows, radial and mesh gradients, grain, outside strokes, an icon element, vector shapes from the paths the importer already records, true alpha masks, and Figma effects kept as editable properties. Acceptance: the GTM composer frame (Master UX-UI 194:2) and the Feature Highlight dogfood frame (g9mjhQHoPVgYbBIPKR1VsT 62-1210) import as live layers and export matching Figma, each new effect checked on Safari and Firefox.
2. **System tokens.** Color roles, neutrals, pairings and gradients; the scheme resolver, the Light & dark page and generated colourways; type roles and the canvas-relative scale; layout, shape and the Character control; icon families; off-palette enforcement extended to shape fills, strokes, plates and the canvas background.
3. **References and recipes.** Import from Figma and templates, decomposition into recipes with the admin review, composite Elements, coverage and the learned read-out.
4. **Media.** Cut-outs by background removal, tagging, product UI captures and the photo direction.
5. **Generate v2.** Plan, compile and critique, with team recipes first, skeletons as fallback and re-flow across sizes. This takes over GENERATE-STRATEGY phases 3 to 5.
6. **Corrections and proof.** Diffs on drafts become proposed rules; the blind test and the hours-saved log run per tenant, starting with SocialPaint.
7. **Motion.** Presets and entrance tokens, released with the animated export path.

Import work runs alongside every phase. The website pull reads radius, shadow and spacing from the CSS it already fetches, tokens.json stops skipping the groups it detects, and the Figma import reads variables and effect styles.
