# Line breaks and size families

You are working in the SocialPaint repo. This prompt builds two improvements CJ picked from a review of FigCraft (`github.com/storytold/figcraft`, an open-source, Figma-style editor). Both are built in SocialPaint's own code. FigCraft is only a reference for how they behave, and nothing from it is installed or copied.

1. **Line breaks** (Phase 1). Member text in a multiline field never ends a paragraph on one stray word. The fit shrinks a little further when that fixes it, and otherwise keeps the last two words together.
2. **Size families** (Phases 2 to 5). The copies that "Create a version for another size" makes stay linked as one template in several sizes. Members switch sizes with their text intact and download every size at once, and bulk fill, the template chat, Generate and public links all work across the family.

Read these in full before planning a phase: `CLAUDE.md`, `docs/brand-system/RULES.md`, `docs/design/new-look/RULES.md`, `docs/ARCHITECTURE.md`, `docs/TEMPLATE_SCHEMA.md`, and this prompt. Each phase is one branch and one pull request. Plan it in plan mode and wait for approval, build it in steps, commit after each step with `npm run verify` green, and stop at every gate named here. If something in this prompt turns out to be impossible or wrong once you are in the code, stop and explain the conflict instead of improvising a different design.

Before Phase 1's first step, save this prompt as `docs/design/line-breaks-and-size-families/PROMPT.md`, so the `phase-reviewer` subagent can be pointed at it.

## Rules

This work follows `CLAUDE.md` and every rule in `docs/brand-system/RULES.md` except rule 18, because the Decisions and Phases tables below stand in for the brand system's plan. The rules it leans on hardest:

- **Frozen types** (rule 2). Phase 2 adds a column and a `TemplateSchema` property, so it stops at its recon gate with the exact shape from D3 and waits for CJ.
- **Absent means today** (rule 3). A template with no family, and any text an admin authored, render exactly as they do now.
- **The fidelity harness is the ruler** (rule 7). Phase 1 changes what paints, so it runs `fidelity-checker`, and no golden or baseline is recorded without CJ's approval.
- **Migrations are additive** (rule 5). The migrations folder is shared with the brand-system program, so Phase 2 reserves its number under "Migration numbers reserved" in `docs/brand-system/PLAN.md` when it starts.
- **Screens** (new-look `RULES.md` §10). Phases 2 to 5 change screens: capture `.shots/before` with `npm run shots` before the first UI change and compare at the gate.

Sequencing: Phase 1 works in `src/lib/render/**` and `SchemaRenderer.tsx`, the same files as brand-system Phase 1, so run it while no brand-system renderer phase is open, or rebase onto that phase before merging. Phase 2 shares no files with Phase 1 and can run beside it in its own worktree.

## Decisions

Each stays open until CJ marks it, here or at a gate. A phase that needs an open decision stops at its recon gate and asks.

| #   | Decision                                                                                                                                                                                                                   | Recommended           | Status |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ------ |
| D1  | The line-break rule applies to text a member, the model, a bulk row or a public visitor supplied, in multiline fields only. Text an admin authored renders exactly as authored. It is on for every workspace, with no setting | Yes                   | Approved 2026-10-25 |
| D2  | Before keeping two words together, the fit may shrink at most 8% below the size it chose, and never below the field's floor. Text whose last two lines each hold one word reads as a stack and is left alone              | Yes                   | Approved 2026-10-25 |
| D3  | `templates.family_id uuid` (nullable), an index on `(company_id, family_id)`, a unique index on `(family_id, canvas_width, canvas_height)` where `family_id is not null`, and `TemplateSchema.familyId?: string`              | Yes                   | Approved 2026-10-26   |
| D4  | A family forms when "Create a version" saves its copy at a new size, or when an admin links an existing template of another size. Removing a size unlinks it and never deletes it                                          | Yes                   | Approved 2026-10-26   |
| D5  | Generate sends the model one candidate per family: the member that matches the platform hint, else the oldest member                                                                                                       | Yes                   | Open   |
| D6  | A public link offers the published sizes of its template's family                                                                                                                                                          | Yes, in its own phase | Open   |

