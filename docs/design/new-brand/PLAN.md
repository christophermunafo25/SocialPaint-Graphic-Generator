# New brand: the plan

The Figma file "Master UX UI New Brand (Copy)" (`1dYWgFH2V8i9Jez2ylI3ky`) is the design system and the screens the platform moves onto: a new palette, 193 variables in three collections, 20 text styles, 40 shared components and every area redrawn in Light and Dark. This folder carries it into the code in phases, one pull request each, merged to `main` as each passes its gate.

- `PROMPT.md` is the program brief as CJ wrote it. It holds the token tables, the component tables and the node ids.
- `PLAN.md` (this file) is the program: decisions, what Phase 0 found, phases and the screen map.
- `RULES.md` holds the rules every phase follows.
- `BRIDGE.md` maps every older token name and text class to the new ones while screens move.
- `PHASE-1.md` is the prompt for Phase 1. Each later phase gets its own prompt when it starts, written from the frames it builds.

It replaces the file "Master UX-UI" as the source of truth. It does not replace `docs/design/new-look/`: that program built the structure this one restyles, and its decisions stand unless one below changes them.

Phase 0 was written against `main` at `0febeba` on 2026-11-14.

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

Phase 0 added four of its own, in the same spirit. They are listed in the gate report so CJ can overturn any of them.

7. **Existing text keeps its box until its screen is rebuilt.** The twenty text classes trim to cap height, as the file has them. Call sites that exist today move to an untrimmed twin (`.tu-*`) in Phase 1, and take the trimmed class when their phase rebuilds the layout around them (`BRIDGE.md` section 5). Turning trim on under 320 call sites at once would move every layout in the app in a token phase.
8. **Every template chat address redirects, threads included.** `/templates/:id/chat/:threadId` goes to `/templates/:id` like the bare address. A saved template chat in Generate History opens its template's fill page.
9. **What the code already builds from the three proposal sections stays.** Depth, icons and crop are in the builder today, built by `docs/brand-system/` Phases 1 to 4 and merged. Phase 6 keeps them working on the new components and draws them from the tokens and the Effect Row component (`392:8266`). It builds nothing further from the proposal frames.
10. **Bulk fill follows without frames.** It is not drawn in the new file. It takes the shell, the header row and the primitives, and keeps its layout.

## What Phase 0 found

### The earlier program is one phase short

