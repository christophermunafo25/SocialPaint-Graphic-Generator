# New look, Phase 6: Brand Studio

You are a senior front-end engineer on SocialPaint (this repository). This phase rebuilds Brand Studio to the Figma file "Master UX-UI":

- **Overview** (`/brand-studio`): the setup strip and the six category cards, with five new cover images (§9 D1).
- **Colors, Logos, Fonts, Type styles, Images and Import** (`/brand-studio/:category`): the breadcrumb header with the save status and Undo, and each page's cards, rows, editors and menus.

It also lands the one behaviour change PLAN.md schedules here: **font roles move from Fonts to Type styles** (§9 D3).

Be exact. Work through the steps in §5 in order, run the checks each step names, and commit after each step with `npm run verify` green (chain the commit on it: `npm run verify && git commit`). If something here turns out to be wrong once you are in the code, stop and explain the conflict instead of improvising.

**A note on familiar interactions.** CJ has asked to keep interactions people already use when a frame leaves them out (Phase 4's look-stepping hover and step form, Phase 5's attach menu). The frames here drop many; §9 D7 to D9 records what CJ kept, including the edit overlay on the Overview, color and logo cards. If you find another one, stop and ask.

Brand Studio is **admins only** (`ADMIN_ONLY` in `src/app/router.tsx`, and the sidebar item is `adminOnly`). Members never reach these pages; the member half of the click-through only confirms they still can't.

---

## 1. Read these first

