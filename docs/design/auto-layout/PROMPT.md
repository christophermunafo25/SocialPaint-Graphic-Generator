# Auto layout: elements that move together

You are working in the SocialPaint repo. CJ needs grouped elements to move with each other when their content grows. His example is a row of two pills in Figma file `XacDaJAXtWMd15TbAKPpSw`, node `46:789`: the template as designed at `46:768` ("Full Time" and "Chicago/Remote", 12px apart), what happens today at `46:775` (a longer first pill runs under the second), and what has to happen at `46:782` (the first pill grows to "Part time contractor" and pushes the second along, with the 12px gap held). Read those nodes with the Figma MCP server before planning.

The engine for this already exists. `computeLayout` in `src/lib/render/layout.ts` places the children of a stack (a `LayoutGroup` in mode `"stack"`) along one axis with a fixed gap, a plated text field (a pill) hugs its text, and every surface paints through that one pass. What fails is the way into a stack and the measurement around it:

1. **Making a stack moves things.** `memberExtents` (`src/app/components/builder/groupOps.ts:47`) decides where each element sits before it joins a stack, and it has drifted from the layout pass. For a pill it measures the bare text run instead of the plate, so turning on auto layout for CJ's two pills derives a 76px gap instead of 12, puts the row 32px right and 16px lower, raises the "aren't arranged as a stack yet" confirm, and moves both pills once it's accepted. For a horizontal row of multiline text it compares the authored box instead of the text block, so the row jumps 30px in a test while `conversionShift` reports no movement and the confirm never shows. It also treats a multiline Fill field as hugging its text, while the layout pass treats it as a fixed box.
2. **There is no one-step way to a stack.** ⌘G makes a plain group, which never reflows, and auto layout is a switch inside the group inspector. `deriveGroup` (`groupOps.ts:223`), which builds a stack straight from a selection, has no caller outside its tests.
3. **Measurement ignores plates and stacks.** `overflowsAlone` (`src/lib/generate/measureProposal.ts:65`) measures a pill against its authored box with a text sizing mode the renderer ignores for plates, and judges a stack child against its own box even along the stack's direction. With CJ's row correctly stacked, "Part time contractor" still measures as overflowing with a budget of 13 to 15 characters, so the template chat would shorten it, Edit details would flag it as too long, and bulk fill would refuse the row.
4. **Figma auto layout arrives as loose fields.** The importer (`supabase/functions/_shared/extract.ts`) reads no auto layout property, so a row built with auto layout in Figma lands with fixed positions.

Read these in full before planning a phase: `CLAUDE.md`, `docs/brand-system/RULES.md`, `docs/design/new-look/RULES.md`, `docs/ARCHITECTURE.md`, `docs/TEMPLATE_SCHEMA.md`, and this prompt. Each phase is one branch (`auto-layout/phase-1`, `auto-layout/phase-2`) and one pull request. Plan it in plan mode and wait for approval, build it in steps, commit after each step with `npm run verify` green, and stop at every gate named here. If something in this prompt turns out to be wrong once you are in the code, stop and explain the conflict instead of improvising a different design.

Before Phase 1's first step, save this prompt as `docs/design/auto-layout/PROMPT.md`, so the `phase-reviewer` subagent can be pointed at it.

## Rules

This work follows `CLAUDE.md` and every rule in `docs/brand-system/RULES.md` except rule 18, because the Decisions and Phases tables below stand in for the brand system's plan. The rules it leans on hardest:

- **Frozen types** (rule 2). Neither phase changes `TemplateSchema`, `TemplateField`, `LayoutGroup`, `BrandKit` or any table column. Stacks already persist in `templates.layout_groups` (migration 0020) and travel through both stores and the public payload. Phase 2 adds optional properties to the import result types, which are not frozen, and still proposes their exact shape at its recon gate.
- **Absent means today** (rule 3). A template with no groups paints exactly as it does now, and so does every existing group. Phase 1 changes how stacks get made and measured, never how they place their children.
- **The fidelity harness is the ruler** (rule 7). Phase 1 adds fixtures and Phase 2 touches the importer, so both run `fidelity-checker`, and no golden or baseline is recorded without CJ's approval.
- **Copy** (rule 13). Every string a phase adds or changes is proposed copy in its gate report.

