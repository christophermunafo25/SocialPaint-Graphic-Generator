# New look, Phase 4: screen reference

Read from the Figma file "Master UX-UI" (`mEJRslarcQDkgPeY6AObi5`) on 2026-10-04, read only. `PHASE-4.md` builds from this file; where the live file disagrees, the file wins, and `PHASE-4.md` §8 and §9 rule on what the file leaves open.

Reference images (1x, Light) in `reference/`: `library-13-5776.png`, `library-platform-13-6310.png`, `library-search-13-6511.png`, `fill-156-674.png`, `fill-downloaded-159-716.png`, and `template-chat-{questions,building,result,edit,links}.png`.

Contents: Part A, the library; Part B, the fill page; Part C, the template chat and the Public links dialog.

---

# Part A: the Brand Templates library

Read-only extraction, 2026-10-04. Figma fonts are Raveo Display / Geist Mono; map to `var(--font-ui)` via the `.t-*` classes. "unknown" = not drawn / not readable.
Raw hexes in the frames map to tokens: #0b0b0c = `--text-strong` (Light), #636363 = `--text-secondary`, #ececec = `--surface-sunken` = `--control-fill` (Light), #2f3133 = `--chip-selected-tile` (Light) / `--chip-selected-bg` (Dark), #f9f9f8 / #0b0b0c fades = `--surface-page`.

## 1. Frames on page 0:1 (all inside section 13:5775 "Brand Templates", 17160×2426; every frame 1440×1053)

| id | name |
|---|---|
| 13:5776 | Brand Templates · Light |
| 13:6043 | Brand Templates · Dark |
| 13:6310 | Brand Templates · Platform filter · Light |
| 13:6689 | Brand Templates · Platform filter · Dark |
| 13:6511 | Brand Templates · Search · Light |
| 13:6891 | Brand Templates · Search · Dark |
| 13:7064 / 13:7211 | Template chat · Questions · Light / Dark |
| 13:7358 / 13:7551 | Template chat · Building · Light / Dark |
| 13:7744 / 13:7946 | Template chat · Result · Light / Dark |
| 13:8148 / 13:8306 | Template chat · Edit details · Light / Dark |
| 13:8464 / 13:8753 | Template chat · Public links · Light / Dark |
| 156:674 / 157:695 | Fill page · Light / Dark |
| 159:716 / 159:904 | Fill page · Downloaded · Light / Dark |
| 168:758 / 168:846 | Public links dialog · Light / Dark |

**Not drawn for the library:** empty library, no search results, loading/skeleton, member-vs-admin difference, card hover, platform menu/popover, "View all" destination page. (Only the 6 Brand Templates frames belong to this slice.)

## 2. 13:5776 Brand Templates · Light (content column, below the shell)

Page node 13:5849 (misnamed "sp-page · Generate"), 1105 wide: vertical, pt 45, pb 28.
- PageHeader 13:5850: px 45; title 13:5852 "Brand Templates" = Title/Page → `.t-title-page`, `--text-strong`. No subtitle, no header actions.
- "Templates content" 13:5853: vertical, gap 16 (`--space-sm`), pt 24 (`--space-md`), flex 1.
  - **Filter bar** 13:5854 `sp-filterbar`: h 56, px 45, content vertically centred.
  - **Scroll area** 13:5917 "Templates · scroll (overflow-y: auto)": flex 1, pt 24, px 45, gap 32 (`--space-lg`) between shelves, overflow clipped; bottom fade 13:6039 absolute, h 80, full width, `linear-gradient(180deg, page 0%, page@0.4 35%, page@0.85 70%, page 100%)` where page = `--surface-page`.
- Footer links 13:6040: centred row, gap 16, px 45, Caption/S regular 12/1.25 → `.t-caption-s`, `--text-secondary`. Text: "Terms of Service", "Privacy Policy" (sits under the scroll area, inside the page column, not in the shell).

### Filter bar
- 13:5855 "sp-railfade · chip rail (overflows)": h 52, width 1015. The name says the rail overflows with a fade, but **no fade layer is drawn here**, and the drawn chips (917 wide) fit, so overflow/fade behaviour at the right edge is unknown/implied only (shelf rails use a 96-px fade, see below; reuse it).
- 13:5856 `sp-platform-chipbar`: horizontal, gap 7 (unbound, matches Platform chip internal gap), h 50, items top.
- Order: 1. Search trigger, 2. All, 3. LinkedIn, 4. Instagram, 5. Facebook, 6. Email, 7. Web & Open Graph.
  - 13:5857 `sp-searchfield__trigger (collapsed)` → **SearchField** primitive, State Collapsed: 50×50, padding 8/6, `--control-fill`, r 9, lucide Search 20.
  - 13:5861 `sp-platform-chip · All` → **PlatformChip** Selected (96×50): fill `--chip-selected-bg`, tile 36 `--chip-selected-tile` r 7, LayoutGrid 20 in `--accent-green` (icon colour from screenshot), label "All" `--text-on-fill`, chevron 14 rotated 90° (down), `--text-on-fill`. Padding l7 r9 y8.
  - 13:5872 LinkedIn (132w), 13:5880 Instagram (143w), 13:5890 Facebook (141w), 13:5897 Email (114w), 13:5908 Web & Open Graph (199w) → **PlatformChip** Default: `--control-fill`, tile `--chip-tile`, mono logo 20 (`PlatformLogo`), label `.t-button-m .t-trim` `--text-strong`, chevron-right 14 `--text-secondary`.
  - None of these are component instances in the frame (plain frames named after the classes); build them from the primitives.