1. `docs/design/new-look/PLAN.md` (decisions 3 and 6, and "Behavior changes that need data or product work"), `RULES.md` (§6, the preview hover), `BRIDGE.md` (§3: `--edit-chip-bg` and `--media-overlay` are read by Brand Studio's edit overlay), and `PHASE-4.md` and `PHASE-5.md` (§8 and §9, for the patterns this phase repeats).
2. `docs/design/new-look/PHASE-6-SCREENS.md` in full ("the reference"):
   - **Part A:** Overview 13:9043, Colors 13:9309, Colors · Editing 13:9470, Colors · Added 13:9657.
   - **Part B:** Logos 13:10014, Logos · Editing 13:10150, Logos · Primary changed 13:10300, Fonts 13:13689, Fonts · Row menu 13:13830, Fonts · Uploading 13:13980.
   - **Part C:** Type styles 13:10888, Type styles · Editing size 13:11041, Type styles · All properties 13:11196.
   - **Part D:** Images 13:11956, Images · Uploaded 13:12050, Images · Row menu 13:12176, Import 13:12670, Import · Importing 13:12772, Import · Done 13:12879.
   - Each Light frame's Dark twin is listed there.
3. The reference images `docs/design/new-look/reference/brand-studio-*.png`, and the six covers in `reference/covers/`.
4. The code, under `src/app/components/admin/brand/`:
   - **Pages:** `BrandOverview.tsx`, `BrandDetail.tsx`, `BrandDetailHeader.tsx`, `ColorsDetail.tsx`, `LogosDetail.tsx`, `FontsDetail.tsx`, `TypeStylesDetail.tsx`, `ImagesDetail.tsx` and `ImportDetail.tsx`.
   - **Shared:** `categories.ts` (counts and readiness), `kitPlumbing.ts` (autosave, the undo stack, ⌘Z, toasts and the "Restyled N fields" blast radius), `kitOps.ts`, `addFlow.ts` (the strip's add flow), `useLinkClick.ts`, `contrast.ts`.
   - **Local primitives:** `primitives/AddSlot.tsx`, `EditOverlay.tsx`, `RowMenu.tsx` (opens at the pointer for right-click), `Tag.tsx`, `TagChoice.tsx` and `useInPlaceEdit.ts`.
   - **Type styles editor:** `src/app/components/admin/TypeStylesEditor.tsx` (only `TypeStylesDetail` renders it).
   - **Font roles:** `BrandKit.headingFont` / `bodyFont` in `src/lib/types.ts`, and every reader: `src/lib/theme.ts` (which also sets the unread `--brand-font-heading` / `--brand-font-body`), starter materialisation, the builder's default face for a new text field (`fieldOps`, `TemplateBuilder`), `FieldInspector`'s "Brand fonts" group, `loadBrandFonts`, onboarding and the website import, and `categories.ts`.
   - **Covers:** `src/assets/socialpaint/brand-studio/brand-studio-cover-*.webp`.
   - **Preview hover:** `primitives/Previews.tsx` (`PreviewOverlay`).
5. The primitives in `src/app/components/primitives/`, `layout/Breadcrumb.tsx` (`BreadcrumbHeader`), and `LegalLinks` (`generate/LegalLinks.tsx`).

## 2. What changes

| Surface | Today | After this phase | Figma |
|---|---|---|---|
| Overview | Title, setup strip, six cards with flat lilac covers, the pencil overlay on hover | Title, the strip on one baseline row with radius-2 bars, six cards (radius 20, a 3:2 plate at radius 15, title over a sentence-case meta line) with five new gradient covers (Images keeps today's), the edit overlay rebuilt on `PreviewOverlay`, legal links | 13:9043 |
| Detail header | An h1 with the breadcrumb above it, the save status, Undo with a ⌘Z hint | `BreadcrumbHeader`: "Brand Studio" / the page, then the save status and Undo (Button neutralOnPage with its icon) | every detail frame |
| Colors | Swatch cards that turn into the editor in place; native picker on the swatch | Cards with the edit overlay and a 1px `--text-strong` ring while open; a 300-wide popover editor 10 below the card (Name, Hex with the picker, the contrast lines, Role on ChoiceChips, Remove and Done); the grid blurs 1.5px behind it | 13:9309 to 13:9657 |
| Logos | Plate cards with the edit overlay, the surface filter, the in-place editor | Cards at radius 20 with Tag tags and the edit overlay on `PreviewOverlay`, the SegmentedControl filter, the editing card on ChoiceChips and Input sm with Done; Primary changed toast as today | 13:10014 to 13:10300 |
| Fonts | Face rows with Heading/Body tags, a role menu and "Change face…" | A library of uploaded files: family, file name and specimen, a menu of Rename, Replace file and Remove; an Uploading row with an indeterminate bar. No roles | 13:13689 to 13:13980 |
| Type styles | An accordion editor in the row, mono values, a red delete | Flat rows (specimen, font · weight, size / line height / tracking, a role tag, a visible menu trigger); inline value editors; the All properties editor as a two-column form with ChoiceChips (Use for, Always uppercase, Shrink to fit the box), the rules box and Done; font roles live here (D3) | 13:10888 to 13:11196 |
| Images | Cards with a hover-only menu, red Remove, the empty-state helper | Cards at radius 20 with a 15 plate and "JPG · 1200 × 800" meta, a visible trigger, a menu of Rename, Download, Copy link, Remove | 13:11956 to 13:12176 |
| Import | Figma link and tokens.json cards with helper lines, a shimmer while importing | The same two sources on the new cards, an indeterminate 4px bar while importing, Done with "View colors" and "Undo import" | 13:12670 to 13:12879 |
| Toasts | Centred on the viewport, 3px top bar | The `Toast` primitive, centred on the page area (§8) | every "changed" frame |

## 3. Invariants

- **Every route and role stays as it is.** `src/app/routes.test.ts` keeps passing; members still can't reach Brand Studio.
- **Multi-tenant (PLAN decision 6).** Everything inside these pages is the account's own content. The frames' Slime, Raveo, Acme logos and photos are samples and are never seeded. The one exception is the six cover images, which are shared platform art and look the same in every account.
- **The kit's data keeps working everywhere it is read.** Templates, the builder, the fill page, the renderer and both chats read the brand kit; nothing this phase changes may move a rendered template unless §9 says so. D3's migration is the one data change: its rule is recorded there, and it runs only after CJ has read its dry-run count.
- **Autosave, Undo and ⌘Z stay** (§9 D2): every change saves, is one Undo step (coalesced per page), and the header reports it. Escape cancels an edit and drops that edit's undo steps (D7 to D9).
- **Tokens and primitives only** in what this phase rebuilds. New code reads no legacy name; the old edit overlay's `--edit-chip-bg` and `--media-overlay` readers go with it once the overlay is on `PreviewOverlay` (BRIDGE §3).
- **Behaviour that stays,** drawn or not:
  - **Loading and errors:** each page's loading skeleton, the save error banner, the upload errors (wrong format, over 5 MB) and Import's error lines.
  - **Uploads:** drag and drop onto the empty zone and the Add slots, several files at once, SVG, and the downscale before upload.
  - **Guards:** "A logo needs at least one surface.", the in-use blocks on Remove (logos and images name the templates that use them), the primary handoff when a logo leaves a surface, the first logo being primary on both surfaces, and Remove hidden for the five default palette keys. D6 adds two guards and fixes one undo step.
  - **Links:** cards and crumbs stay real links (cmd-click opens a tab), the strip's action opens its category's add flow on arrival, and the surface filter stays in the URL.
  - **Keyboard:** Enter, Escape and click outside in every editor, focus back to the card or row an editor closes on, the value inputs' arrow-key stepping, and right-click opening a row menu at the pointer (D7).
  - **The blast-radius toast** ("Restyled N fields in M templates"), the unsaved-changes guard on tab close, and the flush on leaving a page (`admin/BrandStudio.tsx`).

## 4. Before you change anything

1. Baseline the screens: `npm run shots -- capture .shots/before` and `npm run shots -- props .shots/props-before.json`.
2. Read `kitPlumbing.ts` end to end: every editor in this phase sits on its autosave and undo stack (D2 keeps it), and Escape's cancel must drop its edit's undo steps (D7 to D9).

## 5. Steps

### Step 1: the shared pieces

- **Detail header.** `BrandDetailHeader` moves onto `BreadcrumbHeader`: "Brand Studio" (not underlined) / the page title as the h1, then the save status and Undo, Button neutralOnPage with the undo icon, disabled at 40% when there is nothing to undo. The ⌘Z hint goes from the header (D9); the shortcut stays. `BreadcrumbHeader` gains an `href` on a crumb so "Brand Studio" stays a real link.
- **Toasts** move onto the `Toast` primitive, placed per §8.
- **Legal links** under the Overview and every detail page, as drawn (`LegalLinks`, not underlined).
- **Indeterminate progress.** `ProgressBar` gains an indeterminate variant (the 4px track with a sliding `--accent-green` segment; a still segment under reduced motion) for Fonts · Uploading and Import · Importing. Add its specimen to `/dev/ui`.
- **Row menus.** Every row menu moves onto the `Menu` primitive, with its trigger (`RowMenuTrigger`) shown at rest, as drawn. The `Menu` primitive gains a context-menu mode (Radix ContextMenu) so right-click still opens a row's menu at the pointer (D7). Destructive items per D6.
- **Edit overlay** (D8). `PreviewOverlay` gains a decorative mode: the Deep Moss dim and the Edit circle drawn as part of a card that is itself the control, `aria-hidden`, never a second button (RULES §6). The Overview, color and logo cards use it on hover and keyboard focus.
- **Undo** (D7 to D9, D6). Escape drops the undo steps recorded by the edit it cancels (`useInPlaceEdit.cancel` with `kitPlumbing.ts`), so Undo can't reapply part of a cancelled edit. Test it.
- Commit: "New look phase 6: the shared pieces".

### Step 2: the Overview and its covers

Build to Part A §1, per §9 D1 and D8.

- The setup strip on one baseline row: "4 of 5 sections ready", the reason, the radius-2 bars, and the action as Button primary. "All 5 sections ready" keeps Dismiss, without its "Your templates have everything they draw from." line (D9). The fonts check reads Type styles per D3.
- Six cards: radius 20, the 3:2 cover plate at radius 15, the title in `.t-label-l` over the meta line. Meta in sentence case: "10 colors", "3 logos", "4 fonts", "4 styles", "Empty", "Figma or JSON". Each card carries the edit overlay (D8).
- **Covers** (D1): replace the Colors, Logos, Fonts, Type styles and Import WebPs with the art in `reference/covers/`. Leave the Images cover as it is until CJ confirms the rights to its two photos.
- Commit: "New look phase 6: the overview".

### Step 3: Colors

Build to Part A §2 to §4, per §9 D2, D4, D6, D8 and D9.

- Swatch cards on the new card with the edit overlay (D8); the open card takes the 1px `--text-strong` ring on its edge and `aria-expanded`.
- The popover editor (300 wide, Elevation/Medium, 10 below the card, placed per §8): Name and Hex on Input sm, the picker (D4), the contrast lines ("Ink 14.7:1 passes", "White 1.3:1 fails"), Role on ChoiceChips (None, Primary, Secondary, Accent), then Remove (neutral, D6) and Done (D2).
- The grid and the roles summary blur 1.5px while it is open (§8).
- Colors · Added: a new color opens its popover with its name selected, as today.
- Commit: "New look phase 6: colors".

### Step 4: Logos

Build to Part B §1 to §3, per §9 D2, D6 and D8.

- The surface filter on `SegmentedControl` (All, On light, On dark), still in the URL.
- Logo cards: radius 20, the plate on `--plate-light` / `--plate-dark` (§8), tags on `Tag` default ("Primary", "Dark"), and the edit overlay (D8).
- The editing card: Name on Input sm, the surfaces and "Primary on" on ChoiceChips, then Remove (red: the file goes, D6) and Done (D2). Primary changed keeps today's handoff and toast.
- **Fix** (D6): removing a primary logo records an undo step that would restore a primary pointing at the deleted file. The handoff after a removal must not be undoable back onto the gone asset; test it.
- Commit: "New look phase 6: logos".

### Step 5: font roles move to Type styles

Per §9 D3. **The data change lands here, in its own commit, before either page's look.**

- Add the role to type styles (`useFor`: `"heading"`, `"body"` or none; one style holds each) and move every reader per D3: new text in the builder binds to the Heading style, starter seeding binds display slots to Heading and body slots to Body, fonts load from the faces the type styles use, the builder's "Brand fonts" group lists those faces plus uploaded fonts, and the Overview's fonts check moves to Type styles. Drop `--brand-font-heading` / `--brand-font-body` from `theme.ts`.
- **The migration** (D3), a data fix on `brand_kits` and the same pass in the local DB upgrade (`src/lib/stores/local/db.ts`): the styles keyed `heading` and `body` take the roles; a style still on its default face (Montserrat for Heading and Subhead, Inter for Body) takes the account's chosen face (`heading_font` / `body_font`); every other style keeps its face. `heading_font` and `body_font` stay in the table, unread, until Phase 9.
- **Dry run first.** A script that reports, without writing: the kits it would change, the styles it would restyle, and the bound template fields that would render in a new face. Its output goes in the PR, and the migration runs on prod only after CJ has read it.
- Tests: the rule on a kit whose styles and faces agree (nothing moves), an onboarded kit (default faces take the chosen faces), and one where an admin changed a style (it keeps its face); each reader gets the face D3 says.
- Commit: "New look phase 6: font roles on type styles".

### Step 6: Type styles

Build to Part C, per §9 D2, D3, D5, D6, D7 and D10.

- Rows: the specimen in the style's own face (§8), "Raveo Display · 500" in `.t-body-s`, then size / line height / tracking, and the menu trigger. Card padding 8 with rows inset 24, row padding 20, as drawn.
- Editing size: the inline value editor, keeping the arrow-key stepping; line height and tracking edit in place too (D5).
- All properties: the two-column form (Name, Font, Weight, Color, Fixed size, Max characters, Letter spacing, Line height), then one row of ChoiceChips: **Use for** (None, Heading, Body; D3) beside "Always uppercase" and "Shrink to fit the box"; the rules box on `--surface-sunken` with its lock lines; then "Delete style" (neutral, D6) and Done (D2).
- Picking a role for a style moves it from the style that held it, with a toast like the color roles' ("Heading set to Display").
- The row menu keeps Rename, Duplicate, Edit all properties and Remove; rename in place stays (D9).
- **Guard** (D6): a style that template fields use can't be removed; the message names the templates, as logos and images do. Today the fields are left pointing at a missing style.
- Commit: "New look phase 6: type styles".

### Step 7: Fonts

Build to Part B §4 to §6, per §9 D3 and D6.

- Rows: the family, the file name, the specimen in the face, and the menu trigger.
- The row menu: Rename (the label only), Replace file, a divider, Remove (red; D6).
- **Guard** (D6): a font a type style uses can't be removed; the message names the styles.
- Fonts · Uploading: the uploading row with the indeterminate bar, then the "Added" check, then the row (D9).
- Commit: "New look phase 6: fonts".

### Step 8: Images and Import

Build to Part D, per §9 D6, D7 and D11.

- **Images:** cards at radius 20 with the 15 plate and "JPG · 1200 × 800" meta; the empty zone and the Add slot with the dashed `--text-secondary` edge; the row menu (Rename, Download, Copy link, divider, Remove in red, D6); an uploading card while files upload, and drag and drop (D9).
- **Import:** the Figma link card and the tokens.json card; Importing with the indeterminate bar; Done with the summary, "View colors" (Button neutral) and "Undo import" (a text link), per D11.
- Commit: "New look phase 6: images and import".

### Step 9: legacy names and docs

- **Delete** what nothing renders any more: `primitives/EditOverlay.tsx` (replaced by `PreviewOverlay`'s decorative mode), `RowMenu.tsx` (replaced by the `Menu` primitive's context-menu mode), `Tag.tsx` and `TagChoice.tsx` once their callers use `Tag` and `ChoiceChip`, the old accordion parts of `admin/TypeStylesEditor.tsx`, and the five replaced covers.
- Delete the `.sp-brand-*`, `.sp-style-row*`, `.sp-swatch*` and related rules and the legacy names only they read; drop `--edit-chip-bg` and `--media-overlay`'s Brand Studio readers from BRIDGE §3.
- **ARCHITECTURE:** Brand Studio on the new look, and where font roles live now (type styles' Use for; `heading_font` / `body_font` unread until Phase 9).
- Commit: "New look phase 6: legacy names and docs".

### Step 10: the gate

1. **Build.** `npm run verify` and `npm run build` pass.
2. **Reachability.** `routes.test.ts` passes. Click through on the local backend as an admin (and confirm a member still can't reach Brand Studio):
   - **Overview:** every card opens its page; the strip's action opens its add flow.
   - **Colors:** open a color, rename it, change its hex (and with the picker) and role, Escape, then Undo (nothing of the cancelled edit comes back), click outside, add a color, remove one; Undo and ⌘Z.
   - **Logos:** upload, filter by surface, edit, switch the primary, try to remove one in use, remove a primary one and Undo.
   - **Type styles:** edit a size inline, open All properties, change the font and weight, move Heading to another style, try to delete a style fields use, delete one they don't.
   - **Fonts:** upload a font, rename it, try to remove one a style uses.
   - **Images:** upload, rename, download, copy the link, remove one in use.
   - **Import:** a tokens.json (the Figma leg needs the Supabase backend), then Undo import.
   - **Elsewhere:** open the builder (add a text field: it binds to the Heading style), a template chat and the fill page, and confirm the brand faces and colors render as before.
3. **Screens.** `capture .shots/after`, then `compare .shots/before .shots/after .shots/diff`.
   - **Expected changes:** `brand-studio`, `bs-*`, and `/dev/ui` (the indeterminate bar).
   - **Everything else:** 0%. A template that renders differently is a D3 migration bug.
   - **Side by side** with the reference images in Light and Dark: all nineteen states, capturing those the routes don't reach by script. The Overview's Images cover is expected to differ (D1).
4. **Keyboard**, both themes: the strip and cards; each editor (open, Tab through, Enter, Escape, focus return); every row menu (open, arrows, Escape, and right-click per D7); the surface filter; the inline size editor's arrows; Import's field and buttons.
5. **Open the pull request** into `main`: "New look, Phase 6: Brand Studio". Include:
   - what changed, and D3's migration with its rule and its **dry-run count**; the migration runs on prod only after CJ reads it
   - the `compare` table and side by sides
   - every ruling and decision as built
   - the proposed copy
   - surprises

## 6. Out of scope (do not do these here)

- Settings and Insights (Phases 7 and 8).
- New import sources: the website pull (`brand-from-website`, onboarding only), guidelines.md (`parseGuidelines`), Canva and PDF. The frames draw Figma and tokens.json only (§9 D11).
- The Template Builder's own UI, beyond keeping it working with D3.

## 7. Expected changes

- **Changes:** the Overview and the six detail pages, as §2 describes, and five covers.
- **Data:** D3's migration on `brand_kits`, after CJ reads the dry run.
- **Unchanged:** every other screen.
- **New copy from the frames:**
  - Overview meta: "Empty", "Figma or JSON", and the counts in sentence case
  - Colors: "Role", "None", "Primary", "Secondary", "Accent", "Remove", the contrast lines ("Ink 14.7:1 passes")
  - Every editor's "Done" (CJ, D2; the frames' layer name)
  - Fonts menu: "Rename", "Replace file", "Remove"
  - Images menu: "Rename", "Download", "Copy link", "Remove"
  - Type styles: "Fixed size (px)", "Max characters", "Letter spacing (px)", "Line height", "Always uppercase", "Shrink to fit the box", "Delete style"
  - Import Done: "View colors", "Undo import"
  - "All changes saved"
- **Proposed** (not in the frames; list in the PR): "Use for" with None, Heading and Body (CJ, D3); the role toast ("Heading set to {style}"); the two new guard messages (D6); and the indeterminate bars' accessible names.
- **Copy that goes** (list each in the PR): the ⌘Z hint, "Your templates have everything they draw from.", the Images empty-state helper ("Drop JPG, PNG, or SVG files here…"), Import's helper lines, the Fonts role tags, role menu and "Change face…", and "Save" (the frames' label; Done replaces it).

## 8. Rulings on what the file leaves open

| Item | Ruling |
|---|---|
| 12 / 1.4 text (meta lines, hexes, tags, labels) | The nearest class, `.t-label-xs` or `.t-caption-s` (1.25); the 1.4 leading is noted in the PR. No new text style without Figma (RULES §1). |
| Dark lit edge on cards | RULES §4: Elevation/Small only, no separate `--border-raised` stroke; the frames draw one in Dark. |
| Surface filter track | The `SegmentedControl` primitive's `--control-track`; the frames' raw fills match neither theme. |
| Logo plates | `--plate-light` / `--plate-dark` stay as recorded legacy names until Figma has plate tokens (Phase 9 or a token update). |
| Done label in Dark | The primitive's `--btn-primary-fg` (Deep Moss); the frame's ink label is not the Button. |
| Open card ring | 1px `--text-strong` on the card's edge, as drawn, like Generate's editing outline. |
| Blur behind an open editor | 1.5px on the grid and the summary, never the header, as drawn. A click on a blurred card closes the editor only. |
| Popover placement | Left-aligned 10 below the card; right-aligned in the last column; above the card when there is no room below. |
| Specimens | Size, family and weight from the tenant's data, inline: an exception to RULES §5, since a specimen previews tenant content, not chrome. |
| Inline value input | `Input` sm (32); the frame draws 28, which no Input size has. |
| Toasts | The `Toast` primitive, centred on the page column 32 above the legal links (75 above the window's foot), as drawn; the frames' 5px stroke is not a token. |
| Covers | WebP at the source's 708 × 474 (above 2x the card's plate) under today's file names; the Figma PNGs stay in `reference/covers/`. Images' export waits on D1. |
| Page heading | The current crumb is the h1 (`BreadcrumbHeader`), as on the other breadcrumb pages. |
| Import button | Button primary; disabled at 40% until the field holds a link (today's rule), not the frames' neutral-at-40% look. |

## 9. Decisions (CJ, 2026-10-05)

Numbered as in the draft. CJ's list covered D1, D2, D3, D6 and D7 to D9; D4, D5, D11 and D12 are built as the draft recommended (marked "as recommended"), and the rest of D10 as CJ answered it.

1. **D1. Covers.** Commit the new Colors, Logos, Fonts, Type styles and Import covers now. The new Images cover waits until CJ confirms the rights to its two photos ("Photo · Laptop in hard light" and "Photo · Hiring", from the brand file); today's Images cover stays meanwhile.
   - **Follow-up (CJ, 2026-10-05):** CJ holds the licence for the Images cover's photos; the new Images cover shipped after Phase 6.
2. **D2. Autosave.** Keep autosave and Undo. The editors' button reads **"Done"** (its layer is already named Done in the frames) and closes the editor; the header keeps "All changes saved".
3. **D3. Font roles move to type styles,** with a **"Use for"** setting drawn in Type styles · All properties (13:11196 / 13:11730): None, Heading and Body as ChoiceChips, inline beside "Always uppercase" and "Shrink to fit the box", like the color editor's Role row. One style holds each role, and picking a role for another style moves it there, with a toast like the color roles'.
   - New text in the builder binds to the style used for Heading, instead of copying the heading face.
   - Starter seeding binds display slots to the Heading style and body slots to the Body style.
   - **Revised during the build (CJ, 2026-10-05): take the face, don't bind.** A bound field takes every property its style defines (size, color, case), which would restyle starters and new text beyond their face. New builder text and starter slots copy the face of the Heading or Body role style instead (`roleFace`), with no binding.
   - Fonts load from the faces the type styles use, and the builder's "Brand fonts" group lists those faces plus uploaded fonts.
   - The setup strip's fonts check moves to Type styles: ready when one style is used for Heading and one for Body.
   - Drop the unused `--brand-font-heading` and `--brand-font-body` variables.
   - **Migration:** the styles keyed `heading` and `body` take the roles. The account's chosen faces win only where a style still has its default face (Montserrat for Heading and Subhead, Inter for Body), so an admin's own style choices stay. The PR includes a dry-run count (kits, styles, and bound template fields that would restyle) for CJ to read before the migration runs. `heading_font` and `body_font` stay, unread, until Phase 9.
4. **D4. Color picker** (as recommended). A picker in the popover: the app's react-colorful `HexColorPicker` (as in `src/app/components/ColorControl.tsx`), opened from the popover's swatch.
5. **D5. Type styles in place** (as recommended). Line height and tracking stay editable in place, with the arrow-key stepping, beside the drawn size.
6. **D6. Remove.** Neutral ink, as drawn, where Undo brings it back (colors, type styles); red where it can't (logo, font and image files). Keep every in-use guard and add two:
   - a type style that template fields use can't be removed (today the fields are left pointing at a missing style);
   - a font a type style uses can't be removed.

   Fix the primary logo case: removing a primary logo records an undo step that would restore a primary pointing at the deleted file.

   Font Rename changes the label only (`BrandAsset.name`), never the family styles and templates match by; Replace file keeps the asset id and refuses a file whose family differs ("That file is a different font. Upload it as a new font instead."). These two are as recommended.
7. **D7 to D9. Familiar interactions.** Keep:
   - right-click menus (the row menu trigger also shows at rest, as drawn)
   - the "All 5 sections ready" Dismiss, without its "Your templates have everything they draw from." line
   - rename in place, Duplicate, and Escape to cancel. Escape also drops the undo steps from the edit it cancels, so Undo can't reapply part of it
   - the restyle toast
   - drag and drop for uploads

   Keep the edit overlay on the Overview, color and logo cards, rebuilt on `PreviewOverlay`: the Deep Moss dim and the Edit circle as part of the card, `aria-hidden` and not a second button. This is CJ's Brand Studio direction (2026-09-15). Font rows, type style rows and image cards keep their row menus.

   As recommended, these stay too: "Saving…" / "Saved {time}" beside "All changes saved", live edits, click outside to finish, focus return, hex validation with `rgb()` input, the role toasts, Fonts' "Added" check, an uploading card for images, Import's Enter, drop on Choose, 1-second delay and error lines, and multi-file uploads. These drop as drawn: the ⌘Z hint (the shortcut stays), the Images empty-state helper, Import's helper lines, and the Fonts role tags, role menu and "Change face…".
8. **D10. Type styles' range.** The Weight select lists the cuts the family ships ("500", "500 Italic"), as recommended. Text sizing keeps the "Shrink to fit the box" chip only, as drawn (CJ, 2026-10-05): the chip sets Shrink, and a style already on Fill or Free keeps its setting and shows the chip off.
9. **D11. Import** (as recommended). Figma and tokens.json only. When Figma isn't connected, the Figma card is disabled with "Connect Figma in Settings" linking to Settings › Integrations; on the local backend it stays hidden. A successful import clears the link. Every page keeps the same header.
10. **D12. New accounts' default type styles** (as recommended). Heading / Subhead / Body in Montserrat / Inter stay, taking the onboarding faces when onboarding found some; the frames' Display / Heading / Body / Label set is sample content and is not seeded.
