# Import intent, Phase 1: recon (Gate 1)

Written 2026-11-14 against `main` at 690af70, in the worktree `import-intent-phase-1` (branch `import-intent/phase-1`). Step 1 changed no code. CJ approved I1 to I7 as recommended the same day; I8 is open.

How it was measured:

- P15's node tree and the other 27 frames were fetched once from Figma's REST API (`geometry=paths`) and kept outside the repo.
- **Import from Figma** was replayed through the real code: `importFrame`, `landImageAssets`, `decomposeFrame`, `composeFigmaBackground` and the overlay merge, in a local fixture (`test/fidelity/fixtures/local-p15-import`, untracked and excluded) on Chromium.
- **Auto build** was replayed the same way with `figmaFieldsToElements` and `validateProposal`. There is no Anthropic key on this machine, so the model response is a hand-written stand-in, not a recording. A real recording needs the deployed function and belongs to Step 4.

## P15 through Import from Figma today

Five fields, all Fixed, no warnings. Chromium scores 2.81 exact and 5.23 blurred against Figma's render.

| # | Label as landed | Type | Box | Notes |
| --- | --- | --- | --- | --- |
| 1 | `Mask group` | image | 0, 0, 1080 × 1350 | Bare fill, `imageRect` 0, 0.0003, 1, 1.0832, mask from `32:41`. The fade survives |
| 2 | `plate · plate · fill=accent · edit=fixed` | shape rect | 77, 802, 926 × 438 | `#FFE0CF`, radius 40 |
| 3 | `headline · text · edit=member · max=32 · lines=3 · text=on-accent · align=left` | multiline | 133, 855.1, 709 × 184.8 | Newsreader 500 at 88, line height 1.05, tracking −2.2, top aligned, no sizing |
| 4 | `cta · pill · fill=card · edit=fixed` | text, plated | 133, 1119, 359 × 76 | `align: center`, padding 44 / 27, plate `#F7BFA0`, radius 999 |
| 5 | `logo · logo · variant=primary · surface=light · edit=fixed` | image | 707, 1119, 240 × 76 | Figma's node render, `cover` |

Each point in the prompt, confirmed or corrected:

- **Photo: confirmed, with one correction.** The fill's scale mode is STRETCH with a transform, not CROP. `cropRectOf` reads both, so the result is the same.
- **Plate: confirmed.**
- **Headline: confirmed.** 151 tall cap-trimmed, two lines, grown back to 184.8.
- **CTA: confirmed.** The plate paints 39 + 2 × 27 = 93 tall against Figma's 76, centred on the box, so it grows 8.5 above and below. The label is the container's name while the key comes from the text child's name, because the inner walk slugs first.
- **Logo: confirmed.**
- **No name, no caption: confirmed.**
- **Edits: 16, confirmed** by the prompt's definition (three Fixed toggles, three labels, two limits, the CTA's padding and anchor, the headline's box, and five metadata fields). Swapping the logo for the kit's (I5) would make it 18 with its fit.

## P15 through Auto build today

Worse than the prompt says. With the stand-in response (headline, CTA and photo editable, logo Fixed), Chromium scores 74.71 exact.