Recorded at Phase 1 recon (CJ, 2026-10-25):

- The builder's worst-case preview (`worstCaseText` in `TemplateBuilder.tsx`) passes a sample value through `computeLayout`, so it gets the rule like any member value and shows the admin what a member would see. No builder file changes. Authored text, placeholders and Fixed text in the builder paint exactly as today.
- Phase 1 branches from `brand-system/phase-1` (unmerged, same render files) and rebases onto `main` once that phase merges, before its own pull request merges.
- Phase 2's migration: 0046 and 0047 are promised to new-look Phase 9 and 0048 to brand-system Phase 1, so Phase 2 reserves the next free number when it starts (0049 as of this date).

Recorded at Phase 2 recon (CJ, 2026-10-26):

- D3's unique index leads with `company_id`: `(company_id, family_id, canvas_width, canvas_height)`, so another workspace can never claim a family's size. The migration is 0049.
- `familyId` is written only through `TemplateStore.setFamily`. `create`, `update` and `duplicate` never write it, so a builder save (autosave included) can never undo a change made in the Sizes dialog.

## Phases

| Phase | Builds                                             | Needs        | Done when                                                                                                                                                 |
| ----- | -------------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Line breaks                                        | D1, D2       | Orphaned member text breaks cleanly on every surface, every existing fidelity fixture holds its baseline on all three engines, and CJ approved the new fixtures |
| 2     | Size families: the model and the admin side        | D3, D4       | Versions join their family, admins see and manage a family's sizes, and a template with no family behaves exactly as today                               |
| 3     | Size families on the fill page and in bulk fill    | Phase 2      | A member switches sizes without retyping and downloads every size at once, and a bulk run covers the sizes the admin picks                               |
| 4     | Size families in the template chat and Generate    | Phase 3, D5  | Edit details switches sizes for a one-draft turn, and Generate never offers the model two sizes of one design                                            |
| 5     | Size families on public links                      | Phase 3, D6  | A public visitor switches sizes and downloads every size, and the payload and events stay inside the link's family                                       |

---

## Phase 1: Line breaks

### Why this phase exists

FigCraft's text fitting (`text.fit`, in `crates/engine/src/textfit.rs` and the "Filling copies with data" section of `docs/mcp.md`) never leaves a one-word last line. It shrinks up to about 8% more, and when that isn't enough it keeps the last two words together with a no-break space. SocialPaint's fit in `src/lib/render/autoFit.ts` has no such rule, so a member's headline can end on a stray word, which reads as unfinished and is the first thing a designer would fix. Build the behavior from this spec in SocialPaint's own code.

### Read before writing

