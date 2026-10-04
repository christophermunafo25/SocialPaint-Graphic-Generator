# New look: rules for every phase

Every phase prompt includes these rules by reference. Where a rule here and the Figma file disagree, the file wins and the phase prompt records the exception. Where a rule here and the header comment of `src/styles/socialpaint.css` disagree, this file wins; the header is rewritten in Phase 9.

## 1. Sources of truth

- **Figma file "Master UX-UI"** (`mEJRslarcQDkgPeY6AObi5`) is the visual and behavioral spec. Master Design System is page `3:15162`, Master UI Elements is page `24:674` (the Interaction states table is `105:641`), and each area has its own page (the screen map in `PLAN.md`).
- **Tokens** come from the file through `design/tokens/master.tokens.json` and the generated `src/styles/tokens.css`. Never edit either by hand. A value the file lacks is added in Figma first, exported, and regenerated (`README.md`, "Updating tokens").
- When the Figma MCP server is connected, read frames and components by node id (`get_design_context`, `get_screenshot`). The frames are 1440 wide.

## 2. Multi-tenant

- The Figma screens show sample content: workspace names, people, templates, brand colors, logos, numbers and chart data. Build the interface and leave the content to each account.
- Never seed SocialPaint's brand (colors, fonts, logos, templates, copy or imagery) into an account. New accounts start the way they start today.
- Tenant brand kits style the graphics members make. They never restyle the platform chrome, and the chrome reads only `tokens.css`.
- The one exception is the Brand Studio cover images: shared platform art, the same in every account, committed as static assets.
- Interface labels in the frames ("Brand Templates", "Add workspace", "Download PNG") are copy to use. Anything that names or counts tenant data is sample data.

## 3. Tokens

- Components read semantic tokens: the Brand names (`--surface-*`, `--text-*`, `--border-*`, `--state-*`, `--overlay-*`, `--btn-primary-*`, `--input-bg`, `--control-*`, `--switch-*`, `--status-*`, `--chip-*`, `--tag-*`, `--accent-*`, `--field-*`, `--tint-*`, `--wash-*`, `--ring`), the radius and spacing tokens, the elevation composites and the type classes.
- Never read a primitive (`--ink-900`, `--slime`, `--paper-075-08`) in a component, and never write a raw color.
- New code never reads a legacy name. `BRIDGE.md` lists them; a phase removes the legacy names its pages stop using.
- `npm run tokens:check` fails if any stylesheet declares a token-owned name at theme level. Override a token inside a component selector only when a frame shows that component on a different surface.
- Themes are `[data-theme="light"]` and `[data-theme="dark"]` on `<html>`. A nested `[data-theme]` recomputes every token and composite, so a light panel inside the dark app works without extra rules.

## 4. Corners, spacing and elevation

| Token | Value | Use |
|---|---|---|
| `--radius-xs` | 2 | Swatch chips and hairline details |
| `--radius-control` | 7 | Default and Small buttons, nav and rail items, segments, square-cornered chips, row menu triggers |
| `--radius-menu-item` | 7 | Rows inside menus and popovers |
| `--radius-control-md` | 9 | Inputs, selects, tab tracks, filters, Large and Medium buttons, the tooltip |
| `--radius-media-plate` | 15 | Media or wells set 8 in from a card edge |
| `--radius-menu` | 16 | Menus, popovers, the message bubble, the toast |
| `--radius-card` | 20 | Cards, the composer, the editor panel, the sidebar, modals |
| `--radius-pill` | 999 | Tags, status chips, switches, round icon buttons, the send button |

Figma smooths card and inset corners (0.6). CSS has no equivalent; use the plain radius.

Spacing comes from `--space-3xs` (4), `--space-2xs` (8), `--space-xs` (12), `--space-sm` (16), `--space-md` (24, default card padding), `--space-lg` (32), `--space-xl` (48), `--space-2xl` (64) and `--space-3xl` (96). A gap the frames draw off this scale is kept as drawn and noted in the PR.

| Composite | Figma style | Use |
|---|---|---|
| `--elevation-small` | Elevation/Small, 2/2 blur 8 | Cards, the sidebar, the composer, result cards |
| `--elevation-medium` | Elevation/Medium, 4/4 blur 16 | Menus, modals, tooltips, toasts |
| `--elevation-large`, `--elevation-floating` | 6/6 blur 25, 8/8 blur 32 | Only where a frame uses them |
| `--elevation-thumb` | Elevation/Thumb | The selected segment or tab on its track |
| `--glow-hint` | Glow/Hint | The plus hint, and nothing else |

Small, Medium, Large and Floating carry the Dark bevel (white at 15% on the top edge, 10% on the bottom). Do not add a separate edge or highlight layer. Grain/Coarse has no CSS equivalent and is not built.

## 5. Type

- Every text in chrome uses a text style class from `tokens.css`: `.t-title-page`, `.t-body-m`, `.t-label-s`, `.t-mono-eyebrow` and the rest, one per Figma style. Add `.t-trim` where the frame uses a "Trimmed/" style.
- No inline font sizes, weights or tracking, and no Tailwind text-size utilities in chrome.
- Raveo Display Regular (400) sets reading text and Display Medium (500) sets controls and titles. Nothing in chrome is heavier. Geist Mono sets the mono styles; Mono/Code maps to the same face.
- Text and icons use `--text-strong` by default. `--text-primary` (`#272727`) stays for data marks.