Sequencing: Phase 1 edits `src/lib/render/layout.ts` and `overflowsAlone` in `measureProposal.ts`, which Phase 1 of the line breaks program also edits. Whichever lands second rebases, and the plate and stack rules in `overflowsAlone` must survive the rebase. Phase 2 edits `extract.ts` and `figma-import`, which brand-system Phase 4 (import fidelity) will edit too, so land Phase 2 first or rebase Phase 4 onto it.

## Decisions

Each stays open until CJ marks it, here or at a gate. A phase that needs an open decision stops at its recon gate and asks.

| #   | Decision | Recommended | Status |
| --- | -------- | ----------- | ------ |
| D1  | ⇧A adds auto layout in one step, as in Figma. With two or more elements selected it makes a stack that moves nothing; with one plain group selected it turns that group's auto layout on. It also appears in the right-click menus and the shortcuts list. ⌘G keeps making a plain group | Yes | Approved by CJ, 2026-10-26 |
| D2  | Inside a stack, growth along the stack's direction belongs to the stack. Measurement stops calling a value too long because it outgrows its own box along that axis, and calls it too long only when the stack leaves the canvas. Growth across the stack, and anything outside a stack, still has to fit its own box. A plate is measured the way it paints, at its set size, and never reports "shrinks" | Yes | Approved by CJ, 2026-10-26 |
| D3  | Text inside an imported stack follows its Figma resize setting: auto width and auto height text imports as Free, so it hugs and pushes, and fixed size text keeps Shrink. Text outside a stack imports exactly as today | Yes | Open |
| D4  | What imports as a stack: an auto layout frame that paints nothing itself, doesn't wrap, has no child that fills the main axis, and whose every in-flow child imported as exactly one element of its own or is a nested stack with no padding. Space between imports as a fixed gap equal to today's spacing. Anything else imports exactly as today, with an info line naming the layer and the reason | Yes | Open |

## Phases

| Phase | Builds | Needs | Done when |
| ----- | ------ | ----- | --------- |
| 1 | Auto layout that works | D1, D2 | CJ's two pills grouped with ⇧A paint exactly where they did, a longer first value pushes the second with the 12px gap held on every surface, the template chat, Edit details and bulk fill accept it, and CJ approved both new fixtures |
| 2 | Figma auto layout imports as stacks | Phase 1, D3, D4 | An auto layout row imported from Figma lands as a stack that paints where Figma put it and reflows on longer copy, and every frame D4 leaves out imports exactly as today with its reason |

---

## Phase 1: Auto layout that works

### Why this phase exists

Problems 1 to 3 above are what stand between CJ and his row today. Fixing them makes the existing engine reachable in one keystroke, lossless for every field kind, and trusted by every surface that measures member text.

### Read before writing

| File | Why |
| ---- | --- |
| `src/lib/render/layout.ts` | `platePad` (144) and `platedRect` (160, not exported), `groupOfField` (217), `sizedChildren` (313) and its fixed-box test (395 to 398), `applyShrink` (603) and its own copy of that test (615 to 621), the plated baseline in `computeLayout` (711 to 716) |
| `src/app/components/builder/groupOps.ts` | `memberExtents` (47), `deriveStackProps` (118), `selectionMembers` (170), `deriveFreeGroup` (195), `deriveGroup` (223), `toStackGroup` (323), `conversionShift` (364) |
| `src/app/components/builder/TemplateBuilder.tsx` | `groupSelection` (897), `setGroupMode` (1222) and its confirm (2890), the keyboard handler (⌘G at 1838, the tool keys at 1865), the group frame menu (2368), `groupable` and "Group selection" in the element menu (2465 to 2496), the `GroupInspector` mount (3740) |
| `src/app/components/builder/GroupInspector.tsx`, `src/app/components/builder/ShortcutsPanel.tsx` (81 to 82), `src/app/components/builder/FieldContextMenu.tsx`, `src/app/components/builder/fieldOps.ts` (`TOOL_KEYS`) | The inspector, the shortcuts list, the menu item shape, and the keys tools already own |
| `src/lib/generate/measureProposal.ts` | `overflowsAlone` (65), `fitsInContext` (97), the shrinks classification (180 to 186) |
| `src/lib/bulk/validate.ts`, `src/lib/generate/repairProposal.ts`, `src/lib/generate/chatRun.ts`, `src/lib/generate/draftView.ts` | Every caller of `measureProposal` |
| `supabase/functions/_shared/extract.ts` (786 to 831) | How an imported pill lands: the container's box, `align: "center"`, the plate color, and paddings from the insets. Test fixtures build pills the same way |
| `src/app/components/builder/groupOps.test.ts`, `src/lib/render/layout.test.ts` (plates at 494), `src/lib/generate/measureProposal.test.ts` (groups at 160) | The fake measurer and the test style to follow |
| `test/fidelity/README.md`, `.claude/skills/fidelity/SKILL.md`, `src/app/dev/fidelity.ts` | The fixture format |
| `docs/ARCHITECTURE.md` ("Measure and repair in the browser", around line 515) | The paragraph D2 updates |

