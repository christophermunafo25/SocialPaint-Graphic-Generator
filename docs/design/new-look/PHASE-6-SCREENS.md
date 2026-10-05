# New look, Phase 6: screen reference

Read from the Figma file "Master UX-UI" (`mEJRslarcQDkgPeY6AObi5`), page "Brand Studio" (8:676, section 13:9042), on 2026-10-05, read only. `PHASE-6.md` builds from this file; where the live file disagrees, the file wins, and `PHASE-6.md` §8 and §9 rule on what the file leaves open.

Reference images (1x, Light) in `reference/`: `brand-studio-overview.png`, `brand-studio-colors.png`, `brand-studio-colors-editing.png`, `brand-studio-colors-added.png`, `brand-studio-logos.png`, `brand-studio-logos-editing.png`, `brand-studio-logos-primary.png`, `brand-studio-fonts.png`, `brand-studio-fonts-menu.png`, `brand-studio-fonts-uploading.png`, `brand-studio-type-styles.png`, `brand-studio-type-styles-size.png`, `brand-studio-type-styles-all.png`, `brand-studio-images.png`, `brand-studio-images-uploaded.png`, `brand-studio-images-menu.png`, `brand-studio-import.png`, `brand-studio-import-importing.png`, `brand-studio-import-done.png`. The Overview's six cover images, as exported from Figma, are in `reference/covers/`.

None of the 38 frames uses Master component instances: every part is a plain frame. The mappings to primitives below are by look and measurement. Every frame's page layer is named `sp-page · Generate`; it is Brand Studio's page.

Contents: Part A, Overview and Colors; Part B, Logos and Fonts; Part C, Type styles; Part D, Images and Import. Each part ends with its behaviour differences against today's code, the interactions the frames drop, the primitives, and its open questions, which `PHASE-6.md` §9 turns into decisions.

---

# Part A: Overview and Colors

Source: Figma "Master UX-UI" (`mEJRslarcQDkgPeY6AObi5`), page "Brand Studio" (8:676), read on 2026-10-05, read only. All frames 1440×1053. Sidebar (`sp-nav`, x 0–335) ignored. The page area (`sp-page · Generate`, misnamed in every Brand Studio frame) starts at x 335 and is 1105 wide.

| Frame | Light | Dark | Screenshot (Light, 1440) |
|---|---|---|---|
| Brand Studio · Overview | 13:9043 | 13:9176 | `brand-studio-overview.png` |
| Brand Studio · Colors | 13:9309 | 13:9853 | `brand-studio-colors.png` |
| Brand Studio · Colors · Editing | 13:9470 | 13:13306 | `brand-studio-colors-editing.png` |
| Brand Studio · Colors · Added | 13:9657 | 13:13493 | `brand-studio-colors-added.png` |

Read this first:

- **No Master instances in any of the eight frames.** Cards, the setup strip, the color popover, the role choices, the Undo and Save buttons and the toast are plain frames. The mappings to primitives below are by look and measurement; most of them land exactly on an existing Phase 2 primitive.
- **Who sees Brand Studio:** admins only. `brandStudio` is in `ADMIN_ONLY` (`src/app/router.tsx:334-340`) and the Sidebar item is `adminOnly: true` (`src/app/components/Sidebar.tsx:64-70`). A member who opens `/brand-studio…` sees the Brand Templates gallery with the address unchanged (`screenFor`, `router.tsx:344`; `App.tsx:250`).
- **Routes:** `/brand-studio` is the overview; `/brand-studio/:category` with `colors | logos | typography | type-styles | images | import` is the detail page (`router.tsx:24-32`, `267-279`). `typography` displays as "Fonts" (`categories.ts:19-26`). The draft lives in `admin/BrandStudio.tsx` above both steps, so moving between overview and detail never reloads it.
- **Codegen vs style names on shadows.** Codegen prints raised cards and the strip as `drop-shadow 2/2/4` and the popover and toast as `drop-shadow 4/4/8`. The bound effect styles are **Elevation/Small** (2/2 blur 8) and **Elevation/Medium** (4/4 blur 16); codegen halves the blur when it converts a Figma radius to a CSS `drop-shadow` filter. Use `--elevation-small` and `--elevation-medium`.
- **Codegen vs Light raw values.** Light frames write many fills raw (`bg-white` on cards, `#0b0b0c` text, `#f1f1ef` inputs, `#f9f9f8` page). Dark binds the same layers to variables. Each raw value below is mapped to the token the Dark twin binds.
- **Raised cards in Dark gain the lit edge**: a `--border-raised` stroke of 0.65 top / 0.25 sides / 0.55 bottom. Light's `--border-raised` is transparent. Phase 5 recorded the same (PHASE-5-SCREENS, Part C, Dark differences); treat it the same way here.

---

## 1. Brand Studio · Overview (13:9043)

### Page layout (`sp-page` 13:9116, 1105 wide)
- Column. Padding top 45, bottom 28, x 0; the header and content carry their own x 45. Content width 1015.
- `PageHeader` (13:9117): the title alone, 36 tall at y 45.
- `Brand Studio content` (13:9120): column, gap **24**, padding-top **24**, x 45, flex 1.
  1. `sp-setup-strip` (13:9121), y 105, 1015 × 68.
  2. `sp-brand-overview-grid` (13:9134), 24 below the strip, 1015 × 592.
- `Footer links` (13:9173) at the bottom of the page column (y 1010): row, gap 16, centred, "Terms of Service" and "Privacy Policy", 12 Regular / 1.25 → `.t-caption-s`, `--text-secondary`, **not underlined**.

### Title (13:9119)
- "Brand Studio". 30 Medium / 1.2 / −0.6 px → `.t-title-page`, `--text-strong`. No eyebrow, no sub-line.

### Setup strip (`sp-setup-strip` 13:9121)
- 1015 × 68. Row, space-between, items centred. Padding **16 / 24** (`--space-sm` / `--space-md`). Radius 20 (`--radius-card`). Fill `--surface-raised` (Light raw `white`). Elevation/Small. Dark: plus the `--border-raised` edge.
- `progress` (left), column, gap **10** (off scale):
  - `status` row, **items baseline, gap 12** (`--space-xs`), both on ONE line:
    - "4 of 5 sections ready": 14 Medium / 1.25 / −0.14 px → `.t-button-m` (Label/M has 0 tracking; Button/M has −0.01em), `--text-strong`. Codegen fixes its width at 129.
    - "Images is still empty.": 12 Medium / 1.4, `--text-secondary`. **No exact class**: nearest `.t-label-xs` (12 Medium / 1.25). Codegen fixes its width at 112.
  - `bars`: row, gap 4 (`--space-3xs`). Five bars, each **32 × 4, radius 2** (`--radius-xs`).
    - Ready (4): `--surface-inverse` (Light ink, Dark white).
    - Not ready (1): `--surface-sunken`.
- `sp-button · Upload images` (13:9132): 36 tall, padding x 16, radius 7, `--btn-primary-bg` / `--btn-primary-fg` (Light Deep Moss + Slime, Dark Slime + Deep Moss). Label 14 Medium / −0.14 px → `.t-button-m`. → **Button kind `primary`, size `default`**. Drawn as a prototype link.
- The sample reads the code's own copy: the reason "Images is still empty." and the action "Upload images" are exactly `BrandOverview.tsx:88-89`.

### Category grid (`sp-brand-overview-grid` 13:9134)
- Two rows of three, **gap 16** both ways (`--space-sm`). Each card is 327.67 × 288 (flex 1).
- `sp-overview-card · …` (all six identical in build):
  - Padding 8 (`--space-2xs`), radius 20 (`--radius-card`), `--surface-raised` (Light raw `white`), Elevation/Small; Dark adds the `--border-raised` edge. Column. Drawn as a link (`<a>`); the whole grid has `cursor: pointer`.
  - `cover`: full width (311.67) × **208**, radius **15** (`--radius-media-plate`), an image fill drawn with `object-fit: cover`. 311.67 / 208 = 1.498, so 3:2. **No border on the cover.**
  - `meta`: padding **t 16 / b 8 / x 8**, overflow clip. Inside, `text` is a **column, gap 4**:
    - Title: 15 Medium / 1.25 / −0.15 px → `.t-label-l`, `--text-strong`, ellipsis.
    - Meta: 12 Medium / 1.4, `--text-secondary`, ellipsis. No exact class (nearest `.t-label-xs`).
  - So the title sits 16 below the cover, 16 in from the card edge (8 + 8), and the meta ends 16 above the card's bottom edge (8 + 8).
- **No hover, focus or edit-overlay state is drawn** for the cards.

### Cards, text and cover images

The cover is a **raster image fill (PNG)** on each `cover` frame; codegen renders it as an `<img>` with `object-cover`. All six covers are new art (soft gradients with a floating glass UI motif), not the art in the repo today (the repo's covers are flat lilac grid illustrations; for example `brand-studio-cover-logos.webp` is a purple "Ab" tile on a lilac grid). The Light and Dark frames show the same art; the asset URLs differ per frame, so byte identity can only be confirmed after download. The six fills were downloaded on 2026-10-05 into `reference/covers/` (PNG, as exported; Import's at 2x). The Light and Dark fills are byte-identical, so there is one set.

| Card | Title | Meta (sample) | Card node (L / D) | Cover node (L / D) | What the cover shows | Light export | Dark export |
|---|---|---|---|---|---|---|---|
| Colors | Colors | 10 colors | 13:9136 / 13:9269 | **13:9137** / 13:9270 | Mint-to-green gradient; a glass palette card with five swatches (moss, slime, pale green, pale blue, lilac) and a "#17FF7E" chip | `reference/covers/brand-studio-cover-colors.png` | same bytes as Light |
| Logos | Logos | 3 logos | 13:9142 / 13:9275 | **13:9143** / 13:9276 | Teal-to-cyan gradient; two overlapping "Ab" app tiles, navy and white | `reference/covers/brand-studio-cover-logos.png` | same bytes as Light |
| Fonts | Fonts | 4 fonts | 13:9148 / 13:9281 | **13:9149** / 13:9282 | Violet-to-pink gradient; a white specimen tile "Aa" in Deep Moss with "Aa Bb Cc Dd Ee Ff" | `reference/covers/brand-studio-cover-fonts.png` | same bytes as Light |
| Type styles | Type styles | 4 styles | 13:9155 / 13:9288 | **13:9156** / 13:9289 | Lavender-to-indigo gradient; a white card "Headline / Subhead" over grey text lines | `reference/covers/brand-studio-cover-type-styles.png` | same bytes as Light |
| Images | Images | Empty | 13:9161 / 13:9294 | **13:9162** / 13:9295 | Pink-to-coral gradient; two overlapping photo cards of smiling people outdoors | `reference/covers/brand-studio-cover-images.png` | same bytes as Light |
| Import | Import | Figma or JSON | 13:9167 / 13:9300 | **13:9168** / 13:9301 | Cyan-to-periwinkle gradient; a white file chip "{ } brand-kit.json" with a Slime progress bar | `reference/covers/brand-studio-cover-import.png` | same bytes as Light |

- Titles are interface copy (the category names, as `CATEGORY_TITLES`). The meta line is sample data except "Empty" and "Figma or JSON", which are the code's own words in sentence case.
- The cover slot is 311.67 × 208 at 1x in the frame; it flexes with the column in the build. The repo's current covers are 708 × 474 WebP (`src/assets/socialpaint/brand-studio/`, committed in 27dd530, 2026-09-15). Export the new ones at 2x of the slot or larger (at least 624 × 416, ideally the source resolution) and keep them under the same six file names so `BrandOverview.tsx:11-16` keeps its imports.
- The Images cover contains photographs of people. PLAN decision 6 and RULES §2 make the covers shared platform art in every account; see Open questions on the photo's licence.

### Dark differences (beyond token flips)
1. Cards and the strip gain the `--border-raised` edge (0.65 / 0.25 / 0.55).
2. Upload images inverts (Slime fill, Deep Moss label). This is `--btn-primary-*` per theme, a token flip.
3. Ready bars turn white (`--surface-inverse`), not-ready bar `#2f3133` (`--surface-sunken`). Token flips.
4. The covers do not change between themes.

---

## 2. Brand Studio · Colors (13:9309)

### Page layout
- Same page column as the Overview: padding top 45, bottom 28; content x 45, width 1015; content column gap 24, padding-top 24.
- `PageHeader` (13:9383): 1105 × 36, row, space-between, items centred, padding x 45. **The breadcrumb takes the title's place; there is no separate page title.**
- `Brand Studio content` (13:9395): `sp-colors-grid`, then `sp-roles-summary` 24 below.
- Footer links as on the Overview.

### Header
- `Breadcrumb` (13:9384): row, gap 8 (`--space-2xs`), items centred.
  - "Brand Studio": a link, 14 Medium / 1.25 → `.t-label-m`, `--text-secondary`, **not underlined**.
  - "/": 14 Regular / 1.4 → `.t-body-s`, `--text-secondary`.
  - "Colors": 14 Medium / 1.25 → `.t-label-m`, `--text-strong` (Light raw `#0b0b0c`).
  - This is exactly `BreadcrumbHeader` (`src/app/components/layout/Breadcrumb.tsx`, Phase 4/5).
