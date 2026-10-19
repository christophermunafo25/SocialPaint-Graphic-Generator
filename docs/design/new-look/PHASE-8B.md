# New look, Phase 8b: the sign-in gate and onboarding

You are a senior engineer on SocialPaint (this repository). This phase rebuilds the way in, in Light, from two Master UX-UI pages:

- **"Sign in and sign up" (194:2):** sign in and sign up with their error states, check your email, reset password, reset link sent and new password. It replaces the solo light card of 2026-09-18.
- **"Create account" (257:2):** onboarding as nine steps, About you to Workspace ready, with a no-website branch and an invite step. It replaces the four-step wizard (Company, Brand colors, Fonts, Logo).

Both use one layout: the form column beside the `sp-auth-panel` art. The phase runs **before Phase 9** (CJ, 2026-10-08).

Be exact. Work through the steps in §5 in order, run the checks each step names, and commit after each step with `npm run verify` green (`npm run verify && git commit`). Check `git branch --show-current` before every commit. If something here turns out to be wrong once you are in the code, stop and explain the conflict instead of improvising.

**A note on familiar interactions.** CJ keeps interactions people already use. These stay, drawn or not:
- Enter submits the step's action, and switching gate views keeps the typed email.
- The recovery link opens New password.
- Invite and magic-link arrivals land as they do today.
- Onboarding:
  - it creates the workspace with its creator as admin (`create_company_with_admin`);
  - it pulls the brand from a website (`brand-from-website`);
  - it seeds the six brand-matched starter templates (`seedStarterTemplates`), and never fails the flow when seeding fails.
- The in-app "Create company" path still works.

If you find another one, stop and ask.

---

## 1. Read these first

1. `PLAN.md` (decisions 1 and 6, Scope, the 8b row and the screen map), `RULES.md`, `BRIDGE.md`.
2. `PHASE-8B-SCREENS.md` (the gate) and `PHASE-8B-ONBOARDING-SCREENS.md` (onboarding), both in full, and the references `reference/auth-*.png` and `reference/onboarding-*.png`.
3. The code:
   - `auth/AuthPage.tsx`, `onboarding/OnboardingWizard.tsx` (1,265 lines), `PreAppShell.tsx`, `App.tsx` (where the gate and onboarding render);
   - `src/lib/brand/brandFromWebsite.ts` and `brandPrefill.ts`, `src/lib/templates/starters/*`, `src/lib/brand/fontRoles.ts`;
   - the people store's invite path (`peopleStore.ts` and the `invite-member` function);
   - the `sp-gate*` rules and `--gate-*` tokens in `socialpaint.css`.
