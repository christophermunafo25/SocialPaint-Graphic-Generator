# New look, Phase 9: cleanup and QA

You are a senior engineer on SocialPaint (this repository). This is the new look's last phase. It removes what the area phases left behind:

- the legacy bridge;
- the old control classes, except the Template Builder's, which are fenced for its own phase (§9 D10);
- dead tokens, classes, files and packages;
- the table and columns earlier phases stopped reading.

It then locks the result with lint rules against literal colours and type, and runs a full screenshot, contrast and keyboard pass across every route.

**It runs after Phase 8b** (the sign-in gate, `PHASE-8B.md`), which moves the gate and the pre-app shell onto the primitives. Anything 8b leaves is in scope here. The gate itself is not.

**The phase has no screens of its own.** Bulk fill, the current onboarding wizard and the Template Builder list (`AdminTemplates.tsx`) have no frames (`PHASE-9-INVENTORY.md` A1). §9 D1 moves their controls onto the primitives without redesigning them. The Template Builder is waiting for its own design (D10).

Be exact. Work through the steps in §5 in order, run the checks each step names, and commit after each step with `npm run verify` green (`npm run verify && git commit`). Check `git branch --show-current` before every commit. If something here turns out to be wrong once you are in the code, stop and explain the conflict instead of improvising.

**A note on familiar interactions.** CJ keeps interactions people already use. Moving a control onto a primitive changes how it looks, never what it does. If a primitive can't do something the old control did (a keyboard shortcut, a tooltip, a disabled reason, a search field in a menu), stop and ask.

---

## 1. Read these first

1. `PLAN.md` (decision 1, Scope and the Phase 9 row), `RULES.md`, `BRIDGE.md` and `README.md`.
2. `PHASE-9-INVENTORY.md` in full. Re-run its counts at the start (Phase 8b and `main` move them) and note the drift in the PR.
3. The earlier deferrals:
   - PHASE-1 §8: rewrite the stylesheet header.
   - PHASE-3 §9 D6: `company_canvas_presets`.
   - PHASE-6 §8 and §9 D3: the logo plates, and `heading_font` / `body_font`.
4. The primitives and `/dev/ui`, especially `Button`, `IconButton`, `Input`, `Field`, `Select`, `CompactSelect`, `SearchField`, `SegmentedControl`, `Chip`, `Modal` and `Tooltip`.
5. The code:
   - `src/styles/*`, `scripts/build-tokens.mjs` (the bridge check), `eslint.config.js`, `package.json` and `src/lib/stores/local/db.ts`.
   - The files in the inventory's B3 table.

## 2. What changes

| Part | Today | After this phase |
|---|---|---|
| Bridge | `legacy-bridge.css` maps 15 old names, and `BRIDGE.md` documents them | Every reader reads the Figma token. Both files go, along with the bridge check in `build-tokens.mjs`. |
| Old controls | `.sp-btn`, `.sp-icon-btn`, `.sp-input`, `.sp-seg` and `.sp-chip` | Bulk fill, the onboarding wizard, AdminTemplates and the shared pieces move onto the primitives (D1). The builder's uses stay, fenced in one marked block for its own phase (D10). |
| Shared pieces on framed screens | ErrorState's Retry, ErrorBoundary's reload, ImageSourceChooser's buttons, ColorControl's input, ImageCropper's buttons, ui/Select's default trigger and menu search field, ConfirmDialog, the old Tooltip | On the primitives (D1, D5) |
| Page-scoped legacy tokens | `--edge-*`, `--gen-*`, `--start-*`, `--gate-*`, legacy `--chip-*`, `--sb-*` and `--plate-*`, at theme level | Mapped to Figma tokens. What has no twin goes into Figma first. Layout constants become component-scoped. (D4) |
| Lit edge | The legacy cards and the colour popover draw `--edge-*` bevels | `--elevation-small` everywhere (D5) |
| Dead code | 54 custom properties, 33 classes, `FieldInput.tsx`, `globals.css`, `default_shadcn_theme.css`, the moveable rules, theme.css's unread aliases | Deleted |
| Packages | 40 runtime packages never imported, plus 4 used only by `ui/alert-dialog` | Removed (D7) |
| Data | `company_canvas_presets` (0 rows); `brand_kits.heading_font` / `body_font` (unread since 0042) | Dropped in their own migrations (D6) |
| Guard rails | `tokens:check` | Lint against literal colours and type, primitive token names in components, and Tailwind's text-size and colour utilities (D3) |
| Docs | The stylesheet header describes the July system | The header is rewritten; ARCHITECTURE, README, RULES and PLAN describe the finished system |

