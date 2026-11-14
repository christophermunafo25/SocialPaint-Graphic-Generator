# New brand, Phase 1: foundation

You are a senior front-end engineer on SocialPaint (this repository). This phase moves the platform's tokens onto the Figma file "Master UX UI New Brand (Copy)" (`1dYWgFH2V8i9Jez2ylI3ky`). The exporter, the JSON, the generator and the check learn the file's three collections. `src/styles/tokens.css` is regenerated from a fresh export. Every older name that is still read points at a new token through `src/styles/legacy-bridge.css`. The focus ring becomes 2 px on every control, text fields included. The twenty text styles replace the thirty-one, and existing text moves onto them without changing its box.

The look changes only where a new value differs from today's. Section 7 lists those changes, and the gate proves nothing else moved. No component is rebuilt, no layout changes and no copy changes. Those are Phases 2 to 9.

Be exact. Plan in plan mode first. Work through the steps in section 5 in order, run the checks each step names, and commit after each step with `npm run verify` green. If something here turns out to be wrong once you are in the code, stop and explain the conflict instead of improvising.

---

## 1. Read these first

1. `docs/design/new-brand/PLAN.md`, `RULES.md` and `BRIDGE.md` in full, and `PROMPT.md` section 4 (the token tables).
2. `CLAUDE.md`.
3. `design/tokens/figma-export/code.js`, `scripts/build-tokens.mjs`, `design/tokens/master.tokens.json` (its top-level shape and one entry of each group), `src/styles/tokens.css`.
4. `src/styles/index.css`, `legacy-bridge.css`, `theme.css`, `tailwind.css`.
5. `src/styles/socialpaint.css`: the `:root` block, the two theme blocks, the `[data-theme]` tier, the `@font-face` rules and the global `:focus-visible` rule. Find them with grep. Line numbers move.
6. `src/styles/primitives.css` lines 1 to 80 (the focus helpers `.ui-ring-tight` and `.ui-ring-none`).
7. `scripts/new-look/shots.mjs` (the `props`, `props-compare`, `capture` and `compare` modes).
8. In Figma, with the MCP server connected: the Foundations page (`4012:1192`) and the Docs page's Map (`2223:1066`).

## 2. Invariants

- **Multi-tenant.** This phase touches no tenant data, starter content, brand kit or graphic. Tokens style the platform chrome only.
- **Generated files stay generated.** Never hand-edit `tokens.css` or the JSON. The JSON changes only by running the exporter against the file.
- **One definition per token.** When the phase ends, `npm run tokens:check` passes: `tokens.css` owns the new names, `legacy-bridge.css` owns the older ones, and no other stylesheet declares either at theme level.
- **No component is rebuilt.** The `.tsx` changes in this phase are the class renames in step 5 and nothing else. No props, markup or logic.
- **No layout moves.** Spacing is bridged by value and text keeps its box (step 5). A screenshot diff that shows a block shifting is a bug in this phase, not an expected change.
- `SchemaRenderer`, the export path, `canvasGesture.ts`, the frozen types and every table column are untouched. Run the `fidelity-checker` subagent at the gate anyway: the builder's chrome reads tokens that change here, and the check proves the graphics did not.

## 3. Before you change anything

```bash
npm run shots -- capture .shots/before
npm run shots -- props .shots/props-before.json
```

Check that `.shots/before` holds the 44 routes in both themes and that the screens show the sample workspace "Acme Studios".

## 4. What Phase 0 already knows

- The token tables in `PROMPT.md` section 4 match the file. Light values were read back from the Color board.
- The file's Docs page says its new collections and styles were prefixed "v2" until approval, and that the earlier collections (Primitives, Brand, Radius, Spacing) and the earlier 46 text styles are retired "on approval". Phase 0 could not read collection names through the MCP server. Step 1 finds out which state the file is in, and the exporter has to work in either.
- Four new names are already declared in `socialpaint.css` with other meanings: `--text-disabled`, `--border-control`, `--purple-kara`, `--font-mono` (`BRIDGE.md` section 1).
- `theme.css` declares `--radius-sm`, `-md`, `-lg` and `-xl` inside `@theme inline`, and Tailwind's theme defines `--font-sans` and `--font-mono`. The new tokens use all six names.
- `text-box: trim-both cap alphabetic` works in the three engines Playwright pins here.

