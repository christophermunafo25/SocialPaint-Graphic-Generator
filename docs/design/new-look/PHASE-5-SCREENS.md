# New look, Phase 5: screen reference

Read from the Figma file "Master UX-UI" (`mEJRslarcQDkgPeY6AObi5`), page "Generate" (8:674, section 13:1452), on 2026-10-04, read only. `PHASE-5.md` builds from this file; where the live file disagrees, the file wins, and `PHASE-5.md` §8 and §9 rule on what the file leaves open.

Reference images (1x, Light) in `reference/`: `generate-start.png`, `generate-attach-menu.png`, `generate-connectors.png`, `generate-add-detail.png`, `generate-photo-attached.png`, `generate-details-added.png`, `generate-sent.png`, `generate-generating.png`, `generate-result.png`, `generate-edit.png`, `generate-history.png`.

None of the eleven frames uses Master component instances: every part is a plain frame. The mappings to primitives below are by look and measurement.

Contents: Part A, Start and the attach menu; Part B, the composer's states and the thread while it builds; Part C, Result, Edit and History. Each part ends with its behaviour differences against today's code, the interactions the frames drop, and its open questions, which `PHASE-5.md` §9 turns into decisions.

---

# Part A: Start, Attach menu, Connectors, Add a detail

Source: Figma "Master UX-UI" (mEJRslarcQDkgPeY6AObi5), page "Generate", section 13:1452. All frames 1440×1053. Sidebar ignored (shell already built).

| Frame | Light | Dark | Screenshot (Light, 1440) |
|---|---|---|---|
| Generate · Start | 13:1453 | 13:3598 | `generate-start.png` |
| Generate · Attach menu | 13:1601 | 13:3746 | `generate-attach-menu.png` |
| Generate · Connectors | 13:1850 | 13:3995 | `generate-connectors.png` |
| Generate · Add a detail | 13:2140 | 13:4285 | `generate-add-detail.png` |

Read this first:

- **No Master instances in any frame.** The composer is a plain frame (`sp-chat-box`). The attach menu (`sp-attach-menu`), the connectors menu (`sp-connectors-menu`), the detail panel (`Add · Date & time`) and the recent cards (`sp-recent-card · …`) are plain frames too. The only instance is the hidden `Gradient glow · Green (off)`. Its measurements and fills match the Master components below, so build on the primitives and treat the frames as compositions of them.
- The three overlay frames share the Start frame's layout. Each adds a floating panel. In every overlay frame, `Recent` (the whole section) carries a **layer blur of 1.5px** (`blur-[1.5px]` on 13:1708 / 13:1957 / 13:2247). The composer and greeting are not blurred.
- Light menus use a raw `white` fill (= `--surface-raised`). Item labels use raw `#0b0b0c` (= `--text-strong`). Dark binds item labels to `text/primary` (#f1f1f1), which has the same value as `--text-strong` in Dark. Use `--text-strong` throughout.

---

## 1. Generate · Start (13:1453)

### Page layout (`sp-page · Generate` 13:1526, 1105 wide)
- Column. Padding top 45, x 45, bottom 28. Gap 30 between the `Start` area and `Footer links`.
- `Start` (13:1527): fills the height, column, items centred, justify centre, padding-bottom 80, radius 32 (no fill).
  - Hidden child: `Gradient glow · Green (off)` instance (975×376 at 20,89). It is off; ignore it.
  - `Start column` (13:1529): 760 wide, column, gap **75**, items centred, justify end.
    1. `Group 9`: the greeting with the composer 35 below it. The greeting box is 48 tall (y 217); the composer starts at y 300. The greeting is centred over the composer.
    2. `Recent` (13:1560), 75 below the composer box.
- `Footer links` (13:1598): row, gap 16, centred. Text is 12 Regular / 1.25 (Caption/S → `.t-caption-s`), `--text-secondary`, **not underlined**. The two links read "Terms of Service" and "Privacy Policy".

### Greeting (13:1532)
- "What are we painting today?"
- 40px Medium, line-height 1.2, tracking −1.2px (−0.03em), centred, `--text-strong`. The frame has no text style.
  - Nearest class: `.t-title-metric` (40 / 1.1 / −0.03em). Size and tracking match; leading is 1.1, not 1.2. `.t-title-display` is 44px. See Open questions.
- **No sub-line.** Today's "Describe it and I'll build it from your templates, already on brand." is absent.

### Composer (`sp-chat-box` 13:1533 = Master **Composer 61:504**)
- 760 wide, 110 tall. Fill `--surface-raised`, radius 20.
  - Stroke 5px outside. Light: raw `rgba(255,255,255,0.25)`. Dark: `rgba(255,255,255,0.06)`. The Master binds this stroke to `--border-raised`.
  - Shadow Elevation/Small (`--elevation-small`).
  - Column, gap 30, padding 20 / 12 / 12 / 20.
- `input` (13:1534): placeholder "Describe the post. Add any dates, names, or links it needs." Trimmed/Body/L → `.t-body-l .t-trim`, `--text-secondary`, full width. One line, so no 64px empty floor.
- `toolbar` (13:1535): row, gap 12, items end.
  - `inputs` (fills the width): row, gap 6, padding y 4.
    - `sp-plus` = **Attach button** (44:10 / set 102:569). 28×28, `--surface-inverse`, radius 7 (`--radius-control`), plus icon 14.
    - `Tags`: an empty frame, 28 tall, fills the width. The Composer description says "Detail tags go in the Tags row."
  - `output` (hug): row, gap 6, items centred.
    - `Platform` = **Compact select** (99:568). 105×28, `--surface-sunken`, radius 7, padding l 9 / r 6, gap 6. Label "Any platform" is Button/S (`.t-button-s`, 12 Medium / 1.3 / −1%) in `--text-strong`, then chevron-down 16.
    - `Variations` = **Stepper** (100:545). 147×28, `--surface-sunken`, radius 7, padding l 9 / r 3, gap 6. Label "Variations" (`.t-button-s`). Inside:
      - Decrease: 28 circle, minus 16, **opacity 0.32 (disabled)**.
      - value "1": a 20×28 box, `.t-button-s`, centred.
      - Increase: 28 circle, plus 16.
    - `sp-send` = **Send button** (44:9). 36×36, `--accent-green`, pill, arrow-up 16.
- There is **no Start from row** under the composer and **no library-empty note**.

### Recent (13:1560)
- 760 wide, column, gap 12.
- Header (13:1561): row, space-between, padding-left 4, 32 tall.
  - "Recent": 17 Medium / 1.25 / −0.17px → `.t-title-panel`, `--text-strong`.
  - "View all": in a 32-tall box with padding x 8. 14 Medium / 1.25 → `.t-label-m`, `--text-strong`, **underlined**.
- Grid (13:1565): **3 columns**, gap 12 / 12. It holds 4 cards, so it wraps to 2 rows (3 + 1).
- `sp-recent-card` (245.33×169): `--surface-raised`, radius 20, padding 8, Elevation/Small, column.
  - `thumbnail`: full width, 104 tall, `--surface-sunken`, radius 15. In the mock it holds a 13px headline and a logo; in the build this is the draft preview.
  - `meta`: padding t 10 / b 4 / x 6, gap 2, both lines truncate.
    - Title: Label/M (`.t-label-m`), `--text-strong`.
    - Meta: Caption/S (`.t-caption-s`), `--text-secondary`.
  - Sample cards:

    | Title | Meta |
    |---|---|
    | No more waiting in the design queue | LinkedIn · Yesterday |
    | Every location, one look | LinkedIn · Sep 22 |
    | Give your brand a canvas | LinkedIn · Sep 19 |
    | Brand rules that stick around | LinkedIn · Sep 16 |

---

## 2. Generate · Attach menu (13:1601)

Same page as Start, plus `sp-attach-menu` (13:1746), with Recent blurred 1.5px.

### Placement
- 300×473, at Start-frame coords x 149, y 408.
- The composer box spans y 288–398, so the menu's top is **10 below the composer box** (5 below its 5px outer stroke) and 26 below the bottom of the plus. Its left edge is 1.5px right of the plus's left edge.
- Today's code puts the menu 8 below the plus, so it overlaps the composer's lower edge (see Behaviour).

### Panel
- Padding 6, column, gap 2, radius 16 (`--radius-menu`).
- Fill: Light `white` / Dark `--surface-raised` (#171819). Use `--surface-raised`.
- Effect Elevation/Medium (`--elevation-medium`: bevels plus 4/4/16 `--shadow-raised`). Codegen printed a 4/4/8 drop-shadow, but the named style is Medium.
- No stroke.

### Section labels (`sp-menu-label`)
- Padding t 10 / l 10 / b 6.
- Text is 12 Medium, line-height 1.4, **tracking 0.96px (0.08em)**, trimmed, `--text-secondary`, uppercase literal text. No style is bound.
- The `MenuLabel` primitive uses `.t-label-xs .t-trim`, which has tracking 0. The frame needs +0.08em (see Open questions).

### Items
Each item is 288×34. Padding l 10 / r 8 / y 8, gap 10, radius 7.
- Icon: 18.
- Label: Trimmed/Body/S → `.t-body-s .t-trim`, `--text-strong`, flex 1.
- Chevron: 16, where shown.
- Each item also holds a hidden `meta` text and, where noted below, a hidden chevron. This is the Master **Menu item** (96:507) anatomy: showMeta / showChevron.

| Section | Item | Icon (lucide look) | Chevron | Proto link |
|---|---|---|---|---|
| UPLOAD | Photo | `sp-icon / Photo` (image) | hidden | yes (no target) |
| UPLOAD | File | file-text | hidden | no |
| divider | | | | |
| DETAILS | Headline | type (T) | yes | yes |
| DETAILS | Date & time | calendar | yes | yes |
| DETAILS | Location | map-pin | yes | yes |
| DETAILS | Link | link | yes | yes |
| divider | | | | |
| CONTEXT | Web page | globe | yes | no |
| CONTEXT | Brand Studio | Brand Studio glyph (pen-tool/ruler) | yes | **→ Brand Studio page (13:9043 Light / 13:9176 Dark)** |
| CONTEXT | Past post | clock | yes | no |
| CONTEXT | Connectors | plug | yes | yes (→ Connectors frame) |

- Dividers: 288×9, padding 4 around a 1px line. Light `rgba(11,11,12,0.08)`, Dark `rgba(255,255,255,0.08)`. Use `--border-default`; Light is `--ink-750-08`, close enough.
- **No hover/selected state is drawn in this frame.**

---

## 3. Generate · Connectors (13:1850)

The Attach menu stays open, with **Connectors in its hover/active look**. A second panel, `sp-connectors-menu` (13:2096), opens to its right. Recent is blurred 1.5px.

### The open parent row (13:2086, "item · Connectors")
- Fill: Light `#f1f1ef` (raw; equals `--input-bg` / `--control-track`), Dark `rgba(255,255,255,0.08)`.
- Neither value is `--state-hover` (Light ink-900 at 5%, Dark white at 6%) or `--state-selected` (Light #f9f9f8). The Master Menu item says Hover = `--state-hover`, and an open submenu parent is "selected" per the file's state rules ("Open menus … count as selected"). See Open questions.

### Submenu placement
- 260×192, at x 454.5, y 770.5.
- That is **5.5 to the right of the attach menu's right edge** (149 + 300 = 449). Vertically it centres on the Connectors row: the row spans y 841–875 (centre 858), the submenu centre is ≈866.
- Its bottom (962.5) runs past the attach menu's bottom (881) and reaches the footer links.
- It is a **cascading submenu to the right**, not a replacement view.

### Panel
Same recipe as the attach menu: padding 6, gap 2, radius 16, Elevation/Medium.
- Light fill `white`.
- Dark fill **`--surface-sunken`** (#2f3133) with a **5px `rgba(255,255,255,0.06)` stroke**. The Dark attach menu, by contrast, is `--surface-raised` with no stroke.

### Contents
- Label "CONNECTORS" (menu-label recipe).
- **Google Drive**: cloud icon 18; label `.t-body-s`.
  - Status pill "Connected": padding 3 / 8, pill radius. Light fill `--field-green` (= `--status-positive-bg`), Dark `--surface-sunken` (= Dark `--status-positive-bg`). Text 12 Medium, leading normal, trimmed, `--accent-green`.
  - Then a chevron 16.
  - This matches the **Status** primitive, tone `positive` (52:51), but is 15 tall where the primitive is 21 (default) or 17 (sm).
- **Notion**: notebook icon; label; meta "Connect" (`.t-caption-s .t-trim`, `--text-secondary`); no chevron.
- **Dropbox**: package/box icon; label; meta "Connect"; no chevron.
- Divider.
- **Browse connectors**: plug icon; label; chevron.

Item widths are 248, with the same padding as the attach menu items.

Icons are generic line icons, not brand marks.

### States shown
- Connected: green Status pill plus a chevron, so it presumably opens a file browser.
- Not connected: "Connect" meta and no chevron, so presumably it starts OAuth.
- No loading, error or hover states are drawn.

---

## 4. Generate · Add a detail (13:2140)

The attach menu is **replaced in place** by `Add · Date & time` (13:2285): 300×132 at x 149, y 409 (the menu sat at y 408). Recent is not blurred in this frame's metadata (13:2247). The screenshot shows Recent blurred, so assume it carries the same 1.5px blur as the other overlay frames; verify when building.

### Panel
- Padding t 9 / x 6 / b 6, column, gap 2, radius 16, overflow clip.
- Light fill `white`, no stroke.
- Dark fill `--surface-raised` with a **5px `rgba(255,255,255,0.06)` stroke**.
- Effect Elevation/Medium (`shadow 4/4/16`).

### Header (13:2286)
- Row, gap 6, padding l 4 / y 4.
- `icon · back`: chevron-left 18, a clickable link.
- Title "Date & time": 14 Medium / 1.25, trimmed → `.t-label-m .t-trim`, `--text-strong`.

### Body (13:2290)
- Column, gap 10, padding t 4 / x 6 / b 6.
- `sp-input` (13:2291): 276×40, padding x 12, radius 9.
  - Fill Light `#f1f1ef`, Dark `rgba(241,241,241,0.08)`. This is **`--input-bg`** (input/fill).
  - The value "Oct 31, 5:00 PM" is Body/S (`.t-body-s`), `--text-strong`.
  - It is drawn as a plain text field holding a typed value: no date picker and no placeholder state are shown.
- Footer: row, justify end.
  - `sp-button · Add`: h 29, padding x 14, radius 7.
  - Light: `--field-green` fill with `--accent-green` label. Dark: inverted (`--accent-green` fill, `--field-green` label). This is **`--btn-primary-bg` / `--btn-primary-fg`** (Button primary).
  - Label "Add": 14 Medium, −0.14px → `.t-button-m`.
  - Its hidden icon slot (16) is off.
  - 29 tall matches neither Button `sm` (28, px 10) nor `default` (36, px 16).

### What the frame does NOT show
- No detail tag in the composer's `Tags` row: it is still empty in this frame.
- What a tag looks like comes from the Master **Detail tag** (61:464), PHASE-2-COMPONENTS §5:
  - Editable: 28 tall, pill, `--surface-page` fill, padding l 9 / r 6, gap 6, optional 15px lead icon (globe for links), `.t-caption-s .t-trim` in `--tag-detail-fg`, and a 14px x remove button.
  - Hover adds `--state-hover`.
  - Sent (inside the Message bubble 61:505): `--tag-sent-bg`, 0.75px `--tag-sent-border`, no x.
  - Master samples: "Come paint with us", "Oct 31, 5:00 PM", "Remote", "socialpaint.ai/careers" (globe). These map to Headline, Date & time, Location and Link.

---

## Dark differences (beyond token flips)

1. **Menu surfaces are inconsistent across Dark frames.**
   - Attach menu (13:3891, 13:4140): `--surface-raised`, no stroke, bevels visible (`--bevel-top`/`--bevel-bottom` are 15% / 10% white in Dark).
   - Connectors submenu (13:4241): **`--surface-sunken`** with a **5px `rgba(255,255,255,.06)` stroke**.
   - Add-a-detail panel (13:4430): `--surface-raised` **with** the 5px .06 stroke.
   - Light menus have no stroke.
2. **Composer stroke.** Light uses raw `rgba(255,255,255,.25)`, Dark raw `rgba(255,255,255,.06)`. The Master binds `--border-raised` (Light transparent, Dark `paper-075-20`). The frames override it with raw values.
3. **Add button inverts.** Light is moss fill with slime text; Dark is slime fill with moss text. This is already what `--btn-primary-*` does per mode.
4. **Connected pill.** Light fill is deep moss; Dark fill is `--surface-sunken` with slime text. `--status-positive-bg` already flips this way.
5. **Open parent row (Connectors).** Light `#f1f1ef`, Dark `rgba(255,255,255,.08)`. Neither is a state token.
6. **Input fill.** Dark `rgba(241,241,241,.08)` = Dark `--input-bg`. This is a token flip.
7. **Attach button** turns white with a dark glyph (`--surface-inverse` flip). This is a token flip.
8. Dark labels bind `text/primary`, Light uses raw `#0b0b0c`. The values match `--text-strong` in both modes.
9. Shadow `--shadow-raised` is 15% black in Dark. This is a token flip.

There are no layout, copy or structure differences between the twins.

---

## Primitives used / not yet primitives

**Use as is (Phase 2 primitives in `src/app/components/primitives`):**
- **Composer.** Compose `ui-composer` / `ChatComposer` (chat/ChatComposer.tsx). It already draws Composer 61:504 for the template chat. Generate needs the select and stepper added in `output`, and the Tags row filled.
- `AttachButton` (44:10 / 102:569). Description: "Composer attach. Opens the attach menu. Its fill flips between modes (surface/inverse), so Hover adds state/hover-inverse and Pressed state/pressed-inverse. Keyboard focus draws a 1px focus/ring 2px outside the edge…".
- `CompactSelect` (99:568). Description: "The 28 tall picker inside the composer, like Any platform. It sits inside a raised surface, so it uses surface/sunken. Hover adds state/hover. Open holds state/pressed while the menu shows…".
- `Stepper` + `StepperButton` (100:545 / 100:544).
  - Stepper: "A count picker inside the composer, like Variations… Decrease and Increase are exposed Stepper buttons".
  - Stepper button: "Disabled is 32% opacity, as in the composer when the count is at its limit."
- `SendButton` (44:9). Description: "Composer send. Stop shows while a run is in progress. Slime in both modes, so Hover adds state/hover-on-color…".
- `MenuItem` / `MenuItemStatic`, `MenuLabel` / `MenuLabelStatic`, `MenuDivider`, `MenuPanel` (Menu 57:423, Menu item 96:507).
  - Menu: "Drop Menu items, labels and dividers into the Items slot. The row menu has no icons; the attach menu adds them."
  - Menu item has `meta`, `chevron` and `selected` props, which cover the "Connect" meta and the chevrons.
- `Status` tone `positive` (52:51) for "Connected".
- `Button` kind `primary` for Add (size mismatch: see Open questions).
- `Input` (Field.tsx, `--input-bg`) for the detail value.
- `DetailTag` (61:464) for the Tags row. Description: "A detail added to the composer. Editable shows the remove button and Hover adds state/hover. Sent is how it reads inside a sent message. Keyboard focus lands on the remove button, 1px ring 2px outside its edge."
- Card recipe (`--surface-raised`, radius 20, `--elevation-small`) for recent cards.

**Not components in the file (frame-only; build them as page or feature parts):**
- `sp-attach-menu` as a whole (sections, order, widths 300/288). Today's AttachMenu is a custom portaled menu, not the Radix `Menu`, because it opens native file pickers and must stay attached to the composer. Keep it custom, but draw rows with `MenuItemStatic` / `MenuLabelStatic` / `MenuDivider` styles.
- **Cascading submenu** (`sp-connectors-menu`). The `Menu` primitive has no submenu support. Radix DropdownMenu.Sub exists, but AttachMenu is not Radix.
- **Detail sub-panel** (`Add · Date & time`): a header with back, an input and an Add footer, replacing the menu in place. Not a Master component. A legacy equivalent existed before abba389 (see below).
- `sp-recent-card` (Master "Result card" / "Look tile" are not used here). The existing `RecentCard` holds it.
- Greeting heading (no style bound) and footer links.
- Background blur of Recent while a menu is open.
- `Gradient glow · Green (off)`: an instance, hidden.

---

## Behaviour differences vs code

Code read: `GeneratePage.tsx` (GenerateChat, Start branch at ~L1100), `Composer.tsx`, `AttachMenu.tsx`, `PlatformSelect.tsx`, `VariationsStepper.tsx`, `RecentChats.tsx`, `RecentCard.tsx`, `SuggestionChip.tsx`, `DetailTag.tsx`, `lib/generate/details.ts`, `chat/ChatComposer.tsx`, and git `abba389`.

### Start page
1. **Sub-line removed.** The code shows "Describe it and I'll build it from your templates, already on brand." under the greeting. The frame has no sub-line.
2. **Start from row removed.** The code shows up to 5 `SuggestionChip`s labelled "Start from" (the most recent published templates, the hinted one first). They toggle a pinned template, which changes the placeholder to "Describe your {name} post…" and sends `templateIdHint`. The frame has none. See *Interactions the frames drop*.
3. **Library-empty note removed.** The code shows "No published templates yet, so drafts come fresh from your brand kit." The frame has none.
4. **Variations default.** The code's `DEFAULT_VARIATIONS = 2` (range 1–3). The frame shows **1** with Decrease disabled. Either the default changes to 1, or the frame is just a sample.
5. **Variations roll animation.** The code's `VariationsStepper` rolls the number with an overshoot animation (Web Animations), and its bound buttons stay focusable (`aria-disabled`). The `Stepper` primitive has no roll and uses `disabled` (focus drops at the limit). Moving to the primitive loses both unless they are ported.
6. **Platform select.**
   - The code's menu lists "Any platform" with a globe, then each platform with its mark.
   - It **dims platforms the library doesn't cover** and adds a caption: "Dimmed platforms have no published templates yet…".
   - The frame shows only the closed trigger. `CompactSelect` supports `dimmed` and `menuCaption`, so keep them.
7. **Recent grid.**
   - The code uses **4 columns** (2 under 768px), 4 cards, 56 below whatever sits above.
   - The frame uses **3 columns** with 4 cards (wrapping to 3 + 1), 75 below the composer.
   - The code hides the whole section when there are no chats or the read fails. The frame doesn't show the empty state; keep hiding.
8. **Greeting-to-composer gap.** 28 in the code, 35 in the frame. The title is 26px in the code, 40px in the frame.
9. **Empty composer height.** The Large composer has a 64px textarea floor when empty. The frame's composer is 110 total with a one-line input. `ui-composer` already matches the frame.
10. **Legal links.** The frame draws them without an underline; `LegalLinks` underlines them.
11. **Unavailable backend state.** The code shows the "Generate isn't available on this backend" empty state instead of the composer. The frame doesn't cover it; keep it.
12. **Start column reveal.** The code holds the column hidden for up to 400ms until Recent settles. The frame doesn't cover this; keep it.

### Attach menu
13. **Sections.** Today there is one UPLOAD section: Photo, File, and Brand Studio (Brand Studio only when there are pickable brand assets). The frame has **three sections**:
    - UPLOAD: Photo, File.
    - DETAILS: Headline, Date & time, Location, Link.
    - CONTEXT: Web page, Brand Studio, Past post, Connectors.
14. **Brand Studio moves and changes meaning.**
    - Today it is an UPLOAD row that opens `ImageSourceDialog` ("Choose from Brand Studio") to attach a brand image as the photo.
    - In the frame it sits under CONTEXT with a chevron, and its prototype link goes to the **Brand Studio page**. That suggests "use Brand Studio as context" or a submenu, not a photo picker. Unresolved.
15. **New rows with no backing code:**
    - DETAILS (all four).
    - Web page: the repo has `brandFromWebsite` / the `brand-from-website` function for onboarding only. Nothing reads a URL into a Generate brief.
    - Past post: no picker for previous chats or drafts as context.
    - Connectors: no Google Drive, Notion or Dropbox integration anywhere. Only Figma and Canva connections exist.
16. **Chevrons.** Every DETAILS and CONTEXT row has a chevron, meaning each opens a sub-view or submenu. Today no row has a chevron.
17. **Placement.** Today the menu sits 8 below the plus (overlapping the composer's bottom 16px), flips above the composer when there's no room, caps its height to the room and scrolls. The frame puts it 10 below the composer box. The new menu is 473 tall, so it will hit the flip/scroll rules far more often, especially in the docked thread composer.
18. **Background blur.** The frame blurs Recent (1.5px) while a menu is open. Today nothing is blurred and there is no scrim.
19. **Tooltip.** Today the plus has the tooltip "Add photos and files". With Details and Context in the menu, that copy undersells it. The frame shows no tooltip.

### Connectors
20. The Connectors row opens a **cascading submenu to the right** listing Google Drive, Notion and Dropbox, then Browse connectors.
    - States: Connected (green "Connected" Status plus a chevron) and not connected ("Connect" meta, no chevron).
    - The parent row holds its highlight while the submenu is open.
    - Today nothing like it exists: no integrations, OAuth, file browsing or "Browse connectors" destination. This is a whole feature, not a restyle.

### Add a detail
21. **Flow.** Choosing a DETAILS row (here Date & time) **replaces the menu in place** with a panel: back chevron, the row's name as title, a text input, and Add (Button primary). Back presumably returns to the menu. After Add, the Composer description implies a **Detail tag lands in the composer's Tags row**, beside the Attach button in the toolbar. No frame here shows the result.
22. **What existed before.** Until `abba389` (2026-09-30, "Template chat asks for each field instead of a plus-menu Details section"), the template chat's AttachMenu had this exact pattern:
    - A DETAILS section of template fields with glyphs (link / calendar / location / headline), "Optional" meta and a chevron.
    - A row opened "the detail popover in the menu's place: a back button and the field's label, the input (a select for a select field), and Add".
    - Enter or Add made a tag; back returned to the menu; Escape closed both and returned focus to the plus; an empty entry could not be added.
    - Tags sat beside the plus and **clicking a tag reopened its popover pre-filled** for editing; its x removed it.
    - It was removed for the interview flow. The legacy `DetailTag.tsx` (with `onEdit`) and `lib/generate/details.ts` (`DetailKind` link/date/place/text, `detailKindOf`, `upsertDetail`) are still in the repo. They are used by `UserMessage`, `FillInRow`, `interview.ts` and dev sheets.
23. **Today's Generate has no detail UI at all.** `ChatTurn.details` exists only for template chats.
    - The server rejects details without a template: `template-generate/index.ts` L924 throws "details need a templateIdHint and library mode."
    - Details are keyed by a **template fieldKey** (`resolveDetails(detailInputs, candidates[0])`).
    - The frame's fixed list (Headline / Date & time / Location / Link) is **template-agnostic**. Generic details for Generate therefore need a **server change**: a new detail shape (kind + value, not fieldKey) and prompt handling for library and freestyle runs. This is not a UI-only change.
24. **Tag editing.** The `DetailTag` primitive (61:464) has only remove: no click-to-edit, no `aria-expanded`. The legacy tag reopened its popover on click. The Master shows no edit affordance.
25. **Input kind.** The frame shows a plain text input for Date & time ("Oct 31, 5:00 PM"), with no picker or validation. Location and Link would be plain text inputs too. Link tags lead with a globe (Master Detail tag sample).
26. **Attachments row not drawn.** Today a photo thumbnail or document chip shows in an attachments row above the text, plus the upload chip while reading. The frame's composer has only the Tags row in the toolbar and draws no attachment state. Where photos and files show in the new composer is unspecified. `ChatComposer` keeps the attachments row above the text.

---

## Interactions the frames drop

Flag each to CJ before building. Per memory, CJ dislikes losing familiar interactions.

1. **Start from chips** (pin a recent published template for the next send, toggle on and off, with the pinned placeholder copy). This is the only one-click way to steer Generate to a template from the Start page. The "Use this one" hint from a template card also arrives as a pinned chip (`templateIdHint`). Without the row, that hint has no visible home.
2. **Greeting sub-line** (explains that drafts come from your templates, on brand).
3. **Library-empty note** (explains freestyle when no templates are published).
4. **Brand Studio image pick from the attach menu.** Today: attach a brand logo or image as the photo via the dialog. In the frame, Brand Studio is a CONTEXT row going elsewhere, and UPLOAD has only Photo and File.
5. **Variations roll animation and focusable bound buttons** (if the primitive Stepper replaces VariationsStepper as is).
6. **Variations default of 2** (if the frame's 1 is taken literally).
7. **Recent 4-across row** (becomes 3-across, wrapping the 4th card onto a second row; this changes the Start page height).
8. **Tag click-to-edit** (legacy DetailTag). The Master DetailTag only removes. This is relevant if Details come back.
9. **Underlined legal links** (minor).

Not dropped, but undrawn (keep as is): drag-and-drop and paste of photos onto the composer, Enter to send / Shift+Enter, Stop, auto-grow to 6 lines, platform dimming plus caption, the unavailable-backend empty state, the unsaved-chat note, the 400ms reveal, keyboard menu semantics (arrows, Home/End, Escape, Tab), and ArrowUp/ArrowDown on the closed plus.

---

## Open questions

1. **Start from.** Drop it as the frame shows, or keep it (it is the template-pin path, and "Use this one" depends on it)? If kept, where: under the composer as today?
2. **Variations default.** 1 (frame) or 2 (code)? The roll animation: port it into the primitive Stepper, or drop it?
3. **DETAILS for Generate.** Fixed generic kinds (Headline / Date & time / Location / Link) need a new server detail shape, because today details need a template and a fieldKey.
   - Is that in Phase 5 scope, or should the DETAILS section be hidden or stubbed for now?
   - For freestyle runs, how should a "Headline" detail be honoured?
4. **Web page / Past post / Connectors / Brand Studio (CONTEXT).** All are new features with no backend.
   - Ship them in Phase 5 (and to what depth), or hide rows that don't work yet?
   - Which connectors are real (Google Drive, Notion, Dropbox)? What does Browse connectors open (Settings › Integrations?)?
   - What does a connected connector's chevron open (a file browser)?
5. **Brand Studio row.**
   - Keep today's "attach a brand image" behaviour (in UPLOAD, as today, or under CONTEXT)?
   - Or make it "use brand context", or navigate to Brand Studio as the prototype link suggests?
6. **Tags row behaviour.** Do tags wrap the toolbar onto more lines, or scroll? Can a tag be clicked to edit (legacy) or only removed (Master)? Is there one tag per kind (upsert, as legacy) or several?
7. **Detail inputs.** Is Date & time a free-text field (frame) or a date/time picker? Is Link validated as a URL? What placeholder and empty-state copy should each field use (none drawn)?
8. **Attachments.** Where do the photo thumbnail and document chip go in the new composer: above the text as today, or as tags in the Tags row?
9. **Open-parent fill.** Should Connectors-open use `--state-selected`, `--state-hover`, or the raw values drawn (Light #f1f1ef = `--input-bg`, Dark white 8%)?
10. **Dark menu surfaces.** Should the submenu and the detail panel follow the attach menu (`--surface-raised`, no stroke)? Or should all floating panels get the 5px white 6% stroke? The frames disagree.
11. **Composer stroke.** Should the raw 25% / 6% white 5px stroke replace `--border-raised` (Light transparent, Dark 20%)?
12. **Menu label tracking.** Should the 0.08em tracking (frame) go into `MenuLabel`, or keep the primitive's 0?
13. **Greeting type.** Is 40 / 1.2 / −0.03em an approved `.t-title-metric` with 1.1 leading, or does it need a new class? Should "Recent" use `.t-title-panel` (exact)?
14. **Add button size** (29 tall, px 14). Use `sm` (28 / px 10) or `default` (36 / px 16), or add a size?
15. **Connected pill height.** 15 in the frame vs `Status` 21 / 17. Accept `sm`?
16. **Background blur.** Implement the 1.5px blur of the page content under open menus (and should the composer stay sharp)? There is no scrim in the frames.
17. **Menu placement.** Should it sit 10 below the composer (frame) instead of 8 below the plus? With 473px of height, what is the flip/scroll behaviour in the docked thread composer?
18. **Plus tooltip copy.** "Add photos and files" no longer describes the menu. Change it?

---

# Part B: Photo attached, Details added, Sent, Generating

Figma file `mEJRslarcQDkgPeY6AObi5` ("Master UX-UI"), page "Generate" 8:674, section 13:1452. All frames 1440 x 1053. Sidebar ignored (shell built).

Light screenshots (1440 wide) in this folder: `generate-photo-attached.png` (13:2301), `generate-details-added.png` (13:2454), `generate-sent.png` (13:2639), `generate-generating.png` (13:2824).

Conventions below: Light hex -> token. `#0b0b0c` = `--text-strong`; `#636363` = `--text-secondary`; `#ececec` = `--surface-sunken` (= `--control-fill` in Light); white = `--surface-raised`; `#f9f9f8` = `--surface-page`; `#17ff7e` = `--accent-green`; `#082a23` = `--field-green`; `#d1d1d1` = `--tag-sent-bg`; `rgba(11,11,12,.65)` = `--tag-detail-fg`; `rgba(11,11,12,.75)` = `--tag-sent-fg`.

Type map used throughout (Figma style -> repo class):

| Figma style | Spec | Repo class |
|---|---|---|
| Body/M | 15 / 1.5 Regular | `.t-body-m` |
| Trimmed/Body/L | 16 / 1.5 Regular, trimmed | `.t-body-l .t-trim` |
| Label/M | 14 / 1.25 Medium | `.t-label-m` |
| Label/XS | 12 / 1.25 Medium | `.t-label-xs` (Progress label is drawn 1.4 lh in the frames, 1.25 in the master) |
| Button/S | 12 / 1.3 Medium, -1% (frames draw -0.12px) | `.t-button-s` (already trims) |
| Trimmed/Caption/S | 12 / 1.25 Regular (frames draw lh 1.3) | `.t-caption-s .t-trim` |
| Caption/S | 12 / 1.25 Regular | `.t-caption-s` |
| Greeting (no style name) | 40 / 1.2 Medium, -1.2px (-3%) | **no matching class**; `.t-title-display` is 44/1.1/-0.025em. Today's `.sp-chat-start__title` is 26px head font. |
| "Recent" header | 17 / 1.25 Medium, -0.17px | `.t-title-panel` (17/1.25/-0.01em) |
| File attachment name | 12 / 1.25 Medium, -0.24px (-2%), trimmed | ~`.t-label-xs .t-trim` + tracking -0.02em (no exact class) |
| File attachment source ("Google Drive") | 10 / 1.4 Regular, +0.2px (+2%), trimmed | no exact class (`.t-label-xxs` is Medium 10/1.25) |

---

## 1. Generate · Photo attached (Light 13:2301, Dark 13:4446)

Start state (no thread yet). Page `sp-page · Generate` 13:2374: flex column, padding 45 / 45 / 28 / 45 (top/sides/bottom), gap 30; children: `Start` (flex 1) and `Footer links`.

- `Start` 13:2375: column, centred both ways, padding-bottom 80, radius 32 (no fill).
- `Start column` 13:2377: column, height 879, `justify-content: flex-end`, gap **75**, items centred. Holds (a) the greeting+composer group and (b) `Recent`.
- Greeting+composer group is a grid overlay: greeting at offset (139.5, 0); composer at offset (0, 83). So greeting top to composer top = 83; greeting line box 48 → **35** gap greeting-bottom to composer edge.
  - Greeting 13:2380: "What are we painting today?" 40/1.2 Medium, tracking -1.2px, centred, nowrap, `--text-strong`.
  - **No sub-line** (today's "Describe it and I'll build it from your templates, already on brand." is absent).
- **Composer** `sp-chat-box` 13:2381 (a drawn copy of Composer 61:504, not an instance): width 760; border 5px `rgba(255,255,255,.25)` (master: `--border-raised`); radius 20; fill `--surface-raised`; drop-shadow 2 2 4 `--shadow-raised` + bevel insets (`--bevel-top` / `--bevel-bottom`, i.e. Elevation/Small); padding 20 top, 12 right, 12 bottom, 20 left (inside the 5 edge); column gap **30**.
  1. `Attachments` 13:2382: row, no gap (one item).
     - `attachment · photo` 13:2383: 64 x 64, radius 9, image `object-fit: cover`.
     - `Remove` 13:2384: 16 x 16 at left 44 / top 4 (i.e. 4 in from top-right), fill `#0b0b0c` (`--surface-inverse` Light), radius 8, `icon · x` 10 x 10 white.
  2. Text 13:2387 (Trimmed/Body/L, `--text-strong`): "We’re hiring a Creative Director. Can you make a post for Instagram and LinkedIn with this team photo that sends people to socialpaint.ai/careers?"
  3. `toolbar` 13:2388: row, gap 12, `align-items: flex-end`.
     - `inputs` 13:2389: flex 1, gap 6, padding 4 0. `sp-plus` (Attach button) 28 x 28, `--surface-inverse`, radius 7, plus 14. `Tags` 13:2393: flex 1, height 28, **empty**.
     - `output` 13:2394: gap 6, items centred.
       - `Platform` (Compact select 99:568): h 28, padding-left 9 / right 6, gap 6, `--surface-sunken`, radius 7; "Any platform" Button/S `--text-strong`; chevron-down 16. **No leading globe icon** (today's PlatformSelect shows a Globe beside "Any platform").
       - `Variations` (Stepper 100:545): h 28, padding-left 9 / right 3, gap 6, `--surface-sunken`, radius 7; label "Variations" Button/S; stepper: Decrease 28 round (opacity .32, disabled at 1), value box 20 x 28 "1" Button/S centred, Increase 28 round; icons minus/plus 16.
       - `sp-send` (Send button 44:9): 36 round, `--accent-green`, arrow-up 16.
- `Recent` 13:2413: width 760, column gap 12.
  - Header 13:2414: row, space-between, padding-left 4; "Recent" 17/1.25 Medium -0.17px; "View all" link: h 32, padding 0 8, Label/M underlined `--text-strong`.
  - Grid 13:2418: **3 columns**, gap 12 x 12, 4 cards (2 rows; last row 1 card). Card `sp-recent-card`: padding 8, radius 20, `--surface-raised`, Elevation/Small; thumbnail h 104 radius 15 `--surface-sunken`; meta padding 10 6 4 6, gap 2: title Label/M ellipsis `--text-strong`; meta Caption/S `--text-secondary` e.g. "LinkedIn · Yesterday", "LinkedIn · Sep 22", "LinkedIn · Sep 19", "LinkedIn · Sep 16". Titles: "No more waiting in the design queue", "Every location, one look", "Give your brand a canvas", "Brand rules that stick around". (Thumbnails are mock sketches; the real card shows a preview.)
- **No "Start from" chip row**, no library-empty note.
- `Footer links` 13:2451: row centred, gap 16, Caption/S `--text-secondary`: "Terms of Service", "Privacy Policy".

Mapping to repo: composer = `ChatComposer` (chat/ChatComposer.tsx) **plus** CompactSelect + Stepper primitives in `.ui-composer__output` before Send (ChatComposer currently omits both by design; its comment says Phase 5 adds them). Attachment thumb = existing `AttachmentThumb` (its remove button is 15 drawn; frame is 16). Note `.ui-composer` gap is 24 in primitives.css; the frames draw 30 between trimmed rows (check whether 24 was a deliberate trim compensation in Phase 4).

## 2. Generate · Details added (Light 13:2454, Dark 13:4615)

Same page, greeting, Recent and footer as frame 1. Composer differences:

1. `Attachments` 13:2535: row, **gap 8**, items centred.
   - Photo 64 x 64 as frame 1 (remove 16 at left 44 / top 4).
   - `attachment · file` 13:2540 (not a component): fill **`#f1f1ef`** (no token; between `--surface-page` #f9f9f8 and `--surface-sunken`), radius 9, padding 7 left / 35 right / 7 vertical, gap 10, height 64, width hugs (238 here).
     - `type` tile 50 x 50, `--surface-raised`, radius 7, `icon · doc` 20 centred.
     - `text` column gap 6, `--text-strong`, nowrap: name "Creative Director Job Post" (12/1.25 Medium, -0.24px, trimmed); source "Google Drive" (10/1.4 Regular, +0.2px, trimmed).
     - `Remove` 16 x 16 at right 4 / top 4, `#0b0b0c`, radius 8, x 10.
2. Text 13:2551 (Trimmed/Body/L): "We’re hiring a Creative Director. Keep it fun and pull the details from the job post."
3. Toolbar `inputs`: plus, then `Tag rail` 13:2557 (flex 1, relative):
   - `Tags` 13:2558: row, gap 6, min-height 28, `overflow-x: auto`, `overflow-y: clip`, padding-right 48.
   - Detail tags (Detail tag 61:464 state Editable, drawn, not instances): h 28, radius pill, padding-left 9 / right 6, gap 6, fill `--surface-page`; value Trimmed/Caption/S `--tag-detail-fg`; remove x 14 (`--tag-detail-fg`-ish). Strings, in order: **"Come paint with us"** (tag · Headline), **"Oct 31, 5:00 PM"** (tag · Date & time), **"Remote"** (tag · Location), **"socialpaint.ai/careers"** (tag · Link, leading `icon · globe` 15).
   - `Fade` 13:2578: absolute right -0.5, full height, width 121, `linear-gradient(90deg, #fff0 0%, #fff8c 40% (.55), #ffffffeb (.92) 75%, #fff 100%)`, i.e. `--surface-raised` fading in. The 3rd/4th tags sit under it (the 4th is fully hidden in the screenshot).
   - `output` unchanged (Any platform, Variations 1, Send).

Mapping: the Tag rail does not exist in `ChatComposer` (`.ui-composer__inputs` holds only the AttachMenu). Primitive `DetailTag` (primitives/Chips.tsx) covers Editable and Sent with an icon prop and remove button; there is no hover-to-edit behaviour in it.

## 3. Generate · Sent (Light 13:2639, Dark 13:4816)

Thread state. Page 13:2712: column, padding 45 / 45 / 28 / 45, **no gap**.

- `PageHeader` 13:2713: row, space-between, h 36.
  - Breadcrumb 13:2714 gap 8, 14px: "Generate" (Label/M, `--text-secondary`, a link, **not underlined**), "/" (Body/S 14/1.4, `--text-secondary`), "Creative Director post" (Label/M `--text-strong`).
  - Actions gap 8: `sp-button` "History": h 36, padding 0 16, gap 6, radius 7, `--surface-sunken`, icon 16 (history), Label/M -0.14px `--text-strong`. "New chat": same box, fill `--field-green`, text `--accent-green`, icon 16 (message-plus).
- `Thread` 13:2727: flex 1, column centred, padding-top 16, padding-bottom 32, overflow clip; `Thread column` 760 wide, column gap **24**.
  - `Message · User` 13:2729: column, gap **6**, `align-items: flex-end`.
    - `attachments` row gap 8: photo `sp-chat-photo / User · team photo` **64 x 64** radius 9; file attachment 238 x 64 identical to the composer's but **Remove hidden**.
    - Bubble `sp-chat-bubble / User` 13:2743 (Message bubble 61:505): `--surface-sunken`, radius 16, padding 12 16, column gap 10; text Body/M `--text-strong`, width 440 (bubble 472): "We’re hiring a Creative Director. Keep it fun and pull the details from the job post."
    - Bubble `Tags` 13:2745: `flex-wrap`, gap 6, min-h 28. Sent detail tags: h 28, padding 0 9, radius pill, fill `#d1d1d1` = `--tag-sent-bg`, border 0.75 `--tag-sent-border` (transparent Light), text Trimmed/Caption/S `--tag-sent-fg`: "Come paint with us", "Oct 31, 5:00 PM", "Remote", then wrapping to row 2: globe 15 + "socialpaint.ai/careers". No remove.
  - `Message · SocialPaint` 13:2757 (Assistant message 61:532): column gap **16**.
    - `sp-chat-assistant-header` = **20 x 20 mark only**, no "SocialPaint" name.
    - `Status` 13:2760: column gap 8: sentence Body/M `--text-strong` **"Filling in your Now hiring and Open role templates."**; `Progress` (58:450 step 1): row gap 12; track 120 x 4 `--surface-sunken` radius 2; fill 40 wide `--surface-inverse`; label Label/XS (lh 1.4 drawn) `--text-secondary` **"1 of 3 · Reading your job post"**.
    - `Results · loading` 13:2766: row gap 12, two skeleton cards (`sp-result-card-skeleton`, shape of Result card 104:602):
      - Instagram 227 x 344: padding 8, radius 20, `--surface-raised`, Elevation/Small; preview well 211 x 264 radius 15 `--surface-sunken`; inner bones (logo 53.5x8 r4, image 178x112 r9, headline 154x14 r7, headline 123.5x14, button 45x14, url 62x8) all **also `--surface-sunken`, so invisible on the well** (screenshot shows a flat grey well). Meta row h 64, padding 16 8 8 8, gap 12: bars title 90 x 10 r5 and meta 130 x 8 r4 (gap 9, padding 3 0), action circle 34.
      - LinkedIn 521 x 344: well 505 x 264 (landscape bones, same invisible fill); meta bars 90 and 150.
    - `sp-caption-card · loading` 13:2795: full width, padding 16 16 20 20, radius 20, `--surface-raised`, Elevation/Small, column gap 12. Header h 36 space-between: left (gap 12) title bar 56 x 10 r5 + "switch" block 150 x 36 r9 (the caption tab switch); right copy circle 32. Caption bones: column gap 10, padding 6 0: line 1 full width x 12 r6; line 2 half width x 12.
  - `Scroll fade · bottom` 13:2807: absolute bottom 0, h 56, `linear-gradient(180deg, page 0 → .4 at 35% → .85 at 70% → page 100%)` in `--surface-page`. **Top fade hidden** in this frame.
- `Composer dock` 13:2808: column, items centred, padding-top 16, gap 10.
  - Composer 760: same box as Start; placeholder Trimmed/Body/L `--text-secondary` **"Ask for changes or describe a new post"**; toolbar: plus, empty Tags, then **only** the Send button in its **Stop** state (no platform select, no stepper): 36 round `--accent-green`, a 12 x 12 square radius 2 in `--field-green`.
  - `Composer footnote` 13:2821: row gap 16, Caption/S `--text-secondary`: "Terms of Service", "Privacy Policy" **only**.

## 4. Generate · Generating (Light 13:2824, Dark 13:5001)

Same layout as Sent; differences:

- Thread column is scrolled: offset y -16 inside the thread, and **`Scroll fade · top`** 13:2968 is visible: h **68**, `linear-gradient(180deg, page 100% → .85 at 30% → .4 at 65% → 0)`. No bottom fade in this frame.
- User message 13:2914 (gap 6, right-aligned): **photo 64 x 64 only**, no file; bubble text: "We’re hiring a Creative Director. Can you make a post for Instagram and LinkedIn with this team photo that sends people to socialpaint.ai/careers to apply?" Bubble `Tags` present but hidden (no tags).
- Status sentence: "Filling in your Now hiring and Open role templates." Progress step 2: fill **80**, label **"2 of 3 · Rendering both sizes"**.
- Results skeletons, caption skeleton, dock (Stop) identical to Sent.

---

## Dark differences

Token flips apply (`--surface-page` #0b0b0c, `--surface-raised` #171819, `--surface-sunken` #2f3133, `--text-primary` #f1f1f1, `--text-secondary` #a0a0a0, `--surface-inverse` white, bevel/shadow tokens). Beyond flips:

- **Composer edge**: 5px border `rgba(255,255,255,.06)` (Light `.25`).
- **Photo/file Remove button**: fill `--surface-page` (#0b0b0c) instead of `#0b0b0c` Light, so it stays dark in Dark (not `--surface-inverse`). File remove sits at right 3 / top 3 (Light 4 / 4).
- **File attachment**: fill `rgba(255,255,255,.08)` **plus a 1px border `rgba(255,255,255,.25)`** (Light: `#f1f1ef`, no border); type tile fill `--surface-page` (Light `--surface-raised`).
- **Editable detail tags**: fill `--surface-page`; text **`#f1f1f1` full strength** (Light 65%; matches `--tag-detail-fg` = paper-075 in Dark).
- **Tag rail fade**: `rgba(23,24,25,…)`, i.e. `--surface-raised` Dark; the Dark fade sits at right 0 (Light -0.5).
- **Sent detail tags**: **inverted**: fill `--surface-inverse` (white), border 0.75 `rgba(241,241,241,.5)`, text `--text-inverse` (#0b0b0c). Matches `--tag-sent-bg/-fg/-border` Dark values already in tokens.css.
- **Header buttons**: History fill `--surface-raised` (#171819) in Dark (Light `--surface-sunken`); New chat fill `#2f3133` (sunken) in Dark, text still `--accent-green` (Light: `--field-green` fill).
- **Result skeleton cards / caption card**: gain the raised hairline border (`--border-raised` rgba(241,241,241,.2), 0.65 top / 0.25 sides / 0.55 bottom), as all raised cards do in Dark.
- **Recent grid**: the Dark Details-added frame shows **6 cards** (3 x 2, the last three duplicates of "Brand rules that stick around"); Light shows 4. Probably a mock difference; confirm the count.
- Progress fill flips to white (`--surface-inverse`). Send stays `--accent-green`, Stop square `--field-green`.
- Dark Sent's page-level frame code carries stale Light fallbacks (e.g. type tile `var(--surface-page,#f9f9f8)`) but the render is dark; trust the tokens.

## Primitives used / not yet primitives

| Frame part | Master component | Repo today |
|---|---|---|
| Composer box | Composer 61:504 ("Generate composer. Detail tags go in the Tags row. The Send button is exposed so it can switch to Stop.") | `chat/ChatComposer.tsx` (`.ui-composer`), without select/stepper/tags |
| Plus | Attach button 102:569 / 44:10 ("Opens the attach menu"; hover-inverse / pressed-inverse; focus ring 2px out) | `AttachButton` primitive via `AttachMenu trigger="attach"` |
| Any platform | Compact select 99:568 ("28 tall picker inside the composer… surface/sunken. Hover adds state/hover. Open holds state/pressed while the menu shows.") | `CompactSelect` primitive exists (primitives/Select.tsx); Generate still uses legacy `PlatformSelect` (with Globe + platform icons, dimmed options) |
| Variations | Stepper 100:545 + Stepper button 100:544 ("Disabled is 32% opacity… when the count is at its limit") | `Stepper` / `StepperButton` primitives exist (IconButton.tsx); Generate uses legacy `VariationsStepper` (aria labels "Fewer/More variations", 1–3) |
| Send / Stop | Send button 44:9 ("Stop shows while a run is in progress. Slime in both modes… hover-on-color") | `SendButton` primitive (`action="stop"`) |
| Detail tag (composer) | Detail tag 61:464 Editable / Hover ("Keyboard focus lands on the remove button") | `DetailTag` primitive (Chips.tsx) exists; **no tag rail/fade in ChatComposer** |
| Detail tag (sent) | Detail tag 61:464 Sent | `DetailTag state="sent"`; `MessageBubble` has a `tags` slot. Legacy `generate/DetailTag.tsx` used by `UserMessage` |
| User bubble | Message bubble 61:505 ("Sent detail tags go in the Tags slot") | `chat/Messages.tsx MessageBubble` |
| Assistant turn | Assistant message 61:532 + Logo mark 61:467 ("Results, the caption card and follow-up chips go in the Content slot") | `chat/Messages.tsx AssistantMessage` (mark only, no name) |
| Progress | Progress 58:450 ("Step progress under the generating message") | `Progress` primitive (Containers.tsx) |
| Result skeleton | shape of Result card 104:602 | Not a primitive. `TemplateChatViews.BuildingSkeleton` draws **one** card (plus Looks) with plain wells; legacy `DraftCardSkeleton` draws the portrait/landscape post sketch per slot aspect. Generate needs **N skeletons** from `skeletonAspects(turn)` in the new card |
| Caption card loading | none (drawn `sp-caption-card · loading`) | Template chat's `CaptionCard` has no tabs and no loading state; legacy `generate/CaptionCard` has `state="loading"` and tabs. The frame's 150 x 36 "switch" bone = caption tabs (multi-draft), which the new card lacks |
| Photo in composer / sent | none (`attachment · photo`, `sp-chat-photo`) | `AttachmentThumb`; sent photo in `UserMessage` (160 x 107) / `TemplateUserTurn` (64) |
| File attachment | none (`attachment · file`) | `FileAttachment` (44 tile, name over KIND); not a primitive |
| Tag rail + fade, scroll fades, page header buttons, breadcrumb, Recent cards, greeting | none | `ScrollFade`, `ChatHeader`/`ChatButton`, `RecentChats`/`RecentCard`, `LegalLinks` (legacy generate/ components) |
| Chip ("Try next" follow-ups) | Chip 98:515 (not in these four frames) | `Chip` primitive |

## Behaviour differences vs code

Start state (GeneratePage `!threadLayout` branch, `Composer size="large"`):

1. **Sub-line removed**: today "Describe it and I'll build it from your templates, already on brand." under the greeting; frames have none. Greeting is 40px Medium vs today's 26px head font.
2. **Start from chips removed**: today up to 5 `SuggestionChip`s pin a published template for the next send (placeholder becomes "Describe your {name} post…"). Frames show no Start from row.
3. **Library-empty note** ("No published templates yet, so drafts come fresh from your brand kit.") not drawn.
4. **Recent grid**: 3 columns (today 4 columns, `RECENT_COUNT = 4`, 2 columns narrow). Light shows 4 cards wrapping to 2 rows; Dark shows 6. Count and wrap need a decision.
5. Composer gains the **Tag rail** (frames 2); today no detail tags in any composer (the template chat's plus-menu Details was replaced by scripted questions in PR #148; legacy `DetailTag`'s edit-popover path is dead code).
6. Platform select: frame has no leading globe on "Any platform"; today's `PlatformSelect` options carry platform icons and dim uncovered platforms (`covered`/`dimUncovered`). The CompactSelect primitive's menu must keep icons/dimming or it is a loss.
7. Stepper: same 1–3 range; primitive's labels default to "Decrease/Increase" while legacy says "Fewer variations"/"More variations"; keep the legacy names.
8. Placeholder: frames 1–2 show filled text, so the Start placeholder is unseen; Master default is "Describe the post. Add any dates, names, or links it needs." = today's `START_PLACEHOLDER` (same).

Attachments (Composer.tsx / AttachmentThumb.tsx):

9. File attachment redesign: 50 tile (today 44), r9, pr 35 for the remove; second line is the **source** ("Google Drive") where today it is the **kind** ("PDF" / "TXT" / "MD"). Google Drive as a source implies a **connector** (new product work); for local files the second line needs a rule (kind? "Uploaded"?).
10. Remove button 16 (today 15 drawn with a larger hit area); Dark keeps it dark (`--surface-page`) whereas today uses `--gen-inverse` (light in Dark). Check.
11. Sent photo is **64 x 64** square (today `UserMessage` draws 160 x 107 cover). Sent file keeps the full card without remove (today same, as `FileAttachment` without `onRemove`).
12. Frames show photo **and** document together in one composer (today supported: one photo + one document).
13. Not drawn but present today and must survive: upload chip while reading (`UploadChipView`), paste/drop photo, drag-active state and its sr-only announcement, `photoError` alert line, Brand Studio pick, the "Photos aren't saved…" note under a reopened chat's message, "This chat isn't saved yet." and "This chat is full…" dock notes.

Thread (Sent / Generating):

14. **Assistant byline**: frame is the 20 mark only; today `AssistantHeader` draws mark + "SocialPaint" name (10 apart). `AssistantMessage` already drops the name.
15. **Step 1 copy**: frame Sent pairs step 1 label "Reading your job post" with status "Filling in your Now hiring and Open role templates." Today step 1 is label "Reading your brief" and status "Reading your brief and choosing from your templates." (`askingCopy`), and "Filling in your … templates." is step 2's status (`fillingStatus`). The frame implies (a) a document-aware step-1 label ("job post" from the attached doc) and (b) template names known at step 1. Neither exists; (b) is impossible before the model picks. Treat as mock copy unless CJ wants a document-aware label.
16. Step 2 matches exactly: "Filling in your Now hiring and Open role templates." + "2 of 3 · Rendering both sizes" (`fillingStatus` + `measuringStepLabel`). Progress fill 40/80/120 = step ÷ 3 (same). Primitive `Progress` uses aria-valuenow 0–100; legacy `RunProgress` uses 1–3 with `aria-labelledby` the status sentence and hides the drawn label. Keep the legacy a11y wiring.
17. **Skeletons**: frames show 2 result skeletons (Instagram portrait 211 well, LinkedIn landscape 505 well) at the full 264 preview height, wells flat sunken (bones invisible). Today `DraftCardSkeleton` draws visible post sketches in `--gen-sunken` on a deep-stage well, one per expected/pending slot with `fallbackAspect` 4:5 then 1.91. Need: new-look skeleton = ResultCard geometry, N of them, widths from aspect x 264; decide whether bones show.
18. **Caption card loading** has a 150 x 36 tab-switch bone; the new `CaptionCard` (template chat) has no tabs. Generate needs tabs (`captionTabs`, per-draft caption pick `captionPicks`) on the new card.
19. **Stop**: green circle with a 12 square in `--field-green` (same behaviour as today's Stop; check today's glyph).
20. **Scroll fades**: frames draw a **bottom fade** (56, Sent) as well as the top fade (68, Generating). Today only `<ScrollFade position="top">` renders. Adding the bottom fade is new behaviour (show when not at the bottom).
21. **Dock footnote**: legal links only. Today `ChatFootnote` also says "Every graphic follows your Brand Studio rules." (drop vs keep).
22. Breadcrumb root "Generate" not underlined in the frame (today underlined per PROMPT §8.4).
23. New chat button: Light `--field-green` fill with `--accent-green` text (check today's ChatButton secondary); Dark uses sunken fill.
24. Thread composer: placeholder "Ask for changes or describe a new post" = today's `THREAD_PLACEHOLDER`; compact, no select/stepper (same as today: follow-ups reuse the last platform and count).

Sent message and details (UserMessage.tsx, DetailTag.tsx, lib/generate/details.ts):

25. **Generate detail tags are new product work.** Frames: the member adds Headline / Date & time / Location / Link tags in a Generate composer and they travel in the sent bubble. Today:
    - `ChatDetail` is `{fieldKey, label, value}` tied to a template field; `detailFieldsFor(schema)` derives rows from one template.
    - The server rejects them outside a template: template-generate `"details need a templateIdHint and library mode."` (index.ts ~924) and resolves them against `candidates[0]` only.
    - Generate has no template at compose time, so it needs generic detail kinds (headline/text, date, place, link: `DetailKind` already has link/date/place/text), a way to add/edit them (the attach menu has only Photo, File, Brand Studio; another spec's "add detail" frame covers the entry point), and server support to map free-form details onto whichever templates the model picks (prompt + validation in `_shared/generateValidate.ts`), plus persistence (details already persist on the message).
    - Tag rail scroll (overflow-x auto, 48 right padding, 121 fade) is new UI.
    - Editing a tag: Master says Editable shows remove, Hover adds state/hover, focus lands on remove. No click-to-edit. Legacy `DetailTag` had click-to-reopen-popover; that is gone from the frames (and dead today).
26. Sent tags: Light `--tag-sent-bg` grey, Dark inverted white; tokens already exist and match. `UserMessage` renders tags with `role="list"` / `aria-label="Details"` and each tag's accessible name "{label}: {value}"; primitive `DetailTag` has no label/value split, so keep that naming when switching.

## Interactions the frames drop

Flag to CJ (these are familiar today and not drawn):

- **Start from chips** (pin a published template for the next send, pinned placeholder, `templateIdHint` from "Use this one"). The `templateIdHint` route param still pins a chip with no visible row to show it. Biggest loss.
- **Sub-line** under the greeting and the **library-empty note** (explains freestyle when no templates are published).
- **"SocialPaint" name** in the assistant byline.
- **"Every graphic follows your Brand Studio rules."** in the dock footnote.
- **Visible skeleton sketches** (post bones) while drafts render: frames go flat grey.
- **Platform icons/dimming in the platform menu** (the closed control drops the globe; the open menu is not in these frames, so confirm it keeps icons and the dimmed uncovered platforms).
- **Recent 4-up row** becomes a 3-column grid.
- **Document kind label** (PDF/TXT/MD) replaced by a source label.
- **Sent photo at 160 x 107** shrinks to a 64 thumbnail (less visible, but matches the template chat).
- Not drawn but must be kept (no frame shows them): upload chip, drag-and-drop state, paste-to-attach, photo/document error line, chat-full and not-saved notes, the reopened-chat photo note, Try again on an error turn, warnings under drafts, Try next row, Fill in row, compact cards while the editor is open, the outlined selected draft.

## Open questions

1. Start from chips: drop, move (into the attach/plus menu or the platform select), or keep below the composer? What happens to `templateIdHint` ("Use this one" from a template card) without a visible chip?
2. Generate detail tags: confirm they ship in Phase 5. If so, how are they added (attach menu "Details" row? typed syntax?), what kinds exist (Headline, Date & time, Location, Link, other?), and is server work (template-generate accepting details without a template, mapping them per proposal) in scope? If not, the Tag rail ships empty and the sent bubble shows tags only for template chats.
3. File attachment second line: "Google Drive" implies a Drive connector. For an uploaded file, show the kind (PDF), "Uploaded", or nothing?
4. Step-1 copy: keep "Reading your brief" / "Reading your brief and choosing from your templates.", or add a document-aware label ("Reading your job post")? The frame's step-1 status naming templates can't be known yet.
5. Skeleton bones: the frames fill them with the same sunken as the well (invisible). Intentional flat skeleton, or a missing tone (e.g. `--surface-raised` bones)? Template chat already uses plain wells.
6. Bottom scroll fade: add it (frames show it) and with what rule?
7. Recent: 3 columns with how many cards (4 Light / 6 Dark)?
8. Greeting size: 40/1.2 Medium -3% has no `.t-` class. Add one, or use `.t-title-display` (44)?
9. Composer row gap: frames 30, `.ui-composer` 24. Keep Phase 4's value?
10. Footnote: drop "Every graphic follows your Brand Studio rules."?
11. Platform menu contents when open (icons, dimmed uncovered platforms): unchanged from today?
12. Copy mismatch in mocks: Photo-attached text ends "…socialpaint.ai/careers?" while the Generating bubble ends "…socialpaint.ai/careers to apply?" (mock only; no action).

---

# Part C: Result, Edit, History

Source: Figma `mEJRslarcQDkgPeY6AObi5` ("Master UX-UI"), page Generate 8:674, section 13:1452. Frames 1440 x 1053.

| Frame | Light | Dark | Screenshot |
|---|---|---|---|
| Generate · Result | 13:2985 | 13:5162 | `reference/generate-result.png` |
| Generate · Edit | 13:3150 | 13:5327 | `reference/generate-edit.png` |
| Generate · History | 13:3359 | 13:5536 | `reference/generate-history.png` |

The sidebar (sp-nav, 0..335) is ignored. Everything below sits in `sp-page · Generate` (x 335, w 1105).

**Important for everything below: none of these frames uses instances of the Master components.** `get_metadata` lists every part as a plain `frame` (result cards, caption card, chips, segmented controls, inputs, platform chips and history cards alike). The MCP returned no component descriptions for nodes inside the three frames. The mappings to Master components below are by name and geometry. I fetched the Result card master (104:602) on its own to get its description (quoted in "Primitives").

Type key, from `src/styles/tokens.css`:
t-title-page 500 30/1.2 -0.02em · t-title-card 500 18/1.25 -0.01em · t-label-l 500 15/1.25 -0.01em · t-label-m 500 14/1.25 · t-label-s 500 13/1.25 · t-label-xs 500 12/1.25 · t-body-l 400 16/1.5 · t-body-m 400 15/1.5 · t-body-s 400 14/1.4 · t-caption-m 400 13/1.25 · t-caption-s 400 12/1.25 · t-button-m 500 14/1.25 -0.01em · t-button-s 500 12/1.3 -0.01em (trimmed) · t-control-s 500 13/1.3 -0.01em.

Colour key (Light): #0b0b0c = --text-strong · #636363 = --text-secondary · #ececec = --surface-sunken / --control-fill · white = --surface-raised · #f1f1ef = --control-track / --input-bg (paper-075-warm) · #f9f9f8 = --surface-page · #082a23 = --field-green · #17ff7e = --accent-green · rgba(8,42,35,.35) = --overlay-hover · #2f3133 = ink-700 (Dark --surface-sunken).

---

## 1. Generate · Result (13:2985)

Page column (13:3058): flex column, padding **45 top, 45 left/right, 28 bottom**. Three rows: PageHeader, Thread (flex 1), Composer dock.

### PageHeader (13:3059): 1015 x 36, space-between, centred
- **Breadcrumb** (13:3060), gap 8, one line:
  - "Generate": a link, 14 medium /1.25 (t-label-m), --text-secondary. In Figma it is not underlined; today's crumb is underlined.
  - "/": 14 regular /1.4 (t-body-s), --text-secondary.
  - "Creative Director post": t-label-m, --text-strong. This is the chat's title.
- **Actions** (13:3064), gap 8:
  - **History** (sp-button, 99 x 36): padding 0 16, radius 7, gap 6, 16 icon (history clock), label "History" t-button-m (14 medium, -0.14), --text-strong on --surface-sunken. This is Button kind neutral, size default.
  - **New chat** (sp-button, 113 x 36): same geometry. Speech-bubble icon and "New chat" in --accent-green on --field-green. This is Button kind primary.

### Thread (13:3073): flex 1, column, items centred, justify **end**, padding-top 16, padding-bottom 32, overflow clip
- **Scroll fade · top** (13:3133): absolute, 68 tall, full width. Gradient of --surface-page: 0% solid, 30% at .85, 65% at .4, 100% at 0.
- **Thread column** (13:3074): **760** wide, column, **gap 24** between messages.

#### Message · User (13:3075): column, gap 6, aligned end (right)
- **Team photo** (sp-chat-photo): 64 x 64, radius 9, object-cover. It is blurred in the mock because it sits under the top fade.
- **Bubble** (sp-chat-bubble / User): --surface-sunken, radius 16, padding 12 16, gap 10. Text is t-body-m --text-strong, 440 wide (bubble 472). A hidden "Tags" row (440 x 28) holds the detail tags when there are any.
  - Text: "We’re hiring a Creative Director. Can you make a post for Instagram and LinkedIn with this team photo that sends people to socialpaint.ai/careers to apply?"

#### Message · SocialPaint (13:3080): column, **gap 16**, full width
1. **sp-chat-assistant-header**: the 20 x 20 SocialPaint mark (green). No name label.
2. **Status**: t-body-m --text-strong, full width. Text: "Here you go, in both sizes with a caption for each. The Apply now button points to socialpaint.ai/careers."
3. **Results** (13:3085): row, **gap 12**, align start. There is no wrap in the frame: 227 + 12 + 521 = 760.
   - **sp-result-card · Now hiring · Instagram (hover)** (227 x 344): padding 8, radius 20, --surface-raised fill, Elevation/Small (drop 2 2 r8 --shadow-raised, inset bevel top/bottom). It is a link (cursor pointer).
     - preview: **211 x 264**, radius 15, image object-cover. It shows the hover state: "Hover overlay · edit (hover and keyboard focus)" covers the preview in --overlay-hover, radius 15. It centres a **40 white circle** (--overlay-control) holding a 20 pencil icon.
     - meta: row, gap 8, padding 16 top, 8 sides, 8 bottom. Text column (gap 4, ellipsis):
       - title "Now hiring": 15 medium /1.25 -0.15 (t-label-l), --text-strong.
       - meta "1080 × 1350": 12 medium /1.4, --text-secondary. That is t-label-xs at line-height 1.4; the master uses 1.25.
       - Actions: Download, a **34** circle in --surface-sunken with a 16 download icon (Icon button, Filled, drawn at 34).
   - **sp-result-card · Open role · LinkedIn** (521 x 344): the same card in its Default state. Preview **505 x 264** (1.91:1). Title "Open role", meta "1200 × 627".
   - The preview height is fixed at 264 and the width follows the canvas aspect, which is the same as today's `PREVIEW_HEIGHT.regular`.
4. **sp-caption-card** (13:3111): full width (760 x 134). Padding **16 top, 16 right, 20 bottom, 20 left**, column gap 12, radius 20, --surface-raised, Elevation/Small.
   - header: row space-between, 40 tall.
     - "title + platform", gap 12:
       - "Caption": t-label-m --text-strong.
       - **Platform switch**: a segmented control. Track #f1f1ef (--control-track), padding 4, gap 4, radius 9 (184 x 40). Segments are 32 tall, padding 0 14, radius 7. The selected one is white with a 0 1 3 rgba(0,0,0,.08) shadow (--elevation-thumb). Labels are 13 medium /1.3 -0.13 (t-control-s): selected --text-strong, other --text-secondary. Segments: "Instagram" (selected) and "LinkedIn" (86 fixed width).
     - **Copy caption**: a 32 circle Icon button (Filled), --surface-sunken, 16 copy icon.
   - caption: t-body-m --text-strong. Text: "We’re hiring a Creative Director. If you’d love giving a brand its best look everywhere it shows up, come paint with us. The link to apply is in our bio. #hiring #creativedirector"
5. **Follow-ups** (13:3125): row, gap 8, centred.
   - label "Try next": 13 regular /1.25 (t-caption-m), --text-secondary.
   - three **sp-chip**s: 28 tall, padding 0 10, radius 7, --surface-sunken, labels 12 medium /1.3 -0.12 trimmed (t-button-s), --text-strong. They are "Add a location", "Make a Facebook version" and "Try another layout". These are the Chip master 98:515 by look.

### Composer dock (13:3134): column, items centred, gap 10, padding-top 16
- **sp-chat-box** (760 x 110): --surface-raised, radius 20, **5px border rgba(255,255,255,.25)** (the lit edge), Elevation/Small. Padding 20 top, 12 right, 12 bottom, 20 left; column gap 30.
  - input placeholder "Ask for changes or describe a new post": 16 regular /1.5 trimmed (t-body-l + t-trim), --text-secondary.
  - toolbar: row, gap 12, align end.
    - inputs: flex 1, gap 6, padding 4 0. **sp-plus** is 28 square, radius 7, --surface-inverse, with a 14 plus icon (Attach button 102:569). An empty **Tags** slot (flex 1, 28 min height) holds the detail tags.
    - **sp-send**: a 36 circle (radius 30) in #17ff7e with a 16 arrow icon (Send button 44:9).
  - There is **no platform select and no Variations stepper** in the box (today's compact composer has neither either).
- **Composer footnote** (13:3147): row, gap 16. 12 regular /1.25 (t-caption-s), --text-secondary: "Terms of Service" and "Privacy Policy". There is **no "Every graphic follows your Brand Studio rules." line**.

---

## 2. Generate · Edit (13:3150)

**Verdict: this is today's legacy EditorPanel "inline" presentation**, a side panel beside a narrowed chat with a size switch and its own preview stage. It is **not** the template chat's Edit details (13:8148), which is a large stage plus the Details panel replacing the thread. The chat thread stays visible and live on the left (the result cards, caption card, Try next and composer are all still there). The panel is 380 wide on the right. It has a Size switch segmented control ("Instagram · 4:5" / "LinkedIn · 1.91:1"), a 290-tall preview stage **inside** the panel, the fields, and a full-width Download PNG. Every measurement matches the comment block on `EditorPanel` (380 wide, column gap 16, stage 290, 216 x 270 for 4:5, the size switch only with 2+ drafts).

PageHeader: identical to Result (same breadcrumb "Generate / Creative Director post", History, New chat).

### Split (13:3238): 1015 x 944, row
- **Chat** (13:3239): x 0, **611 wide**, top offset 24 (the split's first child starts 24 under the header). Column: Thread (769 tall) then Composer dock.
- **Editor panel** (13:3312): x 635, **380 wide**, 920 tall, top offset 24. **The gap between chat and panel is 24.** The panel runs from the header's bottom +24 to the page's bottom padding (28), so it fills the row height.

### Chat side (narrowed)
- Thread: the scroll fade on top is **56** tall (68 in Result). The thread column is **547 wide** (611 minus 32 each side), with the same 24 message gap.
- User message: the bubble stays 472 (right aligned) and the photo is 64.
- Status sentence wraps to two lines (547 x 46): "Here you go, in both sizes with a caption for each. The Apply now button points to socialpaint.ai/careers."
- Results (gap 12):
  - **sp-result-card · Now hiring · Instagram (editing)** (163 x 264): preview **147 x 184**, then the same meta row. Title "Now hiring", **meta "1080 × 1350"** (the size, not the platform). It is drawn in the **editing state: a 0.75px border in --text-strong** (#0b0b0c; Dark --text-primary #f1f1f1) around the 20-radius card. There is no hover overlay.
  - **sp-result-card · Open role · LinkedIn** (368 x 264): preview **352 x 184**. Title "Open role", meta "1200 × 627".
  - The compact preview height is 184, the same as today's `PREVIEW_HEIGHT.compact`.
- Caption card: same as Result at 547 wide (caption wraps to 3 lines, 157 tall). It keeps the "Instagram" / "LinkedIn" switch and Copy.
- Try next row: unchanged (the same three chips).
- Composer dock: the **chat box spans the full 611**, not 760. The footnote is the legal links, centred.

### Editor panel (13:3312)
Card: padding **20**, column **gap 16**, radius 20, --surface-raised, Elevation/Small. Dark adds the raised border (0.65 top / 0.25 sides / 0.55 bottom in --border-raised).

1. **Panel header** (340 x 32), space-between:
   - "Edit details": **18 medium /1.25 -0.18 (t-title-card)**, --text-strong.
   - **Close**: a 32 circle Icon button (Filled), --surface-sunken, 16 close icon.
2. **Size switch** (340 x 40): track --control-track #f1f1ef, padding 4, gap 4, radius 9. Two segments, each **flex 1**, 32 tall, radius 7. The selected one is white with --elevation-thumb. Labels are 13 medium /**1.25** -0.13 (t-label-s plus -0.01em; t-control-s is 13/1.3). The labels are "**Instagram · 4:5**" (selected) and "**LinkedIn · 1.91:1**", in the same form as today's linkedFields sizeNames.
3. **Preview stage** (340 x **290**): radius 9, overflow clip, centred. **There is no fill in the frame** (the stage is the panel's white). Today's code draws it "on the --gen-well", so check that fill. The graphic is **216 x 270**, radius 9, contained 10 inside the stage.
4. **Fields** (340, column **gap 12**, overflow clip). Each Field is a column with gap 6:
   - label row (space-between): label 12 medium /1.25 (t-label-xs) --text-secondary. "Optional" is 12 regular (t-caption-s) --text-secondary, at the right end.
   - **sp-input**: 40 tall, padding 0 12, radius 9, fill #f1f1ef (--input-bg). The value is 14 regular /1.4 (t-body-s) --text-strong. A placeholder uses --text-secondary.
   - The fields, verbatim:
     | Label | Marker | Value |
     |---|---|---|
     | Headline | | We’re hiring a |
     | Role | | Creative Director |
     | Button text | | Apply now |
     | Button link | | socialpaint.ai/careers |
     | Location | **Optional** | *(placeholder)* Add a city or Remote. Focused: 1.5 x 18 caret in --text-strong, gap 2 |
   - The frame has no Edited marker, no error line, no Look switch, no Caption field and no image/Upload row.
5. **spacer** (flex 1).
6. **Panel footer** (340 x 60, radius 9, overflow clip): **one** button. **"Download PNG"** is full width, **59 tall**, padding 0 18, radius 9, --field-green fill, label t-button-m in --accent-green. The icon slot is hidden. There is **no hint line ("Edits update both sizes."), no Save to library and no Discard**.

No scrim and no sheet are drawn. The frame shows only the 1440 inline case.

---

## 3. Generate · History (13:3359)

Page column: PageHeader at y 45, History content at y 109, Footer links at y 1010 (so the bottom padding is 28).

### PageHeader (13:3433): column, gap 8, padding 0 45
- Breadcrumb: "Generate" (t-label-m --text-secondary, link) / "/" (t-body-s) / "History" (t-label-m --text-strong).
- Title row (1015 x 36), space-between:
  - "History": **30 medium /1.2 -0.6 (t-title-page)**, --text-strong.
  - **New chat**: Button primary (field-green, accent-green text, chat icon), 113 x 36.
- **There is no description line.** Today's "Every chat and the posts it made, newest first. Open one to pick up where you left off." is absent.

### History content (13:3444), y 109, 901 tall
- **sp-filterbar** (13:3445): starts **24** below the header, 56 tall, padding 0 45. Inside is **sp-railfade · chip rail (overflows)** (1015 x 52), which holds the **sp-platform-chipbar** (row, **gap 7**, 50 tall; 1016 wide, so it overflows the 1015 rail by 1).
  - **sp-searchfield__trigger (collapsed)**: a **50 x 50** square, radius 9, --surface-sunken, 20 lucide Search. This is the Search field master 50:62, collapsed, the same as `LibrarySearch`.
  - **sp-platform-chip · All** (selected): **164 x 50**, radius 9, padding 8 9 8 7, gap 7. **Selected fill: --surface-inverse** (#0b0b0c). The tile is 36, radius 7, #2f3133, with a 20 lucide LayoutGrid. The label "**All chats**" is 14 medium -0.14 trimmed, **white**. The ChevronRight 14 is **rotated 90° (down)** because it is selected.
  - **sp-platform-chip · Instagram / LinkedIn / Facebook / Email / Website**: each **152 x 50**, --surface-sunken fill. The tile is 36 in --surface-raised with the platform's mono mark at 20 (Facebook, Email and Website are whole 36 tile SVGs). The label is t-label-m-ish (14 medium -0.14 trimmed) in --text-strong, followed by a ChevronRight 14 pointing right.
  - Labels verbatim: "All chats", "Instagram", "LinkedIn", "Facebook", "Email", "Website".
  - This matches the library's `PlatformFilter` (13:5776), not today's `GroupChips`.
- **History grid · scroll (overflow-y: auto)** (13:3508): y 96 within the content (**16 under the filter bar**), 1105 x 805 (runs into the page gutters). It contains:
  - **History grid** (13:3509): x 45, padding-top **24**, 1015 wide, **4 columns of 244.75 square cards, gap 12** both ways (three rows shown, 758.25 tall).
  - **Scroll fade · bottom** (13:3594): **132** tall at the scroller's foot. Gradient of --surface-page: 0% at 0, 35% at .4, 70% at .85, 100% solid. No top fade is drawn (it is at the top).
- **sp-history-card** (244.75 square): padding 8, radius 20, --surface-raised, Elevation/Small. It is a link.
  - preview: flex 1 (228.75 x 179.75), --surface-sunken, radius 15, **padding 16**, centres the graphic. "Creative Director post" shows a 4:5 graphic at **119 x 149, radius 7**.
  - meta: column, gap 2, padding 10 top, 6 sides, 4 bottom, ellipsis:
    - title: 14 medium /1.25 (t-label-m), --text-strong.
    - meta: 12 regular /1.25 (t-caption-s), --text-secondary.
  - Cards verbatim (title / meta):
    1. Creative Director post / Instagram, LinkedIn · Today (real 4:5 graphic)
    2. No more waiting in the design queue / LinkedIn · Yesterday
    3. Every location, one look / LinkedIn · Sep 22
    4. Give your brand a canvas / LinkedIn · Sep 19
    5. Brand rules that stick around / LinkedIn · Sep 16
    6. Your brand, in everyone's hands / LinkedIn · Sep 12
    7. Make it look like your designer made it / LinkedIn · Sep 9
  - Cards 2 to 7 are mock previews: the preview well itself carries a 13 medium /15px headline at 12,12 (132 wide, --field-green in Light, a pale tint #d8f8c8 and others in Dark) and a 50 x 8 socialpaint logo at the bottom left. They stand in for a full-bleed LinkedIn graphic. **Note that these previews are not inset by the 16 padding**, unlike card 1. I take them as placeholder art, not a second layout. **Open question 7.**
  - **sp-history-card · loading** (5 of them: row 2 col 4, and all of row 3): the same card. The preview is a sunken well with a sunken skeleton graphic, alternating **197 x 103** (landscape, 1.91) and **119 x 149** (portrait), radius 7. The meta skeleton is padding 14 top, 6 sides, 7 bottom, gap 9: a **128 x 10** bar and an **84 x 8** bar, radius 5, --surface-sunken. Today's loading card (Bone in the line boxes, portrait/landscape shapes, finishing the last row) is the same idea.
- **Footer links** (13:3595): centred, gap 16, t-caption-s --text-secondary: "Terms of Service", "Privacy Policy".

---

## Dark differences (beyond token flips)

The token flips themselves: surface-raised #171819, surface-sunken #2f3133, text-primary #f1f1f1, text-secondary #a0a0a0, input-bg rgba(241,241,241,.08), border-raised paper-075-20, bevel-top .15 / bottom .10, shadow-raised .15. Raised cards also gain the 0.65/0.25/0.55 --border-raised edge.

1. **New chat button** (both header and History): Light uses --field-green fill with --accent-green text. **Dark uses #2f3133 (surface-sunken) fill with --accent-green text**, not field-green. The **History** button in Dark is --surface-raised (#171819) with --text-primary, not sunken. Check that Button primary/neutral in Dark resolve this way.
2. **Download PNG** (Edit panel footer): Light is --field-green fill with --accent-green text. **Dark inverts it to --accent-green fill with --field-green text.** This is a real per-theme swap, not a flip of one token.
3. **Size switch track** in Dark is --surface-page (ink-900), with the selected segment --surface-sunken (#2f3133) and no white thumb. Light is --control-track with a white thumb. That matches --control-track Dark = ink-900, so it is a token flip if the selected segment uses a "thumb" token that is sunken in Dark.
4. **Editing outline** on the result card: Light 0.75 --text-strong #0b0b0c, Dark 0.75 **--text-primary #f1f1f1** (a white outline).
5. **All chats chip (selected)**: Light is --surface-inverse (black) fill with a #2f3133 tile and white label. **Dark is #2f3133 fill with a --surface-raised (#171819) tile, a green LayoutGrid glyph and a white label.** Selected is therefore not "inverse" in Dark (inverse would be white). Check that PlatformChip's selected state already does this (Phase 4 built it).
6. **History mock previews**: headline text tints per card in Dark (#d8f8c8 pale green, pale blue, etc.) against #2f3133. These are placeholder art only.
7. **Edit panel**: the Location caret is --text-primary and its placeholder --text-secondary (#a0a0a0). The Dark placeholder is light grey, a straight flip.
8. The Composer box's 5px rgba(255,255,255,.25) border is the same in both themes in the frames.
9. Chips ("Try next") in Dark read as a dark grey (#2f3133, surface-sunken). The code's Chip uses --control-fill, which is **ink-800 (#171819) in Dark**, not ink-700. **That is a mismatch**: the frames use --surface-sunken for chips. Light is identical (#ececec either way).

---

## Primitives used / not yet primitives

| Frame part | Master (by look) | Repo today | Notes |
|---|---|---|---|
| Result card (both sizes, hover, editing) | Result card 104:602 (+ hover 104:584) | `primitives/Previews.tsx` `ResultCard` (used by TemplateChatViews); Generate uses its own `DraftCard` | Master description: "A generated post in the chat. Hover dims the preview under overlay/hover (Deep Moss at 35%) and shows the Edit button on overlay/control. Template, recent and history previews follow the same rule. The download is an Icon button. Keyboard focus shows the same overlay and Edit button as hover." **ResultCard lacks**: an `editing`/selected state (0.75 outline), a size (regular 264 / compact 184), fit-to-column clamping, the gone-template well, `aria-current`, a blocked download (40%, still clickable) and a provenance description. Download is drawn at 34; ResultCard uses the 32 Icon button (PHASE-2 §8 decision). The meta line is 12 medium /1.4. |
| Preview hover overlay + Edit button | Preview overlay 104:584 | `PreviewOverlay` | Fits. Generate's DraftCard uses the older `EditOverlay`. |
| Caption card | (no master id given; "Caption card") | Generate `CaptionCard.tsx` (with switch) and TemplateChatViews' private `CaptionCard` (no switch) | **Not a primitive.** Two implementations. The Generate frames keep the platform switch, the template frame (13:7920) has none. Make it one component with optional tabs. |
| Platform switch in caption, Size switch in panel | Segmented control 49:51 / Segment 49:50 | `SegmentedControl` in `primitives/Toggles.tsx`; Generate uses its own `SegmentSwitch` (caption / editor variants) | The caption switch has hugging segments (selected 86, others 86 fixed). The editor switch has flex-1 segments. Labels are 13 medium /1.3 (caption) vs /1.25 (editor). |
| Try next chips | Chip 98:515 | `Chip` (Chips.tsx); Generate uses `SuggestionChip` + `ChipRow` | Fits (28, padding 10, radius 7, t-button-s). The "Try next" label row is not a primitive (ChipRow). |
| Copy caption, Close, Download | Icon button 95:516 (Filled) | `IconButton` | Description: "Filled is the round button inside cards and panels, like Copy caption, Close and Download. … Hover adds state/hover and Pressed adds state/pressed … Disabled is 40% opacity. Keyboard focus draws a 1px focus/ring 2px outside the edge." Download at 34 is the exception. |
| History / New chat / Download PNG | Button 43:123 | `Button` (primary, neutral) | Download PNG is 59 tall, full width, radius 9, padding 18. No Button size gives that; it is closest to "lg". **Check the sizes.** |
| Editor fields | Field 48:38 + Input 48:37 | `Field`, `Input` (with Edited / Optional / Action markers) | Fits. "Optional" marker at the right end. Today's legacy panel uses `EditorField` + `FieldInput variant="chat"`. |
| Image slot (not in frame) | Upload 216:2291 | `Upload` | Not drawn in 13:3150. Today's panel shows image slots the photo does not fill. |
| Composer | Chat box, Attach button 102:569, Send button 44:9, Tag 52:63 / Detail tag 61:464 | `Composer` (generate), `AttachButton`, `SendButton`, `DetailTag` | Already built (shell/Phase 3?). The frame shows the box at 760 / 611. |
| User message | (photo + bubble) | `UserMessage` | Not a Master primitive. |
| Assistant header | SocialPaint mark 20 | `AssistantHeader` | Not a primitive. |
| History search | Search field 50:62 (collapsed) | `SearchField`, `LibrarySearch` | Today History uses `TemplateSearchField` (always open). |
| History chips | Platform chip 53:96 + Platform logo 53:73 | `PlatformChip`, `PlatformFilter` (templates) | Today History uses `GroupChips`. Reuse `PlatformFilter` with `allLabel` "All chats" (it needs that prop; the library's reads "All"). |
| Rail fade | sp-railfade | `PlatformFilter`'s `useEdgeFade` (`sp-lib-rail`) | Fits. |
| History card (default + loading) | sp-history-card (no master id given) | Generate `HistoryCard.tsx` | **Not a primitive.** The geometry matches today's card (square, 8 frame, stage padding 16, title + meta). The meta type matches (label-m / caption-s). |
| Scroll fades (top 68/56, bottom 132) | none | `ScrollFade` | Not a primitive. |
| Breadcrumb | none in my list | `ChatBreadcrumb` | The Figma root crumb is not underlined. |

---

## Behaviour differences vs code

### Result (GeneratePage thread + AssistantTurnView + DraftCard + CaptionCard)
1. **Result card meta line**: Figma shows "1080 × 1350" (size only) on both Regular and Compact. Code: Regular shows "1080 × 1350 · **4:5**" and Compact shows the **platform** ("Instagram"), per §15 item 17. **Both change** under the frames: the ratio is dropped, and Compact no longer swaps to the platform. CJ made the Compact call before, so raise it (open question 3).
2. **Edit affordance**: Figma's hover shows a 40 white circle with a pencil (Preview overlay). Code uses `EditOverlay` (Brand Studio's) over a whole-preview button. Check whether the whole preview stays the click target (today) or only the Edit button is (the PreviewOverlay primitive has a separate Edit button). Keep the whole preview clickable; that is a familiar interaction.
3. **Download**: 34 sunken circle, the same as today's `DownloadButton`. Unchanged. The busy and blocked (40%, still opens the editor on the missing field) states are not drawn; keep them.
4. **Caption card**: the frame keeps the **per-draft platform switch** ("Instagram" / "LinkedIn") and **Copy**. That is the same behaviour as today (tabs per draft, copy with a check for 1.5s). The geometry differs a little: header 40 vs today's 36 Loading header, padding 16/16/20/20. **No loss.**
5. **Try next row**: present ("Try next" + 3 chips: fill-field "Add a location", platform "Make a Facebook version", layout "Try another layout"). The labels match `deriveTryNext`'s forms exactly. **No loss.**
6. **Status sentence**: same (the server's reply once done). The frames do **not** draw the running state (progress row "2 of 3 · …", skeleton cards, the Loading caption card), warnings, a failed turn's **Try again**, the **Fill in** row, "This chat is full…", "This chat isn't saved yet." or the photo-not-saved note. None are dropped deliberately as far as I can see; they are simply undrawn states. Keep them all.
7. **Composer footnote**: Figma has the legal links only. Code's `ChatFootnote` also says "**Every graphic follows your Brand Studio rules.**" The frames drop that line (the template chat already dropped it, 13:7195).
8. **Breadcrumb root**: Figma's "Generate" has no underline. Code underlines it.
9. **Header buttons**: Figma History = Button neutral (sunken), New chat = Button **primary** (field-green). Code: History `ChatButton kind="tertiary"`, New chat `kind="secondary"`. These are visual only, but New chat becomes the primary action.
10. **Thread layout**: the thread is justified to the **bottom** (justify-end) with 16 top / 32 bottom padding and a 68 top fade. Code has a top ScrollFade too; check the 32 bottom room.
11. **Result card wrapping**: the frame's two cards fill exactly 760. Code wraps the drafts and clamps a wide card to the column (`maxWidth`). Keep that.
12. **User message**: the photo sits **above** the bubble, right aligned (64, radius 9). Check UserMessage's order.

### Edit (EditorPanel legacy / inline)
13. **Structure matches today's inline legacy panel** (not DetailsPanel): chat narrowed to 611, a 24 gap, panel 380, "Edit details" + Close, Size switch, a 290 stage inside the panel, the fields, spacer, footer. Cards go Compact (184) and the edited card is outlined, the same as today (`cardSize={editorOpen ? "compact" : "regular"}`, `selectedDraftId`). **Size switch, stage-in-panel and linked fields across drafts all keep.** The frame's fields (Headline, Role, Button text, Button link, Location) are one input per linked group, which reads as linked.
14. **Footer**: the frame has **Download PNG only**, full width and 59 tall. Code's legacy footer has:
    - the hint "**Edits update both sizes.**" / "Edits update every size." (dropped in the frame);
    - **Save to library** (admin + freestyle draft), then "Saved to Brand Templates." + "Open in the builder" (dropped);
    - **Discard** (tertiary, enabled once something changed): GeneratePage passes `onDiscard={discard}` in both modes (dropped);
    - "Fill required: …" note under Download when blocked (not drawn).
15. **Fields**: the frame draws **no "Edited" markers**. Code passes `openDrafts` so changed fields say Edited. The frame also has no error line, no stage layout warning ("first layout warning shows under it"), no Look switch, no Caption field and no image/Upload rows. In today's legacy branch, Look and Caption are passed only in the template editView, so the legacy panel never has them; the image rows and the warning are real legacy behaviour the frame does not draw.
16. **Field chrome**: label 12 medium secondary, "Optional" on the right (Field primitive's marker). Today's `EditorField` with `optional`: check where it draws Optional. Inputs are 40 / radius 9 / --input-bg.
17. **Download PNG styling**: Light field-green/accent text, Dark accent/field-green (see Dark 2). Today it is `ChatButton kind="primary"`. Check that it swaps in Dark.
18. **Sheet below 1180px**: the frame only shows 1440 inline. The sheet (scrim, modal, Tab trap) is not drawn. Keep it.
19. **Stage fill**: the frame stage has no fill (white on white). Code: "290 tall on the --gen-well". Check it and decide.
20. **Panel height**: it fills the row from header+24 to the page bottom (28). The chat column starts 24 under the header too (both have a 24 top offset in the split).
21. **Composer while editing**: the box widens to the chat column (611). Today's compact composer likely caps at 760, so it is already full width at 611. Check it.

### History (GenerateHistoryPage + HistoryCard)
22. **Description line dropped**: "Every chat and the posts it made, newest first. Open one to pick up where you left off." is not in the frame.
23. **Search**: the frame shows the **collapsed 50 Search field** (search icon only) at the start of the chip rail. Code uses `TemplateSearchField` (an always-open field with "Search chats"). The frames move to `LibrarySearch`-style collapse (open on click, a field with a query never collapses, Escape collapses an empty one). **Search survives**; its look and default state change.
24. **Platform chips**: the frame uses `PlatformChip`s (50 tall, tile + mark + chevron) in a fading rail. Code uses `GroupChips` with `allLabel="All chats"`. The behaviour is the same single-select filter, URL-backed. **Facets**: the frame shows **all five platforms** (Instagram, LinkedIn, Facebook, Email, Website), but the chats in the grid only use Instagram/LinkedIn. Code shows **only the platforms the member's chats use** (platformsInUse). **Open question 4.**
25. **Selected chip**: Light inverse (black), Dark #2f3133 with a green glyph. The chevron points down when selected.
26. **Grid**: Figma has a fixed **4 columns** at 1015 (244.75 cards), gap **12**, square. Code is `repeat(auto-fill, minmax(220px, 1fr))`, gap --space-xs. At 1015, minmax(220) gives 4 columns. Check that --space-xs is 12.
27. **Paging**: the frame shows 7 chats + **5 loading cards** (the last row of row 2 and all of row 3), consistent with today's infinite scroll (12 a page, sentinel 400px early, loading cards finishing the row). **Paging stays.** The bottom fade is 132 tall; check `ScrollFade` bottom's height.
28. **Scroller offset**: the grid scroller starts 16 under the filter bar with 24 top padding in it (40 from the chips to the first card row).
29. **History card**: the same anatomy as today (square, 8 frame, stage padding 16, title t-label-m + meta t-caption-s "Instagram, LinkedIn · Today"). There is **no hover/edit overlay drawn** on History cards, but the Result card master's description says "history previews follow the same rule" (hover dims + Edit). Today a History card is one "Open <title>" button with no overlay. **Open question 6.**
30. **Empty / no-match / error states** are not drawn (No chats yet + New chat, "No chats match “q”." + Clear, ErrorState with retry). Keep them all.
31. **Focus behaviour** (title focus on arrival from a chat, composer focus on open) is not drawable. Keep it.

### RecentChats
32. None of my three frames shows the Start state, so `RecentChats` (Start's "Recent" row, View all → History) is neither drawn nor contradicted here. The History card's anatomy (the Result card description: "Template, recent and history previews follow the same rule") implies Recent cards also get the hover overlay. Leave RecentChats as is for this spec.

---

## Interactions the frames drop

Flagged because CJ dislikes losing familiar interactions. Each is today's behaviour and is absent from the frames:

1. **Save to library** in the editor (admin, freestyle draft), with "Saved to Brand Templates." + "Open in the builder". **Dropped in 13:3150.** This is the only path from a Generate draft into the library. Recommend keeping it.
2. **Discard** in the editor footer (puts edits back). **Dropped.**
3. **"Edits update both sizes." hint**. **Dropped.** It explains the linked fields.
4. **Edited markers** on changed fields. **Not drawn** (the Field primitive supports them).
5. **"Every graphic follows your Brand Studio rules."** in the composer footnote. **Dropped.**
6. **History description line**. **Dropped** (copy, not an interaction).
7. **History search as an open field**: becomes a collapsed icon (one more click to search). The interaction survives in another form.
8. **Compact card meta showing the platform**: the frames show the size instead. This is CJ's own earlier call (§15 item 17).
9. **Size ratio in the Regular meta** ("· 4:5"). **Dropped.**

Kept, explicitly drawn: caption tabs per draft with Copy, Try next chips, the size switch with the stage in the panel, card Download, Download PNG, Close, History paging (loading cards), the platform filter, search, New chat and History buttons.

Not drawn but not contradicted (keep): progress row and skeletons, warnings, Try again, Fill in row, chat-full / not-saved / photo-not-saved notes, the editor's export error toast, "Fill required" blocking, the sheet below 1180, image slots in the editor, the layout warning on the stage, History empty/no-match/error states, and the gone-template card.

## What the frames add

1. The **editing outline** is explicitly specced: 0.75px --text-strong (Light) / --text-primary (Dark). Today's outline is "inside outline in the inverse ink", which is the same idea, so check the width.
2. The **Download PNG** Dark inversion (accent fill, field-green text).
3. History's **collapsed search + PlatformChip rail** (the library's filter bar).
4. History **New chat as the primary button** (and in the chat header).
5. All five platform chips visible in History (if read literally).

---

## Open questions

1. **Save to library / Discard / hint in the Generate editor**: the frame's footer is Download PNG alone. Keep all three (recommended: keep Save to library and Discard, stacked above Download PNG as today), or drop them as drawn?
2. **Edit = legacy inline panel, confirmed?** 13:3150 is the side panel with a size switch and its own stage, while the template chat's Edit details (13:8148) is stage + DetailsPanel. Should Generate's legacy panel be rebuilt on `DetailsPanel`'s parts (Field/Input/Optional, the Download button) while keeping its inline layout, or stay `EditorPanel` restyled? Should it gain the Edited markers that DetailsPanel has?
3. **Result card meta**: the frames show the size alone on both Regular ("1080 × 1350", no "· 4:5") and Compact (not "Instagram"). Follow the frames, reversing CJ's §15 item 17 Compact call?
4. **History chips**: show all five platforms always (as drawn) or only the platforms the member's chats use (today, matching Brand Templates' rule)?
5. **History search**: collapse to the 50 icon by default (as drawn, like the library), or keep the open "Search chats" field?
6. **History card hover**: should History (and Recent) cards get the Preview overlay hover? The master says "history previews follow the same rule". If so, what does the Edit button do: open the chat, or open the editor on its first draft?
7. History mock cards 2 to 7 draw text in the preview well with no 16 inset. I treat this as placeholder art and keep the padded, centred graphic for every card. Confirm.
8. **New chat as primary** (field-green) in the chat header and History, replacing today's secondary; and History as neutral (sunken) instead of tertiary. Confirm. The Dark New chat is #2f3133 with green text, not field-green; is that the primary button's Dark look app-wide?
9. **Chip fill in Dark**: the frames use --surface-sunken (#2f3133); the Chip primitive uses --control-fill (#171819 in Dark). Which wins?
10. **Editor stage fill**: none in the frame vs today's --gen-well. Which?
11. **"Every graphic follows your Brand Studio rules."**: drop it from the Generate footnote as the frames do?
12. The ResultCard primitive needs an editing state, regular/compact sizes, a blocked download and the gone-template well before Generate can adopt it. Extend the primitive, or keep `DraftCard` restyled?
