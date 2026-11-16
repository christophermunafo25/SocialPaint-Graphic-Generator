# New brand: rules for every phase

Every phase prompt in this folder includes these rules by reference. They are `docs/design/new-look/RULES.md` with the changes in `PROMPT.md` section 7 applied and the structure rules from section 7b added, and they stand alone: a phase reads this file, not the earlier one. Where a rule here and the Figma file disagree, the file wins and the phase prompt records the exception. Where a rule here and a comment in a stylesheet disagree, this file wins.

`CLAUDE.md` points at this file once CJ approves it. Until then it still names the earlier rules, and a new-brand phase follows this file.

## 1. Sources of truth

- **Figma file "Master UX UI New Brand (Copy)"** (`1dYWgFH2V8i9Jez2ylI3ky`) is the visual and behavioral spec. Foundations is page `4012:1192`, Components `4012:1193`, Product components `4012:1194`, Patterns `4012:1195`, Docs `4012:1196`, and each area has its own page (the screen map in `PLAN.md`). The earlier file "Master UX-UI" (`mEJRslarcQDkgPeY6AObi5`) is retired as a source. Many node ids are the same in both files, so always pass the new file key.
- **Tokens** come from the file's Primitives, Color and Scale collections through `design/tokens/master.tokens.json` and the generated `src/styles/tokens.css`. Never edit either by hand. A value the file lacks is added in Figma first, exported and regenerated.
- Read frames and components by node id (`get_design_context`, `get_screenshot`, `get_variable_defs`). The frames are 1440 wide. Compare against the file, not against memory.
- On the Components and Product components pages each block is drawn in Light with a Dark preview under it. Both are the spec.

## 2. Multi-tenant

- The frames show sample content: workspace names, people, templates, brand colors, logos, numbers and chart data. Build the interface and leave the content to each account.
- Never seed SocialPaint's brand (colors, fonts, logos, templates, copy or imagery) into an account. New accounts start the way they start today.
- Tenant brand kits style the graphics members make. They never restyle the platform chrome, and the chrome reads only `tokens.css`.
- The one exception is shared platform art: the Brand Studio cover images, the size covers and the sign-in panel art are the same in every account and are committed as static assets.
- Interface labels in the frames ("Brand Templates", "Download PNG", "Public link") are copy to use. Anything that names or counts tenant data is sample data.
- The artboard, a preview and an export are a tenant's graphic. They are never themed and never read a platform token.

## 3. Tokens

- Components read semantic tokens from the Color collection (`--surface-*`, `--text-*`, `--border-*`, `--action-*`, `--state-*`, `--control-*`, `--status-*`, `--feedback-*`, `--editor-selection`, the `--accent-*`, `--deep-*`, `--tint-*` and `--wash-*` families, `--shadow-*`, `--bevel-*`, `--glow-accent`), the Scale tokens (`--space-*`, `--radius-*`, `--size-control-*`, `--size-icon-*`, `--stroke-*`, `--focus-offset`, `--motion-*`), the elevation composites and the text style classes.
- Never read a primitive (`--neutral-900`, `--green-slime`, `--alpha-ink-8`) in a component, and never write a raw color.
- New code never reads a name from the earlier system. `BRIDGE.md` lists them. A phase removes the bridged names its screens stop using, and Phase 10 deletes the rest.
- `npm run tokens:check` fails if any stylesheet declares a token-owned or bridged name at theme level. Override a token inside a component selector only when a frame shows that component on a different surface.
- Themes are `[data-theme="light"]` and `[data-theme="dark"]` on `<html>`. A nested `[data-theme]` recomputes every token and composite, which is how the sign-in gate, onboarding and a pinned logo plate stay on one ground.

## 4. Corners, spacing, sizes and elevation

Radius is a step, and each component names its step. Do not pick a step by nearest value to an old radius.

| Token | Value | Use |
|---|---|---|
| `--radius-xs` | 4 | Segments inside a track, small swatches |
| `--radius-sm` | 8 | Buttons, ghost icon buttons, inputs, selects, search, nav and menu items, table rows, the segmented track, the tooltip |
| `--radius-md` | 12 | Wells and plates set inside a card, Upload, Alert |
| `--radius-lg` | 16 | Menus, popovers, the toast |
| `--radius-xl` | 20 | Cards, dialogs, metrics, the sidebar, panels |
| `--radius-full` | 999 | Filled icon buttons, Send, the stepper's capsule, badges, tags, chips, avatars, switches |

Figma smooths some corners. CSS has no equivalent, so use the plain radius.