### Scope

In: one shared answer for what a stack child occupies, a `memberExtents` that matches it, ⇧A and its menu entries, plate and stack aware measurement (D2), the group inspector's helper lines, tests, and two fidelity fixtures.

Out: the importer (Phase 2), how stacks place their children, and new stack abilities such as padding, wrap, fill, or a background that grows with the stack.

### What not to touch

- `src/lib/types.ts`, every table column and migration, and `supabase/**`.
- `SchemaRenderer.tsx`, `src/lib/render/autoFit.ts` and `src/lib/render/exportPng.ts`.
- The placement code in `layout.ts` (`placeGroup`, `placeTopLevel`, `placeFreeGroup`, `contentMainSize`, `recordGroupRect`) and the body of `platedRect`. Export and share them; never change what they compute.
- `FieldOverlayEditor.tsx` and `canvasGesture.ts`. Moving, reordering and resizing inside a stack already work.
- `SelectionToolbar.tsx`: no new button and no new icon.
- ⌘G and `deriveFreeGroup`.
- Existing fixtures, goldens and baselines.

### Invariants

- **Grouping never moves anything.** A stack made from elements already arranged as a row or a column paints every child within 0.5px of where it painted before, for every field kind, and `conversionShift` reports the same.
- **Placement is unchanged.** Every existing test in `layout.test.ts` passes untouched, and every existing fidelity fixture holds its baseline on all three engines.
- **Measurement matches painting.** A value measures as overflowing only when the renderer would paint it past its own box, or paint its stack past the canvas.

### The fix

#### One answer for what a stack child occupies

