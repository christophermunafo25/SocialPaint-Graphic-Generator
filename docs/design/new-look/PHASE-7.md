# New look, Phase 7: Settings

You are a senior front-end engineer on SocialPaint (this repository). This phase rebuilds Settings (`/settings/:section`) to the Figma file "Master UX-UI": the shared frame (title, rail, cards, legal links) and all seven sections, Workspace, People, Integrations, Plan & usage, Sharing, Account and Advanced.

The shell already moved in Phase 3 (the rail, title-only header, People inside Settings, the Workspaces card). This phase rebuilds what sits inside each section on the primitives, drops the helper lines and capital-letter labels as drawn, and rules on what the frames draw that has no backend (§9).

Be exact. Work through the steps in §5 in order, run the checks each step names, and commit after each step with `npm run verify` green (chain the commit on it: `npm run verify && git commit`). Check `git branch --show-current` before every commit. If something here turns out to be wrong once you are in the code, stop and explain the conflict instead of improvising.

**A note on familiar interactions.** CJ has asked to keep interactions people already use when a frame leaves them out (Phases 4 to 6). The frames here drop confirmations, loading and error states, the dev-backend notices and every helper line; §9 D11 records what stays. If you find another one, stop and ask.

**Who sees what.** Every section but Account is admin only; a member who can switch workspaces also gets Workspace, holding only the Workspaces card (`settingsSections.ts`, pinned by `src/app/routes.test.ts`). No frame draws a member's view; §9 D11 rules on it.

---

## 1. Read these first

1. `docs/design/new-look/PLAN.md` (decision 6, and "Behavior changes that need data or product work": "the Plan card is a placeholder by design"), `RULES.md` (§7 error red, §9 no helper text), `BRIDGE.md`, and `PHASE-3.md` (§9, the shell decisions this phase builds on) and `PHASE-6.md` (§8 and §9, for the patterns this phase repeats: row menus, destructive items, 12 / 1.4 text).
2. `docs/design/new-look/PHASE-7-SCREENS.md` in full ("the reference"):
   - **Part A:** the shared Settings frame, Workspace 13:14570, People 13:14769.
   - **Part B:** Integrations 13:15051, Plan & usage 13:15203.
   - **Part C:** Sharing 13:15384, Account 13:15649, Advanced 13:15837.
   - Each Light frame's Dark twin is listed there.
3. The reference images `docs/design/new-look/reference/settings-*.png`.
4. The code:
   - **Page:** `src/app/components/admin/SettingsAdmin.tsx`, `admin/settings/settingsSections.ts`, and the rail in `layout/` (`SettingsRailItem`).
   - **Sections:** `admin/settings/WorkspaceSection.tsx`, `WorkspacesCard.tsx`, `PeopleSection.tsx`, `IntegrationsSection.tsx`, `FigmaConnectForm.tsx`, `UsageSection.tsx`, `SharingSection.tsx`, `AccountSection.tsx` and `AdvancedSection.tsx`.
   - **Shared, legacy:** `admin/settings/settingsShared.tsx` (`DevBackendNotice`, a local `SettingsCard`, `ControlRow`, `TypedConfirmDialog`), the app's `ConfirmDialog`, and `InlineEdit`.
   - **Stores:** `people`, `companies`, `designImport`, `usage` (`getMonthlyUsage`, `getAiUsage`), `publicLinks`, `account`; and the Edge Functions `invite-member`, `integration-status`, `figma-connect`, `canva-auth`, `template-links`, `delete-company`.
5. The primitives in `src/app/components/primitives/`: `SettingsCard`, `SettingsRailItem`, `Stat`, `Metric`, `Status`, `Switch`, `SegmentedControl`, `Avatar`, `Field` / `Input`, `Select`, `Button`, `RowMenu` / `RowMenuTrigger`, `Modal`, `Toast`; and `LegalLinks`.

## 2. What changes

