# ElevenLabs, Phase E1: foundation

You are a senior front-end engineer on SocialPaint (this repository). This phase moves the code onto the ElevenLabs system in the Figma file "Master UX-UI New Brand Eleven Labs Inspired" (`dQ8bQq3V7Bue5pvFrI2g9X`). It applies the prepared token patch, makes the primitives match their boards on the six component pages in Light and in Dark, gives the Segmented Control its liquid selection, builds the microinteractions that live in primitives (`PROMPT.md` sections 7.2 to 7.6), fixes every surface the new values would leave invisible, redraws `/dev/ui` from those boards, and points `CLAUDE.md` at this folder.

The new values turn the page and every raised surface white in Light and take the shadow off raised surfaces, so tokens and primitives land together here (`PLAN.md`, Phases). A screen changes in this phase only because a value or a control on it changed: colors, radii, edges, shadows, a field's resting look. The shell is Phase E2, and each area's layout is its own phase after that.

Be exact. CJ has dropped plan mode and the recon gate for this program (2026-11-17), so build straight through. Work through the steps in section 4 in order, run the checks each step names, and commit after each step with `npm run verify` green. If something here turns out to be wrong once you are in the code, build the closest thing the boards allow and explain the conflict in the pull request instead of improvising a different design.

This prompt was written against `main` at `c54794a` (#202). Counts in it were taken there. Recount before you rely on one.

---

## 1. Read these first

1. `docs/design/elevenlabs/README.md`, `PLAN.md`, `RULES.md` and `BRIDGE.md` in full, and `PROMPT.md` sections 3 and 5.
2. `CLAUDE.md` and `docs/ARCHITECTURE.md` (the tokens and primitives paragraphs).
3. `docs/design/elevenlabs/phase-e1-tokens.patch`. Read the diff before you apply it.
4. `PROMPT.md` section 7 and `reference/liquid-selection.html`. Open the page, tick Slow motion and click between the options until you can describe each moment of the storyboard on Foundations › Interactions (`6262:353`).
5. `src/styles/primitives.css` in full (2,334 lines), and every file in `src/app/components/primitives/` with its test, `roving.ts` and `inputModality.ts` among them.
6. `src/app/dev/` (`DevUiPage.tsx`, `Boards.tsx`, `boards.json`, `sheetGroups.tsx`, `specimens.tsx`, `ThemesPanels.tsx`, `devUi.css`) and `scripts/new-look/shots.mjs` (`boards` and `compare-image`).
7. The rules section 6 of this prompt lists, in the stylesheets it names.
8. In Figma, with the MCP server connected: the Components index (`4012:1193`) and the six type pages after it (Actions `6218:2`, Inputs `6220:2`, Selection `6221:2`, Labels and feedback `6222:2`, Navigation `6221:524`, Containers `6222:834`). Each component has a board there with the code mapping, the tokens it reads, accessibility notes, a Light panel and a Dark panel of every variant, and the main component. Read each component this phase changes by its node id with `get_design_context` and `get_variable_defs`, and take its board with `get_screenshot`.

## 2. Invariants

- **Multi-tenant.** No tenant data, starter content, brand kit or graphic is touched. Names, numbers and pictures on the boards are sample data.
- **Tokens stay generated.** `master.tokens.json` and `tokens.css` change only through the patch and `npm run tokens`. A value the file lacks is reported in the pull request, not invented.
- **A component reads semantic tokens only.** No primitive (`--gray-900`, `--neutral-0`), no raw color, and no name either bridge lists in a rule this phase writes.
- **No layout moves.** No frame, grid, gap or page structure changes. The sidebar keeps its current shape until Phase E2. A control changes where its board changed it, and a surface changes only as section 6 says.
- **Behavior is kept.** Keyboard handling, roving focus, ARIA, dismissal and every existing test's intent survive. A test changes only because a name, a class or a value changed.
- `SchemaRenderer`, the export path, `canvasGesture.ts`, the frozen types and every table column are untouched. The builder's inspector reads these primitives, so run the `fidelity-checker` subagent at the gate.

## 3. Before you change anything

```bash
npm run shots -- capture .shots/before
npm run shots -- props .shots/props-before.json
npm run shots -- boards .shots/boards-before
```

The full capture takes about 45 minutes and reads the working tree. Run it in the background and do not edit `src/` until it finishes.

## 4. Steps

### Step 1: read the file

Read every component in section 5 from the file. For each, note the tokens each state reads in Light and Dark, the height, the radius, the edge and the icon color, and how it differs from the code today. Walk the rules in section 6 and, for each, open the frame its area's row in `PLAN.md` names and decide how it stays visible. Take the recommended answer to each open question in section 7, unless the code shows it cannot work.

Keep these notes for the pull request, then go straight on to step 2:

1. Every prop or value name that changes, with the count of call sites each change touches.
2. Every difference between the file and sections 5 and 6.
3. The surface table (section 6) with your treatment for each rule and the frame you read it from.
4. The answer you took to each open question in section 7.
5. Anything a component needs that no token carries.

### Step 2: the tokens

```bash
git apply --3way docs/design/elevenlabs/phase-e1-tokens.patch
npm run tokens
git diff --exit-code src/styles/tokens.css
```

The patch carries the new `master.tokens.json` (with `--logo-ink` and its `--neutral-850` primitive), the regenerated `tokens.css`, the exporter pointed at the new file (`design/tokens/figma-export/code.js`), the generator's px rule for `--layout-*` (`scripts/build-tokens.mjs`), the deletion of the three names `socialpaint.css` declared that `tokens.css` now owns (`--radius-tag`, `--plate-dark`, `--plate-light`), and `--ink-700` and `--ink-800` repointed at gray in `legacy-bridge.css` (`BRIDGE.md` sections 3 and 4). `npm run tokens` must leave `tokens.css` unchanged. If `main` has moved and the patch does not apply, regenerate from its `master.tokens.json` instead, and say so in the pull request.

Delete the patch file in the same commit. The commit carries it now.

`npm run verify` passes. Take `npm run shots -- props .shots/props-tokens.json`, and `props-compare` against the baseline shows only the names `BRIDGE.md` sections 2 to 5 list. Commit: "ElevenLabs E1: the tokens".

### Step 3: fields

Input, Text Area, Select, Upload, and the box that Search and an Input with a leading icon share (`.ui-input--box`).

- **Rest** is `--surface-field` under a `--border-field` hairline. Today a field has no edge at rest, and on the white page it would vanish.
- **Hover** moves the hairline to `--border-field-hover`. Today it adds `--border-strong`, which now resolves to the same gray as `--border-field`.
- **Error** is the `--feedback-error` hairline, as today. **Focus** keeps the global ring with the resting hairline under it. **Disabled** is `--action-disabled` with no edge, as today.
- Keep drawing the edge inside the box (the inset `box-shadow` the rules use today), so the text never moves between states.
- **Select** open keeps its ring, and its edge is what the board draws for Open.
- **Upload.** The empty thumbnail tile sits on `--surface-soft`, and a filled thumbnail keeps `--surface-raised`.
- **Field.** The label row sits `--space-12` above its control, where today it is 6, and the error line sits the same 12 under it, as the Field component's one gap draws (`4015:628`). The control is Medium by default, as it is today.

`npm run verify` passes. Commit: "ElevenLabs E1: fields".

### Step 4: the other primitives

Each against its board, in both themes.

- **Icon Button** gains `variant="outline"` (`2206:686`, Style=Outline, ten variants). A rounded square on `--radius-sm`, filled `--action-neutral` under a `--border-strong` hairline, with the glyph on `--text-secondary` at rest. Hover is `--action-neutral-hover` and pressed and selected are `--action-neutral-pressed`, all three with the glyph on `--text-primary`. Disabled is `--action-disabled` under a `--border-subtle` hairline with the glyph on `--text-disabled`. Filled and Ghost do not change. Nothing uses Outline yet, and Phase E2 puts it in the sidebar.
- **Search Field** (`50:62`) gains `size?: "lg" | "md"`, default `lg`. Large is `--size-control-lg` plus its hairline on each side, 46 in all, on `--radius-chip`. Medium is `--size-control-md`, 36, on `--radius-sm`. Both rest on `--action-neutral` under a `--border-strong` hairline and hover on `--action-neutral-hover` (today a tint laid over the fill). Open, the field is 440 wide at Large and 280 at Medium, with 16 of padding before the glyph and 8 after the clear at Large, 12 and 4 at Medium, and 8 between its parts. The glyph stays 20. The clear becomes a real Icon Button, Ghost Small with `Icon/x` at 16, named "Clear search", in place of today's bare 14 glyph. The ring sits 2 out from the edge. Today it is a 50 square on off-scale padding. Pass the size each call site's frame draws: Large on Brand Templates (`Portal.tsx`) and History (`GenerateHistoryPage.tsx`), Medium in the Template Builder list (`AdminTemplates.tsx`) and the size gallery (`SizeGallery.tsx`), all through `LibrarySearch`. The page rules that reshape it (`.sp-lib-search .ui-search`, round at 50) stay for Phases E3 to E5, unless they fight the new sizes. Say which in the pull request.
- **Search** (`2207:455`) takes the field changes from step 3 through `.ui-input--box`. Check it against its board.
- **Chip and Badge** take `--radius-chip`, and **Tag** takes `--radius-tag`. Today all three are `--radius-full`.
- **Stepper** sits on `--surface-soft`, where today it is `--surface-field`. **Progress Bar**'s track and **Progress Steps**' pending steps move from `--surface-field` to `--surface-soft`.
- **Button.** The icon takes the label's color in every kind and in Disabled. Check each kind against its board, and fix any icon that sets its own color.
- **Nav Item** already sets its icon and label on `--text-secondary` and lifts them to `--text-primary`. Check it against its board.
- **Segmented Control** gains the liquid selection (`PROMPT.md` section 7). Build it into `.ui-segmented` and `SegmentedControl` the way `reference/liquid-selection.html` does: the liquid layer and the thumb as `aria-hidden` children the component renders, the thumb's place and width in custom properties written from the selected segment's `offsetLeft` and `offsetWidth`, the timer for the drop read from `--motion-duration-base`, and one `#sp-goo` filter rendered once for the app. Keep `useRovingSelect`, the radiogroup roles and every test's intent. A selection the keyboard makes, first paint, a resize, a change to the options and reduced motion place the thumb with no travel and no drop. Until the thumb is placed, the selected segment draws its own fill and Elevation/Thumb, as today. Every call site gets it with no change.
- **Toast** eases in and out and owns its timer (`PROMPT.md` section 7.2). `Toast` gains `open`, `duration` and `onTimeout`. The enter is a transition from `@starting-style`, the exit runs before it unmounts, and the timer pauses while the pointer or focus is on it or the tab is hidden. Move Brand Studio's 5000 (`admin/brand/kitPlumbing.ts`) and Settings' 4000 (`admin/settings/settingsToast.tsx`) onto it in place of their own `setTimeout`.
- **Button and Icon Button** animate a change of `icon` in one 16 slot and draw the check as the Checkbox's mark (`PROMPT.md` section 7.3). Both gain `busy`, which sets `aria-busy` and `aria-disabled` and shows the spinner once the wait passes 400 ms. Export `CONFIRM_MS = 1500` from `primitives/` and use it where `Previews.tsx` and `details/DetailsPanel.tsx` declare `COPIED_MS`. Download's glyph only fades, and Send's swap to Stop stays instant.
- **Checkbox.** `CheckMark` renders the check and the dash as two paths on `pathLength="1"`, and the mark draws in on check (`PROMPT.md` section 7.4). A box checked at first paint is simply drawn.
- **Press scale** on Button, Icon Button, Send Button, Chip and Platform Chip, 0.97 on `--motion-duration-fast` (`PROMPT.md` section 7.5), for the pointer only and never when disabled.
- **Upload** gains `busy` and lets a photo picked or dropped after mount develop in (`PROMPT.md` section 7.6). Callers start passing `busy` in their own phases.
- Build each of these the way `reference/microinteractions.html` does. A press, a check and an icon swap land at once when `<html>` carries `data-input="keyboard"`, every one of them lands at once under reduced motion, and nothing animates on first paint.
- **Card, Metric, Menu, Dialog, Toast, Tooltip, the Result Card and the Composer** already draw their own hairline. Check each against its board now that the raised shadow is gone. The corners come from the new radius values.

`npm run verify` passes. Commit: "ElevenLabs E1: primitives".

### Step 5: surfaces that would vanish

Every rule in section 6 relied on a raised shadow, which now draws nothing, and most sit on `--surface-raised`, which is white like the page in Light. Give each the treatment you settled in step 1.

- **A card the frames draw on soft gray** takes `--surface-card` and no edge (template, recent, history and builder cards, `RULES.md` section 4).
- **A panel or a white card** keeps `--surface-raised` and takes a `--stroke-hairline` edge in `--border-raised`.
- **A surface on another ground** (the stage, an image) keeps what it has when it stays visible, and the pull request says why.
- Leave the `box-shadow: var(--elevation-1-raised)` lines where they are. The composite draws nothing, and Phase E9 decides whether it goes.

Then find anything section 6 missed. Grep `src/styles` and `src/app` for `--surface-raised`, `--surface-field`, `--input-bg`, `--elevation-small`, `--shadow-card` and `--elevation-1-raised`, and look at every route in Light and Dark at 1440 and 390 with the sidebar open. A surface is visible when its edge or its ground differs from what is under it.

`npm run verify` passes. Commit: "ElevenLabs E1: surfaces".

### Step 6: `/dev/ui`

Redraw the sheet from the six type pages. One section per page in the file's order, and inside it one board per component in the page's order, each showing every variant in its Light panel and again in its Dark panel, as the file lays them out. Regenerate `src/app/dev/boards.json` in its present shape from the boards (node ids are in `PROMPT.md` section 5.1), and drop the boards and the Themes panel that drew the earlier Components page. Keep the route, the fixture, `data-demo-state` and the working sheet of live controls. Remove every component the sheet shows that no longer exists.

Teach `npm run shots -- boards` to save each component's Light and Dark panels as their own images, export the same panels from the file as reference images into `docs/design/elevenlabs/reference/`, and compare:

```bash
npm run shots -- boards .shots/boards
npm run shots -- compare-image docs/design/elevenlabs/reference/<board>-light.png .shots/boards/<board>-light.png .shots/boards-diff/<board>-light.png
```

`npm run verify` passes. Commit: "ElevenLabs E1: the component sheet".

### Step 7: pointers and docs

- `CLAUDE.md`: "Platform UI follows `docs/design/elevenlabs/RULES.md`", and the programs list names `docs/design/elevenlabs/` as the platform UI from the Figma file "Master UX-UI New Brand Eleven Labs Inspired", with `docs/design/new-brand/` and `docs/design/new-look/` as the programs it builds on. Today the line points at `docs/design/new-look/RULES.md`.
- `docs/ARCHITECTURE.md`: the tokens paragraph and the primitives paragraph name the new file, its key and its six component pages, and say what `/dev/ui` draws now.
- Header comments that name the earlier file or `docs/design/new-brand/RULES.md` as the spec (`primitives.css`, `socialpaint.css`, `scripts/build-tokens.mjs`) point at this folder.
- `BRIDGE.md`: strike what this phase settled and correct any row the code proved wrong. `PLAN.md`: Phase E1's status.

`npm run verify` passes. Commit: "ElevenLabs E1: pointers and docs".

### Step 8: the gate

1. `npm run verify` and `npm run build` pass.
2. Tokens: `props-compare` between `.shots/props-before.json` and a fresh `.shots/props-after.json` shows only the names and values `BRIDGE.md` sections 2 to 5 list. Paste it.
3. `/dev/ui` matches the boards in Light and Dark. Paste the `compare-image` result for each board.
4. The liquid selection: record the variations bar and Edit and Preview clicking between options at four times their durations, in both themes, and set the frames at 40, 80, 120 and 200 ms beside the storyboard on Foundations › Interactions and the same frames of `reference/liquid-selection.html`. Then check that the arrow keys, reduced motion and a resize move the thumb at once, that a second click mid-flight retargets, and that a resting control matches the Selected segment. Do the same for the microinteractions in `/dev/ui` beside `reference/microinteractions.html` with Slow motion on: the Toast's enter, exit and pause, Copy and Download with a quick and a slow file, a checkbox and Select all, a press on each control that shrinks and one that does not, and an Upload. Then check that Tab and Space land the press, the check and the swap at once, that reduced motion lands every one at once, and that a reload animates nothing.
5. Screens: `npm run shots -- capture .shots/after`, then `compare .shots/before .shots/after .shots/diff`. Every route changes, since the palette changed (section 9). Read each area's before and after side by side and confirm that only values and controls changed, that no layout moved, and that no surface vanished in either theme. List any screen whose height changed and the control that caused it.
6. Keyboard: Tab through `/dev/ui`, Brand Templates, the fill page, Generate, the Template Builder list, Settings (Workspace and People) and Insights, in both themes. Every control shows the 2 px ring, 2 px out, and no ring or shadow is cut.
7. No rule this phase wrote reads a primitive, a raw color or a bridged name. Paste the grep.
8. Run the `fidelity-checker` subagent. Every fixture matches its baseline.
9. Run the `phase-reviewer` subagent against this prompt, `RULES.md` and `CLAUDE.md`.
10. Open the pull request into `main`: "ElevenLabs, Phase E1: foundation". List what changed, every renamed or added prop with its call sites, the `props-compare` and `compare` results, the surface table as built, the answer you took to each open question in section 7, every difference between the file and sections 5 and 6, and what was left for a later phase.

## 5. The components

What this phase changes, read from the file on 2026-11-17. Everything else on the six pages arrives through the tokens and is checked against its board in step 4.

| Component | Node | Board | Change | Code today |
|---|---|---|---|---|
| Input, Text Area | `2207:263`, `2207:298` | `6220:3`, `6220:305` | Rest on a `--border-field` hairline, hover on `--border-field-hover` | No edge at rest, `--border-strong` on hover. `.ui-input` |
| Select | `2207:410` | `6220:430` | As Input | As Input. `.ui-select` |
| Search | `2207:455` | `6220:720` | As Input | `.ui-input--box` |
| Upload | `2211:278` | `6220:1107` | As Input. Empty tile on `--surface-soft` | `.ui-upload`, `.ui-upload__tile` |
| Field | `4015:628` | `6220:980` | Label 12 above the control, error 12 under it | 6 and 6. `.ui-field` |
| Icon Button | `2206:686` | `6219:1664` | New Outline style | `variant?: "filled" \| "ghost"`. `.ui-iconbtn` |
| Search Field | `50:62` | `6220:840` | Sizes Large 46 and Medium 36, a real clear button, a flat hover | A 50 square that opens to 440. `.ui-search` |
| Chip, Badge | `2212:187`, `2212:130` | `6222:216`, `6222:3` | `--radius-chip` | `--radius-full` |
| Tag | `2212:143` | `6222:156` | `--radius-tag` | `--radius-full` |
| Stepper | `2211:227` | `6220:1214` | `--surface-soft` | `--surface-field`. `.ui-stepper` |
| Progress Bar, Progress Steps | `2215:272`, `2221:1105` | `6222:592`, `6222:626` | Track and pending steps on `--surface-soft` | `--surface-field`. `.ui-progress-bar`, `.ui-progress` |
| Button | `2206:542` | `6219:712` | Icons follow the label color | Check only |
| Nav Item | `2213:109` | `6221:525` | None | Check only |
| Segmented Control | `2211:213` | `6221:459` | The liquid selection on a pointer selection | The selected segment draws its own fill. `.ui-segmented`, `SegmentedControl` |
| Toast | `2213:213` | `6222:470` | Eases in and out, and owns a timer that pauses | Appears and vanishes at once. Owners run their own `setTimeout` |
| Button, Icon Button | `2206:542`, `2206:686` | `6219:712`, `6219:1664` | The icon swaps with a drawn check, `busy` shows a spinner past 400 ms, and both shrink while pressed | The glyph swaps at once, callers set `aria-busy` by hand |
| Send Button, Chip, Platform Chip | `2206:754`, `2212:187`, `53:96` | `6219:2090`, `6222:216`, Product components | Shrink while pressed | Color only |
| Checkbox | `2211:148` | `6221:101` | The mark draws in | The mark appears |
| Upload | `2211:278` | `6220:1107` | `busy`, and a new photo develops in | The photo appears |

## 6. The surfaces

The rules at `c54794a` that read a raised shadow (`--elevation-1-raised`, or `--elevation-small` and `--shadow-card` through the bridge) and draw no edge of their own. "Ground" is their background today. The treatment column is a starting point drawn from the frames this kit names. Check each against its frame in step 1, and list any you changed in the pull request.

| Rule | File | Ground | Starting treatment |
|---|---|---|---|
| `.sp-tcard` | `brand-templates.css` | `--surface-raised` | `--surface-card` (Template Card `4018:129`) |
| `.sp-gen-card` | `generate.css` | `--surface-raised` | `--surface-card` (Recent Card `4018:183`, History Card `4018:1728`) |
| `.sp-tbcard` | `template-builder.css` | `--surface-raised` | `--surface-card` (Builder Template Card `4018:156`) |
| `.sp-details` | `brand-templates.css` | `--surface-raised` | `--border-raised` edge (Details panel `6227:2623`) |
| `.sp-builder__rail` (both side panels) | `template-builder.css` | `--surface-raised` | `--border-raised` edge (Inspector `6227:2381`) |
| `.sp-stage__status` | `template-builder.css` | `--surface-raised` | Read `6072:3662`. It floats on the stage |
| `.sp-fill__art` | `brand-templates.css` | None | The graphic carries itself. Check it on the stage |
| `.sp-tchat-looks` | `brand-templates.css` | `--surface-raised` | Hidden since new-brand Phase 4. Edge, or leave for Phase E9 |
| `.sp-chat-stage .sp-chat-editor__graphic` | `socialpaint.css` | None | The graphic carries itself |
| `.sp-emptystate` | `socialpaint.css` | `--bg-card` | Read the Empty State board (`6222:770`) |
| `.ui-settings-card` | `primitives.css` | `--surface-raised` | `--border-raised` edge (Settings page `6227:2808`) |
| `.ui-option-tile` | `primitives.css` | None | Read Option Tile (`257:4145`) and Create account (`6101:1072`) |
| `.sp-in-card` | `insights.css` | `--surface-raised` | `--border-raised` edge (Insights `6095:1030`) |
| `.sp-bs-strip`, `.sp-bs-cat`, `.sp-bs-color` (and its open state), `.sp-bs-logo`, `.sp-bs-list`, `.sp-bs-image`, `.sp-bs-import__status` | `brand-studio.css` | `--surface-raised` | Read Brand Studio (`6085:1601` and the detail frames) |
| `.sp-onb-color-card`, `.sp-onb-dot__remove`, `.sp-onb-pull__row`, `.sp-onb-logo-tile`, `.sp-onb-font-card` | `auth.css` | `--surface-raised`, or none | Read Create account (`6101:1652`, `6101:2067`) |

Four field grounds outside the primitives lose their contrast too. `.sp-details__stage` (`brand-templates.css`), `.sp-chat-tile__type` (`generate.css`) and `.sp-hexrow` (`template-builder.css`) read `--surface-field`, and `.sp-bs-style__rename` (`brand-studio.css`) reads it through `--input-bg` with no edge. `.sp-input` keeps its own border. Add the four to the table.

## 7. Open questions

Build the recommended answer to each unless the code shows it cannot work, and list what you took in the pull request.

1. **Field edges.** `--border-field` reads 1.23:1 on white in Light and 1.38:1 in Dark, under WCAG 1.4.11's 3:1 for a control's boundary (`RULES.md` section 13). Every field has a visible label. Recommended: build as drawn, and leave raising the edge to CJ.
2. **Search Field page rules.** Brand Templates and History reshape it round at 50 (`.sp-lib-search`). Recommended: keep those rules until Phases E3 and E4 lay out their filter bars, so this phase changes the primitive and the builder's two call sites only, unless a page rule breaks the new sizes.
3. **Surfaces the frames leave open.** List every rule in section 6 whose frame does not settle between `--surface-card` and an edge, with the treatment you chose under step 5.
4. **Bridged shadow names.** `--elevation-small` and `--shadow-card` now draw nothing. Recommended: leave them in `legacy-bridge.css` for Phase E9, and stop reading them in any rule this phase touches.

## 8. Out of scope

- The shell: the flush sidebar, the header row, the Page Header's area icon and the viewport inset. Phase E2.
- The Result Card's arrival and its download check (Phase E4) and the Metrics' roll (Phase E7), which need their pages.
- Every area's layout, including the filter bar at 46, the Platform Chip, the composer on one line, `VariationTile` and the builder editor's header row. Phases E3 to E8.
- New copy. No string changes, except the clear button's "Clear search".
- Deleting bridged names or the transparent bevel and glow tokens. Phase E9.
- The logo and the favicon.

## 9. Expected changes

What the screenshot comparison should show, and nothing else.

**Color.** The page is white in Light and near-black in Dark, and the sidebar, panels and dialogs are white in Light. Primary buttons and Send are ink with a white label in Light and light gray with an ink label in Dark, where they were Slime. Secondary text, borders, states and the skeletons move to the neutral gray ramp (`BRIDGE.md` section 5).

**Elevation.** Cards, panels and the sidebar lose their shadow. Menus, popovers, dialogs, toasts and the switch and segment thumbs keep theirs.

**Surfaces.** Template, recent, history and builder cards turn soft gray. Panels and white cards carry a hairline. Nothing vanishes in either theme.

**Fields.** Inputs, selects, text areas, uploads and search rest white with a hairline that darkens on hover. Field labels sit 12 above their controls.

**Corners.** Cards, dialogs and panels are 16 (20 before). Menus and toasts 12 (16). Wells and alerts 10 (12). Chips and badges 10 and tags 6, where all three were round. Checkboxes and the smallest marks 6 (4).

**Search Field.** 46 or 36 where it was 50, with a real clear button, wherever no page rule reshapes it.

**Segmented controls.** A click moves the thumb to the new option with a drop trailing it. The resting control looks as it does today on the new tokens.

**Motion.** Pressed buttons and chips shrink a little, copy and download icons crossfade with a drawn check, checkbox marks draw in, toasts ease in and out and wait under the pointer, and a new photo on an Upload develops in. Screenshots at rest show none of it.

**Type.** Title/Display is 40 (44 before).

**Unchanged.** Every frame, gap and layout, the sidebar's shape, every graphic and every export.