- In `layout.ts`, export `platedRect` and add `isFixedTextBox(field, style)`: a multiline field with no plate under Shrink or Fill. Use it in `sizedChildren` (395 to 398) and in `applyShrink` (615 to 621). The copy in `applyShrink` also leaves plated multiline Shrink and Fill fields out of shrinkToFit today, although a plate hugs and shrinking it frees space; the shared predicate fixes that, and a test covers it.
- `memberExtents` returns, for each stack direction, exactly the rect a stack in that direction would place for the child, positioned where the baseline pass paints it today:
  - a plated field of either text type: the plated baseline rect on both axes, at the size `computeLayout` gives plates (a Free fit at the set size, 711 to 716);
  - an `isFixedTextBox` field: its authored box on both axes;
  - a Free multiline field: its hugged block (authored width, measured height, placed by `verticalAlign`) on both axes, since both directions place that block;
  - a single line without a plate: as today (the authored box's column for a vertical stack, the painted glyph run for a horizontal one);
  - an image or shape: its authored box, as today.

#### ⇧A (D1)

- An `addAutoLayout` action in `TemplateBuilder.tsx`, reached from a new branch in the keyboard handler placed before the tool keys (`!mod && !e.altKey && e.shiftKey && e.code === "KeyA"`, with something selected; `KeyA` belongs to no tool):
  - one plain group selected and nothing else: `setGroupMode(id, "stack")`, the existing path with its confirm;
  - otherwise `deriveGroup` from the selection. On success, one draft write (one undo entry), then the same selection, flash and notice tail as `groupSelection`; factor that tail out of `groupSelection` rather than copying it. On failure, say why in the notice the way ⌘G does: already in a group, fewer than two elements, or a plain group in the selection, which a stack can't hold.
- "Add auto layout" (shortcut "⇧A") in the element menu right after "Group selection", shown whenever "Group selection" is, and at the top of a plain group frame's menu. A stack's menu gains nothing.
- A row in `ShortcutsPanel.tsx` after Ungroup: "⇧ A", "Add auto layout".

#### Plates and stacks in measurement (D2)

`overflowsAlone` takes the schema (`fitsInContext` already has it) and finds the field's direct group with `groupOfField`. When that group is a stack, its direction is the field's stack axis.

- A plated field measures as it paints, at its set size, since plates ignore Shrink and Fill. A single line overflows when its text width plus both side paddings exceeds `width` by more than `SUBPIXEL_PX`, unless its stack axis is horizontal. A multiline wraps at `width` less both side paddings, and overflows when its height plus both vertical paddings exceeds `height` by more than `SUBPIXEL_PX`, unless its stack axis is vertical. A plated field never reports "shrinks".
- Shrink and Fill keep today's check, except that a single line in a horizontal stack never overflows alone, because the stack hugs it at its floor. An `isFixedTextBox` field keeps today's check in any stack.
- Free keeps today's check, except that a single line in a horizontal stack and a multiline in a vertical stack never overflow alone.
- A field in a plain group, or in no group, measures exactly as today. The containing-group check in `fitsInContext` and `overflowingGroupKeys` still decides whether a stack leaves the canvas, and `characterBudget` keeps deriving group-aware budgets through it.
- Add a sentence on plates and one on stacks to the measurement paragraph in `docs/ARCHITECTURE.md`.

#### The group inspector (rule 13)

Remove the helper lines in `GroupInspector.tsx` at 155 to 159, 280 to 284 and 292 to 297, and keep the state line at 287 to 291. Don't render the Overflow section when nothing is left in it.

### Steps

#### Step 1: Recon

- If D1 or D2 is still open, ask CJ before going further.
- Confirm that nothing else derives stack geometry from authored boxes or measures a stack child against its own box: `alignOps.ts`, `reflow.ts`, `rescale.ts`, the reorder and resize paths in `FieldOverlayEditor.tsx`, and `draftView.ts`. Anything that does goes in the gate report, and if it changes this plan, stop and say so.

#### Step 2: One answer for what a stack child occupies

- Write CJ's row as a test in `groupOps.test.ts` first and watch it fail on today's code: two plated text fields built the way `extract.ts` lands pills, 12px apart, grouped through `deriveGroup` and through `deriveFreeGroup` then `toStackGroup`, expecting gap 12, the stack's x at the first plate's left edge, its y at the plates' top, and `conversionShift` at most 0.5. (A run built from CJ's numbers derived a 76px gap.)
- Then the exports, `isFixedTextBox` and `memberExtents`.
- A test across every kind and both directions: Free single line aligned left, center and right, Free multiline, Shrink single line, Shrink and Fill multiline, plated single line, plated multiline, image and shape. Arrange three of a kind as a row or a column aligned on one edge, group them both ways (`deriveGroup`, and `deriveFreeGroup` then `toStackGroup`), and assert every child within 0.5px of its rect before grouping and `conversionShift` at most 0.5.
- The `applyShrink` case: a plated multiline Shrink field in a stack that outgrows the canvas now shrinks.

#### Step 3: ⇧A, the menus, the list and the inspector

- `addAutoLayout`, the keyboard branch, both menu entries, the shortcuts row, and the inspector cleanup, as above.
- Each new string is proposed copy.

#### Step 4: Measurement

- Write CJ's row in `measureProposal.test.ts` first and watch it fail: the two pills in a horizontal stack with "Part time contractor" in the first, expecting `fits`.
- Then the change, with tests:
  - CJ's row ungrouped: "Part time contractor" still overflows its pill and gets a budget;
  - grouped in a horizontal stack: fits, and with enough text to push the row past the canvas it overflows with a group-aware budget above zero;
  - a plated Shrink field never reports "shrinks";
  - a Free multiline in a vertical stack that outgrows its own box while the stack stays on the canvas fits;
  - a Free single line in a vertical stack wider than its box still overflows;
  - a field in a plain group measures exactly as today;
  - `checkRows` in `src/lib/bulk/validate.ts` accepts CJ's row in its stack.
- Every existing test in `measureProposal.test.ts` and `src/lib/bulk/validate.test.ts` passes unchanged.

#### Step 5: Fixtures and the gate

- Two `figma` fixtures from CJ's file, each built from exact values read with the Figma MCP server:
  - `pill-row` from `46:768`, the template as designed;
  - `pill-row-long` from `46:782`, with "Part time contractor" in the first pill.
