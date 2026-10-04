# New look, Phase 3: shell and navigation

You are a senior front-end engineer on SocialPaint (this repository). This phase rebuilds the shell around every page to the Figma file "Master UX-UI":

- the sidebar, with five nav items and Settings on the account gear
- title-only page headers
- People as a Settings section, with `/people` redirecting
- workspace switching inside Settings › Workspace
- the canvas-size toggles removed

The sidebar, the account block and the Settings rail move onto the Phase 2 primitives. Everything inside a page (its cards, lists, forms and controls) stays as it is: Phases 4 to 8 rebuild those. The gate proves every route is still reachable and that members reach exactly what they reached before.

Be exact. Work through the steps in §5 in order, run the checks each step names, and commit after each step with `npm run verify` green. If something here turns out to be wrong once you are in the code, stop and explain the conflict instead of improvising.

---

## 1. Read these first

1. `docs/design/new-look/PLAN.md`, `RULES.md`, `BRIDGE.md` and `PHASE-2.md` in full.
2. `docs/design/new-look/PHASE-3-SHELL.md` in full, which this prompt calls "the reference". It holds:
   - the Sidebar (56:646) and Account (56:1330) components, measured
   - page header geometry across seven screens
   - the Settings frames (8:678): the rail, Workspace (13:14570) and People (13:14769)
3. The reference images in `docs/design/new-look/reference/`.
4. The shell code:
   - `src/app/components/Sidebar.tsx`, `GooeyNavPill.tsx`, `AppShell.tsx`
   - `layout/Page.tsx`, `layout/ChromeContext.tsx`
   - `src/app/App.tsx` (the `adminOnly` gate) and `src/app/router.tsx`
5. The Settings code:
   - `admin/SettingsAdmin.tsx`
   - `admin/settings/WorkspaceSection.tsx`, `AccountSection.tsx`, `TeamSection.tsx`, `settingsShared.tsx`
   - `admin/PeopleAdmin.tsx`
6. Auth and workspaces: `src/lib/auth/AuthContext.tsx` and `SupabaseAuthProvider.tsx` (`companies`, `setCompany`, `setRole`, `signOut`), and `onboarding/OnboardingWizard.tsx` (the "Create company" flow).
7. Canvas sizes: the `listCanvasSizes`, `listCanvasSizeSettings` and `setCanvasSizeEnabled` store methods (`src/lib/stores/interfaces.ts`, `supabase/companyStore.ts`, `local/localStores.ts`) and their readers (`builder/TemplateBuilder.tsx`, `admin/AdminTemplates.tsx`).
8. The primitives this phase adopts: `NavItem`, `SettingsRailItem`, `Avatar`, `ThemeToggle`, `IconButton`, `Button`, `SettingsCard`, `Status` and `SegmentedControl`, all in `src/app/components/primitives/`.

## 2. What changes

| Area | Today | After this phase | Figma |
|---|---|---|---|
| Sidebar | 7 items (People and Settings & Admin among them), gooey pill, template and people counts, a workspace select, a dev Admin/Member toggle, a sign-out button | The Sidebar component: logo, theme toggle, collapse, 5 nav items, spacer, Account block with the Settings gear; collapsed, the 76 rail of `Collapsed=True`. No counts, no switchers, no sign-out button | 56:646, 189:2151, 189:2415, 56:1330 |
| Account block | Avatar, name, email or "company · role", LogOut button | Large Avatar, name, email, and a ghost gear `IconButton` that opens Settings and shows selected while Settings is open | 56:1330 |
| Page headers | `PageHeader` with eyebrow, title, description, action | Title alone (`.t-title-page`) with optional right-aligned actions | Every screen |
| Page column | `.sp-page` padding 48 / 48 / 64 at desktop | 45 from the sidebar edge, 45 at the top (desktop width) | Part A §3 |
| People | Its own route and nav item; Settings › Team is a stub linking to it | The People section of Settings (`/settings/people`); `/people` and `/settings/team` redirect | 13:14769 |
| Settings rail | Hand-rolled `.sp-settings-rail` with Team | `SettingsRailItem` rows: Workspace, People, Integrations, Plan & usage, Sharing, Account, Advanced | Part B §1 |
| Workspace switching | A select in the sidebar, with "+ Create company…" | A Workspaces card at the top of Settings › Workspace: one row per workspace, a Current pill or a Switch button, and Add workspace | 13:14698 |
| Sign out | A sidebar button | A Sign out button in Settings › Account | 13:15776 |
| Dev role toggle | The sidebar (local backend only) | The dev backend banner (local backend only) | none (§9, 3) |
| Canvas sizes | A card in Settings › Workspace that limits the builder's sizes | Gone. The builder offers the whole size catalogue | none |

