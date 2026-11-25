# ElevenLabs: rules for every phase

Every phase in this folder follows these rules. They are `docs/design/new-brand/RULES.md` with the ElevenLabs file's changes applied, and they stand alone: a phase reads this file, not the earlier one. Where a rule here and the Figma file disagree, the file wins and the pull request records the exception. Where a rule here and a comment in a stylesheet disagree, this file wins.

Phase E1 points `CLAUDE.md` at this file.

## 1. Sources of truth

- **Figma file "Master UX-UI New Brand Eleven Labs Inspired"** (`dQ8bQq3V7Bue5pvFrI2g9X`) is the visual and behavioral spec. Foundations is `4012:1192`, the Components index `4012:1193` with one page per type after it, Product components `4012:1194`, Patterns `4012:1195`, Docs `4012:1196`, and each area has its own page (`PLAN.md`, Screen map). The file `1dYWgFH2V8i9Jez2ylI3ky` is retired as a source. Component node ids are the same in both files and screen ids are not, so always pass the new key.
- **Tokens** come from the file's Primitives, Color and Scale collections through `design/tokens/master.tokens.json` and the generated `src/styles/tokens.css`. Never edit either by hand. A value the file lacks is added in Figma first, exported and regenerated.
- Read frames and components by node id (`get_design_context`, `get_screenshot`, `get_variable_defs`). Frames are 1440 wide. Compare against the file, not against memory.
- Every component board draws its variants in a Light panel and a Dark panel above the main component. Both are the spec, and so is each Pattern's Dark panel.

## 2. Multi-tenant

- The frames show sample content: workspace names, people, templates, brand colors, logos, numbers and chart data. Build the interface and leave the content to each account.
- Never seed SocialPaint's brand (colors, fonts, logos, templates, copy or imagery) into an account. New accounts start the way they start today.
- Tenant brand kits style the graphics members make. They never restyle the platform chrome, and the chrome reads only `tokens.css`.
- Shared platform art (the Brand Studio covers, the size covers, the sign-in panel art) is the same in every account and is committed as static assets.
- Interface labels in the frames are copy to use. Anything that names or counts tenant data is sample data.
- The artboard, a preview and an export are a tenant's graphic. They are never themed and never read a platform token.

## 3. Tokens

- Components read semantic tokens from the Color collection: `--surface-*` (page, raised, sunken, field, card, shell, stage, soft, inverse, overlay, scrim, skeleton), `--text-*` (`--text-item` for nav, menu, layer and form rows at rest, CJ, 2026-11-25), `--border-*` (subtle, strong, field, field-hover, raised, control, focus), `--action-*`, `--state-*`, `--control-*`, `--status-*`, `--feedback-*`, `--editor-selection`, `--plate-dark`, `--plate-light` and `--logo-ink`, the `--accent-*`, `--deep-*`, `--tint-*` and `--wash-*` families, `--shadow-*`, `--bevel-*` and `--glow-accent`. From Scale they read `--space-*`, `--radius-*`, `--size-control-*`, `--size-icon-*`, `--stroke-*`, `--focus-offset`, `--layout-shell-inset` and `--motion-*`. Add the elevation composites and the text style classes and that is everything.
- Never read a primitive (`--gray-900`, `--neutral-0`, `--green-slime`, `--alpha-ink-45`) in a component, and never write a raw color. The `--neutral-*` primitives exist for template content only.
- New code never reads a name from the earlier systems. `BRIDGE.md` and `docs/design/new-brand/BRIDGE.md` list them. Phase E9 deleted `legacy-bridge.css` (2026-11-23), so no bridged name exists any more.
- `npm run tokens:check` fails if any stylesheet declares a token-owned name at theme level. Override a token inside a component selector only when a frame shows that component on a different surface.
- In Light the page is off-white: `--surface-page` is gray/50 and `--surface-stage` gray/100, and cards, panels, fields, menus and the composer stay white so they lift off it. The sidebar's `--surface-shell` shares the page's gray behind its hairline (CJ, 2026-11-25). Dark keeps its values. The composer's two shadow colors, `--shadow-composer-near` (black 5%) and `--shadow-composer-far` (the primitive black 3%), are transparent in Dark (CJ, 2026-11-25).
- Themes are `[data-theme="light"]` and `[data-theme="dark"]` on `<html>`. A nested `[data-theme]` recomputes every token and composite, which is how the sign-in gate and onboarding stay Light. Logo plates do not need a nested theme any more: `--plate-dark` and `--plate-light` are the same in both themes.