- Each schema holds the two pills as member text fields with plates and with `values`, in one horizontal stack: gap 12, anchor start at the first pill's left edge as that frame places it, align center, crossSize the pill height. The text is Inter Tight Regular, from `/src/assets/fonts/inter-tight/InterTight-wght400-600-latin.woff2`. List in `unsupported` the vertical trim (the text uses `leadingTrim: CAP_HEIGHT`, which no field property expresses, so each plate paints taller than Figma's) and Figma's fixed pill widths (a plate hugs, so an inset can differ by a pixel).
- Fetch the goldens with `node scripts/fidelity/goldens.mjs fetch <name>`. It needs `FIGMA_TOKEN`; if that isn't set, stop and ask CJ for it.
- Run `fidelity-checker`.
- **Gate:** the fidelity table for every fixture; the two new fixtures beside their goldens on all three engines; screenshots in Light and Dark from `npm run dev` on the local backend showing two pills selected, the same canvas after ⇧A (unchanged) with the inspector reading horizontal stack and gap 12, and the fill page with "Part time contractor" in the first pill; the tests added; proposed copy; and the tails of `npm run verify` and `npm run build`. Record the new baselines only once CJ approves.

---

## Phase 2: Figma auto layout imports as stacks

### Why this phase exists

CJ builds templates in Figma, and Figma's auto layout already says which elements travel together, in which direction, with what gap, and which way they grow. The importer drops all of it today. With Phase 1 in, a stack is lossless and measured correctly, so an import can hand one straight over.

### Read before writing

| File | Why |
| ---- | --- |
| `supabase/functions/_shared/extract.ts` | `FigmaNode` (24), `SuggestedField` (108), `pillContainer` (320), `placementOf` (434), `walk` (521) with its text branch (539 to 613, `textSizing: "shrink"` at 606), `shapeContainerFill`, the pill fusion (786 to 831), `liftDescends`, `isRasterLeaf` |
| `supabase/functions/figma-import/index.ts` | The walk (102), the elements response (290) and the template response (326) |
| `supabase/functions/_shared/figma.ts` | `fetchNodeTree`, which returns the full node JSON from `/v1/files/:key/nodes?ids=…&geometry=paths` |
| `test/fidelity/fixtures/gtm-composer/figma-node.json`, `test/fidelity/fixtures/feature-highlight/figma-node.json` | Real node JSON from that same endpoint, for offline replay. The composer holds 14 auto layout frames |
| `src/lib/types.ts` | `LayoutGroup` (375), `DesignImportResult` (1098), `ElementImportResult` (1117) |
| `src/lib/stores/supabase/figmaImporter.ts`, `src/lib/stores/interfaces.ts` | Where import results come back to the client |
| `src/app/components/builder/TemplateBuilder.tsx` | `importElementsAt` (1559), `landImport` (2081), `degradedReport`, `applyImport` (2179) |
| `src/lib/figma/overlayFields.ts` | `ElementImportPayload` (169), `assembleElementFields` (181) |
| `src/lib/templates/fieldRules.test.ts` | How a `src` test imports a `_shared` module |
| `docs/brand-system/CEILING.md`, `docs/brand-system/PLAN.md` (Phase 4) | The importer's recorded limits, and the phase this one overlaps |

### Scope

In: reading auto layout in both import modes, the mapping of D3 and D4, the wire shape, landing proposed stacks in the draft, and tests.

Out: auto-build (`template-autobuild`), Canva, the background recompose, and every frame D4 leaves out.

### What not to touch

- `TemplateSchema`, `TemplateField`, `LayoutGroup` and every column.
- `walk`'s decisions for anything outside a proposed stack, and its decisions inside one apart from D3's text sizing.
- `figmaLayers.ts`, `composeLayers.ts` and the recompose.
- `supabase/functions/template-autobuild/**` and `_shared/autobuildValidate.ts`.
- Deployment. CJ deploys `figma-import` and runs the import walkthrough at the gate.

### What Figma sends

