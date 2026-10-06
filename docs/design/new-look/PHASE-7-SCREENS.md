# New look, Phase 7: screen reference

Read from the Figma file "Master UX-UI" (`mEJRslarcQDkgPeY6AObi5`), page "Settings" (8:678, section 13:14569), on 2026-10-05, read only. `PHASE-7.md` builds from this file; where the live file disagrees, the file wins, and `PHASE-7.md` §8 and §9 rule on what the file leaves open.

Reference images (1x, Light) in `reference/`: `settings-workspace.png`, `settings-people.png`, `settings-integrations.png`, `settings-plan.png`, `settings-sharing.png`, `settings-account.png`, `settings-advanced.png`. (Phase 3's `settings-workspace-13-14570.png` and `settings-people-13-14769.png` predate a header change and are kept for Phase 3's record.)

| Section | Light | Dark |
|---|---|---|
| Workspace | 13:14570 | 13:15992 |
| People | 13:14769 | 13:16191 |
| Integrations | 13:15051 | 13:16473 |
| Plan & usage | 13:15203 | 13:16625 |
| Sharing | 13:15384 | 13:16806 |
| Account | 13:15649 | 13:17071 |
| Advanced | 13:15837 | 13:17259 |

None of the fourteen frames uses Master component instances: every part is a plain frame, and the mappings to primitives below are by look and measurement. Only the admin's view is drawn, at desktop width.

Contents: Part A, the shared Settings frame, Workspace and People; Part B, Integrations and Plan & usage; Part C, Sharing, Account and Advanced. Each part ends with its behaviour differences against today's code, the interactions the frames drop, what has no backend, the primitives, and its open questions, which `PHASE-7.md` §9 turns into decisions.

---

# Part A: the Settings frame, Workspace and People

Source: Figma "Master UX-UI" (`mEJRslarcQDkgPeY6AObi5`), page "Settings" (8:678), read on 2026-10-05, read only (`get_metadata`, `get_design_context` on the page and section nodes of all four frames). All frames 1440×1053. The sidebar (`sp-nav`, x 0–335) is Phase 3's and is ignored here, except to note that every Settings frame lights the account gear (`settings button (selected)`) and selects no nav item. The page area (`sp-page · Settings`) starts at x 335 and is 1105 wide.

| Frame | Light | Dark | Screenshot (Light, 1440) |
|---|---|---|---|
| Settings · Workspace | 13:14570 (page 13:14644, section 13:14697) | 13:15992 (page 13:16066, section 13:16119) | `reference/settings-workspace.png` |
| Settings · People | 13:14769 (page 13:14843, section 13:14896) | 13:16191 (page 13:16265, section 13:16318) | `reference/settings-people.png` |