## 4. Corners, spacing, sizes and elevation

Radius is a step, and each component names its step. Do not pick a step by nearest value to an old radius.

| Token | Value | Use |
|---|---|---|
| `--radius-xs` | 6 | Checkboxes and the smallest marks, the Upload thumbnail |
| `--radius-sm` | 8 | Buttons, Ghost and Outline icon buttons, inputs, selects, search, nav and menu items, table rows, builder rows, the Medium Search Field |
| `--radius-md` | 10 | Wells and thumbnails inside a card, tooltips, alerts, Upload |
| `--radius-lg` | 12 | Menus, popovers, toasts, message bubbles, card previews |
| `--radius-xl` | 16 | Cards, dialogs, metrics, panels, the preview stage |
| `--radius-full` | 999 | Filled icon buttons, Send, avatars, switches, the stepper capsule |
| `--radius-chip` | 10 | Chips, badges, Platform Chips, the Large Search Field |
| `--radius-tile` | 8 | The logo tile inside a Platform Chip, icon tiles in option tiles |
| `--radius-tag` | 6 | Tags |
| `--radius-composer` | 27 | The chat composer, so one line reads as a pill |
| `--radius-shell` | 0 | The sidebar, which runs flush |

Spacing is named by value: `--space-2`, `-4`, `-6`, `-8`, `-12`, `-16`, `-20`, `-24`, `-32`, `-40`, `-48`, `-64`, `-96`. A gap the frames draw off this scale is kept as drawn and noted in the pull request.

Controls share four heights: `--size-control-xs` 24 (badges, tags), `--size-control-sm` 28, `--size-control-md` 36 and `--size-control-lg` 44. The filter bar is the one exception: Platform Chips and the Large Search Field are `--size-control-lg` plus a hairline edge on each side, 46 in all. Give a control its height from the token and center its content. Never build a control's height from padding around its label.