Confirmed in the saved node JSON: an auto layout frame carries `layoutMode` (`"HORIZONTAL"` or `"VERTICAL"`; `"GRID"` and `"NONE"` are not stacks), `itemSpacing`, `paddingLeft`, `paddingRight`, `paddingTop`, `paddingBottom`, `primaryAxisAlignItems` (`"MIN"`, `"CENTER"`, `"MAX"`, `"SPACE_BETWEEN"`), `counterAxisAlignItems` (`"MIN"`, `"CENTER"`, `"MAX"`, `"BASELINE"`), `primaryAxisSizingMode` (`"FIXED"`, or `"AUTO"` for hug), `layoutWrap`, and `constraints`. Its children carry `layoutPositioning` (`"ABSOLUTE"` takes a child out of the flow), `layoutGrow` (1 fills the main axis), and `layoutSizingHorizontal` and `layoutSizingVertical`. A TEXT node's `style.textAutoResize` is `"WIDTH_AND_HEIGHT"` (auto width), `"HEIGHT"` (auto height), or `"NONE"` or absent for fixed size (treat `"TRUNCATE"` as fixed). The API leaves default values out: absent means 0 for spacing and padding, `"MIN"` for both alignments, `"AUTO"` sizing, no wrap, an in-flow child, and fixed size text.

### The mapping (D3, D4)

A pure module, `supabase/functions/_shared/autoLayout.ts`, that imports nothing (declare its structural node and field types locally, as `extract.ts` does), so a `src` test can import it the way `fieldRules.test.ts` imports `_shared/fieldRules`. It runs after `walk` over the same tree and the fields the walk produced, and returns proposed stacks plus import issues.

- **Which frames.** Innermost first. A FRAME, COMPONENT or INSTANCE with `layoutMode` horizontal or vertical that is visible, is not itself a field's source (a fused pill, a lifted image or vector), paints nothing (no visible fill, stroke or effect), doesn't wrap, and has no in-flow child with `layoutGrow` 1. In template mode the imported frame is the canvas and never a stack; in elements mode the pasted node can be one.
- **Which children.** The visible children that aren't positioned absolutely, ordered by their position on the main axis. Each has to be exactly one field whose `sourceNodeId` is the child's own id, or a frame this pass already made a stack and that has no padding on any side. Nothing in the frame may be rotated. If any child fails, the frame stays fixed positions.
- **Geometry**, from the produced fields' boxes (already frame-relative), never re-measured:
  - `direction` from `layoutMode`; `gap` from `itemSpacing`, or for space between, the rounded mean of the gaps between the children's boxes;
  - `align` from `counterAxisAlignItems`, with baseline imported as start; the cross position and `crossSize` from the frame's own box less its padding on the cross axis;
  - `anchor`: for a fixed-size frame, from `primaryAxisAlignItems` (min is start, center is center, max is end); for a hug frame, from its constraint on the main axis (left or top is start, center is center, right or bottom is end, anything else is start);
  - the anchor coordinate: the first child's leading edge for start, the midpoint between the first child's leading edge and the last child's trailing edge for center, the last child's trailing edge for end;
  - `name` from the frame, a fresh `id`, `mode: "stack"`, and `shrinkToFit` left unset.
- **Children by node id.** Field keys are re-minted when an import lands, so a proposed stack names its children by Figma node id: `{ nodeId }` for a field and `{ groupId }` for a nested stack.
- **Text in a stack (D3).** A direct text child whose `textAutoResize` is auto width or auto height gets `textSizing: "free"`. Every other text keeps what the walk gave it, and a plated child is untouched, because a plate already hugs.
- **Issues.** Each auto layout frame left as fixed positions gets one `info` issue naming the layer and the reason, and so does a space-between or baseline approximation.

### The wire shape

Propose it at the recon gate, close to this:

```ts
/** A stack an import proposes. Its children name Figma nodes or other
 * proposed stacks, and resolve to fieldKeys when the import lands. */
export interface ImportedLayoutGroup extends Omit<LayoutGroup, "children"> {
  children: Array<{ nodeId: string } | { groupId: string }>;
}
```

with `DesignImportResult.suggestedGroups?: ImportedLayoutGroup[]`, `ElementImportResult.groups?: ImportedLayoutGroup[]`, and the same shape declared in `autoLayout.ts` for the function. `LayoutGroup` itself doesn't change.

### Landing an import

- A pure `resolveImportedGroups(proposed, landed)` in `src/lib/figma/importGroups.ts`. Each `{ nodeId }` becomes the fieldKey of the one landed field with that `sourceNodeId`, each `{ groupId }` becomes `group:<id>`, and a stack with a child that doesn't resolve is dropped together with every stack that contains it, and returned by name as dropped.
- `landImport` takes the proposals and writes the resolved stacks in the same `setDraft` as the fields, so an import stays one undo entry. `applyImport` passes `result.suggestedGroups`, and the auto-build path passes none.
- Elements mode: move the paste-point math out of `assembleElementFields` into one helper that both it and the stacks use, offset each proposed stack's `x` and `y` by the same amount as the fields, resolve, and write fields and stacks in one draft write in `importElementsAt`.
- When stacks land, the import notice says how many (proposed copy, such as "2 auto layouts kept.").

