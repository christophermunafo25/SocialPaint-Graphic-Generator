# New look, Phase 3: shell reference

Read from the Figma file "Master UX-UI" (`mEJRslarcQDkgPeY6AObi5`) on 2026-10-04, read only. `PHASE-3.md` builds from this file; where the live file disagrees, the file wins, and `PHASE-3.md` §8 gives the rulings on what the file leaves open.

Reference images (1x) in `reference/`: `sidebar-56-646.png` (the six Sidebar variants), `brand-templates-13-5776.png`, `settings-workspace-13-14570.png`, `settings-people-13-14769.png`.

Contents: Part A, the sidebar, the account block and page headers; Part B, the Settings frames (rail, Workspace, People and the other sections for reference).

---

# Part A: sidebar, account and page headers

Read-only extraction 2026-10-04. All measurements px. Light-mode values; tokens from src/styles/tokens.css.
Figma font is "Raveo Display" everywhere (the app maps text styles to `.t-*` classes on `--font-ui`).
Pages seen: 24:674 Master UI Elements (components), 8:678 Settings, 13:679 All Screens (the page list call only returned 13:679; 8:678 / 24:674 exist and resolve by id).
Screenshots (scratchpad): p3-sidebar-56-76.png, p3-sidebar-set.png (all 6 variants), p3-account-56-1330.png, p3-brand-templates-13-5776.png (+ -top300), p3-settings-workspace-13-14570.png (+ -top300).

## 1. Sidebar component set 56:646 (on 24:674 > Navigation section 54:63)

Description (verbatim): "App sidebar. Page picks the selected item. Settings has no selected item and lights up the gear. People now lives in Settings."