## 3. Invariants

- **Every route, role and behaviour stays as it is.** A control that moves takes the primitive's look and nothing else. Layouts don't change.
- **Framed screens move only where a shared piece moves.** Brand Templates, the fill page, the template chat, Generate, Brand Studio, Settings, Insights and the gate change only where they render one of D1's shared pieces or D5's tooltip and edge. Each change is named in the PR, and everything else on those screens compares at 0%.
- **Tenant content is not chrome.** A value computed from a template or a brand kit keeps flowing inline: the renderer, the canvas editor's text, Brand Studio's type previews, colour pickers' values. The lint tells the two apart by value, not by file (D3).
- **Multi-tenant (PLAN decision 6).**
- **PLAN decision 1:** no token is invented in code. A colour, radius, shadow or spacing with no Figma twin goes into Figma and comes back through the export (D4).
- **No data loss beyond D6**, and no column is dropped without the prod check D6 names.
- **Billing (Phase 7b) stays on hold.** Don't touch its code.
- **The Create account redesign (Figma 257:2) is out of this program.** The current onboarding wizard keeps its flow.

## 4. Before you change anything

1. **Extend the screenshot run (D9):**
   - every route at 1440, 1024 and 390 in both themes;
   - plus the states: loading, empty and error on each page that has them, every menu and every dialog open;
   - the Template Builder editor on a fixture template, the build picker, the size gallery, bulk fill, the onboarding wizard's steps, AdminTemplates, the public link page and its unavailable state.

   Fixture-seeded and clock-pinned, as Phase 8 did. Commit it on its own.
2. **Baseline:** run `npm run shots -- capture .shots/before` and `npm run shots -- props .shots/props-before.json`.
3. **The contrast script (D9):** computes every text and icon pair from the tokens in both themes. Run it on the baseline and keep the report.
4. **The Figma requests (D4):** list every colour, radius, shadow or spacing value the cleanup needs that has no Figma token. Send the list to CJ before Step 5. Those values wait for the export; nothing is invented.

## 5. Steps

### Step 1: the prompt, the screenshot run and the contrast script
- Commits:
  1. "New look phase 9: the phase prompt and inventory"
  2. "New look phase 9: screenshot coverage"
  3. "New look phase 9: the contrast script"

### Step 2: dead code
- Delete the dead custom properties and classes (inventory B4):
  - the moveable rules;
  - `FieldInput.tsx`, which has no importers (delete it, don't move it);
  - `globals.css` and `default_shadcn_theme.css`;
  - theme.css's unread aliases (`--chart-*` and the `--viz-series-*` they read, `--sidebar-*`, `--card-foreground`);
  - `--shadow-rail` and the four `--card-go-*` names.
- Gate: props-compare lists only the deleted names, and every screenshot is at 0%.
- Commit: "New look phase 9: dead code".

### Step 3: the shared pieces (D1, D5)
- Move these onto the primitives:
  - ErrorState's Retry and ErrorBoundary's reload onto `Button`;
  - ConfirmDialog onto `Modal`, and ImageSourceChooser's buttons onto `Button` (the template chat's Details panel and attach menu render them);
  - ColorControl's input onto `Input` (Brand Studio › Colors);
  - ImageCropper's buttons onto `Button`;
  - ui/Select's default trigger and menu search field onto `Select` / `CompactSelect` and `SearchField`. Its three helpers fold into `primitives/Select`.