4. The primitives: `Field`, `Input`, `Select`, `CompactSelect`, `Upload`, `Button`, `Status`, `Avatar`, `Card`, `Progress`, the composer pieces, the popover colour editor (PR #75), and the sidebar's Logo.

## 2. What changes

| Part | Today | After this phase |
|---|---|---|
| Gate layout | A solo light card over the orbit art | The form column (logo, centred form, footer links) beside `sp-auth-panel`, Light (D1) |
| Gate fields and buttons | `.sp-input-lg`, `.sp-btn-lg`, `.sp-gate__link` | `Field` + `Input` (40), `Button` primary Large (44) full width, text links in Label/M |
| Gate errors | One alert above the button, raw Supabase text | Under their field, in our words (D3, D4) |
| Reset sent | A notice in place | Its own screen |
| Legal | None | Footer links on every screen and the consent line on sign up, pointing at placeholders (D2) |
| Onboarding steps | Company, Brand colors, Fonts, Logo | 01 About you, 02 Set up for, 03 Your team, 04 First up, 05 Website (or 05b Add your brand), 06 Pulling your brand, 07 Your brand, 08 Invite your team, 09 Workspace ready |
| Onboarding layout | Solo, wide (1220), over the orbit art | The same layout as the gate. The form column is 480 wide with a 6-segment progress bar. The panel shows a Workspace preview that fills in as answers arrive. |
| Onboarding answers | Company name, website, colours, fonts, logo | Also name, role, who it's for, how they heard, team size, who makes graphics, what to make first, where they post (D11) |
| Invites | Settings › People after onboarding | Also step 08 (D17) |

## 3. Invariants

- **Gate behaviour:**
  - the same Supabase calls;
  - the recovery redirect;
  - the shared email between views;
  - Enter submitting;
  - autocomplete hints (`email`, `current-password`, `new-password`, `organization`, `url`).
- **Onboarding's guarantees:**
  - the workspace, its admin, the brand kit (born with font roles), the logo and font assets, and the website, saved as today;
  - starter seeding never fails the flow;
  - an abandoned flow never leaves a half-made workspace (D12).
- **Multi-tenant (PLAN decision 6).** The frames' Acme Health, CJ Munafo, the swatches and the template names are samples.
  - The six cards on 09 are the workspace's own seeded starters.
  - The composer's prompt and the preview's skeletons are illustrations.
- **Light only (D1).** The gate and onboarding force `data-theme="light"` on their root, as the gate does today. The stored preference is untouched, and the app takes the user's theme once they're in.
- **Tokens, primitives and `.t-*` classes only.** Unbound colours in the frames map to tokens (§8).
- **The panel is decorative:** `aria-hidden`, inert, never focusable, loaded after the form.

## 4. Before you change anything

1. **Step 2 first:** the screenshot run can't see the gate (it needs Supabase), nor any onboarding step past the first without real data. Make Step 2's refactor with the old look, then baseline.
2. **Baseline:** run `npm run shots -- capture .shots/before` and `npm run shots -- props .shots/props-before.json`.

## 5. Steps

### Step 1: the prompt
- This prompt, both screen references, the references, and PLAN's Scope, phases and screen map.
- Commit: "New look phase 8b: the phase prompt and screen references".

### Step 2: the way in without Supabase (D8)
- **The gate:**
  - `AuthScreen` is presentational, and renders every view and error from props.
  - `AuthPage` is the Supabase controller.
  - A dev-only `/dev/auth?view=&error=` route renders `AuthScreen` (outside production builds).
- **Onboarding:** split the same way.
  - `OnboardingFlow` holds the state machine and its answers, behind a small service interface: create the workspace, pull the brand, save the kit and assets, seed, invite.
  - Each step renders from props.
  - `/dev/onboarding?step=` renders any step with fixture answers.
- **Shots and tests:**
  - Add every gate view and onboarding step to the screenshot run.
  - Component tests: the gate's actions, Enter, the recovery event and the kept email; and the flow's transitions with a fake service.
- **No visible change.** The old wizard still renders its four steps through the new controller.
- Commit: "New look phase 8b: the way in renders without Supabase".

### Step 3: the shell, the panel and the shared pieces (D6, D7, D9, D13, D14)
- **`PreAppShell`:**
  - One `auth` layout: the column beside `sp-auth-panel`, as both references measure it.
  - The form column is 400 wide on the gate and 480 on onboarding.
  - `split`, its Slime hero, the `dark` tone and the `wide` solo layout go once nothing uses them (D9).
- **The panel:**
  - The art from 221:3321, exported at 2x as WebP, into `src/assets/socialpaint/`.
  - The composer (gate, D6).
  - The Workspace preview (onboarding, D14).
- **New pieces, each into `/dev/ui` with its states:**
  - the **Option tile** (D13);
  - the **segmented progress bar**;
  - the **question** wrapper (a Label/L label over its control, 12 apart);
  - the **colour swatch** and add-colour control;
  - the **template card** (09).
- Below desktop (D7).
- Commit: "New look phase 8b: the shell, the panel and the shared pieces".

### Step 4: the gate screens (D1 to D5, D10)
- Each view on the primitives, with the drawn copy, errors under their fields, the Reset link sent screen, the footer and consent links (D2), the busy state (D10), and what happens after Save password (D5).
- Commit: "New look phase 8b: the gate".

### Step 5: the data (D11, D12)
- Migration `0045_onboarding_answers.sql` adds the columns D11 names, with RLS that matches their table's, and a `supabase/verify` check.
- Add the same to the local store, the types and the stores.
- **Phase 9's migrations become 0046 and 0047.** Update PHASE-9.md when it rebases.
- Commit: "New look phase 8b: onboarding answers".

### Step 6: onboarding steps 01 to 04
- About you, Set up for, Your team, First up: Option tiles, inputs, the Select, the progress bar, Back and Continue, and validation (D15).
- Commit: "New look phase 8b: onboarding, about you to first up".

### Step 7: onboarding steps 05 to 07 (D16)
- Website, Add your brand, Pulling your brand, Your brand, built on `brand-from-website` and today's prefill. That covers the 05b branch, 06's statuses, and 07's review with its add and remove controls.
- The workspace, kit, assets and starters are created at the point D12 sets.
- Commit: "New look phase 8b: onboarding, website to your brand".

### Step 8: onboarding steps 08 and 09 (D17, D18)
- Invite your team through the existing invite path, rows per D17, and Skip for now.
- Workspace ready, with the seeded starters, and "Go to my templates".
- The in-app Create company path (D19).
- Commit: "New look phase 8b: onboarding, invites and ready".

### Step 9: legacy and docs
- **Delete what only the old gate and wizard read:**
  - the `sp-gate*` rules and `--gate-*` tokens;
  - the orbit and hero art;
  - the old step components;
  - BrandMark's 64 use, if it was the last.

  Check every deletion against the rest of the app.
- **BRIDGE §3:** the gate no longer reads `--radius-control-lg`, so "the gate keeps 12" is retired.
- **Update PHASE-9 and its inventory:** onboarding is done, so it leaves Phase 9's D1 list. The renumbered migrations.
- **ARCHITECTURE:** the gate and onboarding (the controllers, the dev routes, the answers and where they live, the legal placeholders).
- Commit: "New look phase 8b: legacy names and docs".

### Step 10: the gate
1. `npm run verify` and `npm run build`.
2. `capture .shots/after`, `compare`, `props-compare`.
   - Expected changes: the gate's views and the onboarding steps only.
   - Everything else at 0%.
3. **Side by side** with every Light reference at 1440 × 1053.
4. **Keyboard:**
   - every field, tile, link and button in order;
   - Enter submits;
   - errors are announced, and focus goes to the first field in error;
   - the Option tiles work as radio or checkbox groups (arrow keys in a radio group);
   - the panel takes no focus.
5. **Click-through on the local backend:** the whole onboarding flow, both branches (with a website, and without), invites skipped and sent, the in-app Create company path, and the starters on 09.
6. **CJ on the Vercel preview against Supabase:**
   - sign up with a new address, the confirmation email, and onboarding end to end (a real website, an invite);
   - sign in, a wrong password, reset, and the new password.
7. **The PR:** "New look, Phase 8b: the sign-in gate and onboarding". It carries the migration and its deploy step, the compare table, every decision as built, proposed copy, and surprises.

## 6. Out of scope

- The Dark frames of the gate (D1).
- Social sign-in (Google).
- Terms of Service and Privacy Policy pages (D2).
- Several brands per workspace for "My clients" or "Our locations" (D11).
- Billing (Phase 7b, on hold).

## 7. Expected changes

- **Changes:** the gate's eight views, and onboarding's ten screens.
- **Data:** migration 0045 (D11), with a verify check.
- **Unchanged:** every app screen. Settings › People still invites.
- **New copy:** everything drawn on both pages (the screen references quote it), with curly apostrophes throughout ("Let’s", "don’t", "We’re").
- **Proposed (not drawn; list in the PR):** the gate's other errors (D4), the busy state (D10), onboarding's validation messages (D15), 06's not-found state and failure (D16), and 08's row errors (D17).
- **Copy that goes:**
  - the old gate's Title Case labels, help line and notices;
  - the old wizard's step names and copy.

## 8. Rulings on what the files leave open

| Item | Ruling |
|---|---|
| Raw colours in the frames | Each binds to the token in its screen reference's colour table: text spans to `--text-strong` and `--text-secondary`; progress segments to `--text-strong` and its 10% tint, or the nearest Figma token; links to `--text-strong`. A value with no Figma token goes on the Figma request list (PLAN decision 1). |
| Straight apostrophes in onboarding ("Let's", "don't") | Curly, as the gate draws them |
| The shell building block's panel (radius 25, gradient) | The frames win: radius 20 and the art image, as on the gate |
| Option tile focus | The focus ring per RULES §6 (1 px, 2 px outside, at the tile's radius) |
| Hug tiles growing 28 when selected | As drawn: a hug tile grows by the check when chosen (reserving it widened every tile and rewrapped 03's sizes). Grid and full tiles keep the check's space in every state. |
| CompactSelect at 40 tall in 08 | `Select` (40) with Admin and Member, the role picker's height as drawn |
| Unlabelled font selects on 05b | Labelled "Heading font" and "Body font" (proposed copy) |
| The Workspace preview's rows | It reflects the answers held so far, including 02's (from 02), 05b's brand (from 05b) and 08's invitees (from 08). The frames' omissions are slips. |

## 9. Decisions (CJ, 2026-10-08)

CJ ruled on D1 and D2, took both Figma pages into the build, and took D3 to D19 as recommended.

1. **D1. Light.** The gate keeps Gate Light, and so does onboarding (drawn in Light only). Both force the light token set on their root. The gate's Dark frames aren't built.
2. **D2. Terms of Service and Privacy Policy aren't ready, so use placeholders.**
   - The footer links and the sign-up consent line render as drawn.
   - Their targets come from one module (`src/lib/legal.ts`), set to placeholder URLs and marked as placeholders.
   - When the pages exist, only that module changes.
3. **D3. Validation (as recommended).** Submit is always enabled, and the rules run on submit, with messages under their fields. The help line goes. An error clears when its field changes.
4. **D4. The gate's undrawn errors (as recommended):**

   | Case | Field | Copy |
   |---|---|---|
   | Empty email | Email | "Enter your email." |
   | Malformed email | Email | "Enter a valid email address." |
   | Empty password | Password | "Enter your password." |
   | Already registered | Email | "That email already has an account. Sign in instead." |
   | Not confirmed | Email | "Confirm your email first. The link is in your inbox." |
   | Rate limited | Last field | "Too many tries. Wait a minute, then try again." |
   | Anything else | Last field | "Something went wrong. Try again." |

   Supabase's raw text goes to the console and Sentry only.
5. **D5. After Save password (as recommended):** straight into the app, since the recovery link has already signed the person in.
6. **D6. The gate panel's composer (as recommended):** drawn from the primitives in a nested light theme, `aria-hidden` and `inert`, over the exported art.
7. **D7. Below desktop (as recommended):**
   - From 1440 to 1024 the panel narrows, and the form column keeps its width.
   - Below 1024 the panel goes, and the column fills the page.
8. **D8. Reaching every screen without Supabase (as recommended):** the presentational split and the dev routes (Step 2).
9. **D9. `PreAppShell` (as recommended):** one `auth` layout serves the gate and onboarding. The unused `split` hero and `dark` tone go, and `solo` and `wide` go once onboarding moves (D19 keeps no other user).
10. **D10. Busy (as recommended):** the button keeps its label, shows the spinner in its icon slot with `aria-busy`, and is disabled while the request runs.
11. **D11. Where onboarding's answers live** (as recommended).
    - **Recommended, migration 0045:**
      - **Person:**
        - **Name** goes to `users.name`, which exists. Today it defaults to the email's local part.
        - **Role** goes to a new `users.job_role` text column, holding the tile's value.
      - **Workspace:** a new `companies.profile jsonb` holding:
        - `setup_for` (company, clients, locations, just me)
        - `heard_from`
        - `team_size`
        - `makers` (the people who'll make graphics)
        - `first_up` (what they want to make first)
        - `platforms`
    - **Nothing changes behaviour this phase.** "My clients" and "Our locations" don't create several brands, and "Just me" skips nothing. The answers are stored for later use.
    - Alternative: don't store the answers (not recommended: the frames ask, so the product should keep them).
12. **D12. When the workspace is created** (as recommended).
    - **Recommended:** on 07's "Looks good" (or 05b's Continue, which leads to 07). That one action creates the workspace, saves its profile, the brand kit, assets and website, and seeds the starters. Then 08 can invite into a real workspace.
    - Before that, everything lives in the flow's state, so leaving early leaves nothing behind.
    - Back from 08 doesn't undo the workspace. It returns to 07 to adjust the brand, which saves as an edit.
13. **D13. The Option tile** (as recommended).
    - **Recommended:** a new primitive, `OptionTile`, built from 257:4145.
      - Default is raised with Elevation/Small.
      - Hover adds `state/hover`. The frame's raw `rgba(11,11,12,0.05)` is that token.
      - Selected is sunken with the check.
      - Focus uses the ring per §8.
    - **Groups:**
      - Single-select groups are radio groups: 01 role, 02 set up for, 03 team size.
      - Multi-select groups are checkbox groups: 03 who makes graphics, 04 what first, 04 where they post.
    - "Something else" on 01 takes no follow-up text field (none is drawn).
14. **D14. The onboarding panel** (as recommended).
    - **Recommended:** the Workspace preview as drawn (YOU, WORKSPACE, FIRST UP, BRAND, TEMPLATES), each row a skeleton until its answers arrive, filled from the flow's live state (§8).
    - TEMPLATES shows the seeded starters' thumbnails once they exist, and skeletons before.
15. **D15. What onboarding requires** (as recommended).
    - **Recommended:**
      - **Required:** 01 name and role; 02 who it's for; 03 company name and team size.
      - **Optional:** "How did you hear", "Who will be making graphics", all of 04, and 08.
    - Continue is always enabled. A missing required answer shows under its question: "Enter your name.", "Choose one.", and so on.
16. **D16. The website branch** (as recommended).
    - **Recommended:**
      - **05** accepts a bare domain or a full URL (normalised as today).
      - **06** runs `brand-from-website` once:
        - Logo, Colors and Fonts show "Looking" until it answers, then each shows "Found" or "Not found".
        - It advances to 07 on its own after a beat.
        - A failure goes to 05b with the site's name and the message "We couldn’t read that site. Add your brand here instead." (proposed).
      - **07:**
        - It shows what was found. Empty sections offer add (logo upload, colours, fonts).
        - Colours can be removed as well as added, with the popover colour editor (up to 8).
        - Fonts and logos can be replaced.
        - Back goes to 05, or to 05b when that was the path.
      - **05b:** the same controls (logo upload, colours up to 8, heading and body font Selects), all optional.
17. **D17. Invites on 08** (as recommended).
    - **Recommended:**
      - Rows of email plus role (Admin or Member), starting with one, up to 10.
      - Each row past the first can be removed with an icon button (not drawn).
      - Empty rows are ignored on send.
      - Each address is checked for form only, not domain.
      - "Send invites" calls the existing invite path per row. Failures show under their row, and the rest still go.
      - Once every row succeeds, the flow moves to 09.
      - "Skip for now" goes to 09 with nothing sent.
18. **D18. Workspace ready (09)** (as recommended).
    - **Recommended:**
      - The six cards are the workspace's own seeded starters, in its brand, with their real names. The frame's six names are samples.
      - A card opens that template's fill page.
      - "Go to my templates" opens Brand Templates.
      - If seeding failed, the cards that exist show, along with today's notice, which points to Restore starter templates.
      - The title takes the person's first name.
19. **D19. The in-app "Create company" path** (as recommended).
    - **Recommended:** it uses the new flow, starting at 03 (the person is known, so 01 and 02 are skipped). It's Light like the rest, and the progress bar counts from 03.
    - The old wizard is deleted, so Phase 9's D1 no longer lists onboarding.