| Surface | Today | After this phase | Figma |
|---|---|---|---|
| Frame | Title, the rail (buttons), each section's cards with mono eyebrows and helper lines | Title, the rail as links, cards on `SettingsCard` with sentence-case titles and no helper lines, legal links at the foot | every frame |
| Workspace | Workspaces card; a stacked Workspace form with hints and a slug Save; Brand enforcement with descriptions | Workspaces with "Admin · {n} people" meta (D2); Workspace details as a 2×2 grid (Name, Slug, Website, Timezone); Brand enforcement as two switch rows | 13:14570 |
| People | Emails in a list, a role select and a red trash button per row | One card: "{n} people" meta (D2), the invite row (Input, role Select, Invite), rows with Avatar, name over email, role Select and a row menu; capped with "Show all {n} people" | 13:14769 |
| Integrations | A dev notice, or cards with the inline token form and a red Disconnect | One card per provider: name, a Status pill ("Connected" / "Not connected"), "Connected by {email} on {date}", Connect or Reconnect and Disconnect | 13:15051 |
| Plan & usage | Four KPI tiles with icon chips and count-up, then "Plan: Free, no limits enforced" | The Plan card in its no-plan state, "Early access" (D1; the plans themselves land in 7b), then one card titled with the month (Exports, Opens with "{n} via public links", Templates used, Members active), then AI usage (Requests, Tokens in, Tokens out) | 13:15203 |
| Sharing | An eight-column table, red Revoke, a red "Revoke all" | Public links as a five-column table (Link with its Active pill over the template, Opens, Last used, Expires, actions), "Show revoked and expired", Emergency with "Revoke all {n} active links", Defaults for new links | 13:15384 |
| Account | Profile rows (with Backend), three icon tiles for Appearance, Notifications with a "sends nothing yet" line | Profile as a 2×2 grid with the display-name pencil, Appearance on `SegmentedControl` (System, Light, Dark), Notifications as three switch rows, Sign out | 13:15649 |
| Advanced | Three cards with descriptions; actions under them | Three cards with the action in the card's header: Export as JSON, Transfer ownership (member Select and Transfer), Delete this workspace | 13:15837 |

## 3. Invariants

- **Every route and role stays as it is.** `src/app/routes.test.ts` keeps passing; `/people` and `/settings/team` still redirect to People; an unknown section still lands on the role's fallback.
- **Multi-tenant (PLAN decision 6).** Everything inside these sections is the account's own data. The frames' Acme Health, Crew plan, $59.99, 26 people and link names are samples, never shown as fact (D1, D2).
- **No new backend unless §9 says so.** Every control drawn without a backend is ruled on in §9; nothing ships that pretends to work.
- **Tokens and primitives only** in what this phase rebuilds. New code reads no legacy name.
- **Behaviour that stays,** drawn or not (D11):
  - **Saving:** Name and Website save on blur with rollback and an error line; the slug's availability check and its confirm; website normalisation; the timezone fallback.
  - **Confirms:** removing a member, disconnecting an integration, revoking a link, revoking all (typed), transferring ownership and deleting the workspace (typed, with live counts) all stay confirmed, rebuilt on `Modal`.
  - **States:** loading skeletons, error states with Retry, empty lists, the busy labels ("Inviting…") and the local backend's notices (restyled, local only).
  - **Shown once:** a public link's address is still shown only when it is made (D4).
  - **Narrow layout:** below 900 the rail stacks above the section, as today.

## 4. Before you change anything

1. Baseline the screens: `npm run shots -- capture .shots/before` and `npm run shots -- props .shots/props-before.json`.
2. Read `settingsShared.tsx` and the two confirm dialogs end to end: every destructive action in this phase keeps its confirm (D5).

## 5. Steps

### Step 1: the shared frame

Build to Part A §0, per §9 D5 and D11.

