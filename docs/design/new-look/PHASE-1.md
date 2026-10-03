# New look, Phase 1: tokens from Figma

You are a senior front-end engineer on SocialPaint (this repository). This phase moves the platform's design tokens onto the Figma file "Master UX-UI": `src/styles/tokens.css` is generated from a committed export of that file, old token names read the new values through a temporary bridge, every token ends up with one definition, and the keyboard focus ring becomes 1 px (ink in Light, white in Dark).

The look changes only where a Figma value differs from today's. §7 lists every one of those changes, and the gate proves nothing else moved. No component, layout, copy or behavior changes in this phase. Those are Phases 2 to 8.

Be exact. Work through the steps in §5 in order, run the checks each step names, and commit after each step with `npm run verify` green. If something here turns out to be wrong once you are in the code, stop and explain the conflict instead of improvising.

---

## 1. Read these first

1. `docs/design/new-look/PLAN.md`, `RULES.md` and `BRIDGE.md` in full.
2. `docs/ARCHITECTURE.md` (the Theming section) and `docs/CI.md`.
3. `src/styles/index.css`, `src/styles/theme.css`, `src/styles/tailwind.css`.
4. `src/styles/socialpaint.css`: the header comment, the `:root` block (about lines 120 to 357), the dark block (388 to 667), the light block (668 to 890), the `[data-theme]` tier (891 to 975), the `:root` block after it (976 to 987) and the `:focus-visible` rule (about 1018). Line numbers are at `main` 93f721a.
5. `src/lib/colorScheme.tsx` (how `data-theme` lands on `<html>`) and `src/app/components/PreAppShell.tsx` (a nested `data-theme`).
6. The kit files, already in the tree: `design/tokens/master.tokens.json`, `design/tokens/figma-export/`, `scripts/build-tokens.mjs`, `scripts/new-look/shots.mjs` with `scripts/new-look/fixtures/dev-workspace.json`, and `src/styles/legacy-bridge.css`.

## 2. What the kit gives you

Use these as they are. If one of them is wrong, say so in the PR instead of rewriting it.

- `design/tokens/master.tokens.json`: the export of the Figma file. 155 variables (63 primitives, 73 brand tokens in Light and Dark, 8 radii, 11 spacing values including `focus/width` and `focus/offset`), 46 text styles and 7 effect styles.
- `design/tokens/figma-export/`: the Figma development plugin that writes that JSON. Nothing runs it in this phase.
- `scripts/build-tokens.mjs`: generates `src/styles/tokens.css` from the JSON. `--check` fails when `tokens.css` is out of date, or when any other stylesheet in `src/styles` declares a name that `tokens.css` or `legacy-bridge.css` owns at theme level (`:root`, `html`, `.dark`, `[data-theme…]`, bare or inside `@media`). It prints one line per problem with its file and line.
- `src/styles/legacy-bridge.css`: old names pointed at Figma tokens (`BRIDGE.md` §2).
- `scripts/new-look/shots.mjs`: the screenshot loop. `capture` starts its own Vite server on the local backend (Supabase env blanked), seeds a sample workspace and saves 21 routes plus onboarding at 1440 wide in both themes. `compare` writes heatmaps and prints how much of each screen moved. `props` snapshots every custom property at the root in both themes. `props-compare` prints values that changed or were lost, counts names that are new, and exits 1 when anything changed or was lost.

## 3. Invariants

- **Multi-tenant.** This phase touches no tenant data, starter content or brand kit. Tokens style the platform chrome only.
- **Generated files stay generated.** Never hand-edit `tokens.css` or the JSON.
- **One definition per token.** When the phase ends, `npm run tokens:check` passes and runs in CI.
- **No component changes.** The phase changes stylesheets, scripts, CI and docs. It changes no `.tsx` file and no component rule beyond the focus outlines in step 2.
- **Legacy names outside the bridge keep their values.** `BRIDGE.md` §3 lists the ones left alone on purpose.

## 4. Before you change anything

1. Install the screenshot loop's browser driver: `npm install --save-dev playwright`, then `npx playwright install chromium`. (The `playwright` package downloads no browser on install, so CI and Vercel are unaffected.)
2. Add `.shots/` to `.gitignore` with a one-line comment. Prettier skips ignored files, so the captures never reach the format check.
3. Capture the baseline from the current look:

   ```bash
   node scripts/new-look/shots.mjs capture .shots/before
   node scripts/new-look/shots.mjs props .shots/props-before.json
   ```

   Check that `.shots/before` holds 44 PNGs and that the screens show the sample workspace "Acme Studios".

## 5. Steps

### Step 1: token pipeline and tooling