### Shelves (one per size group)
Shelf 1: 13:5918 "sp-shelf · Instagram · Facebook · LinkedIn Portrait" (1015×486). Shelf 2: 13:5979 "sp-shelf · LinkedIn · Facebook Landscape" (1015×278). Each: vertical, gap 16, overflow clip.
- **Header** 13:5919 `sp-shelf__header`: h 32, justify space-between, pl 4, items centred.
  - title 13:5920 "Instagram · Facebook · LinkedIn Portrait" / 13:5981 "LinkedIn · Facebook Landscape": 17/1.25, −1%, medium → `.t-title-panel`, `--text-strong` (Dark binds `--text-primary`).
  - 13:5921 "View all (32 tall)": h 32, px 8; text "View all" 14/1.25 medium, no tracking, underlined → `.t-label-m` + `text-decoration: underline`, `--text-strong`. Plain text link, not a Button. Destination not drawn.
- **Rail** 13:5923 `sp-shelf__rail`: horizontal, gap 16 (`--space-sm`), overflow clip, no scrollbar drawn. 4 cards drawn per shelf; card 4 starts at x 954 and is cut at 1015.
  - **Rail fade** 13:5978 / 13:6038: absolute, right-aligned, w 96 (`--space-3xl`), full rail height, `linear-gradient(to right, page@0 → page)` with page = `--surface-page`. Whether the rail scrolls horizontally (vs "View all" only) is unknown; the fade implies horizontal scroll or truncation.
- Shelf 1 cards: Now hiring, Event announcement, Team spotlight, Client testimonial. Shelf 2: Webinar promo, Open role, Case study, Company update.