- **Cards** move onto the primitive `SettingsCard` (title in the card's header, the action on its right as drawn). The local `SettingsCard` and `ControlRow` in `settingsShared.tsx` go when their last caller moves. Integration cards use the drawn 12 gap and Public links 16 (§8).
- **Rail items** become real links (`<a href>` with the in-app click), so cmd-click opens a section in a new tab (D11).
- **Legal links** at the foot of every section, as drawn (`LegalLinks`).
- **Confirms** (D5): `ConfirmDialog` and `TypedConfirmDialog` rebuilt on `Modal`, `Field` and `Button` (destructive confirm in red), with today's copy minus its em dashes.
- **Dev notices** restyled as one quiet line inside the card they replace, local backend only (D11).
- Commit: "New look phase 7: the shared frame".

### Step 2: Workspace

Build to Part A §1, per §9 D2, D6 and D7.

- **Workspaces:** rows with the Avatar tile (with the drawn hairline, §8), name over "{Role} · {n} people" (D2), and Current (Status) or Switch (Button neutral sm); Add workspace in the header.
- **Workspace details:** Name, Slug, Website and Timezone in a 2×2 grid on `Field` + `Input` / `Select`. Saving per D6. Timezone needs type-ahead (D7).
- **Brand enforcement:** "Fields may override bound type styles" and "Allow colors outside the palette" as `Switch` rows; no descriptions (as drawn).
- Commit: "New look phase 7: workspace".

### Step 3: People

Build to Part A §2, per §9 D2 and D8.

- Header "People" with "{n} people · {admins} admins" (D2).
- The invite row: `Input` (placeholder per D8), the role `Select`, Invite (Button primary). Enter invites; feedback per D8.
- Rows: `Avatar`, name over email (D8), the role `Select` (the viewer's own is disabled, as drawn), and the row menu (D8).
- The cap and "Show all {n} people" (D8). Loading, error and empty as today (D11).
- `invite-member`'s error copy loses its em dash (D8); the PR's deploy step is `supabase functions deploy invite-member`.
- Commit: "New look phase 7: people".

### Step 4: Integrations

Build to Part B §1, per §9 D9.

- One card per provider: the name, a `Status` pill, "Connected by {email} on {date}" when connected, then Connect, or Reconnect and Disconnect.
- Connect and Reconnect open the Figma token form per D9. Disconnect keeps its confirm (D5).
- Canva disabled on the server, and the local backend, per D9.
- Commit: "New look phase 7: integrations".

### Step 5: Plan & usage

Build to Part B §2, per §9 D1 and D12.

- **Plan** per D1: "Early access", Admins {n} and Members "Unlimited", laid out as the drawn card (13:15331) with no Brands row and no buttons. Leave the card's header actions slot in place for 7b.
- **{Month Year}:** Exports, Opens (with "{n} via public links" under it when above zero), Templates used, Members active on `Metric`. No icon chips, no count-up (D12). `Metric` gains the sub line.
- **AI usage:** Requests, Tokens in, Tokens out on `Stat`, compact ("1.2M"), Supabase only (D12).
- Commit: "New look phase 7: plan and usage".

### Step 6: Sharing

Build to Part C §1, per §9 D4 and D5.

- **Public links:** "Show revoked and expired" (`Switch`) in the header; the table: Link (name, `Status` "Active" pill, the template beneath), Opens ("112 of 200" when capped), Last used, Expires, then the actions per D4 and the row menu.
- **Emergency:** "Revoke all {n} active links" in the header, typed confirm (D5); hidden when nothing is active.
- **Defaults for new links:** "Allow photo uploads" (`Switch`), "Expires after (days)" and "Open limit" (`Input`), saved as today.
- Empty, loading and error states as today, with "Public links" in place of "Share dialog" in the empty line.
- Commit: "New look phase 7: sharing".

### Step 7: Account

Build to Part C §2, per §9 D10 and D13.

- **Profile:** Display name (with the pencil; editing on `Input` sm in place), Email, Role and Workspace on `Stat`, 2×2. The Backend row only on the local backend.
- **Appearance:** `SegmentedControl` System / Light / Dark, 300 wide with equal segments, as drawn; per browser (D13).
- **Notifications:** three `Switch` rows, per D10.
- **Sign out** as drawn (Button neutral with its icon).
- Commit: "New look phase 7: account".

### Step 8: Advanced

Build to Part C §3, per §9 D5.

- **Export workspace data:** Export as JSON (Button primary with its icon) in the header.
- **Transfer ownership:** the member `Select` ("Choose a member…", options as "{name} ({email})") and Transfer, disabled until one is chosen; the confirm (D5). "Nobody to transfer to" as today.
- **Delete workspace:** Delete this workspace (Button destructive) in the header; the typed confirm with its live counts (D5).
- Commit: "New look phase 7: advanced".

### Step 9: legacy names and docs

- **Delete** what nothing renders any more: `settingsShared.tsx`'s `SettingsCard`, `ControlRow` and `TypedConfirmDialog` (moved to `Modal`), the old `ConfirmDialog` if nothing else uses it, `InlineEdit` if Account was its last caller, the KPI tile component, and the `sp-eyebrow`, `sp-workspaces`, `sp-choice-tile`, `sp-panel-title` rules and legacy names only Settings read.
- **BRIDGE §3:** drop the readers that are gone; **ARCHITECTURE:** Settings on the new look.
- Commit: "New look phase 7: legacy names and docs".

### Step 10: the gate

1. **Build.** `npm run verify` and `npm run build` pass.
2. **Reachability.** `routes.test.ts` passes. Click through on the local backend as admin and as member:
   - every rail item, cmd-click on one, and `/people` redirecting;
   - **Workspace:** rename (and an empty name rolling back), change the slug (taken, then free, then the confirm), an invalid website, the timezone by typing, both switches, Switch workspace;
   - **People, Integrations, Sharing** need Supabase for data: cover their populated states with DOM tests (as Phase 6 did for Import's Figma card), and click their local notices;
   - **Plan & usage:** the month figures and the Plan card per D1;
   - **Account:** edit the display name, Appearance, the switches, Sign out's presence;
   - **Advanced:** Export as JSON downloads; Transfer and Delete open their confirms (cancel them);
   - **Member:** Account only (plus Workspaces when they can switch).
3. **Screens.** `capture .shots/after`, then `compare .shots/before .shots/after .shots/diff`.
   - **Expected changes:** `settings-*`, and `/dev/ui` if a primitive gained a specimen.
   - **Everything else:** 0%. Re-capture once before blaming a small diff on a page this phase didn't touch (the auto-fit headline flips 103/104px with font timing).
   - **Side by side** with the seven references in Light and Dark, fixture data aside.
4. **Keyboard**, both themes: the rail (links), every field, Select type-ahead, switches, the row menus, every confirm (open, Tab, Escape, focus back on its trigger).
5. **Open the pull request** into `main`: "New look, Phase 7: Settings", with what changed, the `compare` table and side by sides, every ruling and decision as built, the proposed copy, and surprises.

## 6. Out of scope (do not do these here)

- **Billing** (plans, prices, Checkout, the portal, the webhook, the plan picker): Phase 7b, right after this phase (D1, `PHASE-7B.md`). Seat and brand limits stay unenforced even then.
- **Sending notifications** (a mail provider, the weekly digest, expiry warnings): its own feature (D10).
- **Figma OAuth** (D9), new integrations, and posting connectors (PLAN).
- Insights (Phase 8).

## 7. Expected changes

- **Changes:** the seven sections and the shared frame, as §2 describes.
- **Data:** none (D2 uses data the app already reads).
- **Unchanged:** every other screen.
- **New copy from the frames:** "Settings & Admin" (as today), "Workspace details", "Brand enforcement", "Allow colors outside the palette", "Show all {n} people", "Connected" / "Not connected", "Connected by {email} on {date}", "Reconnect", "Show revoked and expired", "Emergency", "Revoke all {n} active links", "Defaults for new links", "Expires after (days)", "Open limit", "Display name", "Appearance", "Invited members accepted", "Weekly usage digest", "Public link expiring soon", "Export workspace data", "Export as JSON", "Transfer ownership", "Choose a member…", "Delete this workspace", the month card's labels and "AI usage" with "Requests", "Tokens in", "Tokens out".
- **Proposed** (not in the frames; list in the PR): "Early access" and "Admins {n}" (D1), "{n} people · {admins} admins" (D2), the invite feedback toasts and "Enter an email address" (D8), the row menu items (D4, D8), "Not available" for Canva (D9).
- **Copy that goes** (list each in the PR): every card description and helper line, the slug and website hints, the Brand enforcement explanations, the month caption ("…The full history lives on Insights."), Integrations' token caption, the notifications "sends nothing yet" line (D10), the Created column, and the mono eyebrows.

## 8. Rulings on what the file leaves open

| Item | Ruling |
|---|---|
| 12 / 1.4 text (meta lines, emails, table headers, stat labels) | `.t-label-xs` (1.25), as Phase 6 ruled; noted in the PR. |
| Card gaps 12 (integrations) and 16 (public links) | As drawn, by a modifier on `SettingsCard`; the primitive's 20 stays the default. |
| Avatar hairline | Add the 1px `--border-default` to the default `Avatar`, as drawn on the workspace tiles and members. |
| Dark metric numbers | `--text-strong`; the file's raw white is not a token. |
| Dark lit edge on cards | RULES §4: Elevation/Small only, as in Phase 6. |
| Destructive buttons | Revoke, Revoke all and Disconnect neutral as drawn (Cancel plan arrives in 7b); the confirm's button carries the red (D5). Delete this workspace stays red, as drawn. |
| Metric label | `.t-label-l`, as the `Metric` primitive does. |
| Sort order (People) | You first, then admins, then members, each by name, as drawn. |

## 9. Decisions (CJ, 2026-10-05)

CJ decided D1 (revised: billing moves to Phase 7b) and took D2 to D13 as recommended.

1. **D1. The Plan card (CJ, 2026-10-05).** Plan management is in scope, on Stripe, as its own PR right after this phase: **Phase 7b, Billing** (`PHASE-7B.md`). This phase builds the card's no-plan state with real values: **"Early access"**, Admins {n} (this workspace's admins, no limit) and Members "Unlimited". No Brands row and no buttons until 7b.
2. **D2. Counts.** "3 of 4 admin seats" has no seat concept, and "Admin · 26 people" on other workspaces can't be read today (RLS lets a member read only their own row; Phase 3 kept the count out until it was real).
   - People reads "{n} people · {admins} admins". Workspaces shows "· {n} people" only for the current workspace and those where the viewer is admin, from data the app already reads.
3. **D3. Workspace member view.** Not drawn. A member who can switch sees the Workspaces card alone, laid out as drawn; Add workspace stays for members (today).
4. **D4. Sharing's per-row Copy.** Addresses are stored hashed and shown once (a deliberate security choice, kept in Phase 4), so Copy can't fetch them.
   - Drop Copy. The row keeps Revoke and a row menu of "Manage" (the template's link dialog) and "New address" (regenerates under its confirm and shows the new one once).
5. **D5. Confirms and red.** Every confirm stays (member removal, disconnect, revoke, revoke all typed, transfer, delete typed with live counts), rebuilt on `Modal` with today's copy; the buttons on the page are neutral as drawn (Delete this workspace stays red as drawn), and the confirm's button carries the red.
6. **D6. How Workspace details saves.** No Save buttons are drawn. Name, Website and Timezone save on blur with rollback, as today; the slug checks availability as you type (an error line only when taken or invalid, no "Available." hint) and asks its confirm on blur or Enter.
7. **D7. Timezone.** About 400 zones, and the `Select` primitive has no type-ahead. Add type-ahead to `Select` (typing jumps to the first match, as native selects do); no search field.
8. **D8. People rows.**
   - Names over emails, as drawn; someone with no name yet shows their email alone.
   - **Row menu:** "Remove from workspace" (red: Undo can't bring a membership back, as Phase 6's file removals), with today's confirm.
   - **Cap:** 8 rows, then "Show all {n} people" expands in place (with "Show fewer").
   - **Invite:** placeholder "name@company.com"; Invite stays disabled until the field has text (today); "Invite sent to {email}." and invite errors as a `Toast`; the function's "Could not save the membership — try again." loses its em dash (a change to `invite-member`, so the PR lists `supabase functions deploy invite-member` as its deploy step).
9. **D9. Integrations' undrawn states.**
   - **Figma token:** Connect and Reconnect open today's token form inline under the card, on `Input` + Button primary, with one "How to get a token" link in place of the helper paragraph. Figma OAuth is out of scope.
   - **Canva disabled on the server:** the card shows a neutral "Not available" pill and no buttons.
   - **Local backend:** today's notice, restyled.
   - The Canva sign-in return keeps landing where it does today (moving it changes the redirect registered with Canva).
10. **D10. Notifications send nothing yet.** Preferences save (`user_notification_prefs`), but no mail is delivered, and the frame drops the line that said so.
    - Keep the three switches as drawn (the preference is real and honoured when delivery ships), hide "Invited members accepted" for members (only admins invite), and track delivery as its own feature.
11. **D11. Familiar interactions and undrawn states.** Keep: every state in §3's list; the rail as real links; legal links on every section; the Backend row on the local backend only; and every dev notice, restyled, on the local backend only.
12. **D12. Usage figures.** Drop the count-up and icon chips (as drawn); an empty month shows zeros; "{n} via public links" only when above zero; bulk exports stay unshown; AI usage stays hidden on the local backend; no link to Insights.
13. **D13. Appearance** stays per browser (today), shown as drawn; storing it on the account is not part of this phase.