- Add three scripts to `package.json`, next to `format:check`: `"tokens": "node scripts/build-tokens.mjs"`, `"tokens:check": "node scripts/build-tokens.mjs --check"` and `"shots": "node scripts/new-look/shots.mjs"`. Leave `verify` alone for now.
- Run `npm run tokens`. It writes `src/styles/tokens.css` and prints `{"primitives":63,"brand":71,"radius":8,"spacing":11,"textStyleClasses":31,"composites":6}` (the two `theme/is-*` booleans are the theme selectors themselves, so 73 brand tokens make 71 properties).
- Run `node scripts/build-tokens.mjs --check`. It exits 1 and lists 78 shadowed declarations: 77 in `socialpaint.css` and `--switch-background` in `theme.css`. That is expected until step 3. Keep the list.
- `npm run verify` passes, because nothing imports the new files yet. Commit: "New look phase 1: token pipeline and screenshot loop". Include the Playwright install and `.gitignore`.

### Step 2: wire the tokens and the bridge

- Import order in `src/styles/index.css`, so the generated tokens and then the bridge come after the legacy stylesheet:

  ```css
  @import "./socialpaint.css";
  @import "./tokens.css";
  @import "./legacy-bridge.css";
  @import "./tailwind.css";
  @import "./theme.css";
  ```

- Point the hard-coded focus outlines in `socialpaint.css` at the focus tokens. There are four at 93f721a:
  - the global `:focus-visible` rule (about line 1018): `outline: var(--focus-width) solid var(--ring); outline-offset: var(--focus-offset);`, and its comment becomes "Focus: a --focus-width ring at --focus-offset on every interactive element, both modes."
  - `.sp-color-pop .react-colorful__interactive:focus-visible` and `.sp-gate__drop:focus-within`: the same two declarations.
  - `.sp-gate[data-theme="light"] .sp-btn-primary:focus-visible, .sp-gate[data-theme="light"] .sp-gate__cta:focus-visible`: the width only. Its `outline-offset: 3px` stays.

  Leave the `outline: 2px solid transparent` declarations alone. They are the forced-colors fallback behind box-shadow rings.
- Snapshot and compare:

  ```bash
  node scripts/new-look/shots.mjs props .shots/props-wired.json --names .shots/props-before.json
  node scripts/new-look/shots.mjs props-compare .shots/props-before.json .shots/props-wired.json
  ```

  The changed values must be exactly the lists in §7 minus `--switch-background` (24 in Light, 25 in Dark). `theme.css` still wins for that one until step 3. Any other line is a problem: find out which declaration produced it before you go on.
- `npm run verify` passes. Commit: "New look phase 1: wire generated tokens and the legacy bridge".

### Step 3: one definition per token

- Delete every declaration that `node scripts/build-tokens.mjs --check` lists: 77 in the theme-level blocks of `socialpaint.css` and `--switch-background` in the `:root` block of `theme.css`. §8 has the full list for reference. Many of these lines end in a trailing comment: delete the declaration with its own comment and nothing past its line.
- Keep `--input-bg` inside `.sp-gate[data-theme="dark"] .sp-gate__panel`. It is a component scope, so the check does not list it.
- Tidy the comments around the deletions. A comment that only described a deleted declaration goes. A comment that explains a group keeps its point and drops numbers that no longer apply. Leave no empty block behind. §8 names the comments and the one block that need attention.
- Run `npx prettier --write src/styles` (deleting lines leaves double blank lines).
- `node scripts/build-tokens.mjs --check` now passes: "tokens.css is up to date, and no stylesheet shadows a token."
- Snapshot and compare:

  ```bash
  node scripts/new-look/shots.mjs props .shots/props-clean.json --names .shots/props-before.json
  node scripts/new-look/shots.mjs props-compare .shots/props-wired.json .shots/props-clean.json
  ```

  The only change allowed is `--switch-background`: Light `rgb(39 39 39 / 0.16)` → `rgb(11 11 12 / 0.16)`, Dark `rgb(241 241 241 / 0.2)` → `rgb(241 241 241 / 0.3)`. Anything else means a deleted declaration still mattered: restore it and report it in the PR.
- Put the check in the pipeline:
  - `package.json`: `verify` becomes `npm run tokens:check && npm run typecheck && npm run typecheck:deno && npm run lint && npm run format:check && npm test`.
  - `.github/workflows/ci.yml`: a step right after "Install (frozen lockfile)":

    ```yaml
          - name: Tokens (generated file is current, nothing shadows a token)
            run: npm run tokens:check
    ```

  - `docs/CI.md`: add "the token check (`tokens.css` matches the Figma export and no stylesheet redeclares a token)" to the list of steps in its first paragraph.
- `npm run verify` passes. Commit: "New look phase 1: one definition per token".

### Step 4: docs

