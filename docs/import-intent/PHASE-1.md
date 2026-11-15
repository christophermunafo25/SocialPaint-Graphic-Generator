# Import intent, Phase 1: read the frame, then build it

Status (2026-11-14): Steps 1 to 5 done, Gates 1 and 2 passed. Step 6's script (`scripts/import-intent/eval.mjs`) and its offline half are done; the model half needs an Anthropic key in the environment, and Gate 3 waits on it. `RECON-1.md` holds the recon. The P15 fixture is `portrait-plate-import`, a neutral copy of the frame in the GTM Graphics file (`g9mjhQHoPVgYbBIPKR1VsT`, node `432:3`), with no baseline until CJ approves one: it scores about 0.7% to 0.9% once pull request 184 (I8) is merged in, with the cap-trim correction (I9) already here.

You are working in the SocialPaint repo. An admin who imports a Figma frame should get the template the designer made, with its member form already set up, whichever way they import it. Today the two Figma routes disagree, and both leave work behind:

- **Import from Figma** builds a faithful template (brand-system Phase 4 carried masks, crops, effects, vectors and plates through), but every element lands Fixed and labeled with its raw layer name. The admin turns fields on, renames them, sets limits, and writes the name and caption by hand.
- **Auto build** fills the form in with one model call, but its Figma path still reads the older extraction, so it drops what Phase 4 added.

This phase makes the importer read how a frame is made before it builds anything: the layer names when the designer keyed them in the skeleton grammar (`role · kind · key=value`), the auto layout around each element, and one model pass for whatever the names leave open. Every Figma route then builds from the faithful import with the form filled in.

The measure is **edits**: one change an admin makes in the builder after an import before the template is ready to publish (a Fixed toggle, a label, a limit, a size, position or padding change, or a name, description, category, tag or caption edit).

## Read these in full before you start

- `CLAUDE.md`
- `docs/brand-system/PLAN.md` and `docs/brand-system/RULES.md`. This phase follows those rules.
- `docs/brand-system/CEILING.md`, especially "Since Phase 4" and "The importer against these frames"
- `docs/brand-system/PHASE-4.md`
- `docs/brand-system/strategy/BRAND-SYSTEM.md`, especially "References and recipes"
- `docs/design/new-brand/PLAN.md`, Phases 6a and 6b, which rebuild the import dialogs and the editor chrome
- `docs/TEMPLATE_SCHEMA.md`
- this prompt

## Where this sits

- **Brand-system Phase 9** (not started) is a parser for the same grammar. Build the parser here, in the shape Phase 9 would use, and mark its row "parser built by import intent Phase 1; skeleton ingestion still open".
- **Brand-system Phase 10** decomposes references into recipes "assigned by heuristics and a model pass". This phase is that pass's first use, on imports. Keep the keys in the recipe vocabulary so Phase 10 reuses them.
- **New-brand Phases 6a and 6b** rebuild the Figma import and auto build dialogs and the editor chrome. This phase changes what an import lands and the notice text, and no screen or layout.
- Two plans were drafted outside this repo: auto layout imported as stacks, and an "Any input" program (`lines`, `maxWidth`, photo placement, cut-outs). Neither is part of this phase, and neither is in `docs/`, so don't look for them.

## The test frame

Figma file "Adler Platt Pediatrics · SocialPaint Templates" (`NxxAhn8QDFlJJSWHLrP5al`), node `33:12`, "P15 · Doctor topic · Portrait with plate", 1080 × 1350. Read exact values with the Figma MCP server. Read on 2026-11-14:

| Layer | What it is |
| --- | --- |
| The frame | Solid `#0C3654`, clips content |
| `Mask group` (`32:40`, a GROUP) | `Rectangle 1` is an ALPHA mask filled with a linear gradient from opaque to transparent. `photo-fill · image · fit=cover · edit=member` carries a CROP image fill. The navy fade at the bottom is this mask letting the frame's navy through, not a gradient laid over the photo |
| `plate · plate · fill=accent · edit=fixed` (`33:16`) | Frame, `#FFE0CF`, radius 40, 926 × 438 fixed on both axes, vertical auto layout, space between, padding 70 / 56 / 45 / 56, gap 40 |
| `Group 8` (`40:6`) | A group wrapping the headline and nothing else |
| `headline · text · edit=member · max=32 · lines=3 · text=on-accent · align=left` (`33:18`) | Newsreader Medium 88, line height 105%, tracking −2.5%, auto height, cap height trim, 709 wide, two lines as drawn |
| `Frame 8` (`40:5`) | Horizontal auto layout filling the plate's 814 inner width, space between, items centered |
| `cta · pill · fill=card · edit=fixed` (`40:2`) | Hug-width pill, `#F7BFA0`, radius 999, padding 26 / 44, 76 tall |
| `cta · text · edit=member · max=24 · text=on-card · align=center` (`40:3`) | Inter Medium 30, line height 130%, cap height trim, `#003659` |
| `logo · logo · variant=primary · surface=light · edit=fixed` (`33:19`) | Image fill, 240 × 76 |

The Templates page holds 27 more frames (P01 to P18, plus a v2 and v3 of P01 to P04), keyed the same way. Kinds in use: group, shape, image, text, logo, sticker, plate, pill, rule, mark, tile. Keys in use: edit, align, max, text, fill, fit, shape, lines, variant, surface, subject, crop, points. Nearly every text layer is cap height trimmed. P01 to P04 and their versions are set to modes of an "Adler Platt · Scheme" variable collection with six modes (Sky, Peach, Mint, Butter, Periwinkle, Navy), and most of their layers bind their colors to it; P05 onward use raw hex.

## What today's importer does with it

From reading the code. Step 1 confirms or corrects each point by replay before anything changes (`RECON-1.md` has the corrections).

**Import from Figma**

- **Photo.** One image field with its crop (`imageRect`) and the gradient mask (`maskUrl`), so the fade survives and follows a member's replacement photo. It is labeled "Mask group", because the field takes the group's name (`extract.ts:1208`) while the keys sit on the photo inside it.
- **Plate.** A fixed rect shape.
- **Headline.** A Fixed multiline text field labeled with its whole layer name, its box about 709 × 185 (two lines grown back from the cap trim).
- **CTA.** The pill and its text fuse into one plated text field (`extract.ts:1124`), labeled with the container's name. Two problems:
  - `align: "center"` (`extract.ts:1151`) makes the plate grow from its center (`platedRect`, `src/lib/render/layout.ts:160`), so a longer or shorter CTA moves its left edge off the headline's.
  - `platePaddingY` comes from the cap-trimmed text box (`extract.ts:1155`, 27) while the text paints a full line box (39), so the pill draws about 93 tall instead of 76.
- **Logo.** A fixed image from the node render, not tied to the kit's logo.
- No name, no caption. Estimated 16 edits before publish: three Fixed toggles, three member-facing labels, two limits, the CTA's padding and anchor, the headline's box, then name, description, category, tags and caption.

**Auto build with a Figma link**

- It fills labels, Fixed marks, limits, name and caption, but its extraction (`template-autobuild/index.ts:70`) passes the walk through `figmaFieldsToElements` (`extract.ts:1355`) and never runs `landImageAssets`. So:
  - fixed images (the logo, any icon) land with no artwork, while the recompose lifts their nodes off the background;
  - the photo loses its crop, its mask and its sample;
  - the CTA loses its plate, while its container is lifted off the background;
  - `applyAutoBuild` (`TemplateBuilder.tsx:2264`) passes no tree and no canvas effects.
- Fewer edits, but the design comes back broken, and a missing mask can't be restored in the builder.
- The validator caps a proposal at 40 elements (`autobuildValidate.ts:138`).

## Decisions

Each stays open until CJ marks it. Step 1 stops at Gate 1 while any is open.