- **New: the plate covers the headline, the CTA and the logo.** Fields stack in arrival order (`stackImported`). The validator appends every shape after the model's fields (the coverage pass, `autobuildValidate.ts:398`), so a shape always lands on top of everything the model proposed. Nothing restacks them. Any design with a card under its text is affected.
- **Photo: confirmed.** As a member field it has no artwork, no crop and no mask, and its node is lifted off the background, so the frame shows the navy ground and a placeholder.
- **CTA: confirmed.** No plate, with its container lifted off the background.
- **Fixed images: corrected.** `bakeStaticImages` (`template-autobuild/index.ts:486`) does render and host them, so the logo and icons keep their artwork. They only come back empty when that render fails.
- **`verticalAlign` is dropped** (`geometryFrom` doesn't copy it), and every text field, Fixed ones included, gets `textSizing: "shrink"`.
- **The model already reads the raw layer names** as `label`, keys and all. The fused pill shows it the container's `edit=fixed`, not the text's `edit=member`.
- **The 40-element cap bites on this page.** P01 v3 walks to 52 fields and P03 v3 to 50.
- **Outside this phase's list, found on the way:** the retry call validates with `source.kind` where the first call uses `proposalKind`, and drops `platesBehindText` (`index.ts:676`), so a Canva retry is validated on the parked geometry branch.

Edits can't reach the target on this route: a missing mask can't be restored in the builder. Short of that it needs at least 9 (restack the plate, four for the CTA's plate, padding and anchor, the headline's limit and box, the photo's artwork, the logo's fit).

## The headline's face

The app loads Newsreader at its default optical size and Figma draws the display cut.

- The app requests `Newsreader:wght@500` (`fonts.ts`, `googleAxisQuery` names only `ital`, `wdth` and `wght`), so Google serves optical size 16.
- Figma sets the optical size from the font size, which reaches the axis maximum, 72, at 88 px.
- Measured in Chromium at 88 px with −2.2 tracking: "Is it time to drop" is 595 wide at optical size 16 and 630 at 72. Figma's render bounds are 627.5 wide. "the naps?" is 341 against 364.
- So the app's headline is 5.5% narrower than Figma's, and it is most of what the heatmap shows. One 709 px line holds 21 characters of the sample at 16 and 20 at 72.

The measured limit (section 5) is taken with the face the app paints, so limits stay true to what members see either way. The fidelity score and the line breaks against Figma do depend on it. See I8.

## The band and the limit (I3)

- Cap-trimmed, the band runs from the plate's top padding (872) to the CTA row less the gap (1079): 207.
- Grown back to line boxes, the headline's field would be 133, 855.1, 709 × 240.8, top aligned.
- Three lines at 88 are 277.2 of line box, so three lines fit at 0.87 of the size (76.4 px), above the 0.75 floor.
- At 88 px two lines hold about 40 characters, so `max=32` fits without shrinking at all in most copy. The keyed 32 will win over the measured budget. The prompt's "27 does" example doesn't apply to P15. Step 5 confirms it with `characterBudget`.

## Parse report: the Templates page

28 frames, 460 layers below the frame roots.

- **331 layers are keyed (72%), and every one parses.** No unknown kind, no unknown key, no malformed segment.
- **Kinds:** text 113, group 73, shape 31, logo 28, image 24, pill 21, plate 17, rule 14, tile 5, sticker 4, mark 1.
- **Keys:** edit (member 173, fixed 109), align (left 61, center 41), max (20 distinct values, 2 to 140), text (10 roles), fill (5 roles), fit (cover 44), shape (rounded 26, circle 6, arch 4, rect 4), lines (1 to 5), variant (primary 28), surface (light 21, dark 7), subject, crop, points.
- **Values with spaces exist:** `subject=physician headshot`, `subject=family photo`.
- **129 layers are unkeyed:** 90 rectangles (88 of them the pattern tiles in P01 v3 and P03 v3), 12 stars, 14 groups ("Group N", "Mask group"), 5 "Frame N" and 8 text layers.
- **All 127 text layers are cap-height trimmed.**
- **Variables:** only P01 to P04 and their versions carry bound fills and an explicit mode. The variables endpoint needs a scope this token lacks, which doesn't matter here (I4).

What the frames will ask of the pipeline:

- **Roles repeat inside a frame.** P05 has four `item` and four `number`; P16 has two `headline`. Fallback labels need an ordinal ("Item 1"), and the model pass can do better.
- **Unkeyed mask groups** (P15, P16) need the photo child's keys, as section 1 says.
- **Pills with more than one child** (`divider-tag · pill · edit=member` with two texts and a rule, in P05, P16 and others) are not fused pills. They land as a shape plus fields, and their container can't hug. That is the "filled containers that hug" item this phase leaves out, so those frames will keep an edit or a limit.
- **Mixed styling.** 17 headlines across 13 frames carry a styled word that today's import flattens, with a degraded warning. This phase doesn't touch it, and it will count against "no edits beyond labels" at Gate 3.
- **Growth anchors.** Of the 11 single-text pills, 4 are the first child of a space-between row (hold left), 4 are fixed-size number tiles, 2 have no auto layout parent and 1 sits in a vertical stack (hold left).

Per frame (layers, keyed, fields the walk makes today):

| Frame | Layers | Keyed | Fields | Frame | Layers | Keyed | Fields |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P01 | 11 | 9 | 6 | P07 | 15 | 15 | 11 |
| P02 | 12 | 12 | 7 | P08 | 12 | 12 | 9 |
| P03 | 8 | 8 | 5 | P09 | 16 | 16 | 9 |
| P04 | 14 | 14 | 8 | P10 | 13 | 10 | 9 |
| P01 v2 | 14 | 12 | 7 | P11 | 15 | 15 | 9 |
| P02 v2 | 13 | 13 | 8 | P12 | 8 | 8 | 5 |
| P03 v2 | 8 | 8 | 5 | P13 | 15 | 15 | 11 |
| P04 v2 | 14 | 14 | 8 | P13 (second) | 16 | 7 | 12 |
| P01 v3 | 59 | 14 | 52 | P13 (third) | 16 | 7 | 12 |
| P02 v3 | 15 | 12 | 11 | P14 | 9 | 9 | 4 |
| P03 v3 | 53 | 8 | 50 | P15 | 10 | 6 | 5 |
| P04 v3 | 17 | 14 | 12 | P16 | 15 | 11 | 10 |
| P05 | 24 | 24 | 16 | P17 | 19 | 19 | 16 |
| P06 | 12 | 12 | 11 | P18 | 7 | 7 | 5 |

## Proposals

### The shared server path

- **`_shared/recipe.ts`**: the pure parser and parse report (Step 2).
- **`_shared/importFrame.ts`** applies keys and layout intent inside `importFrame`, so the offline replay and both functions get them from one place. The walk reads `layoutMode`, `primaryAxisAlignItems`, `counterAxisAlignItems`, the sizing modes, padding and `itemSpacing` (new optional keys on `FigmaNode`, no frozen type).
- **`_shared/figmaImportRun.ts`**: fetch the tree, `importFrame`, fills, renders, masks, `landImageAssets`, the background render and `pruneTree`. `figma-import` and `template-autobuild` both call it. `extractFigma`, `bakeStaticImages` and the `figmaFieldsToElements` path go.
- **`_shared/importIntent.ts`**: pure. Builds the model's input from the landed fields and their declared intent, and applies a validated answer back onto those fields. Geometry, artwork and paint order never pass through the model, and the form order it returns reorders the array only, which also ends the plate-on-top bug.
- **`template-autobuild`** owns the model call and becomes the Figma entry for the template import, the elements import and auto build. It takes `mode: "template" | "elements"`.
- **`figma-import`** stays deployed on the same shared run without the model pass. The client falls back to it when `template-autobuild` answers 503 (no key), so an import never depends on the model.
- **The cap.** On the Figma route the 40 limit applies to what the model is asked about (text and image fields), never to the fields that land.

### Result shapes

`DesignImportResult` and `ElementImportResult` gain optional keys. Nothing frozen changes and no migration is needed.

```ts
// DesignImportResult (template mode)
template?: { name: string; description: string; category: string; tags: string[]; captionTemplate: string };
rationale?: Array<{ fieldKey: string; why: string }>;
meta?: AutoBuildMeta;
intent?: ImportIntentReport;

// DesignImportResult and ElementImportResult
interface ImportIntentReport {
  /** "model": keys and the model pass. "keys": the call failed or was skipped. */
  filledBy: "model" | "keys";
  layers: number;
  keyed: number;
  unknown: string[];        // kinds and keys kept but not understood
  roles: Array<{ fieldKey: string; fill?: string; text?: string; color?: string }>; // I4
  calls: number;
  inputTokens: number;
  outputTokens: number;
  modelMs: number;
}
```

`AutoBuildResult` stays for Canva and image sources. A Figma auto build returns the `DesignImportResult` above, so `applyAutoBuild` lands it through the same branch as `applyImport`, tree and canvas effects included.

### The tool schema

- `maxLength` leaves the proposal on every route (section 5 measures it), and the 0.55 estimate leaves the prompt.
- Each element sent on the Figma route carries `declared: { role, kind, edit?, max?, lines? }`.
- On the Figma route the model may not change a field's type between text, image, shape and icon. It chooses text, multiline or select for text only.
- `box` and `plateHex` stay for flat sources.

### Strings

Notices:

- `5 elements imported. Members fill in 3: Headline, Call to action and Photo.`
- `5 elements imported, all fixed.` (nothing member-facing)
- `3 elements pasted from Figma. Members fill in 1: Headline.`

Issues, each prefixed with its layer as today:

- info: `the form wasn't filled in, so labels come from the layer names and the caption is empty.`
- info: `max=32 doesn't fit 3 lines here; 27 does.`
- info: `close to the Heading style but not the same, so it isn't bound.`
- info: `swapped for your light primary logo.`
- info: `Brand Studio has no light primary logo, so the Figma artwork stays.`
- info: `key "foo" isn't one this import reads, so it was kept in the report only.`
- degraded, once per import: `these colors aren't in your palette and will show as the nearest one: #F7BFA0.`

Colour roles go in the report only, with no issue per layer: this page alone has 129 of them.

### The fixture (I6)

Recommended: a neutral copy of P15 in the GTM Graphics file, with an owned or CC0 portrait, a placeholder logo and the same layer names, auto layout and type. Its tree, golden and assets can then be committed and CI measures it on all three engines. The gitignored alternative is reported as skipped in CI, so it would prove nothing there. The Adler Platt trees and the eval corpus stay local either way. I can build the neutral frame through the Figma connector if you want it made for you.

### P15's expected result

| Field | Label | Type | Box | What changes from today |
| --- | --- | --- | --- | --- |
| Photo | "Photo" from the role, or the model's | image, member | 0, 0, 1080 × 1350 | Fixed off, keeps its artwork as the sample, its `imageRect` and its mask |
| Plate | "Plate" | shape, fixed | 77, 802, 926 × 438 | Label only |
| Headline | "Headline" | multiline, member | 133, 855.1, 709 × 240.8, top | Band height, `textSizing: "shrink"`, floor 0.75, `maxLength` 32, placeholder from the copy |
| CTA | "Call to action" from the model, "Cta" from the role | text, member, plated | 133, 1119, 359 × 76 | `align: "left"`, `platePaddingY` 18.5, `maxLength` 24, shrink. Paints 76 tall |
| Logo | "Logo" | image, fixed | 707, 1119, 240 × 76 | The kit's light primary, `contain` (I5) |
| Template | | | | Name, description, category, tags and caption from the model. Without it: the name is the frame's ("Doctor topic") and the caption is empty |

Paint order stays the walk's: photo, plate, headline, CTA, logo. Form order: headline, CTA, photo.

## Decisions

I1 to I7 as the prompt lists them. I recommend each as written. Two notes and one new decision:

- **I3.** Shrink inside the band, as recommended. The numbers above show three lines fit at 87% of the size, well inside the floor.
- **I6.** The neutral frame in the GTM file, as above.
- **I8 (new). Newsreader's optical size.** Either request the `opsz` axis for Google families that have one, so the app draws the display cut Figma draws, or accept the difference in P15's baseline. The first changes how every existing template in such a family renders, so it needs its own fixture and belongs in its own pull request, before Gate 2 if you want P15's baseline to be tight. Recommended: its own small pull request first.

## For the gate

- No frozen type or column needs to change, and no migration is needed.
- One thing to check in Step 3: whether the builder keeps a fractional `platePaddingY` (18.5) through a save.
- The auto build numbers above rest on a stand-in response. Step 4 records real ones.