Spacing is named by value: `--space-2`, `-4`, `-6`, `-8`, `-12`, `-16`, `-20`, `-24`, `-32`, `-40`, `-48`, `-64`, `-96`. A gap the frames draw off this scale is kept as drawn and noted in the pull request.

Controls share four heights: `--size-control-xs` 24 (badges, tags), `--size-control-sm` 28, `--size-control-md` 36 and `--size-control-lg` 44. Button, Input, Select and Search line up on 28, 36 and 44. Give a control its height from the token and center its content. Never build a control's height from padding around its label (section 5 says why).

| Composite | Figma style | Use |
|---|---|---|
| `--elevation-1-raised` | Elevation/1 Raised: inset 0 1 2 `--bevel-top`, inset 0 -1 1 `--bevel-bottom`, drop 0 2 8 `--shadow-raised` | Cards, metrics, the sidebar, the chat box, panels |
| `--elevation-2-overlay` | Elevation/2 Overlay: the same insets, drop 0 4 16 `--shadow-floating` | Menus, tooltips, toasts |
| `--elevation-3-floating` | Elevation/3 Floating: inset 0 1 0 and 0 -1 0, drop 0 8 32 `--shadow-floating` | Dialogs |
| `--elevation-thumb` | Elevation/Thumb: drop 0 1 3 `--shadow-thumb` | The selected segment on its track |
| `--glow-accent-shadow` | Glow/Accent: drop 0 0 12 `--glow-accent` (the Color token keeps that name, so the composite takes a suffix) | Only where a frame draws it |

The composites carry the Dark bevel. Do not add a separate edge or highlight layer. Grain/Coarse has no CSS equivalent and is not built.

### A shadow is never cut off

No card, chip or panel loses part of its shadow to a container edge. Elevation/1 Raised reaches 8 left and right of an element, 6 above and 10 below.

- A container that does not scroll does not clip. Grids, result groups, shelves and the builder workspace are `overflow: visible`. An element may still clip its own content (an image crop inside rounded corners, a truncated line of text).
- A container that scrolls gets 12 of padding on every side it does not scroll toward, and a matching negative margin so nothing moves. The shelf rail is the model: `overflow-x: auto; padding: 12px 0 12px 12px; margin: -12px 0 -12px -12px`. Setting one overflow axis makes the other one clip too, which is why the room above and below has to be padding.
- An edge fade covers the padded box, so a shadow fades out with its card.
- The Figma frames show this as an inner layer named "· scroll" that is 12 larger than its layout box on those sides.

| Where | Sides that need room |
|---|---|
| Platform chip rail (Brand Templates, History) | Top and bottom |
| Shelf rails | Left, top and bottom |
| Filtered and search grids | All four. They do not scroll sideways, so they do not clip |
| Generate thread | Left and right, and the bottom when a result card is last |
| History grid, Template Builder grid | All four |
| Builder rails and inspector inside the workspace | All four |

`PLAN.md` lists every clipping container in the code today, so each phase knows which of its containers the rule applies to.

## 5. Type

- Every text in chrome uses one of the twenty text style classes from `tokens.css`, one per Figma style: `.t-title-display`, `.t-title-metric`, `.t-title-page`, `.t-title-section`, `.t-title-group`, `.t-title-card`, `.t-body-l`, `.t-body-m`, `.t-body-s`, `.t-label-l`, `.t-label-m`, `.t-label-s`, `.t-label-xs`, `.t-caption-m`, `.t-caption-s`, `.t-mono-display`, `.t-mono-m`, `.t-mono-s`, `.t-mono-eyebrow`, `.t-mono-code`.
- All twenty trim to cap height (`text-box: trim-both cap alphabetic`). Trim is the default and there is no opt-in class. A trimmed line of Label/M is 10 tall, not 20, so spacing is measured from the letters, the way the frames measure it.
- Because of the trim, a control's height comes from `--size-control-*` and its label is centered. A box sized by padding around a trimmed label would grow by the trimmed amount in a browser without `text-box` (Chrome before 133, Safari before 18.2). The three engines the fidelity harness pins (Chromium 153, Firefox 155, WebKit 26.6) all apply it.
- No inline font sizes, weights or tracking, and no Tailwind text-size utilities in chrome.
- An `<input>` and a `<textarea>` take no text style class. The trim clips an input's accents and descenders in Chromium, and in a text area it moves the value and leaves the placeholder where it was. `primitives.css` sets their type from the style's variables (`--type-body-m`), and a text area's padding gives the half-leading back so its first line sits where the file draws it.
- A trim needs a block. A text style class on a flex or grid container does not trim, so put it on the text's own element.
- Inter Tight Regular (400) sets reading text and Medium (500) sets controls and titles. Nothing in chrome is heavier. Geist Mono Regular sets the mono styles. Nothing is set below 11.
- Chrome faces are self-hosted under private " Platform" names (`"Inter Tight Platform"`), never the public family name, so a tenant's font cannot collide with them. Figma's `--font-sans` maps to that private family in code.
- Text and icons use `--text-primary`. Supporting text uses `--text-secondary`. `--text-disabled` is for disabled controls and nothing else.