## 6. Interaction states

The Interaction states table (`105:641`) is the spec. Each component is drawn there in Light and Dark with its static, hover, selected or pressed, and focus looks.

- **Hover** lays a tint over the fill and changes nothing else. Build it as a background layer over the base color, for example `background: linear-gradient(var(--state-hover), var(--state-hover)), var(--control-fill)`, or as `background: var(--state-hover)` when the base is transparent.

| Tint | Light | Dark | On |
|---|---|---|---|
| `--state-hover` / `--state-pressed` | ink 5% / 10% | white 6% / 12% | Neutral fills, rows, ghost buttons, tracks, fields |
| `--state-hover-inverse` / `--state-pressed-inverse` | white 6% / 12% | ink 5% / 10% | Fills that flip between modes: the primary button, Attach, a switch that is on |
| `--state-hover-on-color` / `--state-pressed-on-color` | ink 5% / 10% | ink 5% / 10% | Slime and red fills: Send and Destructive |

- **Pressed** is for actions (buttons, chips, icon buttons) and doubles the tint.
- **Selected** is for things that stay chosen. The label goes to `--text-strong`, the item keeps its look on hover, and the fill depends on the surface underneath: `--state-selected` on raised surfaces (nav item, menu item, ghost icon button, the Settings gear), `--control-fill` on the page (settings rail item), `--control-thumb` with `--elevation-thumb` in a track (segment, tab), and ink for chips (`--chip-selected-bg` for platform chips, `--surface-inverse` under `--text-inverse` for choice chips).
- **Open** menus count as selected. Select, Filter and Compact select hold the pressed tint while their menu shows. The row menu trigger keeps `--surface-sunken` while open.
- **Disabled** is 40% opacity with no hover. The Stepper button uses 32%.
- **Previews** (result, template, recent and history cards) dim under `--overlay-hover` (Deep Moss at 35%) on hover and on keyboard focus, and show the Edit button: `--overlay-control` with an `--overlay-control-fg` icon.
- **Look tiles** take a 1 px ring 2 px out: `--border-strong` on hover, `--text-strong` when selected.
- **Focus** is the keyboard ring on `:focus-visible`: `var(--focus-width)` (1 px) of `--ring` (ink in Light, white in Dark), `var(--focus-offset)` (2 px) outside the element. Chip, Platform chip, Tag, Segment, Tab, Settings rail item and Look tile draw it against their edge (`box-shadow: 0 0 0 var(--focus-width) var(--ring)`). Text fields show the caret and nothing else. Menu items and previews show their hover look. Never remove a focus style without its replacement.
- **Error red** is `--state-error`: `#D43535` in Light under `--text-inverse` (white), `#EC5656` in Dark under `--text-inverse` (ink).

## 7. Brand color in chrome

Use a brand color only where a Master frame draws one, through the semantic token that frame uses: the primary action (`--btn-primary-*`), the Connected and Active pills (`--status-*`), the plus hint (`--glow-hint`), the logo, chart series, the Brand Studio covers and the decorative glows. Never pick a brand color to signal state on your own. Error red and the editor's selection blue are functional signals and keep their meaning.

## 8. Icons and hit areas

- Use the icon the Master component uses. The `icon/…` sets are lucide at 16 px (stroke 2) and 18 px (stroke 1.5). Custom glyphs that already exist in the code stay.
- A hit area is at least 24 by 24 even when its glyph is smaller (the search clear button and the detail tag remove button are drawn at 14).

## 9. Copy

These apply to every string a phase adds or changes in the interface.

- Sentence case. No exclamation points. No em dashes.
- No "it's not X, it's Y" constructions, no three-part rhetorical lists and no runs of sentences that open the same way.
- Never "ship" or "shipped". No testimonials or quotes from invented people. No bracketed placeholders.
- No explanatory helper copy under titles. Page headers are a title alone.
- Fields show an error when the value is invalid or a required value is missing. No hint or helper text.
- A field's label row may carry what the Field draws: Edited, "Optional", or a text action such as "Copy text". These are markers and actions, not hint text; problems with the value go on the error line.
- Strings the frames do not show are proposed copy: list them in the PR for CJ to confirm.

## 10. How every phase works

1. Read `PLAN.md`, this file, `BRIDGE.md` and the phase prompt in full before writing code.
2. Before changing anything, capture the baseline: `npm run shots -- capture .shots/before` and, when the phase claims values stay put, `npm run shots -- props .shots/props-before.json`.
3. Work in the prompt's steps. Run `npm run verify` and commit after each one, with a message that names the phase and step. Never start a step on a red build.
4. The gate: `npm run verify` and `npm run build` pass, the screenshot comparison shows only the changes the phase expects, the changed screens match their frames in both themes, and a keyboard pass over the changed screens finds a visible focus on every control.
5. Open one pull request into `main` per phase. The description lists what changed, the screenshot report, every exception to the frames or to these rules, and any proposed copy.
6. If something in a prompt turns out to be impossible or wrong once you are in the code, stop and explain the conflict instead of improvising a different design.

## 11. Known open items

- The Dark filter tag label reads 4.15:1 on hover (text/secondary over the hover tint). It is drawn that way in the file; the phase that builds Tag records it in its PR.
- The Light nav hover (`#F3F3F3` over the sidebar) reads darker than the selected Paper pill (`#F9F9F8`). The full-ink label tells them apart, as drawn.