New look Phases 1 to 8b are merged (#152 to #169). Its Phase 9, cleanup, is not: nine commits sit on `feat/new-look-phase-9`, 31 files and about 1,700 lines removed, including 522 from `socialpaint.css`. That branch moves `AdminTemplates.tsx` and bulk fill onto the primitives, deletes dead code and adds a contrast script. It is already rebased onto `main` at `0febeba`.

What that phase still owes, and where this program picks each up:

| Owed | Here |
|---|---|
| Delete `legacy-bridge.css` and the dead tokens | Phase 10 |
| Delete the earlier control classes. Still read: `.sp-btn` in 20 files (104 uses), `.sp-input` in 14, `.sp-icon-btn` in 5, `.sp-seg` in 3, `.sp-chip` in 1, `.sp-tabstrip` in 2. The `.sp-chat-*` control set is already gone | The builder's (10 files) in Phase 6, bulk fill's and the shared dialogs' in Phase 4, the rest in Phase 10 |
| Bulk fill and `AdminTemplates.tsx` on the primitives | On the branch. See the first question at the gate |
| Drop the unread `company_canvas_presets` table (migrations 0046 and 0047 are promised to it) | Phase 10, unless the branch lands first |
| Lint rules against raw colors and inline type. There is no automated check today: the rule is prose in `CLAUDE.md` and a line in the phase reviewer's checklist | Phase 10 |
| A contrast and keyboard pass, `ARCHITECTURE.md`, the stylesheet header | Phase 10 |

`docs/brand-system/` Phase 6 is gated on "new-look Phase 9 merged". Until CJ says what happens to that branch, that program's Track B cannot start.

### Tokens

- The prompt's token tables match the file. Every Light value in section 4.3 was read back from the Color board (`4012:1197`).
- The pipeline needs more than new collection names. The exporter reads four collections and has no path for string values, the generator has role-named radius and spacing groups and a family map built for the old styles, and the file may still hold the earlier collections and its 46 text styles beside the new ones (its Docs page says the old ones are retired "on approval"). `PHASE-1.md` has the exporter pick the three collections and the twenty styles by name.
- Ten rows of the prompt's old-to-new map are wrong or incomplete once read against the code. `BRIDGE.md` section 1 lists them. The two that matter most: four new token names are already declared by `socialpaint.css` with different meanings, and same-named text classes are a size apart (`.t-body-s` is 14 today and 13 in the new file).
- Every `var()` read was counted. The heaviest earlier names: `--text-secondary` 210 reads, `--space-2xs` 174, `--space-sm` 129, `--text-strong` 112, `--radius-control` 100, `--text-muted` 96.

### Trim

`text-box: trim-both cap alphabetic` is applied by all three engines the fidelity harness pins: Chromium 153, Firefox 155 and WebKit 26.6 each measure a 14 on 20 label at 10 tall. Support starts at Chrome 133 and Safari 18.2. The app declares no browser list.

Without the property a label is its full line height, so a Label/M box is 20 tall, not 10. A control with a fixed height and a centered label looks the same either way. A control sized by padding around its label grows by the difference, 10 on a Medium button. `RULES.md` section 4 therefore makes every control take its height from `--size-control-*`, and no fallback stylesheet is planned.

### Components

Section 6's "code today" column is mostly right. What is wrong or missing:

| Component | Finding |
|---|---|
| Search (`2207:455`, always open) | No component plays this role. `primitives/SearchField.tsx` is the collapsing Search Field (`50:62`), wrapped by `templates/LibrarySearch.tsx`. `templates/TemplateSearchField.tsx` is a separate older implementation used by the builder list and the size gallery |
| Icon Button | Five components fold into one: `IconButton`, `RowMenuTrigger`, `ThemeToggle`, `StepperButton`, `AttachButton`. All are 32 or 28 today and none is 36. The fold has to keep three behaviors as props, not variants: the theme toggle's glyph swap by nearest `[data-theme]`, the stepper button staying focusable while disabled, and the row menu trigger holding Selected while its menu is open. Attach's inverse fill goes |
| Select | `Select` and `CompactSelect` already share `SelectBase`, so the fold is a size prop (28, 36, 44). `Filter` is a button that opens a `Menu`, used once (`admin/insights/FilterMenu.tsx`), and becomes a Select there. A fourth, older `ui/Select.tsx` has two callers and exports three helpers the primitive imports |
| Tabs | Today a pill on a track. The new Tabs (`4015:673`) is text on a hairline with an underline. One call site (`admin/insights/TrendCard.tsx`). The file's Docs page still says Tabs became Segmented Control, but the component is on the Navigation board, so it is built |
| Tooltip | `Overlays.tsx` `Tooltip` is the chart tooltip only. The hint on controls is `components/Tooltip.tsx`, on Radix with `.sp-tooltip`. One component now covers both, with the value optional |
| Switch | A second, older `components/Switch.tsx` has three callers in the builder and bulk fill |
| Card | `Containers.tsx` `Card` has no call site outside `/dev/ui`. Real cards are `.sp-in-card` (Insights) and `.sp-card` |
| Metric | `Metric` is a bare stack with one caller. The Insights KPI is `admin/insights/InsightKpi.tsx` |
| Checkbox, Radio, Table Row, Alert, Empty State | No shared component. Two native checkboxes, three hand-built tables, about twenty per-area alert blocks, `.sp-emptystate` as CSS in four files, and `ErrorState.tsx` (15 callers) for load failures |
| Dialog | `Modal` has two callers. Ten dialogs are hand-rolled, most of them in the builder. `ConfirmDialog.tsx` sits on shadcn's alert dialog with `.sp-btn` |
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
| `src/assets/sizes/*.svg` (11) | Neutrals follow `--cover-*`. Accents are baked per family (cyan, green, pink) and are not token values | 6 |
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
| `.sp-railfade__track` (`socialpaint.css:2909`, `templates/GroupChips.tsx`) | x | The older platform chips | None | 6 |
| `.sp-chat-thread` (`socialpaint.css:3749`) | y | Result cards, the variations well | 16 top, the page gutter at the sides, 32 below | 5 |
| `.sp-chat-history-scroll` (`socialpaint.css:3912`) | y | History cards | 24 top, the gutter at the sides, none below | 5 |
| The builder's source-pick region (`TemplateBuilder.tsx:3198`, inline) | y | Start cards | Not measured | 6 |
| `.ui-modal` (`primitives.css:1281`) | y, when tall | Option tiles and cards inside a dialog | 24 | 2 |

Containers that clip without scrolling:

| Container | Holds | Phase |
|---|---|---|
| `html[data-sp-fullscreen]`, `.sp-appshell` and `main` (`socialpaint.css:1675`) | The Generate thread and History columns, which run flush to Main's edges | 3 |
| `.sp-builder`, `__rail`, `__canvas`, `__tools` (`socialpaint.css:1701` to `1778`) | Nothing raised today: the builder draws hairlines, never shadows. The frames turn its rails into raised cards, so every one of these changes | 6 |
| `.sp-auth__panel` (`auth.css:74`) | The floating card over the art, 24 from the edge against a shadow that reaches further. The clip also crops the art | 9 |

Scroll containers with no raised children keep their 4 of focus-ring room, which a 2 px ring 2 px out exactly fills: the sidebar nav, the chip rail on Brand Templates, the Details panel's fields, the composer's tag list, menus, the Sharing table and the builder rail body. About 50 other rules clip only their own content (an image crop, a truncated line) and are fine.

## Scope

In scope: every frame in the screen map, the shell around them, and the system pages they draw from.

Out of scope: layouts below desktop width (they keep today's behavior on the new tokens), the three builder proposal sections, the "Chat box options" frame, the Dark frames of the sign-in page, and everything `RULES.md` section 11 lists. Bulk fill and the rest of the public link page have no frames and take the tokens and primitives only.

## Phases

One pull request per phase into `main`. Phase 0 changed the prompt's order in two places, and says why under the table.

| # | Phase | What lands | Gate highlights | Status |
|---|---|---|---|---|
| 0 | Recon and plan | This folder. No product code | CJ approves the plan and answers the questions | At the gate |
| 1 | Foundation | The exporter, JSON, generator and check on the new collections. `tokens.css` regenerated from the new file. `legacy-bridge.css` rewritten so every older name still read points at a new token. The 2 px focus ring, on fields too. The 20 text styles, with existing call sites renamed onto untrimmed twins | Every changed value is on the expected list. No layout moves | Not started |
| 2 | Primitives | Every component in `PROMPT.md` section 6.1 on the new tokens with its states, tested. The folds (Icon Button, Select, Tooltip, Switch). The new ones (Checkbox, Radio, Table Row, Alert, Empty State, Search, Tabs). `/dev/ui` redrawn to show each one in Light and Dark the way the Components page does | `/dev/ui` matches the boards in both themes | Not started |
| 3 | Shell | The app frame: viewport padding, the 320 sidebar, Main as a frame whose content scrolls, the one Page Header row on every page, Breadcrumb, one Footer Links slot. The new logo, mark and favicon | Every route still reachable in both themes. Titles sit at one height | Not started |
| 4 | Brand Templates | The library, filter, search, the form-only fill page on the Details panel, the public link page's form, the public links dialog, bulk fill onto the primitives. The template chat behind its redirect | Screens match their frames in both themes. No shadow cut off on the shelves, the chip rail or the grids | Not started |
| 5 | Generate | Every state in the screen map, the new chat box, the Result Card with size tabs, History with skeletons | Same | Not started |
| 6a | Template Builder: list and start | The list with its row menu, New template, Choose a size with the new covers, the Figma import and auto build dialogs | Light matches the frames. Dark reviewed by screenshot | Not started |
| 6b | Template Builder: editor | The editor chrome: top bar, carded workspace, the Layers and Form rail, the inspector with its Design and Field tabs, the stage controls, Publish | Same. Rendering and gestures untouched, and the fidelity checker passes | Not started |
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
| Template Builder list | List `328:1944`, row menu `329:2206`, New template `329:2660`, Choose a size `329:2970`, Import from Figma `329:3710`, Auto build `329:3981`, building `329:4286`, page `8:675`. Light only | `/template-builder`, `/template-builder/new` | `admin/AdminTemplates.tsx`, `builder/BuildPicker.tsx`, `SizeGallery.tsx`, `CanvasSizePicker.tsx`, `FigmaImportDialog.tsx`, `CanvaImportDialog.tsx`, `AutoBuildDialog.tsx`, `ImportLinkPopup.tsx`, `src/lib/templates/sizeCovers.ts` |
| Template Builder editor | Blank `325:484`, text field `322:36`, its Field tab `2289:4772`, image field `325:871`, its Field tab `2289:5676`, preview `326:924`, Publish `326:1233`, Published `326:1742`. Light only | `/template-builder/:id` | `builder/TemplateBuilder.tsx`, `BuilderShell.tsx`, `LayersPanel.tsx`, `FieldListPanel.tsx`, `ElementPalette.tsx`, `FieldInspector.tsx`, `GroupInspector.tsx`, `InspectorControls.tsx`, `EffectsEditor.tsx`, `VariantFilmstrip.tsx`, `FieldOverlayEditor.tsx` (chrome only) |
| Brand Studio | Overview `13:9043` / `2366:2169` and the 18 detail states in `PROMPT.md` section 8, page `8:676` | `/brand-studio/:category` | `admin/BrandStudio.tsx` (added), `admin/brand/BrandOverview.tsx`, `BrandDetail.tsx`, `BrandDetailHeader.tsx`, `ColorsDetail.tsx`, `LogosDetail.tsx`, `FontsDetail.tsx`, `TypeStylesDetail.tsx`, `ImagesDetail.tsx`, `ImportDetail.tsx` |
| Insights | `13:832` / `2406:251`, page `8:677` | `/insights` | `admin/Dashboard.tsx`, `admin/insights/*` |
| Settings | Workspace `13:14570` / `2413:1552`, People `13:14769` / `2413:1728`, Integrations `13:15051` / `2413:1987`, Plan and usage `13:15203` / `2413:2113`, Sharing `13:15384` / `2413:2263`, Account `13:15649` / `2413:2520`, Advanced `13:15837` / `2413:2680`, page `8:678` | `/settings/:section` | `admin/SettingsAdmin.tsx`, `admin/settings/*` |
| Sign-in gate | Sign in `200:168`, error `201:254`, Sign up `201:289`, error `201:332`, Check your email `201:373`, Reset password `201:414`, Reset link sent `201:454`, New password `201:495`, page `194:2`. Light only | No session, at any URL | `PreAppShell.tsx`, `auth/AuthPage.tsx`, `AuthScreen.tsx`, `AuthPanel.tsx` |
| Create account | `258:16`, `258:262`, `258:438`, `258:708`, `259:357`, `259:5170`, `259:478`, `259:630`, `259:799`, `259:968`, shell `257:3`, page `257:2`. Light only | First sign-in with no workspace | `onboarding/OnboardingFlow.tsx`, `onboarding/pieces.tsx`, `PreAppShell.tsx`, `primitives/OptionTile.tsx` |
| Shell | Sidebar `2218:679`, the Generate pattern `2218:685` for the frame | all | `layout/AppShell.tsx`, `Sidebar.tsx`, `layout/Page.tsx`, `layout/Breadcrumb.tsx`, `layout/ChromeContext.tsx`, `generate/LegalLinks.tsx`, `BrandMark.tsx`, `src/styles/shell.css` |
| System | Foundations `4012:1192`, Components `4012:1193`, Product components `4012:1194`, Patterns `4012:1195` | `/dev/ui` | `src/styles/*`, `primitives/*`, `src/app/dev/*` |

`npm run shots` captures 44 routes today. It does not capture bulk fill, the public link page or any builder state past its start screen. Phase 3 adds the first two and Phase 6a adds builder states to the fixture.

## The gate

Phase 0 stops here. The questions for CJ, with what was found and what is recommended, are in the Phase 0 report. In short:

1. What happens to `feat/new-look-phase-9`.
2. Whether judgement calls 7 to 10 above stand.
3. The differences between the Brand Studio frames and what `docs/brand-system/` has decided or built.
4. No frame read in Phase 0 needs a change to a frozen type or a table column. Each phase checks its own frames again at its recon gate.