- The primitive `Tooltip` replaces the old one in Sidebar and AttachMenu. Check that it covers `placement`, `gap` and `suppressed`; stop if it doesn't.
- Delete `src/app/components/ui/`.
- Commit: "New look phase 9: shared pieces on the primitives".

### Step 4: the unframed surfaces (D1, D2)
- One commit per surface:
  1. bulk fill;
  2. the onboarding wizard (inside the pre-app shell as 8b left it);
  3. AdminTemplates.
- Each moves its controls onto the primitives, its chrome type onto `.t-*` classes and its colours onto tokens. Tailwind stays for layout only.
- Commits: "New look phase 9: {surface} on the primitives".

### Step 5: the bridge, the legacy names and the lit edge (D4, D5)
- **The bridge:** every reader of a bridged name reads its Figma token. Delete `legacy-bridge.css`, `BRIDGE.md` and the bridge check.
- **The legacy names:**
  - The page-scoped groups and BRIDGE §3's names map to Figma tokens.
  - Values waiting on Figma (§4.4) come in through `npm run tokens` once CJ exports them.
  - Layout constants (widths, offsets) become custom properties scoped to their component's selector.
- **The lit edge:** legacy cards take `--elevation-small`, the colour popover's frozen recipe included, and the `--edge-*` system goes.
- **The builder's fence (D10):**
  - The builder's old classes (`.sp-btn`, `.sp-icon-btn`, `.sp-input`, `.sp-seg`, `.sp-chip` as the builder uses them, and what they read) move into **one marked block** of `socialpaint.css`, headed "Template Builder legacy, removed by the builder's phase".
  - That block reads Figma tokens only.
  - Nothing outside `src/app/components/builder/` may use those classes.
- Gate: props-compare shows only removed legacy names (no Figma token changes value), and screenshots change only where D5 says.
- Commit: "New look phase 9: the bridge goes".

### Step 6: packages (D7)
- Remove the 40 never-imported runtime packages, and the 4 that only `ui/alert-dialog` used (`@radix-ui/react-alert-dialog`, `clsx`, `tailwind-merge`, `tw-animate-css`).
- Then confirm with a clean install (`rm -rf node_modules && npm ci`), `npm run build`, and the tests. Note the bundle before and after.
- Commit: "New look phase 9: unused packages".

### Step 7: `company_canvas_presets` (D6)
- Migration `0045_drop_company_canvas_presets.sql` drops the table and its two policies.
- Remove `supabase/verify/30_settings.sql`'s preset checks, and add a check that the table is gone.
- Drop the local store's mirror (`companyCanvasPresets` in `db.ts`) with a local upgrade.
- Clean up the comments in `interfaces.ts`, `companyStore.ts` and `platforms.ts`.
- Commit: "New look phase 9: drop company_canvas_presets".

### Step 8: `brand_kits.heading_font` and `body_font` (D6)
- **First, confirm on prod** that no function, view, policy, trigger or deployed Edge Function reads either column, and that the data lives elsewhere.
  - Every kit carries roles on its type styles.
  - The draft checked this on 2026-10-08 (§9 D6). Check again, since prod moves, and quote the result in the PR.
- **The client stops writing and reading them:**
  - `brandStore`, `rows.ts`, `kitPlumbing` and onboarding all stop. Onboarding keeps seeding roles from the faces it picks through `migrateFontRoles`, but stores only the styles.
  - The `BrandKit` type loses both fields.
  - `withFontRoles` stops reading them.
  - The local store runs one last font-role pass in its upgrade, then drops the faces.
- **public-template** stops sending the two keys. `_shared/publicTemplate.ts:258–259` hard-codes `heading_font: null` and `body_font: null` in the brand kit it returns, and the function is redeployed after the merge.
- Migration `0046_drop_brand_kit_font_refs.sql` drops both columns, with a verify check.
- Commit: "New look phase 9: drop the font refs".