## 5. Steps

### Step 1: the exporter

Change `design/tokens/figma-export/code.js` so it exports the new file.

- `SOURCE` becomes the new file key and name. Update the header comment and `DESCRIPTION`.
- Find the collections by name: Primitives, Color and Scale. First list the file's collections (run `figma.variables.getLocalVariableCollectionsAsync()` through `use_figma`, read only). If the three carry a "v2" prefix or sit beside the earlier four, make the lookup explicit about which it takes and say what you found in the pull request. Never fall back to a collection by position.
- **Primitives** (one mode): name, CSS name from the WEB code syntax, hex with alpha.
- **Color** (Light and Dark): every value is an alias to a primitive. Export the primitive's name per mode, plus the resolved hex for reference. A Color value that is not an alias is an error: throw, naming the variable.
- **Scale** (one mode): numbers and strings. Export each with its CSS name, its `resolvedType` (`FLOAT` or `STRING`) and its value. Group nothing: the generator reads the type and the name.
- **Text styles**: only the twenty in `PROMPT.md` section 4.5. If the file still holds the earlier styles, select by name (and strip a "v2" prefix if there is one). Export family, style, size, line height, tracking, text case and leading trim as today, plus the bound variables for size, weight and family where the style has them.
- **Effect styles**: the six in section 4.6, with each layer's bound color variable.
- The JSON's top-level keys become `primitives`, `color`, `scale`, `textStyles`, `effectStyles`. The summary line counts 65, 76 and 52 variables, 20 text styles and 6 effect styles, and the plugin panel (`ui.html`) shows the same. Replace the old palette values that `ui.html` carries.

Run the export against the file through `use_figma` (it truncates long results, so return one section at a time and merge them), and write `design/tokens/master.tokens.json`. Check the counts: 193 variables, 20 text styles, 6 effect styles. Compare every primitive and every Color alias with `PROMPT.md` sections 4.2 and 4.3. A difference means the file moved after the prompt was written: the file wins, and you list each difference in the pull request.

Do not run `npm run tokens` yet. `npm run verify` fails at this point because `tokens.css` no longer matches the JSON, so this step and step 2 are one commit.

### Step 2: the generator

Change `scripts/build-tokens.mjs` to read the new shape and write `tokens.css`:

- `:root`: primitives, then every Scale token. Numbers that are lengths take `px` (`--space-*`, `--radius-*`, `--size-*`, `--stroke-*`, `--focus-offset`, `--type-size-*`). `--type-weight-*` are unitless. `--motion-duration-*` take `ms`. Strings are written as they are (`--motion-easing-*`).
- `--font-sans` and `--font-mono` are the exception to "as they are". Figma holds the public family names. Write the private stacks the app registers: `--font-sans: "Inter Tight Platform", system-ui, -apple-system, sans-serif` and `--font-mono` as the Geist Mono stack `socialpaint.css` declares today. Keep the map in the generator, and fail on a family it does not know.
- `[data-theme="light"]` and `[data-theme="dark"]`: the Color tokens, each as `var()` of its primitive.
- `[data-theme]`: the composites, named `--elevation-1-raised`, `--elevation-2-overlay`, `--elevation-3-floating`, `--elevation-thumb` and `--glow-accent`. `--glow-accent` is also a Color token (the glow's color), so the composite needs a name of its own: write the color as the file names it and the composite as `--glow-accent-shadow`, and record that as a difference from `PROMPT.md` section 4.6. Grain/Coarse stays a comment.
- Text styles: one `--type-<style>` font shorthand and one `--type-<style>-tracking` per style, and one `.t-<style>` class each with `text-box: trim-both cap alphabetic`. Mono/Eyebrow is uppercase. There is no `.t-trim` class.
- Keep everything the check does today: the stale-file test, the theme-level shadow test, the bridge-redefines-a-token test. Update the header comments in the script and in the generated file.

Run `npm run tokens`. Then run `npm run tokens:check` and keep its output. It lists every theme-level declaration that now collides: the four names from section 4, any other name the new file shares with `socialpaint.css` or `theme.css`, and every line of the current `legacy-bridge.css` that redefines a name `tokens.css` now owns. Step 3 clears that list.

### Step 3: the bridge and one definition per token

Rewrite `src/styles/legacy-bridge.css` from `BRIDGE.md`. It becomes the single home of every older name that is still read:

- The earlier Figma names (`BRIDGE.md` section 2, "bridged"), each pointing at its new token.
- The earlier primitives still read by name (`--slime`, `--deep-moss`, `--lapis`, `--christina`, `--fire`, the inks and papers listed there).
- The first stylesheet's names it bridges today, repointed.
- Spacing by value (section 3) and radius by role (section 4).
- `--ease`, `--dur-state`, `--dur-panel` and `--font-ui`, as section 2 says. Keep the reduced-motion rule that zeroes the two durations, and add the same rule for `--motion-duration-fast`, `-base`, `-slow` and `-pulse`.
- `--focus-width: var(--stroke-focus)` and `--ring: var(--border-focus)`.

Names with no reader are not bridged. `BRIDGE.md` gives the counts. Before leaving one out, grep for it once more, in `src/` and in any string a `.ts` file builds (`platformPrimitive("--slime")` in `TemplateBuilder.tsx` is one).

Then clear the check's list:

- `--text-disabled` and `--font-mono`: delete the old declarations in `socialpaint.css`.
- `--border-control`: rename the old one to `--border-control-legacy` in both theme blocks and in its two readers.
- `--purple-kara`: rename the old one to `--purple-legacy` and repoint its readers, including `src/lib/celebrate.ts`.
- `theme.css`: delete the four `--radius-*` lines from `@theme inline`. Confirm first that no `.tsx` uses `rounded-sm`, `rounded-md`, `rounded-lg` or `rounded-xl`. If one does, stop and report it.
- Any other name on the list: the new token wins. Delete the older declaration if it played the same role. If it played a different one, rename it with a `-legacy` suffix and repoint its readers. Record each in the pull request.

Tidy the comments around what you delete, the way the earlier Phase 1 did: a comment that only described a deleted declaration goes, and no empty block is left behind. Run `npx prettier --write src/styles`.

`npm run tokens:check` passes. Snapshot and compare:

```bash
npm run shots -- props .shots/props-bridged.json --names .shots/props-before.json
npm run shots -- props-compare .shots/props-before.json .shots/props-bridged.json
```

Every changed value has to trace to a row of `BRIDGE.md` or of section 7 here. `--font-sans` and `--font-mono` must resolve to the private stacks at the root, not to Tailwind's defaults. `--radius-sm` must be 8px. Any value that changed and is not on a list means a declaration is being shadowed or a bridge line is wrong: find it before you go on.

`npm run verify` passes. Commit steps 1 to 3 together: "New brand phase 1: tokens from the new file".

### Step 4: focus

Focus is a 2 px ring, 2 px outside the element, on every interactive control.

- The global `:focus-visible` rule in `socialpaint.css` reads `outline: var(--stroke-focus) solid var(--border-focus); outline-offset: var(--focus-offset);`.
- Every other rule that reads `--focus-width` or `--ring` keeps working through the bridge and becomes 2 px. Leave those rules as they are. Rings that are drawn tight against an edge (`.ui-ring-tight`, `--focus-ring-tight`, chips, segments, tabs, rail items, the variation tile) stay tight in this phase and move 2 px out when Phase 2 rebuilds each component.
- Text fields take the ring now. `.ui-ring-none:focus-visible` in `primitives.css` stops suppressing the outline, and so does `.sp-input:focus-visible` in `socialpaint.css`. Remove the border recolor the older input does on focus, so the ring is the only focus signal.
- Leave every `outline: 2px solid transparent` alone. They are the forced-colors fallback behind box-shadow rings.
- A ring 2 px wide and 2 px out needs 4 px of room. The scroll containers that leave room for the ring leave exactly 4 (`PLAN.md`, "Clipping containers"). Tab through each one and confirm the ring is whole. Where a field sits against a clipping edge with less room, give the container the room, and list it.

`npm run verify` passes. Commit: "New brand phase 1: the 2 px focus ring".

### Step 5: text styles

The generator already wrote the twenty trimmed classes. This step moves the existing call sites without moving any layout (`BRIDGE.md` section 5, `PLAN.md` judgement call 7).

- Add the untrimmed twins to `legacy-bridge.css`: one `.tu-<style>` per new style a current call site needs, with `font: var(--type-<style>); letter-spacing: var(--type-<style>-tracking);` and, for Mono/Eyebrow, the uppercase. No `text-box`.
- Write the rename as a script under `scripts/` that you delete before the commit. It walks `src/**/*.{ts,tsx}` and rewrites whole class tokens only, in one pass, so that `t-body-s` to `tu-body-m` and `t-body-m` to its target cannot chain. It follows the table in `BRIDGE.md` section 5.
- Three old classes map to two possible styles: `.t-body-m` (5 uses), `.t-label-l` (14) and `.t-caption-m` (14). Read each call site against its frame and choose. List the 33 choices in the pull request.
- A call site that pairs a class with `.t-trim` today goes to the final trimmed `.t-<style>` and drops `.t-trim`. There are 17.
- The two CSS rules that read `--type-label-l` and `--type-mono-eyebrow` variables keep their names, which still exist.
- `src/app/dev/` (the `/dev/ui` sheet) is renamed like everything else. Phase 2 redraws it.
- Tests that assert on a class name follow the rename.

Then check what moved. Text may change size only on the rows of `BRIDGE.md` section 5 that say so. No text box may change height for any other reason: an untrimmed twin has the line height of its new style, and three line heights differ from before (Body/M is 20px where `.t-body-s` was 1.4, which is 19.6; the Label styles are a fixed 20, 18 or 16 where they were 1.25). Those are sub-pixel to 3 px shifts per line. Capture, compare, and list every screen where a block moved by more than a pixel.

`npm run verify` passes. Commit: "New brand phase 1: the twenty text styles".

### Step 6: docs

- `docs/design/new-look/README.md`, "Updating tokens": the file name and key, the three collections, the plugin's new counts.
- `docs/ARCHITECTURE.md`, Theming: the token source is the new file, and `legacy-bridge.css` now carries two generations of older names until this program's Phase 10.
- The header comment of `socialpaint.css`: replace the "NEW LOOK" paragraph with one that names the new file and `docs/design/new-brand/RULES.md`. Change nothing else in the header.
- `docs/design/new-brand/BRIDGE.md`: correct any row the code proved wrong, and add the names step 3 renamed.
- `docs/design/new-brand/PLAN.md`: mark Phase 1's status.

`npm run verify` passes. Commit: "New brand phase 1: docs".

### Step 7: the gate

1. `npm run verify` and `npm run build` pass.
2. Properties: `npm run shots -- props .shots/props-after.json --names .shots/props-before.json`, then `props-compare`. Every changed value is on section 7's list or traces to a `BRIDGE.md` row. Paste the full list into the pull request, grouped as section 7 groups it.
3. Screens: `npm run shots -- capture .shots/after`, then `compare .shots/before .shots/after .shots/diff`. Open the heatmaps. Changed pixels may sit on what section 7 describes and nowhere else. No block changes position by more than the line-height shifts step 5 listed.
4. Keyboard: on Brand Templates, the fill page, Generate, Settings › Workspace and the builder, in both themes, Tab through the page. Every control shows a 2 px ring, ink in Light and white in Dark. Text fields show it. No ring is cut by a container.
5. Sign in and onboarding stay Light, and their nested `[data-theme="light"]` resolves every new token.
6. Run the `fidelity-checker` subagent. Every fixture matches its baseline: no graphic changed.
7. Run the `phase-reviewer` subagent against this prompt, `RULES.md` and `CLAUDE.md`.
8. Open the pull request into `main`: "New brand, Phase 1: foundation". List what changed, the `compare` table, the properties list, every difference between the file and `PROMPT.md` section 4, every name step 3 renamed or deleted, and the 33 text style choices.

## 6. Out of scope

- Rebuilding any component, even where the new one is obviously different: the primary button's hover as its own token, disabled colors, the 28, 36 and 44 heights, the Segment at radius 4, Tabs as underlined text. Phase 2.
- Moving a tight ring 2 px out. Phase 2.
- The logo, the favicon, the covers and the sign-in art. Phases 3, 7 and 9.
- Any layout change, including shadow room. Phases 3 to 9.
- Renaming "look" anywhere.
- Deleting unread legacy tokens or control classes beyond what the token check forces. Phase 10.
- The rest of new-look Phase 9 (its steps 5 to 11). Steps 1 to 4 merged as #182, and `BRIDGE.md` was counted after it.

## 7. Expected changes

What the screenshots and `props-compare` should show. Values are the file's.

**Palette.** Every brand color moves to the new set: Slime `#17FF7E` to `#2BFFA3`, Deep Moss `#082A23` to `#123D34`, Lapis `#14E4FF` to `#6EBBFF`, Christina `#FF3FE5` to `#FF7FEE`, Fire `#FF3627` to `#FF6A57`, Violet `#A782FF` to `#B595FF`, and the deep, tint and wash families with them. Visible on chart series, status pills, the celebration burst, and anything in the builder that reads `--slime`.

**Primary action.** Light: Deep Moss under a Slime label becomes Slime under a black label. Dark: the label goes from Deep Moss to black. Hover is `--action-primary-hover`, a flat color.

**Red.** `#D43535` in Light and `#EC5656` in Dark both become `#FA3030`, on fills, text and outlines alike until Phase 2 splits them.

**Ink and text.** `--text-primary` in Light goes from `#272727` to `#0B0B0C`. `--text-muted` becomes `--text-secondary`: in Light, `#272727` at 70% becomes solid `#636363`, slightly lighter; in Dark, paper at 56% becomes `#A0A0A0`. Disabled text becomes a solid grey. Borders and hairlines take the `#0B0B0C` ink in Light and pure white alphas in Dark.

**Surfaces.** Light is unchanged. Dark: raised `#171819` to `#171817`, sunken and thumbs `#2F3133` to `#232425`, fields from paper 8% to white 10%.

**States.** `--state-selected` becomes a tint (ink 8%, white 10%) where it was a solid fill. Pressed deepens to 12% and 16%. An off switch's track gets darker.

**Status pills.** Active in Light goes from a Slime ground to the Lime tint under Deep Moss.

**Corners.** Controls 7 to 8, fields and large buttons 9 to 8, media plates 15 to 12, `--radius-xs` 2 to 4. Menus, cards and pills stay.

**Shadows.** Every elevation loses its sideways offset: 2/2 becomes 0/2, 4/4 becomes 0/4, 8/8 becomes 0/8. Menus and tooltips move to `--shadow-floating`, which is darker. The two hover lifts that used Elevation/Large drop to Overlay.

**Focus.** Every ring is 2 px. Text fields gain one and lose their focus border.

**Motion.** State transitions 140 ms to 120, panels 220 to 200. Not visible in a screenshot.

**Type.** Panel titles 17 to 18. Small buttons 12 to 13. The three sites under 11 grow to 11 or 12. The 33 sites step 5 chose individually. Label tracking drops from 1% to 0 on Label/M and Label/S. Line heights shift as step 5 describes.

**Unchanged.** Spacing, every layout, the sign-in and onboarding screens apart from the items above, every graphic, and every export.