Still out of scope, so these keep their current headers until their phase: the breadcrumb headers (the template chat and fill page in Phase 4, Generate threads and History in Phase 5, Brand Studio detail pages in Phase 6) and Generate's greeting.

## 3. Invariants

- **Every route stays reachable.** Every route resolves to the same screen for the same role as before, except `/people` and `/settings/team`, which redirect to `/settings/people`.
- **Members see exactly what they saw before.**
  - Today a member reaches Brand Templates, Generate, Settings (Account), the workspace select and "Create company".
  - After this phase a member reaches Brand Templates and Generate from the nav, and Settings from the gear: Account, plus a Workspace section holding only the Workspaces card when they belong to more than one workspace or run on the local backend (exactly when today's sidebar shows them the switcher). A member with one workspace sees Account alone.
  - Admin-only routes stay admin-only.
- **Multi-tenant.** The Workspaces card lists the signed-in person's own workspaces from `useAuth().companies`. Nothing is seeded, and no count is ever made up.
- **Tokens and primitives only** in what this phase rebuilds (RULES §3 to §6). New code reads no legacy name.
- **Out-of-scope screens keep their content.** Under the new sidebar and header, page bodies stay as they are, including the Template Builder, bulk fill and onboarding.
- **Below desktop width, keep today's behavior** (PLAN, Scope). The mobile bar and drawer keep their structure, show the same five nav items and the Account block, and pick up the new tokens.

## 4. Before you change anything

1. Work on `feat/new-look-phase-3`, branched from `main`.
2. Baseline: `npm run shots -- capture .shots/before`.
3. Write the route reachability test first (step 1). It is this phase's main safety net.

## 5. Steps

### Step 1: routes, redirects and the reachability test

- **Router.**
  - `SettingsSection` gains `people` and loses `team`.
  - `urlToRoute` maps `/people` and `/settings/team` to `{ name: "settings", section: "people" }`.
  - `RouterProvider` replaces the address (`replace`, no new history entry), as Settings already does for a corrected section.
  - Drop `{ name: "people" }` from the `Route` union, and update every `navigate({ name: "people" })` caller (TeamSection, the sidebar).
- **Settings.**
  - `SettingsAdmin.tsx` gets a People section that renders `PeopleAdmin`'s content (its list, invite row and dialogs) as it is today. Lift the content out of its `Page` wrapper; the section sits inside Settings' page.
  - People is admin-only: a member who opens `/settings/people` gets their fallback section, as today's section correction does.
  - Delete `TeamSection.tsx`.
- **Reachability test** (`src/app/routes.test.ts`). For every route the router knows, assert what an admin gets and what a member gets: the rendered screen name, or the fallback.
  - Drive it from `urlToRoute` and the `adminOnly` rules in `App.tsx`. Extract those rules into a pure function in `router.tsx` (e.g. `screenFor(route, role)`) that `App.tsx` also uses.
  - Add the settings sections per role to the same table.
- **Screenshot loop.** Replace `people` with `settings-people`, drop `settings-team`, and keep a `people-redirect` capture of `/people` to prove the redirect.
- `npm run verify` passes. Commit: "New look phase 3: People in Settings, with redirects and a reachability test".

### Step 2: new homes for what leaves the sidebar

Each of these lands before the sidebar loses its control, so nothing is unreachable at any commit.

- **Workspaces card** (Settings › Workspace, first card, Part B §2): a `SettingsCard` titled "Workspaces" with an "Add workspace" `Button` (neutral, plus icon) in its header.
  - One row per `companies` entry: a square `Avatar` with the workspace's initials, the name in `.t-label-m`, and the meta line in `.t-caption-s` and `--text-secondary`.
  - The meta line is the person's role in that workspace alone ("Admin" or "Member"), with no count (§9, 1). `AuthState` exposes the per-workspace role the Supabase memberships query already loads (`roleByCompany` in `SupabaseAuthProvider.tsx`), for example as a `roleFor(companyId)` or a role on each `companies` entry. On the local backend every workspace shows the dev role.
  - Then either a `Status` (neutral, "Current") for the current workspace, or a small neutral `Button` "Switch" that calls `setCompany(id)`.
  - Rows are separated by a 1px `--border-default` divider.
  - Add workspace opens today's Create company flow (the onboarding route), unchanged (§9, 2).
- **Member access.** For a member, Settings shows a Workspace section holding only the Workspaces card, and only when they belong to more than one workspace or the backend is local (§9, members). Their fallback section stays Account. The reachability test covers both cases.
- **Sign out** in Settings › Account: the "Sign out" button as 13:15776 draws it (neutral, with the log-out icon). It renders only when `signOut` exists, as the sidebar's does today.
- **Dev role toggle** in the dev backend banner (`DevBackendBanner.tsx`, §9, 3). The banner is local-only and shows on every screen for both roles.
  - Add a `SegmentedControl` labelled "Dev role" with Admin and Member, calling `setRole`.
  - The banner's warning text stays in a `role="status"` element; the control sits beside it, outside the live region.
  - `shots.mjs` `settle()` hides the banner by its role and its "Dev backend" text. Keep the whole banner hidden in captures: either keep the text and role on the banner's outer element, or give the banner a `data-dev-banner` attribute and hide it by that in `settle()`.
- `npm run verify` passes. Commit: "New look phase 3: workspace switching, sign out and the dev role in Settings".

### Step 3: the sidebar

- **Rebuild** `Sidebar.tsx`'s desktop rail to 56:646 on the primitives (Part A §1 and §2). `GooeyNavPill.tsx` and its CSS go.
  - **Panel:** 325 wide, padding 20, gap 24, `--surface-raised`, `--radius-card`, `--elevation-small`. It is inset 10 from the viewport's top, left and bottom, and is sticky to the viewport, as today (§8).
  - **Header:** the logo (`BrandLockup`, as today), then `ThemeToggle` and a ghost `IconButton` with lucide `PanelLeft` that collapses the rail.
  - **Nav:** five `NavItem`s, gap 2: Brand Templates (`Paintbrush`), Generate (`Sparkles`), Template Builder (`Frame`), Insights & Analytics (`ChartColumn`), Brand Studio (`PencilRuler`).
    - Admin-only rules stay as today: a member sees Brand Templates and Generate.
    - The selected item matches today's route groups. No item is selected on Settings.
  - **Account:** a large circular `Avatar`, the name in `.t-label-s` / `--text-strong` and the email in `.t-caption-xs` / `--text-secondary`, then a ghost `IconButton` gear (`Settings`, label "Settings").
    - The gear opens the role's default Settings section.
    - It is `selected` (with `aria-current="page"`) while a Settings route shows.
    - The name and email truncate with an ellipsis.
- **Delete** the template and people counts, the workspace select, the dev role toggle and the sign-out button from the sidebar.
- **Collapsed state**, as the `Collapsed=True` variants draw it (189:2151, 189:2415; reference Part A §1):
  - a 76 rail with 16 side padding: the collapse button at the top, then the Logo mark (61:467) at 24
  - the five nav items icon-only: 38 × 36, gap 2, each label as its accessible name and its tooltip (the existing `Tooltip.tsx` hint bubble)
  - the spacer, then the Avatar over the gear, the gear lit on Settings
  - no theme toggle
  - Extend `NavItem` with `showLabel` (default true), matching the Nav item component's new `Show label` boolean, and add a test for the icon-only name.
  - The Template Builder keeps borrowing the collapsed rail (`overrideSidebarCollapsed`).
- **Narrow layout** (below 1024): the mobile bar and drawer keep their structure, and the drawer lists the same `NavItem`s and the new Account block.
- **Keyboard.**
  - The theme toggle, the collapse button, each nav item and the gear take focus in that order, with the 2px-out ring.
  - The collapse button carries `aria-expanded`, and its label says what it does ("Collapse sidebar" / "Expand sidebar").
- `npm run verify` passes. Commit: "New look phase 3: the sidebar".

### Step 4: page headers and the page column

- **`PageHeader`** (`layout/Page.tsx`) becomes a title and optional actions.
  - The title is an `h1.t-title-page` in `--text-strong`. Actions sit in a row on the right, gap 8, vertically centred in the 36-high header row.
  - Remove the `eyebrow` and `description` props and every value callers pass for them.
  - Rename `action` to `actions`.
  - The header sits 24 above the page's first content.
- **Callers** (Part A §3), every one keeping its header actions: Portal, Dashboard (its range control and Export CSV), AdminTemplates (Restore starters and New template), SettingsAdmin ("Settings & Admin"), BrandOverview ("Brand Studio") and BulkFillPage. PeopleAdmin no longer renders its own header (step 1).
- **Bulk fill's title becomes "Bulk fill".** Its eyebrow was the only thing naming the page, and its title was the template's name. List it as proposed copy in the PR (§9, 8).
- **`TemplateFill.tsx`'s own description line** under its title goes too, since the frames draw no helper line. The fill page's breadcrumb header is Phase 4.
- **The page column.** `.sp-page` padding at desktop width becomes 45 on the top, left and right, measured from the sidebar's right edge, with the bottom kept as today. The narrow steps (32, 24, 16) stay. 45 is off the scale and kept as drawn, with a comment naming 13:5776.
- **The Settings rail** moves onto `SettingsRailItem` (the tight focus ring, `--control-fill` when selected, per the component 54:100) with the seven items and icons of Part B §1. It is 200 wide, 32 from the section column.
- **Copy.** Every removed eyebrow and description is listed in the PR (they are copy leaving the product).
- `npm run verify` passes. Commit: "New look phase 3: title-only page headers".

### Step 5: canvas sizes

- **Delete** the Canvas sizes card from `WorkspaceSection.tsx`, with its file-header mention.
- **Stores.** `listCanvasSizes` returns the whole `SIZE_CATALOG`, and `listCanvasSizeSettings` and `setCanvasSizeEnabled` go, from the interface and both stores. The `company_canvas_presets` table stays, unread, for a Phase 9 migration that drops it (§9, 6).
- **Docs.** `docs/ARCHITECTURE.md:65`'s description of the setting changes to match.
- **Readers.** The builder's readers keep working on the full catalogue: the default size for a new template, `CanvasSizePicker`, `SizeGallery` and AdminTemplates' "Create a version".
- `npm run verify` passes. Commit: "New look phase 3: canvas sizes come from the catalogue".

### Step 6: legacy names

- **Deleting** `.sp-sidebar*`, `.sp-goo*`, `.sp-settings-rail` and `.sp-railitem` (where nothing else uses it), `.sp-pagehead__desc`, and `.sp-icon-btn--theme` leaves these names unread: `--nav-active-bg` and `--nav-active-fg` from the sidebar and the goo pill, `--theme-btn-*`, and the `--sb-*` group.
- **Find and delete.** `rg` each name and delete the ones nothing reads. The mobile bar may still read `--sb-border`; keep what it reads.
- **Update BRIDGE.md §3:**
  - `--nav-active-*` keep only their remaining readers: segments, chips and choice tiles, in Phases 5 to 9.
  - Drop the rows that are gone.
- `npm run tokens:check` and `npm run verify` pass. Commit: "New look phase 3: retire the shell's legacy names".

### Step 7: docs

- `docs/ARCHITECTURE.md`: the shell paragraph (the sidebar and account gear, Settings as the home of People, workspaces and sign out) and the canvas-size change.
- `npm run verify` passes. Commit: "New look phase 3: docs".

### Step 8: the gate

1. **Build.** `npm run verify` and `npm run build` pass.
2. **Reachability.** The step 1 test passes for both roles, including a member with one workspace and a member with several. Then, by hand on the local backend in both roles (switching with the banner's dev role control), click every nav item, the gear, every Settings rail item, Switch, Add workspace and Sign out (Supabase only; on the local backend confirm it is absent), and open `/people` and `/settings/team`.
3. **Screens.** `capture .shots/after` and `compare .shots/before .shots/after .shots/diff`.
   - **Expected changes:**
     - the sidebar on every signed-in screen
     - the page header and the page column on the PageHeader screens
     - Settings: the rail, the Workspaces card, Canvas sizes gone, Account's Sign out and dev role
   - **Unchanged:** onboarding stays at 0%. Page bodies move only by the header and column offset.
   - **Compare with the frames.** Set the sidebar and the Brand Templates and Settings › Workspace headers beside `reference/brand-templates-13-5776.png` and `reference/settings-workspace-13-14570.png`.
4. **Keyboard.** On Brand Templates and Settings › Workspace, in both themes:
   - Tab from the top. The theme toggle, collapse, nav items and gear come first, then the page.
   - Every control shows its ring.
   - The collapse button announces its state.
5. **Open the pull request** into `main`: "New look, Phase 3: shell and navigation". It includes:
   - the route table
   - the `compare` table and the side-by-side with the frames
   - the removed copy
   - every ruling from §8 and decision from §9 as built
   - anything that surprised you

## 6. Out of scope (do not do these here)

- **Page bodies:** the cards, lists, fields and controls inside pages, including the restyle of the People list, the Workspace details card and the other Settings sections (Phase 7).
- **Headers owned by later phases:** breadcrumb headers and Generate's greeting (Phases 4 to 6).
- **The footer links** ("Terms of Service · Privacy Policy"). They stay where they are today; each area's phase places them as its frames do.
- **People features the frames show but the code lacks:** member counts, admin seats, "Show all", and the row menu's contents (Phase 7).
- **Layout below desktop width**, beyond the drawer's contents.

## 7. Expected changes

- **Every signed-in screen:**
  - The sidebar is the Sidebar component.
  - Two nav items fewer for admins (People and Settings & Admin) and one fewer for members (Settings & Admin).
  - The gooey pill, the counts and the account switchers are gone.
  - The page column starts 45 from the sidebar.
- **PageHeader screens:** the title alone, with eyebrows and descriptions gone.
- **Settings:**
  - the rail on `SettingsRailItem`, with People in place of Team
  - a Workspaces card first in Workspace
  - no Canvas sizes card
  - Sign out and, on the local backend, the dev role in Account
- **Redirects:** `/people` and `/settings/team` land on Settings › People.
- **Copy that goes:** every eyebrow and description in §5 step 4, and the Team section's text. New copy, all from the frames: "Workspaces", "Add workspace", "Current", "Switch", "Sign out" and "People" (rail). Proposed (not in the frames): "Bulk fill" as that page's title, "Collapse sidebar" / "Expand sidebar", and the dev role label in the banner.

## 8. Rulings on what the file leaves open

| Item | Ruling |
|---|---|
| Settings page title | "Settings & Admin", as the frames say (no change from today). |
| Gear or row | Only the gear opens Settings. The Account component draws the gear as its one button; the People frame's row link is a drawing slip. |
| The gear's look | Build from the component (56:1330): 32 ghost, 16 icon, `--state-selected` when open. Screens draw an 18 icon or a bare glyph; the component wins. |
| Selected rail item | `--control-fill`, as the Settings rail item component (54:100) draws it. Screens draw `--surface-sunken`, the same colour in Light. |
| Sticky sidebar | The panel stays sticky to the viewport, inset 10, as today. The 1261-tall Insights frame stretches it, but that is the frame's height, not behavior. |
| Gooey pill | Goes. The file draws a static selected fill (PLAN decision 3: the file wins). |
| Nav counts | Go. The file draws none (and today's template count never rendered: a lookup bug). |
| Card shadow | `--elevation-small`. Screens draw 2/2/4; the component and RULES §4 say Small. |
| Page title tracking | `.t-title-page` (-0.02em). The frames now use Title/Page on every page title (§9, 7). |
| Off-scale values | Kept as drawn and commented: 45 page padding, 10 sidebar inset, the 2 nav gap. |

## 9. Decisions (CJ, 2026-10-04)

- **Members and workspaces.** Members get the Workspace section holding only the Workspaces card when they belong to more than one workspace (or on the local backend), which is when today's sidebar shows them the switcher. A member with one workspace still sees Account alone.

1. **Workspace rows show the role alone** until Phase 7, from the per-workspace role the memberships query already loads (`roleByCompany`). The count waits for Phase 7: members can only read their own membership row (`read_memberships`), so it needs a server-side count, which CJ decides then. Never show a made-up count on the local backend.
2. **Add workspace** opens today's Create company flow (the onboarding route), unchanged.
3. **The dev role toggle** lives in the dev backend banner, not Settings › Account. The banner is already local-only and shows on every screen for both roles, and Account keeps matching its frame. `shots.mjs` hides the banner by its role and its "Dev backend" text, so keep both or update `settle()`.
4. **Sign out** moves to Settings › Account now, as drawn.
5. **The collapsed sidebar** stays, built to the new `Collapsed=True` variants (Template Builder 189:2151, Settings 189:2415): a 76 rail with 16 side padding, the collapse button, the Logo mark at 24, icon-only nav items (the Nav item's new `Show label` boolean off, 38 × 36, the label as tooltip), and the Avatar over the settings button, lit on Settings. The theme toggle stays out of the rail. The existing variants are now `Collapsed=False`.
6. **Canvas sizes.** Stop reading `company_canvas_presets` now so every size shows, remove the toggles as drawn, and leave the table for a Phase 9 migration that drops it.
7. **Page title tracking** uses the style's -0.02em. The frames are fixed: every page title on the five area pages now uses Title/Page, and nothing else moved.
8. **PageHeader** is title-only everywhere, keeping each page's header actions (the Template Builder list keeps its buttons). Bulk fill's eyebrow was the only thing naming that page, so its title becomes "Bulk fill", listed as proposed copy in the PR.