- `src/styles/socialpaint.css`: add this paragraph at the top of the header comment, right under the opening rule line, and change nothing else in the header:

  ```
     NEW LOOK (2026-10): token values come from the Figma file "Master
     UX-UI" (mEJRslarcQDkgPeY6AObi5) through src/styles/tokens.css, which
     is generated (npm run tokens) and never edited by hand. Old names that
     map one to one to a Figma token are set in legacy-bridge.css. Where
     this header disagrees with docs/design/new-look/RULES.md, RULES.md
     wins; Phase 9 rewrites this header.
  ```

- `docs/ARCHITECTURE.md`, Theming section: add this paragraph after the first one:

  ```
  Token values come from the Figma file "Master UX-UI". `design/tokens/master.tokens.json`
  is its export (made with the development plugin in `design/tokens/figma-export/`), and
  `npm run tokens` generates `src/styles/tokens.css` from it with `scripts/build-tokens.mjs`.
  Nobody edits either file by hand. While the new look moves page by page
  (`docs/design/new-look/`), `src/styles/legacy-bridge.css` points old token names at the
  Figma ones. `npm run tokens:check`, part of `npm run verify` and CI, fails when
  `tokens.css` is out of date or when a stylesheet redeclares a token it owns.
  ```

- `npm run verify` passes. Commit: "New look phase 1: docs".

### Step 5: the gate

1. `npm run verify` and `npm run build` pass.
2. Properties: `node scripts/new-look/shots.mjs props .shots/props-after.json --names .shots/props-before.json`, then `props-compare .shots/props-before.json .shots/props-after.json`. The changed values match §7 exactly: 25 in Light and 26 in Dark. The tool also counts about 183 new names per theme (the Figma tokens); that is expected.
3. Screens: `node scripts/new-look/shots.mjs capture .shots/after`, then `node scripts/new-look/shots.mjs compare .shots/before .shots/after .shots/diff`. Open the heatmaps. Changed pixels may only sit on: text fields and selects (the new fill), primary buttons (Deep Moss and Slime), controls whose corners went from 5 to 7, menu rows (10 to 7), red text, icons and outlines, platform chip tiles, ink fills that went from `#272727` to `#0B0B0C`, Dark switches that are off, and Dark page titles (slightly dimmer). Card and sidebar shadows changed too but mostly fall under the diff threshold. Onboarding stays at 0%. Expect the largest share on Settings › Workspace (about 5%) and nothing much above that. Any change anywhere else needs an explanation before the PR.
4. Keyboard: on Brand Templates and Settings › Workspace, in both themes, Tab through the page. Every focused control shows a 1 px ring 2 px out, ink in Light and white in Dark. Controls that draw a tight ring (chips, segments, tabs, rail items) show 1 px against their edge. Text fields keep today's focus border until Phase 2.
5. Open the pull request into `main`: "New look, Phase 1: tokens from Figma". In the description, list what changed (the §7 table in short), paste the `compare` table, say how many declarations step 3 deleted, and note anything that surprised you.

## 6. Out of scope (do not do these here)

- Component changes, even where the Figma file differs: filled destructive buttons, the switch size, the text field focus look, the nav pill, page headers. Those are Phases 2 to 8.
- Bridging the names in `BRIDGE.md` §3. Their components move in later phases.
- Deleting unused legacy tokens or splitting `socialpaint.css`. Phase 9 handles the leftovers.
- Running the Figma plugin or editing the token JSON.

## 7. Expected value changes

`props-compare` from the baseline to the end of the phase. Colors are as the tool prints them.

