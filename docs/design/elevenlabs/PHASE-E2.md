# ElevenLabs, Phase E2: shell

You are a senior front-end engineer on SocialPaint (this repository). This phase rebuilds the app frame from the Figma file "Master UX-UI New Brand Eleven Labs Inspired" (`dQ8bQq3V7Bue5pvFrI2g9X`). The sidebar runs flush against the window on `--surface-shell` with a hairline on its right, the viewport loses its padding, every page's header row becomes 64 tall with a hairline under it, and the Page Header leads with the area's icon and names the page in Label/M. Generate Start gains its header row.

Phase E1 changed values and primitives and left the frame as it was. This phase changes the frame and leaves what is inside each page as it is. A page changes here only because the frame around it changed: where its header sits and what it holds, where its content starts and how wide it is. Section 9 says what that covers. What is inside a page is Phases E3 to E8.

Be exact. CJ has dropped plan mode and the recon gate for this program (2026-11-17), so build straight through. Work through the steps in section 4 in order, run the checks each step names, and commit after each step with `npm run verify` green. If something here turns out to be wrong once you are in the code, build the closest thing the frames allow and explain the conflict in the pull request instead of improvising a different design.

This prompt was written against `main` at `c54794a` (#202), before Phase E1. Recount anything it counts once Phase E1 has merged.

---

## 1. Read these first

1. `docs/design/elevenlabs/PLAN.md` (decisions, judgement calls 2, 12, 14 and 16, and CJ's answers at the new-brand shell gate), `RULES.md` in full (section 10 is this phase's spec), `BRIDGE.md` section 7, and `PROMPT.md` sections 4 and 5.2.
2. `docs/design/new-brand/PLAN.md`, What Phase 3 found. It says how the frame works today and why.
3. `CLAUDE.md`.
4. The shell: `src/app/components/AppShell.tsx`, `Sidebar.tsx`, `BrandMark.tsx`, `layout/Page.tsx`, `layout/ChromeContext.tsx`, `layout/useFrameKeys.ts`, and `src/styles/shell.css` in full (534 lines).
5. `primitives/PageHeader.tsx` (`PageHeader`, `Breadcrumb`, `FooterLinks`), `primitives/Navigation.tsx` (`NavItem`, `Avatar`), `primitives/IconButton.tsx` with the Outline style Phase E1 added, and their rules in `primitives.css`.
6. Every page section 6 lists, where it passes its header to `Page`.
7. `scripts/new-look/shots.mjs` (`capture`, `--collapsed`).
8. In Figma, with the MCP server connected: the Sidebar (`2218:679`, open `2218:577`, collapsed `2218:633`) on Product components (`4012:1194`), with its Light and Dark examples there; the App shell pattern (`6227:1078`) on Patterns; the Layout board (`6216:488`) on Foundations; Page Header (`4015:764`) and Breadcrumb (`2213:111`) on Components · Navigation (`6221:524`); and each frame section 6 names, in Light and in Dark.

## 2. Invariants

- **Multi-tenant.** No tenant data, starter content, brand kit or graphic is touched. The name, email and initials in the frames are sample data.
- **Tokens stay generated.** This phase reads tokens and adds none.
- **The shell reads semantic tokens only.** No primitive, no raw color, no bridged name, and no inline style objects in the shell's TSX.
- **Nothing inside a page is rebuilt.** A page changes only where the frame forces it: the header row and what it holds, and where the content starts.
- **Scrolling stays as CJ settled it.** Main scrolls and the window does not. The header row, the content and the footer links scroll together, and nothing sticks (CJ, 2026-11-16). `useFrameKeys`, the scroll reset on a new path and the screenshot tool's tall captures keep working.
- **Below 1024 only colors and the header's look change.** The mobile bar, its drawer, the document scroll and today's gutters stay.
- **Behavior is kept.** Every route stays reachable in both themes, for an admin and for a member. The collapsed preference (`sp-sidebar-collapsed`), the builder's borrowed collapse (`overrideSidebarCollapsed`), the theme toggle, every page's focus handling and every existing test's intent survive.
- `SchemaRenderer`, the export path, `canvasGesture.ts`, the frozen types and every table column are untouched. The builder editor sits in the frame beside the rail, so run the `fidelity-checker` subagent at the gate.

## 3. Before you change anything

```bash
npm run shots -- capture .shots/before
npm run shots -- capture .shots/before-collapsed --collapsed
npm run shots -- props .shots/props-before.json
```

The full capture takes about 45 minutes and reads the working tree. Run it in the background and do not edit `src/` until it finishes.

## 4. Steps

### Step 1: read the file

Read the Sidebar, the App shell pattern, the Page Header and the frames in section 6 from the file. For each page, note its header (kind, area icon, title or trail, actions), where its content starts, and what the frame changes around it. Confirm the measures in section 5. Where the file and this prompt disagree, the file wins and you list the difference. Take the recommended answer to each open question in section 7, unless the code shows it cannot work.

Keep these notes for the pull request, then go straight on to step 2:

1. The `PageHeader` API change and every call site, with counts.
2. Where the area icons come from, so a page's header and its nav item read one source.
3. Every difference between the file and sections 5 and 6.
4. The answer you took to each open question in section 7.
5. Anything the frame needs that no token carries.

### Step 2: the frame

At 1024 and wider:

- **No inset.** The app frame's padding and the gap between the sidebar and Main read `--layout-shell-inset`, which is 0. The sidebar meets the window's top, left and bottom, and Main meets the sidebar and the window.
- **Main** fills the rest on `--surface-page`, with no padding above or below it. Today it keeps 16 above and below (`.sp-frame`, `padding-block`).
- **The header row** is 64 tall plus a `--stroke-hairline` bottom edge in `--border-subtle`, the full width of Main, with `--space-32` at its sides and the 36 Page Header centered in it.
- **The content** starts `--space-24` under the hairline, with `--space-32` at its sides, as today.
- **The footer links** stay at the foot of the content on every page in the frame, as today. The frames draw none, and decision 14 keeps them.
- "scroll", "self" and "bare" keep their jobs. "bare" (the builder editor) still fills Main with no header row and no footer. Its own 44 bar stays for Phase E5, which moves it into the header row.

Below 1024 nothing in this step changes.

`npm run verify` passes. Commit: "ElevenLabs E2: the frame".

### Step 3: the sidebar

The Sidebar component (`2218:679`), open (`2218:577`) and collapsed (`2218:633`):

- **The panel** runs full height on `--surface-shell`, 300 wide plus a `--stroke-hairline` right edge in `--border-raised`, so 301 in all, or 76 collapsed with its edge included. `--radius-shell` is 0, the top, left and bottom edges are `--stroke-shell-edge` (0), and it casts no shadow. 20 of padding (`--space-20`) and 24 between its groups (`--space-24`), as today. Today it is a 320 card on `--surface-raised` with a hairline all round and `--radius-xl`.
- **The header.** Open, 28 tall: the lockup, 24 tall, on the left, and Collapse on the right as Icon Button Outline Small with `Icon/panel-left`, named "Collapse sidebar". Today Collapse is Ghost Small. Collapsed: the mark above Expand, which stays Icon Button Ghost Medium with `Icon/panel-left`, named "Expand sidebar" (question 2).
- **The nav.** Nav Items 36 tall and 4 apart, as today, scrolling on a short window with room for the ring.
- **The account**, at the bottom: the Avatar (Medium, Circle), the name in Label/M on `--text-primary` over the email in Caption/M on `--text-secondary` 8 apart, then Settings as Icon Button Outline Small with `Icon/settings`, named "Settings" and selected while Settings shows. Today Settings is Ghost Small. Collapsed, the avatar alone is the Settings button (CJ's answer at the new-brand gate), and the ring that marks it current reads the sidebar's ground, now `--surface-shell`.
- **The theme toggle** stays beside Collapse (question 1).
- **The mobile bar** keeps its structure, its toggle and its drawer.

`npm run verify` passes. Commit: "ElevenLabs E2: the sidebar".

### Step 4: page headers

- **`PageHeader` gains `icon`**, the area's icon, drawn at `--size-icon-md` (18) on `--text-secondary` before the title or the trail, 8 apart, and hidden from assistive tech. The title kind sets its `h1` in `.t-label-m` on `--text-secondary`, where today it is `.t-title-page` on `--text-primary`. The breadcrumb kind keeps its trail (Label/M, the parents on `--text-secondary` and the current page on `--text-primary`). Status and actions stay on the right, actions 8 apart.
- **Every page passes its area's icon**, from the same source the sidebar's nav items read (step 1, item 2): Brand Templates `paintbrush`, Generate `sparkles`, Template Builder `frame`, Insights & Analytics `chart-column`, Brand Studio `pencil-ruler`, Settings `settings`. A page one level down takes its parent area's icon.
- **Generate Start gains its header row**, the title kind with "Generate" (`6023:3097`). Its greeting and column stay as they are below it.
- The page's heading stays its one `h1`, and every `id` a region names itself by stays where it is.
- Below 1024 the header keeps today's place in the page's flow, and takes the icon and the new title style.

`npm run verify` passes. Commit: "ElevenLabs E2: page headers".

### Step 5: clean up and docs

- Delete every rule the flush frame replaced and nothing reads: the panel's radius, shadow and all-round edge, the frame's padding and gap, Main's 16 above and below. Grep `src/` for each class before deleting it, in CSS and in strings a `.ts` file builds.
- `npm run tokens:check` passes. Take `npm run shots -- props .shots/props-after.json`, and `props-compare` against the baseline shows no token change.
- `BRIDGE.md`: strike the rows this phase settled. `PLAN.md`: Phase E2's status and anything a later phase needs to know. `RULES.md` section 10: anything the frame proved different from the table.
- `docs/ARCHITECTURE.md`: the shell paragraph.

`npm run verify` passes. Commit: "ElevenLabs E2: clean up and docs".

### Step 6: the gate

1. `npm run verify` and `npm run build` pass.
2. Every route in the screenshot fixture renders in both themes at 1440, 1024 and 390, with the sidebar open, and collapsed at 1440, and a member's routes for a member. None is blank, cut off or missing its footer links (the builder editor apart).
3. The shell against the App shell pattern (`6227:1078`): export its Light and Dark panels and the Sidebar's four examples into `docs/design/elevenlabs/reference/`, capture Brand Templates and the sidebar open and collapsed at a viewport 1053 tall in both themes, and compare each with `compare-image`. Paste the results. The account's name and email are sample data.
4. Headers: at 1440 and 1024, every route's title or trail sits at one height, 14 under Main's top, with the area icon before it. Paste the list.
5. Screens: `npm run shots -- capture .shots/after`, then `compare .shots/before .shots/after .shots/diff`. Every screen at 1024 and 1440 changes, because the frame moved the content (section 9). Read each area's before and after side by side and say that its content moved by the frame's measures and reflowed to its new width, and that nothing else changed. At 390 only the header's look changes.
6. Keyboard: on each area's page, Tab from the top through the sidebar, the header and the content to the footer links, in both themes, with the sidebar open and collapsed. Every control shows the 2 px ring, 2 px out, and the flush edges cut none, since the sidebar's controls sit 20 in from the window.
7. No rule in `shell.css` and no shell TSX reads a bridged name or a primitive, and the shell has no inline style objects. Paste the grep.
8. Run the `fidelity-checker` subagent. Every fixture matches its baseline.
9. Run the `phase-reviewer` subagent against this prompt, `RULES.md` and `CLAUDE.md`.
10. Open the pull request into `main`: "ElevenLabs, Phase E2: shell". List what changed, the `PageHeader` change and its call sites with counts, the `compare` table, every difference between the file and sections 5 and 6, the answers to section 7, and what was left for a later phase.

## 5. The frame

Read from the file on 2026-11-17. Every product frame is 1440 by 1053 and builds the shell the same way.

| Part | Node | Drawn | Code today |
|---|---|---|---|
| Frame | Every product frame | No padding. The sidebar, then Main, on `--surface-page` | 12 of padding and 12 between the parts. `.sp-appshell` |
| Sidebar | `2218:577` | 301 in all, full height, on `--surface-shell` with a `--border-raised` hairline on the right only. 20 of padding, 24 between groups | A 320 card on `--surface-raised`, hairline all round, `--radius-xl`. `.sp-shell-panel` |
| Sidebar, collapsed | `2218:633` | 76 with its edge. The mark, then Expand (Ghost Medium), the nav as icons, the avatar alone | 76. Expand, the nav, the avatar as Settings |
| Sidebar header | `2218:578` | 28 tall. CJ's updated lockup 24 tall (`6243:8529`) on `--logo-ink`, then Collapse as Outline Small | 36 tall. CJ's earlier lockup files, the theme toggle and Collapse as Ghost Small |
| Nav | `2218:588` | Nav Items 36 tall, 4 apart | The same |
| Account | `2218:620` | Avatar Medium, name in Label/M over email in Caption/M 8 apart, Settings as Outline Small, 12 apart | The same, with Settings as Ghost Small |
| Main | Brand Templates `6010:2064` | Fills, with nothing above or below it | 16 above and below. `.sp-frame` |
| Header row | `6010:2064`, its PageHeader | 64 plus a `--border-subtle` hairline under it. The 36 Page Header centered, 32 at the sides | A 36 row, 16 under Main's top, no hairline. `.sp-frame__head` |
| Page Header | `4015:764` | The area icon (18, `--text-secondary`), then the title in Label/M on `--text-secondary` or the Breadcrumb, actions on the right 8 apart | No icon. The title in Title/Page on `--text-primary`. `primitives/PageHeader.tsx` |
| Content | `6010:2064` | 24 under the hairline, 32 at the sides | 24 under the header row, 32 at the sides |
| Footer | None drawn | Footer Links at the foot of the content (decision 14) | The same |

How each page's header reads in the frames. The last column is what it renders today.

| Page | Frame | Header | Code today |
|---|---|---|---|
| Brand Templates | `6010:2064` | `paintbrush`, "Brand Templates" | `Portal.tsx` |
| Fill page | `6010:2553` | `paintbrush`, Brand Templates / the template, with Bulk fill and Public link | `TemplateUsePage.tsx` |
| Generate Start | `6023:3097` | `sparkles`, "Generate" | No header. `generate/GeneratePage.tsx` |
| Generate thread | `6023:3578` | `sparkles`, Generate / the chat, with History and New chat | `GeneratePage.tsx`, `chat/GenerateHeader.tsx` |
| History | `6023:3648` | `sparkles`, Generate / History, with New chat | `generate/GenerateHistoryPage.tsx` |
| Template Builder | `6072:4269` | `frame`, "Template Builder", with Restore starters and New template | `admin/AdminTemplates.tsx` |
| Builder editor | `6072:3662` | `frame`, Template Builder / the template, the save status, the mode switch and Publish | Its own 44 bar, for Phase E5 |
| Brand Studio | `6085:1601` | `pencil-ruler`, "Brand Studio" | `admin/BrandStudio.tsx`, `brand/BrandOverview.tsx` |
| Brand Studio details | `6085:1662` | `pencil-ruler`, Brand Studio / the category, with the save status and Undo | `brand/BrandDetailHeader.tsx` |
| Insights | `6095:1030` | `chart-column`, "Insights & Analytics", with Export CSV | `admin/Dashboard.tsx` |
| Settings | `6095:1220` | `settings`, "Settings & Admin" | `admin/SettingsAdmin.tsx` |

Where the frames move an action between the header and the content (History's New chat, for one), the move is that area's phase. This phase gives every header its icon and its title style, and leaves its actions where they are.

## 6. Pages

Every page in the frame takes the new header row. Read each from its frame in section 5 in Light and in Dark, and from its Dark twin in `PLAN.md`'s screen map. Bulk fill, the public link page, sign in, onboarding and the `/dev` routes are outside the app frame or have no frames, and change only as the shared primitives do.

## 7. Open questions

Build the recommended answer to each unless the code shows it cannot work, and list what you took in the pull request.

1. **The theme toggle.** The ElevenLabs sidebar draws the lockup and Collapse only. At the new-brand gate CJ kept the toggle beside Collapse and in the mobile bar. Recommended: keep it, as Icon Button Outline Small to match Collapse, 8 to its left.
2. **The collapsed rail's mark.** The file now draws the mark above Expand. At the new-brand gate the mark went, since that file drew none. Recommended: as drawn now, with the mark from CJ's lockup as the home link, named as the open lockup is.
3. **The lockup.** CJ updated it in the Sidebar (`6243:8529`), and the mark in the collapsed rail (`6112:44073`) is the same mark. Both read `logo/ink`, `#1C1F1E` on Light and `#F9F9F8` on Dark. Since 2026-11-16 the code uses CJ's two earlier lockup files with the gradient mark. Recommended: export the updated lockup and mark from the file as SVG and draw them inline on `currentColor` set from `--logo-ink`, so one lockup follows the theme, in place of `logo-on-light.svg` and `logo-on-dark.svg`. The favicon stays as it is until CJ updates it. The sign-in gate's frames now place the updated lockup too (CJ, 2026-11-17), while the Logo component (`54:66`) on Create account and the Cover keeps the earlier one until he decides.
4. **The header below 1024.** Recommended: no 64 row and no hairline there, the header in today's place with the icon and the new title style, so the narrow layouts keep today's behavior.

## 8. Out of scope

- What is inside each page: filter bars, cards, the fill page's split, Generate's column and composer, History's title row, the builder's chrome, Brand Studio, Insights and Settings content. Phases E3 to E8.
- Moving the builder editor's bar into the header row. Phase E5.
- Sign in and onboarding, which sit outside the app frame. Phase E8.
- The favicon, and the Logo component on Create account and the Cover, beyond question 3.
- Copy. No string changes beyond Generate Start's header title, which the frame draws.

## 9. Expected changes

What the screenshot comparison should show, and nothing else.

**The frame, at 1024 and wider.** No margin around the app. The sidebar is flush at the window's top, left and bottom, 301 wide with its hairline (76 collapsed), on soft gray with no corners and no shadow. At 1440 content starts 333 from the window's left edge (376 today) and is 1075 wide (1020 today). At 1024 it starts at 333 and is 659 wide (604 today). Collapsed, content starts at 108 (132 today). Content reflows to its new width.

**Headers.** Every header row runs the full width of Main, 64 tall with a hairline under it. The title or trail sits 14 under Main's top (28 today), after the area icon, and a top-level title is Label/M on `--text-secondary`, where it was Title/Page on `--text-primary`. Content starts 89 down (88 today). Generate Start has a header row.

**The sidebar.** The updated lockup, near-black on Light and off-white on Dark, as question 3 settles. Collapse and Settings become bordered squares. The open header is 28 tall, so the nav starts 8 higher. The collapsed rail shows the mark above Expand, as question 2 settles.

**Sign in and onboarding.** Both draw the lockup through `PreAppShell`'s `BrandLockup`, so theirs becomes the updated one too, which is what the sign-in frames now draw. Create account's frames still place the earlier Logo, so note in the pull request that onboarding shows the updated one.

**At 390.** The header's icon and title style, and nothing else.

**Unchanged.** Everything inside each page, how it scrolls, the footer links, the builder editor's own bar, every graphic and every export.