### Template card (`sp-template-card`, e.g. 13:5924)
Not a component instance; structurally identical to the **ResultCard** primitive (104:602) with a Go arrow instead of Download.
- Card: width 302 (rail) / 327 (grid in filter + search), hug height; padding 8 (`--space-2xs`), vertical gap 0, fill `--surface-raised`, radius `--radius-card` (20), Elevation/Small → `box-shadow: var(--elevation-small)`. Dark adds the lit-edge stroke `--border-raised` inside, top 0.65 / right 0.25 / bottom 0.55 / left 0.25 (Light frame omits the stroke; token is transparent in Light anyway).
- Rendered as `<a>` (cursor pointer) in the export: the whole card is the link.
- **preview** 13:5925: width card−16 (286 / 311), height by aspect: portrait 1080×1350 → 358 (286w) / 389 (311w); landscape 1200×627 → 150 (286w) / 163 (311w). Radius `--radius-media-plate` (15), overflow clip. Placeholder fill `--surface-sunken`. Real previews: "Now hiring" is the live `tpl · Now hiring` component (25:853) scaled; "Open role" is an image.
  - Placeholder content (sample only): name at 12/12, 13/15 medium, colour per sample (Light: field-* hexes #082a23/#05203a/#240c39/#2b0e1e; Dark: tint-* hexes #d8f8c8/#c8f6ff/#eee1ff/#ffe7d3), plus a 50×8 logo at bottom-left 12. Treat as stand-in for the real rendered preview.
- **meta** 13:5927: horizontal, gap 8, padding t16 r8 b8 l8, items centred, h 64.
  - text column (fill, gap 4 `--space-3xs`):
    - title 13:5929: Label/L 15/1.25 −1% → `.t-label-l`, `--text-strong` (Dark `--text-primary`), one line, ellipsis.
    - meta 13:5930: 12 medium, **leading 1.4**, `--text-secondary`, ellipsis → `.t-label-xs` (12/1.25) is the nearest class; 1.4 leading is off-class.
    - Meta format, verbatim: "1080 × 1350 · 3 looks" (only when >1 look), else "1080 × 1350" / "1200 × 627". Separator " · ", multiplication sign "×" with spaces.
  - Actions 13:5931 → Go 13:5932: 34×34, `--surface-sunken`, `--radius-pill`, icon/arrow-right 16 → **IconButton** Filled at 34 (standard 32; ResultCard's download is also 34). Probably decorative inside the card link (unknown whether separately focusable).
- **Tags:** none on cards in 13:5776 (they appear only in Search Light, below).
- **Hover:** not drawn here. ResultCard's description says "Template, recent and history previews follow the same rule": hover/focus dims the preview with `--overlay-hover` and shows the Edit button → **PreviewOverlay** (104:584). Whether the template card's overlay button says Edit or something else is unknown.

### Primitives named in 13:5776
SearchField (Collapsed), PlatformChip ×6 (+ PlatformLogo), IconButton Filled (Go, 34), Elevation/Small, Title/Page. Not a primitive: shelf header, View all link, template card (ResultCard-shaped), rail fade, scroll fade, footer links.

## 3. 13:6310 Platform filter · Light (Instagram selected)
- **No menu or popover is drawn.** Selecting a platform chip just filters; whether the down chevron opens a sizes menu is unknown.
- Selected chip 13:6414 Instagram → PlatformChip Selected (black, tile `--chip-selected-tile`, label white, chevron rotated down). All 13:6395 returns to **Default** (control-fill, tile `--chip-tile`, chevron right). Order and widths unchanged.
- Scroll area 13:6451: gap 24 (not 32), pt 24, px 45.
- **Result line** 13:6452 `sp-resultline`: horizontal, gap 12 (`--space-xs`), items centred.
  - eyebrow 13:6453 "5 TEMPLATES · INSTAGRAM" (source text "5 templates · Instagram", uppercase via style): 11px medium, leading normal, tracking 0.88px (0.08em), `--text-secondary`. No exact `.t-*` match (nearest `.t-caption-xs` 11/1.3 regular; `.t-mono-eyebrow` is mono 10).
  - 13:6454 `sp-resultline__clear` "Clear": h 28, px 10, r 7, fill `--control-fill` (Light #ececec / Dark surface-raised = ink-800), label 12/1.3 −1% medium `--text-strong` → **Button** kind Neutral on page, size Small (`.t-button-s`).
- **Result group** 13:6456 `sp-resultgroup · Instagram Portrait`: vertical, gap 16.
  - header 13:6457: items baseline, gap 10 (unbound), pl 4, h 32. Title "Instagram Portrait" `.t-title-panel`; count 13:6459 h32 px8 "5 templates" 14/1.25 regular `--text-secondary` → `.t-body-s` size but 1.25 leading (nearest `.t-caption-m` is 13). No "View all".
  - Grid 13:6461 `sp-grid-media--portal`: flex-wrap, gap 17 both axes (unbound), 3 columns of 327 (3×327 + 2×17 = 1015). Cards: Now hiring, Event announcement, Team spotlight, Product launch (row 2, faded by the bottom scroll fade).
- Shelves become flat wrapped grids per size group; no rail fade.

## 4. 13:6511 Search · Light (query "hiring")
- Chip bar 13:6591 (980 wide): **SearchField Open** 13:6592: 440×50 fixed, padding l15 r13 y8, gap 10, `--control-fill`, r 9; Search icon 20; value 13:6596 "hiring" 14 regular → `.t-body-s` `--text-strong`, fills width; "Clear search" 13:6597 14×14 x glyph (`--text-secondary`). No ring/caret drawn.
- After the field: All (Selected), LinkedIn, Instagram, Facebook. **Email and Web & Open Graph are not drawn** (pushed off / dropped; no fade drawn). Builder decision: keep all chips and let the rail overflow with a fade.
- Scroll area 13:6635: gap **28** (filter frame uses 24, default 32), pt 24, px 45.
- Result line 13:6636: eyebrow "2 results for “hiring”" (curly quotes, uppercased by style) + Clear (same as §3).
- Results stay **grouped by size** (result groups, not one flat grid, not shelves):
  - 13:6640 "Instagram · Facebook · LinkedIn Portrait", count "1 template" → card Now hiring (327 wide, preview 311×389).
  - 13:6663 "LinkedIn · Facebook Landscape", count "1 template" → card Open role (preview 311×163).
  - Group gap 28; grid `gap-y 17`.
- **Card tags (search only):** meta text column gets a `tags` row 13:6653: pt 6, gap 6, items start. Tags 13:6654 "Hiring", 13:6656 "Careers" (Now hiring); 13:6676 "Hiring", 13:6678 "LinkedIn" (Open role). Each h 28, px 10, `--surface-sunken`, `--radius-pill`, 12 regular `--text-secondary` → **Tag kind Filter** visually (h28, x10, Caption/S, text-secondary), but drawn as static labels inside the card. Meta grows to 102 tall; Go button vertically centred (y 38).
- Suggestion tags (search suggestions) under the field: **not drawn**. No-results state: **not drawn**. Highlighting of the matched term: none drawn.
- Count copy: "1 template" / "5 templates" (singular/plural).

## 5. Dark frames (13:6043, 13:6689, 13:6891): differences beyond token flips
- Everything else maps through tokens: chips use `--control-fill` (= ink-800) and `--chip-tile` (= ink-900); selected All/Instagram uses `--chip-selected-bg` ink-700 with tile ink-800 (not white). Fades go to #0b0b0c = `--surface-page`. Card picks up `--border-raised` lit edge and bevels via `--elevation-small`.
- Theme toggle in the sidebar moves (moon at x 8.5 vs 16), shell only.
- 13:6891 Search Dark: the **Now hiring card has no tags** (meta 64 tall, Go at y 19) while Open role keeps them. Light has tags on both. Treat Light as canonical.
- 13:6689 Platform filter Dark: Product launch placeholder has a Logo layer that Light lacks (sample content only).
- Placeholder title colours: Light uses field-* darks, Dark uses tint-* lights; "#c8f6ff" in Dark is not a token (`--clouds` is #d9f9ff). Sample content only.
- Light frames bind text to raw #0b0b0c (`--text-strong`); Dark binds `--text-primary`. In Dark `--text-strong` = `--text-primary` = paper-075, so use `--text-strong`.

## 6. Screenshots (scratchpad: p4a-5776.png, p4a-6310.png, p4a-6511.png, 1440×1053)
- **13:5776:** Sidebar left (Brand Templates active). "Brand Templates" title, then a row of grey rounded chips: search square, black "All ⌄" chip with green grid icon, then LinkedIn, Instagram, Facebook, Email, Web & Open Graph, each with a white logo tile and a small ›. Shelf "Instagram · Facebook · LinkedIn Portrait" with underlined "View all" at the right; four tall white cards (first shows the green-on-moss "We're hiring a Creative Director" post, others grey placeholders), the fourth cut off under a fade to the page. Second shelf "LinkedIn · Facebook Landscape" with wide cards (Open role shows a mint landscape post), its meta row blurred by the bottom scroll fade. Footer "Terms of Service  Privacy Policy" centred.
- **13:6310:** Same chip row, Instagram now black with a down chevron, All grey. Below: "5 TEMPLATES · INSTAGRAM" small caps eyebrow + grey "Clear" pill-button. Group "Instagram Portrait  5 templates", then a 3-column grid of larger cards (Now hiring, Event announcement, Team spotlight), a 4th card on row 2 fading out.
- **13:6511:** Wide search field "hiring" with a small × at its right, then All (selected, black), LinkedIn, Instagram, Facebook (Email/Web missing). "2 RESULTS FOR “HIRING”" + Clear. Group "Instagram · Facebook · LinkedIn Portrait  1 template" with one card showing grey pill tags "Hiring", "Careers" under its meta; group "LinkedIn · Facebook Landscape  1 template" with the Open role card fading out.

## Inconsistencies / decisions for the builder
1. Scroll-area gap: 32 (shelves), 24 (platform filter), 28 (search). Pick one per state or normalise (suggest 32 shelves, 24 result groups).
2. Card width: 302 in rails (4 cut by fade) vs 327 in grids (3 columns, gap 17 off-scale). Rail gap 16 vs grid gap 17.
3. Chip rail fade/overflow is named but never drawn; search frame drops Email and Web & Open Graph. Decide: horizontal scroll + 96-px right fade (same as shelf rail).
4. No platform menu drawn; the chevron (down when selected) suggests a sizes menu, but nothing specifies one. Filter-by-chip only unless designed.
5. Selected All chip in search state: search and platform filter combine (All stays selected while searching).
6. Card tags: drawn only in Search Light (and one card in Search Dark). Look like Tag kind Filter but are static; decide Tag Default (h22, label `--text-strong`) vs Filter styling. Frame values = Filter.
7. Meta line leading 1.4 vs `.t-label-xs` 1.25; result-line eyebrow (11 medium, 0.08em, uppercase) and group count (14 regular /1.25) have no exact `.t-*` class.
8. Go button 34 vs IconButton Filled 32; card hover not drawn (use PreviewOverlay per ResultCard rule; overlay label unknown).
9. "View all" target page not drawn; in filtered/search states group headers show a count instead of View all.
10. Missing states: empty library, no results, loading, member vs admin (no admin actions such as New template are drawn on this page).
11. Page node is misnamed "sp-page · Generate" (cosmetic).

---

# Part B: the fill page

Figma `mEJRslarcQDkgPeY6AObi5`. Frames: Fill page Light **156:674**, Dark **157:695**; Downloaded Light **159:716**, Dark **159:904**. All 1440×1053. Sidebar (selected item: Brand Templates) is not covered here. Screenshots: `scratchpad/p4b-156-747.png` (page body of 156:674), `scratchpad/p4b-159-716.png` (full 159:716 at 1440).
No annotation or "admin-only" note came back through MCP for any node in these frames. Admin gating is **unknown**.

## Page body (156:747, misnamed "sp-page · Generate")
- Column, padding **45 top / 45 sides / 28 bottom**. PageHeader (36 high) sits above the Split.
- Split (156:761): row, `gap 24`, `padding-top 24`, fills the remaining height (944). Preview flexes (611 wide at 1440), Details panel fixed **380** wide, both full height (920).

## 1. Header (156:748): space-between, items centered
**Breadcrumb (156:749)**: row, gap 8, all 14px.
- `Brand Templates` (156:750): a link, `.t-label-m`, `--text-secondary`.
- `/` (156:751): `.t-body-s` (14/1.4), `--text-secondary`.
- `Now hiring` (156:754), the template name: `.t-label-m`, light `#0b0b0c` hard-coded (= `--text-strong`), dark `--text-primary`. Use `--text-strong`.

**Actions (156:755)**: row, gap 8, in this order:
| # | Label (verbatim) | Icon (16px) | Node |
|---|---|---|---|
| 1 | `Use AI to assist` | `sp-icon / Generate` (sparkle) | 156:832 |
| 2 | `Bulk fill` | `lucide/LayoutGrid` | 156:838 |
| 3 | `Public link` | link glyph (layer "icon"; looks like lucide Link) | 156:846 |

- All three are `sp-chat-btn`: 36 high, px 16, gap 6, radius 7, label 14 Medium with -0.14 tracking (`.t-button-m`), fg `--text-strong`/`--text-primary`.
- Fill: light `--surface-sunken` (#ececec), dark `--surface-raised` (#171819). That pair is exactly `--control-fill`, so use **`Button kind="neutralOnPage" size="default" icon`**.
- None is primary. The header has no Download button.

## 2. Graphic side (Preview 156:762): column
- **Preview stage (156:763)**: flex 1 (889 high at 1440), radius **20** (`--radius-card`), padding 40, centers its child, overflow clip. Fill: light `--surface-sunken`, dark `--surface-raised`, which is again `--control-fill`. Use `--control-fill`.
- **Graphic (156:764)**: **531×664** (4:5, the 1080×1350 template scaled to fit), radius **20**, overflow clip, drop shadow `2 2 8 --shadow-raised` (Elevation/Small without the bevels). It sits centered in the stage. The instance is `tpl · Now hiring` (25:853), rendered live.
- **None on the fill page:** a look picker on the graphic side, look tiles, a size switch, a caption card, zoom controls. Look is a field in the Details panel (see below).
- **Footer (156:889)**: padding-top 16, centered. Legal links (156:779): `Terms of Service`, `Privacy Policy`, gap 16, `.t-caption-s`, `--text-secondary`.

## 3. Details panel (156:782)
- **Container:** 380 wide, full height. Padding **20**, column gap **16**, radius **20** (`--radius-card`). Fill: light white, dark `--surface-raised` (so `--surface-raised`). Shadow **Elevation/Small** (`--elevation-small`). Dark adds a lit edge with `--border-raised`: top 0.65, sides 0.25, bottom 0.55 (light `--border-raised` is transparent, so this is a token flip).
- **Header (156:783)**: `Details` (156:784), `.t-title-card` (18/1.25, -0.18), `--text-strong`/`--text-primary`. Nothing sits on the right.
- **Fields (156:788)**: column, gap **12**, `flex 1`, `overflow: clip` in Figma. The footer stays pinned at the bottom of the panel and empty space shows between the caption and the footer.
- **Each field:** a label row, then the control, gap **6**.
  - Label: `.t-label-xs` (12 Medium), `--text-secondary`.
  - Optional fields carry a right-aligned `Optional` in `.t-caption-s`, `--text-secondary` (the label row is space-between).
  - The frames show no helper or error text.

| # | Label | Status | Control | Value shown | Node |
|---|---|---|---|---|---|
| 1 | `Look` | none | Segmented switch, 3 segments: `Moss` (selected), `Lime`, `Ocean` | | 156:789 / 156:792 |
| 2 | `Role` | none | Input (sp-input), single line | `Creative Director` | 156:799 |
| 3 | `Apply link` | none | Input | `socialpaint.ai/careers` | 156:804 |
| 4 | `Location` | `Optional` | Input | `Remote` | 156:809 |
| 5 | `Photo` | `Optional` | Upload row (sp-upload), see §5 | `portrait.jpg` | 156:873 |
| 6 | `Caption` | none | Input multiline / TextArea | `We’re hiring a Creative Director. If you’d love giving a brand its best look everywhere it shows up, come paint with us. The link to apply is in our bio. #hiring #creativedirector` | 156:820 |

- **Look switch:** track: padding 4, gap 4, radius 9, fill light `#f1f1ef` hard-coded (= `--control-track`), dark `--surface-page` (= `--control-track` dark). Segments: 32 high, flex 1, radius 7. Selected segment: light white, dark `--surface-sunken` (= `--control-thumb`), with shadow `0 1 3 rgba(0,0,0,.08)` (= `--elevation-thumb`). Labels 13 Medium, -0.13 tracking. Figma calls the style Label/S, but the tracking matches `.t-control-s` more closely. Selected label is `--text-strong`/`--text-primary`; the others are `--text-secondary`. Use the **`SegmentedControl` primitive** (49:51).
- **Input:** 40 high, px 12, radius 9 (`--radius-control-md`). Fill light `#f1f1ef` hard-coded, dark `rgba(241,241,241,.08)`. Both equal **`--input-bg`**. Text `.t-body-s` in `--text-strong`/`--text-primary`. No border. Use **`Field` + `Input`** (48:38 / 48:37).
- **Caption:** same fill and radius. Padding 10/12. Height hugs the content (100 for 4 lines). No character counter and no resize handle are drawn. Use **`Input size="multiline"`**. The caption is the last field, inside the Details panel; there is no separate caption card.
- **Footer (156:825):** one button, full width: `sp-button · Download PNG` (156:828). It is 44 high, px 18, radius 9, fill `--field-green` with `--accent-green` text in light (dark: `--accent-green` fill, `--field-green` text). That pair is `--btn-primary-bg/fg`, so use **`Button kind="primary" size="lg"`**, full width. The icon slot (156:829) is hidden, so the button has no icon. The label is `Download PNG`.
- **Scroll:** the frames do not say. Fields are `overflow: clip` in Figma and the content fits at 1053 high. Suggested behaviour: the fields region scrolls, and the header and footer stay put.

## 4. After a download (159:716 / dark 159:904)
- **What is identical to 156:674:** header, all three header buttons, the graphic, every field and value, the panel title.
- **The only change is the panel footer (159:872):** a row with gap 8.
  1. `sp-button · Download again` (159:873): label **`Download again`** (not "Download"). Hugs its content at 135 wide. Size lg (44 high, px 18, radius 9). Fill `--surface-sunken` with `--text-strong` (dark: `#2f3133` / `--text-primary`), so **`Button kind="neutral" size="lg"`**. Its icon slot is hidden.
  2. `sp-button · Post to LinkedIn` (159:898): label **`Post to LinkedIn`**, flex 1 (197 wide). Leading `LinkedIn mark` icon (159:902), 16px, rendered in the button fg (accent-green on moss in light). Gap 8. **`Button kind="primary" size="lg" icon`**. The prototype link is `https://www.linkedin.com/feed/?shareActive=true` with `target=_blank`.
- **Not drawn:** confirmation text, a toast, a "Downloaded" status, any caption-copied note, a reset back to the first state.

## 5. Image field (sp-upload · Photo 156:881)
- Row, 56 high, padding 8 left / 12 right / 8 vertical, gap 10, radius 9, fill `--input-bg` (light `#f1f1ef`, dark `.08`).
- Thumbnail 40×40, radius 7, object-cover. Then the file name `portrait.jpg` (`.t-body-s`, flex 1, `--text-strong`). Then the text action **`Replace`** (`.t-label-s`, 13 Medium, `--text-strong`, no icon, no underline).
- **Not drawn:** Remove/clear, the empty state (drop well or Upload), a picker from Brand Studio photos, uploading or error states.
- **There is no `Upload` primitive in PHASE-2 §2**, so this is new.

## 6. Dark (157:695, 159:904): differences beyond token flips
- **None structural.** Layout, text, the graphic (template colours are its own) and footer buttons all match. The primary button inverts through tokens (slime fill, moss text).
- **Token-level oddities that resolve once the right semantic token is used:**
  - The preview stage and header buttons use `--surface-sunken` in light but `--surface-raised` in dark. Use `--control-fill`.
  - Input and track fills are raw `#f1f1ef` in light but bound in dark. Use `--input-bg` and `--control-track`; the selected segment uses `--control-thumb`.
  - The panel and breadcrumb are raw white / `#0b0b0c` in light. Use `--surface-raised` and `--text-strong`.

## 7. Screenshots
- **156:674 at 1440:** sidebar on the left. The breadcrumb `Brand Templates / Now hiring` is top-left and the three grey header pills are top-right. On the left, a large rounded grey stage centres the dark-moss "Now hiring" post (Moss look, "We're hiring a / Creative Director", portrait photo, green "Apply now" pill, `socialpaint.ai/careers`), with Terms and Privacy links underneath. On the right, a white rounded `Details` card: a Moss/Lime/Ocean segmented switch, three filled grey inputs, a photo row with thumbnail and "Replace", and a 4-line caption box. Empty space follows, then the full-width dark-moss `Download PNG` button with slime text pinned to the bottom.
- **159:716:** identical, except the bottom of the panel holds a grey `Download again` (left, hugging its label) and a wide dark-moss `Post to LinkedIn` with a slime LinkedIn "in" mark.

## Primitives used
`Button` (neutralOnPage/default ×3 in the header; primary/lg; neutral/lg), `SegmentedControl`, `Field`, `Input` (default and multiline). Not covered by Phase 2: the upload row, and the "Optional" marker on Field (Field has label, control and error only).

---

# Part C: the template chat and Public links

File `mEJRslarcQDkgPeY6AObi5`, page `13:679` "All Screens", section **`13:5775` "Brand Templates"** (17160x2426). Read-only. Sidebar and PageHeader shell skipped except header contents. Sources: get_metadata 13:5775 (parsed), get_design_context 13:7137, 13:7485, 13:7871, 13:8221, 13:8667, 168:760, 13:7535, 13:7930, 13:7869, 13:7929, 13:8666, 13:9012; get_variable_defs 13:8464, 13:8148; screenshots at 1440 in `scratchpad/p4c/*.png` (10 files, light + dark).

## 0. Every frame in the section (all 1440x1053)

| Frame | Light | Dark |
|---|---|---|
| Brand Templates | 13:5776 | 13:6043 |
| Platform filter / Search | 13:6310 / 13:6511 | 13:6689 / 13:6891 |
| **Template chat · Questions** | 13:7064 | 13:7211 |
| **Template chat · Building** | 13:7358 | 13:7551 |
| **Template chat · Result** | 13:7744 | 13:7946 |
| **Template chat · Edit details** | 13:8148 | 13:8306 |
| **Template chat · Public links** | 13:8464 | 13:8753 |
| Fill page | 156:674 | 157:695 |
| Fill page · Downloaded | 159:716 | 159:904 |
| **Public links dialog** (standalone, scrim + modal only, no page beneath) | 168:758 | 168:846 |

No other template-chat states: no error, no "template unavailable", no follow-up chips, no hover/menu frames. `168:758` is a copy of the Public links modal (same 77 nodes, same copy); only difference: its Close is a `<button>` (13:8674 is an `<a>`). It reads as the dialog's own reference (likely for the fill page's Public link), not a new state.

## 1. Header (PageHeader at page x45 y45, 1015x36, space-between)

Questions / Building / Result / Public links (13:7138 etc., identical):
- Breadcrumb (gap 8, 14px): `Brand Templates` (Label/M, `--text-secondary`, link) · `/` (Body/S, `--text-secondary`) · `Now hiring` (Label/M, `--text-strong`, current). No page title.
- Actions (gap 8), all h36, px16, gap6, radius 7 (`--radius-control`), label 14 / −1% (`.t-button-m`), icon 16:
  1. `Fill in by hand`: pencil ("Edit icon"), fill `--surface-sunken` → **Button neutral, default**.
  2. `Bulk fill`: `lucide/LayoutGrid`, `--surface-sunken` → **Button neutral, default**.
  3. `Public link`: link icon, fill `--field-green`, label `--accent-green` (Light). Dark renders slime fill / dark label → **Button primary, default** (`--btn-primary-bg/fg` flip matches; Figma binds field/accent-green directly).

Edit details (13:8222):
- Breadcrumb: `Brand Templates` / `Now hiring` / `Edit details`. The first two are `--text-secondary` (Now hiring is a crumb here), `Edit details` is `--text-strong`.
- One action: `Back to chat`, arrow-left icon 16, `--surface-sunken` → Button neutral, default. (No Bulk fill / Public link here.)

Compare: Fill page header (156:755) is `Use AI to assist` · `Bulk fill` · `Public link`.

## 2. Layout shared by the chat frames

- Page `sp-page`: padding 45/45/28/45, column.
- `Thread` (13:7164): fills, overflow clip, padding top 16 bottom 32, content bottom-aligned (justify-end), column centred. `Thread column` w **760**, gap **24** between turns.
- `Scroll fade · top` (13:7194 hidden in Questions; 13:7534 / 13:7929 shown, 1015x68 in Building/Result/Public links): raw gradient of surface-page `rgb(249,249,248)` 0% → 0.85 at 30% → 0.4 at 65% → 0 (no token; dark values not read).
- `Composer dock` (13:7195): column, gap 10, pt16, centred; box 760 + footnote.

### Composer box `sp-chat-box` (13:7196) = the Composer (61:504) **minus** compact select and stepper
- 760x110, radius 20, fill `--surface-raised`, `--elevation-small`, border 5px raw `rgba(255,255,255,.25)` (the component binds `--border-raised` 5px outside), padding 20/12/12/20, gap 30.
- Placeholder (Trimmed/Body/L → `.t-body-l .t-trim`, `--text-secondary`):
  - Questions: `Attach a photo with the plus`
  - Building, Result, Edit details, Public links: `Anything to add while the paint’s still wet?`
- Toolbar (gap 12, items-end): `inputs` (py4, gap 6) = **AttachButton** 28x28 (`--surface-inverse`, radius 7, plus 14) + `Tags` empty frame 28 tall (no detail tags in any frame); `output` = **SendButton** 36 only. Send = arrow (action send); Building = `icon · pause` 12x12, radius 2, `--field-green` → **SendButton action stop**. Send fill is raw `#17ff7e` (= `--accent-green`).
- Footnote (gap 16, Caption/S 12/1.25, `--text-secondary`): `Terms of Service` `Privacy Policy`.

## 3. Questions · Light 13:7064

Thread column 13:7165 (760x648), turns in order:
1. **Assistant question** (13:7166, gap 8): mark `sp-chat-assistant-header` **20x28** (other frames 20x20), then Body/M (`.t-body-m`, 15/1.5, `--text-strong`): `Let’s fill in Now hiring. I’ve got 4 questions for you. The last ones are optional.` Then `sp-chat-tref` (py8): template thumbnail 112x140, radius 7, drop shadow `--shadow-raised` 2/2/4 (artwork instance `tpl · Now hiring`). Then `What is the role you are hiring for?`
2. **User bubble** (right-aligned, hug): `Creative Director`. Bubble = `--surface-sunken`, radius 16 (`--radius-menu`), padding 12/16, Body/M `--text-strong`; no tags.
3. Assistant question (text only, no mark): `What link should people use to apply?`
4. User: `socialpaint.ai/careers`
5. Assistant: `Where is the role based?`
6. User: `Skipped` (a skip renders as a plain bubble with the word "Skipped").
7. Assistant (gap 8): `Do you have a photo you’d like to use?` + `Answers` row (gap 8, pt4): chips `Skip`, `Back` (h28, px10, `--surface-sunken`, radius 7, 12/1.3 −1% trimmed = `.t-button-s`) → **Chip** (98:515). Note: the Chip reference binds `--control-fill`; these bind `--surface-sunken` (same paper-100 in light; differs in dark: control-fill ink-800 vs sunken ink-700).

Composer: photo placeholder, send arrow. No progress, no look picker.

## 4. Building · Light 13:7358
Thread is scrolled (column y −549, fade on). Same Q&A as §3, then:
- User photo answer `sp-chat-photo / User · portrait` (13:7484): 64x64 image, radius 9 (`--radius-control-md`), right-aligned, no bubble.
- **Assistant message** 13:7485 (gap 16): mark 20x20; `Status` (gap 8): `Filling in Now hiring.` (Body/M) + **Progress** (58:450, step 2): track 120x4 `--surface-sunken` r2, fill 80 `--surface-inverse`, label Label/XS (12/1.4 drawn) `--text-secondary`: `2 of 3 · Rendering your draft`.
- `Results · loading` (row gap 12):
  - `sp-result-card-skeleton · Instagram` 227x344: card `--surface-raised` r20 p8 elevation-small; preview 211x264 r15 `--surface-sunken`; inner bars (logo, image, 2 headlines, button, url) also `--surface-sunken` (invisible on same fill); meta pt16 px8 pb8, bars 90x10 / 130x8, 34px circle.
  - `sp-chat-looks · skeleton` (fills rest, 521): well 264 `--surface-sunken` r15, three 132x164 r9 tiles + 56x10 names (gap 20, centred); meta bars.
- `sp-caption-card · loading` 760x130: card r20, padding 16/16/20/20, header bar 56x10 + 32 circle, two caption bars (12 tall, r6, second half-width).
- Composer: `Anything to add while the paint’s still wet?`, Send = Stop.
- Step labels seen: only `2 of 3 · Rendering your draft` (Progress reference sample for step 1: "1 of 3 · Reading your job post", a Generate label). Template chat step 1 and 3 labels: **unknown**. Code `runCopy.ts` has `Filling in X.` and "Rendering your draft"/"Rendering both sizes".

## 5. Result · Light 13:7744
Same thread, then Assistant message 13:7871 (gap 16):
- mark 20; `Here’s your post, with a caption to go with it.` (Body/M).
- `sp-chat-fillin` (gap 8): `Fill in` (Caption/M 13/1.25, `--text-secondary`) + **Tag kind Missing** `Location · optional` (h28, pl10 pr12, 1px dashed `--text-secondary`, pill, plus 10, Caption/S). Border drawn **dashed** (reference says 1px solid stroke: check 52:63).
- `Results` row (gap 12):
  - **ResultCard** (104:602) state Hover: 227x344, preview 211x264 r15, hover overlay `rgba(8,42,35,.35)` = `--overlay-hover` with 40px white (`--overlay-control`) Edit button, pencil 20; meta: title `Now hiring` (Label/L), meta `1080 × 1350` (Label/XS-ish 12/1.4, `--text-secondary`); Download = IconButton filled 34 (`--surface-sunken`, pill, download 16).
  - **Look picker card** `sp-chat-looks` (13:7899, fills 521): card `--surface-raised` r20 p8 elevation-small; well 505x264 `--surface-sunken` r15, tiles gap 20 centred; meta (pt16 px8 pb8): `Look` (Label/L) / `Moss` (12, `--text-secondary`). Tiles = **LookTile** (104:996): `Moss` (selected: 1px `--text-strong` ring, p2, r9), `Lime`, `Ocean`; thumbnails 128x160 r7; name `.t-control-s` (13 −1%).
- **Caption card** `sp-caption-card` (13:7920) 760 wide: r20, padding 16/16/20/20, gap 12, elevation-small; header: `Caption` (Label/M 14) + Copy caption IconButton filled 32 (copy 16); body Body/M: `We’re hiring a Creative Director. If you’d love giving a brand its best look everywhere it shows up, come paint with us. The link to apply is in our bio. #hiring #creativedirector`
- No follow-up chips ("Try next") in this frame. Composer: wet-paint placeholder, send arrow.

## 6. Edit details · Light 13:8148 (a full split view, not a side drawer over the chat)
`Split` (13:8235) row gap 24, pt24:
- **Chat column** (flex, 611): `sp-chat-stage` `--surface-sunken` r20 p40, centred graphic 531x664 r20 drop shadow; below it Composer dock with box **full column width (611)**, wet-paint placeholder, send arrow, footnote.
- **Editor panel** 13:8256: w380, full height, `--surface-raised` r20 p20 gap16 elevation-small.
  - Header: `Edit details` (Title/Card 18 −1% → `.t-title-card`) + Close IconButton filled 32 (x 16).
  - Fields (gap 12; each Field gap 6; label Label/XS 12 `--text-secondary`):
    - `Look`: **SegmentedControl** (track `--input-bg` #f1f1ef p4 gap4 r9; segment h32 r7; selected `--surface-raised` + 0 1 3 rgba(0,0,0,.08) = `--elevation-thumb`; 13 −1% labels): `Moss` (selected) `Lime` `Ocean`.
    - `Role`: Input h40 (`--input-bg`, r9, px12, Body/S): `Creative Director`
    - `Apply link`: `socialpaint.ai/careers`
    - `Location` + status `● Edited` (6px dot `--state-selection` #0d99ff, Caption/S) and right-aligned `Optional` (Caption/S, `--text-secondary`); input focused with caret: `Remote`
    - `Caption`: multiline, p10/12, the caption text from §5.
  - Footer (gap 8): `Discard` (Button neutral lg, h44, px18, r9, auto width) + `Download PNG` (Button primary lg, flex fill; icon slot hidden).
- vs Fill page Details panel (156:782): title differs (56px wide, likely "Details", not read), **no Close**, adds `Field · Photo` (77 tall), footer is only a full-width `Download PNG`. So it is **not** the same panel; same field rows.

## 7. Public links · Light 13:8464
Result state underneath (page unchanged), then:
- `Scrim` 13:8666 full frame: `rgba(11,11,12,.5)` = `--overlay-scrim`, `backdrop-blur 2px`.
- **Modal** (58:484) `sp-modal · Public links` 13:8667 at (440,195), 560x663: p24 gap20 r20 `--surface-raised` `--elevation-medium`.
  - Header: link icon 18 + `Public links` (Title/Card); Close IconButton filled 32.
  - `New link` (Label/M) section, gap 12:
    - `Name` Input, placeholder `Speaker confirmation email` (`--text-secondary`).
    - Row gap 12: `Stops working after` (placeholder `Pick a date`, calendar icon 16 right) | `Open limit` (placeholder `No limit`).
    - `Look` Select (h40): value `Visitor chooses`, chevron.
    - `Allow photo uploads` (Body/S) + **Switch** on.
    - `Create link`: Button primary lg full width (h44, link icon 16).
  - Divider 1px raw `rgba(11,11,12,.08)` (nearest `--border-default`, ink-750-08).
  - `Links` (Label/M), gap 14; row `sp-link-row · Recruiting partners` (gap 14):
    - top: `Recruiting partners` (Label/M) + **Status** tone Active `Active`; actions gap 8: `New address`, `Revoke` (Button neutral **sm**: h28 px10 r7 `.t-button-s`). (No Copy button.)
    - stats row gap 16, four **Stat** (59:449): `Created` `Sep 14, 2026` · `Expires` `Never` · `Opens` `37` · `Last used` `Sep 30, 2026`.
    - `Look` (Body/S) + Select **h36 w180** `Visitor chooses`.
    - `Photo uploads` + Switch on.
- Defaults shown: open limit none, look "Visitor chooses", photo uploads on. Code `TemplateLinksDialog.tsx` already has this copy.

## 8. Primitives per region

| Region | Primitive (Phase 2) | Not a primitive yet |
|---|---|---|
| Header actions | Button neutral/primary default | |
| Assistant question/turn | Chip (Skip/Back) | **Assistant message (61:532), Phase 5**; Logo mark; template ref thumbnail `sp-chat-tref` |
| Person's answers | | **Message bubble (61:505), Phase 5** (here hug width, no Tags; component is 472 fixed); photo answer `sp-chat-photo` 64x64 |
| Composer | AttachButton, SendButton (send/stop) | **Composer (61:504), Phase 5** (template chat variant hides CompactSelect + Stepper) |
| Progress | Progress (step 2) | |
| Results | ResultCard (hover), LookTile, IconButton filled 34/32, Tag kind Missing | look-picker card (well + meta), result/look/caption skeletons, caption card, Fill-in row, Scroll fade |
| Edit details | SegmentedControl, Input/Field, IconButton, Button neutral/primary lg | Editor panel shell; chat stage; "Edited" status dot; label-row "Optional" |
| Public links | Modal, Input/Field, Select (default + 36 tall), Switch, Button primary lg, Button neutral sm, Status active, Stat | scrim (Modal has none); link-row layout; date field with calendar icon |

## 9. Dark frames (beyond token flips)
- Structure identical to Light in all five (layer names, sizes), except the **Status · Active** pill (13:9012 / 168:904): Light is size **Small** (10px trimmed, py5, fill `--accent-green`, label `--field-green`, 45x17); Dark is size **Default** (12px, py3, fill `--surface-sunken`, label `--accent-green`, 50x15). With tokens, `tone=active` already gives slime-on-ink-700 in dark; the **size** change is the real difference.
- Header `Public link`, `Create link`, `Download PNG` render slime fill / deep-moss label (Button primary flip).
- Look tile selected ring renders white (`--text-strong` flip). AttachButton renders white with dark plus (`--surface-inverse` flip).

## 10. Inconsistencies / decisions
1. **Overlap with Phase 5.** In code the template chat *is* Generate's chat (`TemplateChatPage` → `GenerateChat` in `GeneratePage.tsx`; shared `Composer`, `UserMessage`, `AssistantHeader`, `DraftCard`, `CaptionCard`, `LookPicker`, `EditorPanel`). Its frames use Composer, Message bubble and Assistant message, which Phase 2 deferred to Phase 5. Phase 4 either builds those three primitives early (and Phase 5 reuses them) or ships the template chat on legacy chat markup and leaves it for Phase 5.
2. Composer: no CompactSelect/Stepper in template mode; only Attach + Send/Stop. Its placeholder switches between photo and wet-paint copy.
3. Assistant mark is 20x28 in the first question, 20x20 elsewhere.
4. Chips bind `--surface-sunken`; Chip primitive binds `--control-fill` (differs in dark).
5. Missing tag drawn dashed; check against Tag 52:63.
6. Status Active: Small in Light, Default in Dark.
7. Raw values: input fill #f1f1ef (= `--input-bg`), divider rgba(11,11,12,.08), composer 5px white-25% border, send #17ff7e, scroll-fade gradient, Look-switch shadow (= `--elevation-thumb`).
8. Field label row carries `Optional` (right) and an `Edited` status (dot `--state-selection`); Field primitive has neither (and RULES §9 bans hints). Decide whether these count as Field props.
9. Edit details ≠ fill page Details panel (Close, Discard, no Photo field, title). Decide whether they become one panel with variants.
10. Public links "Name" placeholder `Speaker confirmation email` doesn't fit a hiring template (sample copy). Row actions are `New address` + `Revoke` (no Copy). The Look select in the row is 36 tall (Select primitive sizes: default/lg).
11. Progress step 1/3 labels for the template chat are unknown. "4 questions" intro while the progress says "of 3" (separate counters).
12. No follow-up chips, error or unavailable states drawn.