| Property | Light before → after | Dark before → after |
|---|---|---|
| `--accent-foreground` | `#f1f1f1` → `#ffffff` | `#272727` → `#0b0b0c` |
| `--btn-primary-bg` | `#272727` → `#082a23` | `#f1f1f1` → `#17ff7e` |
| `--btn-primary-bg-hover` | `color-mix(in srgb, #f1f1f1 8%, #272727)` → `linear-gradient(rgb(255 255 255 / 0.06), rgb(255 255 255 / 0.06)), #082a23` | `color-mix(in srgb, #272727 8%, #f1f1f1)` → `linear-gradient(rgb(11 11 12 / 0.05), rgb(11 11 12 / 0.05)), #17ff7e` |
| `--btn-primary-fg` | `#f1f1f1` → `#17ff7e` | `#272727` → `#082a23` |
| `--chip-tile` | `#f9f9f8` → `#ffffff` | `#252627` → `#0b0b0c` |
| `--chip-tile-active-fg` | `#f1f1f1` → `#ffffff` | unchanged |
| `--danger-wash` | 16% of `#c94040` → 16% of `#d43535` | 16% of `#e57373` → 16% of `#ec5656` |
| `--destructive` | `#c94040` → `#d43535` | `#e57373` → `#ec5656` |
| `--fill-action` | `#272727` → `#0b0b0c` | `#f1f1f1` → `#ffffff` |
| `--focus-ring` | outer ring `calc(2px + 2px)` → `calc(2px + 1px)` | the same, and `#17ff7e` → `#ffffff` |
| `--focus-ring-tight` | `0 0 0 2px #272727` → `0 0 0 1px #272727` | `0 0 0 2px #17ff7e` → `0 0 0 1px #ffffff` |
| `--focus-width` | `2px` → `1px` | `2px` → `1px` |
| `--gen-seg-on-shadow` | `6px 6px 25px 0 rgb(53 53 53 / 0.05)` → `2px 2px 8px 0 rgb(0 0 0 / 0.05)` | unchanged |
| `--input-bg` | `#ffffff` → `#f1f1ef` | `#171819` → `rgb(241 241 241 / 0.08)` |
| `--primary` | `#272727` → `#0b0b0c` | `#f1f1f1` → `#ffffff` |
| `--primary-foreground` | `#f1f1f1` → `#ffffff` | `#272727` → `#0b0b0c` |
| `--radius` | `5px` → `7px` | `5px` → `7px` |
| `--radius-control` | `5px` → `7px` | `5px` → `7px` |
| `--radius-menu-item` | `10px` → `7px` | `10px` → `7px` |
| `--ring` | unchanged | `#17ff7e` → `#ffffff` |
| `--shadow-card` | `6px 6px 25px 0 rgb(53 53 53 / 0.05)` → `2px 2px 8px 0 rgb(0 0 0 / 0.05)` | `6px 6px 25px 0 rgb(0 0 0 / 0.15)` → `2px 2px 8px 0 rgb(0 0 0 / 0.15)` |
| `--shadow-rail` | the same as `--shadow-card` | the same as `--shadow-card` |
| `--sidebar-ring` | unchanged | `#17ff7e` → `#ffffff` |
| `--state-danger` | `#c94040` → `#d43535` | `#e57373` → `#ec5656` |
| `--state-danger-on-surface` | `#c94040` → `#d43535` | `#e57373` → `#ec5656` |
| `--switch-background` | `rgb(39 39 39 / 0.16)` → `rgb(11 11 12 / 0.16)` | `rgb(241 241 241 / 0.2)` → `rgb(241 241 241 / 0.3)` |
| `--text-heading` | unchanged | `#f9f9f8` → `#f1f1f1` |
| `--text-on-action` | `#f1f1f1` → `#ffffff` | `#272727` → `#0b0b0c` |

## 8. The declarations step 3 deletes

At 93f721a, by block. `--check` prints the same list with current line numbers.

- `:root` primitives: `--slime`, `--lapis`, `--christina`, `--fire`, `--deep-moss`, `--ink-900`, `--ink-800`, `--ink-700`, `--paper-050`, `--paper-100`. Keep `--aqua: var(--lapis)` and every other primitive.
- `:root` spacing: `--space-3xs` through `--space-3xl` (9).
- `:root` shape: `--radius-control`, `--radius-control-md`, `--radius-card`, `--radius-menu`, `--radius-menu-item`, `--radius-media-plate`, `--radius-pill`. Keep `--radius-control-lg`, `--radius-tag` and the rest.
- `:root` motion: `--focus-width`, `--focus-offset`.
- `[data-theme="dark"]` and `[data-theme="light"]`, 22 each: `--bg-canvas`, `--bg-surface`, `--bg-card`, `--border`, `--border-strong`, `--text-primary`, `--text-secondary`, `--text-muted`, `--fill-action`, `--text-on-action`, `--state-danger-on-surface`, `--state-danger`, `--ring`, `--chip-tile`, `--text-heading`, `--shadow-rail`, `--shadow-card`, `--gen-btn-accent-bg`, `--gen-btn-accent-fg`, `--gen-sunken`, `--gen-inverse`, `--gen-on-inverse`.
- `[data-theme]` tier: `--tag-bg-on-media`.
- `:root` after the tier: `--btn-primary-bg`, `--btn-primary-fg`, `--btn-primary-bg-hover`, `--input-bg`.
- `theme.css` `:root`: `--switch-background`.

Comments that need attention once their declarations go:

- The Primitives block's note "Neutrals and Deep Moss from the Figma Primitives collection" now introduces nothing; delete it.
- "Spacing: 4px base, nothing off the scale." and "Shape: hold the gap between soft containers and crisp controls." head groups that lost most or all of their lines. Keep a heading only if a declaration remains under it.
- In both theme blocks, the notes on the lifted fill (`--bg-surface`), the action fill (`--fill-action`), the danger contrast figures (`--state-danger`), the ring contrast and the elevation tokens (`--shadow-card`, `--shadow-rail`) describe values that now come from Figma. Delete the numbers. Keep a sentence only where it still explains a declaration that remains.
- The `:root` block after the tier explains `--btn-primary-*` and `--input-bg`. With all four gone, delete the block and its comment.