## 6. Interaction states

Each component is drawn on the Components page with its states in Light and in Dark. That page is the spec.

- **Hover and pressed** change color and nothing else. Each action has its own tokens: `--action-primary-hover` and `-pressed`, `--action-neutral-hover` and `-pressed`, `--action-accent-hover` and `-pressed`, `--action-danger-hover` and `-pressed`. Rows, ghost controls, menu items and nav items use `--state-hover` and `--state-pressed`. Do not lay a tint over a fill. Three exceptions are drawn in the file and built as drawn: a Switch, Checkbox or Radio hovers with a halo, a `--state-pressed` shape 4 larger than the control (on a checkbox and a radio it lies over the box and under the mark, so an empty box takes its tint); an Input or Select hovers by gaining a `--border-strong` hairline; and the Search Field (`50:62`), which the file still draws the earlier way, lays `--state-hover` over its fill.
- **Selected** is for things that stay chosen: `--state-selected` on rows, nav items, menu items and ghost icon buttons, `--action-neutral-pressed` on a Filled icon button, `--surface-inverse` under `--text-inverse` on a Chip, and `--control-thumb` with `--elevation-thumb` for a segment in its track. A switch, checkbox or radio that is on uses `--control-on` with `--control-on-mark`. Off, a checkbox or radio is `--surface-raised` with a `--border-control` edge, and a switch's track is filled with `--border-control`. Both read 3:1 or better.
- **Open** menus count as selected for the control that opened them.
- **Disabled** controls take their own colors: `--action-disabled` under `--text-disabled`, with no hover. Never dim a control with opacity.
- **Focus** is the keyboard ring on `:focus-visible`: `var(--stroke-focus)` (2 px) of `--border-focus`, `var(--focus-offset)` (2 px) outside the element, on every interactive control. Text fields take it too. Never remove a focus style without its replacement. In a menu the ring shows on the keyboard's item only: a menu moves focus to the item under the pointer as well, and that one takes the hover fill alone.
- **Error**: a filled destructive action is `--action-danger` under `--action-on-danger`. Error text is `--feedback-error-text`, a field's error edge is `--feedback-error`, and an alert's ground is `--feedback-error-surface`. Warning has the same three roles under `--feedback-warning-*`.
- **Loading** keeps its shape. Lists and cards load as skeletons: use the component's Loading state or a Skeleton the size of what is coming, filled with `--surface-skeleton` and pulsing on `--motion-duration-pulse`.
- **Motion** is for things that open, close or move. Use `--motion-duration-fast`, `-base` or `-slow` with `--motion-easing-standard`, `-enter` or `-exit`. With reduced motion on, durations are zero.
- **The template card** steps through its variations on hover and on keyboard focus (`--motion-duration-base`, `--motion-easing-standard`). With reduced motion on it shows its first variation only.

## 7. Brand color in chrome

Slime fills the primary action (`--action-primary` under `--action-on-primary`, a primary black label in both themes) and Send (`--action-accent`). Use one Primary button per view. Everything else is Neutral or Ghost. Beyond those, use a brand color only where a frame draws one, through the semantic token that frame uses: the Positive and Active badges (`--status-*`), the logo, chart series, the Brand Studio covers and the decorative glows. Brand color never carries meaning on its own. Error red, warning amber and the editor's selection blue are functional signals and keep their meaning.

## 8. Icons and hit areas

