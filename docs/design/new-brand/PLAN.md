# New brand: the plan

The Figma file "Master UX UI New Brand (Copy)" (`1dYWgFH2V8i9Jez2ylI3ky`) is the design system and the screens the platform moves onto: a new palette, 193 variables in three collections, 20 text styles, 40 shared components and every area redrawn in Light and Dark. This folder carries it into the code in phases, one pull request each, merged to `main` as each passes its gate.

- `PROMPT.md` is the program brief as CJ wrote it. It holds the token tables, the component tables and the node ids.
- `PLAN.md` (this file) is the program: decisions, what Phase 0 found, phases and the screen map.
- `RULES.md` holds the rules every phase follows.
- `BRIDGE.md` maps every older token name and text class to the new ones while screens move.
- `PHASE-1.md`, `PHASE-2.md` and `PHASE-3.md` are the prompts for Phases 1 to 3. From Phase 4 on, at CJ's request (2026-11-16), a phase is built straight from this plan and its frames, with no prompt or recon gate. Its pull request lists the calls made where the frames leave room, for CJ to overturn.

It replaces the file "Master UX-UI" as the source of truth. It does not replace `docs/design/new-look/`: that program built the structure this one restyles, and its decisions stand unless one below changes them.

Phase 0 was written against `main` at `0febeba` on 2026-11-14, and its counts were re-run at `ab8a9f5` after pull request #182 merged the same day.

## Decisions (CJ)

Settled. Phase prompts build them and do not re-ask.

1. **The new file is the source of truth** for tokens, components and screens. Tokens keep Figma's names.
2. **New brand palette.** Slime is `#2BFFA3` and Deep Moss is `#123D34`.
3. **Primary buttons are Slime with a primary black label in both themes** (`--action-primary` under `--action-on-primary`).
4. **Destructive buttons are `#FA3030` with a white label in both themes** (`--action-danger` under `--action-on-danger`).
5. **Focus is a 2 px ring, 2 px outside the element, on every interactive control**, text fields included.
6. **Disabled controls take their own colors** (`--action-disabled` under `--text-disabled`). No opacity.
7. **A dialog's close button sits in its top right corner.**
8. **"Looks" are called "variations"** in every string the interface shows.
9. **Brand Templates is form only.** A template opens straight to the fill form, then Download PNG, then Download again and Post to LinkedIn. Bulk fill and Public link are options on the fill page. No AI chat on that page.
10. **The Generate chat box** takes the platform from the plus menu, and its count control is a plus and minus in a gray capsule beside Send with no "variations" word. "Chat box options" (`2345:2827`) is not built.
11. **The Generate result is one card with sizes as tabs.**
12. **Light and Dark everywhere** except the two flows in decision 16.
13. **Lists and cards load as skeletons.**
14. **Terms of Service and Privacy Policy links sit at the bottom of every page.**
15. **No helper copy.**
16. **Sign in and Create account are Light only.**
17. **A shadow is never cut off.**

Still true from the earlier program: phases go straight to `main` as one pull request each, the app stays multi-tenant, and the frames show sample content that is never seeded into an account.

Three of these overturn things the earlier program settled, and the new file wins: the earlier error reds (`#D43535`, `#EC5656`), the 1 px ring with caret-only fields, and the earlier plan's amended decision 7, which kept the step form on the fill page, 48 by 152 platform chips and shelves that fit exactly three cards.

## Judgement calls

Decided on best judgement at CJ's request. Built as written unless he overturns one.

1. **The template chat is hidden, not deleted.** The fill page no longer links to it and `/templates/:id/chat` redirects to `/templates/:id`. `generate/TemplateChatPage.tsx` and its logic stay in place, unrestyled, until the cleanup phase.
2. **Template Builder gets Dark without frames**, through the tokens. The artboard is never themed. Dark is reviewed by screenshot at the gate.
3. **Both search components stay.** Search Field (`50:62`) goes in the gallery filter bars. Search (`2207:455`) goes where search is the main control of a panel or picker.
4. **The template card keeps stepping through its variations** on hover and keyboard focus.
5. **"Variations" reaches the code as components are rebuilt.** Data types and columns keep their names.
6. **Every page uses one header row**, 36 tall, 16 below the top of Main.

Phase 0 added four of its own, in the same spirit. CJ confirmed all four at the gate (2026-11-14), so they are settled.

7. **Existing text keeps its box until its screen is rebuilt.** The twenty text classes trim to cap height, as the file has them. Call sites that exist today move to an untrimmed twin (`.tu-*`) in Phase 1, and take the trimmed class when their phase rebuilds the layout around them (`BRIDGE.md` section 5). Turning trim on under 355 call sites at once would move every layout in the app in a token phase.
8. **Every template chat address redirects, threads included.** `/templates/:id/chat/:threadId` goes to `/templates/:id` like the bare address. A saved template chat in Generate History opens its template's fill page.
9. **What the code already builds from the three proposal sections stays.** Depth, icons and crop are in the builder today, built by `docs/brand-system/` Phases 1 to 4 and merged. Phase 6 keeps them working on the new components and draws them from the tokens and the Effect Row component (`392:8266`). It builds nothing further from the proposal frames.
10. **Bulk fill follows without frames.** It is not drawn in the new file. It is on the primitives since #182, takes the shell and the header row, and keeps its layout.

## What Phase 0 found

### The earlier program is one phase short