| #   | Decision | Recommended | Status |
| --- | --- | --- | --- |
| I1  | Where this program lives | `docs/import-intent/`, this file as `PHASE-1.md`, following `docs/brand-system/RULES.md` | Yes (CJ, 2026-11-14) |
| I2  | Every Figma import (template and elements) runs the model pass, and auto build with a Figma link becomes the same pipeline | Yes: one forced tool call per import, and the import still lands when the call fails | Yes (CJ, 2026-11-14) |
| I3  | P15's headline is keyed `lines=3`, but three lines at 88 px don't fit the plate's fixed height (the band is about 207 tall; three lines need about 243). Shrink inside the band, or let the plate grow upward | Shrink inside the band. The plate stays the fixed card the designer drew, and growing it needs a filled container that hugs, which doesn't exist | Yes, shrink (CJ, 2026-11-14) |
| I4  | Where colour roles (`fill=accent`, `text=on-card`) go | Parsed and reported only. Storing them waits for brand-system Phase 6 (colourways) and its D2 | Yes (CJ, 2026-11-14) |
| I5  | A logo keyed `variant=primary · surface=light` swaps to the kit's light primary logo (`BrandKit.primaryLogoLightAssetId`, dark for `surface=dark`) | Yes, with `objectFit: "contain"` so a different aspect never crops it, keeping the Figma render when the kit has none | Yes (CJ, 2026-11-14) |
| I6  | The repo is public and Adler Platt is a client, so its photo, logo and file stay out of it | A neutral P15 fixture (an owned or CC0 stand-in photo, a placeholder logo, a neutral name), or its assets gitignored like `test/fidelity/fonts-private/`. The eval corpus stays local | Yes, a neutral copy of P15 in the GTM Graphics file (CJ, 2026-11-14) |
| I7  | The auto build Figma entry stays in the dialogs until new-brand 6a folds the two entries into one | Yes | Yes (CJ, 2026-11-14) |
| I8  | Newsreader's optical size: the app loads the default cut (16) where Figma draws the display cut (72) at 88 px, about 5.5% wider (`RECON-1.md`) | Request the `opsz` axis for Google families that have one, in its own pull request before Gate 2's baseline | Yes (CJ, 2026-11-14): pull request 184 |
| I9  | With I8 fixed, the fixture's headline still draws 8 to 9 px higher than Figma. The importer grows a cap-trimmed text box back to full lines by assuming the space above the capitals equals the descent, which is wrong for Newsreader | Correct the box from the loaded font's own metrics when the import lands in the browser (Step 5). The server importer and the renderer stay as they are | Yes (CJ, 2026-11-14) |

## What not to touch

- `TemplateSchema`, `TemplateField`, `LayoutGroup`, `BrandKit` and every table column. Nothing here should need them. If something does, propose the exact shape at Gate 1 and wait.
- `SchemaRenderer`, `src/lib/render/layout.ts`, `autoFit.ts`, export and `canvasGesture.ts`.
- Screens and dialog layout, which belong to new-brand 6a and 6b. Only the notice text after an import changes, under the copy rules.
- `decomposeFrame`, `composeFigmaBackground` and the shared predicates (`isRasterLeaf`, `isVectorArtwork`, `shapeContainerFill`, `pillContainer`, `liftDescends`), beyond what the pill padding fix needs. They must keep answering identically, or an element paints twice.
- Stacks from auto layout, space between beyond the two-child case below, filled containers that hug, `lines`, `maxWidth`, photo placement and cut-outs.
- Colourways, Figma variable modes as variations, Brand Studio, starters, `template-generate`, the parked Canva MCP code and Canva's export.
- Deployment. CJ deploys.

## How it works

### 1. Parse the keys

- A pure parser for `role · kind · key=value · ...` in `supabase/functions/_shared/recipe.ts`. If `src` needs it at runtime, mirror it byte-identical (rule 11) and test both copies the way `src/lib/templates/fieldRules.test.ts` does. A name that doesn't parse is an unkeyed layer, not an error. Unknown kinds and keys are kept and listed in a parse report.
- Keys reach the field the walk made from that layer, including fused ones:
  - A mask group's image field takes the keys of its photo child (`photo-fill`).
  - A fused pill takes `fill` and the role from its container, and `edit`, `max`, `text` and `align` from its text child. The text child's `edit` decides whether members fill it in.

### 2. Map the keys onto the faithful import

On `importFrame`'s fields (`_shared/importFrame.ts`), deterministic, before any model call:

| Key | Effect |
| --- | --- |
| `edit=member`, `edit=fixed` | Fixed off or on, through the same rules as `fixedPatch` (`fieldOps.ts:695`): text gets `textSizing: "shrink"`, and an image keeps its artwork as the sample |
| `max` | `maxLength`, unless the measured budget (section 5) is lower |
| `lines` | Read by the measurement and the report, not stored |
| `fill`, `text`, `color` | Reported (I4) |
| `align` on text | Text alignment, except on single-line plated text, where the anchor comes from section 3 |
| `fit` | `objectFit` |
| `variant`, `surface` on a logo | The kit's logo (I5) |
| `shape`, `crop`, `subject`, `points` | Reported. The walk already reads masks and crops from Figma |
| The role | The fallback label ("photo-fill" reads "Photo") and a hint for the model |

### 3. Layout intent with today's properties

The walk reads absolute boxes. Read the auto layout around them too (`layoutMode`, `primaryAxisAlignItems`, the sizing modes, padding, `itemSpacing`, a child's `layoutSizingHorizontal`), with no new types:

- **Growth anchors.** A hug-width plated text field holds the edge its parent holds: the first child of a start or space-between row keeps its left edge, the last child of a space-between or end row its right edge, a centered row its center. P15's CTA lands `align: "left"`.
- **Two-child space-between rows** stay fixed positions with those anchors (the pill holds left, the logo holds right). Never a stack with a fixed gap, which would push the logo out as the pill grows.
- **Pill padding.** `platePaddingY` is the container's height minus the text's grown-back line box, halved (`(76 − 39) / 2` on P15), so the plate draws at its designed height. The same goes for `platePaddingX` when a trimmed box changes the width.
- **Text boxes take their band.** A member text field inside a fixed-size auto layout parent keeps its drawn width and takes the height the layout leaves it (P15's headline: from the plate's top padding down to the CTA row's gap), anchored as drawn, so `shrink` has the room the design gives it.
- **Wrapper groups** like `Group 8` add no field.

### 4. The model pass

- Build it on `template-autobuild`'s prompt, tool and validator. One function owns the call: `template-autobuild` already has the API key and the usage metering.
- **Input:** the render at scale 1, the fields from sections 1 to 3 (not `figmaFieldsToElements`), each with its parsed keys as declared intent, and the kit (type style keys, palette, logos and their surfaces).
- **What it decides:** only what the keys leave open. Label, Fixed on unkeyed layers, text or multiline or select, placeholder, `typeStyleKey`, and the template's name, description, category, tags and caption. It never touches geometry, and it no longer proposes `maxLength` (section 5 measures it).
- **Declared intent wins.** The system prompt already says so. The validator enforces it: a parsed `edit` or `max` beats the model's.
- **Two validator rules that keep the design as drawn:**
  - `typeStyleKey` only when every property the style defines matches the layer within rounding. P15's headline is 88 px, so a heading style at 100 px would restyle it. Otherwise leave it unbound and report it.
  - `colorKey` only on an exact palette match, never "visually close". When the kit sets `allowOffPalette` to false, list the colors that aren't in its palette in the import report (P15's `#F7BFA0` pill, unless the kit has it), since enforcement would paint them as the nearest palette color.
- **Fallback:** if the call fails or times out, the import lands with the parsed keys applied, and one info issue says the form wasn't filled in. A fully keyed frame like P15 gets its fields right with no model call; it still needs one for labels and the caption.
- **Rules 8 and 9:** one forced tool call, validated before use, recorded through `recordModelUsage` (`_shared/usage.ts`). Report calls, tokens and added seconds per import.
- The 40-element cap must never drop a field the walk found on the import route.

### 5. Measured limits

After the import lands, in the browser, each member text field's `maxLength` comes from `characterBudget` (`src/lib/generate/measureProposal.ts:123`), run on a long sample built from its source copy at the field's shrink floor, within `lines` when the layer is keyed.

- A keyed `max` that is lower wins.
- A keyed `max` that can't fit is lowered and reported, for example "max=32 doesn't fit 3 lines here; 27 does".
- This replaces the 0.55-per-character estimate in the auto build prompt (`template-autobuild/prompt.ts:23`) on every route, Canva and image included.

In the same pass (I9), a text field whose layer is cap-trimmed gets its box re-placed from the loaded font's ascent and cap height, so its first line's capitals sit where Figma drew them. The server keeps its estimate for the case where the font can't be measured.

### 6. One pipeline

- `template-autobuild`'s Figma path stops using its own extraction. It runs `importFrame`, the renders and `landImageAssets` the way `figma-import` does (share the code, don't copy it), then the model pass. Import from Figma and auto build with a Figma link return the same result.
- In the builder, `applyImport` and `applyAutoBuild` (`TemplateBuilder.tsx:2239` and `:2264`) land it through `landImport` in one `setDraft`, so an import stays one undo entry, with the tree and the canvas effects passed through, and the name and caption filled without overwriting what the admin wrote (the rule `applyAutoBuild` already has).
- Elements mode (`importElementsAt`, `TemplateBuilder.tsx:1619`) gets labels and member flags the same way, with no template metadata.
- Canva and image imports keep their flat path, since there is no tree, and share the validator and section 5.
- The notice after an import says what members will fill in, in sentence case, with no helper line.