(`reference/` also holds Phase 3's `settings-workspace-13-14570.png` and `settings-people-13-14769.png`, the same frames.)

Read this first:

- **No Master instances in any of the four frames.** The rail items, cards, fields, selects, switches, status pill, buttons, avatars and row menu triggers are plain frames (`rail item · …`, `sp-settings-card · …`, `sp-input · …`, `sp-select · …`, `sp-switch · on|off`, `Status · Current`, `sp-chat-btn · …`, `sp-button · Invite`, `sp-row-menu-trigger`). The mappings below are by look and measurement; nearly all land exactly on a Phase 2 primitive.
- **Codegen vs style names on shadows.** Every card prints as `drop-shadow 2/2/4` with inset bevels; the bound style is **Elevation/Small** (2/2 blur 8, plus the Dark bevel). Use `--elevation-small` (as `.ui-card` already does).
- **Codegen vs Light raw values.** Light writes card fills as raw `white`, text as raw `#0b0b0c`, inputs and selects as raw `#f1f1ef`, hairlines as `rgba(11,11,12,.08)`. Dark binds the same layers: `--surface-raised`, `text/primary` (#f1f1f1, which equals `--text-strong` in Dark), `input/fill` (white 8%), and `rgba(255,255,255,.08)`. Map them to `--surface-raised`, `--text-strong`, `--input-bg` and `--border-default`.
- **Raised cards in Dark gain the lit edge**: a `--border-raised` stroke of 0.65 top / 0.25 sides / 0.55 bottom. Light's `--border-raised` is transparent. Same as Phases 5 and 6.
- **The primary button binds brand variables directly.** Invite (People) is `--field-green` fill + `--accent-green` label in Light and `--accent-green` fill + `--field-green` label in Dark. That pair is exactly `--btn-primary-bg` / `--btn-primary-fg` per theme (`tokens.css:198-199`, `272-273`), so it is `Button kind="primary"`.
- **Who sees what today.** Workspace, People, Integrations, Plan & usage, Sharing and Advanced are admin-only; Account is everyone's (`settings/settingsSections.ts:10-18`). A member who can switch workspaces (more than one workspace, or the local backend) also gets Workspace, holding only the Workspaces card (`settingsSections.ts:31-38`, `WorkspaceSection.tsx:20-22`). No frame draws a member's view.

Type key (from `src/styles/tokens.css`): t-title-page 500 30/1.2 −0.02em · t-title-panel 500 17/1.25 −0.01em · t-label-m 500 14/1.25 · t-label-xs 500 12/1.25 · t-body-s 400 14/1.4 · t-caption-s 400 12/1.25 · t-button-m 500 14/1.25 −0.01em · t-button-s 500 12/1.3 −0.01em (trimmed) · t-control-m 500 14/normal −0.01em.

---

## 0. Shared Settings frame (all fourteen Settings frames)

Read from the Workspace and People frames; every other Settings frame repeats it with its own rail item selected (Phase 3 Part B §1 confirms all 14 frames carry the same 7 items).

### Page (`sp-page · Settings` 13:14644, 1105 wide)
- Column. Padding **top 45, bottom 28**, x 0. Children: `PageHeader`, `Settings content` (flex 1), `Footer links`.
- Code: `SettingsAdmin.tsx:69-87` renders `<Page>` → `PageHeader` → `.sp-shell-settings`. At ≥1280 `.sp-page` already sets `--page-pad: 45px` and `padding-top: 45px` (`styles/shell.css:208-213`). The bottom padding is the legacy `.sp-page` 64 (`socialpaint.css:3625`), not 28; the frame's 28 is under the footer links, which Settings does not render (see Behaviour 3).

### PageHeader (13:14645)
- 1105 × 36, row, space-between, items centred, padding x 45.
- Title **"Settings & Admin"** (13:14646): 30 Medium / 1.2 / −0.6 px → `.t-title-page`, `--text-strong` (Light raw `#0b0b0c`, Dark `text/primary`). No eyebrow, no sub-line, **no actions**.
- = `PageHeader` (`layout/Page.tsx:55-68`), exact; `SettingsAdmin.tsx:71` already passes this title. Its 24 bottom margin (`.sp-shell-pagehead`, `shell.css:152`) is the frame's 24 content padding.

### Settings content (13:14647)
- Column, padding **top 24, x 45**, flex 1. One child, `Settings body` (13:14648): **row, gap 32** (`--space-lg`), items start, 1015 wide.
  1. `sp-settings-rail` (13:14649): **200 wide**, column, **gap 2** (off scale), 264 tall (7 × 36 + 6 × 2). No heading above it.
  2. `Section · …` (13:14697 / 13:14896): **flex 1 (783 at 1440)**, column, **gap 24** (`--space-md`) between cards.
- Code: `.sp-shell-settings` is a row with gap 32 and a 200 rail from 900 up, stacked below (`shell.css:218-250`). Exact at desktop.

### Rail item (e.g. 13:14650 selected, 13:14660 resting)
- 200 × 36, row, **gap 12** (`--space-xs`), padding x **10**, radius **7** (`--radius-control`), items centred.
- Icon 18 (lucide at 18, stroke 1.5), then the label, 14 Medium / 1.25 → `.t-label-m`.
- Resting: no fill, label and icon `--text-secondary`. Drawn as `<a>` with `cursor: pointer`.
- Selected: fill Light `--surface-sunken` (#ececec), **Dark `--surface-raised` (#171819)**. That pair is exactly `--control-fill` (paper-100 / ink-800). Label `--text-strong`. Drawn as a `<div>`.
- Items and icons, in order: **"Workspace"** (building), **"People"** (two users), **"Integrations"** (plug), **"Plan & usage"** (credit card), **"Sharing"** (link), **"Account"** (user), **"Advanced"** (two sliders, lucide `settings-2` by look). Same as `ICONS` in `SettingsAdmin.tsx:26-34` and the labels in `settingsSections.ts:10-18`.
- = **`SettingsRailItem`** (`primitives/Navigation.tsx:40-58`; `.ui-rail-item[data-selected]` takes `--control-fill`, `primitives.css:975-978`). Exact; Phase 3 already moved the rail onto it (`SettingsAdmin.tsx:73-84`).
- No hover or focus state is drawn in these frames (the Interaction states table 105:641 owns them).

### Settings card (all cards in both sections)
- Full section width (783), column, padding **24** (`--space-md`), radius **20** (`--radius-card`), `--surface-raised`, Elevation/Small. Dark: plus the `--border-raised` edge.
- Header: row, space-between, items centred. Title 17 Medium / 1.25 / −0.17 px → **`.t-title-panel`**, `--text-strong`.
- **Gap between header and body is 20 on every card except Workspaces, which is 8** (its header is 36 tall because it holds a button; see §1).
- = **`SettingsCard`** (`primitives/Containers.tsx:33-54`; `.ui-card.ui-settings-card` padding 24, gap 20, `primitives.css:1187-1220`). Exact for Workspace details, Brand enforcement and People; Workspaces needs gap 8.

### Footer links (13:14766)
- Row, **gap 16**, centred, padding x 45, at the foot of the page column (y 1010, 28 above the window bottom). "Terms of Service", "Privacy Policy": 12 Regular / 1.25 → `.t-caption-s`, `--text-secondary`, **not underlined**.
- Not drawn as links (plain text) but they are the shell's legal links. Brand Studio renders them as `<p className="t-caption-s sp-bs-legal"><LegalLinks /></p>` (`admin/BrandStudio.tsx:55-57`, `styles/brand-studio.css:30-44`, gap 16, padding-top 48, underline on hover). **Settings renders none today.**

### Dark differences (shared, beyond token flips)
1. Rail selected fill is `--surface-raised` in Dark (Light `--surface-sunken`): both are `--control-fill`, so no override.
2. Every card gains the `--border-raised` edge.
3. Title and labels bind `text/primary` (#f1f1f1); use `--text-strong`, which is #f1f1f1 in Dark.

---

## 1. Settings · Workspace (13:14570)

`Section · Workspace` (13:14697): three cards, gap 24: Workspaces (215 tall), Workspace details (227), Brand enforcement (145). Section height 635.

### Card 1: `sp-settings-card · Workspaces` (13:14698)

- Card recipe as §0, **gap 8** (header to list).
- `header` (13:14699), 735 × 36:
  - Title **"Workspaces"**, `.t-title-panel`.
  - `sp-chat-btn · Add workspace` (13:14701): 150 × 36, padding x 16, gap 6, radius 7, fill `--surface-sunken` (bound in both themes: #ececec / #2f3133). Icon 16 (plus) at x 16; label **"Add workspace"** 14 Medium / normal / −0.14 px (`.t-button-m`, `--text-strong`). → **`Button kind="neutral" size="default" icon={Plus}`**, exact. Code already uses it (`WorkspacesCard.tsx:28-32`).
- `list` (13:14706): column, rows separated by a 1px divider (`--border-default`; Light `rgba(11,11,12,.08)`, Dark white 8%).
- Row (`workspace · Acme Health` 13:14707), 735 × 61: row, **gap 12**, **padding y 12**, items centred.
  - `workspace tile` (13:14708): **32 × 32, radius 7, `--surface-sunken`, 1px border `--border-default`**, initials 12 Medium / 1.25 → `.t-label-xs`, `--text-strong`. Strings **"AH"**, **"AF"** (sample).
  - `text` (13:14710): column, **gap 2**, flex 1.
    - Name: 14 Medium / 1.25 → `.t-label-m`, `--text-strong`. **"Acme Health"**, **"Acme Health Foundation"** (sample).
    - Meta: **12 Medium / 1.4**, `--text-secondary`. **"Admin · 26 people"**, **"Admin · 8 people"** (the role is the viewer's role there; the count is sample). No exact class: nearest `.t-label-xs` (12 Medium / 1.25).
  - Current workspace: `Status · Current` (13:14713): 58 × 21, padding x 8 / y 3, radius 999, fill `--surface-sunken`, label **"Current"** 12 Medium / normal, `--text-secondary`. → **`Status tone="neutral"`**, exact (`primitives.css:924-948`).
  - Other workspaces: `sp-chat-btn · Switch` (13:14722): 57 × 28, padding x 10, radius 7, `--surface-sunken`, label **"Switch"** 12 Medium / 1.3 / −0.12 px, trimmed → `.t-button-s`. → **`Button kind="neutral" size="sm"`**, exact.
- No hover on rows, no menu, no "leave workspace" action is drawn.

### Card 2: `sp-settings-card · Workspace details` (13:14724)

- Card recipe as §0, gap 20. Header 21 tall: title **"Workspace details"** alone (no description).
- `fields` (13:14727): column, **gap 16**. Two `row`s, each a row with **gap 16**, two fields at **flex 1 (359.5 each)**.
- Each `Field · …` (e.g. 13:14729): column, **gap 6**. `label row` (15 tall): label 12 Medium / 1.25 → `.t-label-xs`, `--text-secondary`. Nothing else on the label row (no Optional, no action). **No hint or helper line under any field.**
  - Input (`sp-input · Name` 13:14732): **40 tall**, padding x 12, radius **9**, fill `--input-bg`, value 14 Regular / 1.4 → `.t-body-s`, `--text-strong`. → **`Field` + `Input` (size default)**, exact (`primitives/Field.tsx:12-29, 87-145`; `.ui-input` 40, radius `--radius-control-md`, `primitives.css:307-326`).
- Fields and sample values:
  | Field | Node | Control | Sample value |
  |---|---|---|---|
  | **"Name"** | 13:14729 | Input | "Acme Health" |
  | **"Slug"** | 13:14734 | Input, **Body/S UI type (not mono)**, no Save button beside it | "acme-health" |
  | **"Website"** | 13:14740 | Input | "acmehealth.com" |
  | **"Timezone"** | 13:14745 | `sp-select · Timezone` 13:14748: 40 tall, padding x 12, gap 2, radius 9, `--input-bg`, value `.t-body-s` `--text-strong`, chevron 16 at the right | "America/Chicago" |
- Timezone → **`Select size="lg"`** (40; `primitives/Select.tsx:196-199`, `.ui-select[data-size="lg"]`, `primitives.css:444-455`). Exact look.

### Card 3: `sp-settings-card · Brand enforcement` (13:14752)

- Card recipe as §0, gap 20. Title **"Brand enforcement"** alone; **no card description**.
- `rows` (13:14755): column, **gap 16**.
- Row (13:14756): row, **gap 16**, items centred, 20 tall.
  - Text: one line, 14 Regular / 1.4 → `.t-body-s`, `--text-strong`. **No description line under it.**
  - `sp-switch` (13:14759): 36 × 20, knob 16 inset 2. → **`Switch`** (`primitives/Toggles.tsx:20-51`, `.ui-switch__track` 36 × 20 with 2 padding, `primitives.css:661-703`), exact.
- Rows:
  1. **"Fields may override bound type styles"**, switch **off** (Light track `--switch-background`, white knob).
  2. **"Allow colors outside the palette"**, switch **on** (Light ink track, white knob; Dark white track, dark knob: `--switch-track-on` / knob per theme).
- The states match today's defaults (`allowStyleOverride ?? false`, `allowOffPalette ?? true`, `WorkspaceSection.tsx:394, 410`).

### Dark differences (beyond token flips)
1. Cards gain the `--border-raised` edge.
2. Workspace tile border is white 8%; `--border-default` Dark is paper-075 at 10%. Close; use the token (Phase 6 did the same for the image plate).
3. Add workspace, Switch and the Current pill stay `--surface-sunken` (#2f3133) on the #171819 card: `neutral`, not `neutralOnPage`. Token flip.
4. The on switch inverts (white track, dark knob). Token flip.
5. Nothing else differs: same strings, geometry and states.

---

## 2. Settings · People (13:14769)

`Section · People` (13:14896): one card, `sp-settings-card · People` (13:14897), 783 × 682, card recipe as §0, **gap 20**. Order: header, invite row, members list, Show all link.

### Header (13:14898)
- Row, space-between, items centred, 21 tall.
- Title **"People"**, `.t-title-panel`.
- Right meta **"26 people · 3 of 4 admin seats"**: 12 Medium / 1.4, `--text-secondary`, nowrap. No exact class (nearest `.t-label-xs`). The shape is "{n} people · {admins} of {seats} admin seats"; numbers are sample. `SettingsCard`'s `action` slot can hold it (it renders any node right of the title).

### Invite row (`invite` 13:14901)
- Row, **gap 8** (`--space-2xs`), items centred, 40 tall.
- `sp-input · Invite email` (13:14902): flex 1 (509), 40 tall, padding x 12, radius 9, `--input-bg`. Placeholder **"name@acmehealth.com"** (`.t-body-s`, `--text-secondary`; the domain is sample data). → **`Input`** (default 40). **No visible label** (keep an `aria-label`).
- `sp-select · Invite role` (13:14904): **140 wide**, 40 tall, as the Timezone select. Value **"Member"**. → **`Select size="lg"`**.
- `sp-button · Invite` (13:14908): 70 × 40, padding x 18, radius 9, `--btn-primary-bg` / `--btn-primary-fg` (see "Read this first"), label **"Invite"** 14 Medium / 1.25 / −0.14 px → `.t-button-m`. **No icon.** → **`Button kind="primary" size="md"`**. Drawn **enabled while the email field shows only its placeholder**.

### Members list (`members` 13:14910)
- Column, 8 rows separated by 1px `--border-default` dividers (`rounded-rectangle · divider`). 495 tall.
- Row (`member · Priya Shah` 13:14929), 735 × 61: row, **gap 12**, **padding y 12**, items centred.
  - `avatar` (13:14930): **32 × 32, radius 999, `--surface-sunken`, 1px border `--border-default`**, two initials 12 Medium → `.t-label-xs`, `--text-strong`. → `Avatar` (default, circle), but see the border note in the primitives table.
  - `text` (13:14932): column, **gap 2**, flex 1 (515).
    - `name`: 14 Medium / 1.25 → `.t-label-m`, `--text-strong`. For the viewer's own row (13:14915) the name row is a row with **gap 4**: the name, then **"(you)"** in `.t-label-m` `--text-secondary`.
    - Email: 12 Medium / 1.4, `--text-secondary`. No exact class (nearest `.t-label-xs`).
  - `sp-select · Role` (13:14936): **120 wide, 36 tall**, padding x 12, gap 2, radius 9, `--input-bg`, value `.t-body-s` `--text-strong` (**"Admin"** or **"Member"**), chevron 16. → **`Select`** (size default, 36).
  - `sp-row-menu-trigger` (13:14940): 32 × 32, radius 7, no fill, ellipsis 16. **Drawn visible on every row at rest.** → **`RowMenuTrigger`** (`primitives/IconButton.tsx:45-61`), or `RowMenu` (`primitives/Menu.tsx:216-250`) once its items are known. **No menu is drawn**, so its items are unknown.
- The viewer's row (`member · CJ Munafo` 13:14911, first in the list): `sp-select · Role (disabled)` and `sp-row-menu-trigger (disabled)`, both at **opacity 0.40**. That is the primitives' disabled rule (RULES §6).
- Sample rows (all sample data): CJ Munafo (you) cj@acmehealth.com Admin; Priya Shah priya@… Admin; Marcus Lee marcus@… Admin; Ana Ruiz ana@… Member; Ben Carter ben@… Member; Chloe Park chloe@… Member; Dana Ortiz dana@… Member; Eli Brooks eli@… Member. The viewer is listed first; then admins, then members.

### Show all (13:15047)
- **"Show all 26 people"**: 14 Medium / 1.25 → `.t-label-m`, `--text-strong`, **underlined**, left-aligned under the list, 20 below it (card gap). Plain text in the frame, so not a primitive; it reads as a text link or button. The frame shows 8 of 26 rows, so the list is capped and this expands it.

### Dark differences (beyond token flips)
1. The card gains the `--border-raised` edge.
2. Invite inverts (Slime fill, Deep Moss label): `--btn-primary-*`, token flip.
3. Avatar borders and dividers are white 8% (use `--border-default`).
4. The disabled role select and trigger keep 40% in Dark.
5. Nothing else differs.

---

## Primitives used / not yet primitives

| Frame part | Master (by look) | Repo today | Notes |
|---|---|---|---|
| Page title "Settings & Admin" | Title/Page | `PageHeader` (`layout/Page.tsx:55`) | Exact. Already in use (`SettingsAdmin.tsx:71`). |
| Settings rail item | Settings rail item 54:100 | `SettingsRailItem` | Exact. Already in use. Renders a `<button>`; the frame draws resting items as `<a>`. See Behaviour 2. |
| Settings card | Settings card 58:460 | `SettingsCard` (`Containers.tsx:33`) | Exact (padding 24, gap 20, `.t-title-panel`). Workspaces card draws gap 8: a modifier or className. The header's right slot (`action`) also has to take People's seat meta (plain text, not a Button). Today Workspace details, Brand enforcement and People use the legacy `settingsShared.SettingsCard` (`sp-card sp-card--content`, `.sp-panel-title` 14px, `settingsShared.tsx:23-51`); only Workspaces uses the primitive. |
| Add workspace | Button 43:123, Neutral, Default, icon | `Button kind="neutral" icon={Plus}` | Exact. Already in use. |
| Switch (workspace row) | Button, Neutral, Small | `Button kind="neutral" size="sm"` | Exact. Already in use. |
| Current | Status 52:51, Neutral | `Status tone="neutral"` | Exact. Already in use. |
| Workspace tile | Avatar 54:62, square | `Avatar shape="square"` | Size, radius 7 and fill match. **The frame adds a 1px `--border-default` hairline at 32**; the primitive draws the border only at Large 38 (`primitives.css:991-1003`). |
| Member avatar | Avatar 54:62, circle | `Avatar` | Same hairline difference. Today People hand-rolls a 26px circle with one letter (`PeopleSection.tsx:166-190`). |
| Name / Slug / Website | Field 48:38 + Input 48:37 | `Field` + `Input` | Exact. Today raw `sp-input` with `sp-eyebrow` labels and helper lines (`WorkspaceSection.tsx:81-101, 143-180, 245-294`). |
| Timezone | Select 49:40, Large | `Select size="lg"` inside `Field` | Look exact. **The primitive has no type-ahead or search**; the list is every IANA zone (`listTimeZones`, ~400 entries, `lib/companySettings.ts`). The legacy `ui/Select` has a `searchable` option (`ui/Select.tsx:309-313`). Today a native `<select>` (`WorkspaceSection.tsx:329-341`), which has native type-ahead. |
| Brand enforcement switches | Switch 49:45 | `Switch` (`primitives/Toggles.tsx`) | Exact. Today the legacy `components/Switch.tsx` (`.sp-switch`) inside `ControlRow` with inline type (`settingsShared.tsx:56-78`). |
| Switch row | none | `ControlRow` (`settingsShared.tsx:56`) | Not a primitive. Restyle: one `.t-body-s` line, gap 16, centred, no description. |
| Invite email | Input 48:37 | `Input` | Exact. No visible label: `aria-label`. Errors go on an error line (RULES §9): `Field` needs a visible label, so either a visually hidden label or the Input with `aria-invalid` plus a message. |
| Invite role | Select, Large | `Select size="lg"` | Exact. Today a native `<select>` styled `sp-input` (`PeopleSection.tsx:97-105`). |
| Invite | Button, Primary, Medium | `Button kind="primary" size="md"` | Exact. Today `.sp-btn.sp-btn-primary` at 40 with a Send icon (`PeopleSection.tsx:106-114`). |
| Member role | Select, Default (36) | `Select` | Exact. Today a native `<select>` at caption size (`PeopleSection.tsx:202-217`). |
| Member row menu | Row menu trigger 44:29 (+ Menu 57:423, undrawn) | `RowMenuTrigger` / `RowMenu` | Trigger exact. Today a red `Trash2` icon button (`PeopleSection.tsx:218-225`). |
| Member / workspace row | none | `.sp-workspaces__row` (`shell.css:14-38`, Phase 3) | Not a primitive. The Phase 3 row recipe (gap 12, padding y 12, hairline between rows, text column gap 2) fits both lists; People can share it. |
| Seat meta, workspace meta, member email | none | `.t-caption-s` today | 12 Medium / 1.4 has **no class**; nearest `.t-label-xs` (12 Medium / 1.25). Phase 6 raised the same gap. |
| "(you)" | none | inline span (`PeopleSection.tsx:197-199`) | `.t-label-m` `--text-secondary`, gap 4. |
| Show all | none | none | Not a primitive. Underlined `.t-label-m` text button; needs a hover look and the 2px-out ring (RULES §6). |
| Footer links | none | `generate/LegalLinks` + `.sp-bs-legal` | Not a primitive. Brand Studio's composition matches (gap 16, `.t-caption-s`, not underlined at rest). |
| Typed / plain confirm dialogs | Modal (Containers) | `ConfirmDialog` (`components/ConfirmDialog.tsx`), `TypedConfirmDialog` (`settingsShared.tsx:84-185`) | Not drawn in these frames. Both use legacy tokens and inline type. |

---

## Behaviour differences vs code

Code read: `admin/SettingsAdmin.tsx`, `admin/settings/{WorkspaceSection,WorkspacesCard,PeopleSection,settingsShared,settingsSections}.tsx|ts`, `WorkspacesCard.test.tsx`, `components/ConfirmDialog.tsx`, `components/Switch.tsx`, `layout/Page.tsx`, `primitives/*`, `lib/auth/AuthContext.tsx`, `lib/companySettings.ts`, `lib/companyWebsite.ts`, `lib/stores/interfaces.ts:129-143`, `lib/stores/supabase/peopleStore.ts`, `lib/stores/local/localStores.ts:588-601`, `supabase/functions/invite-member/index.ts`, `supabase/migrations/0006_real_auth.sql:89-97`, `src/styles/{shell,primitives,tokens}.css`. Paths are relative to `src/app/components/admin/settings/` unless given in full.

### Shared frame
1. **Page bottom padding.** Frame 28 under the footer links; code 64 (`.sp-page`, `socialpaint.css:3625`) with no footer. Settles once Behaviour 3 is decided.
2. **Rail items are links in the frame** (`<a>`, cursor pointer); today they are buttons that call `navigate` (`SettingsAdmin.tsx:75-82`), so cmd-click cannot open a section in a new tab even though every section is URL-addressable (`router.tsx:179-180`). Phase 6 made the same call for the Brand Studio breadcrumb.
3. **Footer links.** The frames show "Terms of Service" and "Privacy Policy" at the foot of every Settings frame; Settings renders none (`SettingsAdmin.tsx:69-87`). Brand Studio's `sp-bs-legal` composition can be reused.

### Workspace
4. **Cards move to the primitive.** Workspace details and Brand enforcement use the legacy `SettingsCard` (`settingsShared.tsx:23-51`: `.sp-panel-title` 14px, `space-y-3` = 12 gap, legacy `sp-card`). Frame: `SettingsCard` primitive, `.t-title-panel` 17, gap 20.
5. **Card title renamed.** "Workspace" (`WorkspaceSection.tsx:37`) becomes **"Workspace details"**.
6. **Two-column fields.** Today the four fields stack in one column (`:38-41`). Frame: a 2 × 2 grid (Name | Slug, Website | Timezone), gap 16 both ways. Below desktop the frames say nothing; PLAN keeps today's responsive behaviour, so the grid needs a one-column step.
7. **Labels.** Today `sp-eyebrow` mono uppercase (`:83-89, 145-151, 256-262, 322-328`). Frame: `Field`'s `.t-label-xs` sentence case.
8. **Helper lines removed** (RULES §9 agrees):
   - Website: "Stored without the protocol. Starter templates use it for their footer links." (`:177`).
   - Slug: "Part of how this workspace is addressed.", "Checking availability…", "Available." (`:235-243`).
   - Timezone: "Insights charts bucket days in this zone, so everyone reads the same daily numbers. Yours is {zone}." (`:342-351`).
   The real errors move to the Field error line: "That does not look like a domain. Try something like acme.com." (`:176`), "Lowercase letters, numbers, and dashes only." and "That id is already taken." (`:236-238`).
9. **Slug type and Save.** Today the slug is mono at caption size (`:273`) and a primary **Save** button appears beside it once it changes, enabled only when valid and free (`:275-283`), then a confirm dialog (`:247-255`). Frame: Body/S UI type and no button. How the slug commits is undrawn (Open question 3).
10. **Timezone control.** Native `<select>` (`:329-341`) becomes the `Select` primitive at 40, which has no type-ahead (see primitives table).
11. **Footer note removed**: "Changes save as you make them. There is no page-level save button." (`:44-46`).
12. **Brand enforcement copy removed.** The card description "Applied when templates render. These switch the rules engine and leave the editing UI alone." (`:383`) and the per-row descriptions, which change with the switch state (`:387-391, 403-407`), are gone. Each row is one `.t-body-s` line with the switch, gap 16, centred (today `ControlRow` aligns to the top with a 16 gap, `settingsShared.tsx:66`).
13. **Switch primitive.** Legacy `components/Switch.tsx` (`WorkspaceSection.tsx:8, 393-398, 409-414`) moves to the `Switch` primitive. Same markup pattern (hidden checkbox with `role="switch"`).
14. **Workspaces card gap.** Today `WorkspacesCard` uses the primitive `SettingsCard` with its 20 gap; the frame draws 8 between the 36-tall header and the list.
15. **Workspace meta adds a member count.** Today the meta is the role alone, by decision: "the count waits for Phase 7, and none is ever made up" (`WorkspacesCard.tsx:17-21`), and a test asserts no count (`WorkspacesCard.test.tsx:34-39`). Frame: "Admin · 26 people". **No backend today:** `Company` carries no count (`lib/types.ts:9-25`), and RLS lets a user read only their own membership row unless they are that company's admin (`0006_real_auth.sql:90-91`), so a member cannot count another workspace's people without a new security-definer RPC or a count column.
16. **Meta type.** Today `.t-caption-s` (12 Regular / 1.25, `WorkspacesCard.tsx:44`); frame 12 Medium / 1.4.
17. **Workspace tile border.** Avatar at default size has no border; the frame draws a 1px hairline.
18. **Page-level error banner.** Today a danger-wash `role="alert"` paragraph above the cards collects every field's save error (`:26-35`, legacy `--danger-wash` / `--destructive`). Not drawn.

### People
19. **One card.** Today the invite row sits loose on the page and the list is a separate legacy `sp-card` (`PeopleSection.tsx:87-115, 139-229`). Frame: everything in one `SettingsCard` titled **"People"** with the seat meta in its header.
20. **Header meta "26 people · 3 of 4 admin seats".** The people count and the admin count are derivable from `stores.people.list` (an admin reads every membership row). **Admin seats have no backend**: there is no seat limit anywhere in the schema or code (no "seat" in `supabase/` or `src/lib`). PLAN says the Plan card is a placeholder by design and the code has no billing.
21. **Invite row.** Placeholder "person@company.com" (`:93`) becomes "name@acmehealth.com" in the frame (sample domain). Role select becomes `Select lg` 140 wide; Invite becomes `Button primary md` **without the Send icon** (`:112`). Gap 8 (today `gap-2` = 8). The frame draws Invite **enabled with an empty field**; today it is disabled until the email is non-empty and on the dev backend (`:109`).
22. **Members show names.** Today each row shows only the **email** in label type with " (you)" (`:192-200`); `Member.name` (from `users.name`, `peopleStore.ts:15-22`) is fetched but never shown. Frame: name in `.t-label-m` with "(you)" beside it, email below in 12 Medium secondary.
23. **Avatar.** Today 26px, one letter of name or email, legacy `--bg-raised` and `--font-head` (`:166-190`). Frame: 32 circle, two initials, `--surface-sunken` with a hairline. `workspaceInitials` (`WorkspacesCard.tsx:9-13`) already makes two letters.
24. **Row geometry.** Today padding 12/24, min height 56, gap 12 (`:157-164`) inside a separate card. Frame: padding y 12, x 0 (the card's 24 padding is the inset), 61 tall, gap 12, hairline dividers.
25. **Role select.** Native `<select>` at caption size, `padding: 5px 8px` (`:202-217`) becomes `Select` at 36, 120 wide. Disabled for the viewer (same rule as `:206`), drawn at 40%.
26. **Remove moves into a row menu.** Today a red `Trash2` icon button opens a confirm dialog (`:218-225, 64-70`); disabled for the viewer at **30%** opacity (`:222`). Frame: a neutral ellipsis `RowMenuTrigger`, disabled at **40%** for the viewer. The menu's items are not drawn.
27. **Row order.** The frame lists the viewer first, then admins, then members. Today rows come in membership `created_at` order (`peopleStore.ts:17`).
28. **List cap and Show all.** The frame shows 8 rows of 26 and "Show all 26 people". Today the full list renders with no cap.
29. **Success and error lines.** Today "Invite sent to {email}." in `--state-primary` (`:52, 127-137`) and errors in `--state-danger` (`:116-126`) under the invite row. Not drawn.

---

## Interactions and states the frames drop

Each is today's behaviour and is absent from the frames. CJ decides each.

Shared:
1. **Member view of Settings.** No frame draws it. Today a member sees Account, plus Workspace holding only the Workspaces card when they can switch (`settingsSections.ts:28-38`, `WorkspaceSection.tsx:20-22`). The Workspaces card's "Add workspace" shows for members too (`WorkspacesCard.tsx:28-32`).
2. **URL correction.** An unknown section, or one the role cannot see, lands on the role's fallback and rewrites the address without a history entry (`SettingsAdmin.tsx:57-67`, `settingsSections.ts:42-54`). `/people` and `/settings/team` redirect to People (`router.tsx:297-300`). Invisible; keep.
3. **Narrow layout.** Below 900 the rail stacks above the section (`shell.css:218-250`). Frames are desktop only; keep (PLAN, Scope).

Workspace:
4. **Save-on-blur with rollback** for Name and Website; Enter blurs to save; an empty name restores the old one (`WorkspaceSection.tsx:60-79, 94-95, 115-141`). Fields disable while saving (`:97, 163`). Nothing in the frame says how a field saves.
5. **Slug availability check** (350 ms debounce against `slug_available`, `:204-217`) and its live hint.
6. **Slug change confirmation**: "Change the workspace id to “{slug}”?" / "Any URL someone bookmarked with the old id stops resolving. Nothing inside the app breaks. This is about links people saved." / "Change id" (`:247-255`).
7. **Website validation** and normalisation (bare domain, protocol stripped, `lib/companyWebsite.ts:18-36`); an invalid entry rolls back and shows the error (`:120-124`).
8. **Timezone default**: a company with no zone shows the browser's (`:304`); a zone the runtime does not know falls back to UTC (`:331`).
9. **Switch busy state**: both switches disable while the kit saves (`:395, 411`); the kit is written whole through `kitShape` (`:371`).
10. **Error banner** for any failed save (`:26-35`).
11. **Switch workspace** reloads the company (`setCompany`, `WorkspacesCard.tsx:54`); **Add workspace** opens onboarding (`:29`). Both drawn as controls; their results are not.
12. **Danger actions** that live in Advanced today (typed confirm for delete workspace and revoke all links, `settingsShared.tsx:80-185`). Outside this part's frames; the part that covers Advanced owns them.

People:
13. **Loading**: `SkeletonRows rows={3} label="Loading your team"` (`PeopleSection.tsx:140-141`). Not drawn.
14. **Load error**: `ErrorState` "We couldn't load your team." / "Check your connection and try again." with Retry (`:142-147`). Not drawn.
15. **Empty list**: "No members yet." (`:148-154`). Not drawn. On the local backend the list is always empty (`localStores.ts:589-591`), so the screenshot fixture shows this state.
16. **Dev backend notice**: "People management needs the Supabase backend with auth enabled. This dev backend has no real accounts." (`:72-85`), and Invite disabled there (`:109`). Not drawn.
17. **Inviting state**: the button reads "Inviting…" while busy (`:113`). Not drawn.
18. **Enter in the email field invites** (`:92`). Invisible; keep.
19. **Invite success notice** "Invite sent to {email}." and the field clearing (`:52-54`). Not drawn.
20. **Invite errors**: the Edge Function's "Could not invite that address." and "Could not save the membership — try again." (`invite-member/index.ts:57, 69`; the second contains an em dash, RULES §9), plus "Invite failed." Not drawn.
21. **Remove confirmation**: "Remove {email} from {workspace}?" / "Remove member", red (`:64-70`). Not drawn, and the frame has no visible Remove at all.
22. **Role change** applies immediately with no confirmation and reloads the list; failures show "Failed." (`:207-213`). Not drawn.
23. **Pending invites.** Neither the code nor the frame has them: `invite-member` creates the membership at once (`index.ts:42-72`), so an invited person appears as a member immediately, with their email and no name. The frame's rows all have names; an invited-but-not-joined row is undrawn.

---

## Controls with no backend today

| Control | Frame | What is missing |
|---|---|---|
| Workspace member count ("· 26 people") | Workspaces rows | No count on `Company`; members cannot read other members' rows (RLS). Needs an RPC or a column. |
| "3 of 4 admin seats" | People header | No seat limit or plan anywhere. The "26 people" half is derivable. |
| Row menu items | People rows | Undrawn. Remove exists (`stores.people.remove`); anything else (resend invite, transfer ownership) has no backend. |
| Resend / pending state | (implied by Invite) | No invite table; invites become memberships immediately. |

Everything else drawn (name, slug, website, timezone, both switches, switch workspace, add workspace, invite, role change) is backed today.

---

## Open questions

1. **Admin seats.** "3 of 4 admin seats" has no backend and PLAN calls the Plan card a placeholder. Show "{n} people · {admins} admins" (derivable), show the people count alone, or build seat limits (product work, and the Plan & usage frame draws "Admin seats 3 of 4" too)?
2. **Workspace member counts.** The Phase 3 decision kept the count out until it is real (`WorkspacesCard.tsx:17-21`). Build a security-definer RPC (or a counted column) so members see counts for workspaces where they are not admin, or show the count only where the viewer is admin?
3. **How Workspace details saves.** No Save buttons and no status are drawn. Keep save-on-blur with rollback for Name, Website and Timezone? For Slug, which today needs Save plus a confirm: save on blur and confirm then, keep a Save button that appears on change (undrawn), or drop the confirm?
4. **Slug hints.** RULES §9 removes hint text. Keep only the two real errors on the error line and drop "Checking availability…" / "Available.", or keep availability as an error-line-only state?
5. **Timezone picker.** The `Select` primitive has no search or type-ahead and the list is ~400 zones. Add search (the legacy `ui/Select` has it) or type-ahead to the primitive, or keep a native select styled as the primitive?
6. **Brand enforcement descriptions.** The frame drops the card description and the state-dependent row descriptions, which are the only place the switches' effect is explained. Drop as drawn?
7. **Row menu contents** for a member row: Remove only (with today's confirm), or more? Is Remove red in the menu (the `RowMenu` primitive supports `destructive`, `Menu.tsx:144-155`) or neutral as Phase 6's image menu drew it?
8. **Show all.** Cap the list at 8 with "Show all {n} people" as drawn? Does it expand in place, and is there a "Show fewer"? What sort order: viewer, admins, members (as drawn), then by name?
9. **Names vs emails.** Show `Member.name` with the email beneath as drawn. When a member has no name (an invite not yet accepted), show the email as the first line and nothing beneath, or "Invited" in the meta?
10. **Invite with an empty field.** Enabled as drawn (a click shows a Field error such as "Enter an email address", proposed copy), or disabled until there is text, as today?
11. **Invite placeholder.** "name@acmehealth.com" uses the sample tenant's domain. Use "name@{workspace website}" when the workspace has a website and a generic placeholder otherwise, or keep "person@company.com"?
12. **Invite feedback.** Where do "Invite sent to {email}." and invite errors go: a `Toast`, or a line under the invite row? The Edge Function's "Could not save the membership — try again." needs its em dash removed (RULES §9).
13. **Member view.** Confirm a member's Workspace section is the Workspaces card alone, laid out as drawn, and that "Add workspace" stays for members.
14. **Footer links on Settings.** Add the legal links (as Brand Studio does) to every Settings section?
15. **Rail items as links.** Make `SettingsRailItem` render an `<a href>` (cmd-click opens a section in a new tab) as drawn, or keep buttons?
16. **Avatar hairline.** Add the 1px `--border-default` to the default-size Avatar (both the workspace tile and member avatars draw it), or keep the primitive as is?
17. **12 Medium / 1.4 text** (workspace meta, seat meta, member email) has no text style. Use `.t-label-xs` (1.25), or add the style in Figma first (RULES §1)? Phase 6 asked the same.
18. **Loading, empty, error and dev-backend states** for People are undrawn. Keep today's (skeleton rows, ErrorState, "No members yet.", the dev notice) restyled inside the card?


---

# Part B: Integrations and Plan & usage

Source: Figma "Master UX-UI" (`mEJRslarcQDkgPeY6AObi5`), page "Settings" (8:678), read on 2026-10-05, read only. All frames 1440×1053. The sidebar (`sp-nav`, x 0–335) is ignored. The page (`sp-page · Settings`, x 335, w 1105), the page header ("Settings & Admin"), the Settings body (1015 wide at x 45, y 24 under the header) and the 200-wide `sp-settings-rail` are the shared Settings frame, described in the shared part of this spec. This part covers only the section column (`Section · …`, x 232 inside the body, **783 wide**) and notes where these frames deviate from the shared frame.

| Frame | Light | Dark | Screenshot (Light, 1440) |
|---|---|---|---|
| Settings · Integrations | 13:15051 | 13:16473 | `settings-integrations.png` |
| Settings · Plan & usage | 13:15203 | 13:16625 | `settings-plan.png` |

Read this first:

- **No Master instances in any of the four frames.** Cards, status pills, buttons and stats are plain frames. The mappings below are by look and measurement, and nearly every part lands on an existing Phase 2 primitive: `SettingsCard` (58:460), `Status` (52:51), `Button`, `Stat` (59:449) and `Metric` (59:452).
- **Shared frame deviations: none.** Both frames use the same `PageHeader` (13:15126 / 13:15278), the same rail with the section's item selected (`rail item · Integrations (selected)` 13:15148, `rail item · Plan & usage (selected)` 13:15307), the same footer links and the same body offsets. Dark frames have identical geometry, node for node (Integrations 13:16600 mirrors 13:15178; Plan & usage 13:16752 mirrors 13:15330).
- **No section title or helper line inside the section column.** The column starts with its first card at y 0. Today's sections have no in-column heading either, but both carry helper captions (see Behaviour differences).
- **Light writes text raw, Dark binds it.** Light titles, button labels and values are raw `#0b0b0c` (= `--text-strong`) and card fills raw `bg-white` (= `--surface-raised`). Dark binds the same text to `text/primary` (#f1f1f1, which equals `--text-strong` in Dark; do **not** use `--text-primary` in Light, it is #272727). Use `--text-strong` throughout. Exception noted under Dark differences: Dark's big metric numbers are raw `white`.
- **Codegen vs style names on shadows.** Codegen prints every card as `drop-shadow 2/2/4`; the bound effect style is **Elevation/Small** (2/2 blur 8 plus the bevel insets). Use `--elevation-small`. Light's bevel and `--border-raised` are transparent.
- **Everything inside the cards except the interface labels is sample data** (RULES §2): the email, the dates, "Crew plan", the price, seat and brand counts, every number.

Type key (from `src/styles/tokens.css`): t-title-panel 500 17/1.25 −0.01em · t-title-metric 500 40/1.1 −0.03em · t-label-l 500 15/1.25 −0.01em · t-label-xs 500 12/1.25 · t-body-s 400 14/1.4 · t-caption-m 400 13/1.25 · t-button-m 500 14/1.25 −0.01em.

Colour key (Light / Dark): `--surface-raised` white / #171819 · `--surface-sunken` #ececec / #2f3133 · `--text-strong` #0b0b0c / #f1f1f1 · `--text-secondary` #636363 / #a0a0a0 · `--status-positive-bg` Deep Moss #082a23 / #2f3133 · `--accent-green` #17ff7e both · `--btn-primary-bg/-fg` Deep Moss + Slime in Light, inverted in Dark · `--border-raised` transparent / rgba(241,241,241,.2).

---

## 1. Settings · Integrations (13:15051)

### `Section · Integrations` (13:15178): column, gap **24**, 783 wide, 220 tall

Two cards, Figma first, then Canva. No footer caption under them.

### `sp-settings-card · Figma` (13:15179), connected: 783 × 112

- Column, padding **24**, gap **12** (off the primitive's 20, see Primitives), radius 20 (`--radius-card`), `--surface-raised`, Elevation/Small.
- `header` (13:15180): row, space-between, items centred, 735 × **36** (the button height sets it).
  - `title` (13:15181): row, gap **10** (off the scale, as drawn), items centred.
    - **"Figma"**: 17 Medium −0.17px, line-height 1.25 → `.t-title-panel`, `--text-strong`, nowrap.
    - `Status · Connected` (13:15183): 76 × 21, padding x 8 / y 3, pill radius (`--radius-pill`), fill Light raw `--field-green` (#082a23) = **`--status-positive-bg`**, label **"Connected"** 12 Medium in `--accent-green` → `.t-label-xs`. = **`Status tone="positive"`** (default size, 21 tall).
  - `actions` (13:15185): row, gap **8**, items centred.
    - `sp-chat-btn · Reconnect` (13:15186): h 36, padding x 16, radius 7, `--surface-sunken`, **"Reconnect"** 14 Medium −0.14px (`.t-button-m`), `--text-strong`. = **`Button kind="neutral" size="default"`**, no icon.
    - `sp-chat-btn · Disconnect` (13:15188): same recipe, **"Disconnect"**. **Neutral, not red, no icon.**
- `provenance` (13:15190): full width, 16 tall, 13 Regular, `--text-secondary` → `.t-caption-m`. Copy: **"Connected by cj@acmehealth.com on Sep 14, 2026"** (email and date are sample data; the sentence shape is today's, `IntegrationsSection.tsx:141–144`).

### `sp-settings-card · Canva` (13:15191), not connected: 783 × 84

- Same card recipe; one child, so no gap applies.
- `header` (13:15192): as Figma's.
  - **"Canva"**, `.t-title-panel`, `--text-strong`.
  - `Status · Not connected` (13:15195): 96 × 21, padding x 8 / y 3, pill, `--surface-sunken`, label **"Not connected"** 12 Medium `--text-secondary`. = **`Status tone="neutral"`**.
  - `actions` (13:15197): one button, `sp-chat-btn · Connect` (13:15198), 85 × 36, neutral default recipe, **"Connect"**.
- **No provenance line** (nothing to say when not connected) and no "Not enabled on this server" variant.

### What is drawn, per state

| Card | Status pill | Buttons | Second line |
|---|---|---|---|
| Figma, connected | Connected (positive) | Reconnect, Disconnect | Connected by … on … |
| Canva, not connected | Not connected (neutral) | Connect | none |

Not drawn: Figma not connected, Canva connected (with today's token-expiry clause), either provider disabled, the Figma token form, loading, error, the disconnect confirmation, the local-backend notice. See "Interactions the frames drop".

---

## 2. Settings · Plan & usage (13:15203)

### `Section · Plan & usage` (13:15330): column, gap **24**, 783 wide, 515 tall

Three cards in this order: **Plan**, then **the month**, then **AI usage**. (Today's order is month, AI usage, Plan.)

### `sp-settings-card · Plan` (13:15331): 783 × 148

- Column, padding **24**, gap **20**, radius 20, `--surface-raised`, Elevation/Small. Gap 20 and padding 24 are exactly `.ui-settings-card`.
- `header` (13:15332): row, space-between, items centred, 735 × 41.
  - `plan` (13:15333): column, gap **4**, nowrap.
    - Title **"Crew plan"** (sample plan name): `.t-title-panel`, `--text-strong`.
    - Price line **"$59.99 per month · Renews Oct 14, 2026"** (sample): 13 Regular, 16 tall → `.t-caption-m`, `--text-secondary`. Middle dot separator.
  - `actions` (13:15336): row, gap **8**, items centred (sits 2.5 down to centre on the 41-tall block).
    - `sp-chat-btn · Cancel plan` (13:15337): 105 × 36, padding x 16, radius 7, `--surface-sunken`, **"Cancel plan"**, `.t-button-m`, `--text-strong`. = **`Button kind="neutral" size="default"`**. Not red.
    - `sp-button · Upgrade plan` (13:15339): 115 × 36, padding x 16, radius 7, Light fill `--field-green` (#082a23) with an `--accent-green` label = **`--btn-primary-bg` / `--btn-primary-fg`**, **"Upgrade plan"**, 14 Medium −0.14px / 1.25 (`.t-button-m`). = **`Button kind="primary" size="default"`**.
- `stats` (13:15341): row, gap **24**, three equal columns (`flex: 1`, 229 wide), each a fixed **39 tall** column with overflow clip.
  - Each stat: column, gap **4**. Label: 12 Medium / 1.25, `--text-secondary` (bound to the **Label/XS** style) → `.t-label-xs`. Value: 14 Regular / 1.4, `--text-strong` (bound to **Body/S**) → `.t-body-s`. = **`Stat`** (59:449), exactly.
  1. **"Admin seats"**: **"3 of 4"**
  2. **"Brands"**: **"2 of 3"**
  3. **"Members"**: **"Unlimited"**
  - Labels are interface copy; the values (and "Unlimited") are sample data.

### `sp-settings-card · September 2026` (13:15351): 783 × 191

- Same card recipe (padding 24, gap 20).
- `header` (13:15352): one text, **"September 2026"**, `.t-title-panel`, `--text-strong`. The card's title is the current month and year (sample month).
- `stats` (13:15354): row, gap **16**, four equal columns (171.75 wide), items start, nowrap. Each column: gap **12**.
  - Label: 15 Medium, line-height normal, no tracking, `--text-strong` (18 tall). Closest class `.t-label-l` (15/1.25, −0.01em).
  - Value: 40 Medium, line-height **44**, −1.2px → `.t-title-metric` (40/1.1 = 44, −0.03em = −1.2px), `--text-strong`.
  - = **`Metric`** (59:452): `.t-label-l` over `.t-title-metric`, gap 12, `--text-strong`. Exact except the label's tracking.
  1. **"Exports"**: **"1,046"**
  2. **"Opens"**: **"2,318"**, then a third line **"286 via public links"**: 13 Regular, 16 tall, `--text-secondary` → `.t-caption-m`, 12 below the value (the column's gap). This column is 102 tall; the others are 74.
  3. **"Templates used"**: **"12"**
  4. **"Members active"**: **"21"**
- **No icons, no icon chips, no tiles.** The four metrics sit inside one card, not four cards. Numbers use thousands separators.

### `sp-settings-card · AI usage` (13:15368): 783 × 128

- Same card recipe.
- `header` (13:15369): **"AI usage"**, `.t-title-panel`, `--text-strong`.
- `stats` (13:15371): row, gap **24**, three equal `Stat`s (229 wide, 39 tall), same recipe as the Plan card's stats.
  1. **"Requests"**: **"412"**
  2. **"Tokens in"**: **"1.2M"**
  3. **"Tokens out"**: **"318.4K"**
  - The compact forms ("1.2M", "318.4K") match today's `Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 })` (`src/lib/stores/monthlyUsage.ts:110`). "412" matches `toLocaleString("en")` (`:115`).
- No "this month" suffix; the month is implied by the card above.

---

## Dark differences (beyond token flips)

Token flips apply (`--surface-raised` #171819, `--surface-sunken` #2f3133, `--text-strong` #f1f1f1, `--text-secondary` #a0a0a0, bevel and shadow). Beyond flips:

- **Raised cards gain the `--border-raised` hairline** (0.65 top / 0.25 sides / 0.55 bottom): all five cards. As in Phase 5 and 6, the elevation composite carries the Dark edge; no extra rule.
- **Connected pill** fill is `--surface-sunken` (#2f3133) in Dark, Deep Moss in Light, with `--accent-green` text in both. That pair is exactly `--status-positive-bg` (Light Deep Moss, Dark ink-700 #2f3133), so `Status tone="positive"` covers it with no override.
- **Upgrade plan inverts**: Slime fill, Deep Moss label (`--btn-primary-*`).
- **Neutral buttons** (Reconnect, Disconnect, Connect, Cancel plan) stay `--surface-sunken` (#2f3133) on the raised card. `Button kind="neutral"` reads `--surface-sunken`; no override.
- **Metric numbers** ("1,046", "2,318", "12", "21") are raw **`white`** (#ffffff) in Dark, while the metric labels and every other text bind `text/primary` (#f1f1f1). Treat as a stray raw value and use `--text-strong`; flag in the PR.
- Nothing else differs: same strings, same geometry, same states.

---

## Backend: what each drawn control and figure stands on

### Integrations

| Drawn | Backend today | What it takes |
|---|---|---|
| Figma card status + provenance ("Connected by … on …") | **Exists.** `stores.designImport.connectionInfo` → Edge Function `integration-status` (`supabase/functions/integration-status/index.ts`), admin-only, reads `integration_connections` with the `users(email)` embed. Returns `{provider, enabled, connected, connectedByEmail, connectedAt, expiresAt}` (`src/lib/types.ts:513–523`). | Nothing. |
| Figma **Reconnect** / **Connect** | **Exists.** Opens `FigmaConnectForm` (PAT) inline; `stores.designImport.connect(companyId, {kind:"pat"})` → `figma-connect`, which validates the token against Figma `/v1/me` before storing (`supabase/functions/figma-connect/index.ts:84–88`). The function also accepts an OAuth code (`kind: "oauth-code"`, `:66`), but no UI uses it. | Nothing for PAT. The token form itself is not drawn (Open question 1). |
| Figma **Disconnect** | **Exists.** `figma-connect` with `action: "disconnect"` (`figma-connect/index.ts:36–44`), via `stores.designImport.disconnect` (`src/lib/stores/supabase/figmaImporter.ts:142–151`). | Nothing. |
| Canva card status | **Exists**, same `integration-status` row. `enabled` follows the server flag `canvaEnabled()` (`CANVA_ENABLED` or `CANVA_AUTOBUILD_ENABLED` = "true" plus `CANVA_CLIENT_ID`, `supabase/functions/_shared/canva.ts:23–26`). | Nothing. |
| Canva **Connect** | **Exists.** `canvaConnectStart` → `canva-auth` `action: "start"` returns a PKCE authorize URL; the browser leaves for Canva; the return is completed in `App.tsx:58–89` (`canva-auth` `action: "callback"`). | Nothing. Note the return lands on `/`, not back on Settings (see Behaviour 9). |
| Canva **Disconnect** (would appear when connected) | **Exists.** `canva-auth` `action: "disconnect"`. | Nothing. |
| Other integrations | **None drawn, none in code.** `IntegrationConnectionInfo.provider` is `"figma" \| "canva"`. `brand-from-website` exists but is not a connection. | n/a |

On the local backend `designImport.isConfigured()` is false and `connectionInfo()` returns `[]` (`src/lib/stores/local/localStores.ts:703, 727–729`); the section shows `DevBackendNotice` instead of cards.

### Plan & usage

| Drawn | Backend today | What it takes |
|---|---|---|
| Plan name "Crew plan" | **None.** No plan, tier, subscription or billing table, function or column anywhere in `supabase/migrations` or `supabase/functions`. Today's card says "Free, no limits enforced" (`UsageSection.tsx:95–99`), a placeholder by design (PLAN.md, "the Plan card is a placeholder by design"). | A billing provider (e.g. Stripe), a per-company plan/subscription record (migration), a webhook Edge Function to keep it current, and a plan catalog. |
| Price + "Renews Oct 14, 2026" | **None.** | Same subscription record (amount, currency, interval, `current_period_end`, cancel-at-period-end). |
| **Cancel plan** | **None.** | Billing provider portal or a cancel endpoint, plus a confirmation (undrawn). |
| **Upgrade plan** | **None.** | Checkout session Edge Function and a return route; a plan picker (undrawn). |
| "Admin seats 3 of 4" | **Count derivable, limit absent.** Roles are `member_role` enum `admin \| member` on memberships (`supabase/migrations/0001_schema.sql:27–32`); the People store lists them, so "3" can be counted. No seat limit exists and `invite-member` enforces none. | A seat limit per plan, and enforcement in `invite-member` and role changes. |
| "Brands 2 of 3" | **No concept.** A workspace has exactly one active brand kit (`brand_kits_one_active` unique index, `0001_schema.sql:67`). There is no multi-brand model; the nearest count is workspaces (companies) a user belongs to. | Product decision on what a "brand" is (Open question 4), then a limit per plan. |
| "Members Unlimited" | **No limit concept.** Member count derivable from memberships. | A plan field; "Unlimited" is copy for "no cap". |
| Month card title "September 2026" | **Exists client-side.** `monthName` from `toLocaleDateString(…, {month:"long", year:"numeric", timeZone})` (`UsageSection.tsx:25–29`). | Nothing. |
| Exports / Opens / Templates used / Members active | **Exist.** `stores.usage.getMonthlyUsage` reads `usage_events` since `monthStartIso(timeZone)` (`src/lib/stores/supabase/usageStore.ts:170–195`) and reduces with `summarizeMonthlyUsage` (`src/lib/stores/monthlyUsage.ts:20–58`): Exports = `download` events, Opens = `open` events, Templates used = distinct template ids, Members active = distinct signed-in user ids. Works on both backends (local reads its own events). | Nothing. `bulkExports` is computed but shown nowhere, in code or frame. |
| "286 via public links" | **Exists**: `publicOpens` (`open` events with `actor = "public"`). Today shown only when > 0 (`UsageSection.tsx:67–71`). | Nothing. |
| AI usage: Requests / Tokens in / Tokens out | **Exists on Supabase only.** `stores.usage.getAiUsage` → RPC `ai_usage_summary(p_company, p_since)` (migration `0040_template_chat.sql:138–148`, over `ai_usage_events`), admin-readable; since `exactMonthStartIso(tz)`. The local backend returns `null` and the card is hidden (`localStores.ts:327`, `UsageSection.tsx:114`). | Nothing. |

The only billing hook in the schema is the `public_links_enabled(company_id)` seam (`0026_public_links.sql:186–195`), which returns true for every company and is commented as the place a past-due clause goes.

---

## Primitives used / not yet primitives

| Frame part | Master component (by look) | Repo today |
|---|---|---|
| Settings card (all five) | Settings card 58:460 | `SettingsCard` primitive (`Containers.tsx:33`, `.ui-settings-card`: padding 24, gap 20, Elevation/Small). Plan, month and AI usage cards match exactly. **Integration cards use gap 12** (header to provenance), so they need a modifier. Today all five use the legacy `settingsShared.tsx` `SettingsCard` (`sp-card sp-card--content`, `sp-panel-title`, 12 gap via `space-y-3`, optional muted `description`). |
| Integration card header (title + status pill left, buttons right) | none | `SettingsCard`'s header is `h2` plus one `action` slot, space-between. The title cluster (title + `Status`, gap 10) needs the `title` prop to accept a node, which it does (`React.ReactNode`). The two-button group (gap 8) fits `action` as a fragment wrapper. |
| Connected / Not connected | Status 52:51 | `Status tone="positive"` / `tone="neutral"` (`Chips.tsx:218`), exact in both themes. Today a coloured `sp-eyebrow` text, no pill (`IntegrationsSection.tsx:125–132`). |
| Reconnect, Disconnect, Connect, Cancel plan | Button 43:123, neutral, Default | `Button kind="neutral" size="default"`. Today `sp-btn sp-btn-ghost`; Disconnect tinted `--state-danger`. |
| Upgrade plan | Button 43:123, primary, Default | `Button kind="primary" size="default"`. No code today. |
| Provenance line, price line, "via public links" | none (text) | Plain `.t-caption-m` in `--text-secondary`. |
| Plan header (title over price line) | none | Not a `SettingsCard` slot. `Card` (58:476) has a `subtitle` (`.t-caption-m`, gap 4) but its padding is 24/28 and gap 16. Either give `SettingsCard` an optional subtitle or pass a composed `title` node. |
| Plan stats, AI usage stats | Stat 59:449 | `Stat` primitive (`Containers.tsx:56`), exact (`.t-label-xs` secondary over `.t-body-s`, gap 4). Needs a row wrapper: three equal columns, gap 24. Not a primitive. |
| Month metrics | Metric 59:452 | `Metric` primitive (`Containers.tsx:66`), exact apart from the label's −0.01em tracking. **No slot for the "286 via public links" line**; add an optional `sub` or compose it. Row wrapper (four equal columns, gap 16) is not a primitive. Today `admin/Kpi.tsx`: one `sp-card` tile per figure with a 38×38 icon chip, a 24px **mono** number that counts up, an `sp-eyebrow` label under it. `Kpi` is used only by `UsageSection` (4 call sites), so it can be deleted after this phase. |
| Figma token form (undrawn) | Input (md, 40) + Button primary md | `Input`/`Field` primitives with the Field error line. Today `sp-input` (password, mono) + `sp-btn sp-btn-primary` + a hand-styled error `<p>` (`FigmaConnectForm.tsx:38–64`). |
| Disconnect confirmation (undrawn) | Modal 58:484 | `Modal` primitive exists. Today `ConfirmDialog` (`src/app/components/ConfirmDialog.tsx`, Radix AlertDialog, danger variant). |
| Error banner, loading, error state (undrawn) | none | Today a hand-styled `--danger-wash` `<p role="alert">`, `SkeletonLines`, `SkeletonKpi`, `ErrorState`. |

---

## Behaviour differences vs code

Paths are relative to `src/app/components/admin/settings/` unless given in full.

Integrations (`IntegrationsSection.tsx`, `FigmaConnectForm.tsx`):

1. **Status becomes a pill.** "Connected" / "Not connected" move from a coloured `sp-eyebrow` under the title (`IntegrationsSection.tsx:125–132`, `--state-primary` / `--text-muted`) to a `Status` pill beside the title on the same row.
2. **Card layout.** One header row (title + pill left, buttons right, items centred, 36 tall), then the provenance line 12 below. Today the status and provenance stack in a column beside top-aligned buttons (`:120–181`, `items-start`, button gap 4 via `--space-3xs`; frame gap 8).
3. **Provider title** is `.t-title-panel` inside the card header (today `sp-panel-title` in the legacy `SettingsCard`, `settingsShared.tsx:35`).
4. **Disconnect is neutral.** Today `sp-btn-ghost` with `color: var(--state-danger)` (`:170–179`). The frame draws it the same grey as Reconnect.
5. **Buttons** are 36-tall neutral fills (today ghost `sp-btn`, `:156`, `:160–168`, `:171–174`).
6. **Footer caption removed**: "Tokens are stored server-side and are never shown here. You see the status and who connected, nothing more." (`:196–199`).
7. **Provenance copy** is unchanged for the drawn case ("Connected by {email} on {date}", `:141–144`). The frame does not show the fallback "Connected before we started recording who" or Canva's " · token refreshes; current one lapses {date}" (`:143`, `:145–147`).
8. **Card spacing**: cards 24 apart (today `space-y-6` = 24, `:82`). Same.
9. **Canva Connect leaves the app** for Canva's consent page (`:64–79`, `window.location.assign`) and returns to `/?canva_oauth=1`, where `App.tsx:58–89` completes the exchange and shows a notice ("Canva connected. Open Auto-build to use it.") on whatever screen `/` resolves to, not on Settings → Integrations. Unchanged by the frames, but nothing drawn shows the return.

Plan & usage (`UsageSection.tsx`, `../Kpi.tsx`):

10. **Card order** becomes Plan, month, AI usage. Today month KPIs first, AI usage, then Plan last (`:33–99`).
11. **Month figures move into one card titled with the month** ("September 2026"). Today four separate `Kpi` tiles in a 2/4-column grid (`:55–87`) under a caption line "{Month Year}, in the workspace timezone. The full history lives on Insights." (`:52–54`), which the frame removes.
12. **Metric look**: label above the number (today below), `.t-label-l` label and 40px `.t-title-metric` number in `--text-strong`. Today a 24px **mono** number in `--text-primary`, `sp-eyebrow` label, and an icon chip in `--viz-series-1`, `--viz-series-2` or `--bg-hover` (`Kpi.tsx:31–47`, `UsageSection.tsx:56–86`). **Icons and chips are dropped.**
13. **Count-up animation** (`useCountUp`, `Kpi.tsx:28`) is not drawn. Numbers are formatted with thousands separators ("1,046"); today's count-up shows the raw integer.
14. **"via public links"** line: `.t-caption-m` `--text-secondary`, 12 under the number (today `--type-caption-size` `--text-muted`, margin 2, `Kpi.tsx:53–62`).
15. **AI usage becomes three Stats** ("Requests", "Tokens in", "Tokens out"). Today one sentence from `aiUsageLine`: "{n} requests · {x} tokens in · {y} out, this month" (`monthlyUsage.ts:114–117`, `UsageSection.tsx:131–134`). The ", this month" suffix and the pluralised "request(s)" go.
16. **Plan card is no longer a placeholder.** Today: title "Plan", one line "Free, no limits enforced" (`:95–99`). The frame: plan name as the title, a price and renewal line, Cancel plan and Upgrade plan, and three Stats (Admin seats, Brands, Members). **None of this has a backend** (see the Backend table). PLAN.md calls the Plan card "a placeholder by design", so the build needs a ruling (Open question 2).
17. **AI usage visibility**: today rendered only when `role === "admin"` (`:91`) and hidden when the store returns `null` (local backend, `:114`). The whole section is already admin-only (`settingsSections.ts:14`), so the role check is redundant. The frame always shows the card.

## Interactions the frames drop

Each is today's behaviour and is absent from the frames. CJ decides each.

Integrations:

1. **The Figma token form**: Connect/Reconnect toggles an inline form under the card with a helper paragraph ("Paste a personal access token (Figma → Settings → Security → Personal access tokens, file-read scope). It is stored server-side for the whole workspace and never reaches a browser again."), a masked mono input with placeholder "figd_…", a primary "Connect" button ("Connecting…" while busy, disabled while empty), Enter to submit, and an inline error ("Could not connect to Figma." or the server's message) (`FigmaConnectForm.tsx:31–66`; `IntegrationsSection.tsx:160–168, 182–189`).
2. **The disconnect confirmation**: "Disconnect {Figma|Canva}?" / "Imports and auto-build from it stop working for everyone until someone reconnects. The stored token is deleted immediately." / "Disconnect" (`IntegrationsSection.tsx:83–90`).
3. **Busy state**: every button disables while a connect, disconnect or Canva start is in flight (`:34`, `:156`, `:164`, `:173`).
4. **Error banner** above the cards ("Disconnect failed.", "Could not start the Canva connection.", or the server message) (`:92–101`).
5. **Loading** (`SkeletonLines`, "Loading integrations", `:103–104`) and **load error** (`ErrorState` "We couldn't load your integrations." / "Check your connection and try again." with Retry, `:105–110`).
6. **"Not enabled on this server."** in place of status and buttons when `enabled` is false (Canva without its server flag, `:114–117`).
7. **Local-backend notice**: "Integrations need the Supabase backend. This dev backend has no Edge Functions to hold a token." (`:42–49`).
8. **Figma not connected** and **Canva connected** states (the frame shows only the opposite pair), including Canva's token-expiry clause.
9. **The Canva return notice** and the cancelled case ("Canva connection was cancelled.") (`App.tsx:75–88`).
10. **The footer caption** about tokens never being shown (`:196–199`).

Plan & usage:

11. **Loading** (four `SkeletonKpi`s, "Loading usage", `UsageSection.tsx:33–43`) and **load error** ("We couldn't load this month's usage.", `:44–49`); AI usage's own skeleton line and error ("We couldn't load AI usage.", `:117–129`).
12. **Empty month**: every figure 0 (start of a month, new workspace). Not drawn; today renders zeros.
13. **The conditional "via public links" line** (only when > 0, `:67–71`). The frame shows it filled.
14. **The month caption** pointing to Insights for history (`:52–54`).
15. **The count-up** on the numbers (`Kpi.tsx:28`).
16. **AI usage hidden on the local backend** (`:114`). A drawn card with no data source there.
17. **Responsive grid** (2 columns below `lg`, 4 above, `:35`, `:55`). Frames are desktop only.
18. **Cancel plan and Upgrade plan flows** (confirmation, checkout, plan picker, success, failure, past-due, cancelled-but-active) are not drawn and do not exist.

## Open questions

1. **Figma token entry**: the frames draw Reconnect and Connect but not what they open. Keep today's inline PAT form under the card (on `Input` md + `Button` primary md, with the Field error line), move it into a `Modal`, or switch Figma to OAuth (`figma-connect` already accepts `kind: "oauth-code"`)? If the form stays, its helper paragraph conflicts with RULES §9 (no helper text); drop it, or keep a single "How to get a token" link?
2. **Plan card scope**: build it as drawn with no backend, or keep it a placeholder this phase? PLAN.md says plan management lands in Settings but "the Plan card is a placeholder by design". Options: (a) render the drawn layout with honest values for this workspace ("Free plan", no price line, Admin seats as a bare count, Members "Unlimited") and hide Cancel/Upgrade; (b) draw Cancel/Upgrade disabled; (c) start billing work (provider, subscription table, webhook, checkout and portal functions, limits and their enforcement) as its own feature.
3. **What does "Admin seats 3 of 4" count against**? There is no seat limit. Show "3" alone, or define a limit per plan?
4. **What is a "Brand" in "Brands 2 of 3"**? A workspace has one active brand kit. Is a brand a workspace (the switcher's list), a future multi-kit per workspace, or something else? Until decided, the stat has no source.
5. **Disconnect colour**: neutral as drawn, or keep a red signal for a destructive action? RULES §7 keeps error red functional; the confirmation dialog would still carry the red. Same question for **Cancel plan**.
6. **Disconnect confirmation**: keep today's `ConfirmDialog` (move to the `Modal` primitive with a `destructive` confirm)? Copy unchanged?
7. **Canva return**: should the OAuth return land on Settings → Integrations with the status updated (and a toast), rather than `/` with a banner? It would change the registered redirect URL (`/?canva_oauth=1`), which must match Canva's app config.
8. **Canva disabled on the server**: hide the Canva card, show it with a neutral "Not available" pill and no buttons, or keep today's "Not enabled on this server." line?
9. **Local backend**: Integrations has no data there. Keep the `DevBackendNotice` (restyled), or render both cards as "Not connected" with disabled buttons? AI usage: hide the card (today) or show zeros?
10. **Footer caption** about tokens: drop as drawn?
11. **Count-up and icon chips**: drop both as drawn? (Drawn numbers are static with separators.)
12. **Empty month**: show zeros, or a single line such as "No activity yet this month" (proposed copy)? Same for AI usage with no requests.
13. **"via public links" when zero**: keep hidden (today) or show "0 via public links"? Hidden keeps the four columns even.
14. **Exports vs bulk exports**: `bulkExports` is counted but never shown. Add it to Exports, show it as a sub line under Exports, or leave it out (as drawn)?
15. **Month caption** ("…The full history lives on Insights."): dropped by the frame and by RULES §9. Is a link to Insights wanted anywhere in this section?
16. **Metric label tracking**: 15 Medium without tracking has no exact class; use `.t-label-l` (−0.01em) as the `Metric` primitive does?
17. **Dark metric numbers** are raw white in the file; confirm `--text-strong` (#f1f1f1) and ask for the file to bind them.
18. **Integration card gap 12** vs the Settings card primitive's 20: add a compact modifier to `SettingsCard`, or ask for 20 in Figma?
19. **More integrations**: only Figma and Canva are drawn and exist. Are other connectors (LinkedIn posting, after the new look per PLAN) expected to appear here later, and should the section's layout plan for a list?


---

# Part C: Sharing, Account and Advanced

Source: Figma "Master UX-UI" (`mEJRslarcQDkgPeY6AObi5`), page "Settings" (8:678), read on 2026-10-05, read only. All frames 1440×1053. The sidebar (`sp-nav`, x 0–335) and the shared Settings frame (`sp-page · Settings`, its `PageHeader`, the `sp-settings-rail` and the footer links) are described in the shared part of this spec; this part covers each frame's section column only and notes where a frame departs from the shared frame.

| Frame | Light | Dark | Screenshot (Light, 1440) |
|---|---|---|---|
| Settings · Sharing | 13:15384 | 13:16806 | `settings-sharing.png` |
| Settings · Account | 13:15649 | 13:17071 | `settings-account.png` |
| Settings · Advanced | 13:15837 | 13:17259 | `settings-advanced.png` |

Section nodes: Sharing 13:15511 / 13:16933, Account 13:15776 / 13:17198, Advanced 13:15964 / 13:17386 (Dark ids are Light + 1422 throughout).

Read this first:

- **No Master instances in any of the six frames.** Every part is a plain frame (`sp-settings-card · …`, `sp-chat-btn · …`, `sp-button · …`, `sp-switch · on/off`, `Status · Active`, `sp-row-menu-trigger`, `sp-select · …`, `sp-input · …`, `Appearance switch`). The mappings to primitives below are by look and measurement. Several layer names are legacy (`sp-chat-btn` on what is the Button primitive); go by the fills.
- Light text is raw `#0b0b0c` (= `--text-strong`). Dark binds the same text to the variable `text/primary`, which renders #f1f1f1 there, i.e. Dark `--text-strong`. Use `--text-strong` throughout (as in Phase 6); `--text-primary` (#272727) stays for data marks.
- Every card is the same recipe: column, padding 24, radius 20 (`--radius-card`), `--surface-raised`, **Elevation/Small** (`--elevation-small`), header row (title left, optional action right, space-between, items centred). Title is 17 Medium −0.17px → `.t-title-panel`, `--text-strong`. **No card has a description line**: every helper sentence under a card title in today's code is gone. That is the `SettingsCard` primitive (`primitives/Containers.tsx:33`, Figma 58:460) with its `action` prop, not today's `settingsShared.tsx` `SettingsCard` (`settingsShared.tsx:23–51`, which renders `sp-card` + `sp-panel-title` + a caption description).
- Cards in a section are 24 apart (`--space-md`), as today (`space-y-6`).
- Section column: x 232 in the Settings body (rail 200 + 32 gap), 783 wide. Card content is 735 wide.

Type key (from `src/styles/tokens.css`): t-title-panel 500 17/1.25 −0.01em · t-label-m 500 14/1.25 · t-label-xs 500 12/1.25 · t-label-xxs 500 10/1.25 (trimmed) · t-body-s 400 14/1.4 · t-button-m 500 14/1.25 −0.01em · t-button-s 500 12/1.3 −0.01em (trimmed) · t-control-s 500 13/1.3 −0.01em.

Colour key (Light / Dark): `--surface-raised` white / #171819 · `--surface-sunken` #ececec / #2f3133 · `--control-fill` #ececec / #171819 · `--control-track` #f1f1ef / #0b0b0c · `--control-thumb` white / #2f3133 · `--input-bg` #f1f1ef / white 8% · `--switch-track-on` ink / #f1f1f1 · `--switch-background` ink 16% / white 30% · `--status-active-bg/-fg` Slime + Deep Moss / #2f3133 + Slime · `--btn-primary-bg/-fg` Deep Moss + Slime / Slime + Deep Moss · `--state-error` #d43535 / #ec5656 under `--text-inverse` · `--text-secondary` #636363 / #a0a0a0 · `--border-default` ink 8% / white 8% (drawn), token 10% in Dark.

---

## Deviations from the shared Settings frame

- Rail selection: `rail item · Sharing (selected)` 13:15493, `rail item · Account (selected)` 13:15764, `rail item · Advanced (selected)` 13:15957. All seven rail items are drawn in all three frames, i.e. **an admin's view**. No frame shows a member's rail (Account alone, or Workspace + Account).
- `Settings body` height follows the section: Sharing 698, Account 564, Advanced 345. Nothing else in the shell differs; PageHeader, rail and footer are identical.

---

## 1. Settings · Sharing (13:15384)

`Section · Sharing` (13:15511): column, gap 24, three cards.

### `sp-settings-card · Public links` (13:15512), 783 × 376

- Column, padding 24, **gap 16** (off the `SettingsCard` 20, as drawn).
- `header` (13:15513): row, space-between, items centred, 21 tall.
  - Title **"Public links"** (`.t-title-panel`).
  - `filter` (13:15515): row, gap 8, items centred. Label **"Show revoked and expired"**: 12 Medium / **1.4**, `--text-secondary`, nowrap (no exact class; `.t-label-xs` is 12/1.25). Then `sp-switch · off` 36×20 = **Switch** (`primitives/Toggles.tsx:20`) unchecked. As today, the label names the switch.
  - **No description line.** Today's "Every link across every template. “Manage” opens the template's own dialog for full editing." is absent.
- `table` (13:15519): column, full width (735), no gap.
  - `table header` (13:15520): row, gap 16, items centred, **padding-bottom 10**. Labels 12 Medium / 1.4, `--text-secondary`, sentence case:
    - **"Link"** flex 1; **"Opens"** 80; **"Last used"** 96; **"Expires"** 96; an empty 177 spacer over the actions.
    - Not mono, not uppercase (today `sp-eyebrow`, `SharingSection.tsx:272`).
  - Dividers: 1px full width, Light `rgba(11,11,12,.08)` / Dark `rgba(255,255,255,.08)` → `--border-default`. One under the header and one between rows; **none after the last row**.
  - Link row (e.g. `link · Recruiting partners` 13:15527): row, gap 16, items centred, **padding y 14**, 65 tall.
    - `link` column (flex 1, gap 2):
      - `name` row (gap 8, items centred): link name **Label/M** (`.t-label-m`), `--text-strong`, nowrap; then `Status · Active`: pill radius 999, padding 5 / 8, 17 tall, label **"Active"** 10 Medium trimmed. Light Slime fill with Deep Moss label; Dark `#2f3133` fill with Slime label. That is **`Status tone="active" size="sm"`** exactly (`primitives/Chips.tsx:218`, `--status-active-*`, `.t-label-xxs`).
      - meta line: 12 Medium / 1.4, `--text-secondary`. Reads as the **template name** (see Open question 2).
    - Opens (80), Last used (96), Expires (96): Body/S (`.t-body-s`), `--text-strong`. **Not mono, not muted** (today mono caption-size, `--text-secondary`/`--text-muted`, `:302–341`).
    - `actions` (gap 8, items centred, 177 wide):
      - `sp-chat-btn · Copy`: h 28, padding x 10, gap 6, radius 7, `--surface-sunken`, copy icon 14 (lucide `copy`), **"Copy"** 12 Medium −0.12px trimmed. = **`Button kind="neutral" size="sm" icon={Copy}`**.
      - `sp-chat-btn · Revoke`: same, no icon, **"Revoke"**. = **`Button kind="neutral" size="sm"`**. **Not red.**
      - `sp-row-menu-trigger`: 32×32, radius 7, ellipsis 16, no fill, drawn at rest. = **RowMenuTrigger** (44:29) / the `RowMenu` primitive (`primitives/Menu.tsx:216`). **The menu itself is not drawn.**
  - Sample rows (sample data; strings exact):

    | Name | Meta | Opens | Last used | Expires |
    |---|---|---|---|---|
    | Recruiting partners | Now hiring | 37 | Sep 30, 2026 | Never |
    | Career fair | Now hiring | 112 of 200 | Sep 29, 2026 | Oct 15, 2026 |
    | Speaker confirmations | I’m speaking · AI Marketing Summit | 64 | Sep 28, 2026 | Never |
    | Newsletter readers | Webinar invite | 73 | Sep 27, 2026 | Oct 31, 2026 |

    "112 of 200" and "Never" are today's formats (`:320, 330, 340`); dates match `shortDate` in en-US.
  - All four rows are Active. **No revoked, expired or "Open limit reached" row is drawn**, so the neutral `Status` and the row without Revoke are not drawn either.

### `sp-settings-card · Emergency` (13:15622), 84 tall

- Header-only card: title **"Emergency"** left; right `sp-chat-btn · Revoke all 4 active links`: h 36, padding x 16, radius 7, `--surface-sunken`, **"Revoke all 4 active links"** 14 Medium −0.14px, `--text-strong`. = **`Button kind="neutral" size="default"`** in the `SettingsCard` `action` slot. **Neutral, not destructive.** (Its fill is `--surface-sunken` in both themes, not `--control-fill`: the button sits on the card, so `neutral`, not `neutralOnPage`.)
- **No description.** Today's "For an incident: sever everything public in one action." is absent.
- The count in the label is live data ("4" = the four active rows); the label shape is today's (`:393`).

### `sp-settings-card · Defaults for new links` (13:15627), 783 × 190

- Column, padding 24, gap 20 (= `SettingsCard`). Title **"Defaults for new links"**. **No description** (today "What the create form starts with. Each link can still be set individually.").
- `row · Allow photo uploads` (13:15630): row, gap 16, items centred, 20 tall. **"Allow photo uploads"** Body/S (`.t-body-s`), `--text-strong`, flex 1; `sp-switch · on` 36×20 = **Switch** checked. Same row look as Account's notification rows.
- `fields` (13:15635): row, **gap 16**, two equal columns (359.5).
  - `Field · Expires after (days)`: column, gap 6. Label **"Expires after (days)"** Label/XS (`.t-label-xs`), `--text-secondary`. `sp-input`: h 40, padding x 12, radius 9, `--input-bg`, placeholder **"Never"** Body/S `--text-secondary`. = **`Field` + `Input`** (Field.tsx; 48:38 / 48:37, default 40).
  - `Field · Open limit`: same, label **"Open limit"**, placeholder **"No limit"**.
  - Today the grid gap is 12 (`--space-xs`, `:456`) and the labels are `sp-eyebrow` (`:461, 482`).

---

## 2. Settings · Account (13:15649)

`Section · Account` (13:15776): column, gap 24, three cards and a button.

### `sp-settings-card · Profile` (13:15777), 783 × 187

- Column, padding 24, gap 20. Title **"Profile"**. No description (today has none either).
- `grid` (13:15780): column, **gap 20**; two `row`s, each row gap 16, two equal columns (359.5).
- Each cell is `stat · …`: column, gap 4, label **Label/XS** `--text-secondary`, value **Body/S** `--text-strong`. = **`Stat`** (`primitives/Containers.tsx:56`, Figma 59:449; `.ui-stat` gap 4).
  1. **"Display name"**: value **"CJ Munafo"** (sample) followed, gap 6, by `icon · edit` 14 (lucide `pencil`), drawn **visible at rest**, `--text-secondary`-ish grey. The editing state is not drawn.
  2. **"Email"**: **"cj@acmehealth.com"** (sample).
  3. **"Role"**: **"Admin"** (capitalised; sample of the viewer's role).
  4. **"Workspace"**: **"Acme Health"** (sample).
- **No "Backend" row.** Today's fourth line "Backend: Supabase (live) / Local dev (browser storage)" (`AccountSection.tsx:56–59`) is absent.
- Order is Display name, Email / Role, Workspace in a 2×2 grid. Today: a 140px label column with Email, Role, Workspace, Backend, then the Display name `InlineEdit` below (`:42–61`).

### `sp-settings-card · Appearance` (13:15799), 88 tall

- Header-only card: title **"Appearance"** left, `Appearance switch` right.
- `Appearance switch` (13:15802): **300 wide**, padding 4, gap 4, radius 9, Light `#f1f1ef` / Dark `--surface-page` #0b0b0c → **`--control-track`**. Three segments, each **flex 1** (94.67), h 32, radius 7:
  - **"System"** (selected): thumb Light white / Dark #2f3133 → `--control-thumb`, shadow 0 1 3 black 8% → `--elevation-thumb`, label `--text-strong`.
  - **"Light"**, **"Dark"**: no fill, `--text-secondary`.
  - Labels 13 Medium −0.13px / 1.25 (`.t-control-s` is 13/1.3; same face and tracking).
  - = **`SegmentedControl`** (`primitives/Toggles.tsx:97`, Figma 49:51) in the `SettingsCard` action slot. The primitive's segments hug their labels (`padding: 0 14px`); the frame stretches them to a fixed 300 track. Needs a width on the control and `flex: 1` on the segments, scoped to this card.
- **No icons** (today Monitor/Sun/Moon), **no tooltips** ("Follow the OS preference" etc., `:14–18`), **no description** ("Applies to the SocialPaint chrome only. Template graphics and exports are identical in both modes.", `:66`).
- "System" selected in both Light and Dark frames (sample state).

### `sp-settings-card · Notifications` (13:15809), 783 × 181

- Column, padding 24, gap 20. Title **"Notifications"**. **No description** (today "Preferences only for now. Email delivery isn't set up yet, so nothing sends either way. What you choose here is honored the day it is.", `:88`).
- `rows`: column, **gap 16**. Each row: row, gap 16, items centred, 20 tall; title Body/S (`.t-body-s`) `--text-strong`, flex 1; `sp-switch · on` 36×20.
  1. **"Invited members accepted"**
  2. **"Weekly usage digest"**
  3. **"Public link expiring soon"**
- All three **on**. **No per-row descriptions** (today "When someone you invited joins the workspace.", "A summary of opens and exports, once a week.", "Before a link you created stops working.", `:141–157`). Today's `ControlRow` (`settingsShared.tsx:56–78`) renders title 14/500 plus a caption; the frame's title is **Regular** 14 (Body/S), not Medium.

### `sp-chat-btn · Sign out` (13:15828)

- On the page under the cards, left aligned, 24 below Notifications. h 36, padding x 16, gap 6, radius 7; icon 16 (lucide `log-out`) then **"Sign out"** 14 Medium −0.14px. Fill Light `--surface-sunken` #ececec / Dark `--surface-raised` #171819 → `--control-fill`. = **`Button kind="neutralOnPage" size="default" icon={LogOut}`**, which is **already what the code renders** (`AccountSection.tsx:102–106`).

### What a member sees

Account is the one section every member reaches (`settingsSections.ts:16, 31–38`); a member who can switch workspaces also gets Workspace. The frames draw only the admin. In today's code a member gets the same Account section with no role branch: Profile shows Role "member" (CSS-capitalised to "Member"), the same Appearance and the same three notification switches, including "Invited members accepted", though only admins can invite (see Open question 9). Sign out shows for every role when auth is on.

---

## 3. Settings · Advanced (13:15837)

`Section · Advanced` (13:15964): column, gap 24, three cards.

### `sp-settings-card · Export workspace data` (13:15965), 84 tall

- Header-only card: title **"Export workspace data"**; action `sp-button · Export as JSON`: h **36**, padding x 16, gap 6, radius **7**, `--btn-primary-bg` (Deep Moss / Slime), icon 16 (lucide `download`) then **"Export as JSON"** 14 Medium −0.14px in `--btn-primary-fg`. = **`Button kind="primary" size="default" icon={Download}`**.
- **No description.** Today's "One JSON file: templates with their fields, the brand kit with type styles and guidelines, the member list with roles, and usage events. Backgrounds, fonts, and logos are referenced by their storage paths. The binary files are not in the export." (`AdvancedSection.tsx:75`) is absent.

### `sp-settings-card · Transfer ownership` (13:15974), 783 × 129

- Column, padding 24, gap 20. Title **"Transfer ownership"**. **No description** (today "Make someone else the admin and step down to member yourself. They are promoted before you are demoted, so the workspace is never without an admin.", `:121`).
- `transfer row` (13:15977): row, **gap 8**, items centred.
  - `sp-select · Transfer ownership to`: flex 1 (640), h **40**, padding x 12, gap 2, radius 9, `--input-bg`; placeholder **"Choose a member…"** (with the ellipsis character) Body/S `--text-secondary`; chevron-down 16. = **`Select size="lg"`** (`primitives/Select.tsx`, 40 tall, `--input-bg`, gap 2 as drawn 49:16). The open list is not drawn.
  - `sp-button · Transfer (disabled)`: h **40**, padding x 18, radius **9**, `--btn-primary-bg`, **"Transfer"**, **opacity 0.40**. = **`Button kind="primary" size="md" disabled`**: primary at 40%, the Button rule (unlike Phase 6's Import, which was drawn neutral at 40%).
- Disabled because nothing is chosen, as today (`:159`).

### `sp-settings-card · Delete workspace` (13:15984), 84 tall

- Header-only card: title **"Delete workspace"**; action `sp-chat-btn · Delete this workspace`: h 36, padding x 16, radius 7, `--state-error` fill, **"Delete this workspace"** 14 Medium −0.14px in `--text-inverse`. = **`Button kind="destructive" size="default"`**.
- **No description** ("Permanently removes everything this workspace ever made. There is no recovery.", `:216`).

---

## Dark differences (beyond token flips)

Token flips apply (`--surface-page`, `--surface-raised`, `--surface-sunken`, `--text-strong`, `--text-secondary`, `--input-bg`, bevels, shadow). Beyond flips:

- **Raised cards gain the `--border-raised` hairline** (0.65 top / 0.25 sides / 0.55 bottom). Every card in all three sections. The elevation composite carries it; no extra rule.
- **Status · Active** turns from a Slime pill with a Deep Moss label into a `#2f3133` pill with a Slime label. That is `--status-active-bg/-fg`; `Status tone="active"` already does it.
- **Appearance switch** track is `#0b0b0c` (Light `#f1f1ef`) and the selected thumb `#2f3133` (Light white). Both are `--control-track` / `--control-thumb`; no override.
- **Switch on** inverts: light track, dark knob (`--switch-track-on`, knob `--surface-raised`). Switch off is white 30%.
- **Sign out** fill is `--surface-raised` in Dark (`--control-fill`), so `neutralOnPage` covers it. The table's Copy and Revoke and the Emergency button stay `--surface-sunken` (`neutral`).
- **Primary buttons invert** (Export as JSON, Transfer): Slime fill, Deep Moss label. Disabled Transfer is Slime at 40%.
- **Delete this workspace** is `#ec5656` with an ink label (`--state-error` under `--text-inverse`).
- **Table dividers** white 8% (`--border-default` Dark is 10%; use the token).
- Nothing else differs: same strings, same geometry, same states.

---

## Backend for each drawn control

| Control | Backend today | What it would take |
|---|---|---|
| Show revoked and expired | Client filter over `publicLinks.listAll` (`SharingSection.tsx:52–58`) | None |
| Link rows (name, template, status, opens, last used, expires) | `publicLinks.listAll` → `template-links` Edge Function; every field exists on `CompanyTemplateLink` (`types.ts:462–508`) | None |
| **Copy** (per row) | **None, by design.** Tokens are minted server side and stored hashed (`supabase/functions/template-links/index.ts:5, 223, 292`); the address is visible once, at create or regenerate (`interfaces.ts:86–96`, `TemplateLinksDialog.tsx:30–36`). Phase 4 kept "shown once" (PHASE-4.md:187) and its rows have no Copy (PHASE-4-SCREENS.md:366). | Either store a reversible encrypted token (a migration, a key in Edge secrets, a `reveal` action in `template-links` that audits each read), which undoes a deliberate security choice; or make Copy mean "new address, then copy" (regenerate under a confirm, which kills the old address); or drop Copy. CJ decides (Open question 1). |
| Revoke (per row) | `publicLinks.revoke` → `template-links` (`:111–113`), confirmed by `ConfirmDialog` | None |
| Row menu | Nothing drawn inside. Today's other row actions exist: Manage (opens `TemplateLinksDialog`, `:77–86, 159–167`) and New address (`publicLinks.regenerate`, `:116–132`) | None if the menu holds Manage and New address |
| Revoke all N active links | Client loop of `publicLinks.revoke`, one call per link for the audit trail (`:147–157`), behind `TypedConfirmDialog` | None |
| Allow photo uploads, Expires after (days), Open limit | `companies.update(…, { linkDefaults })` → `companies.link_default_*` columns (`companyStore.ts:46–48`); saved on toggle / blur (`:416–425, 474, 495`) | None |
| Display name (pencil) | `account.getDisplayName/setDisplayName` → `users.name` (`accountStore.ts:21, 30`) | None |
| Email, Role, Workspace | Read only from `useAuth` | None. Changing email or password is not drawn and has no UI today (Supabase Auth `updateUser` would support it) |
| Appearance System / Light / Dark | `useColorScheme().setScheme`, **per browser** in `localStorage` (`colorScheme.tsx:7, 61`), not per account | None for the drawn control. A per-account preference would need a `users` column |
| Notification switches | `account.get/setNotificationPrefs` → `user_notification_prefs` (migration `0028_settings_admin.sql:88–104`) | **Storage only. Nothing sends**: no Edge Function delivers an invite-accepted email, a weekly digest or an expiry warning. Delivery is product work (a mail provider, a scheduled function, templates) |
| Sign out | `useAuth().signOut` (absent on the dev backend) | None |
| Export as JSON | Client side: five store reads then `buildWorkspaceExport` and a Blob download (`AdvancedSection.tsx:38–70`) | None |
| Transfer ownership select + Transfer | `people.list` then two `people.setRole` calls, promote first (`:98–116`, `peopleStore.ts:36–43`), behind `ConfirmDialog tone="primary"` | None |
| Delete this workspace | `companies.delete` → `delete-company` Edge Function (`companyStore.ts:64–67`), behind `TypedConfirmDialog` with live counts | None |

---

## Primitives used / not yet primitives

| Frame part | Master component (by look) | Repo today |
|---|---|---|
| Every card | Settings card 58:460 | `SettingsCard` primitive (`Containers.tsx:33`) with `action`. Today all three sections use the legacy `settingsShared.tsx` `SettingsCard` (description prop, `sp-card`, `sp-panel-title`). Public links builds its own `sp-card overflow-hidden` (`SharingSection.tsx:207`) and draws gap 16, not 20. |
| Show revoked and expired, notification switches, Allow photo uploads | Switch 49:45 | `Switch` primitive (`Toggles.tsx:20`). Today the legacy `../../Switch` (`SharingSection.tsx:11`, `AccountSection.tsx:10`). |
| Switch rows (title + switch) | none (row) | Not a primitive. Today `ControlRow` (`settingsShared.tsx:56`) with inline 14/500 and a caption; the frame's title is `.t-body-s` with no caption. |
| Links table | none | Not a primitive. Today a `<table>` with `minWidth: 760` and horizontal scroll (`:256–378`); the frame is a 735 flex grid (flex 1 / 80 / 96 / 96 / 177, gap 16). |
| Status · Active | Status 52:51, Small | `Status tone="active" size="sm"`. Today a coloured `sp-eyebrow` in its own column (`:295–300`). `TemplateLinksDialog.tsx:501` already uses `Status`. |
| Copy, Revoke | Button 43:123, Neutral Small | `Button kind="neutral" size="sm"` (Copy with `icon={Copy}`). Today `sp-btn sp-btn-ghost` "Manage", "New address" and a red "Revoke" (`:347–370`). |
| Row menu trigger and menu | Row menu trigger 44:29, Menu 57:423 | `RowMenu` primitive (`Menu.tsx:216`); contents undrawn. |
| Revoke all N active links | Button Neutral Default | `Button kind="neutral"`. Today a red-filled `sp-btn` (`:387–394`). |
| Expires after (days), Open limit | Field 48:38 + Input 48:37 | `Field` + `Input` (`Field.tsx`). Today `sp-eyebrow` labels and `sp-input` number inputs. `Input` must pass `type="number"`, `min`, `inputMode` through (it spreads rest props). |
| Profile cells | Stat 59:449 | `Stat`. The Display name cell needs an editable value: today `InlineEdit` (`../../InlineEdit`, legacy `.sp-inline-edit`, pencil fades in on hover). Not a primitive; the frame draws the pencil at rest. |
| Appearance switch | Segmented control 49:51 | `SegmentedControl` (`Toggles.tsx:97`) with a fixed 300 width and stretched segments (scoped override). Today `sp-choice-tile` buttons with icons (`AccountSection.tsx:68–83`). |
| Sign out | Button Neutral on page, Default, icon | Already `Button kind="neutralOnPage" icon={LogOut}`. |
| Export as JSON | Button Primary Default, icon | `Button kind="primary" size="default" icon={Download}`. Today `sp-btn sp-btn-primary` with a 14 icon (`AdvancedSection.tsx:77–80`). |
| Transfer select | Select, Large (40) | `Select size="lg"` (`Select.tsx`). Today a native `<select class="sp-input">` (`:144–156`). |
| Transfer | Button Primary Medium | `Button kind="primary" size="md"`. Today `sp-btn sp-btn-primary`. |
| Delete this workspace | Button Destructive Default | `Button kind="destructive"`. Today a red inline-styled `sp-btn` (`:249–256`). |
| Confirm dialogs (undrawn) | Modal 58:484 | `Modal` primitive exists (`Containers.tsx:90`). Today `ConfirmDialog` (legacy `sp-btn`) and `TypedConfirmDialog` (`settingsShared.tsx:84–185`, hand-rolled overlay, `sp-input`, `--type-cardtitle-size`). Neither is drawn here. |
| Error banner (undrawn) | none | Today a `--danger-wash` paragraph per section (`SharingSection.tsx:169–178`, `AccountSection.tsx:30–39`, `AdvancedSection.tsx:17–26`). |
| Dev backend notice (undrawn) | none | `DevBackendNotice` (`settingsShared.tsx:6–20`, legacy `--bg-hover`). |

---

## Behaviour differences vs code

Paths are relative to `src/app/components/admin/settings/` unless given in full.

Sharing (`SharingSection.tsx`):

1. **Card descriptions removed** on Public links (`:211–220`), Emergency (`:385`) and Defaults (`:435`).
2. **Table reshaped.** Today eight columns: Template, Link, Status, Created, Last used, Opens, Expires, actions (`:260–268`). The frame has five: **Link** (link name with the Status pill, template name below), **Opens**, **Last used**, **Expires**, actions. **Created is dropped**, **Template becomes the meta line**, **Status becomes a pill** beside the name. Column order changes (Opens before Last used).
3. Header labels sentence case 12 Medium `--text-secondary` (today `sp-eyebrow` with an inline weight 400, `:272–273`). Values `.t-body-s` `--text-strong` (today mono caption, secondary or muted, `:302–341`). The link name is `.t-label-m` (today Template is 500 `--text-primary` and Link name `--text-secondary`, `:285–293`).
4. **New per-row Copy button.** Today there is no per-row copy; the address appears once in the `freshUrl` card after New address (`:180–205`). See the Backend table: a stored address does not exist.
5. **Revoke is neutral** (today ghost with `--state-danger` text, `:362–369`). Still hidden on revoked rows? Not drawn (all rows are Active).
6. **Manage and New address leave the row.** Only Copy, Revoke and the ellipsis show. The ellipsis menu is undrawn; Manage and New address presumably move into it.
7. **Emergency button is neutral** (today filled `--state-danger`, `:387–394`). Label text unchanged.
8. Defaults: field labels `.t-label-xs` via `Field` (today `sp-eyebrow`), field gap 16 (today 12), Switch row title `.t-body-s` (today 14/500 via `ControlRow`).
9. Card geometry: padding 24 all round on Public links (today header `px-4 pt-4 pb-3` and cells `px-4 py-3`, 16 inset, `:208, 286`); rows `py 14` with one divider between rows and none at the bottom; the table fits 735 with no horizontal scroll (today `minWidth: 760`, `overflow-x-auto`, `:256–257`).

Account (`AccountSection.tsx`):

10. **Profile becomes a 2×2 `Stat` grid** with Display name first and its pencil at rest (today a 140px label column, Display name as a separate `InlineEdit` row below, `:42–61`; the pencil fades in on hover, `InlineEdit.tsx:33–34`).
11. **Backend row removed** (`:56–59`).
12. Role value "Admin" sentence-cased by data, not CSS `capitalize` (`:51`); same visible result.
13. **Appearance becomes a segmented control in the card header**, no icons, no tooltips, no description (today three icon tiles in a grid below the title, `:64–84`).
14. **Notifications: card description and per-row descriptions removed** (`:88, 141–157`); row titles Regular, not Medium (`settingsShared.tsx:68`); row gap 16 (today 12, `space-y-3`, `:196`).
15. Sign out: unchanged (`:102–106`).

Advanced (`AdvancedSection.tsx`):

16. **All three descriptions removed** (`:75, 121, 216`).
17. **Export and Delete move into the card header** as the `SettingsCard` action (today below the description).
18. Export is Primary **Default** (36, radius 7) with a 16 icon (today `sp-btn-primary`, 14 icon).
19. Transfer: native select becomes `Select size="lg"`; select-to-button gap 8 (today 8, same). Option text today is "email (role)" (`:153`); the open list is undrawn.
20. Delete becomes `Button kind="destructive"` (today inline-styled red with `--bg-surface` text).

## Interactions the frames drop

Each is today's behaviour and absent from the frames. CJ decides each.

Sharing:

1. **Loading** skeleton rows "Loading links" (`:238–239`).
2. **Load error** with retry: "We couldn't load your links." / "Check your connection and try again." (`:240–245`).
3. **Empty states**: "Nothing is publicly reachable. Links are created from a template's Share dialog." and "No active links. Toggle the filter to see revoked and expired ones." (`:246–254`).
4. **Inactive rows**: "Revoked {date}", "Expired {date}", "Open limit reached" labels (`:20–29`), the neutral Status, and the hidden Revoke on revoked rows (`:361`). The switch is drawn off, so none show.
5. **Revoke confirm**: "Revoke “{name}”?" / "Anyone who opens it from here on gets a page saying the link no longer works. Immediate, and not undoable. You'd create a new link instead." / "Revoke link" (`:101–115`).
6. **New address confirm** and its result card: "Regenerate “{name}”?" / "You'll get a new address to share, and the old one stops working straight away." / "Regenerate", then "Your link is ready. Copy it here or later from Insights" with a read-only field and "Copy link" / "Copied" (`:116–132, 180–205`).
7. **Manage** opens `TemplateLinksDialog` for that template, and reloads on close; "That template no longer exists." if it was deleted (`:77–86, 159–167`).
8. **Revoke all, typed confirm**: "Revoke every active link?", the count sentence ("This is the incident-response button. It cannot be undone, only re-shared link by link."), "Type {workspace} to confirm", "Revoke {N} links", "Working…" (`:133–158`, `settingsShared.tsx:84–185`).
9. **Emergency card hides when nothing is active** (`:382`).
10. **Busy disabling** of every row action while a call runs (`:349, 356, 364, 389`).
11. **The section error banner** "That didn't work. Try again." (`:60–69, 169–178`) and the Defaults card's own error line "Could not save the defaults." (`:423, 437–444`).
12. **Dev backend**: "Public links need the Supabase backend. This dev backend has no way to issue or check one." with only the Defaults card (`:88–97`).
13. **Defaults input rules**: number inputs, min 1, save on blur, blank or non-positive saves as Never / No limit (`:427–430, 465–496`).
14. **Copied feedback** for 1.6 s (`:71–75`); a per-row Copy would need its own.

Account:

15. **Display name editing**: input with save and cancel, Enter / Escape, blur saves, lime flash, "Add a name" placeholder when empty, 80 characters, disabled while loading (`:111–139`, `InlineEdit.tsx`). Only the resting pencil is drawn.
16. **Email fallback** "None (dev backend)" and Workspace "—" (`:48, 55`).
17. **Notification loading** skeleton "Loading preferences", **error** "We couldn't load your preferences." with "Try again" (`:172–184`), **switches disabled while saving** (`:205`), save error "Could not save that preference." (`:192`).
18. **Dev backend** notice for notifications: "Notification preferences need the Supabase backend with auth enabled. This dev backend has no account to store them on." (`:93–96`); Display name hidden there (`:61`).
19. **Sign out hidden** when the auth provider has none (`:102`).
20. **Off switches**: all drawn on; the off look appears only in Sharing's filter.

Advanced:

21. **Export busy label** "Assembling…" and the error "Export failed." (`:66, 79`).
22. **Transfer confirm**: "Hand admin to {email}?" / "They become an admin and you become a member. Only they (or another admin) can give admin back to you afterwards." / "Transfer" (`:123–131`); busy "Transferring…" (`:162`); error "Transfer failed." (`:112`). After a transfer the viewer becomes a member and loses this section.
23. **Nobody to transfer to**: "There is nobody to transfer to because you are the only member. Invite someone on the People page first." (`:137–141`).
24. **Dev backend** notice for transfer: "Transferring ownership needs the Supabase backend with auth enabled. This dev backend has no real accounts." (`:132–136`).
25. **Delete, typed confirm** with live counts: "Delete {workspace}?", "This destroys, permanently and immediately:", templates / memberships / brand assets / public links counts, "the brand kit and all usage history", "You will be signed out when it completes.", "Type {workspace} to confirm", "Delete workspace" (`:218–248`); error "Deletion failed." (`:208`); sign out or refresh after (`:203–206`).
26. **Section error banner** (`:17–26`).

## Open questions

1. **Per-row Copy on Sharing.** The frame draws Copy on every link, but addresses are stored hashed and shown once (a deliberate choice, `TemplateLinksDialog.tsx:30–36`, kept in Phase 4). Options: (a) drop Copy; (b) Copy = "New address and copy" behind the regenerate confirm, which kills the old address; (c) store a reversible encrypted token with an audited `reveal` action in `template-links`, which reverses the security decision. Which?
2. **Row meta line.** It reads as the template name ("Now hiring") under the link's own name ("Recruiting partners"). Confirm: link name primary, template name secondary (today Template is the first and strongest column)?
3. **Row menu contents**: undrawn. Manage (opens the template's link dialog) and New address? Anything else (Rename)? Does Revoke also appear there?
4. **Revoke, single and all, neutral as drawn?** `RULES.md` §7 keeps error red as a functional signal and today both are red. Keep the confirms (single `ConfirmDialog`, typed confirm for all) on the new `Modal`?
5. **Created column**: dropped as drawn, or keep it? (The template link dialog still shows Created.)
6. **Inactive rows**: labels "Revoked Sep 2, 2026" etc. inside the Status pill (`tone="neutral"`) as `TemplateLinksDialog` does, with Copy and Revoke hidden?
7. **Empty, loading and error states** for the table (undrawn). Keep today's copy? "Links are created from a template's Share dialog" names a "Share dialog" that is now "Public links".
8. **Display name editing state**: undrawn. `InlineEdit` restyled, or the `Input` primitive at Small (32) in the Stat value slot? Pencil always visible as drawn?
9. **Member view of Account**: should a member see "Invited members accepted", which only fires for people who invite (admins)? Hide it for members, or keep the same three switches?
10. **Notifications send nothing.** The frame drops the sentence that said so. Ship the switches silent with no explanation, or hide the card until delivery exists?
11. **Appearance is per browser** (`localStorage`). The Settings card implies an account preference. Keep per browser, or store it on the user?
12. **Backend row**: dropped as drawn. It is a dev aid; keep it only when `backend === "local"`?
13. **Dev backend notices** (Sharing, Notifications, Transfer): undrawn. Keep them restyled (they only show on the local backend), or hide the cards?
14. **Typed confirm dialogs**: neither is drawn. Rebuild `TypedConfirmDialog` on `Modal` + `Field` + `Button kind="destructive"`, with today's copy?
15. **Header filter and table header type**: 12 Medium / 1.4 has no class (same as Phase 6 Q18). Use `.t-label-xs` (1.25)?
16. **Public links card gap 16** vs the `SettingsCard` 20: keep as drawn (an override) or align to 20?
17. **Appearance switch width**: fixed 300 with equal segments, as drawn, or the primitive's hugging segments?
18. **Transfer option text**: today "email (role)". The frame shows only the placeholder. Use the display name with the email, or keep?
