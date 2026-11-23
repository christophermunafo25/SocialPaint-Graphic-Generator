# New brand, Phase 3: shell

You are a senior front-end engineer on SocialPaint (this repository). This phase builds the app frame from the Figma file "Master UX UI New Brand (Copy)" (`1dYWgFH2V8i9Jez2ylI3ky`): the viewport's padding, the Sidebar at 320 and 76, Main as a frame whose content scrolls while its header and footer stay put, the one Page Header row on every page, and one Footer Links slot. It also replaces the logo, the mark and the favicon.

Phase 2 rebuilt the components and left every page where it was. This phase moves every page into the new frame and leaves what is inside each page as it is. A page changes here only because the frame around it changed: where its header sits, where its content starts, what scrolls, and where its legal links are. Section 9 says what that covers. What is inside a page (grids, cards, filter bars, forms, threads, the builder's chrome) is Phases 4 to 8.

Be exact. Plan in plan mode first. Work through the steps in section 5 in order, run the checks each step names, and commit after each step with `npm run verify` green. If something here turns out to be wrong once you are in the code, stop and explain the conflict instead of improvising.

This prompt was written against `main` at `4bd5d1a` (Phase 2, #189). Counts in it were taken there. Recount before you rely on one.

---

## 1. Read these first

1. `docs/design/new-brand/PLAN.md` ("The app frame" and "Clipping containers" under "What Phase 0 found", and "What Phase 2 found"), `RULES.md` in full (section 10 is this phase's spec), `BRIDGE.md` sections 2 and 6, and `PROMPT.md` sections 2b and 7b.
2. `CLAUDE.md`.
3. The shell: `src/app/components/AppShell.tsx`, `Sidebar.tsx`, `BrandMark.tsx`, `DevBackendBanner.tsx`, `layout/ChromeContext.tsx`, `layout/Page.tsx`, `layout/Breadcrumb.tsx`, `generate/LegalLinks.tsx`, and `src/styles/shell.css` in full (242 lines).
4. The primitives Phase 2 built for this phase: `primitives/PageHeader.tsx` (`PageHeader`, `Breadcrumb`, `FooterLinks`), `primitives/Navigation.tsx` (`NavItem`, `Avatar`), `primitives/IconButton.tsx`, and their rules in `primitives.css`.
5. In `socialpaint.css`: the full-viewport rules (`html[data-sp-fullscreen]`, near line 1306), `.sp-page` (near line 1787), the mobile bar (`.sp-mobilebar`, near line 2345) and the breakpoint tiers (near line 2768).
6. `src/app/App.tsx`, and every page section 6 lists.
7. `scripts/new-look/shots.mjs`: the route list and `capture`.
8. In Figma, with the MCP server connected: the Sidebar (`2218:679`) on the Patterns page (`4012:1195`), with its Dark preview (`4034:2374`); the page frames section 6 names; Page Header (`4015:764`), Breadcrumb (`2213:111`) and Footer Links (`4015:750`) on the Components page; Logo (`54:66`) and Logo Mark (`61:467`) on the Product components page (`4012:1194`).

## 2. Invariants

- **Multi-tenant.** No tenant data, starter content, brand kit or graphic is touched. The name, email and initials in the frames are sample data.
- **Tokens stay generated.** This phase reads tokens and adds none. A value the file lacks is reported, not invented.
- **The shell reads semantic tokens only.** No primitive, no raw color, and no name `BRIDGE.md` lists. When this phase ends, `shell.css` and the shell's TSX read no bridged name, and the shell has no inline style objects.
- **Nothing inside a page is rebuilt.** A page changes only where the frame forces it: its header moves onto `PageHeader` and into the frame's header row, its legal links move to the frame's footer, and its own outer padding, page-tall minimum height and pinned-footer rules go. Its markup inside stays.
- **Below 1024 only colors change.** The narrow layouts keep the mobile top bar, its drop-down navigation, the document scroll and today's gutters. Their colors move onto tokens, and they take the new logo and the footer links.
- **Behavior is kept.** Every route stays reachable in both themes, for an admin and for a member. Keyboard handling, the collapsed preference (`sp-sidebar-collapsed`), the builder's borrowed collapse (`overrideSidebarCollapsed`), the pinned filter bar on Brand Templates, History's paging, every page's own focus handling and every existing test's intent survive. A test changes only because a name, a class or a heading's place changed.
- `SchemaRenderer`, the export path, `canvasGesture.ts`, the frozen types and every table column are untouched. The builder editor moves into the new frame around its own layout, so run the `fidelity-checker` subagent at the gate.

## 3. Before you change anything

```bash
npm run shots -- capture .shots/before
npm run shots -- props .shots/props-before.json
```

The full capture takes about 45 minutes and reads the working tree. Run it in the background and do not edit `src/` until it finishes.

## 4. What earlier phases left for this phase

- **Pages are on the earlier shell.** Pages render `Page` and a `PageHeader` from `layout/Page.tsx` (not the primitive), `BreadcrumbHeader` from `layout/Breadcrumb.tsx`, and `LegalLinks` from `generate/LegalLinks.tsx`. Phase 2 built the primitives `PageHeader` (a title kind and a breadcrumb kind, with `status` and `actions`), `Breadcrumb` and `FooterLinks` as their replacements and placed none of them.
- **The page column is the earlier one.** `.sp-page` pads 48 above (45 from 1280 up, set in `shell.css`), 45 or 32 at the sides and 64 below, and stops at 1720 (`--page-max`). The sidebar is 325 in a 335 wrapper (76 in 86), inset 10, and sticky in a document that scrolls.
- **Three ways of scrolling.** Most pages scroll the document. The Generate thread, its two load states, History and the builder editor call `useFullViewport`, which stops the document scrolling while they are mounted (`html[data-sp-fullscreen]`), and they scroll inside themselves. Generate and the template chat lay out their own column through `Page`'s `layout` prop.
- **Footers pinned by hand.** Brand Studio and Settings hold their legal links at the foot of a column `100dvh` tall (`.sp-bs-page`, `.sp-st-page`), and their toasts sit 75 above the window's foot. Insights pads its bottom by 40. Each reads `--chrome-top` and `--dev-banner-h` to do it.
- **Legal links in many places.** `LegalLinks` renders 7 times in 5 files: Brand Studio, Settings, Generate's start and thread, the thread's two load states and History. Brand Templates (`Portal.tsx`, `.sp-lib-legal`) and the fill page (`TemplateFill.tsx`, `.sp-fill__legal`) write their own. Insights, the Template Builder list and bulk fill have none.
- **The bridged shell names.** `--sb-bg` and `--sb-border` (the mobile bar's rule in `socialpaint.css`) and `--sb-border` and `--sb-fg-active` (three inline styles in `Sidebar.tsx`), `--chrome-top`, `--page-pad` and `--page-max` (`BRIDGE.md` section 2 lists them for this phase). `AppShell.tsx` sets `--bg-canvas` and `--font-ui` inline, and the mobile scrim mixes `--text-on-accent`.
- **The logo is the earlier one.** `logo-on-light.svg` and `logo-on-dark.svg` draw the mark in old Slime (`#17FF7E`) beside the wordmark, `mark.svg` is the mark alone in old Slime, and `favicon.svg` knocks the mark out of an old Slime tile. `BrandMark.tsx` picks a lockup file by theme in JavaScript.
- **The theme toggle waits for this phase.** `Sidebar.tsx` says the file draws no toggle in the sidebar and that Phase 3 places it (section 7, question 1).

## 5. Steps

### Step 1: recon and the plan

Read the Sidebar, the page frames in section 6 and the Logo from the file. For each page, write down in your plan: its header kind and actions, how its content scrolls, where its legal links go, and what the frame changes around it. Confirm the measurements in section 6, and where the file and section 6 disagree, the file wins and you list the difference.

Then stop at the **recon gate** and report:

1. The frame's component API (names and props, section 6 suggests a shape) and every page's call site, with counts.
2. Every difference between the file and section 6.
3. How the frame lets the keyboard scroll Main's content when nothing inside it has focus.
4. The answers you propose to the open questions in section 7.
5. Anything the frame needs that no token carries.

Wait for CJ before step 2.

### Step 2: captures through the frame

From step 3 on, Main's content scrolls inside the frame at 1024 and wider, and a full-page capture would show only the first 900 pixels of it. Teach `capture` to grow the viewport by the height Main's content hides before it shoots, so a capture still shows the whole page. It finds the content by the attribute the frame will carry (agreed at the recon gate). A page that scrolls itself (section 6) is captured at the viewport's height, as today.

With the app as it is, the change does nothing. Capture `brand-templates`, `insights` and `settings-workspace` again, and `compare` finds no change against `.shots/before`.

`npm run verify` passes. Commit: "New brand phase 3: captures through the frame".

### Step 3: the frame

At 1024 and wider, where the sidebar shows today:

- **The viewport is the frame.** `--surface-page`, 12 of padding on all four sides (`--space-12`), the Sidebar, 12, then Main. The document does not scroll. The frame stops above the local backend's banner (`--dev-banner-h`), so the pages' own reads of it can go.
- **Main** fills the rest, with 16 above and below it (`--space-16`). Its parts run its full width, each with a 32 gutter inside it (`--space-32`), so content is 1020 wide at 1440:
  - **The header row**, 36 tall, at the top.
  - **The content**, under the header row. It is the part that scrolls. The 24 between the header row and the first block is its own top padding, and the gutters are its own side padding, so a card's shadow is never cut (`RULES.md` section 4 asks for at least 12 on every side a container does not scroll toward). It ends with room for the last block's shadow.
  - **The fade**: 80 tall over the content's bottom edge, full width, from transparent to `--surface-page`, taking no pointer. It shows only while there is more to scroll, as Generate's `ScrollFade` does, so the last row is never left under it. The Brand Templates frame (`2308:267`) draws its curve: 0, 40, 85 and 100 percent at 0, 35, 70 and 100 percent of its height.
  - **The footer**, at the foot of Main.
- Main does not clip, and nothing in the frame becomes a containing block for fixed elements (no `transform`, `filter` or `contain` on Main or its parts), so menus, popovers, toasts and the composer's attach menu keep positioning against the viewport. The frame's 12 holds the sidebar's shadow.

Three kinds of page sit in it. Section 6 says which page is which.

1. **Scrolls in the frame** (most pages). The page's content goes into Main's content. Its own top padding, gutters and page-tall minimum height go.
2. **Scrolls itself** (the Generate thread and its load states, History). The content does not scroll: it is a column as tall as the space left, and the page scrolls its own region inside it, as it does today. `useFullViewport` keeps its job below 1024 only.
3. **Bare** (the builder editor). Main has no padding, no header row and no footer. The editor fills it and keeps its own bar and regions for Phase 6b.

Inside the content, sticky elements pin to its top edge (the Brand Templates filter bar), and the `IntersectionObserver`s that watch scrolling still fire (the pinned filter bar, History's paging). Each route opens with Main's content at the top (section 7, question 5). With nothing inside the content focused, Page Down, Space and the arrow keys scroll it, as they scrolled the document.

Below 1024 the shell keeps today's mobile bar and document scroll, and pages keep today's gutters. The header row and the footer stay in the page's flow there, the header above the content and the footer under it.

This step moves no header and no legal links. Pages keep theirs inside the content until steps 5 and 6, and the header row and footer stay empty.

`npm run verify` passes. Commit: "New brand phase 3: the frame".

### Step 4: the sidebar

The Sidebar component (`2218:679`), Collapsed False (`2218:577`) and True (`2218:633`):

- **The panel.** 320 wide, or 76 collapsed, as tall as the frame. `--surface-raised` with a `--stroke-hairline` edge of `--border-raised`, `--radius-xl`, `--elevation-1-raised`. 20 of padding (`--space-20`) and 24 between its groups (`--space-24`). The edge is inside the 320, so its content is 278 wide (34 collapsed).
- **The header**, 36 tall. Open: the Logo, 24 tall, on the left and Collapse on the right (Icon Button, Ghost Small, "Collapse sidebar"). Collapsed: Expand alone, centered (Icon Button, Ghost Medium, "Expand sidebar"). The collapsed rail draws no mark.
- **The nav.** Nav Items 36 tall and 4 apart (`--space-4`), in the file's order. Collapsed, each shows its icon alone and keeps its tooltip. The nav scrolls on a short viewport and keeps its room for the focus ring.
- **The account**, at the bottom, 12 apart (`--space-12`): the Avatar (Medium, Circle), then the name in Label/M on `--text-primary` over the email in Caption/M on `--text-secondary`, 8 apart, then Settings (Icon Button, Ghost Small, selected while Settings shows). Collapsed: the avatar alone (question 2). The name and email are what the code knows today.
- **The mobile bar** keeps its structure. With its menu open, its ground, border, ink and scrim move onto `--surface-raised`, `--border-subtle`, `--text-primary` and `--surface-scrim`, so `--sb-*` and the inline styles go.
- **The theme toggle** goes where question 1 settles.

The collapsed state stays in `ChromeContext`, as it is.

`npm run verify` passes. Commit: "New brand phase 3: the sidebar".

### Step 5: page headers

Every page's header moves onto the primitive `PageHeader` in the frame's header row: the title kind where the page has a title, the breadcrumb kind where it has a trail. Section 6 lists each with its actions. Then:

- `layout/Breadcrumb.tsx` is deleted, and so is the `PageHeader` in `layout/Page.tsx`. `.sp-shell-pagehead` and `.sp-shell-crumbs` go when nothing reads them.
- The page's heading stays its one `h1` (the title, or the breadcrumb's last crumb), and its id stays where a region names itself by it (`GenerateHeader`'s `currentId`).
- Brand Studio's detail pages put their save state in the primitive's `status`.
- Generate Start has no header row: its frame (`13:1453`) draws none, and its greeting stays for Phase 5. History's breadcrumb row moves onto `PageHeader`, and the title row under it is History's content, left for Phase 5.
- The builder editor keeps its own bar (Phase 6b).

Titles then sit at one height on every page: the header row's top is 16 below the top of Main, and a Title/Page title is centered in its 36.

`npm run verify` passes. Commit: "New brand phase 3: page headers".

### Step 6: footer links

The frame's footer renders `FooterLinks` on every page in the frame, at every width, with two exceptions:

- **The fill page.** Its frame (`2322:918`) puts the links under the preview stage, and `TemplateFill.tsx` writes them there today. The public link page renders the same form outside the frame and needs them too. `TemplateFill`'s links move onto `FooterLinks` where they are, and the fill page's footer stays empty.
- **The builder editor**, as question 6 settles.

Then `generate/LegalLinks.tsx` is deleted, Brand Templates' own copy goes, and the rules that only held links at the foot of a page go: Brand Studio's and Settings' page-tall columns and Insights' bottom padding. Their toasts keep their place above the links.

`npm run verify` passes. Commit: "New brand phase 3: footer links".

### Step 7: the logo, the mark and the favicon

- **Logo** (`54:66`), as question 3 settles. Export the lockup from the file as SVG (128.78 by 24). As the frames draw it, its mark and wordmark are one color, `--text-primary`, so it becomes one inline SVG on `currentColor` that follows the nearest `[data-theme]` like text. `logo-on-light.svg`, `logo-on-dark.svg` and the theme lookup in `BrandMark.tsx` go. The Light-pinned gate (`BrandLockup`'s `scheme`) keeps working through its own `[data-theme]`.
- **Logo Mark** (`61:467`). The mark alone, 20, on `currentColor`. The component sets it on `--text-secondary`. It replaces `mark.svg` for every caller a grep finds: the Generate assistant byline (`chat/Messages.tsx`) and the public link page's footer (`src/app/public/PublicFrame.tsx`) among them. Each keeps its size and place until its screen's phase.
- **Favicon**, as question 3 settles. `index.html`'s comment changes with it.
- Sign in and onboarding (`PreAppShell.tsx`) take the new lockup through the component, and nothing else on them changes.

`npm run verify` passes. Commit: "New brand phase 3: the logo".

### Step 8: clean up and docs

- Delete every rule the frame replaced and nothing reads: `.sp-page` and its desktop tiers, the earlier sidebar and page header rules in `shell.css`, the pinned-column rules, and any `[data-sp-fullscreen]` rule only the desktop used. Grep `src/` for each class before deleting it, in CSS and in strings a `.ts` file builds.
- Bridged names: `--sb-*` and `--page-max` go. `--chrome-top` and `--page-pad` still have readers in the narrow layouts, the Generate thread and History (Phase 5) and the pre-app shell (Phase 9). Keep a name that still has a reader, define it where the shell owns it, and correct its `BRIDGE.md` row with the phase that removes it.
- `npm run tokens:check` passes. Take `npm run shots -- props .shots/props-after.json`, and `npm run shots -- props-compare .shots/props-before.json .shots/props-after.json` shows only the names this phase removed.
- `BRIDGE.md`: strike the rows this phase emptied.
- `PLAN.md`: Phase 3's status, and strike the clipping row this phase resolved (`html[data-sp-fullscreen]`, `.sp-appshell` and `main`).
- `RULES.md` section 10: anything the frame proved different from the table.
- `docs/ARCHITECTURE.md`: the shell paragraph.

`npm run verify` passes. Commit: "New brand phase 3: clean up and docs".

### Step 9: the gate

1. `npm run verify` and `npm run build` pass.
2. Every route in the screenshot fixture renders in both themes at 1440, 1024 and 390, with the sidebar open, and collapsed at 1440 (the fixture gains a collapsed run through `sp-sidebar-collapsed`), and a member's routes for a member. None is blank, cut off or missing its footer links (the editor apart, as question 6 settles).
3. Titles at one height: at 1440 and 1024, read the top of the heading (or the breadcrumb) on every route with a header row. They are equal in both themes. Paste the list.
4. The Sidebar against its component: export `2218:577` and `2218:633` and the Dark preview's two variants into `docs/design/new-brand/reference/`, capture the app's sidebar open and collapsed at a viewport 744 tall (where the panel is 720, as drawn) in both themes, and compare each with `compare-image`. Paste the results. The account's name and email are sample data.
5. Screens: `npm run shots -- capture .shots/after`, then `compare .shots/before .shots/after .shots/diff`. Every screen at 1024 and 1440 changes, because the frame moves the content (section 9). Read each area's before and after side by side and say that its content moved by the frame's measures and reflowed to its new width, and that nothing else changed. List every screen whose height changed and why. At 390 only the colors, the logo and the footer links change.
6. Shadows: no card, panel or the sidebar loses part of its shadow to the frame, at rest and scrolled, in both themes.
7. Keyboard: on each area's page, Tab from the top through the sidebar, the header and the content to the footer links, in both themes, with the sidebar open and collapsed. Every control shows the 2 px ring, 2 px out, and the sidebar's nav and Main's content cut none. Page Down scrolls Main's content with nothing in it focused.
8. No rule in `shell.css` and no shell TSX reads a bridged name, and the shell has no inline style objects. Paste the grep.
9. Run the `fidelity-checker` subagent. Every fixture matches its baseline.
10. Run the `phase-reviewer` subagent against this prompt, `RULES.md` and `CLAUDE.md`.
11. Open the pull request into `main`: "New brand, Phase 3: shell". List what changed, the frame's API and its call sites with counts, the `compare` table, the height changes, every difference between the file and section 6, the files, rules and names deleted, the answers to section 7, and what was left for a later phase.

## 6. The frame

Read from the file on 2026-11-15. Every page frame is 1440 wide and builds the app frame the same way.

| Part | Node | Drawn | Code today |
|---|---|---|---|
| Frame | Every page frame | `--surface-page`, 12 of padding, 12 between Sidebar and Main | No padding. `AppShell.tsx` |
| Sidebar | `2218:679` | 320, 76 collapsed, as tall as the frame. `--surface-raised`, `--border-raised` hairline, `--radius-xl`, Elevation/1 Raised. 20 of padding, 24 between groups | 325 in 335, 76 in 86, sticky in the document. `Sidebar.tsx`, `shell.css` |
| Sidebar header | `2218:578`, `2218:634` | 36 tall. Logo 24 tall, and Collapse (Ghost Small). Collapsed: Expand (Ghost Medium) alone | Logo, theme toggle and Collapse. Collapsed: Expand, then the mark as a home link |
| Nav | `2218:588` | Nav Items 36 tall, 4 apart | 2 apart |
| Account | `2218:620`, `2218:673` | Avatar (Medium), name (Label/M, `--text-primary`) over email (Caption/M, `--text-secondary`) 8 apart, Settings (Ghost Small), 12 apart. Collapsed: the avatar alone | Label/S over Caption/S, untrimmed. Collapsed: the avatar over Settings |
| Main | `13:905` (Insights) | Fills. 16 above and below, 32 gutters, 24 between its parts | `.sp-page`: 45 or 48 above, 45 or 32 gutters, 64 below, stops at 1720 |
| Header row | `4015:764` | 36 tall. The title or breadcrumb on the left, actions on the right 8 apart | `.sp-shell-pagehead`, 36 tall, 45 or 48 down |
| Content | `2308:145` (Brand Templates) | Scrolls, 24 below the header row | The document scrolls |
| Fade | `2308:267` | 80 tall, `--surface-page`, full width | Generate's own only |
| Footer | `2406:248` (Insights) | `FooterLinks`: Caption/M on `--text-secondary`, 16 apart, centered, at the foot of Main | `LegalLinks` and two hand-written copies |

Where the frames differ, and how this phase reads them:

- **Titles at three other heights.** Brand Templates (`2308:4`) draws its title 40 below Main's top, the Brand Studio overview (`13:9043`) 32 below, and Settings (`13:14570`) in a 22 row 16 below. Judgement call 6: the 36 row 16 below wins on every page.
- **Generate Start** (`13:1453`) draws no header row. Its column is centered in Main both ways.
- **The builder editor** (`325:484`) draws the sidebar collapsed to 76 and the builder column filling the space beside it with no padding, its own 44 top bar and no footer links.
- **The fill page** (`2322:918`) draws its legal links under the preview stage, not at the foot of Main.
- **History** (`13:3359`) draws a scroll region of its own below its title and filters, with a 120 fade, and the Generate result (`13:2985`) draws a fade at the top of the thread. Both belong to Phase 5. The frame's own fade is 80.
- **The fades are raw hex** in the file (`#F9F9F8`, which is `--surface-page` in Light). Build them on `--surface-page`.
- **The Logo** (`54:66`) is described as a "gradient four-field mark", and every frame draws it in `--text-primary` (question 3).

A shape for the frame that fits these pages, to settle at the recon gate:

```tsx
<Page header={<PageHeader title="Insights & Analytics" actions={exportCsv} />}>…</Page>
<Page header={<GenerateHeader … />} scroll="self">…</Page>
<Page bare>…</Page>
```

with the footer on by default and off where section 6 says.

How each page sits in the frame. The last column is what it renders today.

| Page | Route | Header row | Content | Footer | Code today |
|---|---|---|---|---|---|
| Brand Templates | `/templates` | Title "Brand Templates" | Scrolls in the frame. The filter bar stays pinned | Footer | `Portal.tsx`: `Page` 2, `PageHeader` 2, its own links |
| Fill page | `/templates/:id` | Breadcrumb, with Bulk fill and Public link | Scrolls in the frame | Its own, under the stage | `TemplateUsePage.tsx`: `Page` 2, `BreadcrumbHeader`. `TemplateFill.tsx` |
| Bulk fill | `/templates/:id/bulk` | Title "Bulk fill" | Scrolls in the frame | Footer | `bulk/BulkFillPage.tsx`: `Page` 3, `PageHeader` |
| Generate start | `/generate` | None | Scrolls in the frame, its column centered | Footer | `generate/GeneratePage.tsx`: `Page` with `layout`, `LegalLinks` |
| Generate thread | `/generate/c/:id` | Breadcrumb, with History and New chat | Scrolls itself | Footer | `GeneratePage.tsx` (`GenerateHeader`, or `BreadcrumbHeader` for a template chat), `chat/GenerateHeader.tsx` (`BreadcrumbHeader`), `ChatLoadStates.tsx` (`Page` 2, `LegalLinks` 2) |
| History | `/generate/history` | Breadcrumb, with New chat | Scrolls itself | Footer | `generate/GenerateHistoryPage.tsx`: `Page` with `layout`, its own header rows, `LegalLinks` |
| Template Builder | `/template-builder` | Title "Template Builder", with Restore starters and New template | Scrolls in the frame | Footer | `admin/AdminTemplates.tsx`: `Page`, `PageHeader` |
| Builder editor | `/template-builder/:id` | None: its own bar | Bare | None (question 6) | `builder/TemplateBuilder.tsx` |
| Brand Studio | `/brand-studio` | Title "Brand Studio" | Scrolls in the frame | Footer | `admin/BrandStudio.tsx` (`Page`, `LegalLinks`), `brand/BrandOverview.tsx` (`PageHeader`) |
| Brand Studio details | `/brand-studio/:category` | Breadcrumb, with the save status and Undo | Scrolls in the frame | Footer | `brand/BrandDetailHeader.tsx` (`BreadcrumbHeader`) |
| Insights | `/insights` | Title "Insights & Analytics", with Export CSV | Scrolls in the frame | Footer | `admin/Dashboard.tsx`: `Page` 3, `PageHeader` 3 |
| Settings | `/settings/:section` | Title "Settings & Admin" | Scrolls in the frame | Footer | `admin/SettingsAdmin.tsx`: `Page`, `PageHeader`, `LegalLinks` |

The template chat (`/templates/:id/chat`, `generate/TemplateChatPage.tsx`) moves only as far as the frame forces it and is not restyled (judgement call 1). The public link page, sign in, onboarding and the `/dev` routes render outside the app frame.

## 7. Open questions for the recon gate

Propose an answer to each from the frames, and wait for CJ.

1. **The theme toggle.** The file's sidebar draws no theme toggle, open or collapsed, and no frame draws one anywhere else. Today a quick toggle sits beside Collapse and in the mobile bar, and Settings › Account has System, Light and Dark. Recommended: follow the file and remove the quick toggle from both places, so the theme is set in Settings › Account. The other answer keeps it beside Collapse, off the frame.
2. **Settings from the collapsed rail.** The collapsed Sidebar (`2218:633`) draws the avatar alone: no Settings button, and no mark under Expand. Recommended: the collapsed avatar is the Settings button (named "Settings", with the rail's tooltip, selected while Settings shows), so the rail matches its frame and Settings stays one click away. The mark goes as drawn, since the nav items reach every area.
3. **The logo's color, and the favicon.** Every frame draws the lockup in `--text-primary`, dark on Light and white on Dark, where today the mark is Slime. The component's description still says "gradient". The file draws no favicon. Recommended: the lockup in `--text-primary` as drawn, and a favicon built the way today's is (the mark knocked out of a Slime tile, which holds up at 16 where the bare mark thins out), with the new mark in `#0B0B0C` on the new Slime, `#2BFFA3`.
4. **A width cap.** Today the page column stops at 1720 (`--page-max`). The file's Main fills, with no cap. Recommended: no cap, as drawn. A page with a column of its own (Generate's 720, the Settings rail and section) keeps it.
5. **Scroll position.** Today nothing resets the document's scroll when the route changes, and Back leaves restoring it to the browser. Recommended: every route, Back included, opens with Main's content at the top. Keeping a position per history entry is not built.
6. **Footer links in the builder editor.** Decision 14 puts them on every page, and the editor's frames draw none: its workspace takes the full height beside the rail. Recommended: follow the frames, and name the editor in the pull request as the one page without them.

## 8. Out of scope

- What is inside each page: Brand Templates' filter bar, shelves and grids, the fill page's split and stage, Generate's columns and fades, History's title row and grid, the builder's chrome, and the content of Brand Studio, Insights and Settings. Phases 4 to 8.
- The public link page, sign in and onboarding, beyond the new logo and mark through their components. They sit outside the app frame.
- Layouts below 1024, beyond their colors, the logo and the footer links.
- The template chat beyond what the frame forces (judgement call 1).
- The two sources for the legal pages. `src/lib/legalLinks.ts` holds the live addresses the app's links use, and `src/lib/legal.ts` holds placeholders (`#terms`, `#privacy`) that sign in, the sign-up consent line and onboarding read. List it for CJ. Phase 9 owns those screens.
- Copy. No string changes, apart from the names of controls the sidebar gains or loses (questions 1 and 2).
- Lint rules against raw colors and inline type. Phase 10.

## 9. Expected changes

What the screenshot comparison should show, and nothing else.

**The frame, at 1024 and wider.** A 12 margin around the app on `--surface-page`. The sidebar is 320 wide (76 collapsed) with its hairline and Elevation/1 Raised, 12 in from the viewport's edges. At 1440 content starts 376 from the viewport's left edge (380 today) and is 1020 wide (1015 today). At 1024 it starts at 376 (367 today) and is 604 wide (625 today). Content reflows to its new width.

**Headers.** Every header row's top is 28 below the viewport's top (12 and 16), where today's sits 45 or 48 down, so every title and breadcrumb moves up and sits at one height. Content starts 88 down at 1440, where today it starts at 105.

**Scrolling.** The sidebar and the header row stay put while Main's content scrolls, and an 80 fade covers the content's bottom edge while there is more below. A capture at 1024 or 1440 is as tall as the page's content plus the frame. Pages that scroll themselves are as tall as the viewport, as today.

**The sidebar.** Nav items 4 apart (2 today). The account's name and email in Label/M and Caption/M, 8 apart. The theme toggle, the collapsed rail's mark and its Settings button as questions 1 and 2 settle.

**Footer links.** At the foot of Main on every page in the frame, Insights, the Template Builder list and bulk fill included, and under the stage on the fill page.

**The logo.** The lockup and the mark in one color from the theme, the mark included. The Generate byline and the public link page's footer take the new mark. The favicon as question 3 settles.

**At 390.** The mobile bar's colors, the logo and the footer links, and nothing else.

**Unchanged.** Everything inside each page, the narrow layouts apart from the above, the public link page, sign in and onboarding apart from the logo, every graphic and every export.