| File                                                                                                                                             | Why                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/render/autoFit.ts`                                                                                                                      | `wrapLines` (greedy: paragraphs split on `\n`, words on spaces, mirroring `white-space: pre-wrap`), `fitTextWith`, `fitsAtSize`, `largestFittingSize`, `minFontSizeFor`, `fitText` |
| `src/lib/render/layout.ts`                                                                                                                       | `renderedText`, `fitFieldText`, `resolvedFontSize`, `freeTextRect`, `platedRect`, `sizedChildren`, `applyShrink`, `computeLayout`, `LayoutResult`                   |
| `src/app/components/SchemaRenderer.tsx`                                                                                                          | `FieldBox` and `TextFieldBox`, which paint `renderedText` at the layout's `fontSize` with `white-space: pre-wrap` for multiline, and the inline `fitText` fallback   |
| `src/lib/generate/measureProposal.ts`                                                                                                            | `overflowsAlone`, the `shrinks` classification, `characterBudget`                                                                                                    |
| `src/lib/render/textSizing.test.ts`, `src/lib/render/layout.test.ts`, `src/lib/generate/measureProposal.test.ts`                                 | The fake measurer and the test style to follow                                                                                                                       |
| `src/app/dev/fidelity.ts`, `src/app/dev/DevRenderPage.tsx`, `test/fidelity/README.md`, `.claude/skills/fidelity/SKILL.md`                        | The fixture format, and how a starter fixture is materialized (`resolveStarterFixture` ignores `values` today and takes the blueprint from the fixture's name)       |
| `src/lib/templates/starters/blueprints.ts`                                                                                                       | `launch-01`, whose `headline` is multiline Shrink and whose `subhead` is multiline Free                                                                              |
| `src/lib/caption.ts`                                                                                                                             | `mergeCaption`, which must keep the member's text exactly                                                                                                            |

### Scope

In: the rule, its wiring through layout, painting and measurement, its tests, a starter-fixture extension for member values, and two new fixtures.

Out: single-line fields, the builder, Fixed text, placeholders, every schema and column, Generate's server side, and every other render property.

### What not to touch

- `src/lib/types.ts`, `src/lib/stores/**`, `supabase/**` and the migrations.
- `src/lib/render/exportPng.ts` and the export path. html-to-image already paints whatever string the layout hands the renderer.
- `src/app/components/builder/**`, including `FieldOverlayEditor.tsx` and `groupOps.ts`, which measure authored text.
- Existing fixtures, goldens and baselines. A hook blocks goldens, and baselines change only with CJ's approval.

### The rule

- **Where it applies.** A `multiline` field that isn't Fixed, when its value is non-empty and differs from the field's placeholder after trimming. That covers what members type, what the model writes, bulk rows and public visitors. Everything an admin authored paints exactly as today: a Fixed element's `staticValue`, a placeholder painted in an empty field, and the builder's canvas. Single-line `text` and `select` fields never wrap, so the rule has nothing to do there.
- **What counts as an orphan.** A paragraph (the text between hard line breaks) that wraps to two or more lines and whose last line holds exactly one word while the line above it holds two or more. A one-word paragraph is never an orphan, and neither is a stack, where the line above the last also holds a single word (D2).
- **Shrink and Fill.** After `largestFittingSize` picks a size S, if any paragraph ends on an orphan at S, try each whole-pixel size from S − 1 down to the larger of the floor (`minFontSizeFor`) and `ceil(S × 0.92)`, and take the largest that fits (`fitsAtSize`) with no orphan left.
- **Keeping two words together.** When no size in that range clears every orphan, and always for Free fields (whose size is fixed), replace the last space in each orphaned paragraph with a no-break space (U+00A0), provided the two words it joins fit the wrap width at the final size. The wrap width is `field.width`, less the plate's horizontal padding on a plated field (the width `platedRect` wraps at). A paragraph whose last two words are wider than that keeps its orphan.
- **Never worse.** The rule only picks sizes that fit and joins that keep the line count, so it can't turn a fitting value into an overflow. `measureProposal` may now report `shrinks` for a value it used to report as `fits`, and `shrinks` already means there is nothing to repair.
- **Groups.** When `applyShrink` changes a field's size for a group's shrinkToFit, run the joining step again at the new size. The extra shrink belongs to Shrink and Fill fields only.
- **The member's text stays theirs.** The no-break space exists only in the string that is measured and painted. Stored values, `mergeCaption`, bulk CSV output, saved chats and everything sent to the model keep exactly what was typed.

### Where it lives

- `src/lib/render/autoFit.ts`: two pure helpers built on `wrapLines`. One reports which paragraphs end on an orphan at a given size and width; the other joins the last two words of the paragraphs it is given. Change the word split in `fitsAtSize` from `/[\s\n]+/` to spaces and newlines only, because `\s` matches U+00A0 and would measure a joined pair as two words while the browser keeps them on one line.
- `src/lib/render/layout.ts`: `typesetFieldText(field, style, value, measure)`, returning `{ text, fontSizePx, overflows }` and built on `renderedText`, `fitFieldText` and the helpers. `LayoutResult` gains `texts: Map<string, string>` (field id to the string that paints). `computeLayout` uses `typesetFieldText` for its baseline, and every place in `layout.ts` that measures a laid-out field's text reads `result.texts`, so measurement and painting share one string.
- `src/app/components/SchemaRenderer.tsx`: `FieldBox` and `TextFieldBox` take the layout's text the way they already take `fontSize`, and paint it in place of `renderedText(field, value)` when it is there. The inline `fitText` fallback stays as it is, since it serves hosts without a layout pass (the builder), which paint authored text.
- `src/lib/generate/measureProposal.ts`: `overflowsAlone` and the `shrinks` check go through `typesetFieldText` with the member's value.

### Steps

#### Step 1: Recon

- If D1 or D2 is still open, ask CJ before going further.
- Confirm from the code that nothing outside `layout.ts`, `SchemaRenderer.tsx` and `measureProposal.ts` decides what a multiline member field paints or how it measures. Anything that does goes in the gate report, and if it changes this plan, stop and say so.

#### Step 2: Fixtures first

- In `src/app/dev/fidelity.ts`, let a starter fixture name its blueprint with an optional `starter` key and carry `values`. A fixture without the key resolves exactly as today.
- Add `line-breaks-launch` and `line-breaks-launch-dark` on blueprint `launch-01`, with a headline and a subhead that each end on one word at their set sizes. Render both on Chromium before any rule exists and keep those PNGs (in the gitignored `test/fidelity/out/`) for the gate.

#### Step 3: The rule

The helpers and `typesetFieldText`, with tests in `textSizing.test.ts` and `layout.test.ts` on the fake measurer covering:

- an orphan cleared by the extra shrink, and one the 8% cap can't clear that gets joined instead;
- a Free field joined at its fixed size;
- a stack left alone, a one-word paragraph left alone, and a hard line break starting a new paragraph;
- a last pair too wide for the box, left as an orphan;
- a plated multiline field joined at its narrower wrap width;
- Fixed text, a placeholder, and a value equal to the placeholder, all untouched;
- single-line fields untouched;
- a group's shrinkToFit followed by a fresh join;
- the floor never crossed.

#### Step 4: Wiring

- `LayoutResult.texts`, the renderer and `measureProposal`, as in "Where it lives".
- A `measureProposal.test.ts` case where the rule turns `fits` into `shrinks` and never into `overflows`, and a case proving the stored value and `mergeCaption` carry no U+00A0.

#### Step 5: Fidelity

- Run `fidelity-checker`. Every existing fixture paints only authored text, so each must hold its baseline on Chromium, Firefox and WebKit.
- Render the two new fixtures on all three engines.
- **Gate 2:** show CJ the new fixtures before and after, side by side for each engine, with the table for the existing fixtures. Bless the new fixtures and record their baselines only once he approves.

---

## Size families: the model (Phases 2 to 5)

- A family is a set of templates in one workspace, each at a different canvas size, sharing one `familyId`. Every member stays an ordinary template with its own fields, geometry, looks, status, links and usage. Nothing is shared at render time, and `SchemaRenderer` paints a member exactly as it paints any template.
- Values carry between members by `fieldKey`. Versions keep every key, because `duplicate` copies fields verbatim. A value for a field the next size doesn't have is kept and comes back when the member switches back, and a field only the next size has starts empty.
- The look carries by variant id (versions keep the ids), then by name, else the next size's default look.
- Members see only a family's published members. A family with one published member shows no switch anywhere.
- Pure helpers in `src/lib/templates/families.ts`, with tests:
  - `familySizeLabels(templates)`: "Instagram · 4:5", from `platformLabelFor` (`src/lib/generate/draftView.ts`) and `aspectRatioOf` (`src/lib/templates/platforms.ts`), with ties renamed the way `sizeNames` in `src/lib/generate/linkedFields.ts` renames them, and `width × height` for a size no platform claims.
  - `carryValues(values, from, to)` and `carryLook(variantId, from, to)`.
  - `memberFieldDiff(a, b)`: member fields one size has and the other lacks, and fields whose type or options differ.
- Store additions on `TemplateStore`, in both backends: `listFamily(companyId, familyId)` (every status, oldest first) and `setFamily(templateIds, familyId | null)`. `duplicate` clears `familyId` on the copy, so a plain duplicate never joins a family.

## Phase 2: Size families, the model and the admin side

### Read before writing

| File                                                                                                                                                                                                                                    | Why                                                                                                      |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `src/lib/types.ts`                                                                                                                                                                                                                      | `TemplateSchema` and `NewTemplateInput`                                                                  |
| `src/lib/stores/interfaces.ts`, `src/lib/stores/supabase/templateStore.ts` (`create`, `update`, `duplicate`, `delete`), `src/lib/stores/supabase/rows.ts` (`TemplateRow`, `toTemplate`), `src/lib/stores/local/localStores.ts`, `src/lib/stores/local/db.ts` | Where the column and the store methods land                                                              |
| `src/app/components/admin/AdminTemplates.tsx`                                                                                                                                                                                           | `createVersion`, the "Create a version for…" dialog, the card's meta line and its actions                |
| `src/app/components/builder/TemplateBuilder.tsx`                                                                                                                                                                                        | `requestVersion`, the `reflowParam` handoff captured once at mount, `doSave`, `saveErrorMessage`         |
| `src/app/components/builder/CanvasSizePicker.tsx`                                                                                                                                                                                       | `sizes`, `value`, `onPick`, `onPickVersion`                                                              |
| `src/app/router.tsx`                                                                                                                                                                                                                    | The `builder` route, and how `reflow` is parsed and stripped                                             |
| `src/lib/templates/reflow.ts`                                                                                                                                                                                                           | `versionName` and `reflowTemplate`                                                                       |
| `supabase/migrations/0045_onboarding_answers.sql`                                                                                                                                                                                       | The header comment style                                                                                 |
| `docs/brand-system/PLAN.md`                                                                                                                                                                                                             | "Migration numbers reserved"                                                                             |

### Scope

In: D3's column and type, the store methods, versions joining their family, the Sizes dialog, the card's size count, and dissolving a family of one.

Out: everything members see (Phases 3 to 5), `SchemaRenderer`, Generate, bulk fill and public links.

### What not to touch

- `TemplateField`, `LayoutGroup`, `TemplateVariant` and `BrandKit`.
- `src/lib/render/**` and `SchemaRenderer.tsx`.
- The reflow itself (`reflowTemplate`, `rescaleTemplate`). A version still lands as a reflowed draft the admin reviews.
- `supabase/functions/**`. Public payloads leave `family_id` out until Phase 5.

### Steps

#### Step 1: Recon gate

- Propose D3's exact shape (the migration SQL, the `TemplateSchema` property with its doc comment, and the two store methods) and D4's flows. **Gate 1:** stop and wait for CJ.

#### Step 2: The model

- Reserve the next migration number in `docs/brand-system/PLAN.md` (0046 unless another phase has taken it), and write the migration with a header comment in the style of 0045.
- Wire `familyId` through `types.ts`, `rows.ts`, both stores and `docs/TEMPLATE_SCHEMA.md`, with `rows.test.ts` cases and the `families.ts` tests.
- A save that puts two members of one family at the same size fails the unique index. Map that failure in `saveErrorMessage` to one plain line (proposed copy).

#### Step 3: Versions join their family

- Both paths that create a version, `createVersion` in `AdminTemplates.tsx` and `requestVersion` in `TemplateBuilder.tsx`, add the source's id to the builder route as `family`, captured once at mount and stripped from the address the way `reflow` is.
- The copy joins the source's family on its first save at a size the family doesn't have yet, and the source gets a new family id (`crypto.randomUUID()`) when it had none. Joining at save time is what keeps the unique index valid: the copy starts at the source's size and only takes the target size when the reflow lands.

#### Step 4: The Sizes dialog

The card's existing Proportions action opens one dialog for the template's family, built from the current dialog's parts and new-look primitives, with no new visual patterns:

- the family's sizes, each with its label, its status (`Status`), Open (to the builder) and Remove;
- `CanvasSizePicker` to add a size, listing only the sizes the family doesn't have, which runs today's version flow;
- Link a template: templates of a size the family lacks that belong to no other family, joined through `setFamily`;
- under each size, what `memberFieldDiff` finds against the template the dialog opened from.

Remove unlinks and never deletes, and a family left with one member dissolves (its last member's `familyId` is cleared). Drop the dialog's current subline, which explains the UI (new-look `RULES.md` §9). Every new string is proposed copy.

#### Step 5: The card and delete

- A family member's card shows its family's size count on the meta line ("3 sizes", proposed copy).
- Deleting a template, in both stores, dissolves a family it leaves with one member.
- **Gate 2:** screenshots of the dialog and the cards in Light and Dark, the screenshot comparison, a walkthrough of creating a version, linking, removing and deleting, and the tails of `npm run verify` and `npm run build`.

## Phase 3: Size families on the fill page and in bulk fill

### Read before writing

| File                                                                                                                                                                         | Why                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `src/app/components/TemplateUsePage.tsx`                                                                                                                                     | It loads the template and owns `values`                                                              |
| `src/app/components/TemplateFill.tsx`                                                                                                                                        | The steps, the Finish step's Look `SegmentedControl`, `handleDownload`, the Toast                    |
| `src/lib/render/exportPng.ts`                                                                                                                                                | `renderSchemaBlob`, and the share-sheet delivery in `exportSchemaPng`                                |
| `src/app/components/bulk/BulkFillPage.tsx`, `src/app/components/bulk/BulkExportStage.tsx`, `src/lib/bulk/run.ts` (`MAX_BULK_ROWS`, `rowFileName`), `src/lib/bulk/validate.ts` (`checkRows`) | The bulk run end to end                                                                              |
| `src/lib/stores/interfaces.ts`                                                                                                                                               | `UsageStore.record` and `recordBulk`                                                                 |

### Scope

In: the size switch and Download all sizes on the fill page, and sizes in bulk fill.

Out: the template chat, Generate, public links, and the member library, where each size keeps its own card on its platform's shelf.

### Steps

#### Step 1: The switch

- `TemplateUsePage` loads the family's published members with `listFamily`. With two or more, the Finish step shows a Size field beside Look: a `SegmentedControl` labelled by `familySizeLabels`.
- Picking a size opens that member's fill page with the values (`carryValues`) and the look (`carryLook`) carried over, and it opens on Finish. Keep the carried values in a small in-memory store keyed by family id (`src/lib/templates/familyDraft.ts`), so the route change can't drop them. Photos stay in memory and never touch storage.

#### Step 2: Download all sizes

- With two or more published members, Finish gets a Download all sizes button beside the downloads (neutral).
- Each size renders off-screen the way `BulkExportStage` does (`instrument={false}`), with the carried values and look, through `renderSchemaBlob`. A size with an empty required field, or with text too long at its floor (`measureProposal`), is skipped, and the Toast names it.
- Desktop downloads a ZIP of `<template-slug>-<width>x<height>.png` files (`jszip`, loaded on demand, `STORE`). On mobile, every file goes to the share sheet when `navigator.canShare({ files })` allows it, with the ZIP as the fallback.
- Record one `download` per exported size, with its look, through `stores.usage.record`.

#### Step 3: Bulk fill

- `BulkFillPage` adds a Sizes choice (`ChoiceChip`) over the family's published members, defaulting to the page's own template.
- Columns map once, over the union of the chosen sizes' member fields. Every row is checked against every chosen size with `checkRows`, and the review table shows each problem with its size.
- Mount one `BulkExportStage` per chosen size, and cap rows times sizes at `MAX_BULK_ROWS`. With one size the file names stay as they are today; with more they become `NNN-slug-<width>x<height>.png`. Call `recordBulk` once per size and look.
- **Gate:** screenshots in Light and Dark, the screenshot comparison, a fill-page walkthrough (switching sizes with values and look kept, and Download all sizes with one size skipped), a bulk run across three sizes, and the tails of `npm run verify` and `npm run build`.

## Phase 4: Size families in the template chat and Generate

### Read before writing

| File                                                                                                                                                        | Why                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `src/app/components/generate/EditorPanel.tsx`, `src/app/components/details/DetailsPanel.tsx` (`sizeSwitch`)                                                 | Edit details, and the size switch multi-draft turns already use              |
| `src/lib/generate/chat.ts` (`ChatDraft`), `src/lib/generate/draftView.ts`, `src/lib/generate/linkedFields.ts` (`sizeNames`, `sizeTitle`)                    | Drafts and how sizes are named                                               |
| `src/app/components/generate/TemplateChatPage.tsx`, `src/app/components/generate/useDraftDownload.tsx`                                                      | The template chat and card downloads                                         |
| `supabase/functions/template-generate/index.ts` (the candidate list and how hints narrow it), `supabase/functions/_shared/generateValidate.ts` (`classifyPlatforms`) | Where D5 lands                                                               |

### Steps

#### Step 1: Recon

- If D5 is still open, ask CJ.

#### Step 2: Edit details

- For a turn with exactly one draft (every template chat, and a one-draft Generate turn), Edit details fills `sizeSwitch` with the draft's template and its published family members.
- A picked size shows the draft's values in that size (`carryValues`, `carryLook`) and measures them there, so Missing and Too long belong to that size, and Download PNG exports it.
- The picked size is view state. Drafts, saved chats and the thread's cards keep the size the model chose, and edits keep landing on the draft. Turns with several drafts keep today's switch.

#### Step 3: One candidate per family

- `template-generate` selects `family_id` and `created_at` with its templates and, right after the hints narrow the list, keeps one member per family: the one whose platforms include `platformHint`, else the oldest.
- Put the rule in `supabase/functions/_shared/generateValidate.ts` as a pure function with `_shared` tests. A `templateIdHint` still pins exactly that template.
- **Gate:** a template chat walkthrough across three sizes, a Generate run on a library with a family showing one candidate per family in the request, and the tails of `npm run verify` and `npm run build`.

## Phase 5: Size families on public links

### Read before writing

| File                                                                                                                                                                                  | Why                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `supabase/functions/_shared/publicTemplate.ts`                                                                                                                                        | The allowlist, and why there is one                       |
| `supabase/functions/public-template/index.ts` (`signRefs`, `findUnsignedRefs`), `supabase/functions/_shared/publicLink.ts` (`refInCompany`)                                            | Signing and the company check                             |
| `supabase/functions/public-link-event/index.ts`                                                                                                                                       | What a public event records                               |
| `src/app/public/PublicFillPage.tsx`, `src/lib/publicLink/draft.ts`                                                                                                                    | The public fill page and its local draft                  |
| `docs/public-links-privacy.md`, `supabase/verify/run.sh`                                                                                                                              | What a link may reveal and record, and the checks         |

### Steps

#### Step 1: Recon gate

- If D6 is still open, ask CJ. Then propose the payload change and the event rule, and **stop for CJ**, because both widen what a link exposes.

#### Step 2: The payload

- `public-template` returns the link template's published family members from the same company, each through the same allowlist and signing, with `family_id` added to the allowlist. A member that fails any check is left out.

#### Step 3: The page

- `PublicFillPage` shows the size switch and Download all sizes the way the fill page does, and the local draft (keyed by the link) carries text across sizes.

#### Step 4: Events

- `public-link-event` accepts a member's template id only when it is a published member of the link template's family, and records the event against that member.

#### Step 5: Checks and docs

- Verify cases for a member from another company, an unpublished member and a revoked link, and `docs/public-links-privacy.md` brought up to date.
- **Gate:** the verify run, a public walkthrough, and the tails of `npm run verify` and `npm run build`.

---

## Not in this work

- Editing one size and having the others follow. Sizes stay separate templates.
- One card per family in the member library. Each size keeps its card on its platform's shelf.
- Insights grouped by family.
- A size step before the fields.
- Brand-system Phase 14's re-flow across sizes, which can create family members once it lands.

## Gate report (every phase)

End each phase with this report. Then run `phase-reviewer`, naming this prompt, the phase, and `docs/brand-system/RULES.md` as the rules it follows, plus `fidelity-checker` for Phase 1 and for any phase that touched rendering. Fix every must-fix finding and open the pull request into `main`.

1. Commits, one line each.
2. The decisions the phase used, and their status.
3. Tests added, by file.
4. Phase 1 only: the fidelity table (fixture, engine, changed %, baseline) and the new fixtures before and after.
5. Screenshots of every changed screen in Light and Dark, with the screenshot comparison.
6. Proposed copy: every string the phase added or changed.
7. Anything outside the scope you noticed and left alone, and anything you were unsure of.
8. The tails of `npm run verify` and `npm run build`.