### Steps

#### Step 1: Recon gate

- If D3 or D4 is still open, ask CJ.
- Confirm from `fetchNodeTree` that the import's tree carries the properties above.
- Replay `walk` and a draft of the mapping offline over the two saved node JSON files, and over any frame CJ links, and report every auto layout frame with what it would become: a stack (direction, gap, anchor and children) or fixed positions with the reason.
- Propose the wire shape and every new issue string.
- **Gate 1:** stop and wait for CJ. He may widen D4 from what the replay shows.

#### Step 2: The mapping

`autoLayout.ts`, with tests in `supabase/functions/_shared/autoLayout.test.ts` on synthetic trees:

- CJ's row built as horizontal auto layout (gap 12, two pills) becomes one stack with gap 12, anchored at the first pill's left edge;
- a frame with its own fill, a wrapping frame, and a frame with a `layoutGrow` 1 child each stay fixed positions with their reason;
- an absolutely positioned child is left out of the flow;
- a spacer frame that produced no field keeps its parent as fixed positions;
- a nested stack without padding nests, and one with padding keeps both frames as fixed positions;
- space between imports as the mean gap, with its issue;
- a fixed-size centered frame anchors center at the run's midpoint, and a hug frame constrained right anchors end;
- a rotated child keeps the frame as fixed positions;
- D3: auto width and auto height text in a stack becomes Free, and fixed size text keeps Shrink.

`npm run typecheck:deno` passes.

#### Step 3: The function

`figma-import` runs the mapping after the walk in both modes and returns the proposals, with the issues merged into `warningDetails` and `warnings`.

#### Step 4: Landing

- `importGroups.ts` with tests, then `landImport`, `applyImport` and elements mode, as above.
- One end-to-end test in `src/lib/figma/importGroups.test.ts`: a synthetic Figma tree of CJ's row in auto layout goes through `walk`, the mapping and `resolveImportedGroups`, then `computeLayout` with a measurer that returns each designed string's Figma text width. Every child lands within 1px of its Figma box, and with "Part time contractor" in the first pill the second moves by exactly the first's growth.

#### Step 5: Gate

- Run `fidelity-checker`. The existing fixtures must hold, since the importer doesn't feed them.
- **Gate 2:** the replay table again from the finished code, the tests added, proposed copy, and the tails of `npm run verify`, `npm run typecheck:deno` and `npm run build`. Once CJ deploys `figma-import`, a walkthrough that imports a frame with an auto layout row, with screenshots of the landed stack in the inspector and of the fill page with longer copy.

---

## Not in this work

- Stack padding, wrap, fill container and space between as live properties. `LayoutGroup` is frozen, and each would be its own decision.
- A background that grows with its stack (a filled auto layout frame). Paint order is the hard part, and it needs its own design.
- Figma groups that aren't auto layout importing as plain groups.
- Keeping a growing stack clear of elements outside it. A stack's budget is the canvas edge.
- Auto-build carrying stacks. Two related import gaps turned up while tracing this and belong to their own fix: auto-build drops pill plates (`ExtractedElement` and `geometryFrom` in `_shared/autobuildValidate.ts` carry no plate properties, while the pill's container still lifts off the background, so an auto-built pill paints as bare text), and the importer ignores vertical trim (`leadingTrim: CAP_HEIGHT`), so CJ's 54px pills import about 72px tall.
- A toolbar button or icon for auto layout.

## Gate report (every phase)

End each phase with this report. Then run `phase-reviewer`, naming this prompt, the phase, and `docs/brand-system/RULES.md` as the rules it follows, plus `fidelity-checker`. Fix every must-fix finding and open the pull request into `main`.

1. Commits, one line each.
2. The decisions the phase used, and their status.
3. Tests added, by file.
4. The fidelity table (fixture, engine, changed %, baseline), and in Phase 1 the new fixtures beside their goldens.
5. Screenshots of every changed screen in Light and Dark.
6. Proposed copy: every string the phase added or changed.
7. Anything outside the scope you noticed and left alone, and anything you were unsure of.
8. The tails of `npm run verify` and `npm run build`.