- Use the icon the component uses. The set is 62 lucide icons on the Icons board of the Foundations page, each at 16 and 18. Controls use `--size-icon-sm` (16) at lucide's own stroke (the file's 1.33) and navigation uses `--size-icon-md` (18) at a 1.5 stroke (the file's 1.125). The 10, 14, 15 and 20 sizes are retired, except in the Search Field (`50:62`), which the file still draws with a 20 glyph and a 14 clear glyph. Custom glyphs that already exist in the code stay.
- A hit area is at least 24 by 24 even when its glyph is smaller.
- Every icon-only control has an accessible name.

## 9. Copy

These apply to every string a phase adds or changes in the interface.

- Sentence case. Second person. No exclamation points. No em dashes.
- No "it's not X, it's Y" constructions, no three-part rhetorical lists and no runs of sentences that open the same way.
- Never "ship" or "shipped". No testimonials or quotes from invented people. No bracketed placeholders.
- No helper copy. Nothing in the interface explains how the interface works. Page headers are a title alone, and the Field component's help text stays off unless a frame shows it.
- Fields show an error when the value is invalid or a required value is missing. A field's label row may carry what the Field draws: "Optional" or a text action. Problems with the value go on the error line.
- "Looks" are called "variations" in every string the interface shows.
- Terms of Service and Privacy Policy links sit at the bottom of every page (Footer Links).
- Strings the frames do not show are proposed copy: list them in the pull request for CJ to confirm.

## 10. Structure

Measured from the frames at 1440 wide. Fixed sizes stay fixed and everything marked "fills" takes the space that is left. Layouts below desktop width keep today's behavior on the new tokens.

### The app frame

| Part | Measure |
|---|---|
| Viewport | 12 padding on all four sides, 12 between the sidebar and Main. At 1024 and wider the document does not scroll, and the frame stops above the local backend's banner |
| Sidebar | 320 wide, 76 collapsed, full height. 20 padding, 24 between its groups. The account row stays at the bottom. The theme toggle sits beside Collapse (CJ, 2026-11-15; the file draws none). Collapsed, the header is Expand alone and the avatar is the Settings button |
| Main | Fills, with no width cap. 16 padding top and bottom. A 32 gutter left and right, so content is 1020 wide at 1440 |
| Page Header | One row 36 tall at the top of Main on every page. Title or breadcrumb on the left, centered in the row, and actions on the right with 8 between them |
| Content | Starts 24 below the header: the content's own top padding, as the gutters are its side padding, so a card's shadow is never cut. It scrolls inside Main while the header and the footer stay put, and returns to the top when the route's path changes (a filter in the address keeps the scroll). A scrolling area ends in an 80 tall fade at its bottom edge, shown while there is more below. The Generate thread and History scroll their own region instead, and the builder editor fills Main |
| Footer Links | Centered at the bottom of Main, 24 under the content, 16 between the two links. The fill page sets them under its stage instead. The builder editor has none, as its frames draw |

Three frames draw the title lower or tighter than this (Brand Templates, the Brand Studio overview, Settings). The one header row wins everywhere, so titles sit at the same height on every page.

A dialog's close button sits in its top right corner.

### Brand Templates

| Part | Measure |
|---|---|
| Filter bar | 56 tall. Search Field (50 square) then the platform chip rail, chips 50 tall with 8 between them. The rail runs off the right edge under a 72 wide fade |
| Shelves | 32 between shelves. A shelf is a header (28 tall, title on the left, View all on the right) then a rail 16 below it |
| Shelf rail | Cards in a row, 16 apart, running off the right edge under a 96 wide fade |
| Template Card | 302 wide. 434 tall for portrait templates, 226 for landscape. 8 padding around the preview |
| Filtered or search view | A result line (28 tall, the count and Clear), then one group per size: a header 32 tall and a grid 16 below it. Three cards across, 327 wide, 16 between columns and rows |
| Fill page | Breadcrumb header with Bulk fill and Public link on the right. Below it a row, 24 apart: the Preview fills, the Details panel is 380 wide |
| Preview | The graphic centered on a stage with 40 padding. The legal links sit under the stage |
| Details panel | 20 padding, 20 between fields. Download PNG pinned to its bottom |

### Generate

| Part | Measure |
|---|---|
| Start | One column 720 wide, centered in Main both ways. The chat box, then Recent 48 below it: a header 28 tall and a list with 12 between cards |
| Chat box | 720 wide, 16 padding, 24 between the text and the controls row |
| Thread | Breadcrumb header with History and New chat. Below it one column 720 wide, centered: the thread fills and scrolls, the chat box sits under it, the legal links under that. 24 between messages |
| Messages | A sent message sits right, up to 440 wide, with attachments above it. An assistant message and a Result Card run the full 720. Result Card has 12 padding |
| Try next | A row of chips under the result, 8 apart |
| History | Breadcrumb header, the page title, a filter row (Search Field then platform chips, 8 apart), then a grid: four cards across, 245 square, 12 between them |

### Template Builder

| Part | Measure |
|---|---|
| List | Header with Restore starters and New template on the right. A filter bar 40 tall: the status Segmented Control on the left, the sort Select and a 40 square search button on the right. A grid of Builder Template Cards, four across, 242 wide, 16 between them |
| Choose a size | A dialog 1040 wide, 24 padding, 20 between header and body. The body is a row 24 apart: a category list 200 wide (rows 36 tall, 2 apart) and the sizes, which are a platform chip row then a grid of Size Covers 16 apart. Close is 28 square in the top right corner |
| Editor frame | The sidebar is collapsed to 76. The builder column has a top bar 44 tall (breadcrumb, status badge, then the Edit and Preview control and Publish on the right) and the workspace 12 below it |
| Workspace | A row, 12 apart: the Layers and Form rail 260 wide, the stage fills, the inspector 320 wide. Rail and inspector have 16 padding |
| Stage | The artboard centered. The variation switcher top center, the tools column on the left edge, canvas size bottom left, zoom bottom right |

The builder has no Dark frames. Its chrome follows the theme through the tokens, and the artboard is never themed.

### Brand Studio

| Part | Measure |
|---|---|
| Overview | 24 between blocks. A setup strip (16 by 24 padding), then Overview Cards three across, 329 by 277, 16 between them |
| Detail pages | Breadcrumb header with the save status and Undo on the right. Content 24 below |
| Colors | Color Cards in rows, 159 by 149, 12 between them, then the roles summary |

A logo plate pins its own ground: a logo drawn for dark surfaces stays on a dark plate in both themes.

### Insights and Analytics

One column, 24 between blocks: the header (title, Export CSV), a filter row (8 apart), the monthly digest card (24 padding), four Metric cards in a row (16 apart, equal widths), a row 300 tall with the trend card filling and the top templates card 315 wide (16 apart), then the public links card (24 padding).

### Settings

A row 32 apart: the section rail 200 wide (items 2 apart) and the section, which fills (788 at 1440) as a column of Settings Cards 24 apart.

### Sign in and Create account

Light only. A row with 16 of margin on the top, right and bottom. The form side fills (32 by 48 padding): the logo top left, the form column centered both ways, the legal links at the bottom. The art panel on the right is 688 wide and full height. The form column is 400 wide for sign in and 480 for Create account, where it holds the questions, the actions row (12 apart) and the progress bar, 40 apart.

## 11. What no phase touches

- `SchemaRenderer`, `renderSchemaBlob`, `exportSchemaPng` and `canvasGesture.ts`, beyond class names on the chrome around them.
- `TemplateSchema`, `TemplateField`, `LayoutGroup`, `BrandKit` and every table column. If a frame needs data the types cannot carry, propose the exact shape at that phase's gate and wait.
- Tenant data, starter templates' content and anything a new account is seeded with.
- `docs/brand-system/` and the work it has in flight. Where a frame and that program's built behavior disagree, list the difference at the gate instead of picking one.
- Code names for data: when a rebuilt component takes the word "variation" (`VariationTile`, `.ui-variation-tile`, `VariationPicker`), data types and columns keep their names.
- The three builder proposal sections (`392:3892`, `434:4312`, `436:4402`) and the "Chat box options" frame (`2345:2827`).
- Anything outside the phase you are in. Report it instead.

Migrations stay additive, and Edge Function mirrors stay byte-identical to their twins.

## 12. How every phase works

1. Read `PLAN.md`, this file, `BRIDGE.md` and the phase prompt in full before writing code. Plan in plan mode first.
2. Before changing anything, capture the baseline: `npm run shots -- capture .shots/before` and, when the phase claims values stay put, `npm run shots -- props .shots/props-before.json`.
3. Work in the prompt's steps. Run `npm run verify` and commit after each one, with a message that names the phase and step. Never start a step on a red build.
4. The gate: `npm run verify` and `npm run build` pass, the screenshot comparison shows only the changes the phase expects, the changed screens match their frames in Light and in Dark, no shadow on a changed screen is cut off by a container edge, and a keyboard pass finds the 2 px ring on every control.
5. Run the `phase-reviewer` subagent before opening the pull request, and the `fidelity-checker` subagent when the phase touches anything near rendering, export, import or template types.
6. Open one pull request into `main` per phase. The description lists what changed, the screenshot report, every exception to the frames or to these rules, and any proposed copy.
7. If something in a prompt turns out to be impossible or wrong once you are in the code, stop and explain the conflict instead of improvising a different design.

## 13. Known open items

- White on `--action-danger` (`#FA3030`) reads 3.80:1, under the 4.5:1 small text needs. It is CJ's call and is kept. Hover and pressed pass.
- Slime against the Light page reads 1.25:1, so a Primary or Send button is told apart in Light by its label and shape, not its fill.
- Disabled text reads 2.48:1 in Light and 2.86:1 in Dark. Disabled controls are exempt.
