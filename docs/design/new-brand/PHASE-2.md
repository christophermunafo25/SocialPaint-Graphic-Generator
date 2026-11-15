# New brand, Phase 2: primitives

You are a senior front-end engineer on SocialPaint (this repository). This phase rebuilds the shared components in `src/app/components/primitives/` so each one matches its component on the Components page of the Figma file "Master UX UI New Brand (Copy)" (`1dYWgFH2V8i9Jez2ylI3ky`), in every state, in Light and in Dark. Four sets of duplicates fold into one component each. Seven components the code does not have are added. `/dev/ui` is redrawn to show every component the way the Components page does.

Phase 1 changed values and left every component as it was. This phase changes the components and leaves every screen's layout as it is. A screen changes here only because a control on it changed: its height, its radius, its colors, its states. Sections 6 and 8 say what that covers. Page frames, grids, gaps and flows are Phases 3 to 9.

Be exact. Plan in plan mode first. Work through the steps in section 5 in order, run the checks each step names, and commit after each step with `npm run verify` green. If something here turns out to be wrong once you are in the code, stop and explain the conflict instead of improvising.

This prompt was written against `main` at `59c5278` (Phase 1, #185). Counts in it were taken there. Recount before you rely on one.

---

## 1. Read these first

1. `docs/design/new-brand/PLAN.md` (the Components table under "What Phase 0 found", and "Clipping containers"), `RULES.md` in full, `BRIDGE.md` in full, and `PROMPT.md` section 6.1.
2. `CLAUDE.md`.
3. `src/styles/primitives.css` in full (1,584 lines). It is the only stylesheet this phase rewrites.
4. Every file in `src/app/components/primitives/`, with its test.
5. `src/app/dev/DevUiPage.tsx`, `sheetGroups.tsx`, `statesTable.tsx`, `ComponentSheet.tsx`, `renderers.tsx` and `devUi.css`.
6. The duplicates this phase folds: `src/app/components/Switch.tsx`, `Tooltip.tsx`, `Skeleton.tsx`, `ErrorState.tsx`, `ConfirmDialog.tsx`, `layout/Breadcrumb.tsx`, `layout/Page.tsx`, `generate/LegalLinks.tsx`.
7. `scripts/new-look/shots.mjs` (the `dev-ui` route and `compare-image`).
8. In Figma, with the MCP server connected: the Components page (`4012:1193`). Its boards are Buttons `4012:1206`, Fields `4012:1207`, Selection `4012:1208`, Labels `4012:1209`, Avatars `4012:1210`, Navigation `4012:1211`, Containers `4012:1212` and Themes `4012:1214`. Read each component by the node id in section 6 with `get_design_context` and `get_variable_defs`. Every block is drawn in Light with a Dark preview under it, and both are the spec.

## 2. Invariants

- **Multi-tenant.** No tenant data, starter content, brand kit or graphic is touched. Sample names and numbers on the boards are sample data.
- **Tokens stay generated.** This phase reads tokens and adds none. A value the file lacks is reported, not invented.
- **A component reads semantic tokens only.** No primitive (`--neutral-900`, `--green-slime`), no raw color, and no name `BRIDGE.md` lists. When this phase ends, the rules in `primitives.css` for the components in section 6 read no bridged name.
- **Every control takes its height from `--size-control-*`** and centers its label, which uses a trimmed `.t-*` class. No control is sized by padding around its label (`RULES.md` section 5).
- **No layout is rebuilt.** A call site changes only where a component's props changed, and the change is the smallest that keeps the screen working: a renamed prop, a renamed kind, a size name. No markup around a component moves.
- **Behavior is kept.** Keyboard handling, roving focus, ARIA, dismissal and every existing test's intent survive the rebuild. A test changes only because a name or a class changed.
- `SchemaRenderer`, the export path, `canvasGesture.ts`, the frozen types and every table column are untouched. The builder's inspector imports `Switch` and reads `Tooltip`, so run the `fidelity-checker` subagent at the gate.

## 3. Before you change anything

```bash
npm run shots -- capture .shots/before
npm run shots -- capture .shots/ui-before --only dev-ui --widths 3172 --no-popups
```

The full capture takes about 45 minutes and reads the working tree. Run it in the background and do not edit `src/` until it finishes.

## 4. What Phase 1 left for this phase

- **Text is on untrimmed twins.** 43 lines in `primitives/*.tsx` use a `.tu-*` class. A rebuilt component takes the trimmed `.t-*` class and its `.tu-*` use goes. A twin with no call site left anywhere in `src/` is deleted from `legacy-bridge.css`.
- **Hover and pressed are a tint laid over the fill** (`.ui-tint` and `--_tint`, `primitives.css` lines 23 to 45). The new components change color through their own tokens (`RULES.md` section 6). `.ui-tint` goes when its last reader goes.
- **Disabled is opacity** (`--_disabled-opacity`, 0.4 and 0.32). It becomes `--action-disabled` under `--text-disabled`.
- **Tight rings.** `.ui-ring-tight` draws the ring against the edge. Five rules and nine call sites use it. Each rebuilt component takes the global ring, 2 px out, and `.ui-ring-tight` goes when its last reader goes. `.ui-ring-none` has no rule behind it since Phase 1: remove the class from the markup of every component you rebuild.
- **Holding values in the bridge.** `--state-hover-inverse`, `--state-pressed-inverse`, `--state-hover-on-color`, `--state-pressed-on-color`, `--control-fill`, `--chip-*`, `--tag-*`, `--status-*-bg` and `-fg`, `--switch-*`, `--btn-primary-*`, `--text-on-fill`, `--input-bg` and `--state-error` are read by `primitives.css`. Each gets its real token here (`BRIDGE.md` section 2 says which).
- **`--state-error` splits.** A filled destructive action is `--action-danger` under `--action-on-danger`. Error text is `--feedback-error-text`. A field's error edge is `--feedback-error`. An alert's ground is `--feedback-error-surface`.
- **Icons.** Controls use `--size-icon-sm` (16) and navigation uses `--size-icon-md` (18). `Button.tsx` passes 14 at Small today. The 10, 14, 15 and 20 sizes go from every component rebuilt here.
- **Two stale lines.** `Field.tsx:11` says focus shows the caret alone. `src/lib/motionTokens.ts` falls back to 0.14 and 0.22 seconds, where the tokens are 120 and 200 ms. Fix both.

## 5. Steps

### Step 1: recon and the plan

Read every component in section 6 from the file. For each, write down in your plan: the tokens each state reads in Light and Dark, the height, the radius, the padding, the text style, the icon size, and how it differs from the code today. Where the file and section 6 disagree, the file wins and you list the difference.

Then stop at the **recon gate** and report:

1. Every prop, kind or size name that changes, with the count of call sites each change touches.
2. Every difference between the file and section 6.
3. The answers you propose to the open questions in section 7.
4. Anything a component needs that no token carries.

Wait for CJ before step 2.

### Step 2: the base

Rewrite the shared rules at the top of `primitives.css`: the reset, focus, and what replaces `.ui-tint` and `.ui-disabled`. Decide the pattern once and use it everywhere: a component sets its own fill for each state from the tokens, and no layer sits on top of a fill.

Keep `data-demo-state` working. `/dev/ui` uses it to hold a component in Hover, Pressed, Focus, Selected, Open or Disabled without a pointer.

`npm run verify` passes. Commit: "New brand phase 2: the base rules".

### Step 3: buttons

Button, Icon Button, Send Button (section 6, Buttons board).

- **Button.** Kinds Primary, Neutral, Ghost and Destructive. Sizes Small, Medium and Large at 28, 36 and 44. Today the sizes are `sm` 28, `default` 36, `md` 40 and `lg` 44, and the kinds include `neutralOnPage`. `--action-neutral` works on the page and on a raised surface, so `neutralOnPage` folds into Neutral. The 40 size has no match: at the recon gate, say which size each of its call sites takes.
- **Icon Button.** One component replaces `IconButton`, `RowMenuTrigger`, `ThemeToggle`, `StepperButton` and `AttachButton`. Styles Filled and Ghost, sizes Small and Medium at 28 and 36. Three behaviors stay as props, not variants: the theme toggle swaps its glyph by the nearest `[data-theme]`, the stepper's button stays focusable while disabled, and a row menu trigger holds Selected while its menu is open. Attach's inverse fill goes.
- **Send Button.** Actions Send and Stop, on `--action-accent`.

`npm run verify` passes. Commit: "New brand phase 2: buttons".

### Step 4: fields

Input, Text Area, Select, Search, Search Field, Field, Upload, Stepper.

- **Input and Select** line up on 28, 36 and 44. Today Input is 40 and 32, Select is 36 and 40, and `CompactSelect` is 28. `Select` and `CompactSelect` already share `SelectBase`, so the fold is a size prop.
- **Filter** (`Filter.tsx`, one caller, `admin/insights/FilterMenu.tsx`) becomes a Select there, and the file goes.
- **Search** (`2207:455`, always open, 36 tall) is new. **Search Field** (`50:62`, the 50 square button that opens to 440) is `SearchField.tsx` and stays. `templates/TemplateSearchField.tsx` is not touched: it belongs to the builder (Phase 6a).
- **Field.** Label in Label/XS, 6 above the control. The help text property stays off. The error line uses `--feedback-error-text`.
- **Error state.** Input, Text Area and Select draw the error edge in `--feedback-error`.

`npm run verify` passes. Commit: "New brand phase 2: fields".

### Step 5: selection

Switch, Checkbox, Radio, Segment and Segmented Control, Tab and Tabs.

- **Switch.** One component. `src/app/components/Switch.tsx` (two callers, both in the builder's inspector) is deleted and its callers import the primitive. Off, the edge is `--border-control` on `--control-track`. On, the fill is `--control-on` with `--control-on-mark`.
- **Checkbox and Radio** are new: a 16 box or mark with a Body/M label, and Checkbox has a Mixed state. Two native checkboxes exist today. Move them onto the component only if doing so changes no layout around them, and otherwise list them for their screen's phase.
- **Segmented Control.** The track is 36 at `--radius-sm` on `--control-track`. A segment is 28 at `--radius-xs`, and the selected one is `--control-thumb` with `--elevation-thumb`.
- **Tabs.** Today a pill on a track. The new Tabs (`4015:673`) is text on a hairline, and the selected tab carries the underline. One call site (`admin/insights/TrendCard.tsx`).

`npm run verify` passes. Commit: "New brand phase 2: selection".

### Step 6: labels and avatars

Badge, Tag, Chip, Avatar.

- **Badge** is `Chips.tsx` `Status` today. Nine tones: Positive, Active, Neutral, Error, Warning, Blue, Purple, Pink and Warm. Rename the component to `Badge` and its callers with it (8 uses in 6 files).
- **Tag.** Kinds Default, Overlay and Outline, 24 tall. `DetailTag` is a Tag, and a sent detail takes `--status-neutral-surface`.
- **Chip.** States Default, Hover, Pressed, Selected and Disabled, 28 tall, with an optional leading icon and remove. `Chip` and `ChoiceChip` fold if the file draws one component for both jobs. Say which at the recon gate.
- **Avatar.** Sizes 28, 36 and 44. Shapes Circle and Square.

`npm run verify` passes. Commit: "New brand phase 2: labels and avatars".

### Step 7: navigation and overlays

Nav Item, Breadcrumb, Menu Item and Menu, Tooltip, Toast, Page Header, Footer Links.

- **Nav Item.** 36 tall at `--radius-sm`, and Selected is `--state-selected`. `SettingsRailItem` is a Nav Item.
- **Menu.** Items 36 tall at `--radius-sm`. The menu is `--radius-lg` with `--elevation-2-overlay`.
- **Tooltip.** One component. `Overlays.tsx` `Tooltip` is the chart tooltip, and `components/Tooltip.tsx` is the hint on controls (Radix, `.sp-tooltip`). The new one covers both with the value optional. It keeps Radix's positioning and delay.
- **Breadcrumb, Page Header, Footer Links** become primitives built from `layout/Breadcrumb.tsx`, `layout/Page.tsx` and `generate/LegalLinks.tsx`. This phase builds the components and shows them on `/dev/ui`. It moves no page onto them: where the header sits, and which pages use it, is Phase 3. If building them as primitives would force a page to change, leave the page on the older file and say so.

`npm run verify` passes. Commit: "New brand phase 2: navigation and overlays".

### Step 8: containers

Card, Dialog, Metric, Table Row, Progress Bar and Progress Steps, Skeleton, Alert, Empty State.

- **Dialog.** `Modal` is the component. The close button sits in the top right corner (decision 7). `ConfirmDialog.tsx` is the Destructive kind. The hand-rolled dialogs, most of them in the builder, stay where they are for their own phases.
- **Skeleton.** One vocabulary: `Skeleton.tsx` becomes the primitive, with shapes Line, Block and Circle on `--surface-skeleton`, pulsing on `--motion-duration-pulse`. `.sp-bs-bone` and `.sp-st-bone` move onto it only where that is a class swap. Otherwise list them for Phases 7 and 8.
- **Table Row, Alert, Empty State** are new. Build them and show them on `/dev/ui`. Do not move the three hand-built tables, the alert blocks or `.sp-emptystate` onto them: that is each screen's phase. `ErrorState.tsx` (21 uses in 15 files) takes the Alert's tokens without changing its markup or its callers.
- **Card and Metric.** `Card` has no caller outside `/dev/ui`, and `Metric` has one. Build both as drawn, with their Loading states.
- **A dialog scrolls when tall** (`.ui-modal`). It is on the list in `PLAN.md`, "Clipping containers": give it the shadow room `RULES.md` section 4 describes.

`npm run verify` passes. Commit: "New brand phase 2: containers".

### Step 9: `/dev/ui`

Redraw the sheet to follow the Components page: one section per board, in the page's order, each component in every variant and state, in Light and in Dark. Keep the route, the fixture and the Interaction states table's role. Remove every component the sheet shows that no longer exists.

Export each board from the file as a reference image into `docs/design/new-brand/reference/` and compare:

```bash
npm run shots -- capture .shots/ui --only dev-ui --widths 3172 --no-popups
npm run shots -- compare-image docs/design/new-brand/reference/<board>.png .shots/ui/dev-ui-light-3172.png .shots/ui-diff/<board>.png
```

`npm run verify` passes. Commit: "New brand phase 2: the component sheet".

### Step 10: clean up and docs

- Delete every rule in `primitives.css` that nothing reads, every `.tu-*` twin with no call site, and every bridge line whose last reader this phase removed. Grep `src/` for each name before deleting it, in CSS and in strings a `.ts` file builds.
- `npm run tokens:check` passes.
- `BRIDGE.md`: strike the rows this phase emptied, and correct any row the code proved wrong.
- `PLAN.md`: mark Phase 1 merged (#185) and Phase 2's status.
- `primitives/index.ts`: the header comment names this file and the Components page.

`npm run verify` passes. Commit: "New brand phase 2: clean up and docs".

### Step 11: the gate

1. `npm run verify` and `npm run build` pass.
2. `/dev/ui` matches the boards in Light and in Dark. Paste the `compare-image` result for each board.
3. Screens: `npm run shots -- capture .shots/after`, then `compare .shots/before .shots/after .shots/diff`. Changed pixels sit on a control this phase rebuilt, or move because one changed height. List every screen whose height changed and say which control caused it.
4. Keyboard: Tab through `/dev/ui`, Brand Templates, the fill page, Generate, Settings (Workspace and People) and Insights, in both themes. Every control shows the 2 px ring, 2 px out. No ring and no shadow is cut by a container.
5. No control dims with opacity. Grep `primitives.css` for `opacity` and account for every hit.
6. No rule for a section 6 component reads a bridged name. Paste the grep.
7. Run the `fidelity-checker` subagent. Every fixture matches its baseline.
8. Run the `phase-reviewer` subagent against this prompt, `RULES.md` and `CLAUDE.md`.
9. Open the pull request into `main`: "New brand, Phase 2: primitives". List what changed, every renamed prop, kind and component with its call site count, the `compare` table, the height changes, every difference between the file and section 6, the bridge lines and twins deleted, and what was left for a later phase.

## 6. The components

From the Components page, confirmed on 2026-11-14. Sizes are width by height in px for the variants the file draws. "Uses" is call sites outside `primitives/` and `/dev/ui`, then files.

**Buttons** (`4012:1206`)

| Component | Node | Variants and properties | Drawn | Code today | Uses |
|---|---|---|---|---|---|
| Button | `2206:542` | Kind Primary, Neutral, Ghost, Destructive. Size Small, Medium, Large. State Default, Hover, Pressed, Disabled. Leading and trailing icon. Focus | 28, 36, 44 tall | `Button.tsx` `Button` | 93 in 40 |
| Icon Button | `2206:686` | Style Filled, Ghost. Size Small, Medium. State Default, Hover, Pressed, Selected, Disabled. Focus | 28, 36 square | `IconButton`, `RowMenuTrigger`, `ThemeToggle`, `StepperButton`, `AttachButton` | 10 in 5, then 0, 1, 0, 2 |
| Send Button | `2206:754` | Action Send, Stop. State Default, Hover, Pressed, Disabled. Focus | 36 square | `Button.tsx` `SendButton` | 3 in 2 |

**Fields** (`4012:1207`)

| Component | Node | Variants and properties | Drawn | Code today | Uses |
|---|---|---|---|---|---|
| Input | `2207:263` | Size Small, Medium, Large. State Default, Hover, Focus, Filled, Error, Disabled. Leading icon | 28, 36, 44 tall | `Field.tsx` `Input` (40, and 32 at `sm`) | 35 in 18 |
| Text Area | `2207:298` | State Default, Hover, Focus, Filled, Error, Disabled | 96 tall | `Field.tsx` `TextArea` (min 100) | 3 in 2 |
| Select | `2207:410` | Size Small, Medium, Large. State Placeholder, Default, Hover, Open, Error, Disabled | 28, 36, 44 tall | `Select` (36, 40 at `lg`), `CompactSelect` (28), `Filter` | 16 in 9, 2 in 2, 1 in 1 |
| Search | `2207:455` | State Default, Hover, Focus, Filled | 280 by 36 | None | New |
| Search Field | `50:62` | State Collapsed, Open, Hover. Focus | 50 square, 440 open | `SearchField.tsx` | 1 in 1 |
| Field | `4015:628` | Kind Single line, Text area, Upload. Label, Optional, Control slot, help text (off), error line | 43, 111, 71 tall | `Field.tsx` `Field` | 27 in 9 |
| Upload | `2211:278` | Value Empty, Filled. State Default, Hover. Focus | 56 tall | `Upload.tsx` | 7 in 5 |
| Stepper | `2211:227` | Value | 84 by 36 | `IconButton.tsx` `Stepper` (28) | 2 in 2 |

**Selection** (`4012:1208`)

| Component | Node | Variants and properties | Drawn | Code today | Uses |
|---|---|---|---|---|---|
| Switch | `2211:90` | Checked On, Off. State Default, Hover, Disabled. Focus | 36 by 20 | `Toggles.tsx` `Switch`, and `components/Switch.tsx` | 10 in 6 across both |
| Checkbox | `2211:148` | Checked Off, On, Mixed. State Default, Hover, Disabled. Label. Focus | 16 box | None | New |
| Radio | `2211:187` | Checked Off, On. State Default, Hover, Disabled. Label. Focus | 16 mark | None | New |
| Segment, Segmented Control | `2211:211`, `2211:213` | State Selected, Default, Hover, Disabled. Optional dot. Focus | Segment 28, track 36 | `Toggles.tsx` (segment 32) | 8 in 7 |
| Tab, Tabs | `4015:635`, `4015:673` | State Selected, Default | 28 and 26 tall, on a hairline | `Toggles.tsx` (a pill on a track) | 1 in 1 |

**Labels and avatars** (`4012:1209`, `4012:1210`)

| Component | Node | Variants and properties | Drawn | Code today | Uses |
|---|---|---|---|---|---|
| Badge | `2212:130` | Tone Positive, Active, Neutral, Error, Warning, Blue, Purple, Pink, Warm. Optional icon | 24 tall | `Chips.tsx` `Status` | 8 in 6 |
| Tag | `2212:143` | Kind Default, Overlay, Outline | 24 tall | `Chips.tsx` `Tag`, `DetailTag` | 8 in 6, 2 in 2 |
| Chip | `2212:187` | State Default, Hover, Pressed, Selected, Disabled. Leading icon, remove. Focus | 28 tall | `Chips.tsx` `Chip`, `ChoiceChip` | 5 in 2, 8 in 3 |
| Avatar | `2212:214` | Size Small, Medium, Large. Shape Circle, Square | 28, 36, 44 | `Navigation.tsx` `Avatar` | 5 in 4 |

**Navigation** (`4012:1211`)

| Component | Node | Variants and properties | Drawn | Code today | Uses |
|---|---|---|---|---|---|
| Nav Item | `2213:109` | State Selected, Default, Hover, Disabled. Label on or off. Focus | 36 tall | `Navigation.tsx` `NavItem`, `SettingsRailItem` | 2 in 1, 1 in 1 |
| Breadcrumb | `2213:111` | Parent, Current | Label/M | `layout/Breadcrumb.tsx` | Phase 3 places it |
| Menu Item, Menu | `2213:157`, `2213:159` | State Default, Hover, Selected, Disabled. Icon, meta, chevron. Focus | Item 36 tall | `Menu.tsx` (item 34) | `Menu` 2, `RowMenu` 5, `RowContextMenu` 3 |
| Tooltip | `2213:206` | Label, optional value | 27 tall | `Overlays.tsx` `Tooltip`, `components/Tooltip.tsx` | 3 in 3 across both |
| Toast | `2213:213` | Message, optional action | 46 tall | `Overlays.tsx` `Toast` | 6 in 6 |
| Page Header | `4015:764` | Kind Title, Breadcrumb | 1020 by 36 | `layout/Page.tsx` | Phase 3 places it |
| Footer Links | `4015:750` | None | Caption/M | `generate/LegalLinks.tsx` | Phase 3 places it |

**Containers** (`4012:1212`)

| Component | Node | Variants and properties | Drawn | Code today | Uses |
|---|---|---|---|---|---|
| Card | `2215:141` | State Default, Loading. Title, description, action | 360 wide | `Containers.tsx` `Card` | 0 |
| Dialog | `2215:203` | Kind Default, Destructive | 480 wide | `Containers.tsx` `Modal`, `ModalPanel`, `ConfirmDialog.tsx` | 6 in 4, 0, 4 in 2 |
| Metric | `2215:223` | State Default, Loading. Label, value, caption | 240 by 145 | `Containers.tsx` `Metric`, `Stat` | 4 in 1, 14 in 3 |
| Table Row | `2215:270` | State Default, Hover, Loading. Focus | 52 tall | None | New |
| Progress Bar, Progress Steps | `2215:272`, `2221:1105` | Steps 1, 2, 3 | Bar 4 tall | `Containers.tsx` `Progress`, `ProgressBar` | 2 in 2, 4 in 4 |
| Skeleton | `2215:286` | Shape Line, Block, Circle | 12, 96, 36 | `components/Skeleton.tsx` | 8 files |
| Alert | `2215:302` | Tone Neutral, Error, Warning | 64 and 84 tall | None. `ErrorState.tsx` is the nearest | New |
| Empty State | `2215:304` | Title, body, one action | 384 wide | None. `.sp-emptystate` is CSS in four files | New |

**Not in this phase.** These live in `primitives/` and are Product components (`PROMPT.md` section 6.2). They keep working, and their rules may keep reading bridged names until their own phase: `PlatformLogo` and `PlatformChip` (see section 7), `ResultCard`, `LookTile` and `PreviewOverlay` (Phase 5), `SettingsCard` (Phase 8), `OptionTile` (Phase 9). The Sidebar (`2218:679`) is on the Patterns page and belongs to Phase 3.

## 7. Open questions for the recon gate

Propose an answer to each from the frames, and wait for CJ.

1. **Platform Chip.** `BRIDGE.md` says platform chips are rebuilt in Phase 2. The component (`53:96`) is on the Product components page, and it hugs its label where today it holds 152 wide, which changes the Brand Templates filter bar that Phase 4 lays out. Recommended: leave it to Phase 4 and keep its bridge lines.
2. **The 40 tall button and field.** `md` buttons and default inputs are 40 today, between Medium (36) and Large (44). Recommended: 36 everywhere except the sign-in and onboarding forms, which the file draws at 44. Confirm from the frames per call site.
3. **`Stat`.** `Stat` has 14 uses in 3 files and is not on the Components page. Say whether it is the Metric at another size or a Settings row that Phase 8 owns.
4. **`Chip` and `ChoiceChip`.** One component or two.
5. **The variation words.** `LookTile` is not rebuilt here, so the word "look" in code names stays until Phase 5 (judgement call 5).

## 8. Out of scope

- The app frame, the sidebar, where the Page Header sits and which pages use it. Phase 3.
- Any page's layout, grid or gap, including shadow room on rails and grids. Phases 3 to 9.
- Moving hand-built tables, alert blocks, empty states or hand-rolled dialogs onto the new components. Each screen's phase.
- The Product components in section 6's last paragraph.
- The builder. `.sp-btn`, `.sp-input`, `.sp-icon-btn`, `.sp-seg`, `.sp-chip`, `.sp-tabstrip`, `InspectorSelect.tsx`, `TemplateSearchField.tsx`, the inline edit and the numeric field are Phases 6a and 6b. The two focus items Phase 1 left there (a 1 px border in place of the ring on the inline edit and the builder search, and the tab strip's cut ring) stay with them.
- The logo, the favicon and the art. Phases 3, 7 and 9.
- Copy. No string changes, except that a renamed component's accessible name stays what it was.
- Lint rules against raw colors and inline type. Phase 10.

## 9. Expected changes

What the screenshot comparison should show, and nothing else.

**Heights.** Buttons at the old 40 become 36 or 44. Inputs go from 40 to 36 or 44, and from 32 to 28. Large selects go from 40 to 36 or 44. Icon buttons go from 32 to 28 or 36. Menu items go from 34 to 36. Segments go from 32 to 28 in a 36 track. The Stepper goes from 28 to 36. Badges and tags become 24, and chips 28. A row or a card that hugs one of these moves with it.

**Text in controls.** Labels trim to cap height, so a label sits where the file puts it. Small buttons, icons and other marks at 14 become 16.

**Hover and pressed.** A flat color from the action's own tokens, where a tint lay over the fill.

**Disabled.** `--action-disabled` under `--text-disabled`, where the control dimmed.

**Focus.** Every ring on a rebuilt component is 2 px out. The tight rings on chips, segments, tabs, nav items and menu items move out with them.

**Error.** Destructive buttons are `--action-danger` under white. Error text takes `--feedback-error-text`: `#D0121C` in Light, `#FF9594` in Dark.

**Selected.** Nav items, menu items and ghost icon buttons use `--state-selected`. A switch that is on uses `--control-on`. An off switch has a `--border-control` edge.

**Corners.** Segments are `--radius-xs`. Upload and Alert are `--radius-md`. Ghost icon buttons become round.

**Shapes.** Tabs become text on a hairline (Insights). Attach loses its inverse fill. The Stepper becomes a capsule on `--surface-field`.

**Unchanged.** Every page frame and gap, the builder, the Product components listed in section 6, every graphic and every export.