### Step 9: guard rails (D3)
- Add the ESLint rules and the CSS check, both as errors.
- The only path exemptions are `platformIcons.tsx`, `tokens.css`, tests, and the builder's folder (D10). Fix everything else they find.
- Commit: "New look phase 9: lint rules".

### Step 10: docs (D8)
- Rewrite the `socialpaint.css` header for what the file is now. It stays one file.
- ARCHITECTURE: a Styles section covering tokens, primitives, per-page stylesheets, the builder's fence, the lint rules, and the dropped table and columns.
- README and RULES: no bridge. RULES §3's "never read a legacy name" is now enforced.
- PLAN: Phase 9 done, and the Template Builder's open items.
- Commit: "New look phase 9: docs".

### Step 11: the gate
1. `npm run verify`, a clean install, and `npm run build`.
2. `capture .shots/after`, `compare`, `props-compare` (three widths, both themes, every state from §4.1).
   - Expected changes: the surfaces in Steps 3 and 4, and D5's edge and tooltip.
   - Every other shot is at 0%.
   - props-compare lists only removed legacy and dead names, and the new Figma tokens from §4.4.
3. **Contrast (D9):** every text and icon pair in both themes. 4.5:1 for text, 3:1 for large text, icons and control edges. Compare with the baseline report: nothing gets worse, and every failure in scope is fixed.
4. **Keyboard (D9):** every route in both themes, the builder included. A visible focus on every control, and dialogs and menus return focus.
5. **Click-through of each moved surface:**
   - a bulk fill run;
   - onboarding on the local backend;
   - AdminTemplates (create, rename, delete);
   - the template chat's Details panel and attach menu (ImageSourceChooser);
   - Brand Studio Colors (ColorControl);
   - the cropper;
   - an ErrorState Retry.
6. **The PR:** "New look, Phase 9: cleanup and QA". It carries both migrations and their deploy steps, the D6 prod check, the compare table, the contrast and keyboard reports, the bundle before and after, the Figma token requests, every decision as built, and surprises.

## 6. Out of scope

- The Template Builder's controls (D10) and its design.
- The sign-in gate (Phase 8b).
- The Create account redesign (Figma 257:2: Light only, new questions, an invite step).
- Removing Tailwind (D2).
- Splitting `socialpaint.css` (D8).
- Billing (Phase 7b, on hold).

## 7. Expected changes

- **Visible:**
  - bulk fill, the onboarding wizard and AdminTemplates (controls only);
  - the shared pieces on framed screens (Step 3);
  - legacy cards and the colour popover losing the lit edge (D5);
  - the narrow layout's top bar and drawer where `--sb-*` maps to Figma tokens.
- **Data:** migrations 0045 and 0046, with verify checks.
- **Packages:** 44 fewer.
- **Copy:** none new. If a primitive needs a word (a Modal title), the PR lists it as proposed.

## 8. Rulings on what the file leaves open

| Item | Ruling |
|---|---|
| Unframed surfaces | Their controls take the primitives' Figma components (inventory A2), and their layout stays as it is. |
| Values with no Figma token | Requested in Figma (§4.4) and exported; never written in code (PLAN decision 1). |
| Logo plates | `--plate-light` / `--plate-dark` go on the §4.4 list. |
| 12 / 1.4 and other off-scale text on moved surfaces | `.t-label-xs` and the nearest existing classes, as earlier phases ruled. Each is named in the PR. |

## 9. Decisions (CJ, 2026-10-08)