### Full detail: Page=Brand Templates 56:76
- **Outer symbol 56:76**: 335 x 1053, flex column, padding `10px 0 10px 10px` (pl 10, py 10, **no right padding**). So the panel is inset 10 from top/left/bottom of the frame and flush with x=335 on the right.
- **Panel `sidebar` 56:77**: 325 x 1033, flex column, padding 20 (all sides), gap `--space-md` (24) between children, overflow clip.
  - bg `--surface-raised` (#fff), radius `--radius-card` (20).
  - border colour `--border-raised` (transparent in Light), widths: top 0.65, left 0.25, right 0.25, bottom 0.55.
  - effect style Elevation/Small = `--elevation-small` (inset 0 1px `--bevel-top`, inset 0 -1px `--bevel-bottom`, drop 2px 2px 8px `--shadow-raised` #0000000d).
- **header 56:78**: 285 x 32 at (20,20) in panel; flex row, `justify-content: space-between`, align center.
  - Logo 56:79 (component 54:66): 148 x 24, y offset 4. Description: "SocialPaint wordmark. The mark stays slime; the word uses text/primary so it flips in Dark."
  - utility 56:81: 72 x 32, flex row gap `--space-2xs` (8).
    - Theme toggle 56:82 (component 102:574 / 44:43): 32 x 32, radius 999, bg `--surface-sunken`; 15 x 15 sun glyph (moon in Dark), glyph colour text/secondary. Hover `--state-hover`, Pressed `--state-pressed`, focus ring 1px `--ring` 2px outside (inset -3).
    - collapse 56:94: 32 x 32, radius `--radius-pill`, **no fill**, icon 56:95 15 x 15 = lucide `panel-left` (icon/panel-left 39:28).
- **nav 56:98**: 285 x 188 at (20,76); flex column, **gap 2px** (raw value, no token), overflow clip.
  - Nav item (component 54:83): h 36, full width, flex row, padding `0 10px`, gap `--space-xs` (12), radius `--radius-control` (7). Icon 18 x 18, label Label/M = `.t-label-m` (14/1.25, 500), nowrap.
  - Default: no bg, label `--text-secondary`. Selected: bg `--state-selected` (#f9f9f8 Light / ink-700 #2F3133 Dark), label `--text-strong`, icon full ink. Hover: `--state-hover`. Focus: 1px `--ring` 2px outside.
  - Order, labels verbatim, icons:
    1. 56:99 "Brand Templates": lucide paintbrush (39:39) — selected in this variant
    2. 56:110 "Generate": lucide sparkles (39:54) (screens name it "sp-icon / Generate")
    3. 56:123 "Template Builder": lucide frame (39:67)
    4. 56:135 "Insights & Analytics": lucide chart-column (39:80)
    5. 56:147 "Brand Studio": lucide pencil-ruler (39:19)
  - Item y offsets 0/38/76/114/152 (36 + 2 gap).
- **spacer 56:161**: flex 1 (285 x 661.8).
- **Account 56:162** (instance of 56:1330, State=Default): 285 x 38 at (20, 974.45); panel bottom padding 20.

### Other variants (only differences)
| Variant | id | Selected |
|---|---|---|
| Page=Generate | 56:171 | "Generate" item |
| Page=Template Builder | 56:266 | "Template Builder" item |
| Page=Insights and Analytics | 56:361 | "Insights & Analytics" item |
| Page=Brand Studio | 56:456 | "Brand Studio" item |
| Page=Settings | 56:551 | **No nav item selected**; Account is State=Settings open (gear 32x32 gets bg `--state-selected`) |
(Generate/Template Builder/Insights/Brand Studio verified by screenshot of the set; Brand Templates + Settings verified in code output.)

### Collapsed sidebar (added 2026-10-04)
The Sidebar set now has a `Collapsed` property. The existing variants are `Collapsed=False`; each page has a `Collapsed=True` twin (for example Template Builder 189:2151, Settings 189:2415):
- Frame 86 wide (inset 10 + a 76 rail), 1053 tall. The rail is the same panel (radius, fill, elevation) with 16 side padding (16.25 drawn).
- Top to bottom: the collapse button (32, `panel-left` 15) centred; the Logo mark (61:467) at 24 x 24, 24 below; the nav, five icon-only Nav items (38 x 36, gap 2; the Nav item's new `Show label` boolean off, the label as a tooltip); the spacer; then the account stacked: the Avatar (38) over the settings button (32, 8 below), the button lit (`--state-selected`) on Settings.
- The theme toggle is not in the collapsed rail.

### Collapsed sidebar? (as first read, before the variant existed)
**None in the file.** Navigation section 54:63 holds only: Nav item set 54:83 (Default 54:75, Hover 96:491, Selected 54:67; 285 x 36), Settings rail item set 54:100 (200 x 36), Sidebar 56:646 (6 Page variants, all 335 wide), Account 56:1330, Logo 54:66, Logo mark 61:467 (20 x 20). No node name contains "collapsed"/"narrow" in the Master UI Elements, Settings or Generate pages; the only "collapse" nodes are the 32x32 header button. The collapse button exists but its collapsed result is not designed (unknown).

## 2. Account 56:1330 (variants 54:101 Default, 56:1320 Settings open)
Description: "Sidebar account block. The gear is an Icon button (Ghost). Settings open selects it while Settings is showing."
- Root: 285 wide (38 tall), flex row, align center, gap `--space-xs` (12).
- Avatar 54:54 (component 54:62, Circle / Large): 38 x 38, radius `--radius-pill`, bg `--surface-sunken`, 1px border `--border-default`; initials "CM" Label/XS `.t-label-xs` (12/1.25, 500) `--text-strong`.
- text 54:104: flex 1, column, overflow clip.
  - name 54:105 "CJ Munafo": Label/S `.t-label-s` (13/1.25, 500), `--text-strong`.
  - email 54:106 "cj@acmehealth.com": Caption/XS `.t-caption-xs` (11/1.3, 400), `--text-secondary`.
- settings button 96:520 (Icon button 95:516, Ghost): 32 x 32, radius `--radius-control` (7), no fill; icon 16 x 16 lucide `settings` (39:89).
- **Settings open (56:1320)**: only change is the gear button (96:526) gets bg `--state-selected` and its icon goes to full ink (per Icon button description "A selected ghost takes state/selected with its icon in full ink"; glyph asset differs between the two states, exact stroke colour token unknown from MCP). Hover `--state-hover`, Pressed `--state-pressed`, focus 1px `--ring` 2px outside.
- **Workspace switcher / role switcher in the sidebar: none.** The sidebar has only header (logo, theme toggle, collapse), 5 nav items, spacer, Account. Workspace switching lives in Settings > Workspace: card "Workspaces" with rows "Acme Health" (meta "Admin · 26 people", status chip "Current") and "Acme Health Foundation" (meta "Admin · 8 people", button "Switch"), plus "Add workspace" button (13:14698). The Settings · Account frames have "stat · Workspace" and "stat · Role" (13:17215/13:17218 on the Dark twin). No Admin/Member toggle anywhere seen. People is a Settings rail item, not a nav item.

## 3. Page header and layout per screen
Common geometry (all frames 1440 wide, sp-nav 0..335, page area `sp-page` x=335 w=1105):
- Content column: left edge x=380 in frame = **45 from sidebar right edge (335)**; width 1015; right padding 45 (to frame edge 1440). No max-width is expressed (frames are fixed 1440); unknown.
- Header top: y=45 (top padding 45). Header row h 36.
- Page title: 30px / 1.2, weight 500, **tracking -0.9px (-0.03em)**, colour raw **#0b0b0c** (unbound fill; value = `--text-strong`), no text style attached. Closest class `.t-title-page` (30/1.2/500) but its tracking token is -0.02em, so tracking differs.
- No eyebrow and no helper/description line on any frame below.

| Frame | id | Title (verbatim) | Title pos in frame | Title→first content | Header actions | Breadcrumb |
|---|---|---|---|---|---|---|
| Brand Templates | 13:5776 | "Brand Templates" (13:5852, 214 x 36) | (380,45) | 24 (filter bar at y=105) | none | none |
| Generate start | 13:1453 | **no page title**; centred greeting "What are we painting today?" (13:1532, 40px/1.2, -1.2px, #0b0b0c, centred in 760 column) | greeting (647,250), 481 x 48; the Start block begins at y=45 | n/a | none | none |
| Insights | 13:832 | "Insights & Analytics" (13:907) | (380,45) | **20** ("gap 20" spacer 13:910, filters at y=101) | right-aligned "Export CSV" (13:908): h36, px16, radius 7, bg `--surface-sunken`, label 14/normal -0.14px #0b0b0c = `.t-control-m` | none |
| Brand Studio | 13:9043 | "Brand Studio" (13:9119) | (380,45) | 24 (setup strip y=105) | none in header ("Upload images" lives in the setup strip) | none |
| Settings Workspace | 13:14570 | "Settings & Admin" (13:14646) | (380,45) | 24 (settings body y=105) | none | none |
| Template chat questions | 13:7064 | **no title**, breadcrumb only | breadcrumb at (380,53) | thread starts y=81 (column at +113) | right group gap 8: "Fill in by hand" (pencil icon, sunken), "Bulk fill" (layout-grid icon, sunken), "Public link" (link icon, bg `--field-green`, label `--accent-green`) | "Brand Templates / Now hiring" |
| Fill page | 156:674 | **no title**, breadcrumb only | (380,53) | 24 (Split/preview y=105) | "Use AI to assist" (Generate sparkles icon, sunken), "Bulk fill" (sunken), "Public link" (green) | "Brand Templates / Now hiring" |

Header action button anatomy (sp-chat-btn / sp-button): h 36, padding 0 16, gap 6, radius 7 (raw), 16px icon, label 14/1.25 -0.14px (= `.t-button-m`), secondary bg `--surface-sunken` + #0b0b0c label, primary bg `--field-green` + `--accent-green` label. Actions group gap 8; vertically centred in the 36 row; right edge at x=1395.

Breadcrumb anatomy (13:7139, 156:749, 13:2714, 13:3434): flex row gap 8, 20 tall, vertically centred in the 36 header (y+8). Parent crumb: link, Label/M `.t-label-m`, `--text-secondary`. Divider "/": Body/S `.t-body-s` (14/1.4, 400), `--text-secondary`. Current crumb: Label/M, raw #0b0b0c.

Generate thread frames (section 13:1452):
- Start 13:1453, Attach menu 13:1601, Connectors 13:1850, Add a detail 13:2140, Photo attached 13:2301, Details added 13:2454: **no header at all** (greeting layout).
- Sent 13:2639, Generating 13:2824, Result 13:2985, Edit 13:3150: header = breadcrumb "Generate / Creative Director post" + right actions "History" (history icon, sunken) and "New chat" (green primary). No title.
- History 13:3359: **stacked** header (13:3433, 64 tall): breadcrumb "Generate / History" (20 tall), gap 8, then title row "History" (30px title) with right "New chat" (green). Content starts 24 below (filter bar at y=133).
- Dark twins 13:3598…13:5536 mirror these.

Other page-level shell items seen:
- "Footer links" row "Terms of Service" · "Privacy Policy" centred at y=1010 (15 tall) on Brand Templates, Brand Studio, Settings, Generate start/Attach/History. Chat frames put them under the composer ("Composer footnote"); Fill page puts them in the preview footer. Insights (1261 tall, scrolling) has none.
- Insights frame is 1261 tall and the sidebar stretches to 1241 (spacer grows): sidebar is full page height in that frame, not viewport-sticky (behaviour unknown).

## 4. Page background and sidebar float
- Page bg `--surface-page` (#f9f9f8 Light; ink-900 Dark). Pixel check at (1400,600) = (249,249,248).
- Sidebar panel floats: inset 10 from top, left and bottom of the frame, **0 on the right** (panel right edge = 335 = page area start); radius `--radius-card` 20; bg `--surface-raised`; Elevation/Small (`--elevation-small`); borders `--border-raised` 0.65/0.25/0.55/0.25 (transparent in Light, paper-075-20 in Dark).
- Panel is 325 wide (285 content + 2 x 20 padding).
- Note: `--state-selected` (#f9f9f8) equals `--surface-page` in Light, so a selected nav item reads as "page colour showing through" the white panel.

## Screen frames vs components (drift)
- Screen frames use detached copies of the sidebar (plain frames named sp-nav / sidebar / account, not instances of 56:646).
- Account gear in non-Settings screens is a bare 18 x 18 "icon" at x=267 (no 32 button). The component has a 32 x 32 button with a 16 icon at x=253. The Settings screen (13:14640 "settings button (selected)") has the 32 button but an 18 icon.
- Settings PageHeader 13:14645 has no "Title row" wrapper; Insights 13:906 has no 45px padding wrapper (it sits at x=45 itself). Geometry is the same.

## 5. Screenshot notes
- 56:76: white floating card, slime logo + black wordmark, grey round sun toggle, panel-left icon; Brand Templates row on off-white pill; account row at bottom with grey CM avatar and a bare gear.
- 56:1330: Default gear bare; Settings open gear sits on a 32 square off-white tile.
- 13:5776 top 300: page bg off-white; "Brand Templates" title at left of content column, no subtitle; 24 below it the platform chip rail (search, All (selected, black), LinkedIn, Instagram, Facebook, Email, Web & Open Graph); shelf heading "Instagram · Facebook · LinkedIn Portrait" with "View all".
- 13:14570 top 300: "Settings & Admin" title; below it the 200 wide settings rail (Workspace selected with a grey fill, People, Integrations, Plan & usage, Sharing…) and a white "Workspaces" card. No nav item is selected in the sidebar; the account gear shows the selected tile.

---

# Part B: the Settings frames

Source: get_metadata 8:678 (parsed), get_design_context 13:14570, 13:14769, sections 13:15178/13:15330/13:15511/13:15776/13:15964, get_variable_defs 13:14769, get_screenshot 1440 of 13:14570 + 13:14769 (saved as scratchpad shot-workspace.png / shot-people.png). Read-only; nothing changed.

## 0. Frame inventory (page 8:678)
Page holds ONE section `13:14569 "Settings"` (10920x2426) with exactly 14 frames, all 1440x1053. **No extra flow frames** (no add-workspace, switch-workspace, invite, remove-member, confirm dialogs, menus, or annotations/notes).

| Section | Light | Dark |
|---|---|---|
| Workspace | 13:14570 | 13:15992 |
| People | 13:14769 | 13:16191 |
| Integrations | 13:15051 | 13:16473 |
| Plan & usage | 13:15203 | 13:16625 |
| Sharing | 13:15384 | 13:16806 |
| Account | 13:15649 | 13:17071 |
| Advanced | 13:15837 | 13:17259 |

Frame names are `Settings · <Section> · Light|Dark`. Dark frames have identical layer structure/card lists to Light (checked by layer name).

## 1. Shell + settings rail

### App sidebar (`sp-nav` 13:14571, 335 wide incl. 10px outer pad; `sidebar` 13:14572 325x1033, radius 20, p 20, gap 24, bg `--surface-raised`, `--elevation-small`, border `--border-raised` 0.65 top/0.25 sides/0.55 bottom)
- header 13:14573: `sp-logo` 148x24 · utility: `sp-theme-toggle` 32 circle `--surface-sunken` (sun icon) + `collapse` 32 (`sp-icon / Sidebar`).
- nav 13:14594 (gap 2, items 36h, px 10, gap 12, radius 7, icon 18, label `.t-label-m` `--text-secondary`), order verbatim:
  1. `Brand Templates` 2. `Generate` 3. `Template Builder` 4. `Insights & Analytics` 5. `Brand Studio`
  - **No "People", no "Settings" item in main nav. No workspace switcher anywhere in the sidebar.** No nav item is selected on Settings frames.
- spacer, then `account` row 13:14634 (gap 12): avatar 38 circle (`--surface-sunken`, 1px border rgba(11,11,12,0.08), initials `CM` 12px label-xs) · text: name `CJ Munafo` (`.t-label-s` 13px) / email `cj@acmehealth.com` (`.t-caption-xs` 11px, `--text-secondary`) · **`settings button (selected)` 13:14640**: 32x32, radius 7, bg `--surface-page` (selected state), gear icon 18. This is the only entry point to Settings in the frames.
- In People frame the whole `account` row (13:14833) is an `<a>` (clickable); in Workspace frame it is a plain div. Unknown which is intended as the click target (row vs gear only).

### Page
- `sp-page · Settings` 13:14644: pt 45, pb 28. `PageHeader` 13:14645 px 45: **title alone**, text `Settings & Admin` (30px/1.2, tracking -0.9px; maps to `.t-title-page`, note token tracking -0.02em = -0.6px vs Figma -0.03em). No subtitle, no actions.
- `Settings content` 13:14647: pt 24, px 45. `Settings body` 13:14648: row, gap 32.
- Footer links 13:14766 centred: `Terms of Service` · `Privacy Policy` (12px caption, `--text-secondary`, gap 16).

### Settings rail `sp-settings-rail` 13:14649
- Position: left column of Settings body, x=45 within page (page starts x=335), y=24 below header; **width 200**, column, gap 2, height 264. Content column (`Section · *`) starts at x=232 in body, flex 1 (783 wide at 1440), gap 24 between cards.
- No heading above the rail (the page title `Settings & Admin` is the only heading).
- Items: 36h, px 10, gap 12, radius 7, icon 18, label 14 `.t-label-m`. Selected: bg `--surface-sunken`, label `#0b0b0c` (text primary/ink-900). Unselected: transparent, label `--text-secondary`.
- Order, labels verbatim, icon (identified visually; layers are just named `icon`):
  1. `Workspace` — building
  2. `People` — two users  **(People IS a rail item)**
  3. `Integrations` — plug
  4. `Plan & usage` — credit card
  5. `Sharing` — link
  6. `Account` — single user
  7. `Advanced` — sliders
- Selected per frame (layer `rail item · X (selected)`): each frame selects its own section (Workspace in 13:14570/13:15992, People in 13:14769/13:16191, and so on). All 14 frames have 7 rail items and `settings button (selected)`.

## 2. Workspace frame 13:14570 (`Section · Workspace` 13:14697)
Cards are `sp-settings-card` (radius 20, p 24, bg white/`--surface-raised`, drop shadow 2/2/4 `--shadow-raised`, bevel insets). Card title 17px/1.25 tracking -0.17 = `.t-title-panel`.

**Card 1 `sp-settings-card · Workspaces` 13:14698** (gap 8)
- header: title `Workspaces` · button `sp-chat-btn · Add workspace` 13:14701 (secondary/chat button: 36h, px 16, radius 7, bg `--surface-sunken`, plus icon 16 + label `Add workspace` 14px `.t-button-m`/control-m).
- list 13:14706, rows py 12, gap 12, 1px divider rgba(11,11,12,0.08) (`--border-default`) between:
  - Row `workspace · Acme Health` 13:14707: tile 32x32 radius 7 `--surface-sunken` + 1px border, initials `AH` · name `Acme Health` (14 label-m) / meta `Admin · 26 people` (12px, `--text-secondary`) · **current marker** `Status · Current` 13:14713: pill (radius 999, px 8 py 3, bg `--surface-sunken`, text `Current` 12px `--text-secondary`).
  - Row `workspace · Acme Health Foundation` 13:14716: tile `AF` · `Acme Health Foundation` / `Admin · 8 people` · button `sp-chat-btn · Switch` 13:14722 (small: 28h, px 10, radius 7, `--surface-sunken`, label `Switch` 12px `.t-button-s`).
- So: workspaces are listed in Settings › Workspace; current one gets a `Current` pill, others a `Switch` button; `Add workspace` in the card header. Meta line shows the viewer's role in that workspace + member count.

**Card 2 `sp-settings-card · Workspace details` 13:14724** (gap 20; fields gap 16, 2-col rows gap 16)
- title `Workspace details`
- Field `Name` → `sp-input` value `Acme Health`
- Field `Slug` → `sp-input` value `acme-health`
- Field `Website` → `sp-input` value `acmehealth.com`
- Field `Timezone` → `sp-select` value `America/Chicago` + chevron 16
- Field anatomy: label 12px label-xs `--text-secondary`, gap 6, input 40h radius 9 (`--radius-control-md`) bg `#f1f1ef` (`--input-bg`), px 12, value `.t-body-s`. No save button shown (unknown: autosave vs explicit).

**Card 3 `sp-settings-card · Brand enforcement` 13:14752**
- title `Brand enforcement`
- row `Fields may override bound type styles` + `sp-switch · off` (36x20)
- row `Allow colors outside the palette` + `sp-switch · on`

**No Canvas sizes section** in either Workspace frame (or any Settings frame). Code's canvas-size settings have no home in the design.

## 3. People frame 13:14769 (`Section · People` 13:14896)
Single card `sp-settings-card · People` 13:14897 (gap 20):
- header: title `People` · right meta `26 people · 3 of 4 admin seats` (12px/1.4, `--text-secondary`).
- invite row 13:14901 (gap 8): `sp-input · Invite email` (flex 1, 40h, placeholder `name@acmehealth.com` in `--text-secondary`) · `sp-select · Invite role` (140w, value `Member`) · primary `sp-button · Invite` (40h, px 18, radius 9, bg `--field-green`, label `Invite` `--accent-green`).
- members list 13:14910, rows py 12 gap 12, dividers between:
  - avatar 32 circle (`--surface-sunken`, border, initials 12px) · text column: name 14 label-m (+ `(you)` in `--text-secondary`, gap 4, on own row) / email 12px `--text-secondary` · `sp-select · Role` 120w x 36h radius 9 bg `#f1f1ef` · `sp-row-menu-trigger` 32x32 radius 7 with `icon · ellipsis` 16.
  - Own row (`CJ Munafo (you)`, `cj@acmehealth.com`): role select `Admin` and ellipsis both **disabled (opacity 0.4)**.
  - Rows verbatim: `Priya Shah` priya@acmehealth.com Admin · `Marcus Lee` marcus@acmehealth.com Admin · `Ana Ruiz` ana@acmehealth.com Member · `Ben Carter` ben@acmehealth.com Member · `Chloe Park` chloe@acmehealth.com Member · `Dana Ortiz` dana@acmehealth.com Member · `Eli Brooks` eli@acmehealth.com Member.
- footer link `Show all 26 people` (14px label-m, underlined, text primary).
- Roles shown: `Admin`, `Member` only. Row-menu contents (e.g. Remove) are **unknown** (no menu frame). No pending-invite state shown.

## 4. Extra frames on 8:678
None. Only the 14 listed frames. No add-workspace, switch, invite, or remove flows exist on this page.

Other sections, for reference (Light ids):
- Integrations 13:15178: card `Figma` + pill `Connected` (field-green/accent-green), buttons `Reconnect`, `Disconnect`, note `Connected by cj@acmehealth.com on Sep 14, 2026`; card `Canva` + pill `Not connected`, button `Connect`.
- Plan & usage 13:15330: `Crew plan` / `$59.99 per month · Renews Oct 14, 2026`, buttons `Cancel plan` (chat-btn), `Upgrade plan` (primary); stats `Admin seats 3 of 4`, `Brands 2 of 3`, `Members Unlimited`. Card `September 2026`: `Exports 1,046`, `Opens 2,318` (`286 via public links`), `Templates used 12`, `Members active 21`. Card `AI usage`: `Requests 412`, `Tokens in 1.2M`, `Tokens out 318.4K`.
- Sharing 13:15511: `Public links` (+ `Show revoked and expired` switch off; table Link/Opens/Last used/Expires; rows with `Active` pill, `Copy`, `Revoke`, ellipsis), `Emergency` (`Revoke all 4 active links`), `Defaults for new links` (`Allow photo uploads` on; `Expires after (days)` = `Never`; `Open limit` = `No limit`).
- Account 13:15776: `Profile` (Display name `CJ Munafo` + edit icon; Email; **Role `Admin`**; **Workspace `Acme Health`**), `Appearance` segmented `System` (selected) / `Light` / `Dark`, `Notifications` (`Invited members accepted`, `Weekly usage digest`, `Public link expiring soon`, all on), standalone button `Sign out` (chat-btn with icon).
- Advanced 13:15964: `Export workspace data` + primary `Export as JSON` (icon); `Transfer ownership` select `Choose a member…` + primary `Transfer` (disabled); `Delete workspace` + destructive `Delete this workspace` (bg `--state-error`, text `--text-inverse`).

## 5. Member (non-admin) visibility
**Unknown / not specified.** No frame, annotation, or layer depicts a non-admin view; every frame shows CJ as `Admin`. Text hits for admin/member/role are content only: `Admin · 26 people`, `Admin · 8 people` (Workspaces rows), `26 people · 3 of 4 admin seats`, role selects `Admin`/`Member`, `Invite role` default `Member`, `Admin seats 3 of 4`, `Members Unlimited`, `Members active`, Account `Role Admin`, `Invited members accepted`, `Choose a member…`. Page title `Settings & Admin` implies admin content lives here but nothing says which rail items a member sees.

## 6. Screenshots (1440x1053)
- 13:14570 Workspace Light: warm off-white page; white rounded sidebar left with logo, theme/collapse buttons, 5 nav items, account row at bottom with gear button highlighted. Large `Settings & Admin` title top-left of content; below it, 200px rail with `Workspace` highlighted in a grey pill. Right column stacks three white cards: Workspaces (two rows, AH with grey `Current` pill, AF with grey `Switch` button, `+ Add workspace` grey button top right), Workspace details (2x2 grid of grey filled inputs, timezone has chevron), Brand enforcement (two switch rows, first off grey, second on black). Footer links centred at bottom.
- 13:14769 People Light: same shell, rail `People` highlighted. One tall white card: `People` title with right-aligned `26 people · 3 of 4 admin seats`; invite row (wide grey email input, `Member` select, dark-green `Invite` button with bright green text); 8 member rows with circular initials avatars, name/email, grey role select (first row's select and ellipsis faded), ellipsis button; underlined `Show all 26 people` at bottom.

## Token mapping (Figma → tokens.css)
`--surface-page` #f9f9f8 · `--surface-raised` white · `--surface-sunken` #ececec · `--text-secondary` #636363 · text `#0b0b0c` hardcoded in Figma (= `--ink-900`; code's `--text-primary` is ink-750 #272727, Figma var `--text-primary` also #272727 but not applied to these labels) · input fill `#f1f1ef` = `--input-bg` · divider rgba(11,11,12,0.08) ≈ `--border-default` (ink-750 8%) · `--field-green` / `--accent-green` primary button · `--state-error` / `--text-inverse` destructive · Elevation/Small = `--elevation-small` (cards use a 2/2/4 drop-shadow variant) · radii 20 `--radius-card`, 9 `--radius-control-md`, 7 `--radius-control`, 999 `--radius-pill`.
Text styles: Label/M → `.t-label-m`; Label/S → `.t-label-s`; Label/XS → `.t-label-xs`; Caption/XS → `.t-caption-xs`; Body/S → `.t-body-s`; card title 17px → `.t-title-panel`; page title → `.t-title-page`; buttons 14 → `.t-button-m`, 12 → `.t-button-s`. Figma font is Raveo Display; code `--font-ui` is "Raveo Platform", "Raveo Display".