New look Phases 1 to 8b are merged (#152 to #169). Its Phase 9, cleanup, got as far as step 4 of eleven. Those four steps merged as #182 on 2026-11-14 (CJ's call at the Phase 0 gate): the prompt and inventory, dead code (about 500 lines of `socialpaint.css`), the shared pieces on the primitives (`ConfirmDialog` on `Modal`, `src/app/components/ui/` deleted) and bulk fill and `AdminTemplates.tsx` on the primitives. Steps 5 to 11 were never built, because step 5 was waiting on token requests to the earlier Figma file.

What that phase still owes after #182, and where this program picks each up:

| Owed | Here |
|---|---|
| Delete `legacy-bridge.css` and the dead tokens | Done in ElevenLabs Phase E9 |
| Delete the earlier control classes. Still read after Phase 6b, all in `builder/` apart from one `.sp-tabstrip` in `ImageSourceChooser.tsx`: `.sp-btn` in 3 files (`BackgroundReflowDialog`, `CanvasSizePicker`, `ShortcutsPanel`), `.sp-input` in 2 (`FillPicker`, `IconPicker`), `.sp-icon-btn` in 1 (`CanvasSizePicker`), `.sp-seg` in 1 (`FillPicker`), `.sp-tabstrip` in 3 (`FillPicker`, `CanvasSizePicker`, `ImageSourceChooser`). These are the popovers and dialogs the editor's frames do not draw. The `.sp-chat-*` control set and `.sp-chip` are gone | Still open after ElevenLabs Phase E9 |
| Drop the unread `company_canvas_presets` table and the unread `brand_kits` font columns (migrations 0046 and 0047 are promised to them) | Left out of ElevenLabs Phase E9 by CJ (2026-11-23) |
| Remove the never-imported packages | Done in ElevenLabs Phase E9 (43 packages) |
| Lint rules against raw colors and inline type. There is no automated check today: the rule is prose in `CLAUDE.md` and a line in the phase reviewer's checklist | Done in ElevenLabs Phase E9 (no-restricted-syntax, with a ratchet list) |
| A contrast and keyboard pass, `ARCHITECTURE.md`, the stylesheet header | ARCHITECTURE.md and the header done in ElevenLabs Phase E9; the contrast and keyboard pass done in its follow-up (`shots.mjs a11y`) |

`docs/brand-system/` Phase 6 is gated on "new-look Phase 9 merged". That phase will not finish as written, so CJ decides whether #182 satisfies the gate or Track B waits for this program's Phase 7, which rebuilds the same Brand Studio screens.

### Tokens

- The prompt's token tables match the file. Every Light value in section 4.3 was read back from the Color board (`4012:1197`).
- The pipeline needs more than new collection names. The exporter reads four collections and has no path for string values, the generator has role-named radius and spacing groups and a family map built for the old styles, and the file may still hold the earlier collections and its 46 text styles beside the new ones (its Docs page says the old ones are retired "on approval"). `PHASE-1.md` has the exporter pick the three collections and the twenty styles by name.
- Ten rows of the prompt's old-to-new map are wrong or incomplete once read against the code. `BRIDGE.md` section 1 lists them. The two that matter most: four new token names are already declared by `socialpaint.css` with different meanings, and same-named text classes are a size apart (`.t-body-s` is 14 today and 13 in the new file).
- Every `var()` read was counted. The heaviest earlier names: `--text-secondary` 201 reads, `--space-2xs` 167, `--space-sm` 119, `--text-strong` 112, `--radius-control` 94, `--text-muted` 89.

### Trim

`text-box: trim-both cap alphabetic` is applied by all three engines the fidelity harness pins: Chromium 153, Firefox 155 and WebKit 26.6 each measure a 14 on 20 label at 10 tall. Support starts at Chrome 133 and Safari 18.2. The app declares no browser list.

Without the property a label is its full line height, so a Label/M box is 20 tall, not 10. A control with a fixed height and a centered label looks the same either way. A control sized by padding around its label grows by the difference, 10 on a Medium button. `RULES.md` section 4 therefore makes every control take its height from `--size-control-*`, and no fallback stylesheet is planned.

### Components

Section 6's "code today" column is mostly right. What is wrong or missing:

| Component | Finding |
|---|---|
| Search (`2207:455`, always open) | No component plays this role. `primitives/SearchField.tsx` is the collapsing Search Field (`50:62`), wrapped by `templates/LibrarySearch.tsx`. `templates/TemplateSearchField.tsx` is a separate older implementation used by the builder list and the size gallery |
| Icon Button | Five components fold into one: `IconButton`, `RowMenuTrigger`, `ThemeToggle`, `StepperButton`, `AttachButton`. All are 32 or 28 today and none is 36. The fold has to keep three behaviors as props, not variants: the theme toggle's glyph swap by nearest `[data-theme]`, the stepper button staying focusable while disabled, and the row menu trigger holding Selected while its menu is open. Attach's inverse fill goes |
| Select | `Select` and `CompactSelect` already share `SelectBase`, so the fold is a size prop (28, 36, 44). `Filter` is a button that opens a `Menu`, used once (`admin/insights/FilterMenu.tsx`), and becomes a Select there. The older select, `builder/InspectorSelect.tsx`, stays for the font pickers: Phase 6b put it on the primitive's trigger, floating menu and rows, and kept the search and the rows in their own face, which the primitive does not carry |
| Tabs | Today a pill on a track. The new Tabs (`4015:673`) is text on a hairline with an underline. One call site (`admin/insights/TrendCard.tsx`). The file's Docs page still says Tabs became Segmented Control, but the component is on the Navigation board, so it is built |
| Tooltip | `Overlays.tsx` `Tooltip` is the chart tooltip only. The hint on controls is `components/Tooltip.tsx`, on Radix with `.sp-tooltip`. One component now covers both, with the value optional |
| Switch | A second, older `components/Switch.tsx` is still used in the builder |
| Card | `Containers.tsx` `Card` has no call site outside `/dev/ui`. Real cards are `.sp-in-card` (Insights) and `.sp-card` |
| Metric | `Metric` is a bare stack with one caller. The Insights KPI is `admin/insights/InsightKpi.tsx` |
| Checkbox, Radio, Table Row, Alert, Empty State | No shared component. Two native checkboxes, three hand-built tables, about twenty per-area alert blocks, `.sp-emptystate` as CSS in four files, and `ErrorState.tsx` (15 callers) for load failures |
| Dialog | `Modal` has two callers. About ten dialogs are hand-rolled, most of them in the builder. `ConfirmDialog.tsx` is on `Modal` since #182 |
| Skeleton | Three vocabularies: `Skeleton.tsx`, `.sp-bs-bone`, `.sp-st-bone` |
| Brand Studio cards and rows | `admin/brand/primitives/` holds only `AddSlot` and `useInPlaceEdit`. The cards and rows are local to `BrandOverview.tsx` and each `*Detail.tsx` |
| Builder rows and tiles, Member Row, Link Row, Builder Template Card | Inline JSX today, not components |
| Size Cover | 11 files in `src/assets/sizes/`. The file draws 12, the twelfth being the fallback |
| Composer | Entirely under `chat/` |
| Variation Tile | `LookTile` in `Previews.tsx`. There is no `LookPicker` |

"Look" appears in 26 interface strings across 12 files, and in component, class and prop names across about 20. The strings change as each screen's phase reaches them (decision 8). The names follow judgement call 5.

Icons: 158 direct lucide uses. 62 are at a retired size (10, 14, 15 or 20) and another 47 at 11, 12 or 13. Most are in the builder.

### The app frame

| Part | Target | Today |
|---|---|---|
| Viewport | 12 on all sides, 12 between sidebar and Main | No viewport padding. The sidebar wrapper carries a 10 inset |
| Sidebar | 320, 76 collapsed | 325 in a 335 wrapper, 76 in 86 |
| Main | 16 top and bottom, 32 gutters | `.sp-page`: 45 top (48 below 1280), 45 gutters, 64 bottom, capped at 1720 |
| Header | One row 36 tall on every page | The shared header is 36 tall but sits 45 down. Four pages do not use it: Generate start (its own greeting), History (two hand-built rows), the builder editor (its own 52 bar) and the public link page |
| Scroll | Content scrolls inside Main, header and footer stay | The document scrolls. Only the Generate thread, History and the builder take over the viewport |
| Bottom fade | 80 on every scrolling area | Only Generate's, at 56, 68 and 132 |
| Footer Links | One slot at the bottom of Main | Six pages render `LegalLinks`, three more carry their own copy of the markup, and Insights, the builder and bulk fill have none |

This is the largest structural change outside the fill page and the builder, and it belongs to Phase 3. Below desktop width the document keeps scrolling, as today.

### Screens

Restyle means tokens and primitives carry the change. Behavior means layout, flow or component structure changes.

| Area | Restyle | Behavior |
|---|---|---|
| Brand Templates library | Chips and search 48 to 50, the fade widths, 17 to 16 gaps, header heights | Cards become a fixed 302 with the next one cut off, where today exactly three fit. Platform chips hug their label (about 106 wide) where today they hold 152. Shadow room on the rails and grids. The pinned filter bar inside a Main that scrolls |
| Fill page | The breadcrumb header, buttons, the preview card | The whole form. Today `TemplateFill.tsx` is a step rail, one field per step with Back and Next, and a finish step, in a 5 to 7 grid with the form on the left. The frames draw the preview filling on the left and one Details panel 380 wide on the right: Variation as a Segmented Control, every field, Caption, Download PNG pinned to the bottom. "Use AI to assist" goes. `details/DetailsPanel.tsx` is already that panel, used today only by the chats' Edit details, so the fill page moves onto it and `TemplateFill` keeps the download, required-field and LinkedIn logic. Required fields show their error in place, since there is no step to jump to. The public link page shares the form and inherits all of it |
| Generate | 760 to 720, chat box padding, bubble 472 to 440, card padding 8 to 12 | The Result Card. Today each draft is its own card sized to its artwork, in a wrapping row. The frames draw one full-width card with the sizes as tabs, the caption once, Copy caption and Download both inside it. In the chat box the platform select moves into the plus menu and the Stepper loses its label. History moves onto the shared header |
| Template Builder | Almost nothing | A rebuild. No file in `builder/` or `AdminTemplates.tsx` uses a `ui-*` class, and the builder has no stylesheet of its own: about 500 lines in `socialpaint.css` and 230 inline style objects. The list gets a row menu and a new filter bar. The editor's flush, hairline regions become cards 12 apart with a 44 top bar. See the open items below |
| Brand Studio | Nearly all of it | Only the app frame |
| Insights | All of it: 28 to 24 gaps, 304 to 315, paddings | Only the app frame |
| Settings | All of it. Rail 200, 32 gap and 24 between cards already match | Only the app frame |
| Sign in and Create account | All of it. The 400 and 480 columns and the 688 panel already match | None found |

Loading: most lists already show skeletons. The gaps are the public fill page (a line of text), the builder's dialogs and publish step (spinners), and Settings' Workspace and Advanced sections (nothing).

Open items for the builder, to settle at Phase 6's recon gate from the frames: where the Caption, Details and Name steps go now that the top bar has no step bar; whether the rails stay resizable and collapsible (the frames draw them fixed at 260 and 320); the two import links under the canvas; how the template is renamed from a breadcrumb; and the theme toggle, which the collapsed sidebar does not show today.

### The old palette outside `tokens.css`

| Where | What | Phase |
|---|---|---|
| `src/styles/socialpaint.css` | The only stylesheet with color literals: about 90 lines of them, all chrome. They include a second purple (`--purple-kara: #9F60FF`), a second red (`--fill-danger`), and `--slime` read 23 times | 1 for the names that collide, then per area |
| `src/assets/socialpaint/mark.svg`, `logo-on-light.svg`, `logo-on-dark.svg`, `favicon.svg` | Old Slime `#17FF7E` | 3 |
| `src/assets/socialpaint/auth-panel.webp` | The sign-in art, in the old greens | 9 |
| `src/assets/socialpaint/brand-studio-cover-*.webp` (6) | The covers. The Colors cover has "#17FF7E" drawn into it | 7 |
| `src/assets/sizes/*.svg` (11) | Neutrals follow `--cover-*`. Accents are baked per family (cyan, green, pink) and are not token values | 6a replaced them with the file's twelve covers as WebP |
| `admin/brand/ColorsDetail.tsx:204` | An error message that names `#17FF7E` as its example | 7 |
| Hex in chrome TSX | `builder/FieldOverlayEditor.tsx`, `builder/VariantFilmstrip.tsx`, `ColorControl.tsx`, `FieldInput.tsx` | 6 |
| `design/tokens/figma-export/ui.html` | The plugin's panel | 1 |

Not chrome, and not touched: the platform brand marks in `platformIcons.tsx`, graphic defaults in the renderer and the builder, `src/lib` starters and neutrals, the screenshot fixture (it carries a neutral sample palette, no SocialPaint color), the fidelity fixtures and their baselines, and tests that use old Slime as sample data.

### Clipping containers

The list `RULES.md` section 4's shadow rule gets applied to. The edge fades today are overlay gradients painted in the page color, not masks.

Scroll containers that hold raised children:

| Container | Scrolls | Holds | Room today | Phase |
|---|---|---|---|---|
| `.sp-lib-shelf__track` (`brand-templates.css:69`) | x | Template cards | 4 sides, 16 below | 4 |
| ~~`.sp-railfade__track`~~ (`socialpaint.css:2909`, `templates/GroupChips.tsx`) | x | The older platform chips | Removed in 6a with its last readers | 6a |
| `.sp-chat-thread` (`socialpaint.css`) | y | The Result Card | Done in 5. The page gutter at the sides (12 beside the inline editor) and 12 below, which holds Elevation/1. None on top, where the first row is always the member's message |
| `.sp-chat-history-scroll` (`socialpaint.css`) | y | History cards | Done in 5. 24 top, the gutter at the sides, and 24 below in the list's foot (`.sp-chat-history-end`) |
| ~~The builder's source-pick region~~ (`TemplateBuilder.tsx:3198`, inline) | y | Start cards | Removed in 6a: a template starts in dialogs on the list, inside `.ui-modal`'s 24 | 6a |
| `.ui-modal` (`primitives.css`) | y, when tall | Option tiles and cards inside a dialog | 24, which is the room (Phase 2 kept the Dialog's 24 of padding on every side) | Done in 2 |

Containers that clip without scrolling:

| Container | Holds | Phase |
|---|---|---|
| ~~`html[data-sp-fullscreen]`, `.sp-appshell` and `main` (`socialpaint.css:1675`)~~ | The Generate thread and History columns, which ran flush to Main's edges | Done in 3. At desktop width the app frame holds every page: Main does not clip, and the content keeps its 32 gutters as padding, so a card's shadow has room. The full-viewport rules apply below 1024 only |
| `.sp-builder`, `__rail`, `__canvas`, `__tools` (`socialpaint.css:1701` to `1778`) | Nothing raised today: the builder draws hairlines, never shadows. The frames turn its rails into raised cards, so every one of these changes | 6 |
| `.sp-auth__panel` (`auth.css:74`) | The floating card over the art, 24 from the edge against a shadow that reaches further. The clip also crops the art | 9 |

Scroll containers with no raised children keep their 4 of focus-ring room, which a 2 px ring 2 px out exactly fills: the sidebar nav, the chip rail on Brand Templates, the Details panel's fields, the composer's tag list, menus, the Sharing table and the builder rail body. About 50 other rules clip only their own content (an image crop, a truncated line) and are fine.

## What Phase 2 found

Phase 2 rebuilt the primitives against the Components page. Where the file and the prompt disagreed the file won. These are the points a later phase needs.

### The file against the prompt and the rules

- **Icon Button.** Only the Filled style is round. Ghost is `--radius-sm`. Placed instances are Ghost Small (28) in the sidebar header, the account row, row menus, the Dialog's close and the Edit panel's close, Ghost Medium for the collapsed sidebar's Expand, and Filled Medium for the template card's arrow and the composer's attach. The file's sidebar has no theme toggle.
- **Switch, Checkbox and Radio.** An off switch is a track filled with `--border-control`. All three hover with a halo, and on a checkbox and a radio the halo lies over the box and under the mark.
- **Edges.** Neutral buttons, Filled icon buttons and Chips carry a `--border-strong` hairline. Card, Metric, Menu, Dialog and Toast carry `--border-raised`, and the Tooltip `--border-subtle`. Input and Select gain a `--border-strong` hairline on hover. The Outline Tag's edge is dashed.
- **Two edges the code keeps where the file drops them.** A disabled Neutral button, Filled icon button or Chip keeps its hairline at no color, so it does not change width when it disables (the file's are 2 narrower). An Avatar carries a `--border-subtle` hairline: the component draws it at weight 0, and every screen that places one draws it at 1.
- **Menu.** Items are Body/M and the menu's label is Mono/Eyebrow. A keyboard-focused item shows the ring.
- **Chip.** One component. Selected is `--surface-inverse` under `--text-inverse`.
- **Tabs.** Text on a hairline, 20 apart, sharing the width of their row with centered labels. The selected tab's underline is `--text-primary`. The Insights trend card is a Segmented Control with series dots in its frame, so Tabs has no call site until the builder's inspector (Phase 6b).
- **Stepper.** A capsule on `--surface-field` around two Ghost Small buttons, with no word beside it. The label is its accessible name. `PLAN.md` had this under Phase 5; it landed with the component.
- **Dialog.** 480 wide as a component, with Medium actions. The file also places dialogs at 520 (public links, with an icon and a Title/Card title), 560 (the Themes board) and 1040 (Choose a size). `Modal` takes `wide` (560, the width from before this phase) for the three dialogs that hold a form or a picker.
- **Metric.** The Components page's Metric is the Insights card. Settings' monthly figures are plain stats inside a settings card in their frame, so they are `Stat` at Large and wait for Phase 8.
- **Text in form controls.** An input and a text area take no trimmed class (`RULES.md` section 5).
- **Off a token in the file.** The Dialog's destructive confirm label is bound to `control/on-mark` (built as `--action-on-danger`), Upload's filled thumbnail has a raw 6 radius (built as `--radius-xs`), and the Search Field (`50:62`) keeps raw paddings, a 20 glyph and a hover laid over its fill.

### Built and waiting for a screen

`Tabs`, `Checkbox`, `Radio`, `Search`, `Table` with `TableRow` and `TableCell`, `Alert`, `EmptyState`, `Card`, `Metric`, `Breadcrumb`, `PageHeader` and `FooterLinks` have no call site outside `/dev/ui`. Each screen's phase moves its own markup onto them.

| For | What |
|---|---|
| Phase 3 | Pages still use `layout/Page.tsx`, `layout/Breadcrumb.tsx` and `generate/LegalLinks.tsx`. The primitives `PageHeader`, `Breadcrumb` and `FooterLinks` are their replacements |
| Phase 4 | The Platform chip and its bridge lines. The public links dialog's own header and its 520 width. The bulk fill page's native checkbox. The fill page's text areas already grow with their text, as the primitive now does |
| Phase 5 | `ResultCard`, `LookTile`, `PreviewOverlay`, the composer and the message bubbles, with the word "look" in code names. Generate's progress is now a bar a step, 240 wide |
| Phase 10 | The builder's hand-rolled dialogs (`BackgroundReflowDialog`, the shortcuts panel) and the size and fill popovers (`CanvasSizePicker`, `FillPicker`), which the editor's frames do not draw. Most readers of `--danger-wash` and `--accent-wash`. Phases 6a and 6b moved the skeletons onto `Skeleton` and the gradient's checkbox onto Add |
| Phase 8 | `SettingsCard`, `Stat` and the list skeleton's row geometry (`SkeletonRows`). The Insights KPI cards onto `Metric`, and the three hand-built tables onto `Table` |
| Phase 9 | `OptionTile` and the onboarding pieces |
| Any screen with a load failure | `ErrorState` reads the Alert's Error tone but keeps its own centered layout. Its 21 uses move onto `Alert` with their screens |

### The component sheet

`/dev/ui` draws the eight boards from `src/app/dev/boards.json`, which is data read from the file: every set's variants at the file's coordinates. `npm run shots -- boards <dir>` saves each board as an image, and `compare-image` sets it against its export in `docs/design/new-brand/reference/`. What is left in those comparisons is glyph antialiasing, label widths (the file rounds a text box to whole pixels), the phase of the dashed boxes and shadow blur. The Themes board is shorter than the file's because it leaves out the Composer and the help text on its first Field.

## What Phase 3 found

Phase 3 built the app frame and moved every page into it. These are the points a later phase needs.

### CJ's answers at the gate (2026-11-15)

- The theme toggle stays beside Collapse in the open sidebar and in the mobile bar, though the file draws none. The collapsed rail shows Expand alone.
- The collapsed rail's avatar is the Settings button, and its mark is gone, as drawn.
- The lockup and the mark are one colour from the theme, as every frame draws them. The favicon keeps its tile, the mark on the new Slime.
  - Changed 2026-11-16: the lockup is CJ's two files, the gradient mark with its grain beside a light wordmark for Dark (`src/assets/socialpaint/logo-on-dark.svg`) and a dark one for Light (`logo-on-light.svg`). The favicon is that gradient mark on its own, cut from `logo-on-light.svg` (CJ, 2026-11-16), in place of the tile. The mark alone in Generate's byline and the public link page's footer stays flat, one colour from the theme as above (CJ, 2026-11-17).
- The content has no width cap.
- My calls, left standing: the content returns to the top when the route's path changes (a filter in the address keeps the scroll), and the builder editor has no footer links, as its frames draw.

### Built and how it works

- `layout/Page.tsx` is Main. A page passes its `PageHeader` as `header` and picks a kind: "scroll" (the content scrolls in the frame under an 80 fade), "self" (the Generate thread and History, which scroll their own region) or "bare" (the builder editor). Footer Links are on by default; the fill page turns them off and sets its own under the stage, since the public link page renders the same form outside the frame.
- The content is `.sp-page` plus the page's own class, so a page's rules still match. At desktop width Main's rules win over a page's own outer padding and minimum height (three classes), and the content is positioned, so an absolute child scrolls and clips with it.
- On a scrolling page the content's own 24 of bottom padding is the gap above the footer links, so the fade ends on them; a page that scrolls its own region takes the 24 as a margin.
- Below 1024 the header row's actions take a line of their own when they don't fit, and wrap among themselves. The footer links carry the home-indicator inset, so a page's bottom padding drops it inside the frame (`--frame-inset-bottom`).
- `layout/useFrameKeys.ts` sends Page Up and Down, Home, End and the arrows from the page itself or the sidebar to the content (Space from the page itself only). It leaves a key to a region that scrolls on its own: the sidebar's nav on a short window, or, with nothing focused, a list inside the content that was clicked last.
- `--page-pad`, `--chrome-top` and `--page-max` are the shell's own measures, defined in `shell.css`.
- `npm run shots -- capture` grows the window by the content's hidden height before each shot, holding any size written in vh units inside the content at its first value, and `--collapsed` starts every route with the sidebar collapsed.

### Left for each phase

| For | What |
|---|---|
| Phase 4 | Brand Templates' filter bar pins to the content's top edge (its offset gives back the content's 24 of top padding), and its `data-pinned` shade switches when the sentinel leaves the scroller; the frame draws a scroll region below a still filter bar. The fill page's art cap reads `100vh - 240px`, set for the earlier header, and bulk fill's preview caps at `100vh - 180px`. At 390 the fill page's three header actions wrap onto two lines (they ran 24 past the window before). The public link page keeps `.sp-page`, `--page-max` and `--page-pad` outside the frame. Bulk fill's back link sits under its header row |
| Phase 5 | The thread's header sits right on the thread (the content takes no top padding there, a rule now with the Generate rules in `socialpaint.css`) where the file draws 24. History's title row, its primary New chat and its filters stay in the content; the file puts New chat in the top bar as Neutral. History's fade is 120 in the file and the result draws a top fade. Generate's thread and History reach into the gutters by `--page-pad`, which the frame sets to 32. Below 1024 Start fills what the frame leaves above the footer links instead of keeping a window-tall minimum |
| Phase 6b | Done: the editor fills Main beside the 76 rail, and its bar is 44, as drawn |
| Phases 7 and 8 | Brand Studio's and Settings' toasts ride the content's foot 32 above the links, as drawn (sticky measures from inside the content's 24 of bottom padding, so their offset is 8). Their columns no longer pin anything |
| Phase 9 | Two sources for the legal pages: `src/lib/legalLinks.ts` holds the live addresses the app's links use, and `src/lib/legal.ts` holds placeholders (`#terms`, `#privacy`) that sign in, the sign-up consent line and onboarding read. The pre-app shell reads `--page-pad` |

## What Phase 4 found

Phase 4 moved Brand Templates onto its frames: the library, the fill page, the public link page's form, the public links dialog and bulk fill, with the template chat hidden. It was built from this plan and the frames directly. Its pull request lists the calls made along the way.

### Built and how it works

- **The template chat is hidden.** `urlToRoute` reads every `/templates/:id/chat` address as the fill page, and the router's canonical replace fixes the address bar. History and a Generate address open a saved template chat's fill page. `TemplateChatPage` and the `templateChat` route stay, unreached, for the cleanup phase.
- **The Platform chip** (`53:96`) is the frame's 50 pill: raised at rest, inverse when selected. History's filter bar uses the same chip and the same round search, so it changed too.
- **Shelves** are rails of fixed 302 cards with a 96 fade; the chips' rail fades over 72. Each rail keeps 12 inside its scroller for the cards' shadow and the focus ring, and steps back by as much.
- **The fill page** (`TemplateFill.tsx`, shared with the public link page) is the stage and the Details panel. In the app frame it is `kind="self"`: the split fills Main, the stage takes the height left above Terms and Privacy, and the graphic fits the stage either way through container query units. On the public link page the graphic stops at the window's height less 192.
- **Download PNG** is `aria-disabled` until the required fields have values, and stays clickable: pressed early, it marks them and focuses the first (`focusFirstInvalid`).
- **The Details panel** is one component. Its new measures (20 apart and in, fields 16 apart, `radius/xl`, Elevation/1, a trimmed title, "Variation") reach Generate's editor too.
- **The Modal** takes an optional panel class, and a dialog with an icon titles itself in Title/Card: the public links dialog at 520.

### Left for each phase

| For | What |
|---|---|
| Phase 5 | Generate's editor already wears the Details panel's new measures; check them against `13:3150`. History's filter bar wears the new Platform chip and round search. |
| Phase 9 or cleanup | `generate/TemplateChatPage.tsx`, the `templateChat` route and the code inside `GeneratePage.tsx` that serves only a template chat. Bulk fill keeps its layout, its preview capped at `100vh - 180px`, and its inline styles; it has no frames. |

## What Phase 5 found

Phase 5 moved Generate onto its frames: Start, the chat box and its plus menu, the thread with its Result Card, the editor beside it, and History. It was built from this plan and the frames directly. Its pull request lists the calls made along the way.

### Built and how it works

- **The chat box** (`chat/ChatComposer.tsx`) is the attachments, the text, the Details row and the controls row, 24 apart. The text area sets Body/L from its variables and gives the half-leading back in its margins, so the box is 110 tall as drawn. Its focus rings the whole box, as a field's does.
- **Platform is in the plus menu** (`chat/AttachMenu.tsx`, Output). It opens a list of every platform in the menu's place. A platform picked for the next message is a tag at the head of the Details row, which opens the list again; its x takes the pick back. A message asks for one platform: the server makes one canvas a run (`canvasForPlatform` in `template-generate`), so the two platforms the Details added frame draws need an Edge Function change.
- **The thread's chat box has the stepper too.** Left alone, the platform and the count are the last composer send's (`lastComposerTurn`), which a message reuses as before (`fillSendGaps`); the menu's Platform row and the stepper show them, with no tag (the Result frame's chat box has none). A change applies to the next message only.
- **One Result Card a turn** (`primitives/Previews.tsx`): the switch between the turn's drafts, named as the editor names them (`linkedFields`' `sizeNames`), the stage fitted in CSS, the caption, Copy caption and the card's Download, which exports every draft through the one export path, one at a time, or opens the editor on the first gap (`turnDownloadPlan`). Its Loading state shows while the turn builds. The card and the editor always show the same draft, and the card stays on the one the editor last showed.
- **One Primary a view.** The latest finished turn's card leads with its Download while the editor is closed; every other card's Download is Neutral, and the editor's Download PNG leads while it is open.
- **The fades and the focus line agree.** Each chat scroller sets its fade heights (`--chat-fade-top`, `--chat-fade-bottom`: Generate's thread 68 at the top, History 120 at the foot), which the fade and the scroller's `scroll-padding` both read, so a control focus scrolls into view stops clear of the fade.
- **The editor beside the thread** takes the frame's split: the chat column fills, and the 380 panel sits 24 to its right and runs to Main's foot. While it is open the legal links sit under the chat column (`Page`'s footer is off).
- **The thread's top fade stays 68.** The Result frame washes the whole thread from the top (`2343:1521`, 770 tall), which would put the card's switch, Edit and Download under 4.5:1.
- **Recent and History's cards** keep Elevation/1 on hover, as the library's cards do.

### Left for each phase

| For | What |
|---|---|
| Phase 7 | `PreviewOverlay`, which Brand Studio's covers, swatches and logo plates use, and the dead `ui-ring-none` class on Type styles' rename field |
| Cleanup | `LookTile`, the Looks card, the template chat's turn and its stage's Missing markers (`--gen-marker-*`, `--gen-h-tag`, the tight ring on the marker tag), which only the hidden template chat draws. The older `ErrorState` and empty-state markup that Phases 4 and 5 kept (Brand Templates, the fill page, History, a saved chat that can't open): moving them onto `Alert` and `EmptyState` needs an Alert that carries Try again |
| Not a screen | The plus menu's Web page, Past post and Connectors rows (`13:1601`, `13:1850`) have no backend, and two platforms in one message need `template-generate` to make a canvas for each |

## What Phase 6a found

Phase 6a moved the Template Builder's list and how a template starts onto their frames: the list with its filter bar and row menu, New template, Choose a size with the file's covers, Import from Figma, Auto build and its steps, and Import from Canva. It was built from this plan and the frames directly. Its pull request lists the calls made along the way.

### Built and how it works

- **The list** (`admin/AdminTemplates.tsx`, `admin/BuilderTemplateCard.tsx`) is the frame's grid of 242 cards: a square sunken well with the template fitted at its own ratio, then the name over its status Badge and usage line ("128 downloads", "Not used yet", "Edited 2 hours ago", from `builderMeta.ts`), and the row menu. The well is the Edit button. The filter bar pins under the header as the library's does. The card's inline rename, its AI-built label and its icon buttons are gone: the builder's Name step renames, and the row menu holds the rest.
- **A template starts on the list.** New template opens its four paths; Start blank opens Choose a size, and each import opens its own dialog. The result goes to the builder through `builder/startHandoff.ts`, held in the module because an import's result is too large for an address and means nothing after a reload, and the builder takes it as it opens: a blank canvas at the chosen size, or the import landed the way the editor lands its own. The builder's start screen, its hand-rolled size dialog and its default size are gone: a new template always arrives with its size. `/template-builder/new` with nothing handed over (a reload, an old link) goes back to the list with New template open.
- **Below 1024** New template goes straight to the builder, which says it needs a bigger screen, rather than through dialogs whose result it couldn't open.
- **Choose a size** (`builder/SizeGallery.tsx`) holds one height, three rows of covers (Social media's ten sizes, the most a category fills), so it doesn't jump between categories; the frame draws two rows of eight. The categories are Nav items in a radio group, the platforms are the library's chips without the chevron (`PlatformChip`'s `chevron`), and the search is the library's round one. Make another size opens it too, with the template's own size marked and not offered.
- **The covers** are the file's twelve Size Cover components exported at 1x as WebP, photographs on their own grounds and the same in both themes. A size without its own takes the fallback cover.
- **The import dialogs** are on the Modal at 520, with Fields, Cancel and the action. Cancel while an import or a build runs closes the dialog, and the result is dropped when it lands. Auto build's steps move on a timer and are named for what the engine does, in order ("Reading the design", "Choosing what to edit", "Writing labels and the caption"); the call reports nothing until it ends. Import from Canva runs the same build and shows the same steps. A workspace that hasn't connected Figma or Canva gets one line ("Your workspace hasn't connected Figma.") and Open settings, which takes the focus. A workspace whose plan has no Canva is offered no Canva, in New template or in Auto build. While a build runs, Cancel has the focus; a failure puts the error under the link and the focus on it.
- **The Modal** takes `titleStyle` (Title/Card without an icon, as the builder's dialogs draw it) and `returnFocus`, for a dialog whose opener is gone when it closes: the import dialogs after New template, and Choose a size and Delete after a row menu. `ConfirmDialog` passes it through.

### Left for each phase

| For | What |
|---|---|
| Phase 6b | Done: Import from Figma and Auto build are the rail's Import tiles, and the loading pulse is the Skeleton. `CanvasSizePicker` still serves the size popover, now on the overlay surface (Phase 10 for its insides) |
| Phase 9 | Onboarding's Option Tile (`primitives/OptionTile.tsx`) is the earlier drawing (Elevation/Small, no hairline, the check). New template draws the file's current one locally (`.sp-new-path`), so the primitive can move when onboarding does |
| Not a screen | The dialogs draw Elevation/2 Overlay where the Modal primitive (`2215:203`) takes Elevation/3 Floating; every dialog keeps the primitive's |

## What Phase 6b found

Phase 6b moved the Template Builder's editor onto its frames: the top bar, the carded workspace, the Layers and Form rail, the stage's controls, the inspector with Design and Field, Preview, Publish and Template published. It was built from this plan and the frames directly. Its pull request lists the calls made along the way.

### Built and how it works

- **The frame.** The editor is a column: the top bar 44 tall, then the workspace 12 below it, three cards 12 apart (the rail 260, the stage, the inspector 320; in Preview the stage and the Details panel at 380). The rails no longer resize or collapse. The step bar, its slide-over panels and Save draft are gone: a draft saves itself, and the bar says Saved, Saving, Unsaved changes, or Not saved with Try again. The last crumb renames the template.
- **Publish** (`PublishDialog.tsx`) holds what the step bar held: the name, the caption with a chip for each field, the category, tags and description, and the check that names each field whose own character limit runs past its box (`limitOverflows`, measured with the renderer's own fit), with Show. Template published offers a public link or Done, and Done stays in the builder.
- **The stage** is the pasteboard. The variation capsule floats at its top (a segment per look, Add a variation, and a menu with Rename, Make default and Delete), the tools column at its left with Undo and Redo, the size select at its bottom left and the zoom at its bottom right; the layout's checks and the review after a new size are a pill between them that opens a panel. The artboard fits inside those controls (`FieldOverlayEditor`'s `fitInsets`, chrome only).
- **The rail.** Add is the Element Tile grid: the frame's nine, then Triangle, Star and Icon; Logo adds the brand's one logo, opens a menu of their artwork when there are several, and offers Brand Studio when there are none. Import from Figma and Auto build sit under Import when the workspace can import. Layers are Layer Rows: the element's glyph (`elementIcons.ts`), its name, and the lock on a fixed element; Hide and Pin, this session only, show on hover or keyboard focus. Form is Form Rows: the number, the name and Optional.
- **The inspector** has a header (the glyph, the name renamed in place, and the more menu), then Design and Field (`Tabs`). Design leads with the frame's Text, Image and Fill and keeps what the frame does not draw as further sections (the variation's own, Plate, Stroke, Layout, Layer, Effects). Field holds Team fills in, the content or placeholder, Optional, Max characters, Show the longest entry and Type. With variations there is one Design view: shared settings edit the template, and the sections that belong to the variation carry its name; Effects alone keeps an All variations or This variation switch, since it exists at both. The group, selection and canvas inspectors take the same header and sections; the canvas is Size, the background's fill row, Gradient with Add and the Image upload, as Blank draws it.
- **Preview** is the fill page's Details panel beside the stage: Variation, the fields your team fills in and the Caption with Copy. What is typed there is held for the session.

### Left for each phase

| For | What |
|---|---|
| CJ | The Field tab's Question is separate from the element's name in the frames, and `TemplateField` has no property for it. Proposed: `question?: string` with an additive column `question text null`, read by the fill page's label as `question ?? label`. Until then the Field tab has no Question, and the name in the header is the form's label, as today |
| Phase 10 | The popovers and dialogs the frames do not draw keep the earlier control classes: the size popover's insides (`CanvasSizePicker`), the fill picker, the icon picker's search, the background reflow dialog and the shortcuts panel. The gradient's stops keep `ColorControl` |
| Not a screen | The frames draw no scope for variations; the inspector's one view is this phase's reading of them. `unstyledVariantCount` lost its reader with the Form tab's chip |

## Scope

In scope: every frame in the screen map, the shell around them, and the system pages they draw from.

Out of scope: layouts below desktop width (they keep today's behavior on the new tokens), the three builder proposal sections, the "Chat box options" frame, the Dark frames of the sign-in page, and everything `RULES.md` section 11 lists. Bulk fill and the rest of the public link page have no frames and take the tokens and primitives only.

## Phases

One pull request per phase into `main`. Phase 0 changed the prompt's order in two places, and says why under the table.

| # | Phase | What lands | Gate highlights | Status |
|---|---|---|---|---|
| 0 | Recon and plan | This folder. No product code | CJ approves the plan and answers the questions | Merged 2026-11-14 (#183) |
| 1 | Foundation | The exporter, JSON, generator and check on the new collections. `tokens.css` regenerated from the new file. `legacy-bridge.css` rewritten so every older name still read points at a new token. The 2 px focus ring, on fields too. The 20 text styles, with existing call sites renamed onto untrimmed twins | Every changed value is on the expected list. No layout moves | Merged 2026-11-14 (#185) |
| 2 | Primitives | Every component in `PROMPT.md` section 6.1 on the new tokens with its states, tested. The folds (Icon Button, Select, Tooltip, Switch). The new ones (Checkbox, Radio, Table Row, Alert, Empty State, Search, Tabs). `/dev/ui` redrawn to show each one in Light and Dark the way the Components page does | `/dev/ui` matches the boards in both themes | Merged 2026-11-15 (#189) |
| 3 | Shell | The app frame: viewport padding, the 320 sidebar, Main as a frame whose content scrolls, the one Page Header row on every page, Breadcrumb, one Footer Links slot. The new logo, mark and favicon | Every route still reachable in both themes. Titles sit at one height | Merged 2026-11-16 (#191) |
| 4 | Brand Templates | The library, filter, search, the form-only fill page on the Details panel, the public link page's form, the public links dialog, bulk fill in the new shell. The template chat behind its redirect | Screens match their frames in both themes. No shadow cut off on the shelves, the chip rail or the grids | Merged 2026-11-16 (#194) |
| 5 | Generate | Every state in the screen map, the new chat box, the Result Card with size tabs, History with skeletons | Same | Merged 2026-11-16 (#195) |
| 6a | Template Builder: list and start | The list with its row menu, New template, Choose a size with the new covers, the Figma import and auto build dialogs | Light matches the frames. Dark reviewed by screenshot | Merged 2026-11-16 (#197) |
| 6b | Template Builder: editor | The editor chrome: top bar, carded workspace, the Layers and Form rail, the inspector with its Design and Field tabs, the stage controls, Publish | Same. Rendering and gestures untouched, and the fidelity checker passes | Built 2026-11-16, in review |
| 7 | Brand Studio | Overview with the new covers, and the six detail pages | Same as 4. Differences with `docs/brand-system/` listed | Not started |
| 8 | Settings and Insights | All seven sections and the dashboard | Same | Not started |
| 9 | Sign in and Create account | The eight gate screens and the ten onboarding steps, Light only, with the new panel art | Screens match their frames | Not started |
| 10 | Cleanup | The bridge, the `.tu-*` twins, every older token name and control class deleted. What the earlier program's Phase 9 still owes. Lint rules against raw colors and inline type | Nothing legacy left | Not started |

Why the order changed:

- **The builder is two phases.** It is the one area with no primitives in it at all. The list and its dialogs share nothing with the editor except the size gallery, and the editor alone touches `TemplateBuilder.tsx` (about 4,300 lines) and the inspector. One pull request for both would be too large to review against the frames.
- **The shared art moves with its screen**, not into Foundation. Phase 1 changes tokens only, so its screenshot diff stays a pure token diff. The cost is that between Phase 1 and Phase 3 the logo is the old green beside new Slime buttons.

Everything else keeps the prompt's order. Primitives before Shell is right: the shell is built from Nav Item, Breadcrumb, Page Header and Footer Links. Brand Templates before Generate is right: the Details panel the fill page moves onto is the one Generate's editor already uses.

No phase is expected to need a migration. A phase that turns out to need one reserves its number in `docs/brand-system/PLAN.md`, where the shared list lives.

## Screen map

Paths are under `src/app/components/` unless they start with `src/`. Entry points were confirmed in Phase 0, and corrections to the prompt's list are marked.

| Area | Frames (Light / Dark) | Route | Code entry points |
|---|---|---|---|
| Brand Templates | 01 `2308:4` / `2325:1080`, 02 Platform filter `2308:538` / `2325:1368`, 03 Search `2308:739` / `2325:1571`, page `2308:2` | `/templates?platform=&q=` | `Portal.tsx`, `templates/*` (`LibrarySearch`, `PlatformFilter`, `PlatformShelf`, `TemplateCard`, `TemplateSkeleton`, `useEdgeFade`) |
| Fill page | 04 `2322:918` / `2325:1746`, 05 filled `2308:3272` / `2325:1913`, 06 downloaded `2308:3596` / `2325:2080`, 07 public links `2323:888` / `2325:2251` | `/templates/:id`, and `/l/:token` shares the form | `TemplateUsePage.tsx`, `TemplateFill.tsx`, `details/DetailsPanel.tsx` (added), `admin/TemplateLinksDialog.tsx`, `src/app/public/PublicFillPage.tsx`, `src/app/public/PublicFrame.tsx` (added) |
| Template chat (hidden) | None | `/templates/:id/chat[/:threadId]` redirects | `src/app/router.tsx`, `src/app/App.tsx`. Links to remove: `TemplateUsePage.tsx:105`, `generate/GenerateHistoryPage.tsx:284`, `generate/GeneratePage.tsx` (four) |
| Bulk fill | None | `/templates/:id/bulk` | `bulk/BulkFillPage.tsx` |
| Generate | Start `13:1453` / `2357:3255`, Attach menu `13:1601` / `2357:3328`, Connectors `13:1850` / `2357:3427`, Add a detail `13:2140` / `2357:3519`, Photo attached `13:2301` / `2357:3582`, Details added `13:2454` / `2357:3656`, Sent `13:2639` / `2344:2754`, Generating `13:2824` / `2344:2885`, Result `13:2985` / `2344:3001`, Edit `13:3150` / `2344:3158`, History `13:3359` / `2344:3394`, page `8:674` | `/generate`, `/generate/c/:id`, `/generate/history` | `generate/GeneratePage.tsx`, `GenerateHistoryPage.tsx`, `EditorPanel.tsx`, `RecentCard.tsx`, `HistoryCard.tsx`, `ScrollFade.tsx`; `chat/ChatComposer.tsx`, `AttachMenu.tsx`, `Attachments.tsx`, `GenerateTurn.tsx`, `GenerateHeader.tsx`, `Messages.tsx` |
| Template Builder list | List `328:1944`, row menu `329:2206`, New template `329:2660`, Choose a size `329:2970`, Import from Figma `329:3710`, Auto build `329:3981`, building `329:4286`, page `8:675`. Light only | `/template-builder`, `/template-builder/new` | `admin/AdminTemplates.tsx`, `admin/BuilderTemplateCard.tsx` (added), `builder/NewTemplateDialog.tsx` (added), `SizeGallery.tsx`, `FigmaImportDialog.tsx`, `CanvaImportDialog.tsx`, `AutoBuildDialog.tsx`, `NotConnected.tsx` (added), `startHandoff.ts` (added), `src/lib/templates/sizeCovers.ts`, `src/lib/templates/builderMeta.ts` (added). Phase 6a deleted `BuildPicker.tsx`, `ImportLinkPopup.tsx` and `StartGlyphs.tsx`; `CanvasSizePicker.tsx` stays for the editor (6b) |
| Template Builder editor | Blank `325:484`, text field `322:36`, its Field tab `2289:4772`, image field `325:871`, its Field tab `2289:5676`, preview `326:924`, Publish `326:1233`, Published `326:1742`. Light only | `/template-builder/:id` | `builder/TemplateBuilder.tsx`, `LayersPanel.tsx`, `FieldListPanel.tsx`, `ElementPalette.tsx`, `elementIcons.ts` (added), `FieldInspector.tsx`, `GroupInspector.tsx`, `InspectorControls.tsx`, `InspectorHeader.tsx` (added), `InspectorSelect.tsx`, `EffectsEditor.tsx`, `GradientEditor.tsx`, `VariationSwitch.tsx` (added), `StageChecks.tsx` (added), `CrumbRename.tsx` (added), `PublishDialog.tsx` (added), `CaptionEditor.tsx`, `FieldOverlayEditor.tsx` (chrome only: the fit's insets), `src/lib/templates/publishChecks.ts` (added). Phase 6b deleted `BuilderShell.tsx`, `WizardStepper.tsx`, `VariantFilmstrip.tsx` and `InlineEdit.tsx` |
| Brand Studio | Overview `13:9043` / `2366:2169` and the 18 detail states in `PROMPT.md` section 8, page `8:676` | `/brand-studio/:category` | `admin/BrandStudio.tsx` (added), `admin/brand/BrandOverview.tsx`, `BrandDetail.tsx`, `BrandDetailHeader.tsx`, `ColorsDetail.tsx`, `LogosDetail.tsx`, `FontsDetail.tsx`, `TypeStylesDetail.tsx`, `ImagesDetail.tsx`, `ImportDetail.tsx` |
| Insights | `13:832` / `2406:251`, page `8:677` | `/insights` | `admin/Dashboard.tsx`, `admin/insights/*` |
| Settings | Workspace `13:14570` / `2413:1552`, People `13:14769` / `2413:1728`, Integrations `13:15051` / `2413:1987`, Plan and usage `13:15203` / `2413:2113`, Sharing `13:15384` / `2413:2263`, Account `13:15649` / `2413:2520`, Advanced `13:15837` / `2413:2680`, page `8:678` | `/settings/:section` | `admin/SettingsAdmin.tsx`, `admin/settings/*` |
| Sign-in gate | Sign in `200:168`, error `201:254`, Sign up `201:289`, error `201:332`, Check your email `201:373`, Reset password `201:414`, Reset link sent `201:454`, New password `201:495`, page `194:2`. Light only | No session, at any URL | `PreAppShell.tsx`, `auth/AuthPage.tsx`, `AuthScreen.tsx`, `AuthPanel.tsx` |
| Create account | `258:16`, `258:262`, `258:438`, `258:708`, `259:357`, `259:5170`, `259:478`, `259:630`, `259:799`, `259:968`, shell `257:3`, page `257:2`. Light only | First sign-in with no workspace | `onboarding/OnboardingFlow.tsx`, `onboarding/pieces.tsx`, `PreAppShell.tsx`, `primitives/OptionTile.tsx` |
| Shell | Sidebar `2218:679`, the Generate pattern `2218:685` for the frame | all | `AppShell.tsx` (corrected), `Sidebar.tsx`, `layout/Page.tsx`, `layout/useFrameKeys.ts`, `layout/ChromeContext.tsx`, `BrandMark.tsx`, `brandArt.ts`, `primitives/PageHeader.tsx`, `src/styles/shell.css`. Phase 3 deleted `layout/Breadcrumb.tsx` and `generate/LegalLinks.tsx` |
| System | Foundations `4012:1192`, Components `4012:1193`, Product components `4012:1194`, Patterns `4012:1195` | `/dev/ui` | `src/styles/*`, `primitives/*`, `src/app/dev/*` |

`npm run shots` captures 76 routes (counted at `4bd5d1a`), bulk fill, the public link page and the builder editor among them. Phase 6a added the builder states its frames draw that the fixture lacks: Make another size, and New template with each dialog after it (Choose a size, Import from Figma, Import from Canva, Auto build and its steps), on a dev backend that stands in for connected imports (`devImport`). Phase 6b added the editor's: an element selected on Design and on Field, an image, Preview, Publish and Template published (`builder-editor-*`).

## The gate

Phase 0 stops here. The questions for CJ, with what was found and what is recommended, are in the Phase 0 report. In short:

1. What happens to `feat/new-look-phase-9`. Answered: it merged first, as #182.
2. Whether judgement calls 7 to 10 above stand. Answered: they stand.
3. The differences between the Brand Studio frames and what `docs/brand-system/` has decided or built.
4. No frame read in Phase 0 needs a change to a frozen type or a table column. Each phase checks its own frames again at its recon gate.