0. **The gate goes first, as Phase 8b.** PLAN's Scope was out of date: Master UX-UI now draws "Sign in and sign up" (194:2) in Light and Dark. Phase 8b builds it and keeps the pre-app shell's onboarding layout working (`PHASE-8B.md`). The Create account page (257:2) redesigns onboarding, in Light only, with new questions and an invite step, so it stays out of this program.
1. **D1. A: move the unframed surfaces' controls onto the primitives, layouts unchanged.** This covers:
   - bulk fill, the current onboarding wizard, and AdminTemplates (`AdminTemplates.tsx`, which the screen map didn't cover);
   - the shared pieces that framed screens still render with the old classes: ErrorState's Retry, ErrorBoundary's reload, ImageSourceChooser's buttons (the template chat's Details panel and attach menu), ColorControl's input (Brand Studio Colors), ImageCropper's buttons, and ui/Select's default trigger and menu search field.

   `FieldInput.tsx` has no importers, so delete it rather than move it. The Template Builder follows D10.
2. **D2. Agreed.** Chrome type and colours on the moved surfaces take `.t-*` classes and tokens, and Tailwind stays for layout. Sizes computed from a tenant's template or brand stay inline, since they're content. D3 tells the two apart.
3. **D3. The lint, as errors:**
   - **Banned in style props, JSX colour attributes and stylesheets outside `tokens.css`:** literal colours, and literal font sizes, weights and tracking.
   - **Also banned:** primitive token names in components (`--ink-*`, `--slime`, `--paper-*` and the rest), and Tailwind's text-size and colour utilities.
   - **Values computed from a template or a brand kit pass.** That lets the renderer, the canvas editor's text and Brand Studio's type previews through without exempting whole files. (The canvas overlay editor also draws chrome labels at a literal 9 px, which a file exemption would hide.)
   - **Path exemptions are only** the platform icons (third-party marks), `tokens.css` and tests, plus the builder's folder while D10's fence stands.
4. **D4. Colours, radii, shadows and spacing map to the Figma token that plays the role.** Any of those still needed without a Figma twin goes into Figma first and comes back through the export (PLAN decision 1). Layout constants a component needs, such as widths and offsets, can stay as custom properties scoped to that component's selector.
5. **D5. Both go everywhere.** The primitive Tooltip replaces the old one. Legacy cards take `--elevation-small`, whose Dark bevel replaces the lit edge, the colour popover's frozen recipe included.
6. **D6. The drops:**
   - `company_canvas_presets` goes in its own migration and commit, with its mirror removed from the local store (`db.ts`) by a local upgrade in the same step. Nothing references it beyond its own two policies (prod, 2026-10-08).
   - Before dropping any column, confirm on prod that no function, view, policy or Edge Function reads it, and that its data lives somewhere else.
   - The draft's check on 2026-10-08 found no function, view, policy or trigger reading `heading_font` or `body_font`, and no deployed Edge Function either. All 17 were fetched; every `brand_kits` query names its columns, and only public-template mentions the two, as null literals in its response. All 7 kits carry roles on their type styles, while all 7 still hold the old values.
7. **D7. Remove every runtime package nothing imports.** That's 40: MUI and Emotion, `@popperjs/core`, 20 Radix packages, `class-variance-authority`, `cmdk`, `embla-carousel-react`, `input-otp`, `next-themes`, `react-day-picker`, `react-dnd` and its backend, `react-hook-form`, `react-popper`, `react-resizable-panels`, `react-responsive-masonry`, `react-slick`, `sonner` and `vaul`. The inventory's "42" miscounted the Radix packages. The 4 that only `ui/alert-dialog` uses go with it. Confirm with a clean install, the build and the tests.
8. **D8. One file**, as PLAN decided.
9. **D9. Every route in both themes at 1440, 1024 and 390,** since the narrow layout has no frames and this phase deletes its `--sb-*` tokens.
   - Include the loading, empty and error states, and every menu and dialog open.
   - Compute contrast for every text and icon pair from the tokens in both themes.
   - Run the keyboard pass on every route, the builder included.
10. **D10. A builder design is coming, so the builder takes C.**
    - Its old classes stay, fenced in one marked block of `socialpaint.css`.
    - The lint exempts its folder.
    - The builder's phase removes both.