Raised surfaces are flat. A card, panel, metric or the sidebar draws its edge with a `--border-raised` hairline. The composer keeps its hairline and also lifts in Light on `--elevation-composer`, transparent in Dark (CJ, 2026-11-25). Cards on `--surface-card` (the template, builder template, recent and history cards, and Brand Studio's cards) are the exception, and the one resting surface with a shadow: white in Light, with a `--stroke-thin` edge in `--border-card` and `--elevation-card` sitting under the bottom edge (CJ, 2026-11-24). Every other shadow is for something that floats.

| Composite | Figma style | Use |
|---|---|---|
| `--elevation-1-raised` | Elevation/1 Raised, every layer transparent | Kept so raised components keep one rule. It draws nothing |
| `--elevation-card` | Elevation/Card, 0 2 2 -1 and 0 1 3 -1 `--shadow-card` | Cards on `--surface-card`, under their thin `--border-card` edge |
| `--elevation-composer` | Elevation/Composer, 0 1 6 -1 `--shadow-composer-near` and 0 6 88 2 `--shadow-composer-far` | The chat composer in Light, tuned to CJ's reference (CJ, 2026-11-25) |
| `--elevation-2-overlay` | Elevation/2 Overlay, 0 4 16 `--shadow-floating` | Menus, popovers, tooltips, toasts |
| `--elevation-3-floating` | Elevation/3 Floating, 0 8 32 `--shadow-floating` | Dialogs |
| `--elevation-thumb` | Elevation/Thumb, 0 1 3 `--shadow-thumb` | The switch thumb and the selected segment |
| `--glow-accent-shadow` | Glow/Accent, transparent | Nothing |

Grain/Coarse has no CSS equivalent and is not built.

### A shadow is never cut off

No menu, popover, toast, dialog or thumb loses part of its shadow to a container edge, and no focus ring is cut either.

- A container that does not scroll does not clip. An element may still clip its own content (an image crop inside rounded corners, a truncated line of text).
- A container that scrolls gets 12 of padding on every side it does not scroll toward, and a matching negative margin so nothing moves. The chip rail is the model: `overflow-x: auto; padding: 12px 0 12px 12px; margin: -12px 0 -12px -12px`.
- An edge fade covers the padded box.

## 5. Type

- Every text in chrome uses one of the twenty text style classes from `tokens.css`: `.t-title-display`, `.t-title-metric`, `.t-title-page`, `.t-title-section`, `.t-title-group`, `.t-title-card`, `.t-body-l`, `.t-body-m`, `.t-body-s`, `.t-label-l`, `.t-label-m`, `.t-label-s`, `.t-label-xs`, `.t-caption-m`, `.t-caption-s`, `.t-mono-display`, `.t-mono-m`, `.t-mono-s`, `.t-mono-eyebrow`, `.t-mono-code`. Title/Display is 40 now, down from 44.
- All twenty trim to cap height, so spacing is measured from the letters, the way the frames measure it, and a control's height comes from `--size-control-*` with its label centered.
- No inline font sizes, weights or tracking, and no Tailwind text-size utilities in chrome.
- An `<input>` and a `<textarea>` take no text style class. `primitives.css` sets their type from the style's variables.
- A trim needs a block, so put the class on the text's own element.
- Inter Tight Regular sets reading text and Medium sets controls and titles. Geist Mono Regular sets the mono styles. Nothing is set below 11.
- Chrome faces are self-hosted under private " Platform" names, so a tenant's font cannot collide with them.
- Text and icons use `--text-primary`, supporting text `--text-secondary`, and `--text-disabled` is for disabled controls only. Nav Items (the sidebar and the Settings rail), Menu Items and the builder's Layer and Form Rows rest on `--text-item`, icons included, and lift to `--text-primary` on hover and selected. Metadata, labels, placeholders, header titles and footer links stay on `--text-secondary` (CJ, 2026-11-25).

## 6. Interaction states

Each component's board is the spec for its states in both themes.

- **Hover and pressed** change color. Hover does nothing else, and pressed also shrinks a Button, Icon Button, Send Button, Chip or Platform Chip to 0.97 (`PROMPT.md` section 7.5). Each action has its own tokens (`--action-primary-hover` and `-pressed`, and the same for neutral, accent and danger). Rows, ghost controls, menu items and nav items use `--state-hover` and `--state-pressed`. Three exceptions are drawn and built as drawn: a Switch, Checkbox or Radio hovers with a `--state-pressed` halo 4 larger than the control; a field (Input, Select, Text Area, Upload) hovers by moving its hairline from `--border-field` to `--border-field-hover`; the builder's Element Tile lays `--state-hover` over its fill. A card you click as a whole grows to 1.01 on hover, with its edge unchanged, and a pointer press shrinks it to 0.98 (CJ, 2026-11-24 and 2026-11-25).
- **Rest** for a field is `--surface-field` with a `--border-field` hairline. Nothing about a field's rest state is a filled gray any more.
- **Selected** is for things that stay chosen: `--state-selected` on rows, nav items, menu items and ghost icon buttons, `--action-neutral-pressed` on Filled and Outline icon buttons, `--surface-inverse` under `--text-inverse` on a Chip or Platform Chip, and `--control-thumb` with `--elevation-thumb` for a segment in its track. On, a switch, checkbox or radio is `--control-on` with `--control-on-mark`. Off, a checkbox or radio is `--surface-raised` with a `--border-control` edge.
- **Icons** in a Nav Item sit on `--text-item` at rest (CJ, 2026-11-25), and in an Outline icon button and the sidebar's Ghost icon buttons on `--text-secondary`, all lifting to `--text-primary` on hover and selected. Everywhere else an icon takes the color of the label beside it.
- **Open** menus count as selected for the control that opened them.
- **Disabled** controls take their own colors: `--action-disabled` under `--text-disabled`, with no hover. Never dim with opacity.
- **Focus** is the keyboard ring on `:focus-visible`: `var(--stroke-focus)` of `--border-focus`, `var(--focus-offset)` outside the element, on every interactive control, text fields included.
- **Error**: a destructive action is `--action-danger` under `--action-on-danger`. Error text is `--feedback-error-text`, a field's error edge is `--feedback-error`, an alert's ground is `--feedback-error-surface`. Warning has the same three roles.
- **Loading** keeps its shape. Lists and cards load as skeletons on `--surface-skeleton`, pulsing on `--motion-duration-pulse`. A busy button shows its spinner only once the wait passes 400 ms, and an upload that runs past 400 ms pulses its tile.
- **Motion** is for things that open, close or move, with reduced motion setting durations to zero. Hover never animates beyond the color change. Every duration and curve is a motion token. A press, a check and an icon swap follow the pointer and land at once from the keyboard, a toast, a result, an upload and new numbers play for everyone, and nothing animates on first paint. An arrow only ever fades.
- **The liquid selection.** A Segmented Control's thumb travels to a new choice with a drop trailing it when the pointer picks it (`PROMPT.md` section 7). The keyboard, reduced motion, first paint and a resize place it at once.
- **The microinteractions.** The Toast eases in and waits while the pointer or focus is on it, icons swap with a drawn check, the checkbox mark draws in, controls shrink while pressed, results and uploads develop in, and Insights numbers roll (`PROMPT.md` sections 7.2 to 7.7, `reference/microinteractions.html`).
- **The template card** steps through its variations on hover and keyboard focus. With reduced motion on it shows its first variation only.

## 7. Brand color in chrome

The interface is gray. The primary action is ink (`--action-primary` under `--action-on-primary`), and Send is the same (`--action-accent`). Use one Primary button per view. Brand color appears only where a frame draws it, through the semantic token that frame uses: the Positive and Active badges (`--status-*`), the logo, chart series, the Brand Studio covers. It never carries meaning on its own. Error red, warning amber and the editor's selection blue are functional signals and keep their meaning.

## 8. Icons and hit areas

- Use the icon the component uses. The set is the 62 lucide icons on the Icons board, each at 16 and 18. Controls use `--size-icon-sm` and navigation uses `--size-icon-md`. The Search Field keeps its 20 glyph, and its clear is a Small Ghost Icon Button with `Icon/x`.
- A hit area is at least 24 by 24 even when its glyph is smaller.
- Every icon-only control has an accessible name.

## 9. Copy

- Sentence case. Second person. No exclamation points. No em dashes.
- No "it's not X, it's Y" constructions, no three-part rhetorical lists and no runs of sentences that open the same way.
- Never "ship" or "shipped". No testimonials or quotes from invented people. No bracketed placeholders.
- No helper copy. Nothing in the interface explains how the interface works. Page headers are a title alone, and Field's help text stays off.
- Fields show an error when the value is invalid or a required value is missing. A label row may carry "Optional" or a text action.
- "Variations", never "looks", in every string the interface shows. The variations bar reads Variation 1, Variation 2 and Variation 3.
- Terms of Service and Privacy Policy sit at the bottom of every page.
- Strings the frames do not show are proposed copy: list them in the pull request for CJ to confirm.

## 10. Structure

Measured from the frames at 1440. Fixed sizes stay fixed and everything marked "fills" takes what is left. Below desktop width, today's behavior on the new tokens. The Layout board on Foundations (`6216:488`) draws the shell to scale, and `PROMPT.md` section 4 lists its measures.

### The app frame

| Part | Measure |
|---|---|
| Viewport | No padding. `--layout-shell-inset` is 0, so the sidebar and Main meet the window and each other. At 1024 and wider the document does not scroll, Main does |
| Sidebar | 300 wide plus a hairline right edge in `--border-raised`, 76 collapsed, full height, on `--surface-shell`, the page's own gray in Light. 20 padding, 24 between its groups. The Logo in a 28 header beside the theme toggle and a collapse button, 8 apart. Collapsed, the lockup's mark above Expand. Nav Items 36 tall, 4 apart. The account row at the bottom with a settings button. The theme toggle, Collapse, Expand and Settings are Ghost Small icon buttons (CJ, 2026-11-25) |
| Main | Fills, on `--surface-page`, off-white in Light (CJ, 2026-11-25) |
| Page header | 64 tall, with no hairline under it (CJ, 2026-11-25). A 36 row centered in it, 32 at the sides. The area's icon at 18 on `--text-secondary`, then the page name in Label/M on `--text-secondary` (a top-level page) or the Breadcrumb (one level down). Actions on the right 8 apart |
| Content | 24 at the top, 32 at the sides. Sections 32 apart. The header row, the content and the footer links scroll together inside Main, and nothing sticks (CJ, 2026-11-16) |
| Footer Links | Centered at the bottom of the content on every page, 16 above Main's foot. A page that scrolls its own region and sets its own links keeps the same 16 under its content (CJ, 2026-11-18). The frames draw none, and decision 14 keeps them |

A dialog's close button sits in its top right corner.

### Areas

Each area keeps the new-brand structure (`docs/design/new-brand/RULES.md` section 10) except where its frames now draw something else. These are the differences known when this kit was made. Read the frames for everything else.

| Area | What changed |
|---|---|
| Brand Templates | The filter bar is 46: the Large Search Field, then Platform Chips 8 apart. Template cards are on `--surface-card` with the thin card edge and `--elevation-card`, 8 padding, the preview inset on `--radius-lg` under a `--border-subtle` hairline ring |
| Fill page | The preview stage on `--surface-stage` at `--radius-xl` with 40 padding. The Details panel is 380 on `--surface-raised` with a `--border-raised` hairline, 20 padding, the Variation picker first, fields 24 apart with each label 12 above its control, Download PNG pinned to the bottom |
| Generate | Start has a header row with the Generate title, and its column is one 720 column. The composer is one line on `--radius-composer` between the plus and Send, with the stepper beside Send, and attachments and details stack above the line. Recent cards are on `--surface-card` with the thin card edge and `--elevation-card`. The Result Card's stage is `--surface-stage` |
| Template Builder | The editor's bar is the 64 header row now, with no hairline under it (CJ, 2026-11-25), with the breadcrumb, the save status, the mode switch and Publish, where the earlier editor drew its own 44 bar. Rail and inspector are flat panels with `--border-raised` edges. The stage is `--surface-stage`, with the variations bar floating under its top edge. The inspector is 320 |
| Brand Studio | Logo plates read `--plate-dark` and `--plate-light`. The progress strip, the section cards and the color, logo, image and import cards take the thin card edge and `--elevation-card` |
| Settings and Insights | Settings Cards and Metrics are flat with `--border-raised` edges |
| Sign in and Create account | Light only. Fields rest on `--surface-field` with a hairline |

## 11. What no phase touches

- `SchemaRenderer`, `renderSchemaBlob`, `exportSchemaPng` and `canvasGesture.ts`, beyond class names on the chrome around them.
- `TemplateSchema`, `TemplateField`, `LayoutGroup`, `BrandKit` and every table column. If a frame needs data the types cannot carry, build everything else and propose the exact shape in the pull request.
- Tenant data, starter templates' content and anything a new account is seeded with.
- `docs/brand-system/` and the work it has in flight. Where a frame and that program disagree, list the difference in the pull request.
- Data names: when a component takes the word "variation" (`VariationTile`), data types and columns keep their names.
- The "Chat box options" frame (`6023:4409`).
- Anything outside the phase you are in. Report it instead.

Migrations stay additive, and Edge Function mirrors stay byte-identical to their twins.

## 12. How every phase works

1. Read `PLAN.md`, this file, `BRIDGE.md` and the phase prompt in full, then build. CJ dropped plan mode and the recon gates for this program (2026-11-17), so no phase stops for a plan or for answers. Take the recommended answer to each open question a phase lists and record it in the pull request.
2. Capture the baseline: `npm run shots -- capture .shots/before`, and `npm run shots -- props .shots/props-before.json` when the phase claims values stay put.
3. Work in steps. Run `npm run verify` and commit after each one, with a message that names the phase and step. Never start a step on a red build.
4. The gate: `npm run verify` and `npm run build` pass, the screenshot comparison shows only the expected changes, the changed screens match their frames in Light and in Dark, no shadow or focus ring is cut off, and a keyboard pass finds the ring on every control.
5. Run the `phase-reviewer` subagent before opening the pull request, and the `fidelity-checker` subagent when the phase touches anything near rendering, export, import or template types.
6. One pull request into `main` per phase, listing what changed, the screenshot report, the answer taken to each open question, every exception to the frames or these rules, and any proposed copy.
7. If something turns out to be impossible or wrong once you are in the code, build the closest thing the frames allow and explain the conflict in the pull request instead of improvising a different design. Stop and ask only before something that cannot be undone.

## 13. Known open items

- Field edges read 1.23:1 in Light (`--border-field` on white) and 1.38:1 in Dark. WCAG 1.4.11 asks 3:1 for the boundary that identifies a control. Every field has a visible label above it, so the ElevenLabs look is kept, and raising the edge is CJ's call.
- White on `--action-danger` read 3.80:1 on red 600. Since 2026-11-24 the fill is red 700 and reads 5.55:1 (hover red 800; pressed red 950 in Light, red 800 in Dark).
- Disabled text reads 2.52:1 in Light and 3.72:1 in Dark. Disabled controls are exempt.
- `--text-secondary` reads 5.11:1 on the off-white page, 4.89:1 on `--surface-stage`, 5.33:1 on cards and 4.63:1 on `--surface-sunken` in Light, and 7.85:1 on the page in Dark (CJ, 2026-11-25). `--text-item` reads 12.10:1 on the page and 11.59:1 on the `--state-hover` row in Light, and 12.64:1 on the shell in Dark. Primary buttons read 19.17:1 in Light and 18.36:1 in Dark.
- The Insights digest draws `--surface-scrim` at its full 50% over its art, where the frame draws 35%. White text there measured 4.56:1 at its lightest spot at 2x, in both themes (CJ, 2026-11-25).