## Steps

This phase runs without plan mode (CJ, 2026-11-14), in place of the plan-mode step in `CLAUDE.md`. Step 1 is the plan: it changes no code and ends at Gate 1, where CJ reviews it.

Commit after each step with `npm run verify` green, and stop at each gate.

1. **Recon.**
   - Replay P15 through both routes offline (`src/app/dev/importReplay.ts`, and the auto build path with a recorded model response). Confirm or correct every point under "What today's importer does with it", with numbers: the field list, labels, Fixed flags, the pill's height and anchor, and what renders.
   - Count the edits each route needs.
   - Parse every frame on the Adler Platt Templates page and attach the report.
   - Check the headline's face. Newsreader has an optical size axis; compare what the app loads at 88 px with Figma's render, since the 32-character budget depends on where lines break.
   - Propose the shared server path, the result shapes (`DesignImportResult` and `AutoBuildResult` aren't frozen), any change to the tool schema, the fixture plan under I6, every new issue and notice string, and P15's expected result written out field by field.
   - **Gate 1.** Stop for CJ and the open decisions.
2. **Parser and key mapping.** Pure, with unit tests built from the Adler Platt layer names (no client assets in the repo).
3. **Layout intent and pill padding**, with the P15 import fixture under I6. Every existing fixture stays unchanged; `feature-highlight-import` and `gtm-composer-import` keep their baselines.
   - **Gate 2.** CJ approves the P15 numbers.
4. **One pipeline and the model pass**, server side, with the validator rules and the fallback.
5. **Landing in the builder.** One `setDraft`, measured limits, the cap-trim correction (I9), elements mode and the notice.
6. **Eval.**
   - A local script runs the whole pipeline on the Adler Platt frames twice: keyed, and with every layer renamed to Figma's defaults, so the model's guesses are scored against answers the keys already give. Add Feature Highlight and the GTM composer with expectations written by hand.
   - Report edits per frame and route, and calls, tokens and seconds per import.
   - **Gate 3.** CJ sets the bar for unkeyed frames.
7. **Close-out.**
   - Docs: `TEMPLATE_SCHEMA.md` (the import), `CEILING.md` ("Since import intent"), brand-system `PLAN.md` (Phase 9's row), and a status line at the top of this prompt.
   - Review: run `phase-reviewer` and `fidelity-checker`.
   - Open the pull request.

## Deploy order

After merge: deploy `figma-import` and `template-autobuild`, then import P15 once on production as a check. No migration unless Gate 1 approves one.

## Done when

- P15 imports through both Figma routes with zero edits before publish:
  - the photo is a member field with its crop and its fade;
  - the plate is fixed;
  - the headline is a member field with its limit and its band;
  - the CTA is a member pill at 76 tall that holds its left edge;
  - the logo is the kit's light primary;
  - the name and caption are filled in.
- Its import fixture scores within its approved baseline on all three engines, and every other fixture is unchanged.
- The keyed Adler Platt frames need no edits beyond labels CJ accepts, and unkeyed frames meet the bar set at Gate 3.
- Calls, tokens and added seconds per import are reported.

## Later phases

- Stacks from auto layout, filled containers that hug their content (a plate that grows with its headline), wrap and max width. These need new properties.
- Colourways from colour roles and from Figma variable modes, with brand-system Phase 6 and its D2.
- Learning from the edits an admin makes after an import (brand-system Phase 16).
