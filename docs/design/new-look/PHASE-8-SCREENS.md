# New look, Phase 8: screen reference

Read from the Figma file "Master UX-UI" (`mEJRslarcQDkgPeY6AObi5`), page "Insights and Analytics" (8:677, section 13:831), on 2026-10-06, read only. `PHASE-8.md` builds from this file; where the live file disagrees, the file wins, and `PHASE-8.md` §8 and §9 rule on what the file leaves open.

Reference images (1x) in `reference/`: `insights.png` (Light, 13:832) and `insights-dark.png` (Dark, 13:1142). The page has these two frames only; every Dark node id is its Light twin's plus 310.

No part uses Master component instances: the mappings to primitives below are by look and measurement. Only the admin's view is drawn, at desktop width, populated with sample data.

Contents: Part A, what is drawn (geometry, tokens, primitives, Dark); Part B, what each part stands on (data, behaviour, what the frame drops), with prod facts checked on 2026-10-06. Each part ends with its open questions, which `PHASE-8.md` §9 turns into decisions.

**Checked on prod, 2026-10-06** (Part B's findings 1 and 2): the busiest workspace has 174 usage events in 90 days, so the unpaged events read is not cut off yet; and 0 of 210 events in 90 days carry a member, so Active members and a member filter have no data until attribution is fixed.

---

# Part A: Insights & Analytics, what is drawn

Source: Figma "Master UX-UI" (`mEJRslarcQDkgPeY6AObi5`), page 8:677, read on 2026-10-06, read only (`get_metadata` on both frames, `get_design_context` on both page nodes, the six SVG assets fetched to read their colours). Both frames are **1440 × 1261** (taller than the 1053 of Phases 6 and 7, so the page scrolls). The sidebar (`sp-nav`, x 0–335) is Phase 3's and is ignored here; it lights "Insights & Analytics". The page area (`sp-page`) starts at x 335 and is 1105 wide.

| Frame | Light | Dark | Screenshot (1x, 1440 × 1261) |
|---|---|---|---|
| Insights & Analytics | 13:832 (page 13:905) | 13:1142 (page 13:1215) | `reference/insights.png`, `reference/insights-dark.png` |

Dark ids are Light + 310 throughout (13:906 → 13:1216, 13:1076 → 13:1386). The geometry of the two frames is identical node for node; Dark only adds the lit edge on cards (codegen shifts Dark's inner positions by 0.25 / 0.65 px because of it; ignore that).

| Part | Light | Dark |
|---|---|---|
| PageHeader (title + Export CSV) | 13:906 | 13:1216 |
| Filters | 13:911 | 13:1221 |
| Digest ("Your month in brief") | 13:925 (card 13:926) | 13:1235 (card 13:1236) |
| KPI row | 13:940 | 13:1250 |
| Row: Trend + Top templates | 13:974 (trend 13:975, top 13:1036) | 13:1284 (13:1285, 13:1346) |
| Public links card | 13:1076 | 13:1386 |

Read this first:

- **No Master instances.** Every part is a plain frame (`Button · Export CSV`, `Filter · …`, `Metric · …`, `Change chip`, `Tabs`, `Tooltip · Tue, Sep 8`, `sp-chat-btn · Copy`, `Track`/`Bar`). The mappings below are by look and measurement.
- **Codegen vs style names on shadows.** Cards print as `drop-shadow 2/2/4` with inset bevels; the bound style is **Elevation/Small** (2/2 blur 8). The Light tooltip prints `4/4/16`, which is **Elevation/Medium**. Use `--elevation-small` / `--elevation-medium`.
- **Codegen vs Light raw values.** Light writes card fills as raw `white`, text as raw `#0b0b0c`, the tabs track as raw `#f1f1ef`, dividers as raw `rgba(11,11,12,.08)`. Dark binds `--surface-raised`, `text/primary` (#f1f1f1, which is `--text-strong` in Dark), `--surface-page` and raw `rgba(255,255,255,.08)`. Map them to `--surface-raised`, `--text-strong`, `--control-track`, `--border-default`. A few Dark values stay raw (KPI numbers `white`, bar-list fills `white`, chip washes); see Dark differences.
- **Raised cards in Dark gain the lit edge**: `--border-raised` at 0.65 top / 0.25 sides / 0.55 bottom. Same as Phases 5 to 7.
- **Layer names vs copy.** Both "View all" texts are layers named `Link · See all`; the drawn copy is **"View all"**. The chart is named `Chart · daily exports (role=img)`, the selected tab `Tab · Exports · selected (aria-selected)`, top-template rows `Row link · …`: the designer's intent for roles, recorded here only as names.
- **No footer links** (Terms / Privacy) are drawn on this page, unlike Brand Studio and Settings.

Type key (from `src/styles/tokens.css`): t-title-page 500 30/1.2 −0.02em · t-title-panel 500 17/1.25 −0.01em · t-title-metric 500 40/1.1 −0.03em · t-label-l 500 15/1.25 −0.01em · t-label-m 500 14/1.25 · t-label-s 500 13/1.25 · t-label-xs 500 12/1.25 · t-body-xs 400 13/1.4 · t-caption-m 400 13/1.25 · t-caption-s 400 12/1.25 · t-caption-xs 400 11/1.3 · t-button-m 500 14/1.25 −0.01em · t-button-s 500 12/1.3 −0.01em (trimmed) · t-control-m 500 14/normal −0.01em.

---

## 0. Page (`sp-page` 13:905, 1105 wide)

- Column, padding **top 45, bottom 40, x 45**. Content width 1015. The vertical rhythm is drawn with spacer frames, not auto-layout gap:
  - PageHeader (y 45, 36 tall) → **`gap 20`** (13:910) → Filters (y 101, 36) → **`gap 28`** (13:924) → Digest (y 165) → **`gap 28`** (13:939) → KPI row (y 356, 157) → **`gap 28`** (13:973) → Row (y 541, 300) → **`gap 28`** (13:1075) → Public links (y 869, 352). Page ends at 1221 + 40 = 1261.
- 20 and 28 are off the spacing scale (`--space-md` 24, `--space-lg` 32). `PageHeader` today puts **24** under itself (`.sp-shell-pagehead` margin-bottom `--space-md`, `shell.css:152`); the frame draws 20 to the filters.
- **Two width/height slips in the file** (see Odd values):
  - The Digest card is **1009 × 168** inside a 1015 × **163** slot. It is 6 short on the right and overflows its slot by 5, so the visible gap to the KPI row is **23**, not 28.
  - The Trend + Top templates row adds up to **1009** (689 + 16 + 304), also 6 short of 1015. The KPI row and Public links are the full 1015. In the screenshot the right edges of the Digest, Trend row and the others do not line up.
- Code today: `Page` + `PageHeader title="Insights & Analytics" actions={…}` (`admin/Dashboard.tsx:254-255`); sections stack in a column with gap `--space-xs` (12), KPI grid `.sp-insights-kpis` (4 cols, gap 16), rows `.sp-insights-row` (`1fr 304px`, gap 16), `.sp-insights-row--halves` (`socialpaint.css:2876-2903`).

## 1. PageHeader (13:906) and Filters (13:911)

### PageHeader
- 1015 × 36, row, space-between, items centred.
- Title **"Insights & Analytics"** (13:907): 30 Medium / 1.2 / −0.6 px → `.t-title-page`, `--text-strong`. No eyebrow, no sub-line.
- `Button · Export CSV` (13:908): **104 × 36**, padding x 16, radius 7, no icon. Fill Light `--surface-sunken` (#ececec), **Dark `--surface-raised`** (#171819): that pair is `--control-fill`. Label **"Export CSV"** 14 Medium / normal / −0.14 px → `.t-button-m`, `--text-strong`. → **`Button kind="neutralOnPage" size="default"`**, exact. Today `sp-btn sp-btn-ghost` (`Dashboard.tsx:134-144`).
- The date range is **not** in the header any more: today's header holds an `.sp-segmented` range radiogroup beside Export CSV (`Dashboard.tsx:112-133`); the frame moves the range into the Filters row as a dropdown.

### Filters (`Filters (date range, templates, members, platforms)` 13:911)
- Row, **gap 8** (`--space-2xs`), 518 × 36, left-aligned under the title. 20 below the header.
- Four `Filter · …` frames, each: **36 tall, padding l 14 / r 12, gap 10, radius 9** (`--radius-control-md`), fill Light `--surface-sunken`, **Dark `--surface-raised`** (= `--control-fill`), label 14 Medium / normal / −0.14 px → `.t-control-m`, `--text-strong`; chevron a 9 × 4.5 vector, stroke 1.5, Light `#0b0b0c` / Dark `#f1f1f1` (`--text-strong`).

  | Node | Layer | Label | Width |
  |---|---|---|---|
  | 13:912 | Filter · Date range | **"Last 30 days"** | 125 |
  | 13:915 | Filter · Templates | **"All templates"** | 125 |
  | 13:918 | Filter · Members | **"All members"** | 122 |
  | 13:921 | Filter · Platforms | **"All platforms"** | 122 |

- → **`Filter`** (`primitives/Filter.tsx`, `.ui-filter` 36, padding 0 12 0 14, gap 10, `--radius-control-md`, `--control-fill`, `primitives.css:482-491`), exact. The primitive draws lucide `ChevronDown` at 16; the frame's chevron is the same shape at the same visual size (9 × 4.5 inside the 16 box). No menu, open state or "active filter" state is drawn.

## 2. Digest (`Card · Monthly digest` 13:926)

- **1009 × 168** (see §0). Column, padding **y 24 / x 28**, radius 20 (`--radius-card`), `--surface-raised`, Elevation/Small; Dark adds the `--border-raised` edge.
- `Heading` (13:927): row, **gap 12**, items centred, 44 tall.
  - `Tile · Assistant` (13:928): **44 × 44, radius 7** (`--radius-control`), `--surface-sunken`, no border. Icon 24 at 10, 10: a bar chart with an axis (lucide **`chart-column`** by look; the old `bar-chart-3`), stroke 2, Light `#0b0b0c` / Dark `white` → `--text-strong`.
  - `Title + range` (13:934): column, **gap 2**.
    - **"Your month in brief"**: 17 Medium / 1.25 / −0.17 px → `.t-title-panel`, `--text-strong`.
    - **"Aug 17 to Sep 15"**: 13 Regular / normal → `.t-caption-m`, `--text-secondary`. Sample dates; the shape is "{start} to {end}", the word "to", no en dash.
- `gap 16` (13:937), then `Summary` (13:938): **22 Regular / 30 px / −0.22 px** (−0.01em), `--text-strong`, fixed width **860** (two lines here). **No text class** at 22 Regular (nearest are `.t-title-group` 500 20/1.3 and `.t-body-l` 400 16/1.5).
  - Copy (sample): **"Your team exported 1,128 graphics, 18% more than the month before. Frontier Summit drove 22% of them, and Tuesday mornings were the busiest."**
- No action, dismiss, refresh, "generated by" note, loading or empty state is drawn. The tile's layer name says the summary is the assistant's.
- Today: nothing like it exists on the page.

## 3. KPI row (`KPI row · four metric cards` 13:940)

- Row, **gap 16** (`--space-sm`), 1015 wide, four cards at flex 1 (**241.75** each), 157 tall.
- Card (`Metric · Exports` 13:941 etc.): padding **25** on all sides (off by one from `--space-md`; see Odd values), radius 20, `--surface-raised`, Elevation/Small; Dark adds the edge.
- `Content`: column, **gap 12** (`--space-xs`), 191.75 × 107:
  1. Label: **15 Medium / normal, no tracking**, **`--text-strong`** (not secondary). Nearest `.t-label-l` (15 / 1.25 / −0.01em).
  2. Value: **40 Medium / 44 px / −1.2 px** → `.t-title-metric` (40 / 1.1 / −0.03em), exact. Light raw `#0b0b0c`, **Dark raw `white`**.
  3. `Change vs last 30 days`: row, **gap 8**, items centred, 21 tall:
     - `Change chip`: **21 tall** (padding 3 / 8), pill (`--radius-pill`), label 12 Medium / normal, glyph + value.
     - **"vs last 30 days"**: 13 Regular / normal → `.t-caption-m`, `--text-secondary`. The "30 days" follows the range filter.
- Cards and chips (all sample values):

  | Card (L / D) | Label | Value | Chip text | Chip fill Light | Chip fill Dark | Chip text colour (both) |
  |---|---|---|---|---|---|---|
  | 13:941 / 13:1251 | **"Exports"** | 1,128 | **"↗ 18%"** | `--field-green` (#082a23) | raw `rgba(23,255,126,.10)` = `--accent-green-subtle` | `--accent-green` |
  | 13:949 / 13:1259 | **"Opens"** | 3,180 | **"↗ 11%"** | `--field-blue` (#09243d) | raw `rgba(20,228,255,.10)` (no token) | `--accent-blue` |
  | 13:957 / 13:1267 | **"Posted to LinkedIn"** | 312 | **"↘ 4%"** | `--field-purple` (#240c39) | raw `rgba(167,130,255,.20)` (no token) | `--accent-purple` |
  | 13:965 / 13:1275 | **"Active members"** | 23 | **"↗ 5"** | `--field-warm` (#2b0e1e) | raw `rgba(255,54,39,.20)` (no token) | `--accent-warm` |

- **The chip colour is the card's series colour, not the direction.** "↘ 4%" (a fall) is purple because Posted is purple; "↗ 5" (a rise) is warm red because Active members is warm. There are no positive / negative variants: the sign is carried only by the arrow glyph (U+2197 ↗, U+2198 ↘) and, for Active members, the unit changes from a percent to a count ("↗ 5"). No flat / "no change" or "new" chip is drawn.
- The Light pairs are exactly the brand field / accent pairs (and Exports' pair equals `Status tone="positive"` in Light: `--status-positive-bg` deep-moss + `--accent-green`). Dark switches to a translucent accent wash at **10% for green and blue, 20% for purple and warm**; only green's wash has a token.
- Exports, Opens and Posted take the same hues as the Trend tabs' dots (§4). Active members (warm) has no tab.
- No sparkline, no series dot before the label, no count-up is drawn (today's `InsightKpi.tsx` draws an 8 px accent dot, a 24 px head-font number, a sparkline and a "+18% vs …" caption with an arrow).

## 4. Trend card (`Card · Daily exports (metric tabs)` 13:975)

- **689 × 300**, radius 20, `--surface-raised`, Elevation/Small; Dark adds the edge. Absolutely laid out in the file; the insets are **24 left / 24 right / 24 bottom, 22 top** (the tabs sit 2 higher than the card padding).

### Tabs (13:976)
- At x 24, y 22, **265 × 35**. Track: padding **3**, gap **2**, radius 9, fill Light raw `#f1f1ef`, **Dark `--surface-page`** (#0b0b0c). That pair is exactly `--control-track` (paper-075-warm / ink-900).
- Each tab: padding **6 / 12**, gap **7**, radius 7, a **10 px dot** then the label 14 Medium / normal / −0.14 px → `.t-control-m`.
  - Selected (`Tab · Exports · selected (aria-selected)` 13:977, 89 × 29): fill Light raw `white`, **Dark `--surface-sunken`** (#2f3133) = `--control-thumb` per theme; shadow `0 1 3 rgba(0,0,0,.08)` = `--elevation-thumb`; label `--text-strong`.
  - Resting (`Tab · Opens` 13:980, 82 wide; `Tab · Posted` 13:983, 84 wide): no fill, label `--text-secondary`.
- Labels and dots: **"Exports"** green `#17FF7E` (`--accent-green`), **"Opens"** blue `#14E4FF` (`--accent-blue`), **"Posted"** "Dusk" `#A782FF` (`--accent-purple`, violet). The dot colours do not change in Dark.
- → **`Tabs` / `Tab`** (`primitives/Toggles.tsx:137-230`; `.ui-tabs` padding 3, gap 2, `--control-track`, `.ui-tab` 6 / 12 gap 7, `--control-thumb` + `--elevation-thumb` when selected, `.ui-tab__dot` 10 px, `primitives.css:706-765`) with `dot="green" | "blue" | "purple"`. **Exact in both themes.** Today the trend switcher is a hand-rolled `role="tablist"` of `.sp-section-title` buttons (`TrendCard.tsx:113-147`).

### Range note (13:986)
- **"Daily, Aug 17 to Sep 15"**: 13 Regular / normal → `.t-caption-m`, `--text-secondary`, right-aligned to the card's 24 inset (x 538–665), vertically centred on the tabs (y 32). Sample dates; "Daily" names the bucket.

### Chart (`Chart · daily exports (role=img)` 13:987)
- At x 24, y 80, **641 × 196** (23 below the tabs, 24 above the card's bottom).
- **Plot area** x 32 → 641 (**609 wide**), baseline at y 166. Linear scale **2 px per unit**, 0 to 80.
- **Y axis**: labels "0", "20", "40", "60", "80" at x 0 (left-aligned), each centred on its gridline; 11 Regular / normal → `.t-caption-xs` (11 / 1.3), `--text-secondary`. No axis title, no y-axis line.
- **Gridlines**: 1 px, x 32 → 641, at 0 / 20 / 40 / 60 / 80 (y 166, 126, 86, 46, 6).
  - Baseline (0): Light raw **`rgba(8,42,35,.14)`** (Deep Moss 14%), Dark raw **`rgba(241,241,241,.14)`**.
  - Others: Light **`rgba(8,42,35,.07)`**, Dark **`rgba(241,241,241,.07)`**.
  - No token. Light tints the grid with Deep Moss, not ink; `--border-default` is ink-750 8% / paper-075 10%; legacy `--viz-grid` is `var(--border)`.
- **Bars**: 30 (Aug 17 to Sep 15), each **14 wide, radius 7** (fully rounded top and bottom), standing on the baseline. Pitch **20.517** (= 595 / 29), so gaps of ~6.5. The first bar's left edge is at the plot's left (x 32), the last bar's right edge at its right (x 641). No hover column, no value labels.
  - Resting: **`--surface-sunken`** (Light #ececec, Dark #2f3133). The non-selected bars are **neutral grey, not the series colour**.
  - Selected (`SEP 8 · 56 · selected` 13:1020): **`--accent-green`** (the Exports series). The selected bar is the only coloured mark.
  - Sample values (layer names): 30, 34, 44, 46, 40, 20, 19, 33, 36, 46, 48, 42, 22, 21, 36, 40, 49, 52, 44, 23, 22, 38, **56**, 51, 55, 47, 25, 24, 41, 44.
- **X axis**: labels every 7th day: **"AUG 17", "AUG 24", "AUG 31", "SEP 7", "SEP 14"** at y 176 (10 below the baseline): **11 Medium / normal, tracking 0.88 px (0.08em), upper case**, `--text-secondary`. Each is centred on its bar **except the first, which is left-aligned to the plot's edge** (x 32–72; its bar's centre is 39). **No text class** (nearest `.t-label-xxs` 500 10/1.25 trimmed; `.t-mono-eyebrow` is mono 10 upper case). No axis line besides the baseline gridline.
- **Tooltip** (`Tooltip · Tue, Sep 8` 13:1033): **149 × 32** at x 415.38, y 12: centred over the selected bar (centre 489.9 vs the bar's 490.4) with its bottom **10 above the bar's top**. Row, gap **8**, padding **7 / 10**, radius **9**.
  - Light: fill raw `white` (`--surface-raised`), **1 px `rgba(11,11,12,.08)`** border, **Elevation/Medium**.
  - Dark: fill **`--surface-sunken`** (#2f3133), **1 px `rgba(241,241,241,.08)`** border, **no shadow**.
  - **"Tue, Sep 8"**: 12 Regular / normal → `.t-caption-s`, `--text-secondary`. **"56 exports"**: 13 Medium / normal → `.t-label-s`, `--text-strong`. Lower-case unit after the number.
  - → **`Tooltip`** (58:434; `primitives/Overlays.tsx:15-22`, `.ui-tooltip` padding 7 / 10, gap 8, 1 px `--border-default`, `--radius-control-md`, `--surface-raised`, `--elevation-medium`, `primitives.css:1005-1019`). **Exact in Light. Dark differs**: the frame fills `--surface-sunken` and drops the shadow; the primitive stays `--surface-raised` (the same colour as the card, so in Dark it would read only by its 10% border and the bevel). See Open questions.
- No legend besides the tabs, no comparison (previous-period) series, no dashed line, no loading or empty state is drawn. Today's `TrendCard.tsx` is a Recharts chart with a series-coloured area/bars, `--viz-grid` grid, a dashed previous-period line in `--viz-neutral-3` and an `.sp-eyebrow` tooltip label.

## 5. Top templates card (`Card · Top templates` 13:1036)

- **304 × 300** (today's `.sp-insights-row` right column is already 304). Radius 20, `--surface-raised`, Elevation/Small; Dark adds the edge. Insets **24** left, right and top; the last row ends at 282, **18** above the bottom (the card height is fixed at the row's 300, matching the Trend card).
- `Card header` (13:1037): 256 × 24, row, space-between, items centred.
  - **"Top templates"**: 17 Medium / 1.25 / −0.17 px → `.t-title-panel`, `--text-strong`.
  - **"View all"** (layer `Link · See all`): 14 Medium / 1.25 → `.t-label-m`, `--text-strong`, **underlined** (from-font position). Plain text in the file; reads as a link. Today the header action is an `sp-btn sp-btn-ghost` (`TopTemplatesCard.tsx:24`).
- Rows start **24 below the header** (y 72). Five `Row link · …` rows, **256 × 34**, pitch **44** (10 between rows). Each holds `Name + bar` (31 tall, inset 1.5): column, **gap 7**:
  - `Name + count`: row, gap 8, 16 tall:
    - Name: 13 Regular / normal, `--text-strong`, flex 1, **ellipsis**. Nearest `.t-caption-m` (13 / 1.25; `.t-body-xs` is 13 / 1.4).
    - Count: 13 Medium / normal → `.t-label-s`, `--text-strong`, right.
  - `Track`: **256 × 8, radius 4**, `--surface-sunken`, overflow clip. `Bar` inside: 8 tall, radius 4, left-aligned. Fill Light **`--text-primary`** (#272727), **Dark raw `white`**. **Every bar is the same colour**: no leader highlight.
- Rows (sample data; names keep their curly apostrophes and the middle dot):

  | Name | Count | Bar width (of 256) |
  |---|---|---|
  | "Say goodbye to Canva templates" | 312 | 218 |
  | "Frontier Summit · I’ll be there" | 248 | 173.28 |
  | "I’m speaking · AI Marketing Summit" | 181 | 126.47 |
  | "We’re hiring" | 142 | 99.22 |
  | "Webinar invite" | 96 | 67.08 |

  The widths are proportional to the count with the **leader at 218 / 256 (85%), not the full track**. Public links (§6) fills its leader to 100%; see Open questions.
- No rank numbers, thumbnails, hover or empty state are drawn. Today (`TopTemplatesCard.tsx:51-100`): 6 px pill track `--viz-track`, leader `--viz-neutral-strong`, others `--viz-neutral`, leader name `--text-primary` and the rest `--text-secondary`, count in `.sp-eyebrow` (mono).

## 6. Public links card (`Card · Public links` 13:1076)

- **1015 × 352**, column, **padding 24, gap 16**, radius 20, `--surface-raised`, Elevation/Small; Dark adds the edge.
- `Card header` (13:1077): 967 × 24, as Top templates: **"Public links"** `.t-title-panel` and **"View all"** underlined `.t-label-m`, `--text-strong`.
- `Table` (13:1080): column, 967 wide.
  - `Columns` (13:1081): row, **gap 16**, items centred, **padding-bottom 8**, 25 tall. **No divider under the header row.**
    - **"Link"** (240 wide, left), a flex spacer over the bar column (466), **"Opens"** (64, right-aligned), **"Exports"** (64, right-aligned), a 69 spacer over the Copy column.
    - All three: 12 Medium / 1.4, `--text-secondary`. **No exact class** (nearest `.t-label-xs`, 12 Medium / 1.25). Sentence case, UI face (today they are `.sp-eyebrow`, mono upper case).
  - Rows (`Row · …`, 967 × 59): row, **gap 16**, items centred, **padding y 12**. Separated by **1 px dividers** (`divider` 13:1100 etc.): Light raw `rgba(11,11,12,.08)`, Dark raw `rgba(255,255,255,.08)` → `--border-default` (ink-750 8% / paper-075 10%; near enough). No divider after the last row.
    1. `Name` (240 wide): column, **gap 2**:
       - Link name: 13 Regular / normal, `--text-strong` (nearest `.t-caption-m`).
       - Template name: 12 Medium / 1.4, `--text-secondary` (no class; nearest `.t-label-xs`).
    2. `Track`: **flex 1 (466), 8 tall, radius 4**, `--surface-sunken`; `Bar` 8 tall, radius 4, Light `--text-primary` / Dark raw `white` (as §5).
    3. Opens: 13 Regular / normal, **`--text-secondary`**, right-aligned, 64 wide.
    4. Exports: 13 Medium / normal → `.t-label-s`, **`--text-strong`**, right-aligned, 64 wide.
    5. `sp-chat-btn · Copy` (69 × 28): padding x 10, gap 6, radius 7, `--surface-sunken` in both themes; icon 14 (lucide **`copy`**, stroke 1.17 = 2 at 24), Light `#0b0b0c` / Dark `#f1f1f1`; label **"Copy"** 12 Medium / 1.3 / −0.12 px, trimmed → `.t-button-s`, `--text-strong`. → **`Button kind="neutral" size="sm" icon={Copy}`**, exact (the primitive draws the icon at 14 at Small). Today `sp-btn sp-btn-ghost` (`PublicLinksCard.tsx:112`).
  - Rows (sample data):

    | Link | Template | Opens | Exports | Bar (of 466) |
    |---|---|---|---|---|
    | "Newsletter readers" | "Webinar invite" | 58 | 31 | 466 |
    | "Speaker confirmations" | "I’m speaking · AI Marketing Summit" | 37 | 24 | 361 |
    | "Career fair" | "Now hiring" | 41 | 19 | 286 |
    | "Recruiting partners" | "Now hiring" | 9 | 4 | 60 |

    **The bar encodes Exports**, scaled so the most-exported link fills the track (31 → 466, 24 → 360.8, 19 → 285.6, 4 → 60.1). It is not Opens (37 / 58 would be 297, not 361).
- No "copied" state, no status pill, no revoke or row menu, no pagination, no empty state are drawn. Four rows are shown; "View all" implies the list is capped.

---

## Chart and data-mark colours

| Mark | Light | Dark | Token today |
|---|---|---|---|
| Series: Exports | `#17FF7E` | same | `--accent-green` (also legacy `--viz-series-1` = `--slime`) |
| Series: Opens | `#14E4FF` | same | `--accent-blue` (legacy `--viz-series-2` = `--lapis`) |
| Series: Posted ("Dusk") | `#A782FF` | same | `--accent-purple` (violet). **Legacy `--viz-series-3` is `--purple-kara` #9f60ff, and today's code draws Posted in `--viz-series-5` (Christina pink)** (`TrendCard.tsx:30`, `Dashboard.tsx:296`). |
| Series: Active members (KPI chip only) | `#FF3627` | same | `--accent-warm` (legacy `--viz-series-4`) |
| Trend bars, resting | `--surface-sunken` #ececec | #2f3133 | `--surface-sunken` (bound) |
| Trend bar, selected | `--accent-green` | same | bound; follows the selected tab's series by inference |
| Gridline, baseline | `rgba(8,42,35,.14)` | `rgba(241,241,241,.14)` | **none** |
| Gridlines, others | `rgba(8,42,35,.07)` | `rgba(241,241,241,.07)` | **none** |
| Axis labels | `--text-secondary` | same | bound |
| Bar-list track (Top templates, Public links) | `--surface-sunken` | same | bound |
| Bar-list fill | `--text-primary` #272727 | raw `white` | **no single token.** Legacy `--viz-neutral-strong` is #272727 / #f1f1f1 (`socialpaint.css:510, 663`), close; `--surface-inverse` is #0b0b0c / #ffffff. |
| KPI chip fill | `--field-*` | accent at 10% (green, blue) / 20% (purple, warm) | Light bound; Dark only green has a token (`--accent-green-subtle`) |
| KPI chip text | `--accent-*` | same | bound |

- **No `--viz-*` or chart tokens exist in `tokens.css`** (the generated Figma tokens). The `--viz-series-*`, `--viz-neutral*`, `--viz-track`, `--viz-grid` set lives in the legacy `socialpaint.css` (`:510-515`, `:663-668`, `:712-720`), and `theme.css:34-38` maps `--chart-1..5` onto it. The frame binds none of them.

---

## Dark differences (beyond token flips)

1. Every card (Digest, four KPI cards, Trend, Top templates, Public links) gains the `--border-raised` edge (0.65 / 0.25 / 0.55).
2. Export CSV and the four Filters fill `--surface-raised` in Dark and `--surface-sunken` in Light: both are `--control-fill`, which `neutralOnPage` and `.ui-filter` already read. No override.
3. Tabs: track `--surface-page` (Light raw #f1f1ef), selected tab `--surface-sunken` (Light raw white). Both pairs are `--control-track` / `--control-thumb`; the `Tabs` primitive already reads them. No override.
4. **KPI chips change recipe**, not just value: Light is the dark field colour with the accent text; Dark is a translucent accent wash (10% green / blue, 20% purple / warm) with the same accent text. `--field-*` does not flip between themes, so this needs per-theme rules or new tokens.
5. KPI numbers are raw `white` in Dark (Light raw ink). `--text-strong` Dark is #f1f1f1; use it.
6. **Tooltip**: Dark fills `--surface-sunken` with a white-8% border and no shadow; Light is `--surface-raised` + ink-8% border + Elevation/Medium. The primitive is the Light recipe in both themes.
7. Gridlines switch from Deep Moss 14% / 7% to paper-075 14% / 7% (raw both).
8. Bar-list fills switch from `--text-primary` (#272727) to raw `white`.
9. Dividers in Public links: raw ink 8% → raw white 8% (`--border-default` is paper-075 10% in Dark; near enough).
10. Icons (digest tile, Copy, chevrons): `#0b0b0c` → `white` / `#f1f1f1`; use `--text-strong`.
11. Nothing else differs: same strings, geometry, sample data and states.

---

## Primitives used / not yet primitives

| Frame part | Master (by look) | Repo today | Notes |
|---|---|---|---|
| Page title "Insights & Analytics" | Title/Page | `PageHeader` (`layout/Page.tsx:55`) | Exact. Already in use (`Dashboard.tsx:255`). Its 24 bottom margin is 4 more than the frame's 20 to the filters. |
| Export CSV | Button 43:123, Neutral on page, Default | `Button kind="neutralOnPage"` | Exact (`--control-fill` pair, 36, px 16, no icon). Today `sp-btn sp-btn-ghost`. |
| Date range / Templates / Members / Platforms | Filter 99:547 | `Filter` | Exact. Each needs a menu: `Menu` (57:423) is the drawn family; no menu is drawn here. Today the range is an `.sp-segmented` radiogroup; the other three filters do not exist. |
| Digest card | none (`Card · Monthly digest`) | none | **Not a primitive.** `Card` (58:476) has the same padding (24 / 28) and gap 16, but no icon tile and its subtitle gap is 4 (frame 2). Compose: `Card` with a `title` node, or a new `DigestCard`. |
| Digest icon tile | none | none | 44 × 44, radius 7, `--surface-sunken`, icon 24. Not `Avatar` (that is 32 / 38). |
| Digest summary text | none | none | 22 Regular / 30 / −0.01em has **no text class**. |
| KPI card | Metric 59:452 inside a card | `Metric` (`Containers.tsx:67`) | Metric's stack is exact (gap 12, `.t-title-metric`), but its label is `.t-label-l` (frame: no tracking, `--text-strong` matches) and its `sub` slot is a `.t-caption-m` line, which cannot hold the chip + caption row. The **card shell is not a primitive**: padding 25, radius 20, Elevation/Small. Row of four at gap 16 is not a primitive (`.sp-insights-kpis` today). Today `InsightKpi.tsx` on `sp-card sp-card--content`. |
| Change chip | Status 52:51 (shape only) | `Status` (`Chips.tsx:218`) | Shape exact (21, px 8, pill, `.t-label-xs`). **No tone fits**: it needs four series tones (green, blue, purple, warm) with a per-theme recipe (Light field + accent, Dark accent wash). Only Light green equals `tone="positive"`. **Not a primitive.** |
| "vs last 30 days" | none | text | `.t-caption-m` `--text-secondary`. |
| Trend metric tabs | Tabs 49:63 / Tab 49:62 with dots | `Tabs` + `Tab dot` | **Exact in both themes.** Today a hand-rolled tablist. |
| Range note "Daily, …" | none | text | `.t-caption-m` `--text-secondary`. |
| Bar chart (plot, bars, grid, axes) | none | Recharts (`TrendCard.tsx`) | **Not a primitive.** Rounded 14 px bars, grey resting, accent selected; grid and x-axis label style have no tokens / class. |
| Chart tooltip | Tooltip 58:434 | `Tooltip` (`Overlays.tsx:15`) | Exact in Light; Dark fill / shadow differ (see Dark differences 6). Placement is the chart's. |
| Card with title + "View all" (Top templates, Public links) | none (Card 58:476 / Settings card 58:460 by look) | `SettingsCard` | `SettingsCard` has the right padding (24) and a right `action` slot, but gap 20; the frame's gap is **24** (Top templates, header to rows) and **16** (Public links). `Card` has gap 16 but padding 24 / 28 and no action slot. Neither is exact. |
| "View all" | none | none | Underlined `.t-label-m` `--text-strong` text link; needs a hover look and the 2px-out ring (RULES §6). Same recipe as Phase 7's "Show all". Not a primitive. |
| Bar-list row (name + count over an 8 px bar) | none | inline styles (`TopTemplatesCard.tsx`) | **Not a primitive.** `ProgressBar` (58:451) is 4 tall, pill, `--accent-green` fill: wrong height, radius and colour. `Progress` (58:450) is a step bar. |
| Public links table | none | CSS grid (`PublicLinksCard.tsx:70-89`) | **Not a primitive.** Header row (12 Medium / 1.4 secondary, no class), rows py 12 gap 16, hairline dividers. Same row rhythm as Phase 7's member rows. |
| Copy | Button 43:123, Neutral, Small, icon | `Button kind="neutral" size="sm" icon={Copy}` | Exact. Today `sp-btn sp-btn-ghost`. |
| Footer links | not drawn | none | The page draws no Terms / Privacy links. |

Not drawn in this frame but present today: `WeekdayCard`, `SizeCard`, the refresh bar (`sp-refresh-bar`), the loading skeletons (`SkeletonInsightKpi`), the error and empty states. Part B / the behaviour reference rules on them.

---

## Odd values in the file

1. **Digest card 1009 × 168 in a 1015 × 163 slot**: 6 short on the right, 5 taller than its slot, so the next gap reads 23, not 28.
2. **Trend + Top templates row sums to 1009**, not 1015 (Trend is a fixed 689; the KPI row and Public links are 1015). Likely Trend should be flex 1 (695) beside the 304 column, as `.sp-insights-row` does today.
3. **KPI card padding 25** (every other card pads 24, the Digest 24 / 28).
4. **Trend tabs at y 22**, 2 above the card's 24 inset; the range note is centred on the tabs.
5. **Top templates' leader bar is 85% of the track** (218 / 256); Public links' leader is 100%.
6. **Top templates' bottom inset is 18** (fixed 300 height), against 24 elsewhere.
7. Page **bottom padding 40** (Phases 6 / 7: 28 under the footer links); spacer gaps **20** and **28** are off the scale.
8. Light gridlines are **Deep Moss-tinted** (`rgba(8,42,35,…)`), not ink.
9. Light bar-list fill is `--text-primary` (#272727, ink-750), Dark is raw white, not the Dark `--text-primary` (#f1f1f1).
10. KPI label at 15 Medium with **no tracking** (`.t-label-l` is −0.01em); the Metric primitive already notes this.

## Open questions (drawn only)

1. **Chip meaning.** The chip colour follows the series, so a fall on Posted and a rise on Active members look alike apart from the arrow, and a rise on Active members is red. Keep series colours (as drawn), or switch to a sign-based positive / negative pair? If kept, does Active members (no trend tab) keep warm?
2. **Dark chip washes** (blue 10%, purple 20%, warm 20%): new tokens (`--accent-*-subtle`), or a `color-mix` rule in the chip's CSS? Why 10% for two and 20% for the others?
3. **Tooltip in Dark**: adopt the frame's `--surface-sunken`, no-shadow recipe in the `Tooltip` primitive (Dark only), or keep the primitive's raised + Elevation/Medium?
4. **Chart tokens**: add `--viz-*` to the Figma token set (grid at 14% / 7%, bar-list fill, series 1–4 matching the accents), or bind to existing semantics (`--surface-sunken` bars, `--border-default` grid, `--text-strong` or `--surface-inverse` bar-list fill)? Which ink for the Light grid, Deep Moss or ink?
5. **Posted's series colour**: the file says violet (`--accent-purple`, #A782FF); the legacy `--viz-series-3` is #9f60ff and the code uses `--viz-series-5` (pink). Align on `--accent-purple`?
6. **Which bar is selected** in the trend: the drawn tooltip sits on Sep 8, which is not the last day but is the period's peak (56; Sep 10 is 55). Is the highlighted bar the hovered / focused bar only (no highlight at rest), or the peak shown at rest?
7. **Top templates scaling**: leader at 85% (as drawn) or 100% (as Public links)?
8. **Public links bar**: Exports, as drawn (the Opens column has no bar)?
9. **Digest text style**: add a 22 Regular / 30 class, or map to an existing one (`.t-title-group` is 20 Medium)?
10. **Axis label style**: 11 Medium upper case at 0.08em has no class; add one or use `.t-caption-xs` upper case?
11. **Slot widths**: confirm the Digest and the Trend row should run the full 1015 with 28 gaps (the 1009 / 168 values read as file slips).


---

# Part B: data and behaviour

Read on 2026-10-06 from `main` at 3766d48 (branch `feat/new-look-phase-8`), read only, against the Light frame export `reference/insights.png` (13:832) and `insights-dark.png` (13:1142). Part A covers geometry and tokens; this part covers what every drawn element stands on, what changes in behaviour, what the frame leaves out, and what CJ has to decide.

Paths are relative to `src/app/components/admin/` unless they start with `src/`, `supabase/` or `docs/`.

Read this first. Four findings change the size of this phase:

1. **Member attribution is missing on every member event.** `SchemaRenderer` records `open` and `download` with `userId` `undefined` (`src/app/components/SchemaRenderer.tsx:154`, `:163–169`), and the fill page records `share` the same way (`src/app/components/TemplateUsePage.tsx:136`). Both stores write `user_id: null` when no id is passed (`src/lib/stores/supabase/usageStore.ts:40`, `src/lib/stores/local/localStores.ts:343`), and no column default or trigger fills it (`supabase/migrations/0001_schema.sql:165`, `0006_real_auth.sql:150–154`). Only bulk fill passes the user (`src/app/components/bulk/BulkFillPage.tsx:274`). So today **Active members counts only people who ran a bulk fill**, on both backends, and has done since the table was created (`git log -S` traces the bare `record(…, "open")` to bf7af24). The drawn "All members" filter cannot work on old data at all. The unit tests pass because they hand-build events with `userId` (`src/lib/insights/buildInsights.test.ts:107–117`).
2. **The events read is probably truncated.** `getInsightEvents` selects raw rows with no `.range()` and no order (`usageStore.ts:197–223`). Supabase's API caps a response at its "Max rows" setting (1000 by default; `supabase/config.toml` sets no `[api]` section, so local is 1000 too, and prod's value needs checking in the dashboard). The read spans two windows (60 days on "Last 30 days", 24 months on 12m). At the frame's numbers (1,128 exports and 3,180 opens in one window alone) the page would silently count about a fifth of the events, and drop an arbitrary fifth. `getPublicLinkUsage` reads every public event ever recorded the same way (`usageStore.ts:262–267`).
3. **Public link Copy works today.** PHASE-7 §9 D4 says addresses are "stored hashed and shown once, so Copy can't fetch them". That is out of date. Migration `0033_link_token_retrievable.sql` (CJ, 2026-09-15) stores the plaintext token beside the hash, `template-links` writes it on create and regenerate (`supabase/functions/template-links/index.ts:226`, `:294`), `getPublicLinkUsage` reads it back (`usageStore.ts:259`), and the Insights card copies it (`insights/PublicLinksCard.tsx:41–53`). Only links minted before 0033 have `token = null`, and the card disables Copy for those (`:114–118`). Phase 7 dropped Copy from Settings › Sharing on the D4 premise (`settings/SharingSection.tsx:32–36`). The drawn Copy on Insights needs no backend; the conflict with Sharing needs a ruling (Open question 1).
4. **The "posted" metric already exists.** `usage_action` has `share` (`0027_share_events.sql`), recorded when a person presses Post to LinkedIn on the fill page (member, `TemplateUsePage.tsx:136` via `TemplateFill.tsx:237–242`) or on a public link page (`src/app/public/PublicFillPage.tsx:94`, through `public-link-event`, which allowlists `download` and `share`, `supabase/functions/public-link-event/index.ts:90–91`). `buildInsights` counts it as `posted` (`src/lib/insights/buildInsights.ts:359–361`). It measures "opened LinkedIn's composer with the caption", not a confirmed post: LinkedIn gives no callback (`src/lib/share/linkedin.ts:1–17`).

---

## Backend for each drawn element

| Drawn | Today | What it takes |
|---|---|---|
| PageHeader "Insights & Analytics" | **Exists.** `Dashboard.tsx:255` (`PageHeader` with `actions`). | Nothing. |
| **Export CSV** | **Exists.** Client-side Blob download of per-template rows for the selected range (`insights/exportCsv.ts:14–60`, wired at `Dashboard.tsx:134–144`): Template, Opens, Exports, Export rate, Posted, Through public links, Bulk exports, Last used. Disabled until data lands. Filename `insights-{range}-{date}.csv`, date in the workspace zone. | Derivable: pass the active filters into `buildInsights` so the rows follow them, and add the filters to the filename. No backend. (Contents question: Open question 9.) |
| **Last 30 days** (range menu) | **Exists as a segmented control**, not a menu: 7 days, 30 days, 90 days, 12 months (`buildInsights.ts:22–35`, `Dashboard.tsx:113–133`), kept in the URL as `?range=` with history replace (`src/app/router.tsx:172–177`, `:280–293`). Default 30d stays off the URL. | Nothing for the data. A `Select`/menu primitive replaces the segmented control; option labels become "Last 7 days" … "Last 12 months" (proposed). |
| **All templates** filter | **None.** | Derivable client-side: the template list is already loaded (`stores.templates.listAll`, `Dashboard.tsx:54–57`), and every event carries `templateId`. Add `templateId?` to `buildInsights`' input and skip non-matching events before counting. URL param `?template=`. No backend, given finding 2 is fixed. |
| **All members** filter | **None**, and **the data is not there** (finding 1). Member names exist: `stores.people.list` returns `{userId, email, name?, role}` (`src/lib/stores/interfaces.ts:129–134`; Supabase reads `users(email, name)`, `supabase/peopleStore.ts:15–22`), already loaded by the page (`Dashboard.tsx:58–61`). | (a) Record the member: pass `user?.id` from the three call sites, or better, a `before insert` trigger on `usage_events` that sets `user_id := auth.uid()` when `actor = 'member'` and `user_id is null` (one migration; covers every present and future call site; public events are inserted by the service role, where `auth.uid()` is null, so they stay null). (b) Then filter client-side by `userId`. History before the fix stays unattributed and cannot be backfilled. Open question 2. |
| **All platforms** filter | **None**, but **derivable**. A template's platforms come from its canvas size: `classifySize(width, height).platforms` (`src/lib/templates/platforms.ts:230–237`), the same rule the Brand Templates chips use (`servesPlatform`, `src/lib/templates/groups.ts:70–71`). One size can serve several platforms (1080×1350 is Instagram, Facebook and LinkedIn), and an unknown size is `general`. | Client-side: map each event's template to its platforms, keep the event when the chosen platform is among them. Options listed in `PLATFORMS` order, only platforms with at least one template (as `buildPlatformFacets` does). The filter means "templates sized for this platform", never "where it was posted" (events carry no destination). No backend. |
| Digest card "Your month in brief" | **None.** No summary text anywhere on the page today. `buildInsights` computes `findings` (`templateShare` ≥ 20%, `inactiveMembers`, `postingSlipped`, `unusedTemplates`, `:481–505`) but nothing renders them (only a stale comment, `Dashboard.tsx:30`); the Weekday card prints "{Day}s are busiest." (`insights/WeekdayCard.tsx:33–34`). | See "The digest" below. Recommended: a deterministic sentence built from numbers the page already computes, plus one new pure helper for part of day. |
| Digest dates "Aug 17 to Sep 15" | **Derivable.** The current window's first and last day keys (`buildWindows`, `buildInsights.ts:216–240`): 30 days ending today inclusive in the workspace zone, exactly the drawn span. Not exposed on `Insights` today. | Return `window: {start, end}` from `buildInsights`; format "MMM D to MMM D" (12m: "Oct 2025 to Sep 2026", proposed). |
| KPI **Exports** 1,128 | **Exists.** `download` events in the window; `bulk_export` deliberately excluded (`buildInsights.ts:8–9`, `:353–355`). | Nothing. |
| KPI **Opens** 3,180 | **Exists.** `open` events: a member opening the fill page (one per renderer mount with `instrument`, `SchemaRenderer.tsx:151–156`) and a public link page view recorded server-side (`supabase/functions/public-template/index.ts:303–308`). | Nothing. |
| KPI **Posted to LinkedIn** 312 | **Exists** as `share` events (finding 4). | Nothing for the count. Label accuracy: Open question 6. |
| KPI **Active members** 23 | **Exists in code, wrong in data** (finding 1): distinct `userId` on member events (`:363–366`). | The attribution fix. Until then it reads near zero. |
| Delta pills ↗18%, ↘4%, ↗5 | **Exists.** `changeOf` compares against the previous window of the same length (`:256–264`): percent for Exports, Opens, Posted; absolute delta for Active members; `new` when the previous window was 0; `flat` when equal. Today shown as text "Up 18% ↗" (`insights/InsightKpi.tsx:8–22`). | Nothing. The `new` and `flat` pills are undrawn (see Interactions). |
| "vs last 30 days" | **Exists in spirit**: today's accessible sentence says "on the previous 30 days" (`InsightKpi.tsx:74`). | Copy only; driven by `RANGE_LABEL`. Wording: Open question 8. |
| Trend card switch Exports / Opens / Posted | **Exists** as a tablist with arrow-key roving (`insights/TrendCard.tsx:115–146`), kept in the URL as `?metric=`. | Nothing. |
| Trend "Daily, Aug 17 to Sep 15" | **Derivable**, as the digest dates. 12m buckets are months (`monthlyWindow`, `:206–214`), so the caption reads "Monthly, …" there (proposed). | Nothing new. |
| Daily bars, y-axis 0–80 | **Exists as data** (`series[metric]`, one point per day, `:423–428`); today drawn as a recharts area with the previous window as a dashed line (`TrendCard.tsx:179–252`). | Re-render as bars (recharts `Bar`). Axis max from the data with a nice step, not a fixed 80. 90d draws 90 bars; 12m draws 12. |
| Highlighted bar + tooltip "Tue, Sep 8 · 56 exports" | **Partly exists.** Tooltip on hover with "SEP 9" + "3 exports" (`:190–220`); keyboard stepping announces the bucket in a live region (`:101–109`, `:255–257`). No resting highlight. | Tooltip copy gains the weekday ("Tue, Sep 8"). What is highlighted at rest: Open question 7. |
| Top templates, 5 rows (name, count, bar) | **Exists** (`insights/TopTemplatesCard.tsx`): top 5 by exports, zero-export templates left out (`buildInsights.ts:443–446`), leader's bar stronger. Rows link to the Template Builder (`:55–59`). | Nothing. Follows the filters for free once filtering happens in `buildInsights` (with a template filter it shows one row: Open question 5). |
| Top templates **View all** | **Exists** as "See all", to the Template Builder list (`adminTemplates`, `TopTemplatesCard.tsx:23–29`). | Label change. Destination: Open question 10. |
| Public links: link name, template beneath | **Name exists** (`PublicLinksCard.tsx:56–63`, "Untitled link" fallback). **Template name is loaded but not shown** (`PublicLinkUsageRow.templateName`, `src/lib/types.ts:615–633`). | Render it. No backend. |
| Public links: bar | **None.** The frame's bars match each row's exports over the top row's (31, 24, 19, 4 → 100%, 77%, 61%, 13%). | Derivable from `linkCounts`. |
| Public links: Opens, Exports | **Exist** per link for the window (`buildInsights.ts:392–397`), header labelled "Views" today (`PublicLinksCard.tsx:78–80`). | Rename to Opens. |
| Public links: **Copy** | **Exists** (finding 3), disabled with a tooltip on pre-0033 links. | Nothing; ruling on consistency with Sharing (Open question 1). |
| Public links **View all** | **None** on this card. Settings › Sharing lists every link (Phase 7). | A link to `/settings/sharing`. Row cap: Open question 10. |

---

## The digest

The drawn sentence has four claims. All four can be computed from the events the page already reads:

| Claim | Source |
|---|---|
| "Your team exported 1,128 graphics" | `kpis.exports.current` |
| "18% more than the month before" | `kpis.exports.change` (previous window of the same length) |
| "Frontier Summit drove 22% of them" | `findings` `templateShare` (top template's share of exports, emitted at ≥ 20%) |
| "Tuesday mornings were the busiest" | `weekday.busiest` exists; **"mornings" is new**: bucket each export's hour in the workspace zone (`Intl.DateTimeFormat` with `hour`, as `dayKeyInZone` does for days, `src/lib/stores/dailyActivity.ts:6–17`) into morning / afternoon / evening / night, and pick the busiest weekday-and-part pair. Pure, testable, no new data. |

### Option A: a deterministic sentence (recommended)

A pure `digestOf(insights, filters, range)` in `src/lib/insights/` returns clauses; the card joins them.

- **Cost and latency:** none. Renders with the numbers, works on the local backend and in fixture screenshots, never disagrees with the KPI cards beside it.
- **Copy it needs** (proposed, CJ to approve): subject "Your team" with no member filter, "{Name}" (or email) with one; drop the template clause when a template filter is set ("Frontier Summit drove 100%" is noise) and say "{Template} was exported 248 times" instead; change clause variants for `up`, `down` ("4% fewer than…"), `flat` ("about the same as…"), `new` ("the first exports in this range" style); omit the share clause below 20% and the busiest clause when there are fewer than about 10 exports or a tie; title per range ("Your week / month / quarter / year in brief"; 90 days is not a quarter, so maybe "Your last 90 days in brief"); a zero-exports sentence for a quiet range.
- **Limit:** it can only say what we planned for. Fine for four clauses.

### Option B: an AI-written sentence

A new Edge Function (`insights-digest`) sends the aggregated numbers (never raw events or member emails) to the model and returns one or two sentences.

- **Infra exists:** `template-generate` calls Anthropic with `ANTHROPIC_MODEL` defaulting to `claude-sonnet-4-6` (`supabase/functions/template-generate/index.ts:86`), meters each response into `ai_usage_events` through `_shared/usage.ts`, and rate-limits through the shared `consume_rate_limit` counters (`:92–95`).
- **Schema change needed:** `ai_usage_events.fn` and `kind` are CHECK-constrained lists (`0040_template_chat.sql:116–117`), so a migration adds `'insights-digest'` and a kind such as `'digest'`; `UsageFn`/`UsageKind` in `_shared/usage.ts:12–16` follow. The calls then show in Settings › Plan & usage › AI usage, and may count against plan limits if 7b ever meters them.
- **Cost:** about 1.5k input and 120 output tokens per call. Sonnet 4.6 at $3 / $15 per million tokens is roughly $0.006 per digest; Haiku 4.5 at $1 / $5 is roughly $0.002. Small per call, but every range or filter change is a new combination (4 ranges × templates × members × platforms), so it needs a cache keyed by company, range, filters and day, which means a table or a stored digest.
- **Latency:** a model round trip of a few seconds on every combination change while every other card renders at once; the card needs its own skeleton and failure state.
- **Risks:** the model can misstate a number, so the function must verify every figure in the reply against the input (as Generate validates its output) or fall back to Option A anyway; non-deterministic text breaks fixture screenshots; no data on the local backend without a stand-in (as Phase 4 built for the template chat); Admin-only data leaves the database for a third party, which is new for Insights.
- **Gain:** varied phrasing and the odd extra observation. Not the content the frame draws.

Recommendation: **Option A this phase.** It reproduces the drawn sentence exactly, costs nothing, and shares its numbers with the cards. An AI digest can come later as its own feature if CJ wants observations beyond the four clauses.

---

## Behaviour differences vs code

1. **Filters are new.** Template, member and platform menus beside the range, all four applying to every card, the digest and the CSV. Today only the range exists. Filters belong in the URL beside `range` and `metric` with history replace, as today (`Dashboard.tsx:121–127`), so a filtered view can be shared and survives reload.
2. **Range becomes a menu** ("Last 30 days" with a chevron) instead of four segments. Same four values.
3. **Digest card is new** (above).
4. **KPI cards lose the sparkline and the count-up.** Today each card has an accent dot, a 72×22 sparkline of the window and `useCountUp` on the number (`InsightKpi.tsx:24–51`, `:73`). The frame draws a label, a static number with separators, and a pill plus "vs last 30 days". `series.members` (`buildInsights.ts:433–437`) then has no reader and can go.
5. **Change shows as a pill with an arrow and figure** ("↗18%") instead of the words "Up 18% ↗". The words still belong in the accessible name (today's rule: direction never carried by colour or arrow alone, `InsightKpi.tsx:5–7`). The pill colours in the frame follow each metric's series colour (green, cyan, purple, red), not direction, so a rise in Active members is drawn red; Part A owns the colour, but CJ should confirm a red pill on a rise is intended.
6. **Trend becomes bars without the previous window.** Today an area for this period over a dashed line for the previous period, with a "This period / Previous 30 days" legend (`TrendCard.tsx:147–167`, `:221–241`). The frame drops the comparison line and the legend; the comparison survives only in the KPI pills.
7. **Trend switch** moves from text tabs to a segmented control with coloured dots; same three metrics, same URL param.
8. **Top templates "See all" becomes "View all".**
9. **Public links card** gains the template name under the link name and a bar; "Views" becomes "Opens". Today the card appears only when at least one non-revoked link exists (`Dashboard.tsx:345–352`); the frame always draws it, so the zero-links state needs a ruling (Interactions 9). Today's rows are sorted by exports, then opens, then name (`PublicLinksCard.tsx:64`); the frame's order agrees.
10. **The Weekday and Size cards go** (see below).
11. **"Active members" changes meaning once attribution lands:** today it is effectively "people who ran a bulk fill". After the fix, a jump that is entirely the fix will show as a big ↗ in the first window. Open question 2.

## What today's page shows that the frame drops

- **"When your team makes graphics"** (`insights/WeekdayCard.tsx`): exports by weekday as seven bars, the busiest bar in Slime, and "{Day}s are busiest. Weekends run at {n}% of the weekday pace." The digest's "Tuesday mornings" clause carries the busiest-day finding; the weekend-pace line is lost.
- **"Exports by size"** (`insights/SizeCard.tsx`): a donut of exports by orientation and ratio (top 3 plus Other, percentages summing to 100), with its own retry when templates fail to load. Partly replaced by the platform filter, but the frame shows no breakdown by size. `sizes` in `buildInsights` (`:466–479`) loses its reader.
- **The previous-window line and legend** on the trend (item 6).
- **Sparklines and count-up** on the KPIs (item 4).
- **Computed findings** that were never rendered (`inactiveMembers`, `postingSlipped`, `unusedTemplates`): the frame has no place for them either. Delete them, or fold one into the digest (Open question 4).
- **Bulk exports** are counted per template (`row.bulk`) and appear only in the CSV; the frame shows none (as today).
- **Public opens and exports** are folded into the totals by design (`buildInsights.ts:10–12`); the per-template "Through public links" figure stays CSV-only.

Proposed: delete `WeekdayCard.tsx`, `SizeCard.tsx`, the `sp-insights-row--halves` row and their skeletons (`Dashboard.tsx:187–204`, `:334–344`), and the `sizes` aggregation, unless CJ keeps either card below Public links (Open question 4).

## Interactions the frames drop

Each is today's behaviour or an undrawn state. CJ decides each.

1. **Who sees it:** admin only. `dashboard` is in `ADMIN_ONLY` (`router.tsx:333–340`); a member who opens `/insights` gets the gallery at the same address (`App.tsx:167`, `:253`); the nav item is admin-only (`Sidebar.tsx:57–63`). RLS also restricts `usage_events` reads to admins (`0006_real_auth.sql:155–156`). Keep.
2. **First load:** skeletons shaped like each card (`Dashboard.tsx:158–207`). The digest card needs one.
3. **Changing the range keeps the old numbers dimmed (56%) under a 2px progress bar** until the new window lands (`:70–82`, `:256–274`). Filters applied client-side are instant; only a range change refetches.
4. **Events load failure:** the whole page becomes `ErrorState` "We couldn't load your usage data." with Retry (`:148–156`).
5. **Templates load failure:** Top templates and Size show an inline "We couldn't load this." with Try again (`TopTemplatesCard.tsx:31–42`); counts still render with "(deleted template)" names. The template filter menu needs the same list, so it disables (proposed).
6. **People load failure:** Active members still counts; only the member filter is affected (disable it, proposed).
7. **Empty workspace:** when both windows hold no events, a single card "No usage yet" with a paragraph and "Open Brand Templates" replaces the page (`:213–249`). Its paragraph breaks RULES (no helper copy, `docs/design/new-look/RULES.md:98`). Undrawn.
8. **Empty filter result** (filters match nothing in the window) is new: zeros with "new"/"flat" pills, or an inline empty line in the digest. Undrawn.
9. **Zero public links:** today the card is hidden. Undrawn.
10. **Top templates with no exports:** "No exports in this range" (`TopTemplatesCard.tsx:43–48`). Undrawn.
11. **`new` and `flat` change states** ("New this period", "No change") have no drawn pill.
12. **Copy feedback:** the button reads "Copied" with a check for 2 s; a denied clipboard write leaves it unchanged (`PublicLinksCard.tsx:41–53`, `:125–130`). Pre-0033 links: Copy disabled with a long `title` tooltip (`:114–118`), which breaks the no-helper rule; a short "Regenerate to copy" or a row menu is needed.
13. **Keyboard on the chart:** focusable, Left/Right step the active bucket, announced politely (`TrendCard.tsx:101–109`, `:255–257`); the metric tabs take arrows, Home and End (`:87–99`). Keep on the bar chart.
14. **Deleted templates** keep counting as "(deleted template)" in rows and the CSV (`buildInsights.ts:318`). Events of a deleted template are actually removed by `on delete cascade` (`0001_schema.sql:163`), so this only happens when the templates list and events disagree mid-load.
15. **Revoked links** are dropped from the card (`Dashboard.tsx:347–349`) even when they had events in the window.
16. **Below desktop width:** `sp-insights-kpis` and `sp-insights-row` stack (`src/styles/socialpaint.css:2874`). The frame is 1440 only.
17. **Screenshot fixture:** `scripts/new-look/fixtures/dev-workspace.json` has no usage events and no memberships, so the fixture renders the empty state. The gate needs seeded events (members with names, links, several templates) and a fixed clock, since `buildInsights` windows end at `new Date()` (`:290`).

## Other data notes

- **Timezone.** Every day, weekday and month boundary follows `company.timezone` (`buildInsights.ts:13–14`, `dayKeyInZone`), DST-safe by stepping UTC dates on zone-local keys (`:154–164`). The part-of-day helper must use the same zone. The previous window ends the day before the current one starts (`:237–238`).
- **Comparison windows.** "Last 30 days" is today and the 29 days before; the comparison is the 30 days before that. 12m is the last 12 calendar months including the current partial month, against the 12 before (`:222–233`), so the current month is always short and 12m deltas lean negative early in a month.
- **Bulk exports never count as exports** (`0030_bulk_export_events.sql`), so the digest's "exported 1,128 graphics" excludes bulk renders. Matches today.
- **Public events and filters.** Public events have no member (`actor = 'public'`, `user_id` null, `0026_public_links.sql:103–110`). With a member filter they drop out, which is correct, but "All members" then means "everyone plus public links". A "Public links" entry in the member menu would make that visible (Open question 3).
- **Posted is per click.** Pressing Post to LinkedIn twice counts twice; the template chat's editor and Generate have no Post button (`openLinkedInComposer` is called only from `TemplateFill.tsx:239`), so posting from there is never counted.
- **Fix the read before adding filters.** Client-side filtering is only right if the read is complete. Two ways: (a) page through `usage_events` in 1000-row slices with `.range()` ordered by `created_at` (no migration, more requests on big workspaces); (b) a `security invoker` SQL function that groups by zone-local day, hour bucket, template, user, link, actor and action and returns counts (one migration, far fewer rows; the client unrolls counts). Recommended: (a) now for correctness, (b) if 12m gets slow. The same fix applies to `getPublicLinkUsage`'s all-time events read, which Insights does not even use for counts.

---

## Open questions

1. **Copy on public links, here and on Sharing.** Copy works today for every link made since 0033 (finding 3), and Phase 7 removed it from Sharing on the premise that it could not. Recommendation: keep Copy on Insights as drawn (disabled with a short "Regenerate to copy" label for pre-0033 links), correct PHASE-7 §9 D4 in the docs, and put Copy back on Sharing in a follow-up so the two pages agree.
2. **Member attribution.** Add the insert trigger (`user_id := auth.uid()` for member events) in this phase, with the member filter; accept that history stays unattributed? Recommendation: yes, the trigger (one migration, no client changes, no future call site can forget). Until a full comparison window has passed, show the Active members pill as "new" rather than a misleading jump, or note nothing and let it settle; prefer letting it settle with no special copy.
3. **Public activity in the member filter.** Add "Public links" as a menu entry (events with `actor = 'public'`)? Recommendation: yes, last in the list, so "All members" visibly includes outside fills.
4. **Weekday, Size and the unused findings.** Delete the two cards and the never-rendered findings as the frame implies? Recommendation: delete both cards and `inactiveMembers`/`postingSlipped`/`unusedTemplates`; keep `templateShare` for the digest.
5. **Top templates under a template filter.** One row is a dull card. Recommendation: keep the card and show the single row (simplest, honest); don't swap in a looks breakdown this phase.
6. **"Posted to LinkedIn" wording.** The count is presses of Post to LinkedIn, not confirmed posts. Recommendation: keep the drawn label (it is what members experience as posting), and say "Opened in LinkedIn" nowhere; note the meaning in the CSV header ("Posted (opened LinkedIn)") only if CJ wants precision.
7. **Resting highlight on the trend.** The frame shows one bar highlighted with its tooltip at rest. Recommendation: at rest, highlight the busiest bucket with its tooltip (it agrees with the digest); hover and keyboard move it; leaving restores the busiest.
8. **"vs last 30 days".** Read literally, the last 30 days is the current window. Recommendation: "vs previous 30 days" (12m: "vs previous 12 months").
9. **CSV contents.** Today: per-template rows for the range. Recommendation: same columns, rows filtered by the active filters, filters in the filename; add no daily sheet this phase.
10. **"View all" destinations.** Recommendation: Top templates → Template Builder (today); Public links → Settings › Sharing. Cap the Public links card at 5 rows by exports so "View all" means something (today it lists every active link).
11. **The digest: deterministic or AI.** Recommendation: deterministic (Option A) with the copy rules above, including a per-range title; revisit an AI digest as its own feature.
12. **The truncated read.** Recommendation: fix it in this phase with paging (Option a), and check prod's "Max rows" setting before and after.
13. **Empty states.** The whole-page "No usage yet" breaks the no-helper rule, and the filtered-empty, zero-links and new/flat pills are undrawn. Recommendation: keep a whole-page empty card with the title "No usage yet" and the "Open Brand Templates" button, no paragraph; filtered-empty shows the cards at zero with the digest saying "No exports match these filters." (proposed copy); hide Public links at zero links (today); pills read "New" and "No change" in neutral.
14. **Fixture data for the screenshot gate.** Recommendation: seed the dev fixture with about 60 days of events across several named members, five templates, four links and a fixed clock, using Acme Studios content (PLAN.md decision 6), never the frame's placeholder names.