- `Actions` (13:9388): row, **gap 16**, items centred. 207 wide.
  - "All changes saved": 13 Regular / 1.4 → `.t-body-xs`, `--text-secondary`. 103 wide.
  - `sp-chat-btn · Undo` (13:9390): 88 × 36, padding x 16, gap 6, radius 7. Icon 16 (an undo arrow, lucide `undo-2` by look) at x 16; label "Undo" 14 Medium / −0.14 → `.t-button-m`, `--text-strong`.
    - Fill: Light `--surface-sunken` (#ececec), **Dark `--surface-raised` (#171819)**. That pair is exactly `--control-fill` (Light paper-100, Dark ink-800) → **Button kind `neutralOnPage`, size `default`, icon**.
- **No ⌘Z hint** is drawn.

### Color grid (`sp-colors-grid` 13:9396)
- Column of rows, **gap 12** (`--space-xs`) between rows and between cards. **6 cards per row**, each **159.17 wide** (= (1015 − 5 × 12) / 6).
- Light sample: row 1 Slime, Ink 900, Christina, Lapis, Fire, Violet; row 2 Deep Moss, Ocean Tide, Orchid, Choco, then the Add slot. (Dark 13:9853: identical.)

#### `sp-color-card` (e.g. 13:9398)
- 159.17 × **158**. Padding 8, radius **20** (`--radius-card`), `--surface-raised` (Light raw `white`), Elevation/Small; Dark adds the `--border-raised` edge. Column.
- `swatch`: 143.17 × **88**, radius **15** (`--radius-media-plate`), fill = the tenant's hex, **1px inside stroke**: Light `rgba(11,11,12,0.08)` (= `--border-default` Light), Dark `rgba(255,255,255,0.08)` (Dark `--border-default` is paper-075 at 10%; near enough). Overflow clip.
  - Role tag (only on role holders): absolute at **8, 8** from the swatch's outer edge (codegen 7, 7 inside the 1px stroke). 21 tall, padding 3 / 8, pill, `rgba(11,11,12,0.72)` = `--tag-overlay-bg`, label 11 Regular / 1.4 white = `--text-on-fill`. Sample labels "Primary", "Secondary", "Accent". → **Tag kind `overlay`** (21 tall, px 8, `.t-caption-xs`; the frame's leading is 1.4, the class's 1.3).
- `meta`: padding **t 12 / b 4 / x 4**, **column, gap 2**, overflow clip:
  - Name: 15 Medium / 1.25 / −0.15 → `.t-label-l`, `--text-strong`.
  - Hex: 12 Medium / 1.4, `--text-secondary`, **uppercase hex in the UI face, not mono**. No exact class (nearest `.t-label-xs`).
- Sample cards (sample data):

  | Name | Hex | Role tag |
  |---|---|---|
  | Slime | #17FF7E | Primary |
  | Ink 900 | #0B0B0C | Secondary |
  | Christina | #FF3FE5 | Accent |
  | Lapis | #14E4FF | |
  | Fire | #FF3627 | |
  | Violet | #A782FF | |
  | Deep Moss | #082A23 | |
  | Ocean Tide | #05203A | |
  | Orchid | #30133D | |
  | Choco | #2F0C1F | |

- In Light only the Slime card is drawn as a prototype link (to Editing); the others are plain frames. In the build every card opens its editor.

#### `sp-add-slot · Add color` (13:9455)
- 159.17 × **156** (2 shorter than a card; codegen and metadata agree). Radius 20. **1px dashed `--text-secondary`** border, no fill, column, centred.
- Label "+ Add color": 14 Medium / −0.14 → `.t-button-m`, `--text-secondary`. One line; no detail line.
- Drawn as a prototype link (to Added).

### Roles summary (`sp-roles-summary` 13:9457)
- 24 below the grid. Row, **gap 24** between pairs. Each pair is a row, **items baseline, gap 8**:
  - Role: "Primary" / "Secondary" / "Accent", 13 Regular / 1.4 → `.t-body-xs`, `--text-secondary`, **sentence case**.
  - Color name: "Slime" / "Ink 900" / "Christina", 14 Medium / −0.14 → `.t-button-m`, `--text-strong`.

### Dark differences (beyond token flips)
1. **Undo** binds `--surface-raised` in Dark and `--surface-sunken` in Light (see above); `--control-fill` covers both.
2. Cards gain the `--border-raised` edge.
3. Swatch stroke is white 8% in Dark against ink 8% in Light.
4. Rows hug their cards (Dark row 2 is 843.83 wide: four cards and the slot). No layout difference between the twins.

---

## 3. Brand Studio · Colors · Editing (13:9470)

Same page as Colors with Slime open for editing.

### What changes on the page
- **The grid and the roles summary are blurred** (layer blur **1.5 px** on `sp-colors-grid` 13:9557 and `sp-roles-summary` 13:9612). The header (breadcrumb, save status, Undo) is **not** blurred. Dark (13:13306) blurs the same two layers (confirmed on 13:13448).
- The Slime card's grid cell is an **empty placeholder** (`slot · Slime` 13:9559, 159.17 × 158) and the card itself is drawn **above the blur** at the same place (`sp-color-card · Slime (open)` 13:9625, frame x 380, y 105 = content x 0, y 0). So the open card stays exactly where it sat, sharp, while everything else in the content blurs. No scrim.
- The open card keeps its resting look and adds a **selected ring**: `ring · selected` (13:9632), a 1px stroke **on the card's own edge** (inset 0, radius 20). Light raw `#0b0b0c`, Dark `--text-primary` (#f1f1f1); both are `--text-strong` values. This matches the Look tile's selected ring colour (RULES §6) but sits on the edge, not 2 px out.
- The open card is still drawn as a link (prototype back to Colors).

### Popover (`sp-color-popover · Slime` 13:9633)
- **300 × 249**, frame x 380, y 273: **left-aligned with the card, 10 below its bottom edge** (card bottom 263). It floats over the blurred grid; nothing reflows.
- Padding **14** (off scale), radius **16** (`--radius-menu`), `--surface-raised` (Light raw `white`), **Elevation/Medium**. No stroke in either theme.
- `fields`: column, **gap 10** (off scale), 272 wide.
  1. `sp-input · Color name` (13:9635): 272 × **32**, padding x 10, radius **7**, fill Light `#f1f1ef` / Dark `rgba(241,241,241,0.08)` = `--input-bg`. Value "Slime" 13 Regular / 1.4 → `.t-body-xs`, `--text-strong`. → **Input size `sm`** (32, px 10, `--radius-control`, `.t-body-xs`), exact.
  2. `sp-input · Color value` (13:9637): same; value "#17FF7E".
  3. `contrast` (13:9639): column, gap 2, padding x 2. Two lines, 12 Regular / 1.4, `--text-secondary`, **sentence case, UI face**: "Ink 14.7:1 passes", "White 1.3:1 fails". No exact class (nearest `.t-caption-s`, 12 Regular / 1.25).
  4. `role` (13:9642): column, gap 6, padding t 2 / x 2.
     - "Role": 12 Medium / 1.4, `--text-secondary`. No exact class (nearest `.t-label-xs`).
     - `choices`: row, wrap, gap 6. Four chips, each 24 tall, padding x 10, pill, label 12 Medium / 1.4:
       - Resting: `--surface-sunken` fill, `--text-strong` label.
       - Selected: `--surface-inverse` fill; label Light `--surface-raised` (white), Dark `--surface-page` (ink) = `--text-inverse` in both.
       - Widths: None 49, Primary 62, Secondary 79, Accent 59.
       - Here **Primary** is selected.
       - → **ChoiceChip** (24, px 10, sunken / inverse, `.t-label-xs`; the frame's leading is 1.4).
  5. `footer` (13:9653): row, space-between, items centred, padding l 2 / t 4. 32 tall.
     - "Remove": 12 Medium / 1.4, `--text-secondary`. **Plain text, no button chrome, not red.**
     - `sp-chat-btn · Done` (13:9655): 47 × 28, padding x 10, radius 7. Label **"Save"** (the layer is named Done), 12 Medium / 1.3 / −0.12, trimmed → `.t-button-s`. Light `--btn-primary-bg` / `--btn-primary-fg`. → **Button kind `primary`, size `sm`**.
- The name field is drawn **without** a selection highlight here (compare Added).

### Dark differences
1. Save in Dark: `--accent-green` fill with a `--text-inverse` label (#0b0b0c). `--btn-primary-fg` Dark is Deep Moss (#082a23). The difference is under 1% luminance; use the primary button.
2. Selected chip label binds `--surface-page` in Dark and `--surface-raised` in Light; both equal `--text-inverse`.
3. Ring: `--text-primary` in Dark, raw ink in Light; use `--text-strong`.
4. Input fill `rgba(241,241,241,0.08)` = Dark `--input-bg`. Token flip.

---

## 4. Brand Studio · Colors · Added (13:9657)

The Add slot was clicked. A new card is appended and opened.

### Grid
- Row 2 now reads Deep Moss, Ocean Tide, Orchid, Choco, **[Custom 1]**, Add color. The new card takes column 5 and the Add slot moves to column 6. (Dark 13:13493: same.)
- As in Editing, the new card's cell is a placeholder (`slot · Custom 1` 13:9803) and the card is drawn above the 1.5 px blur at frame x 1065, y 275 (content x 684.67, y 170), with the 1px `--text-strong` selected ring on its edge.
- `sp-color-card · Custom 1 (open)` (13:9819): swatch `#888888`, **no role tag**, name "Custom 1", hex "#888888". These are the code's own defaults (`newCustomColor`, `kitOps.ts:61-66`).
- In this frame the Add slot is a plain frame, not a link.

### Popover (`sp-color-popover · Custom 1` 13:9825)
- Same recipe, 300 × 249, frame x 1065, y 443 (10 below the card, left-aligned). Its right edge is at x 1365, inside the content's right edge (x 1395).
- Name field: "Custom 1" drawn **with its text selected** (`selection` 13:9828: `rgba(20,228,255,0.35)`, radius 2). This is the browser's native selection, drawn; it says the name opens focused and selected. Do not style it (it is neither `--state-selection` #0d99ff nor a token).
- Value "#888888".
- Contrast: "Ink 5.5:1 passes", "White 3.5:1 fails".
- Role: **None** selected.
- Footer: "Remove" and "Save", as in Editing.

### Toast (`sp-toast` 13:9850)
- **192 × 44**, frame x 792, y 934. **Centred on the page area** (page centre x 887.5; toast centre 888), **not on the viewport**. Its bottom is at y 978: 32 above the footer links (y 1010) and 75 above the frame's bottom.
- Row, gap 16, padding **16 / 12** (x / y), radius 16 (`--radius-menu`), `--surface-raised`, Elevation/Medium.
  - Light adds a raw **5px `rgba(255,255,255,0.25)` stroke** (invisible on the page). **Dark has no stroke** (13:13686). The Toast primitive draws 1px `--border-raised`.
- Message "Added “Custom 1”": 14 Regular / 1.4 → `.t-body-s`, `--text-strong`. Curly quotes, as the code writes them (`ColorsDetail.tsx:45`).
- Action "Undo": 14 Medium / −0.14 → `.t-button-m`, `--text-strong`, **underlined**.
- → **Toast** primitive (`Overlays.tsx`): padding 12 / 16, gap 16, radius 16, Elevation/Medium, `.t-body-s` + `.t-button-m`. Exact, except the underline (the primitive's action is a text button with the hover tint and no underline).

### Dark differences
1. Toast: no 5px stroke; otherwise token flips.
2. Card swatch stroke white 8%; ring `--text-primary`; the rest as Editing.

---

## Primitives used / not yet primitives

| Frame part | Master (by look) | Repo today | Notes |
|---|---|---|---|
| Page title "Brand Studio" | Title/Page | `PageHeader` (`layout/Page.tsx`) | Exact. `BrandOverview.tsx:116` already uses it. |
| Breadcrumb header with actions | Breadcrumb (156:748) | `BreadcrumbHeader` (`layout/Breadcrumb.tsx`) | Exact look. Its crumb is a `<button>`; today's crumb is a real `<a href>` with `useLinkClick` (cmd-click opens a tab). See Interactions the frames drop. |
| Upload images (strip) | Button 43:123, Primary, Default | `Button kind="primary"` | Exact (36, px 16, radius 7). Today: legacy `.sp-btn.sp-btn-primary`. |
| Undo (header) | Button 43:123, Neutral on page, Default, icon | `Button kind="neutralOnPage" icon={Undo2}` | Exact pair (`--control-fill`). Today: `.sp-btn-ghost` at 30 tall with no icon. |
| Save (popover) | Button 43:123, Primary, Small | `Button kind="primary" size="sm"` | Exact (28, px 10, `.t-button-s`). Today: "Done", `.sp-btn-ghost` at 28. |
| Remove (popover) | none (plain text) | | Not a primitive. A text button: needs the hover tint and 2px-out ring (RULES §6); the frame draws plain text. Today: `.sp-btn-tertiary` at 28. |
| Name / value fields | Input 48:37, Small | `Input size="sm"` | Exact. Today: `.sp-input.sp-input--mini` (28 tall, mono-free). No Field label row is drawn; keep `aria-label`. Errors go on an error line (RULES §9): `Field` without a visible label, or the Input with `aria-invalid` and a message. |
| Role choices | Choice chip 98:532 | `ChoiceChip` | Exact look. ChoiceChip is a toggle (`aria-pressed`); today's TagChoice is `role="radio"` inside a `radiogroup`. Keep radio semantics (pass `role="radio"` + `aria-checked`, or wrap). |
| Swatch role tag | Tag 52:63, Overlay | `Tag kind="overlay"` | Exact. Today: studio `Tag onMedia` (14px mono uppercase pill). |
| Toast | Toast 58:431 | `Toast` | Exact except the underline on Undo. Today: legacy `.sp-toast` (fixed, viewport-centred, 3px top bar, radius 20) in `BrandStudio.tsx:40-56`. |
| Footer links | none | `generate/LegalLinks` | Not a primitive. LegalLinks underlines; the frame does not. Brand Studio shows no footer links today. |
| Overview card | none (`sp-overview-card`) | `.sp-overview-card` (legacy) | **Not a primitive.** Card recipe: `--surface-raised`, radius 20, padding 8, Elevation/Small, image plate radius 15. Same family as the Brand Templates card and `sp-recent-card`. |
| Setup strip + bars | none | `.sp-setup-strip` (legacy) | **Not a primitive.** The bars are not `Progress`/`ProgressBar` (58:450 / 58:451); they are five discrete 32×4 segments. |
| Color card | none (`sp-color-card`) | `.sp-color-card` (legacy) | **Not a primitive.** Same card recipe; swatch plate 88 tall radius 15. Selected ring on the edge in `--text-strong`. |
| Add slot | none (`sp-add-slot`) | `brand/primitives/AddSlot.tsx` | **Not a Master primitive.** Restyle: 1px dashed `--text-secondary`, radius 20, `.t-button-m`. Today: dashed `--border-strong`, radius 12, optional mono detail line, file-drop variant. |
| Color popover | none (`sp-color-popover`) | none (today the card expands in place) | **Not a primitive.** Menu-family surface (radius 16, Elevation/Medium) with padding 14. Radix Popover is in the repo (`ColorControl.tsx` uses it). |
| Roles summary | none | `RolesSummary` in `ColorsDetail.tsx:108-133` | Not a primitive; restyle the type. |
| Content blur behind the popover | none | none | New. 1.5 px layer blur on the grid and summary only. |
| Edit overlay (pencil on hover) | not drawn | `brand/primitives/EditOverlay.tsx` | Not in these frames. RULES §6 makes previews use `PreviewOverlay` (Deep Moss 35% + Edit button); these frames draw no hover at all. See Open questions. |

---

## Behaviour differences vs code

Code read: `admin/BrandStudio.tsx`, `admin/brand/BrandOverview.tsx`, `BrandDetail.tsx`, `BrandDetailHeader.tsx`, `ColorsDetail.tsx`, `categories.ts`, `contrast.ts`, `addFlow.ts`, `kitOps.ts`, `kitPlumbing.ts`, `primitives/{AddSlot,EditOverlay,Tag,TagChoice,useInPlaceEdit}.tsx|ts`, `src/app/router.tsx`, `Sidebar.tsx`, `App.tsx`, and the legacy CSS at `src/styles/socialpaint.css:2825-3012, 3370-3380, 3451-3470, 4040-4135, 4205-4238`.

### Overview
1. **Cover art is replaced.** The six covers in `src/assets/socialpaint/brand-studio/*.webp` (flat lilac grid illustrations, 708 × 474) are not the frame's art. Commit the six PNG fills above (exported and converted) under the same names. The cover loses its 1px `--border` (`socialpaint.css:2867`) and its radius goes from `--radius-media` (12) to 15.
2. **Card text stacks.** Today the name and count sit on one row, space-between (`.sp-overview-card__label-row`, `socialpaint.css:2876-2882`), the count in the mono eyebrow, uppercase ("10 COLORS", "EMPTY", "FIGMA OR JSON"; `categories.ts:46-65`). The frame stacks title over meta (gap 4) in sentence case UI type: "10 colors", "Empty", "Figma or JSON".
3. **Card geometry.** Today: padding 8 / 8 / 16, gap 12 between cover and label, label inset 4, card radius from `.sp-card`. Frame: padding 8, meta padding t 16 / b 8 / x 8 (title 16 below the cover, inset 16 from the card edge), radius 20, Elevation/Small, card height 288 at 1440.
4. **Edit overlay removed.** Today each cover shows the pencil scrim (`EditOverlay`) on hover and keyboard focus (`BrandOverview.tsx:192`), and the card suppresses its focus ring (`socialpaint.css:2860-2862`) because the overlay answers focus. The frame draws neither. With no overlay the card needs the focus ring back (RULES §6).
5. **Strip layout.** Today the status line and the reason are two stacked paragraphs with inline legacy type (`BrandOverview.tsx:132-144`), and the bars sit 8 below (`margin-top: var(--space-2xs)`). Frame: status and reason on one baseline row 12 apart, bars 10 below.
6. **Bars.** Today pill-radius bars, ready `--text-primary`, not ready `--bg-hover` (`socialpaint.css:2905-2913`). Frame: radius 2, ready `--surface-inverse`, not ready `--surface-sunken`.
7. **Strip action.** Today `.sp-btn.sp-btn-primary`; frame `Button primary default`. The copy is unchanged ("Upload images" etc., `BrandOverview.tsx:61-91`).
8. **Footer links.** The frame shows "Terms of Service" and "Privacy Policy" at the foot of the page; Brand Studio shows none today. PHASE-3 left placement to each area's phase.
9. **Error banner.** Today `brand.error` shows as an inline danger-wash paragraph with legacy tokens (`BrandOverview.tsx:118-127`, `BrandDetail.tsx:31-40`). Not drawn.

### Colors (resting)
10. **Header.** Today: a breadcrumb line above an `h1` "Colors" (`.sp-page-title`), the save status in the mono eyebrow, a 30-tall ghost Undo, and a "⌘Z" hint (`BrandDetailHeader.tsx:17-71`); the breadcrumb link is underlined and the separator is a 10px mono slash. Frame: the breadcrumb IS the 36-tall header row (no `h1` title), "All changes saved" in `.t-body-xs`, Undo as a 36-tall neutral-on-page button with an undo icon, no ⌘Z hint, crumb not underlined.
11. **Save status copy.** Today it cycles "Saving…" / "Saved 10:42" / "All changes saved" (`BrandDetailHeader.tsx:53`). The frame shows only "All changes saved". Keep the cycle unless CJ says otherwise (see Open questions).
12. **Card geometry.** Today: padding 8 / 8 / 12, gap 8, radius `--radius-media` (12), swatch radius 9 with `--border` (`socialpaint.css:2945-2966`), name and hex on one row (name left, hex right in the mono eyebrow). Frame: card radius 20, swatch radius 15, name over hex (gap 2) with meta padding t 12 / b 4 / x 4, hex in 12 Medium UI type, card 158 tall.
13. **Role tag.** Today the 14px mono uppercase pill ("PRIMARY") on the fixed scrim. Frame: the 21-tall overlay Tag in sentence case ("Primary").
14. **Add slot.** Today dashed `--border-strong`, radius 12, min height 133 stretched to the row (`ColorsDetail.tsx:96-100`, `CARD_MIN_HEIGHT`). Frame: dashed `--text-secondary`, radius 20, 156 tall.
15. **Roles summary type.** Today role in the mono eyebrow uppercase, name in legacy label type (`ColorsDetail.tsx:115-130`). Frame: role `.t-body-xs` sentence case, name `.t-button-m`.
16. **Grid columns.** Six at 1440 in both. The code steps to 4 under 1280, 3 under 1024, 2 under 480 (`socialpaint.css:2919-2940`); frames are desktop only, so keep the steps (PLAN, Scope).

### Colors (editing and added)
17. **Editor placement.** Today the card **turns into** the editor in place: the editing card replaces the resting card in its grid cell and grows downward, pushing its row taller (`ColorsDetail.tsx:59-69`, `.sp-color-editing`). Frame: the card stays as is with a selected ring, and a separate **300-wide popover** floats 10 below it, left-aligned, over the grid. Nothing reflows.
18. **Background blur.** The frame blurs the grid and the roles summary 1.5 px while a card is open. Today nothing blurs.
19. **Save instead of Done.** Today every keystroke commits to the autosaving draft (name on change, hex on blur or Enter, role on click; `ColorsDetail.tsx:177-196, 236-244`), and the footer button is "Done" (`:369-376`). The frame labels the primary button **"Save"**, which reads as "nothing is kept until you press it". That contradicts the autosave model, the header's "All changes saved" and the Undo safety net. See Open questions.
20. **Remove.** Today Remove is a tertiary button and is **hidden for the default palette keys** (`primary`, `secondary`, `accent`, `text`, `background`; `ColorsDetail.tsx:234, 351-368`, `lib/theme.ts:64-70`). The frame shows Remove on both Slime and Custom 1 as plain secondary text. Whether the default-key guard stays is not shown.
21. **Contrast readout.** Today 10px mono uppercase ("INK 14.7:1 PASSES"; `.sp-contrast-line`, `socialpaint.css:3005-3011`). Frame: 12 Regular sentence case. Same numbers and pass rule (`contrast.ts`, AA 4.5).
22. **Role label.** Today "ROLE" in the mono eyebrow; frame "Role" 12 Medium. Choices: today 14px mono pills (outlined when off, solid when on); frame ChoiceChips (sunken / inverse, 24 tall).
23. **Fields.** Today 28-tall `.sp-input--mini` inputs; frame 32-tall `Input sm` on `--input-bg`.
24. **The swatch is no longer a picker.** Today the editing card's swatch block is a button that opens the native color picker (`ColorsDetail.tsx:257-284`). In the frame the swatch on the open card is just the card's swatch (the card is a link back to Colors), and the popover has no picker. Hex entry is the only way to set a color in the frame.
25. **Toast.** Today `.sp-toast` is fixed at the **viewport** centre, 24 from the bottom, with a 3px top bar and radius 20 (`socialpaint.css:3451-3470`), and an Undo `sp-btn-ghost` (`BrandStudio.tsx:40-56`). Frame: the Toast primitive's look, centred on the **page area**, 75 above the window bottom (32 above the footer links), Undo underlined. Toast lifetime (5s, `kitPlumbing.ts:82`) is not shown.
26. **Popover edge cases.** The frames show the popover for columns 1 and 5. In column 6 a 300-wide popover left-aligned to a 159-wide card would overrun the content's right edge by about 105 at 1440 (and the window at narrower widths); on the bottom row it may run off screen. No flip rule is drawn.

---

## Interactions the frames drop

Flag each to CJ before building; CJ wants to keep familiar interactions.

Overview:
1. **Pencil edit overlay** on each cover on hover and keyboard focus (`EditOverlay`, D8). The frame draws plain cards.
2. **Dismissing the strip.** When all five sections are ready the strip reads "All 5 sections ready" / "Your templates have everything they draw from." with a **Dismiss** button, remembered per company in `localStorage` (`BrandOverview.tsx:37-46, 96-105, 140-153`). The frame shows only the in-progress state.
3. **Strip action starts the add flow.** "Upload images" (or Add color, Upload logo, Set fonts, Add style) navigates to that category AND opens its add flow on arrival (`addFlow.ts`, `BrandOverview.tsx:107-110`; Colors consumes it at `ColorsDetail.tsx:49-54` and opens a new color's editor). The frame draws the button as a plain link.
4. **Real links on cards.** Cards are `<a href>` so cmd/ctrl/shift/middle-click open a new tab (`useLinkClick.ts`). Keep `<a>`.
5. **Loading skeletons** with each page's geometry (`BrandOverview.tsx:166-177`, `BrandDetail.tsx:57-117`). Not drawn.
6. **Save error banner** (`brand.error`). Not drawn.

Colors:
7. **Native color picker** from the swatch (click the swatch in the editor). The frame has no picker at all.
8. **Live edits.** Typing a name renames the card immediately; a role click moves the tag on the card and in the summary immediately; each change autosaves 600 ms later and is undoable (`kitPlumbing.ts:84-182`). A "Save" button implies the opposite.
9. **Escape cancels** the whole edit and restores the draft to where it was when the card opened, without a toast (`useInPlaceEdit.ts:52-60`, `ColorsDetail.tsx:250-255`).
10. **Click outside finishes** and commits a pending hex (`ColorsDetail.tsx:198-231`). With a blur layer and a popover, outside clicks land on the blurred grid; decide whether clicking another card opens that card (today: finishes the first and opens the second, `useInPlaceEdit.ts:7-8`).
11. **Enter** in the name finishes; Enter in the value commits and finishes (`:292, 307-309`).
12. **Hex validation** with the error "Use a hex like #17FF7E or rgb(23, 255, 126)", accepting `rgb()` input and normalising to uppercase hex (`:184-196`, `:311-315`). The frame shows no error state.
13. **Empty name restores** the name the edit opened with (`:208-219`).
14. **Name focused and selected on open** (`:165-169`). The Added frame agrees; the Editing frame shows no selection.
15. **Focus returns** to the card when the editor closes (`data-edit-item`, `useInPlaceEdit.ts:29-34`).
16. **Remove hidden for default palette keys** (`:351`).
17. **Role semantics**: a radiogroup "Role for {name}" with `aria-checked`; assigning a role takes it from the previous holder, with toasts "Primary set to X", "Primary moved to X", "Role cleared from X" (`:236-244`, `kitOps.ts:16-32`).
18. **Propagation toasts**: a recolor of a color bound through type styles says "Restyled N fields in M templates" (`kitPlumbing.ts:298-304`, `ColorsDetail.tsx:40-41`). Other toasts: "Removed “X”", "X recolored". Only "Added “Custom 1”" is drawn.
19. **⌘Z / Ctrl+Z** anywhere on the page (outside text fields) undoes the last kit change (`kitPlumbing.ts:199-211`), and the header Undo **disables** when there is nothing to undo (`BrandDetailHeader.tsx:55-62`). The frame drops the ⌘Z hint and shows no disabled Undo.
20. **Save status cycle** "Saving…" / "Saved HH:MM" (live region).
21. **Unsaved-changes guard** on tab close inside the autosave window, and flush on leaving the page (`BrandStudio.tsx:28-30`, `kitPlumbing.ts:145-148, 213-220`). Invisible; keep.
22. **Roles summary hides** when no color holds a role (`ColorsDetail.tsx:113`).
23. **Coalesced undo** for picker drags (one undo step per drag, `kitPlumbing.ts:156-182`). Only matters if the picker stays.

Not dropped, but undrawn (keep as is): responsive grid columns, the members-redirect, the route-per-category URLs, the Logos `?surface=` filter.

---

## Open questions

1. **Cover images.** Confirm the six Figma fills replace the six WebP files under the same names. Export at what size (2x of 312 × 208, or the source resolution) and format (keep WebP)? The Images cover shows photographs of real-looking people; confirm the photo is licensed for use as platform art in every account.
2. **Save vs autosave.** The popover's primary button reads "Save", the header says "All changes saved", and the code autosaves every keystroke with Undo as the safety net. Pick one: (a) keep autosave and relabel the button "Done" (today's copy), (b) keep autosave and use "Save" as a close button, or (c) change the model so edits in the popover stay local until Save, with Escape or outside click discarding. Option (c) changes Undo, the toasts and the live preview of names and roles.
3. **Color picker.** The frame has no picker; today the swatch opens the native picker. Drop it (hex only), keep it on the open card's swatch, or put a picker in the popover (the app already has a react-colorful `HexColorPicker` in a Radix Popover, `ColorControl.tsx`)?
4. **Edit overlay.** Drop the pencil overlay on overview covers and color swatches as drawn, or keep it? RULES §6 says previews dim under `--overlay-hover` with the Edit button; these frames draw no hover on cards at all. If dropped, cards take the 2px-out focus ring and need a hover look: the state tint, or none?
5. **Remove.** Plain text as drawn, or a text button with a hover tint? Red or neutral? Keep hiding Remove for the five default palette keys?
6. **Popover placement rules.** Left-aligned and 10 below the card as drawn. In column 6, and on a bottom row near the window edge, should it right-align to the card, flip above, or shift to stay inside the content column?
7. **Blur.** Confirm the 1.5 px layer blur on the grid and summary while a color is open (and not on the header). Does it also make the rest of the grid inert (clicks on a blurred card close the popover only, or open that card)?
8. **Selected ring.** The ring is 1px `--text-strong` on the card's edge. RULES §6 rings look tiles 2px out. Keep it on the edge as drawn?
9. **Dismissible strip.** Keep the "All 5 sections ready" state with Dismiss (not drawn)? Keep the strip's add-flow handoff (the action opens the add flow on arrival)?
10. **Save status and ⌘Z hint.** Keep "Saving…" / "Saved HH:MM" (only "All changes saved" is drawn) and drop the "⌘Z" hint as drawn? Disabled Undo at 40% when nothing to undo?
11. **Breadcrumb as a real link.** `BreadcrumbHeader` renders earlier crumbs as buttons. Today "Brand Studio" is a real link (new tab on cmd-click). Change the shared component to accept an `href`, or accept the button?
12. **Toast placement.** Centre on the page area as drawn (today: viewport), and how far up: 32 above the footer links? Underline the Undo action (the Toast primitive does not)?
13. **Hex and meta type.** The card hex, the overview meta, the reason line, "Role" and the contrast lines are 12 / 1.4 with no matching text style (Label/XS and Caption/S are 1.25). Use the nearest class, or add a style in Figma first (RULES §1)?
14. **Footer links on Brand Studio.** Add `LegalLinks` (without underline, as drawn) to the overview and detail pages?
15. **Overview meta case.** Move the counts to sentence case ("10 colors", "Empty", "Figma or JSON") as drawn; confirm the count rules are unchanged (Fonts counts face rows plus extra font assets, `categories.ts:31-42`).

---

# Part B: Logos and Fonts

Figma file "Master UX-UI" (`mEJRslarcQDkgPeY6AObi5`), page "Brand Studio" (8:676), read on 2026-10-05, read only. All frames 1440 x 1053. Sidebar (`sp-nav`, x 0 to 335) ignored: the shell is built. The page area starts at x 335 and is 1105 wide.

| Frame | Light | Dark | Screenshot (Light, 1440) |
|---|---|---|---|
| Brand Studio · Logos | 13:10014 | 13:10451 | `brand-studio-logos.png` |
| Brand Studio · Logos · Editing | 13:10150 | 13:10587 | `brand-studio-logos-editing.png` |
| Brand Studio · Logos · Primary changed | 13:10300 | 13:10737 | `brand-studio-logos-primary.png` |
| Brand Studio · Fonts | 13:13689 | 13:14129 | `brand-studio-fonts.png` |
| Brand Studio · Fonts · Row menu | 13:13830 | 13:14270 | `brand-studio-fonts-menu.png` |
| Brand Studio · Fonts · Uploading | 13:13980 | 13:14420 | `brand-studio-fonts-uploading.png` |

The six PNGs already sit in `docs/design/new-look/reference/` under these names.

Read this first:

- **No Master instances in any of the six frames.** Every part is a plain frame named after the legacy class (`sp-logo-card`, `sp-add-slot`, `sp-font-row`, `sp-row-menu`, `sp-toast`, `sp-chat-btn · Undo`). The mappings to primitives below are by look and measurement.
- The page frame in all six is named `sp-page · Generate` (13:10087 and so on). That is a leftover layer name, not a hint: the content is Brand Studio.
- Light text binds raw `#0b0b0c` (= `--text-strong`). Dark binds `text/primary`, which has the same value as `--text-strong` in Dark. Use `--text-strong` throughout, as Part A of Phase 5 does.
- Everything inside the cards (logo names, plates, font families, file names) is sample content (PLAN decision 6, RULES §2). The SocialPaint lockups and Raveo Display in the frames are placeholders.

Conventions: Light hex -> token. `#0b0b0c` = `--text-strong`; `#636363` = `--text-secondary`; `#ececec` = `--surface-sunken`; white = `--surface-raised`; `#f9f9f8` = `--surface-page`; `#f1f1ef` = `--input-bg`; `#17ff7e` = `--accent-green`; `#082a23` = `--field-green`; `rgba(11,11,12,.08)` ≈ `--border-default` (the token is ink-750 at 8%, the frames draw ink-900 at 8%).

Type map used throughout (Figma -> repo class):

| Drawn | Spec | Repo class |
|---|---|---|
| Breadcrumb crumbs | 14 Medium / 1.25 | `.t-label-m` |
| Breadcrumb divider "/" | 14 Regular / 1.4 | `.t-body-s` |
| Save status | 13 Regular / 1.4 | `.t-body-xs` |
| Undo label | 14 Medium / 1.25 / −0.14px | `.t-button-m` |
| Segment label | 13 Medium / 1.25 / −0.13px | `.t-control-s` (13 / 1.3 / −0.01em; leading differs by 0.05) |
| Logo card name | 15 Medium / 1.25 / −0.15px (Label/L) | `.t-label-l` |
| Logo tag | 12 Regular / 1.4 | `.t-caption-s` (12 / 1.25; the `Tag` primitive's class) |
| Add slot label | 14 Medium / 1.25 / −0.14px | `.t-button-m` |
| Add slot detail | 12 Regular / 1.4 | `.t-caption-s` (leading 1.25) |
| Editing group label ("Show on", "Primary") | 12 Medium / 1.4 | `.t-label-xs` (leading 1.25) |
| Choice chip label | 12 Medium / 1.4 | `.t-label-xs` (the `ChoiceChip` class) |
| Name input value | 13 Regular / 1.4 | `.t-body-xs` (the `Input size="sm"` class) |
| "Remove" text action | 12 Medium / 1.4 | `.t-label-xs` |
| Save label | 12 Medium / 1.3 / −0.12px, trimmed (Button/S) | `.t-button-s` |
| Toast message | 14 Regular / 1.4 (Body/S) | `.t-body-s` |
| Toast Undo | 14 Medium / 1.25 / −0.14px, underlined | `.t-button-m` |
| Font family | 13 Medium / 1.25 (Label/S) | `.t-label-s` |
| Font file name | 12 **Medium** / 1.4 | `.t-label-xs` (leading 1.25) |
| Row menu item | 14 Regular / 1.4, trimmed (Trimmed/Body/S) | `.t-body-s .t-trim` |
| Footer links | 12 Regular / 1.25 | `.t-caption-s` |
| "Aa" glyph | 36 Regular / 1, in the row's own face | no class: a specimen in a tenant face (see Open questions) |
| Specimen | 18 Regular / normal, in the row's own face | no class: a specimen in a tenant face |

---

## Shared page frame (all six frames)

`sp-page` (13:10087): 1105 wide, column, padding top 45, bottom 28, no side padding (each child carries its own 45).

1. **PageHeader** (13:10088): full width, padding x 45, 36 tall, row, `justify-content: space-between`, items centred.
   - `Breadcrumb` (13:10089): row, gap 8, items centred.
     - "Brand Studio": `.t-label-m`, `--text-secondary`, a link (the `<a>` in codegen), **not underlined**.
     - "/": `.t-body-s`, `--text-secondary`.
     - Current crumb ("Logos" / "Fonts"): `.t-label-m`, `--text-strong`.
   - **There is no page title.** The breadcrumb is the whole left side of the header. No `h1`, no eyebrow.
   - `Actions` (13:10093): row, gap 16, items centred.
     - Save status "All changes saved": `.t-body-xs`, `--text-secondary`.
     - `sp-chat-btn · Undo` (13:10095): 88 x 36, padding x 16, gap 6, radius 7 (`--radius-control`). Undo-arrow icon 16 (lucide `undo-2` look) then "Undo" (`.t-button-m`, `--text-strong`). Fill Light `--surface-sunken` (#ececec), Dark `--surface-raised` (#171819). That pair is **`--control-fill`** in both themes, so this is `Button kind="neutralOnPage"` at size `default` (36, px 16) with an icon.
     - No ⌘Z glyph.
2. **Brand Studio content** (13:10100): flex 1, column, padding top 24, x 45, **gap 16**.
3. **Footer links** (13:10147): row, gap 16, centred, padding x 45. "Terms of Service", "Privacy Policy": `.t-caption-s`, `--text-secondary`, not underlined.

The header's top sits 45 below the page top, the content 24 below the header (y 105 in the page).

---

## 1. Brand Studio · Logos (13:10014)

### Surface filter (13:10101)
- 204 x 40 track, padding 4, gap 4, radius 9 (`--radius-control-md`), at the top of the content.
- Track fill: Light `--surface-sunken` (#ececec), Dark `--surface-raised` (#171819).
- Segments 32 tall, padding x 14, radius 7:
  - "All 3" (selected): thumb Light white, Dark `--surface-sunken` (#2f3133); shadow `0 1 3 rgba(0,0,0,.08)` = `--elevation-thumb`; label `--text-strong`.
  - "Dark 2", "Light 2": no fill, label `--text-secondary`.
- Labels are "{Surface} {count}", the same strings the code builds (`LogosDetail.tsx:76-80`).
- Maps to Master **Segmented control 49:51 / Segment 49:50** → `SegmentedControl` + `Segment` (`primitives/Toggles.tsx`).
  - Thumb matches `--control-thumb` in both themes (Light paper-000, Dark ink-700).
  - **Track does not match `--control-track`**: Light draws #ececec (the token is #f1f1ef), Dark draws #171819 (the token is #0b0b0c). See Open questions.

### Logos grid (13:10108)
- 1015 wide, row, gap 16, items start. Four slots of 241.75 each: three cards and the Add slot. `sp-logos-grid` fits this as a 4-column grid with gap 16.

### Logo card (`sp-logo-card · White lockup` 13:10109, resting)
- 241.75 x 213. Padding 8, column. Fill `--surface-raised`, radius 20 (`--radius-card`), Elevation/Small (`--elevation-small`).
- Dark only: a hairline `--border-raised` stroke, 0.65 top / 0.25 sides / 0.55 bottom (the lit edge). Light's `--border-raised` is transparent.
- `plate` (13:10110): 225.75 x 132, radius 15 (`--radius-media-plate`), 1px border (Light `rgba(11,11,12,.08)`, Dark `rgba(255,255,255,.08)`; ≈ `--border-default`), overflow clip.
  - One ground per surface the logo shows on: `dark ground` alone (White lockup), `light ground` alone (Ink lockup), or both halves side by side, 112.875 each (Mark).
  - Grounds are fixed colours that never invert with the theme (`--plate-dark` #0b0b0c and `--plate-light` #f9f9f8 in `socialpaint.css:762-763`). In the Dark frame the light ground stays near-white and the dark ground stays ink.
  - The logo artwork in the grounds is sample art (an SVG per ground in the frame). The build shows the tenant's asset, as `LogoPlate` does.
- `meta` (13:10113): padding top 12, x 4, bottom 4, column, gap 8.
  - Name "White lockup": `.t-label-l`, `--text-strong`.
  - `tags`: row, gap 4. Each tag 22 tall, padding x 8, pill, `--surface-sunken`, label `.t-caption-s` `--text-strong`. This is Master **Tag 52:63** kind Default → `Tag kind="default"` (`primitives/Chips.tsx`), which the primitive's own description calls "Default labels logos and fonts".
  - Order: "Primary" first when the logo is a primary on any surface, then one tag per surface ("Dark", "Light").

Sample cards:

| Card | Plate | Tags |
|---|---|---|
| White lockup | dark ground | Primary, Dark |
| Ink lockup | light ground | Primary, Light |
| Mark | dark and light halves | Dark, Light |

- The Mark card is an `<a>` in codegen (a prototype link to the Editing frame). Clicking a card opens it for editing, as today.
- **No hover, focus or pressed state is drawn.** Today's `EditOverlay` (scrim plus pencil chip on the plate) is not in the frame.

### Add slot (`sp-add-slot · Add logo` 13:10144)
- 241.75 x 213 (the card height, not stretched), radius 20, **1px dashed `--text-secondary`**, no fill, column, gap 4, centred.
- "+ Add logo": `.t-button-m`, `--text-secondary`.
- "SVG or PNG": `.t-caption-s`, `--text-secondary`, sentence case (today it is mono uppercase, `--text-muted`).
- No drag-over state drawn.

### Empty and loading
- Not drawn. Keep today's `DetailSkeleton` and an Add slot alone when there are no logos.

---

## 2. Brand Studio · Logos · Editing (13:10150)

Same page. The Mark card (13:10267) is open for editing and grows to 241.75 x **346**; the other cards keep 213 (the grid aligns to the top, as today).

### Editing card (`sp-logo-card · Mark (editing)` 13:10267)
- Same shell as the resting card: padding 8, `--surface-raised`, radius 20, Elevation/Small (plus the Dark lit edge). The plate is unchanged (132, radius 15). There is no edit overlay on it.
- `fields` (13:10273): column, gap 10, padding top 10, bottom 2, no side padding.
  1. **Name input** `sp-input · Logo name` (13:10274): full width (225.75) x 32, padding x 10, radius 7, fill `--input-bg` (Light #f1f1ef, Dark `rgba(241,241,241,.08)`), no border. Value "Mark" in `.t-body-xs`, `--text-strong`. This is Master **Input 48:37** Small → `Input size="sm"` (32, px 10, radius 7, `.t-body-xs`). No label: the field is labelled by context, as today (`aria-label="Logo name"`).
  2. **Show on** (13:10276): column, gap 6, padding x 2.
     - Label "Show on": `.t-label-xs`, `--text-secondary`, sentence case.
     - `choices`: row, gap 6. Two chips, both selected: "Dark", "Light".
  3. **Primary** (13:10283): column, gap 6, padding x 2.
     - Label "Primary": `.t-label-xs`, `--text-secondary`.
     - `choices`: row, gap 6. "On dark", "On light", both unselected. "On dark" is an `<a>` (the prototype link to the Primary changed frame).
  4. **Footer** (13:10290): row, `space-between`, items centred, padding left 2, top 2.
     - "Remove": plain text, `.t-label-xs`, `--text-secondary`. No fill, no red, no icon.
     - `sp-chat-btn · Done` (13:10292): 47 x 28, padding x 10, radius 7. **Label "Save"** (the layer is still named Done). Light fill `--field-green` with `--accent-green` label; Dark fill `--accent-green` with `--text-inverse` label. That is `--btn-primary-bg` / `--btn-primary-fg` → `Button kind="primary" size="sm"` (28, px 10, `.t-button-s`).

### Choice chips
- 24 tall, padding x 10, pill.
- Selected: `--surface-inverse` fill, label Light `--surface-raised` (white), Dark `--surface-page` (#0b0b0c). Both equal `--text-inverse` in their theme.
- Unselected: `--surface-sunken` fill, `--text-strong` label.
- This is Master **Choice chip 98:532** → `ChoiceChip` (24, px 10, `.t-label-xs`, `aria-pressed`). Today the code uses `TagChoice` (a 14 px tag, outlined when off, `role="checkbox"`).

### States shown
- Show on: both surfaces chosen.
- Primary: neither surface chosen for Mark (White lockup is the dark primary, Ink lockup the light one).
- No disabled chip is drawn. Today "On {surface}" is disabled when the logo does not show on that surface (`LogosDetail.tsx:346`); Mark shows on both, so the frame cannot show it.
- No refusal note ("A logo needs at least one surface.") and no in-use alert are drawn.

---

## 3. Brand Studio · Logos · Primary changed (13:10300)

The state right after choosing "On dark" in Mark's editing card.

### What changed on the page
- **Mark's editing card stays open.** "On dark" (13:10434) is now selected (ink chip); "On light" stays unselected. Show on is unchanged (both).
- **White lockup** (13:10395) lost its "Primary" tag and now reads "Dark" alone.
- **Ink lockup** keeps "Primary, Light".
- The surface filter counts are unchanged ("All 3", "Dark 2", "Light 2").

### Toast (`sp-toast` 13:10448)
- 417 x 44 at frame x 679, y 934. Its centre (887.5) is the centre of the **page area** (335 + 1105 / 2), not the viewport. Its bottom sits **75** above the frame bottom.
- Padding y 12, x 16, row, gap 16, items centred, radius 16 (`--radius-menu`).
- Fill `--surface-raised`. Stroke **5px**: Light `rgba(255,255,255,.25)`, Dark `rgba(255,255,255,.06)`. Elevation/Medium (`--elevation-medium`).
- Message: "“Mark” is now primary on dark, replacing “White lockup”" in `.t-body-s`, `--text-strong`. Curly quotes, as the code writes them.
- Action "Undo": `.t-button-m`, `--text-strong`, **underlined**.
- This is Master **Toast 58:431** → `Toast` (`primitives/Overlays.tsx`). Today's toast is the legacy `.sp-toast` in `BrandStudio.tsx:40-55` with a ghost "Undo" button.

### The data change it implies
- Before: `primaryLogoDarkAssetId` = White lockup, `primaryLogoLightAssetId` = Ink lockup.
- After: `primaryLogoDarkAssetId` = **Mark**, `primaryLogoLightAssetId` = Ink lockup (unchanged), and the legacy `primaryLogoAssetId` = Mark (it follows the dark primary, `kitOps.ts:112-114`).
- How it is chosen: per surface, from the editing card's Primary chips. A logo can be primary on a surface only when it shows there (`setPrimaryLogo`, `kitOps.ts:118-131`). Each surface has exactly one primary, so choosing Mark on dark takes the dark primary from White lockup; nothing changes on light.
- It is applied at once, without pressing Save: the toast and White lockup's tags change while the card is still open. This is today's behaviour exactly (`makePrimary`, `LogosDetail.tsx:265-274`, which commits with this toast copy). The frame therefore reads "Save" as the label of today's Done, not as a staged save.
- Undo on the toast restores the previous primary (the kit snapshot), as `brand.undo(snapshot)` does today.

---

## 4. Brand Studio · Fonts (13:13689)

### List card (`sp-list-card · Fonts` 13:13776)
- 1015 wide, padding **8**, column, gap 8. Fill `--surface-raised`, radius 20, Elevation/Small (Dark adds the `--border-raised` lit edge).
- `rows` (13:13777): column, padding x 16 (so rows are 967 wide).
- Dividers between rows: 1px, full row width (inside the 16 padding). Light `rgba(11,11,12,.08)`, Dark `rgba(255,255,255,.08)` → `--border-default`.

### Font row (`sp-font-row · Raveo Display` 13:13778)
- 967 x 77, row, gap 16, items centred, padding y 20.
1. **"Aa"**: 48 wide, 36 Regular, line-height 1, in the row's own face, `--text-strong`.
2. **identity** (13:13780): 220 wide, column, gap 4.
   - Family "Raveo Display": `.t-label-s`, `--text-strong`.
   - File "RaveoDisplay.woff2": 12 Medium / 1.4 (`.t-label-xs`), `--text-secondary`. The uploaded file's name, with its extension.
3. **Specimen** "Your brand, set in this face.": flex 1, 18 Regular, leading normal, in the row's own face, `--text-secondary`. Same copy as today (`FontsDetail.tsx:33`).
4. **Row menu trigger** (13:13784): 32 x 32, radius 7, no fill at rest, ellipsis 16. Master **Row menu trigger 44:29** → `RowMenuTrigger` (`primitives/IconButton.tsx`). **Drawn visible on every row** at rest.

Sample rows:

| Family | File |
|---|---|
| Raveo Display | RaveoDisplay.woff2 |
| DM Sans | DMSans-Variable.ttf |
| Instrument Serif | InstrumentSerif-Regular.ttf |
| IBM Plex Mono | IBMPlexMono-Regular.otf |

### What is absent from the row
- **No role tags.** Today each row carries "Heading" and/or "Body" tags (`FontsDetail.tsx:285-289`).
- **No source eyebrow.** Today the second line is "Google" or "Uploaded" in mono (`FontsDetail.tsx:277`). The frame shows the file name instead.
- **No Google face rows.** Every drawn row is a file. Today the page always lists the heading and body faces first, which are Google fonts by default (Montserrat and Inter, `kitPlumbing.ts:27-28`), merged into one row when they share a family.

### Add slot (`sp-add-slot · Add font` 13:13825)
- Full card width (999) x 56, radius **15**, 1px dashed `--text-secondary`, centred.
- "+ Add font" in `.t-button-m`, `--text-secondary`. No detail line.

### Where font roles appear
- **Nowhere on this page.** Not on the rows, not in the row menu (§5), not in the upload state (§6). This is the scheduled behaviour change (PLAN, "font roles moving from Fonts to Type styles in Brand Studio"): Fonts becomes the tenant's library of uploaded font files, and which face does which job is decided on Type styles, where each style already holds its own `font` (`BrandTypeStyle.font`, `types.ts:67`). The Type styles frames are another part of this reference; how they show the heading and body choice is ruled there.

---

## 5. Brand Studio · Fonts · Row menu (13:13830)

Same page. The first row's trigger is open and its menu floats beside it.

### Open trigger (13:13925, `sp-row-menu-trigger (open)`)
- Fill `--surface-sunken` while open (Light #ececec, Dark #2f3133). This matches `RowMenuTrigger` (`aria-expanded="true"` holds `--surface-sunken`).

### Menu (`sp-row-menu` 13:13971)
- 200 x 129, padding 6, column, gap 2, radius 16 (`--radius-menu`), `--surface-raised`, Elevation/Medium. No stroke in either theme.
- Placement: the menu's right edge (frame x 1371) lines up with the trigger's right edge, and its top is 4.5 below the trigger's bottom (trigger y 135.5 to 167.5, menu top 172). That is `align="end"` with a 4 offset. `Menu` uses `sideOffset={4}`; today's `RowMenu` opens at `r.right, r.bottom + 4` (`RowMenu.tsx:68`), right-aligned the same way.
- Items 188 x 34, padding l 10 / r 8 / y 8, radius 7, label `.t-body-s .t-trim`, `--text-strong`, no icons, no check marks:
  1. "Rename"
  2. "Replace file"
  3. Divider: 188 x 9, padding 4 around a 1px `--border-default` line.
  4. "Remove", **drawn in `--text-strong`**, not red.
- No hover or keyboard-focus row is drawn.
- Master **Menu 57:423 / Menu item 96:507** → `Menu`, `MenuItem`, `MenuDivider` (`primitives/Menu.tsx`). Its description: "The row menu has no icons; the attach menu adds them."

### Menu contents vs today
- Today (`FontsDetail.tsx:230-257`): a "ROLE" group (Heading / Body / No role, radio items with checks; "No role" disabled while the row holds a role), then "Change face…" for a role row, then "Remove" (destructive) for an uploaded asset.
- Frame: Rename, Replace file, Remove. Both new items have no code behind them (see Behaviour differences).

---

## 6. Brand Studio · Fonts · Uploading (13:13980)

Same page with a fifth row appended under the four, and the card grown to 468 (rows 388).

### Uploading row (`sp-font-row · Bricolage Grotesque (uploading)` 13:14117)
- 967 x 76, row, gap 16, items centred, padding y 20. A divider above it like any row.
- "Aa": 48 wide, 36 Regular / 1, **in Raveo Display (the UI face), `--text-secondary`**. The tenant face is not loaded yet, so the glyph is greyed in the chrome face.
- identity (13:14119): 220 wide, column, **gap 8**.
  - Family "Bricolage Grotesque": `.t-label-s`, `--text-strong`. Read from the file before the upload finishes (today's `inspectFontFile` metadata).
  - Progress (13:14121): 220 x 4, pill, track `--surface-sunken`. Bar 88 wide (40%), `--accent-green`, pill, set 44 in from the left by an empty offset frame. A segment floating inside the track, not a fill from 0: an **indeterminate** bar.
- **No specimen, no file name line and no row menu trigger** while uploading.
- The Add slot moves down under the new row (y 404).

### States shown
- Uploading only. No done ("Added" check), no failure, no leaving animation is drawn.
- Today: a shimmer bar (`sp-upload-bar`), then "Added" with a check in `--state-primary` for 700 ms, then the row fades out and the real asset row takes its place (`FontsDetail.tsx:110-118`, `138-160`).
- `ProgressBar` (`primitives/Containers.tsx`, Master 58:451) draws a 4 tall `--surface-sunken` track with a determinate fill. The upload has no byte progress (`stores.brandAssets.upload` is one request), so the drawn segment needs an indeterminate mode the primitive lacks. `--accent-green` is the drawn fill, a brand colour in chrome; RULES §7 allows it only where a frame draws it, and this frame does.

---

## Dark differences (beyond token flips)

1. **Surface filter inverts its layers.** Light: track `--surface-sunken`, thumb white. Dark: track `--surface-raised` (#171819), thumb `--surface-sunken` (#2f3133). The thumb flip is `--control-thumb`; the track matches neither theme's `--control-track`.
2. **Undo button fill** goes from `--surface-sunken` (Light) to `--surface-raised` (Dark). That pair is `--control-fill`, so it is a token flip if the build uses `neutralOnPage`, and a real difference if it uses `neutral` (`--surface-sunken` in both).
3. **Cards gain a lit edge** in Dark: a `--border-raised` stroke, 0.65 top / 0.25 sides / 0.55 bottom, on the logo cards, the editing card and the fonts list card. Light's `--border-raised` is transparent. RULES §4 says Elevation/Small already carries the Dark bevel and not to add a separate edge (see Open questions).
4. **Plate border** is `rgba(255,255,255,.08)` in Dark, `rgba(11,11,12,.08)` in Light. `--border-default` is 10% in Dark and ink-750 at 8% in Light.
5. **Plates do not invert.** The dark ground stays ink and the light ground stays near-white in both themes. In Dark, a light-ground plate is the brightest thing on the page.
6. **Save button** inverts: Light moss fill with slime label, Dark slime fill with `--text-inverse` (ink #0b0b0c) label. `--btn-primary-fg` in Dark is Deep Moss (#082a23), not ink. Close, but not the same value.
7. **Selected choice chip label**: Light binds `--surface-raised` (white), Dark `--surface-page` (#0b0b0c). Both equal `--text-inverse`, so it is a token flip.
8. **Toast stroke**: Light 5px white 25%, Dark 5px white 6%. The `Toast` primitive draws 1px `--border-raised` (transparent in Light, white 20% in Dark).
9. **Name input fill**: Dark `rgba(241,241,241,.08)` = Dark `--input-bg`. A token flip.
10. **Row menu**: `--surface-raised` with no stroke in both themes (unlike Phase 5's Dark menus, which disagreed). The open trigger is `--surface-sunken` (#2f3133) in Dark.

There are no layout, copy or structure differences between the twins.

---

## Primitives used / not yet primitives

| Frame part | Master (by look) | Repo today | Notes |
|---|---|---|---|
| Breadcrumb | none | `BrandDetailHeader` (`BrandDetailHeader.tsx:18-47`), inline styles | **Not a primitive.** Root crumb not underlined; divider `.t-body-s`, not mono. Phase 5's `ChatBreadcrumb` is the nearest shared piece. |
| Save status | none | `sp-eyebrow` in `BrandDetailHeader.tsx:52-54` | **Not a primitive.** `.t-body-xs` `--text-secondary` text with `role="status"`. |
| Undo (header) | Button 43:123, Neutral, with icon | legacy `sp-btn sp-btn-ghost` at 30 tall | `Button kind="neutralOnPage" icon={Undo2}`, size default. |
| Surface filter | Segmented control 49:51, Segment 49:50 | legacy `sp-segmented` in `LogosDetail.tsx:84-101` | `SegmentedControl` fits (radio group, arrows, one tab stop). Track fill differs (Dark differences 1). |
| Logo card (resting) | none (card recipe) | `sp-card sp-logo-card` button | **Not a primitive.** Card recipe (`--surface-raised`, radius 20, `--elevation-small`) with a 132 plate at radius 15. |
| Logo plate grounds | none | `LogoPlate`, `--plate-dark` / `--plate-light` (legacy names in `socialpaint.css`) | **Not a primitive.** The plate colours are legacy custom properties, not Figma tokens; they need a home in the token export or a documented exception. |
| Logo and font tags | Tag 52:63, kind Default | legacy `primitives/Tag.tsx` (14 px mono pill) | `Tag kind="default"` fits (22, px 8, `--surface-sunken`). |
| Editing card | none | `LogoEditingCard` | **Not a primitive.** A composition of Input, ChoiceChip and Button. |
| Name input | Input 48:37, Small | legacy `sp-input sp-input--mini` | `Input size="sm"` fits. |
| Show on / Primary chips | Choice chip 98:532 | `TagChoice` (`role="checkbox"`) | `ChoiceChip` fits the look; it is a toggle (`aria-pressed`). Primary chips behave as one-of per surface but are independent per surface, so pressed toggles suit both groups. Disabled ("On light" when the logo is not on light) needs `disabled` on ChoiceChip: check it dims to 40%. |
| Group labels ("Show on", "Primary") | none | `sp-eyebrow` (mono uppercase) | Plain `.t-label-xs` `--text-secondary` text. |
| Remove (editing card) | none drawn | legacy `sp-btn sp-btn-tertiary` | Drawn as plain text. Nearest: a text button with the hover tint and the 2px-out ring, like the `Toast` action. Not a primitive. |
| Save (editing card) | Button 43:123, Primary, Small | legacy `sp-btn sp-btn-ghost` "Done" | `Button kind="primary" size="sm"`. |
| Add slot (logos, fonts) | none | `admin/brand/primitives/AddSlot.tsx` | **Not a Master component.** Restyle the existing `AddSlot`: dashed `--text-secondary`, radius 20 (grid) or 15 (inside the list card), `.t-button-m` label, `.t-caption-s` detail. |
| Toast | Toast 58:431 | legacy `.sp-toast` in `BrandStudio.tsx:40-55` | `Toast` fits (padding 12 / 16, gap 16, radius 16, `.t-body-s`, `.t-button-m` action). Stroke differs (Dark differences 8). Placement (centred on the page area, 75 up) is the caller's. The drawn Undo is underlined; the primitive's action is not. |
| Fonts list card | none (card recipe) | `sp-card sp-list-card` | **Not a primitive.** Padding 8 with rows inset 16 (today 24 all round). Shared with Type styles. |
| Font row | none | `FontRow`, `sp-font-row` | **Not a primitive.** |
| Row menu trigger | Row menu trigger 44:29 | `admin/brand/primitives/RowMenu.tsx` trigger (`sp-icon-btn sp-row-menu-trigger`) | `RowMenuTrigger` fits, including the open fill. |
| Row menu | Menu 57:423, Menu item 96:507, divider | `admin/brand/primitives/RowMenu.tsx` (custom portal, `openAt` for right-click, group labels, radio checks, destructive items) | `Menu` + `MenuItem` + `MenuDivider` fit the look. **`Menu` lacks** what `RowMenu` has: opening at a pointer (right-click), and a destructive item style (the frame draws none). With roles gone, group labels and radio checks are no longer needed here; Type styles still uses `RowMenu`. |
| Upload progress | Progress bar 58:451 (closest) | `sp-upload-track` / `sp-upload-bar` shimmer | `ProgressBar` is determinate only. The frame draws an indeterminate 40% segment in `--accent-green`. Needs an indeterminate variant or a local part. |

---

## Behaviour differences vs code

Code read: `admin/BrandStudio.tsx`, `admin/brand/BrandDetail.tsx`, `BrandDetailHeader.tsx`, `LogosDetail.tsx`, `FontsDetail.tsx`, `BrandOverview.tsx`, `categories.ts`, `kitOps.ts`, `kitPlumbing.ts`, `addFlow.ts`, `admin/brand/primitives/*`, `lib/types.ts`, `lib/brand/fontUpload.ts`, `lib/stores/supabase/brandStore.ts`, the `sp-logo*`, `sp-font-row*`, `sp-row-menu*`, `sp-add-slot*` and `sp-toast` rules in `styles/socialpaint.css`, and every reader of `headingFont` / `bodyFont`.

### Header (both pages)
1. **No page title.** The code renders the breadcrumb above an `h1` (`BrandDetailHeader.tsx:18-50`). The frame has the breadcrumb alone as the header's left side. RULES §9 ("page headers are a title alone") is satisfied by the breadcrumb's current crumb, but there is no heading element drawn. Keep an `h1` for the document outline (see Open questions).
2. **Breadcrumb root not underlined**, divider in `.t-body-s` instead of mono 10 (`BrandDetailHeader.tsx:26-40`).
3. **Save status** in `.t-body-xs`, sentence case, instead of the mono eyebrow. The frame only shows "All changes saved"; the code also shows "Saving…" and "Saved {hh:mm}" (`BrandDetailHeader.tsx:53`).
4. **Undo** is a 36 tall neutral button with an icon, not a 30 tall ghost button; the "⌘Z" glyph beside it is gone (`BrandDetailHeader.tsx:55-68`).

### Logos
5. **Card shape.** Code: radius `--radius-media`, padding 8 / 8 / 12, gap 8 between plate, name and tags (`socialpaint.css:3113-3122`). Frame: radius 20, padding 8, then a meta block padded 12 / 4 / 4 with gap 8.
6. **Grid is responsive in code** (4 / 3 / 2 columns, `socialpaint.css:3094-3109`). The frame shows 4 at 1440 only. Below desktop width, pages keep today's behaviour (PLAN, Scope).
7. **Tags** become the 22 tall `Tag` default (sentence case `.t-caption-s`) instead of the 14 px mono pill (`admin/brand/primitives/Tag.tsx`).
8. **No edit overlay.** Code shows a scrim and pencil chip on the plate on hover and focus (`EditOverlay`, `LogosDetail.tsx:175`). The frame draws no hover. RULES §6 dims "previews" under `--overlay-hover` with an Edit button, but lists result, recent and history cards, not logo cards.
9. **Add slot** is a fixed 213 tall (code: `minHeight: 132` and `alignSelf: stretch`, `LogosDetail.tsx:144`), radius 20, dashed `--text-secondary` (code: `--border-strong`, `socialpaint.css:4205-4217`), with a sentence-case detail.
10. **Editing card controls.**
    - Group labels sentence case `.t-label-xs` instead of the mono eyebrow (`LogosDetail.tsx:322`, `339`).
    - `ChoiceChip` (24 tall, ink when chosen, sunken when not) instead of `TagChoice` (14 px, outlined when off) (`LogosDetail.tsx:324-351`).
    - The name input is a 32 `Input size="sm"` on `--input-bg`.
11. **Footer.** Code: "Remove" as `sp-btn-tertiary` and "Done" as a ghost button (`LogosDetail.tsx:363-380`). Frame: "Remove" as plain secondary text and **"Save"** as the primary small button. Every edit already autosaves (the Primary changed frame proves the change lands before Save), so Save performs today's Done: close, keep changes, return focus to the card.
12. **Remove has no destructive look** in the frame (plain secondary text, no red, no confirm). RULES and PLAN make destructive buttons filled red; this one is drawn as a text action.
13. **Toast placement.** Code: fixed at the viewport centre, 24 from the bottom (`socialpaint.css:3451-3468`). Frame: centred on the page area (right of the sidebar), 75 from the bottom.
14. **Toast look.** Code: ghost "Undo" button, `--type-label-size` message (`BrandStudio.tsx:40-55`). Frame: `Toast` with an underlined text Undo.
15. **Primary changed** matches today's data model and copy exactly (`kitOps.ts:118-131`, `LogosDetail.tsx:265-274`). No change.

### Fonts
16. **Roles leave the Fonts page.** Code builds rows from the heading face, the body face (merged when the same family) and then the uploaded assets without a role (`FontsDetail.tsx:43-85`), tags each row with its roles (`285-289`), and assigns roles from the row menu (`230-249`). The frame has no roles anywhere. This is the scheduled change: roles move to Type styles.
17. **Fonts lists uploaded files only.** Every drawn row has a file name. Today Google faces appear as rows because they hold a role (Montserrat and Inter are the defaults, `kitPlumbing.ts:27-28`). Once roles move, a Google face is no longer a Fonts row; Google families stay pickable inside a type style's font picker (`TypeStylesEditor` already lists Google and uploaded families, `TypeStylesDetail.tsx:250-253`).
18. **Second line is the file name** (`BrandAsset.name`, set to `file.name` on upload, `brandStore.ts:68`) instead of "Google" / "Uploaded" (`FontsDetail.tsx:277`).
19. **Row menu items change.** Rename and Replace file are new; Role, No role and Change face… go (`FontsDetail.tsx:230-257`).
    - **Rename**: no font rename exists. Logos rename through `stores.brandAssets.update(id, { name })` (`LogosDetail.tsx:201`). For a font, the shown name is `metadata.family`, which also keys `@font-face` registration (`registerCustomFont`) and the type styles' `FontRef.family` (and `refFor` matches by family, `FontsDetail.tsx:205-212`). Renaming the family would orphan every type style and template field that names it.
    - **Replace file**: no store method. It needs an upload that keeps the asset id (or rewires every `FontRef.assetId` and template field), re-inspects the metadata, re-registers the face, and decides what happens if the new file's family differs.
20. **Remove guard changes.** Today Remove is refused while the font holds a role ("“{family}” is the heading face. Pick a different face first, then remove it.", `FontsDetail.tsx:214-221`). With roles gone, the guard has to look at type styles (`BrandTypeStyle.font.assetId`) and templates that use the face instead. Logos already block removal when templates use them (`LogosDetail.tsx:276-284`, `inUseMessage`).
21. **Trigger always visible.** The frame draws the ellipsis on every row at rest. Code hides it until the row is hovered or focused on hover-capable devices (`socialpaint.css:4141-4151`).
22. **Remove is not red** in the menu. Code styles it destructive (`RowMenu` `destructive: true`, `FontsDetail.tsx:255`).
23. **List card padding** 8 with rows inset 16 and row padding y 20 (code: 24 all round, rows y 16, `socialpaint.css:3172-3183`). "Aa" in `--text-strong` (code `--text-primary`).
24. **Upload row.** Indeterminate green segment, greyed "Aa" in the UI face, no specimen or menu (code: shimmer bar, then an "Added" check that flips in, then the row leaves, `FontsDetail.tsx:138-160`).
25. **Overview and readiness still read roles.** The overview's Fonts card is "ready" only with a heading and a body face, and its strip action is "Set fonts" ("Fonts still need a heading and a body face.", `BrandOverview.tsx:74-77`). The Fonts count counts face rows plus role-less assets (`categories.ts:31-42`). Both change meaning when roles leave the page.
26. **Who reads the roles today.** `BrandKit.headingFont` / `bodyFont` (`types.ts:96-97`) feed: the brand CSS variables (`lib/theme.ts:23-28`), font preloading (`lib/render/fonts.ts:264`), the builder's font suggestions (`builder/FieldInspector.tsx:329`), the default font of a new text field (`builder/fieldOps.ts:247`, `builder/TemplateBuilder.tsx:1359`), starter materialisation (`lib/templates/starters/materialize.ts:212-213`), onboarding (`onboarding/OnboardingWizard.tsx:147-148`, `207-237`), and website import (`lib/brand/brandFromWebsite.ts`, `supabase/functions/brand-from-website`). Moving the choice to Type styles needs a rule for what these read: keep the two kit fields and edit them from Type styles, or derive them from type styles (for example the styles keyed `heading` and `body`). This is a data decision, not a restyle.

---

## Interactions the frames drop

Flag each to CJ before building. Per memory, CJ wants to keep familiar interactions.

### Logos
1. **Edit overlay on hover and focus** (scrim plus pencil chip over the plate). The only visual cue that a card is editable.
2. **⌘Z hint** beside Undo. The shortcut itself is undrawn but not contradicted.
3. **"Saving…" and "Saved {time}"** save states (only "All changes saved" is drawn).
4. **"A logo needs at least one surface."** refusal note when the last surface is switched off (`LogosDetail.tsx:228-231`, `335-337`).
5. **In-use block on Remove**: the alert naming the templates that use the logo (`LogosDetail.tsx:276-284`, `354-361`).
6. **Disabled "On {surface}"** primary chip when the logo does not show on that surface (`LogosDetail.tsx:346`).
7. **Escape cancels** the edit and restores the kit draft, without a toast (`LogosDetail.tsx:303-308`, `useInPlaceEdit.cancel`).
8. **Click outside finishes** the edit and saves the name (`LogosDetail.tsx:216-223`); **Enter** in the name finishes too.
9. **Primary handoff**: switching a surface off, or removing a logo, passes that surface's primary to the next eligible logo (`LogosDetail.tsx:235-258`, `primaryHandoffOnRemove`).
10. **First logo is primary on both surfaces** automatically (`LogosDetail.tsx:49-57`).
11. **Drag and drop** onto the Add slot, and **multiple files** at once.
12. **"Upload logo" from the overview's setup strip** opens the file picker straight away (`consumeAddFlow`, `LogosDetail.tsx:67-71`).
13. **Surface filter in the URL** (`?surface=`), so a filtered view survives reload and back.
14. **Toast auto-dismiss** after 5 s (`kitPlumbing.ts:82`) and **⌘Z anywhere on the page** (`kitPlumbing.ts:199-211`).

### Fonts
15. **Role tags** (Heading, Body) on rows: the at-a-glance answer to "which face is my heading?".
16. **Assigning a role from the row menu** (Heading / Body / No role with checks).
17. **Change face…**: the searchable combobox of uploaded and Google families, with arrow keys, Enter and Escape (`FacePicker`, `FontsDetail.tsx:320-409`). Today it is the only way to set a Google font as a brand face.
18. **Google faces as rows** (and the merged row when heading and body share a family).
19. **Right-click a row** to open its menu at the pointer (`FontsDetail.tsx:263-266`, `RowMenu.openAt`). The `Menu` primitive cannot open at a point.
20. **Hover-revealed trigger** (becomes always visible).
21. **The role guard on Remove** and its message.
22. **Upload "Added" confirmation** (check, then the row leaves) and the **upload error banner** for a wrong format or a file over 5 MB (`fontUpload.ts:49-57`).
23. **Drag and drop** onto Add font, **multiple files**, and **"Set fonts" from the setup strip** opening the picker (`FontsDetail.tsx:128-130`).
24. **Destructive styling** of Remove in the menu.
25. **"{Role} face set to {family}"** toast with Undo (`FontsDetail.tsx:89-91`). It moves with the roles.

Not dropped, but undrawn (keep as is): the loading skeletons (`BrandDetail.tsx:59-118`), the page error banner, menu keyboard (arrows, Home and End, Escape returns focus, Tab closes), focus returning to the card after editing, `aria-live` on the save status, and the unsaved-changes warning on leaving.

## What the frames add

1. **Rename** and **Replace file** on a font.
2. The **file name** under each family.
3. **"Save"** as the editing card's primary action (today "Done").
4. The **Toast** primitive's look, placed on the page area.
5. The neutral **Undo** button with an icon in the header.

---

## Open questions

1. **Font roles, data side.** When roles leave Fonts, what do the readers in Behaviour difference 26 read? (a) Keep `headingFont` / `bodyFont` on the kit and set them from Type styles; (b) derive them from type styles (by key `heading` / `body`, or by a new "role" flag on a style); or (c) retire them and point each reader at type styles. Which, and does onboarding and website import keep writing them?
2. **Google faces.** With Fonts listing files only, is a Google family chosen only inside a type style (as `TypeStylesEditor` already allows)? Or can a Google family be "added" to Fonts as a row without a file, and if so what does its second line say?
3. **Overview readiness.** What makes the Fonts card "ready" now (at least one uploaded font? nothing, since Google faces need no upload?), what does its strip action say instead of "Set fonts", and what does the count count?
4. **Rename.** Does Rename change the display family (`metadata.family`), which type styles and templates match by name, or only the file label (`BrandAsset.name`)? If the family, should the rename rewrite every `FontRef` that names it?
5. **Replace file.** Keep the asset id and swap the stored file? What happens when the new file's family, weight or cuts differ from the old one: rewrite references, refuse, or warn? Is Replace file in Phase 6 scope or hidden until the store supports it?
6. **Remove guard for fonts.** Block removal when a type style or a template uses the face (like logos), or allow it and let those fall back? What is the message?
7. **Upload done state.** Keep today's "Added" check and the row's exit, or swap the uploading row straight into the real row as the frame implies? Should the bar be indeterminate (as drawn) and is `--accent-green` approved for it?
8. **Specimen and "Aa" type.** They are set in the tenant's face at 36 / 1 and 18 / normal, sizes no `.t-*` class carries. Allow a local class with the size plus an inline `font-family` for the tenant face (an exception to RULES §5), or add type styles in Figma?
9. **Page title.** Keep a visually hidden `h1` (or make the current crumb the `h1`) so the page keeps a heading, since the frame draws none?
10. **Save vs Done.** Confirm "Save" is a relabelled Done (close and keep the autosaved changes), not a staged save. If staged, Escape, click outside and the Primary changed toast all change meaning.
11. **Remove in the editing card.** Plain secondary text as drawn, or a destructive button per PLAN ("destructive buttons become filled red")? Add a confirmation?
12. **Logo card hover.** Drop the edit overlay as drawn, or keep it (or move logo cards onto the Preview overlay rule)?
13. **Row menu trigger visibility.** Always visible as drawn, or keep it hover-revealed on hover devices?
14. **Right-click to open the row menu.** Keep it (the `Menu` primitive needs a point-anchored mode) or drop it?
15. **Surface filter track.** Light #ececec and Dark #171819 as drawn, or the primitive's `--control-track` (#f1f1ef / #0b0b0c)?
16. **Dark lit edge.** The cards draw a `--border-raised` stroke (0.65 / 0.25 / 0.55) on top of Elevation/Small in Dark. RULES §4 says not to add a separate edge. Follow the frame or the rule?
17. **Toast.** Placement centred on the page area 75 from the bottom (frame) or the viewport 24 from the bottom (code)? The 5px white stroke (25% / 6%) or the primitive's 1px `--border-raised`? Underline the Undo action?
18. **Logo plate colours.** `--plate-dark` / `--plate-light` are legacy names outside the token export. Add plate tokens to Figma, or record them as an exception?
19. **Save label colour in Dark.** `--text-inverse` (ink) as drawn, or `--btn-primary-fg` (Deep Moss)? The primitive uses the latter.
20. **Tag and label leading.** Tags, the add-slot detail and the editing labels are drawn at 12 / 1.4; the classes give 1.25. Accept the classes?

---

# Part C: Type styles

Source: Figma "Master UX-UI" (mEJRslarcQDkgPeY6AObi5), page "Brand Studio" (8:676), section 13:9042, read on 2026-10-05, read only. All frames 1440×1053. Sidebar ignored (shell already built); the page area is `sp-page · Generate` (the layer keeps the Generate name), 1105 wide, at x 335.

| Frame | Light | Dark | Screenshot (Light, 1440) |
|---|---|---|---|
| Brand Studio · Type styles | 13:10888 | 13:11422 | `brand-studio-type-styles.png` |
| Brand Studio · Type styles · Editing size | 13:11041 | 13:11575 | `brand-studio-type-styles-size.png` |
| Brand Studio · Type styles · All properties | 13:11196 | 13:11730 | `brand-studio-type-styles-all.png` |

The three PNGs were exported at 1x and sit next to this file in the scratchpad (`p6/`); copy them into `docs/design/new-look/reference/` with the phase.

Read this first:

- **No Master instances in any frame.** The card (`sp-list-card · Type styles`), the rows (`sp-style-row · …`), the editor (`sp-style-editor · Heading`), the trigger (`sp-row-menu-trigger`) and the add slot (`sp-add-slot · Add style`) are plain frames. Their measurements match the Master components named below, so build on the primitives and treat the frames as compositions of them.
- **Font roles.** None of the three frames draws a role marker (no "Heading face" or "Body face" tag, no Role menu, no role field in the editor). Each type style carries its own **Font** and **Weight**, and its row's face line reads "Raveo Display · 500". The Fonts frames (13:13689, row menu 13:13830) confirm the other half: the font rows have no role tags, and the font row menu is "Rename", "Replace file", divider, "Remove", with no "Role" group. The roles have left Fonts, and the only place a face is tied to a use is a type style. See "Data model" below.
- Light text uses raw `#0b0b0c` (= `--text-strong`). Dark binds `text/primary` (#f1f1f1), the same value as Dark `--text-strong`. Use `--text-strong` throughout.
- Everything inside the card is sample content (PLAN decision 6): the four style names, Raveo Display / DM Sans / IBM Plex Mono, the values, "Ink 900". The interface labels ("Add style", "Name", "Fixed size (px)", "Delete style", "Save", "Always uppercase", "Shrink to fit the box") are copy.

---

## 1. Brand Studio · Type styles (13:10888)

### Page layout (`sp-page · Generate` 13:10961, 1105 wide)
- Column. Padding top 45, bottom 28. The header and content have x padding 45.
- `PageHeader` (13:10962): row, space-between, items centred, 36 tall.
- `Brand Studio content` (13:10974): fills the height, padding-top **24**, x 45. It holds one card.
- `Footer links` (13:11038): row, gap 16, centred. 12 Regular / 1.25 (`.t-caption-s`), `--text-secondary`, not underlined. "Terms of Service", "Privacy Policy". (Same as every page; the shell builds it.)

### PageHeader
- **Breadcrumb** (13:10963): row, gap 8, items centred.
  - "Brand Studio": a link, 14 Medium / 1.25 (`.t-label-m`), `--text-secondary`, **not underlined**.
  - "/": 14 Regular / 1.4 (`.t-body-s`), `--text-secondary`.
  - "Type styles": 14 Medium / 1.25 (`.t-label-m`), `--text-strong`.
- **No page title.** The breadcrumb is the whole left side; there is no `h1` "Type styles" under it.
- **Actions** (13:10967): row, gap 16, items centred.
  - Save status "All changes saved": 13 Regular / 1.4 (`.t-body-xs`), `--text-secondary`.
  - `sp-chat-btn · Undo`: 36 tall, padding x 16, gap 6, radius 7, an undo icon at 16 (lucide `undo-2` look) and "Undo" in 14 Medium / −0.14px (`.t-button-m`), `--text-strong`. Fill Light `--surface-sunken`, Dark `--surface-raised`. That pair is `--control-fill` (Light paper-100, Dark ink-800), so this is **Button kind `neutralOnPage`, size `default`, icon Undo2**.
  - No ⌘Z hint.

### Card (`sp-list-card · Type styles` 13:10975, 1015 × 386)
- Fill `--surface-raised`, radius 20 (`--radius-card`), Elevation/Small (`--elevation-small`; codegen printed 2/2/4, the named style is Small 2/2/8). Dark adds the `--border-raised` hairline (top 0.65, bottom 0.55, sides 0.25) and the bevels; both come with the token and the composite.
- Column, **padding 8**, **gap 8** (between the rows block and the add slot).
- `rows` (13:10976): column, **padding x 16**. So row content is inset 24 from the card edge, and the add slot only 8.

### Style row (`sp-style-row · …`, 967 wide)
Row, gap **24**, items centred, padding y **20**. Rows are separated by a 1px divider (`rgba(11,11,12,.08)` Light, `rgba(255,255,255,.08)` Dark; use `--border-default`). No divider above the first row or below the last.

| Part | Size | Type | Colour |
|---|---|---|---|
| `specimen` | 240 wide, fixed | The style itself: its font, weight and case, its size capped at 40, line-height 1.1 | `--text-strong` |
| `face` | flex 1 | 13 Regular / 1.4 (`.t-body-xs`) | `--text-secondary` |
| `values` | hug, gap 6 | 14 Regular / 1.4 (`.t-body-s`), Raveo, **not mono** | numbers `--text-strong`; slashes and "Auto" `--text-secondary` |
| `sp-row-menu-trigger` | 32 × 32, radius 7, ellipsis 16 | | **visible at rest** |

The four sample rows, verbatim:

| Row | Specimen (as drawn) | Face | Values | Height |
|---|---|---|---|---|
| Display | "Display", Raveo Display Medium **40** | Raveo Display · 500 | 48 / 1.1 / -1px | 84 |
| Heading | "Heading", Raveo Display Medium 32 | Raveo Display · 500 | 32 / 1.2 / -0.5px | 75 |
| Body | "Body", DM Sans Regular 16 | DM Sans · 400 | 16 / 1.5 / Auto | 72 |
| Label | "LABEL", IBM Plex Mono Medium 12 | IBM Plex Mono · 500 | 12 / Auto / 0.5px | 72 |

- The Display style is 48px but its specimen is drawn at 40. That is the code's cap (`Math.min(fontSizePx ?? 32, 40)`, TypeStylesDetail.tsx:155), so keep it.
- "LABEL" is drawn uppercase: the style's uppercase lock applied to its own name.
- The value order is size / line height / tracking. An unset value reads "Auto" in `--text-secondary`. Tracking carries a "px" suffix; size and line height have none.
- The values are plain text at rest: **no underline, no box**.
- The Display and Heading rows are `<a>` in codegen (they carry prototype links; the targets are not readable through MCP). By frame order, Display leads to Editing size (its size value) and Heading to All properties. Body and Label have no link.
- Row menu trigger = Master **Row menu trigger** (44:29) = `RowMenuTrigger`. The frame draws it on every row at rest, at the static look (transparent, ellipsis in `--text-strong`).

### Add slot (`sp-add-slot · Add style` 13:11036)
- 999 × 56 (the card width less its 8 padding), radius 15 (`--radius-media-plate`), 1px **dashed `--text-secondary`** border, no fill, content centred.
- Label "+ Add style": 14 Medium / 1.25 / −0.14px (`.t-button-m`), `--text-secondary`.
- Matches the other Brand Studio add slots (Colors, Fonts). Not a Master component.

---

## 2. Brand Studio · Type styles · Editing size (13:11041)

Identical to the base frame except the Display row's size value, which becomes an input (`sp-input · Edit size` 13:11134).

- **64 × 28**, fill `--input-bg` (Light `#f1f1ef`, Dark `rgba(241,241,241,.08)`), radius **7** (`--radius-control`), padding x 8, no border.
- Value "48" in 14 Regular / 1.4 (`.t-body-s`), `--text-strong`, left-aligned.
- The value is shown **selected**: a `rgba(20,228,255,.35)` highlight with radius 2 behind "48". That is a picture of the browser's text selection after focus selects the value. Build nothing for it; native `::selection` draws it. (It is not `--state-selection`, #0d99ff.)
- No caret ring and no border change (RULES §6: a focused text field shows the caret and nothing else).
- The values group grows from 89 to 136 wide; the face column shrinks to give it room (534 → 487). Slash, "1.1", slash, "-1px" keep their text look.
- Only one value is in edit at a time. Line height and tracking in edit are not drawn.

---

## 3. Brand Studio · Type styles · All properties (13:11196)

The Heading row stays as at rest, and the style editor (`sp-style-editor · Heading` 13:11314) opens directly under it, **with no divider between the row and the editor**. The divider follows the editor (13:11387), then Body and Label. The card grows to 884 tall.

Nothing on the Heading row changes: no selected fill, no chevron, the trigger at rest.

### Editor (13:11314)
Column, gap **16**, padding-bottom **24**, left-aligned at the row's content edge. Its contents are **640 wide**, not the full row.

1. **`fields`** (13:11315): a wrap of two 312-wide columns, gap **12** (rows) / **16** (columns). Eight fields, each Master **Field** (48:38) = `Field`: label row, then the control 6 below.
   - Label: 12 Medium / 1.25 (`.t-label-xs`), `--text-secondary`.
   - Control: 312 × 40, fill `--input-bg`, radius 9 (`--radius-control-md`), padding x 12, value 14 Regular / 1.4 (`.t-body-s`), `--text-strong`. Selects add a chevron-down 16 at the right with gap 2.

   | # | Label | Control | Value drawn | Model property |
   |---|---|---|---|---|
   | 1 | Name | `Input` | Heading | `name` |
   | 2 | Font | `Select` size `lg` | Raveo Display | `font` (FontRef) |
   | 3 | Weight | `Select` size `lg` | 500 | `weight` |
   | 4 | Color | `Select` size `lg` | Ink 900 | `colorKey` (a palette colour's name) |
   | 5 | Fixed size (px) | `Input` | 32 | `fontSizePx` |
   | 6 | Max characters | `Input` | 40 | `maxLength` |
   | 7 | Letter spacing (px) | `Input` | -0.5 | `letterSpacingPx` |
   | 8 | Line height | `Input` | 1.2 | `lineHeight` |

   Order runs left to right: Name, Font / Weight, Color / Fixed size, Max characters / Letter spacing, Line height. No field shows a placeholder, an error, Edited or Optional.
2. **`toggles`** (13:11362): row, gap 6. Two Master **Choice chips** (98:532) = `ChoiceChip`, both **unselected**: 24 tall, padding x 10, pill, `--surface-sunken`, label 12 Medium (`.t-label-xs`; the frame's leading is 1.4) in `--text-strong`.
   - "Always uppercase" (`uppercase`)
   - "Shrink to fit the box" (`textSizing: "shrink"`)
3. **`rules`** (13:11367): 640 wide, fill `--surface-sunken`, radius 9 (`--radius-control-md`), padding 12 / 16, column, gap 8. Each rule is a row, gap 8: a **lock** icon at 12 (`--text-secondary`), then the sentence in 13 Regular / 1.4 (`.t-body-xs`), `--text-secondary`.
   - "Heading is always Raveo Display Medium in Ink 900."
   - "Heading is fixed at 32px."
   - "Heading never exceeds 40 characters."

   These are exactly `ruleSentences()` (lib/brand/resolveStyle.ts:170) for these values: font + face name + colour, the fixed size, the max length. Letter spacing and line height produce no sentence, in the frame and in the code.
4. **`footer`** (13:11383): 640 wide, row, space-between, items centred.
   - "Delete style": 12 Medium / 1.4 (`.t-label-xs`), **`--text-secondary`**. A plain text button: no icon, no red.
   - Save button (layer named `sp-chat-btn · Done`, label **"Save"**): 28 tall, padding x 10, radius 7, label 12 Medium / 1.3 / −0.12px trimmed (`.t-button-s`). Light: `--field-green` fill with `--accent-green` label. Dark: `--accent-green` fill with `--text-inverse` (ink) label. That is `--btn-primary-bg` / `--btn-primary-fg` in both themes, so **Button kind `primary`, size `sm`**.

The header still reads "All changes saved" with Undo while the editor shows Save (see Open questions).

---

## Dark differences (beyond token flips)

1. **Undo fill.** Light `--surface-sunken`, Dark `--surface-raised`. Both are `--control-fill`, so `neutralOnPage` covers it; it is not a raw override.
2. **Card hairline.** Dark draws the `--border-raised` stroke unevenly (top 0.65, bottom 0.55, sides 0.25). It comes with the Elevation/Small bevels; build nothing extra (RULES §4).
3. **Save button.** Light moss fill with slime label, Dark slime fill with ink label. `--btn-primary-*` flips this way already (Dark fg is `--deep-moss`; the frame binds `--text-inverse`, which is ink in Dark; the two read the same at this size).
4. **Field and edit-size fill.** Dark `rgba(241,241,241,.08)` = Dark `--input-bg`. A token flip.
5. **Dividers.** Light ink 8%, Dark white 8%. Dark `--border-default` is white **10%**; accept the token.
6. **Text.** Dark binds `text/primary`, Light uses raw ink; both equal `--text-strong`.
7. **Selection highlight.** The same cyan in both themes (it is the browser's).

There are no layout, copy or structure differences between the twins.

---

## Data model: what the frames imply

### Type styles themselves: no new properties
Every control in the editor maps to a property `BrandTypeStyle` already has (lib/types.ts:64–87): `name`, `font`, `weight`, `colorKey`, `fontSizePx`, `maxLength`, `letterSpacingPx`, `lineHeight`, `uppercase`, `textSizing`. The row's three values are `fontSizePx` / `lineHeight` / `letterSpacingPx`. The frames add **no** property and drop none from storage, but the UI cannot express three that exist:
- `fontStyle` and `fontStretch` (italic and width cuts, migration 0016). The Weight select shows one number; the code's select also offers only 300–800 (TypeStylesEditor.tsx:151). Today a style set by Import with "Bold Expanded" keeps it until someone edits Weight.
- `textSizing: "fill"` and `"free"`. The chip is on/off for `"shrink"`; a style with "fill" reads as off, and toggling writes `"shrink"` or clears it. The code's checkbox has the same loss (TypeStylesEditor.tsx:252–256).

### Font roles: the change this phase owes (PLAN, "font roles moving from Fonts to Type styles")
**Today** the kit has two role pointers beside the styles, `BrandKit.headingFont` and `BrandKit.bodyFont` (types.ts:96–97; columns `brand_kits.heading_font` / `body_font`, 0001_schema.sql:61–62). They are set on the Fonts page: Heading/Body tags on the row (FontsDetail.tsx:285–289), a "Role" group in the row menu with Heading, Body and a disabled "No role" (FontsDetail.tsx:230–249), "Change face…" with a searchable picker (FontsDetail.tsx:250–252, 318–409), and a guard that blocks removing a face that holds a role (FontsDetail.tsx:216–221). Type styles carry their own `font` independently; nothing links a style to a role.

Readers of `headingFont` / `bodyFont` today:
- `lib/theme.ts:23–30`: `--brand-font-heading` / `--brand-font-body` CSS vars (no stylesheet reads them now).
- `lib/templates/starters/materialize.ts:212–213`: starter templates' display and body slots.
- `builder/TemplateBuilder.tsx:1359` and `builder/fieldOps.ts:247`: the default family of a new text field (heading face).
- `builder/FieldInspector.tsx:327–338`: the "Brand fonts" group in the family picker.
- `lib/render/fonts.ts:264`: `loadBrandFonts` preloads them.
- `admin/brand/BrandOverview.tsx:75`: Fonts readiness ("Fonts still need a heading and a body face.").
- `admin/brand/categories.ts:30–42`: the Fonts row count (heading and body collapse to one row when they match).
- `admin/brand/kitPlumbing.ts:27–28`: defaults Montserrat / Inter when unset.
- Writers: `onboarding/OnboardingWizard.tsx:207–237` (website-extracted or uploaded faces), `brand-from-website` (extraction only), `_shared/publicTemplate.ts:258–259` (writes null on public kits).

**The frames** drop roles from Fonts and show no role on Type styles. A style is the unit that ties a face to a use. Three ways to carry that into the code (Open question 1):
- **A. Roles are type styles.** Add `role?: "heading" | "body"` to `BrandTypeStyle`, at most one style per role (like `BrandColor.role`, types.ts:51). `headingFont` / `bodyFont` become derived (the role style's `font`), written through on save so the columns and edge functions keep working, or read through a helper `kitFace(kit, "heading")` everywhere. The editor needs a place to set the role, which the frames do not draw.
- **B. By key.** No new property; the styles keyed `heading` and `body` (DEFAULT_TYPE_STYLES uses these keys, lib/theme.ts:35–60) are the roles. Fragile: renaming keeps the key, Duplicate and Import mint new keys, and a tenant can delete them.
- **C. Retire the pointers.** Consumers read type styles directly (a new text field takes the first style's font, starter slots bind `typeStyleKey` instead of a family, the family picker's "Brand fonts" group lists the families the styles use). `heading_font` / `body_font` stay unread until Phase 9 drops them.

**Migration needed for A or C.** Existing kits disagree: onboarding writes `headingFont` / `bodyFont` from the website or uploaded files but `typeStyles: DEFAULT_TYPE_STYLES`, whose fonts are hard-coded Montserrat / Inter (OnboardingWizard.tsx:207–237 with theme.ts:35–60). So a kit onboarded from a site set in, say, Playfair has a "Heading" style in Montserrat and a heading face of Playfair. A one-off data migration (jsonb only, no DDL) has to pick a winner per kit. The likely rule: where a style keyed `heading` / `body` exists and its `font` equals the default Montserrat / Inter while `heading_font` / `body_font` differ, set the style's font to the kit face (and mark its role under A); where no such style exists, leave the styles alone. The local backend needs the same pass in `lib/stores/local/db.ts:66`. `kitShape` (kitPlumbing.ts:23) substitutes `DEFAULT_TYPE_STYLES` for an empty list, so a kit with no saved styles has nothing to migrate but shows Montserrat / Inter styles regardless of its faces.

---

## Primitives used / not yet primitives

| Part | Master component | Repo primitive | Notes |
|---|---|---|---|
| Undo | Button 43:123, Neutral on page, Default, icon | `Button kind="neutralOnPage" size="default" icon={Undo2}` | Matches 36 / px 16 / gap 6 / radius 7 |
| Row menu trigger | Row menu trigger 44:29 | `RowMenuTrigger` | Drawn visible at rest |
| Row menu (not drawn here) | Menu 57:423, Menu item 96:507 | `Menu`, `MenuItem`, `MenuDivider` | Replaces admin/brand/primitives/RowMenu.tsx; contents undrawn for Type styles |
| Edit size input | Input 48:37 | `Input`, **no matching size** | 64 × 28, radius 7, px 8. `Input` has default 40 / px 12 / radius 9 and sm 32 / px 10 / radius 7 |
| Editor fields | Field 48:38 + Input 48:37 | `Field` + `Input` | Exact |
| Font, Weight, Color | Select 99:5xx, Large | `Select size="lg"` | 40 / `--input-bg` / radius 9 / chevron 16; exact |
| Uppercase, Shrink | Choice chip 98:532 | `ChoiceChip` | Unselected drawn; selected is ink with inverse label |
| Save | Button 43:123, Primary, Small | `Button kind="primary" size="sm"` | Layer named Done, label Save |
| Delete style | none | **not a primitive** | 12 Medium `--text-secondary` text button; needs a hover (`--state-hover` under it, or underline) and the ring |
| Card | (list card) | **not a primitive** (`Card` is the Insights card with a title) | `--surface-raised`, radius 20, `--elevation-small`, padding 8, gap 8; shared with Fonts |
| Style row | none | **not a primitive** | Page part; `sp-style-row` today |
| Style editor and its rules box | none | **not a primitive** | The rules box is `--surface-sunken`, radius 9, lock 12 |
| Add slot | none | **not a primitive** (admin/brand/primitives/AddSlot.tsx) | Restyle to dashed `--text-secondary`, radius 15, 56 tall |
| Breadcrumb, save status | none | **not a primitive** (BrandDetailHeader.tsx) | Shared by every Brand Studio detail page |

---

## Behaviour differences vs code

Code read: `admin/brand/TypeStylesDetail.tsx`, `admin/TypeStylesEditor.tsx`, `admin/brand/BrandDetailHeader.tsx`, `admin/brand/FontsDetail.tsx`, `admin/brand/kitPlumbing.ts`, `admin/brand/primitives/{AddSlot,RowMenu}.tsx`, `lib/brand/resolveStyle.ts`, `lib/types.ts`, `lib/theme.ts`, and `src/styles/socialpaint.css` §"Fonts and type styles details".

### Header (shared with every detail page)
1. **Title removed.** The code renders an `h1.sp-page-title` "Type styles" under the breadcrumb (BrandDetailHeader.tsx:50). The frame has only the breadcrumb row, with the actions on the same line.
2. **Breadcrumb link not underlined**, 14 Medium. The code underlines it at the label size (BrandDetailHeader.tsx:27–30) and draws the slash in mono 10 (:37).
3. **Save status.** The code shows mono eyebrow "Saving…", "Saved HH:MM" or "All changes saved" (BrandDetailHeader.tsx:52–54). The frame shows "All changes saved" in `.t-body-xs`. "Saving…" and "Saved HH:MM" are not drawn.
4. **Undo.** The code is a 30-tall ghost button with no icon and a "⌘Z" hint (BrandDetailHeader.tsx:55–68). The frame is `neutralOnPage` Default with an undo icon and no hint. A disabled Undo (nothing to undo) is not drawn.

### Card and rows
5. **Card padding.** Code: 24 all round (socialpaint.css:3172–3176, comment "Figma draws 20; rounded to 24"). Frame: 8, with the rows inset 16 more (24 total) and the add slot at 8.
6. **Row padding.** Code: padding-block 24 (socialpaint.css:3276–3283, "Figma draws 18; rounded to 24, as directed"). Frame: 20.
7. **Row divider.** Code uses `--border` between rows (socialpaint.css:3185–3189). Frame uses `--border-default`. The editor is a sibling `div`, so the code draws no divider between the row and the editor, which matches the frame. The divider after the editor is missing in the code (the next row's `border-top` follows a `.sp-style-expand`, not a `.sp-style-row`, so the `+` selector fails).
8. **Face line.** Code: label size in `--text-secondary`, "Any face" when no font (TypeStylesDetail.tsx:212–215; socialpaint.css:3293–3298). Frame: `.t-body-xs`. The "Any face" state is not drawn.
9. **Values font and colour.** Code: mono at the label size, slashes `--text-secondary`, values `--text-primary`, "Auto" `--text-muted` (socialpaint.css:3299–3318). Frame: Raveo `.t-body-s`, values `--text-strong`, slashes and "Auto" `--text-secondary`.
10. **Values hover.** Code underlines every value on row hover (socialpaint.css:3319–3323). Frame draws no hover.
11. **Trigger visibility.** Code hides the row menu trigger until row hover or focus (socialpaint.css:4142–4151, `.sp-menu-row`). Frame shows it at rest on every row.
12. **Specimen colour.** Code `--text-primary` (socialpaint.css:3284–3291); frame `--text-strong`.

### Editing size
13. **Edit input.** Code: `sp-input sp-style-value-input`, 64 × 26, mono, label size (socialpaint.css:3329–3335; TypeStylesDetail.tsx:289–320). Frame: 64 × 28, `--input-bg`, radius 7, px 8, `.t-body-s`.

### All properties
14. **How it opens.** Code: only from the row menu's "Edit all properties" (TypeStylesDetail.tsx:143), and Add style opens it for the new row (:75). The frame's row is a link, which suggests a row click opens it.
15. **Nested accordion.** Code renders the whole `TypeStylesEditor` inside the expansion (TypeStylesDetail.tsx:248–265). That component draws its own bordered card, a chevron header with the name, an "N rules" eyebrow (TypeStylesEditor.tsx:52–82), and, at the bottom, an **"Add type style"** link (TypeStylesEditor.tsx:303–315). The frame has none of these: the fields sit flat under the row.
16. **Editor width.** Code: a 2-column grid across the full row. Frame: 640 fixed (two 312 columns, gap 16).
17. **Field labels.** Code: mono `sp-eyebrow` labels (TypeStylesEditor.tsx:97 and on). Frame: `Field` labels in `.t-label-xs`.
18. **Selects.** Code: native `<select class="sp-input">` with "Not enforced" as the first option; Font has optgroups "Your uploaded fonts" and "Google Fonts" (TypeStylesEditor.tsx:107–172). Frame: `Select` lg closed, no empty state drawn.
19. **Toggles.** Code: two checkboxes with labels (TypeStylesEditor.tsx:236–259). Frame: two Choice chips.
20. **Rules box.** Code: `--accent-wash` fill with `--accent-border`, 11px text, lock 10 in `--state-primary` (TypeStylesEditor.tsx:262–287), shown only when there are rules. Frame: `--surface-sunken`, radius 9, `.t-body-xs`, lock 12 in `--text-secondary`.
21. **Delete style.** Code: `--state-danger` red with a trash icon (TypeStylesEditor.tsx:289–296). Frame: neutral `--text-secondary` text, no icon.
22. **Save.** Code: no Save; every keystroke commits through `brand.commit` with autosave and a coalesced undo step (TypeStylesDetail.tsx:47–61; kitPlumbing.ts). Frame: a primary "Save" in the editor footer, while the header still reads "All changes saved".
23. **Placeholders.** Code: "Per template" (Fixed size), "No limit" (Max characters), "Not enforced" (Letter spacing, Line height) (TypeStylesEditor.tsx:181, 196, 212, 228). Frame: every field filled; no placeholder drawn.

### Fonts page (the role half, for the Fonts spec)
24. **Roles leave Fonts.** Code: Heading/Body tags, Role group, "Change face…", the role guard on Remove (FontsDetail.tsx:216–289). Frames: no tags; menu Rename, Replace file, Remove. Neither "Rename" nor "Replace file" exists in the code's font menu.
25. **Fonts readiness.** BrandOverview.tsx:73–78 still marks Fonts unfinished until both faces are set ("Fonts still need a heading and a body face."). With no role UI on Fonts, that reason has no action on the Fonts page.

---

## Interactions the frames drop

Flag each to CJ before building. Per memory, CJ dislikes losing familiar interactions.

1. **The row menu's contents.** The trigger is drawn; the menu is not (for Type styles). Today: Rename, Duplicate, Edit all properties, then Remove in red (TypeStylesDetail.tsx:138–147).
2. **Right-click opens the row menu** at the pointer (TypeStylesDetail.tsx:181–184).
3. **Rename in place** on the specimen: Enter saves, Esc reverts, blur saves (TypeStylesDetail.tsx:186–206). The editor's Name field also renames.
4. **Duplicate** a style ("{name} copy", TypeStylesDetail.tsx:130–134).
5. **Remove from the row** without opening the editor (menu Remove). The frame's only delete is "Delete style" inside the editor.
6. **In-place editing of line height and tracking.** Only size is drawn in edit.
7. **Keyboard in the value input:** ArrowUp/Down steps (size 1, line height 0.05, tracking 0.5; Shift ×10), Enter or Tab saves and moves to the next value, Esc reverts, blur saves, an empty value saves as Auto, a "px" suffix is accepted (TypeStylesDetail.tsx:270–320).
8. **Hover underline on values**, the cue that they are editable (socialpaint.css:3319–3323).
9. **Autosave with Undo per change.** Every edit saves at once and is one Undo step (coalesced per page). A Save button changes this to a draft per style.
10. **The blast-radius toast.** Each change announces "Restyled N fields in M templates" or "Type styles updated" (TypeStylesDetail.tsx:47–60; kitPlumbing.ts:298–304). Not drawn.
11. **Clearing a lock.** "Not enforced" in Font, Weight and Color, and empty number fields, unlock a property (the field then sets it per template). Not drawn.
12. **Font list sources.** Uploaded families first, then the full Google list (TypeStylesEditor.tsx:119–136). The frame shows only a closed select.
13. **Delete in red with an icon**, the destructive cue (TypeStylesEditor.tsx:289–296).
14. **Add style flow.** Adds "New style", opens its editor, focuses Name (TypeStylesDetail.tsx:63–77); the overview's setup strip action "Add style" lands here and adds one (consumeAddFlow, :79–83). Not drawn.
15. **Font roles on Fonts.** Heading/Body tags, the Role group, "Change face…" with search and arrow keys, and the guard that stops removing a face in use (FontsDetail.tsx:216–409). The frames move the face to each style but show no way to say which style is the heading or body face.
16. **Rule summary when collapsed.** The old accordion showed the rule sentences under a closed style and an "N rules" count (TypeStylesEditor.tsx:79–88). The new rows show values only. (Today the detail page shows this only inside the nested accordion.)

Not dropped, but undrawn (keep as is): specimens loaded in their own faces (TypeStylesDetail.tsx:37–44), the specimen's uppercase, weight, italic and width, the 40px specimen cap, Undo's ⌘Z / Ctrl+Z shortcut, the loading skeleton (BrandDetail.tsx:103), and the Import page adding styles.

---

## Open questions

1. **Where do font roles live?** The frames remove them from Fonts and show none on Type styles. Pick one:
   - A: a `role` on a type style (one style per role), set in the editor (where? a "Use as" select, or a row menu group like Fonts had), with `headingFont` / `bodyFont` derived from it.
   - B: the styles keyed `heading` and `body` are the roles, implicitly.
   - C: retire roles; new text fields, starter templates and the builder's "Brand fonts" group read the type styles.
2. **Migration winner.** Onboarded kits can have a Heading style in Montserrat while the heading face is the website's font. When roles move, does the kit face (`heading_font` / `body_font`) overwrite the default style's font, or does the style win?
3. **Fonts readiness.** What makes Fonts "ready" on the overview once roles are gone (at least one font? one per role, now checked on Type styles)? What reason and action does the setup strip show?
4. **Save or autosave.** Does the editor become a draft with Save (and is there Cancel, and what happens to unsaved edits when another row opens or the page changes)? Or is "Save" a Done that closes an autosaving editor, as the layer name suggests? The header says "All changes saved" in the same frame.
5. **Opening the editor.** Row click (the prototype link), the row menu, or both? What closes it (Save, row click again, Esc)? Can two editors be open at once?
6. **Row menu contents.** Keep Rename, Duplicate, Edit all properties, Remove? Mirror the Fonts menu shape (Rename, …, divider, Remove)?
7. **Inline values.** Can line height and tracking still be edited in place, or only size? The edit input is 28 tall with radius 7 and px 8: add an `Input` size (xs) or use `sm` (32 / px 10)?
8. **Delete style.** Neutral text as drawn, or the destructive look? Confirm before deleting a style that fields are bound to (it unbinds them silently today)?
9. **Shrink to fit vs. fill and free.** The chip covers "shrink" only. Do "fill" and "free" stay reachable (a Select "Text sizing" instead of a chip)? Same for italic and width, which the Weight select cannot show.
10. **Empty and unlocked states.** What do Font, Weight and Color show when not enforced ("Not enforced", "Any", a placeholder)? Do number fields keep "Per template", "No limit", "Not enforced" as placeholders (RULES §9 allows placeholders, not helper text)?
11. **Rules box.** Shown only when there are rules (as the code does), or always? Lock colour `--text-secondary` as drawn?
12. **Font list.** Should the Font select list only the fonts on the Fonts page (uploaded plus any Google faces the kit uses), or also the whole Google catalogue as today?
13. **Weight list.** Fixed 300–800 as today, or only the weights the chosen family ships (the type's own comment asks for this)?
14. **Trigger at rest.** Show the row menu trigger on every row at rest, as drawn, instead of on hover?
15. **Padding.** Accept the frame's card padding 8 with rows inset 24, and row padding 20, replacing the "rounded to 24, as directed" values in the code?
16. **Default styles for new accounts.** Keep Heading / Subhead / Body in Montserrat / Inter (lib/theme.ts:35–60) as generic defaults? The frames' Display / Heading / Body / Label are sample content and must not be seeded (decision 6). Should the defaults take the onboarding faces instead of hard-coded families?
17. **Specimen inline styles.** The specimen sets size, family and weight inline from tenant data. Record it as the exception to RULES §5 (no inline type in chrome), since it previews tenant content, not chrome?
18. **Header states.** Copy and look for "Saving…" and the time-stamped "Saved" status, and Undo when there is nothing to undo (disabled at 40%)?

---

# Part D: Images and Import

Source: Figma "Master UX-UI" (`mEJRslarcQDkgPeY6AObi5`), page "Brand Studio" (8:676), read on 2026-10-05, read only. All frames 1440×1053. The sidebar (`sp-nav`, x 0–335) is ignored; everything below sits in `sp-page · Generate` (x 335, w 1105; the layer keeps Generate's name).

| Frame | Light | Dark | Screenshot (Light, 1440) |
|---|---|---|---|
| Brand Studio · Images | 13:11956 | 13:12313 | `brand-studio-images.png` |
| Brand Studio · Images · Uploaded | 13:12050 | 13:12407 | `brand-studio-images-uploaded.png` |
| Brand Studio · Images · Row menu | 13:12176 | 13:12533 | `brand-studio-images-menu.png` |
| Brand Studio · Import | 13:12670 | 13:12988 | `brand-studio-import.png` |
| Brand Studio · Import · Importing | 13:12772 | 13:13090 | `brand-studio-import-importing.png` |
| Brand Studio · Import · Done | 13:12879 | 13:13197 | `brand-studio-import-done.png` |

Screenshots are saved next to this file in `p6/`.

Read this first:

- **No Master instances in any of the six frames.** Every part is a plain frame (`sp-images-empty`, `sp-image-card · …`, `sp-row-menu`, `sp-import-leg · …`, `sp-import-status · …`). The mappings to primitives below are by look and measurement.
- Light text is mostly raw `#0b0b0c` (= `--text-strong`). Dark binds the same text to `text/primary` (#f1f1f1), which equals `--text-strong` in Dark. Use `--text-strong` throughout.
- All three Images frames and all three Import frames share one page header and the footer links. The header is the Brand Studio detail header; other parts of this spec cover it too, and it is summarised once here.

Type key (from `src/styles/tokens.css`): t-label-m 500 14/1.25 · t-label-s 500 13/1.25 · t-label-xs 500 12/1.25 · t-body-s 400 14/1.4 · t-body-xs 400 13/1.4 · t-caption-s 400 12/1.25 · t-button-m 500 14/1.25 −0.01em.

Colour key (Light / Dark): `--surface-page` #f9f9f8 / #0b0b0c · `--surface-raised` white / #171819 · `--surface-sunken` #ececec / #2f3133 · `--control-fill` #ececec / #171819 · `--input-bg` #f1f1ef / rgba(241,241,241,.08) · `--text-secondary` #636363 / #a0a0a0 · `--btn-primary-bg/-fg` Deep Moss #082a23 + Slime #17ff7e in Light, inverted in Dark · `--accent-green` #17ff7e both.

---

## 0. Shared page frame (all six frames)

`sp-page` (1105 wide): column, padding top 45, bottom 28, no gap. Children: `PageHeader`, `Brand Studio content` (flex 1), `Footer links`.

### PageHeader (13:12030 and siblings): 36 tall, row, space-between, items centred, padding x 45

- `Breadcrumb` (gap 8, 14px, nowrap):
  - "Brand Studio": Label/M (`.t-label-m`), `--text-secondary`, a link, **not underlined**.
  - "/": Body/S (`.t-body-s`), `--text-secondary`.
  - Current crumb: Label/M, `--text-strong`. Strings: **"Images"** (Images frames), **"Import"** (Import frames).
- `Actions` (row, **gap 16**, items centred):
  - Save status: **"All changes saved"**. 13 Regular / 1.4 → `.t-body-xs`, `--text-secondary`.
  - `sp-chat-btn · Undo`: h 36, padding x 16, gap 6, radius 7, icon 16 (lucide undo-2, the curved back arrow) then "Undo" in 14 Medium −0.14px (`.t-button-m`), `--text-strong`. Fill Light `--surface-sunken` (#ececec), Dark `--surface-raised` (#171819). That pair is `--control-fill`, so this is **Button kind `neutralOnPage`, size `default`, icon Undo2**.
- **No title row, no eyebrow, no ⌘Z hint.** The breadcrumb's last crumb is the page title, as in the Generate thread header.

### Brand Studio content
- Column, padding top **24**, x 45. Import frames add gap **24** between the grid and the status card.

### Footer links (13:12047)
- Row, gap 16, centred, padding x 45. Caption/S (`.t-caption-s`), `--text-secondary`, not underlined: "Terms of Service", "Privacy Policy". Same footer as Generate; the shell owns it.

---

## 1. Brand Studio · Images (13:11956), empty

### `sp-images-empty` (13:12043)
- Full width (1015), **320 tall**, radius 20 (`--radius-card`), **1px dashed `--text-secondary`**, no fill, overflow clip.
- Column, gap **16**, centred both ways.
- Title: **"No images yet"**. Label/S (`.t-label-s`), `--text-strong`.
- `sp-button · Upload images`: h **44**, padding x 18, radius 9, `--btn-primary-bg` with a `--btn-primary-fg` label, 14 Medium −0.14px. **Button kind `primary`, size `lg`**, label **"Upload images"**. No icon.
- **No helper line.** Today's "Drop JPG, PNG, or SVG files here. Large photos are resized before upload." is absent.
- No drag-over look is drawn.

---

## 2. Brand Studio · Images · Uploaded (13:12050)

### `sp-images-grid` (13:12137)
- Row (flex), **gap 16**, items start. Four columns at this width, each `flex: 1`: three image cards (245.25 wide) and the add slot (231.25 wide as measured; it takes the same flex share, so treat it as a fourth equal column).
- Card height 207.

### `sp-image-card` (e.g. 13:12138 "portrait-studio.jpg")
- Column, padding **8** all round, radius 20, `--surface-raised`, **Elevation/Small** (`--elevation-small`). No gap between plate and meta.
- `plate`: full width, **132 tall**, radius **15** (`--radius-media-plate`), **1px border** Light `rgba(11,11,12,.08)` / Dark `rgba(255,255,255,.08)` (use `--border-default`), image `object-fit: cover`. No fill drawn under the image.
- `meta`: column, padding **t 6 / l 4 / b 4** (no right padding, so the trigger sits flush with the plate's right edge).
  - `name row`: row, space-between, items centred, 32 tall.
    - Name: Label/S (`.t-label-s`), `--text-strong`, nowrap. Strings: **"portrait-studio.jpg"**, **"team-offsite.jpg"**, **"team-candid.jpg"** (sample data).
    - `sp-row-menu-trigger`: 32×32, radius 7, ellipsis 16, no fill. **Drawn visible on every card**, not only on hover. = **RowMenuTrigger** (44:29).
  - Meta line: 12 Medium / **1.4**, `--text-secondary`, sentence case, nowrap. Strings: **"JPG · 1200 × 800"**, **"JPG · 512 × 512"**, **"JPG · 1080 × 630"** (format · width × height, sample data). No exact class: `.t-label-xs` is 12/1.25.
- No hover, focus or selected look is drawn on the card.

### `sp-add-slot · Add images` (13:12171)
- Stretches to the card height (207), radius 20, **1px dashed `--text-secondary`**, no fill, content centred.
- Label: **"+ Add images"**, 14 Medium −0.14px → `.t-button-m`, `--text-secondary`. No detail line.

---

## 3. Brand Studio · Images · Row menu (13:12176)

Same page as Uploaded. The first card's trigger is open and a menu floats below it.

### Open trigger (13:12269 "sp-row-menu-trigger (open)")
- Fill `--surface-sunken` (#ececec Light, #2f3133 Dark), radius 7. Matches `.ui-rowmenu[aria-expanded="true"]`.

### `sp-row-menu` (13:12302)
- 200×165 at frame x 417, y 287. The trigger spans x 585–617, y 251–283, so the menu's **right edge aligns with the trigger's right edge** and its **top is 4 below the trigger**. That is `Menu align="end"` with `sideOffset 4` (and today's `RowMenu` maths).
- Padding 6, column, gap 2, radius 16 (`--radius-menu`), `--surface-raised`, **Elevation/Medium** (the codegen printed 4/4/8, the named style is Medium). No stroke in either theme.
- Items: 188×34, padding l 10 / r 8 / y 8, radius 7. Label Trimmed/Body/S (`.t-body-s .t-trim`), `--text-strong`. **No icons, no meta, no chevrons.** = Master **Menu item** (96:507).
  1. **"Rename"**
  2. **"Download"**
  3. **"Copy link"**
  4. divider: 9 tall, padding 4 around a 1px line, Light `rgba(11,11,12,.08)` / Dark `rgba(255,255,255,.08)` → **MenuDivider** (`--border-default`).
  5. **"Remove"**: **same `--text-strong` as the others. Not red.**
- No hover or focused item is drawn; no disabled item is drawn.

What each item does today (`ImagesDetail.tsx`):

| Item | Action | Code |
|---|---|---|
| Rename | Swaps the name for an inline input (selected on focus; Enter or blur saves through `brandAssets.update`, Escape cancels) | 211, 173–181, 249–264 |
| Download | Clicks a hidden `<a download>` on the signed URL; disabled until the URL is signed | 212–216, 293–302 |
| Copy link | Writes the **signed** (time-limited) URL to the clipboard; disabled until signed; error "Couldn't copy the link." | 217, 183–190 |
| Remove | Checks every template for the asset; if used, shows an inline alert with the template names and "Show templates"; else deletes and refreshes. No confirm. | 220, 192–206, 273–291 |

---

## 4. Brand Studio · Import (13:12670), idle

### `sp-import-grid` (13:12757)
- Row, **gap 24**, two equal cards (495.5 each), 116 tall.

### `sp-import-leg · Figma` (13:12758)
- Column, padding **24**, gap **12**, radius 20, `--surface-raised`, Elevation/Small.
- Title: **"From a Figma file"**. Label/S (`.t-label-s`), `--text-strong`.
- **No helper line.** Today's "Paste a link to a file your workspace can read. Color and text styles come in." is absent.
- `link row`: row, gap 8, items centred.
  - `sp-input · Figma file link`: flex 1, h **40**, padding x 12, radius 9, fill `--input-bg` (#f1f1ef). Placeholder **"figma.com/design/…"**, Body/S (`.t-body-s`), `--text-secondary`. = **Input** (Field.tsx), size md.
  - `sp-button-secondary · Import`: h 40, padding x 18, radius 9, `--btn-primary-bg` / `--btn-primary-fg`, **"Import"** 14 Medium −0.14px. **Button kind `primary`, size `md`**, drawn **enabled while the field shows only its placeholder**. (The layer name says "secondary"; the fill is primary.)

### `sp-import-leg · Tokens` (13:12765)
- Same card recipe.
- Title: **"From a tokens file"**, `.t-label-s`, `--text-strong`.
- **No helper line.** Today's "Drop a design-tokens JSON file, or browse for one." is absent.
- `sp-button-secondary · Choose tokens.json`: h 40, padding x 18, radius 9, `--surface-sunken`, `--text-strong`, **"Choose tokens.json"**. **Button kind `neutral`, size `md`**, hugging its label (left aligned).

---

## 5. Brand Studio · Import · Importing (13:12772)

Grid as idle, with these changes:
- Field holds a value: **"figma.com/design/Acme-Health-Brand-Kit"** (sample), Body/S, `--text-strong`.
- `sp-button-secondary · Import (disabled)`: **`--surface-sunken` fill, `--text-strong` label, opacity 0.40.** The disabled Import is drawn **neutral at 40%**, not primary at 40%.
- Choose tokens.json is unchanged (not disabled).
- The leg cards are plain frames here (not links) in this frame; no behavioural meaning.

### `sp-import-status · Importing` (13:12871)
- Full width, 24 below the grid. Column, padding 24, gap **12**, radius 20, `--surface-raised`, Elevation/Small.
- Step: **"Pulling color and text styles from Figma…"** (with the ellipsis character). Body/S (`.t-body-s`), `--text-strong`. Regular weight, not a label.
- `progress`: full width (967), **4 tall**, `--surface-sunken` track, pill radius, overflow clip. Inside, a 220 transparent `offset` then a **280-wide `--accent-green` pill**. That is an **indeterminate segment** caught mid-slide, not a percentage. Close to **ProgressBar** (58:451): same 4 track, sunken track, accent-green fill, pill radius; the primitive is determinate only.
- No Cancel, no percentage, no step count.

---

## 6. Brand Studio · Import · Done (13:12879)

Grid as idle, but the field **still holds "figma.com/design/Acme-Health-Brand-Kit"** and **Import is enabled primary** again.

### `sp-import-status · Done` (13:12978)
- Full width, 24 below the grid. Column, padding 24, gap **6** (off the scale, as drawn), radius 20, `--surface-raised`, Elevation/Small.
- Result: **"Added 3 colors and 2 type styles"**. Label/S (`.t-label-s`), `--text-strong`. (Counts are sample data; the sentence shape is today's.)
- Matched: **"4 matched what you already had, so those stayed as they were."** Body/S (`.t-body-s`), `--text-secondary`. Same copy as today.
- `actions`: row, **gap 16**, items centred, **padding-top 10**.
  - `sp-button-secondary · View colors`: h 40, padding x 18, radius 9, `--surface-sunken`, **"View colors"**. **Button kind `neutral`, size `md`.**
  - **"Undo import"**: a text link, Label/M (`.t-label-m`), `--text-secondary`, **not underlined**, no box. Same look as the breadcrumb's link crumb.

---

## Dark differences (beyond token flips)

Token flips apply (`--surface-page` #0b0b0c, `--surface-raised` #171819, `--surface-sunken` #2f3133, `--text-strong` #f1f1f1, `--text-secondary` #a0a0a0, `--input-bg` white 8%, bevels and shadow). Beyond flips:

- **Raised cards gain the `--border-raised` hairline** (0.65 top / 0.25 sides / 0.55 bottom, rgba(241,241,241,.2)): the image cards, both import legs and both status cards. This is the same Dark edge every raised card has; the elevation composite already carries it, so no extra rule.
- **Header Undo** fill is `--surface-raised` in Dark (Light `--surface-sunken`). Both are `--control-fill`, so `neutralOnPage` covers it with no override.
- **Primary buttons invert**: Upload images and Import are Slime with a Deep Moss label in Dark (`--btn-primary-*`).
- **Image plate border** is white 8% in Dark; `--border-default` Dark is paper-075 at 10%. Close enough; use the token.
- **Row menu** stays `--surface-raised` with **no stroke** in Dark (unlike Phase 5's Dark connectors submenu, which had a 5px edge). Divider is white 8%.
- **Progress** keeps `--accent-green` on a `#2f3133` (`--surface-sunken`) track in both themes.
- Dark disabled Import is `#2f3133` at 40%, i.e. the same neutral-at-40% rule.
- Nothing else differs: same strings, same geometry, same states.

---

## Import sources: what the frames show and what the backend supports

| Source | In the frames | Backend today |
|---|---|---|
| Figma file link (color and text styles) | Yes (Figma leg) | **Supported on Supabase only.** `stores.designImport.importStylesFromUrl` → edge function `figma-styles` (`supabase/functions/figma-styles/index.ts`), which needs the workspace's Figma connection (Settings → Integrations, a PAT via `figma-connect`). Not connected → 400 "Figma is not connected for this company." On the local backend `isConfigured()` is false and `ImportDetail` hides the whole leg (`ImportDetail.tsx:118`); the local provider throws if called (`localStores.ts:692`). |
| tokens.json (W3C design tokens, Claude Design export, simple `{colors:{…}}` maps) | Yes (Tokens leg) | **Supported on both backends, client side.** `parseDesignTokens` in `src/lib/brand/designSystemImport.ts:76`; merge in `kitOps.mergeImportedColors`. No server call. |
| Website URL | No | An edge function exists (`brand-from-website`, client `src/lib/brand/brandFromWebsite.ts`) returning colors, heading/body font and a logo, but it is wired only into onboarding (`OnboardingWizard.tsx:628`) as a prefill. Not offered in Brand Studio. |
| Canva | No | Canva is connected for templates only (`designImport.autoBuild`, `CanvaImportDialog.tsx`). No brand-style import from Canva. |
| PDF / brand guidelines | No | None. `parseGuidelines(markdown)` exists in `designSystemImport.ts:154` (guidelines.md → suggested rules) but nothing calls it from Brand Studio. |

The overview card's count line reads "FIGMA OR JSON" (`categories.ts:64`), which matches the two drawn sources.

---

## Primitives used / not yet primitives

| Frame part | Master component (by look) | Repo today |
|---|---|---|
| Breadcrumb header | (page header, 156:748 pattern) | `layout/Breadcrumb.tsx` `BreadcrumbHeader` exists (Generate, fill page). Brand Studio still uses `admin/brand/BrandDetailHeader.tsx` (breadcrumb **plus** an `h1` title row and ⌘Z hint). Not a primitive. |
| Header Undo | Button 43:123, neutral on page, Default, icon | `Button kind="neutralOnPage" size="default" icon={Undo2}`. Today `sp-btn sp-btn-ghost` at 30 tall (`BrandDetailHeader.tsx:55–62`). |
| Save status | none | Plain `.t-body-xs` text with `role="status"`. Today `sp-eyebrow` (`BrandDetailHeader.tsx:52`). |
| Empty drop zone | none | Not a primitive (`.sp-images-empty`, `socialpaint.css:3217`). |
| Upload images | Button primary Large | `Button kind="primary" size="lg"`. Today `sp-btn sp-btn-primary`. |
| Image card | none (shape of Result card 104:602: 8 padding, 20 radius, 15 plate) | Not a primitive. Today `sp-card sp-logo-card sp-menu-row` + `.sp-image-card__plate` (`ImagesDetail.tsx:224–247`). `ResultCard` (Previews.tsx) carries the preview overlay and download, which this card does not want. |
| Row menu trigger | Row menu trigger 44:29 | `RowMenuTrigger` primitive (IconButton.tsx:45). Today the legacy `.sp-icon-btn.sp-row-menu-trigger` inside `admin/brand/primitives/RowMenu.tsx`. |
| Row menu | Menu 57:423, Menu item 96:507, Menu divider 57:421 | `Menu` / `MenuItem` / `MenuDivider` primitives (Radix dropdown). Today the hand-rolled `admin/brand/primitives/RowMenu.tsx`, which also supports right-click `openAt`, `menuitemradio` with checks, group labels and a red `destructive` item. The primitive has none of right-click or destructive. |
| Add slot | none | `admin/brand/primitives/AddSlot.tsx` (picker + drop). Not a Master primitive; needs the 20 radius and `--text-secondary` dash. |
| Import leg / status cards | none (raised card, 24 padding) | Not a primitive (`.sp-import-leg`, `.sp-import-status`, `socialpaint.css:3250–3272`). `Card` (58:476) is the Insights card with a `t-title-panel` header, which is a different title size. |
| Figma link field | Input (md, 40) | `Input` / `Field` primitives (Field.tsx), with the Field's error line for "Paste a link that starts with figma.com/design/". Today `sp-input` + a hand-styled error `<p>`. |
| Import | Button primary Medium | `Button kind="primary" size="md"`. Today `sp-btn sp-btn-ghost`. Disabled look differs (see Behaviour 14). |
| Choose tokens.json | Button neutral Medium | `Button kind="neutral" size="md"` look, but it must stay a file picker and a drop target (today a `<label>` wrapping a hidden input, `ImportDetail.tsx:160–177`). `Button` renders a `<button>`; needs a label/`asChild` path or a hidden input clicked from the button. |
| Import progress | Progress bar 58:451 | `ProgressBar` primitive (Containers.tsx:185), **determinate only**. The frame draws an indeterminate segment. Today `.sp-upload-track/.sp-upload-bar` shimmer (`socialpaint.css:3940`). |
| View colors | Button neutral Medium | `Button kind="neutral" size="md"`, navigating on click. Today an `<a class="sp-btn sp-btn-ghost">` (keeps open-in-new-tab). |
| Undo import | none (text link) | Not a primitive; same style as the breadcrumb link (`.t-label-m`, `--text-secondary`, `ui-ring`). Today `sp-btn sp-btn-tertiary`. |

---

## Behaviour differences vs code

Paths are relative to `src/app/components/admin/brand/` unless given in full.

Header (`BrandDetailHeader.tsx`, all detail pages):

1. **Title row removed.** Today a breadcrumb line sits above an `h1.sp-page-title` row holding status and Undo (`BrandDetailHeader.tsx:17–70`). The frames have one 36-tall row: breadcrumb left (last crumb is the title), status and Undo right. Move to `BreadcrumbHeader` with the current crumb as the `h1`.
2. Breadcrumb "Brand Studio" is **not underlined** (today underlined, `:27–30`); the separator is Body/S `--text-secondary` (today mono 10 `--text-muted`, `:35–40`).
3. **⌘Z hint removed** (`:63–68`). The shortcut itself stays (`kitPlumbing.ts:200–211`).
4. Undo becomes a 36-tall `neutralOnPage` button with the undo icon (today a 30-tall ghost with caption text, `:55–62`). Status-to-Undo gap 16 (today 12).
5. Save status type: `.t-body-xs` sentence case (today `sp-eyebrow`, `:52`). The "Saving…" and "Saved 10:42" variants are not drawn.
6. Content starts 24 below the header row (today the header's `marginBottom: var(--space-lg)` = 32 below a taller block, `:17`).

Images (`ImagesDetail.tsx`):

7. **Empty helper line removed**: "Drop JPG, PNG, or SVG files here. Large photos are resized before upload." (`:113–121`).
8. Empty zone: border `--text-secondary` dashed (today `--border-strong`, `socialpaint.css:3224`), gap 16 (today 8 plus an 8 `marginTop` on the button, `:124`), Upload images is Large 44.
9. **Row menu trigger always visible.** Today it hides until the card is hovered or focused on hover-capable devices (`.sp-menu-row`, `socialpaint.css:4142–4150`, D9). The frames draw the ellipsis on every card at rest.
10. **Remove is not red.** Today `destructive: true` paints it `--state-danger` (`:220`, `socialpaint.css:4196`). The `Menu` primitive has no destructive style either.
11. Card geometry: padding 8 all round, plate then meta with no gap (t 6 / l 4 / b 4) and radius 20, plate radius 15 with a `--border-default` 1px edge. Today `.sp-logo-card` pads 8/8/12 with an 8 gap and `--radius-media` (`socialpaint.css:3113–3122`), plate on legacy `--bg-hover` (`:3238`).
12. Meta line: 12 Medium sentence case `--text-secondary` (today `sp-eyebrow`, mono-style, `:270–272`). Name: `.t-label-s` (today `.sp-color-card__name`, `--text-primary`).
13. Add slot: radius 20 and `--text-secondary` dash (today `--radius-media` and `--border-strong`, `socialpaint.css:4205–4216`); label `.t-button-m` (today `--type-label-size` with no tracking). Today the slot carries `minHeight: 132` and stretches (`:148`); the frame stretches to the card height (207).
14. Grid: four equal columns, gap 16, same as today's `.sp-logos-grid` at desktop (`socialpaint.css:3094–3099`). Same.

Import (`ImportDetail.tsx`):

15. **Both helper lines removed** (`:121–123`, `:159`).
16. **Import is primary** (today `sp-btn-ghost`, `:141–147`). Drawn **enabled with an empty field** in the idle frame, where today it is disabled until the link matches `FIGMA_RE` (`:143`). Its disabled look is **neutral at 40%** (Importing frame), not primary at 40% as `Button` would draw it.
17. **The link stays in the field after a successful import** (Done frame: field filled, Import enabled). Today the field is cleared on success (`:92`).
18. Importing step: Body/S Regular `--text-strong` (today the label style, Medium, `:196`).
19. **Progress**: 4 tall, `--surface-sunken` track, an `--accent-green` segment sliding (indeterminate). Today a 3 tall track in `--border-strong` mix with a full-width `--fill-primary` bar and a shimmer (`:200–202`, `socialpaint.css:3940–3965`). Both are indeterminate, as today's comment requires (`:197–199`, the store call has no abort signal).
20. Done: card gap 6, actions gap 16 with 10 above (today gap 8, `:217`). View colors is a neutral Medium button (today ghost, `:221`); Undo import is a plain text link in `--text-secondary` (today `sp-btn-tertiary`, `:225–233`).
21. Done's result line is `.t-label-s`, matched line `.t-body-s` `--text-secondary` (today label style and caption-size muted, `:104–113`).
22. Status cards: `--surface-raised` with Elevation/Small (today `--bg-surface`, `socialpaint.css:3271`). Legs: same padding 24 and gap 12 as today (`.sp-import-leg`). Same.
23. Grid stays two columns at desktop, gap 24 (today `.sp-import-grid` 2 columns from 1024, gap `--space-md`). Same.

## Interactions the frames drop

Each is today's behaviour and is absent from the frames. CJ decides each.

Header:
1. **The ⌘Z hint** beside Undo (the shortcut keeps working).
2. **"Saving…" and "Saved 10:42"** status variants, and the **disabled Undo** when there is nothing to undo (`canUndo`).
3. **The page-level error banner** under the header (`BrandDetail.tsx:31–40`, upload, rename and remove failures land here).
4. **The loading skeleton** for each detail page (`BrandDetail.tsx:57–100`).

Images:
5. **Drag-and-drop onto the empty zone** and its active look (`ImagesDetail.tsx:79–81, 102`), and **drop onto the Add slot** (`AddSlot.tsx:29, 40`). The frames show no drop target state.
6. **Multiple-file upload**, SVG support and the **downscale before upload** (`:16, 21–34`). Invisible, but the helper line that explained it goes.
7. **Right-click on a card opens the row menu at the pointer** (`:227–230`). The Radix `Menu` primitive cannot open at a point.
8. **Hover-only trigger** (D9): the frames make it always visible.
9. **Inline rename** (input in the name row, Enter/blur saves, Escape cancels, `:249–264`). The menu item is drawn; the editing state is not.
10. **Remove's in-use guard**: the inline alert naming up to three templates plus "Show templates" (`:192–200, 273–291`). Not drawn anywhere.
11. **Red Remove** as the destructive signal.
12. **Disabled Download / Copy link** until the signed URL is ready (`:214, 217`).
13. **The add flow from the overview** (`consumeAddFlow`, opening the picker on arrival, `:75–77`).
14. **Natural-size fallback** for older images without recorded dimensions (`:166–171, 237–244`); invisible, keep.
15. **Responsive columns** 4 / 3 / 2 (`socialpaint.css:3100–3109`). Frames are desktop only; keep.

Import:
16. **Inline link validation**: blur with a bad link shows "Paste a link that starts with figma.com/design/" (`:134–138, 149–153`).
17. **Enter in the link field imports** (`:139`).
18. **Dropping a tokens.json on the Choose button** (`:100–102, 160–163`).
19. **The 1-second reveal delay** on the Importing card, so a fast import never flashes it (`:40–48`).
20. **The tokens step copy** "Reading the tokens file…" (`:69`). Only the Figma step is drawn.
21. **Error lines**: "No color or typography tokens found in that file.", "Could not parse that file as JSON.", "Figma style import failed." and the server's "Figma is not connected for this company." (`:75, 82, 96, 181–192`).
22. **Hiding the Figma leg on a backend without Edge Functions** (`:118`). Not drawn; a single Tokens card layout is not drawn either.
23. **The matched line is conditional** (shown only when matched > 0, `:212`). The frame shows it filled.

## Open questions

1. **Remove in the image row menu**: neutral as drawn, or keep it red? `RULES.md` §7 keeps error red as a functional signal, and the `Menu` primitive has no destructive item. If neutral, does Remove need a confirm?
2. **Where does the "in use on N templates" block go** when Remove is refused? Inline under the card as today, a toast with "Show templates", or a disabled Remove with the reason?
3. **Row menu trigger visibility**: always visible as drawn (reversing D9's hover-only), or hover and focus only?
4. **Right-click to open the row menu**: keep it? It means keeping `admin/brand/primitives/RowMenu.tsx` restyled to the Menu look, or adding a Radix `ContextMenu` beside the `Menu` primitive.
5. **Rename's editing state** is undrawn. Use the `Input` primitive at Small (28) in the name row?
6. **Image upload feedback**: neither the code nor the frames show progress while images upload. Add an uploading card (a skeleton plate with the file name), or leave it silent as today?
7. **Drop-target look** for the empty zone and the Add slot: the frames draw none. Keep today's border change (dash to `--text-secondary`, which is now the resting colour), or lay `--state-hover` over it?
8. **Empty-state helper line** ("Drop JPG, PNG, or SVG files here…"): drop it as drawn?
9. **Import button with an empty field**: enabled as drawn (then a click shows the Field error), or disabled until the link is valid as today?
10. **Disabled Import look**: neutral at 40% as drawn, or primary at 40% (the `Button` rule)? If neutral, record it as an exception.
11. **Keep the link after a successful import** (as the Done frame), or clear it (today)?
12. **Indeterminate progress**: build the sliding `--accent-green` segment as a `ProgressBar` variant (with a reduced-motion fallback), or keep today's shimmer restyled to the 4px track?
13. **Figma not connected / no Edge Functions**: undrawn. Hide the leg (today on the local backend), disable it with a "Connect Figma" link to Settings → Integrations, or let the error surface after Import?
14. **More sources**: only Figma and tokens.json are drawn. Should Brand Studio Import also offer the website pull (`brand-from-website` exists, onboarding only), a guidelines.md (`parseGuidelines` exists, unused), Canva, or PDF? Each is product work; the frames say no for now.
15. **Done when nothing is new**: today it reads "Added 0 colors and 0 type styles". Propose copy (for example "Nothing new to add") or keep?
16. **"View colors" when only type styles were added**: link to Type styles instead, or keep View colors always?
17. **Header Undo on Images**: image uploads, renames and removals are not on the kit's undo stack, so Undo on the Images page only undoes earlier kit edits. Keep it there as drawn, or hide it on Images?
18. **Meta line type**: 12 Medium / 1.4 has no class. Use `.t-label-xs` (1.25) or add a style in Figma?
19. **Header actions on Import**: the Import page shows the same status and Undo; Import also has its own "Undo import". Keep both as drawn?
