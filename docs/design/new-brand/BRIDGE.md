# New brand: the bridge

The platform reads three generations of token names today: the earliest stylesheet's own (`--bg-surface`, `--state-primary`), the earlier Figma file's (`--text-strong`, `--btn-primary-bg`, `--radius-control`), and from Phase 1 the new file's (`--action-primary`, `--radius-sm`, `--space-16`). Screens move to the new names one phase at a time. Until Phase 10 every older name keeps working through `src/styles/legacy-bridge.css`, which Phase 1 rewrites to point at the new tokens.

This file is the confirmed map. It was built in Phase 0 by counting every `var(--name)` read in `src/` (main at `0febeba`) and reading the rules behind the rows of `PROMPT.md` section 5. "Reads" is the number of `var()` uses outside `tokens.css`, then the number of files.

Rules that hold throughout:

- New code reads new names only.
- A bridged name has exactly one definition, in `legacy-bridge.css`. `npm run tokens:check` fails if another stylesheet declares it at theme level.
- A phase deletes the bridge lines its screens stop reading. Phase 10 deletes the file.
- The bridge is a holding state, not a design. Where a bridged value differs from what a rebuilt component will use, the component's row in `PROMPT.md` section 6 wins when its phase arrives.

## 1. What Phase 0 found wrong or missing in the starting map

These are the rows of `PROMPT.md` section 5 that the code or the file changes. Phase 1 builds what this file says.

1. **Four new names are already declared by `socialpaint.css` with other meanings.** Once `tokens.css` owns them, `tokens:check` fails on the old declarations, so Phase 1 has to delete or rename them first.

   | Name | Old meaning in `socialpaint.css` | Reads | Phase 1 |
   |---|---|---|---|
   | `--text-disabled` | Ink or paper at 25% alpha (lines 446, 605) | 19 in 10 files | Delete the old declarations. Readers take the new solid grey (`#A0A0A0` Light, `#636363` Dark), which is the role they already play |
   | `--border-control` | A solid ink or paper edge for outlined controls (lines 456, 615) | 2 in 1 file | Rename the old one to `--border-control-legacy` and repoint its two readers. The new token is ink at 45% for checkbox, radio and switch edges, a different role |
   | `--purple-kara` | `#9F60FF`, a bright purple (line 169) | 2 CSS reads and `celebrate.ts` | Rename the old one to `--purple-legacy` and repoint. The new primitive is the deep `#4B3383` |
   | `--font-mono` | The Geist Mono stack (line 198) | 24 in 15 files | Same role. Delete the old declaration and let `tokens.css` own it with the same stack |

2. **`--state-selected` keeps its name but not its job.** Today it is a solid fill (`#F9F9F8` Light, `#2F3133` Dark) for 4 reads. The new value is ink at 8% in Light and white at 10% in Dark. It still reads correctly on a raised surface, which is where all four readers sit, so it is owned by `tokens.css` with the new value and listed as an expected change.

3. **`--text-muted` and `--text-subtle` do have a match.** Section 5 says to decide per reader. The file's Docs page (Map, `2223:1066`) folds `text/secondary`, `text/muted` and `text/subtle` into `text/secondary`, one tone at `#636363`. `--text-subtle` has no readers. `--text-muted` has 96 reads in 34 files, and all of them are supporting text, none a disabled control. The bridge points both at `--text-secondary`.

4. **The text style classes are missing from the map, and same-named classes do not mean the same thing.** The new Body/S is 13, where today's `.t-body-s` is 14. Leaving class names alone would shrink every body text by a step. The file's own map moves each old style to a new style of a different name (section 5 below). Phase 1 renames call sites with a codemod, so no text changes size except where the file says it does.

5. **Trim by default cannot land in Phase 1 on the existing call sites.** The twenty new classes trim to cap height. About 320 call sites use a `.t-*` class today and 17 of them opt in to `.t-trim`. Turning trim on under all of them would shrink every text box (a Label/M line goes from 20 tall to 10) and move every layout before its screen is rebuilt. Phase 1 therefore generates the twenty classes trimmed, as the file has them, and gives existing call sites a bridged class that carries the new size without the trim (section 5). A screen takes the trimmed class when its phase rebuilds its layout.

6. **The radius row needs a holding value.** Section 5 says not to map radius by nearest value, and section 6 names each component's step. That decides what a rebuilt component uses. Until then the old names still need a value, and the file's Docs page gives one by role (section 4 below). Phase 2 then sets each primitive's radius from its own row.

7. **`--state-pressed` is 12% ink in Light, not 10%**, and `--state-hover` stays at 5%. Section 5 has this right. The earlier rules said 10%.

8. **`--elevation-small` and the others change shape, not only name.** The earlier drops were offset 2 right and 2 down. The new ones are offset 0 and 2, 4 or 8 down. Every card shadow moves on screen.

9. **`--switch-background`** is the earlier file's off-track token (`switch/track-off`, 3 reads). Section 5 names `--switch-track-off`, which never existed in code. The off state now comes from the Switch component: a `--border-control` edge on `--control-track`.

10. **Tailwind names.** `theme.css` declares `--radius-sm`, `--radius-md`, `--radius-lg` and `--radius-xl` inside `@theme inline` as steps off the old `--radius`, and Tailwind's own theme defines `--font-sans` and `--font-mono`. The new tokens use all six names. Tailwind's are emitted inside a cascade layer and `tokens.css` is unlayered, so the tokens win, and `@theme inline` utilities carry their value inline. Phase 1 confirms that with `shots props` instead of trusting it, and removes the four radius lines from `theme.css` (no TSX uses a `rounded-sm` to `rounded-xl` utility).

## 2. Color

### Names `tokens.css` owns under the same name

| Name | Reads | Change |
|---|---|---|
| `--surface-page` | 10 in 5 | None (`#F9F9F8`, `#0B0B0C`) |
| `--surface-raised` | 44 in 10 | Dark `#171819` → `#171817` |
| `--surface-sunken` | 54 in 12 | Dark `#2F3133` → `#232425` |
| `--surface-inverse` | 8 in 5 | None |
| `--text-primary` | 89 in 27 | Light `#272727` → `#0B0B0C`; Dark `#F1F1F1` → `#F1F1EF` |
| `--text-secondary` | 210 in 39 | None (`#636363`, `#A0A0A0`) |
| `--text-inverse` | 6 in 4 | None |
| `--border-strong` | 52 in 24 | Light `#272727` 16% → `#0B0B0C` 16%; Dark paper 20% → white 20% |
| `--border-raised` | 1 in 1 | Dark paper 20% → white 20% |
| `--state-hover` | 7 in 4 | None |
| `--state-pressed` | 1 in 1 | Light 10% → 12%; Dark 12% → 16% |
| `--state-selected` | 4 in 2 | Solid fill → ink 8% in Light, white 10% in Dark (finding 2) |
| `--control-track` | 2 in 2 | None |
| `--control-thumb` | 1 in 1 | Dark `#2F3133` → `#232425` |
| `--shadow-raised`, `--shadow-floating`, `--bevel-top`, `--bevel-bottom` | 3 in 2, then 0 | Dark top bevel white 15% → 16% |
| `--accent-green`, `-blue`, `-pink`, `-warm`, `-purple` | 8, 4, 3, 1, 4 | New palette: `#2BFFA3`, `#6EBBFF`, `#FF7FEE`, `#FF6A57`, `#B595FF` |
| `--tint-green` and the other four, `--wash-green`, `--wash-warm` | 1, then 0 | New palette |
| `--text-disabled`, `--border-control`, `--font-mono` | 19, 2, 24 | Finding 1 |
| `--radius-xs` | 7 in 4 | 2 → 4 |
| `--focus-offset` | 12 in 4 | None (2) |
| `--elevation-thumb` | 1 in 1 | Black 8% → `--shadow-thumb` (black 10% Light, 30% Dark) |

### Earlier Figma names, bridged

| Old name | Reads | Points at | Visible change |
|---|---|---|---|
| `--text-strong` | 112 in 10 | `--text-primary` | None in Light; Dark `#F1F1F1` → `#F1F1EF` |
| `--text-muted` | 96 in 34 | `--text-secondary` | Light `#272727` 70% → `#636363`; Dark paper 56% → `#A0A0A0` |
| `--text-subtle` | 0 | Not bridged | Deleted |
| `--text-on-fill` | 5 in 1 | `--text-on-color` | None |
| `--border-default` | 22 in 9 | `--border-subtle` | Ink tone only |
| `--input-bg` | 7 in 4 | `--surface-field` | Dark paper 8% → white 10% |
| `--overlay-scrim` | 1 in 1 | `--surface-scrim` | None |
| `--tag-overlay-bg` | 1 in 1 | `--surface-overlay` | None |
| `--overlay-hover` | 1 in 1 | `--state-pressed` | Deep Moss 35% dim → the pressed tint. The preview hover is rebuilt in Phases 4 and 5 |
| `--overlay-control`, `--overlay-control-fg` | 1, 1 | `--surface-raised`, `--text-primary` | The Edit button on a preview follows the theme in Dark |
| `--overlay-edge` | 1 in 1 | `--border-strong` | Holding value. No component uses the role in the new file |
| `--ring` | 24 in 7 | `--border-focus` | Light `#272727` → `#0B0B0C` |
| `--focus-width` | 18 in 4 | `--stroke-focus` | 1 → 2 on every ring |
| `--btn-primary-bg`, `--btn-primary-fg` | 5 in 4, 4 in 3 | `--action-primary`, `--action-on-primary` | Light: Deep Moss under Slime → Slime under black. Dark: label Deep Moss → black |
| `--btn-primary-bg-hover` | 2 in 1 | `--action-primary-hover` | A color in place of a tint layer. Its two readers set `background`, so a plain color works |
| `--state-error` | 19 in 6 | `--feedback-error` | `#D43535` and `#EC5656` → `#FA3030` in both themes. Phase 2 splits its readers: fills to `--action-danger`, text to `--feedback-error-text`, grounds to `--feedback-error-surface` |
| `--state-danger`, `--state-danger-on-surface` | 6 in 3, 4 in 2 | `--feedback-error` | The same |
| `--state-hover-inverse`, `--state-pressed-inverse` | 5 in 2, 2 in 1 | `--state-hover`, `--state-pressed` | Holding value. Their readers are the primary button, Attach and the on switch, which Phase 2 moves to `--action-*-hover` and `-pressed` |
| `--state-hover-on-color`, `--state-pressed-on-color` | 2 in 1, 2 in 1 | `--state-hover`, `--state-pressed` | Holding value. Send and Destructive take their own tokens in Phase 2 |
| `--state-selection` | 2 in 1 | `--editor-selection` | None (`#0D99FF`) |
| `--control-fill` | 9 in 2 | `--surface-sunken` | Dark `#171819` → `#232425`. The Docs map names `action/neutral` for buttons; the nine readers are rail and filter grounds, where sunken is the nearer role until Phase 2 |
| `--switch-track-on` | 1 in 1 | `--control-on` | Dark `#F1F1F1` → `#F1F1EF` |
| `--switch-background` | 3 in 3 | `--border-control` | Off track gets darker (finding 9) |
| `--status-active-bg`, `--status-active-fg` | 1, 1 | `--status-active-surface`, `--status-active-text` | Light: Slime ground → Lime tint |
| `--status-positive-bg` | 1 in 1 | `--status-positive-surface` | New Deep Moss |
| `--chip-selected-bg` | 2 in 1 | `--surface-inverse` | Dark `#2F3133` → white. Platform chips are rebuilt in Phase 2 |
| `--chip-selected-tile` | 1 in 1 | `--state-selected` | Holding value |
| `--chip-tile` | 2 in 2 | `--action-neutral` | Dark `#0B0B0C` → white 10% |
| `--tag-detail-fg` | 1 in 1 | `--text-secondary` | Holding value |
| `--tag-sent-bg`, `--tag-sent-fg`, `--tag-sent-border` | 1, 1, 1 | `--status-neutral-surface`, `--text-primary`, `--border-subtle` | A sent detail becomes a Tag in Phase 2 |
| `--field-green`, `-blue`, `-pink`, `-warm`, `-purple` | 3, 1, 1, 0, 1 | `--deep-green` and the other four | New palette |
| `--accent-green-subtle`, `--accent-green-glow` | 0, 0 | Not bridged | Deleted. `--glow-hint` has no readers either |
| `--elevation-small` | 29 in 7 | `--elevation-1-raised` | Drop 2/2 blur 8 → 0/2 blur 8 |
| `--elevation-medium` | 6 in 3 | `--elevation-2-overlay` | Drop 4/4 blur 16 on `--shadow-raised` → 0/4 blur 16 on `--shadow-floating` |
| `--elevation-large` | 2 in 2 | `--elevation-2-overlay` | 6/6 blur 25 → 0/4 blur 16. No match in the file; both readers are hover lifts that Phases 4 and 5 remove |
| `--elevation-floating` | 1 in 1 | `--elevation-3-floating` | 8/8 → 0/8, blur 32 |

### Earlier primitives still read by name

Components were never meant to read these, but `socialpaint.css` and three TS files do. They are bridged so the brand moments follow the new palette.

| Old name | Reads | Points at |
|---|---|---|
| `--slime` | 24 in 2, plus `platformIcons.tsx`, `celebrate.ts`, `TemplateBuilder.tsx` | `--green-slime` |
| `--deep-moss` | 2 in 1 | `--green-deep-moss` |
| `--lapis` (and `--aqua`, which aliases it, 5 in 2) | 2 in 1 | `--blue-lapis` |
| `--christina` | 1 in 1 | `--pink-christina` |
| `--fire` | 4 in 1 | `--warm-fire` |
| `--ink-900`, `--ink-800`, `--ink-700` | 5, 1, 2 | `--neutral-900`, `--neutral-800`, `--neutral-700` |
| `--paper-050`, `--paper-100` | 4, 2 | `--neutral-50`, `--neutral-200` |

Every other earlier primitive has no reader outside `tokens.css` and is not bridged.

### The first stylesheet's names

`legacy-bridge.css` bridges these today. They stay bridged, repointed one step further.

| Old name | Reads | Points at |
|---|---|---|
| `--bg-canvas` | 15 in 6 | `--surface-page` |
| `--bg-surface`, `--bg-card` | 53 in 23, 5 in 1 | `--surface-raised` |
| `--text-heading` | 1 in 1 | `--text-primary` |
| `--border` | 59 in 21 | `--border-subtle` |
| `--gen-sunken`, `--gen-inverse`, `--gen-on-inverse` | 2, 2, 1 | `--surface-sunken`, `--surface-inverse`, `--text-inverse` |
| `--fill-action`, `--text-on-action` | 4 in 3, 7 in 5 | `--surface-inverse`, `--text-inverse` |
| `--shadow-card`, `--shadow-rail` | 2 in 1, 0 | The drop of Elevation/1 Raised: `0 2px 8px 0 var(--shadow-raised)` |

### Left on their old values until their screens move

These play several roles or belong to one screen, exactly as `docs/design/new-look/BRIDGE.md` section 3 left them. Their values contain the old palette only where noted, and the phase named removes them.

| Names | Reads | Phase |
|---|---|---|
| `--state-primary` | 45 in 18 | Slime in Dark and `#272727` in Light, through `--slime`, so it follows the bridge. Readers move per area in Phases 4 to 9 |
| `--bg-hover`, `--bg-raised`, `--bg-plate` | 30 in 13, 12 in 5, 4 in 2 | Per area, 4 to 9 |
| `--editor-accent`, `--editor-line`, `--editor-handle`, `--editor-artboard-edge`, `--editor-pasteboard` | 22, 14, 4, 1, 1 | 6. `--editor-accent` becomes `--editor-selection` |
| `--nav-active-bg`, `--nav-active-fg`, `--nav-hover-bg`, `--nav-hover-fg` | 6, 6, 5, 5 | 6 |
| `--edge-*`, `--card-*`, `--chip-*` (the stylesheet's own), `--shadow-rest`, `--shadow-card-hover`, `--radius-control-lg`, `--radius-media`, `--radius-media-inner`, `--radius-tag` | 1 to 11 each | 6 |
| `--start-*` | 10 names, 1 each | 6 |
| `--gen-fade`, `--gen-fade-h`, `--gen-marker-*`, `--gen-h-tag` | 1 to 3 each | 5 |
| `--sb-*`, `--chrome-top`, `--page-pad`, `--page-max` | 2 to 8 each | 3 |
| `--state-warning`, `--fill-warning`, `--fill-attention`, `--danger-wash`, `--accent-wash` | 1 to 7 each | 2, onto `--feedback-warning-*` and `--feedback-error-surface` |
| `--viz-series-1` to `-4` | 1 each | 8 |
| `--ease`, `--dur-state`, `--dur-panel` | 63 in 7, 58 in 6, 8 in 4 | Bridged in Phase 1 to `--motion-easing-standard`, `--motion-duration-fast` (140 → 120 ms) and `--motion-duration-base` (220 → 200 ms). The reduced-motion override that zeroes them stays |
| `--type-caption-size`, `--type-label-size`, `--type-cardtitle-size` and the rest of the stylesheet's type variables | 79 in 25, 43 in 20, 14 in 8 | Per area, 4 to 9. Their values (12, 13, 17) are untouched in Phase 1 |
| `--font-ui`, `--font-head`, `--font-body`, `--weight-ui`, `--weight-head`, `--track-head` | 25, 15, 2, 15, 15, 16 | `--font-ui` is bridged to `--font-sans`. The rest go in Phase 10 |

## 3. Spacing

Bridged by value. Nothing moves.

| Old | Reads | New |
|---|---|---|
| `--space-3xs` | 57 in 16 | `--space-4` |
| `--space-2xs` | 174 in 25 | `--space-8` |
| `--space-xs` | 106 in 25 | `--space-12` |
| `--space-sm` | 129 in 13 | `--space-16` |
| `--space-md` | 78 in 17 | `--space-24` |
| `--space-lg` | 19 in 9 | `--space-32` |
| `--space-xl` | 16 in 6 | `--space-48` |
| `--space-2xl` | 4 in 2 | `--space-64` |
| `--space-3xl` | 4 in 4 | `--space-96` |

`--space-2`, `-6`, `-20` and `-40` are new steps. The file's map for values typed by hand: 9 and 10 become 8 (or 12 where it is padding), 13 and 14 become 12, 18 becomes 16 (or 20 on card padding), 45 becomes 48.

## 4. Radius

Holding values, by the role each old token played (the file's Docs map). A rebuilt component takes the step its row in `PROMPT.md` section 6 names, which is not always this one: a Segment is `--radius-xs`, Upload and Alert are `--radius-md`.

| Old | Reads | Holds at | Shift |
|---|---|---|---|
| `--radius-control` (7) | 100 in 32 | `--radius-sm` (8) | +1 |
| `--radius-menu-item` (7) | 1 in 1 | `--radius-sm` (8) | +1 |
| `--radius-control-md` (9) | 21 in 6 | `--radius-sm` (8) | -1 |
| `--radius-media-plate` (15) | 16 in 7 | `--radius-md` (12) | -3 |
| `--radius-menu` (16) | 6 in 4 | `--radius-lg` (16) | None |
| `--radius-card` (20) | 47 in 20 | `--radius-xl` (20) | None |
| `--radius-pill` (999) | 44 in 14 | `--radius-full` (999) | None |

`--radius` in `theme.css` follows `--radius-control`, so shadcn controls move from 7 to 8.

## 5. Text styles

The earlier file had 31 classes and the new one has 20. Phase 1 renames call sites by this map, which is the file's own (Docs, Map). Counts are uses in `.ts` and `.tsx`, then files.

| Old class | Uses | New style | Size |
|---|---|---|---|
| `.t-title-display` | 0 | Title/Display | 44, same |
| `.t-title-metric` | 3 in 3 | Title/Metric | 40, same |
| `.t-title-page` | 6 in 5 | Title/Page | 30, same |
| `.t-title-section` | 1 in 1 | Title/Section | 24, same |
| `.t-title-group` | 1 in 1 | Title/Group | 20, same |
| `.t-title-card` | 4 in 3 | Title/Card | 18, same |
| `.t-title-panel` | 13 in 9 | Title/Card | 17 → 18 |
| `.t-body-l` | 3 in 3 | Body/L | 16, same. Line height 1.5 → 24px, the same |
| `.t-body-m` | 5 in 4 | Body/L in the chats, Body/M elsewhere | 15 → 16 or 14. Read each of the five |
| `.t-body-s` | 51 in 30 | Body/M | 14, same. Line height 1.4 → 20px |
| `.t-body-xs` | 5 in 4 | Body/S | 13, same |
| `.t-label-l` | 14 in 12 | Label/M, or Label/L where a frame emphasises the row | 15 → 14 or 16. Read each of the fourteen |
| `.t-label-m` | 31 in 20 | Label/M | 14, same. Tracking 1% → 0 |
| `.t-label-s` | 14 in 9 | Label/S | 13, same. Tracking 1% → 0 |
| `.t-label-xs` | 46 in 25 | Label/XS | 12, same |
| `.t-label-xxs` | 1 in 1 | Label/XS | 10 → 12 |
| `.t-button-m`, `.t-control-m` | 9 in 8, 2 in 2 | Label/M | 14, same |
| `.t-button-s` | 5 in 4 | Label/S | 12 → 13 |
| `.t-control-s` | 2 in 2 | Label/S | 13, same |
| `.t-caption-m` | 14 in 10 | Body/S, or Caption/M where a frame sets a meta line at 12 | 13 → 13 or 12. Read each of the fourteen |
| `.t-caption-s` | 66 in 35 | Caption/M | 12, same |
| `.t-caption-xs` | 3 in 3 | Caption/S | 11, same |
| `.t-caption-xxs` | 1 in 1 | Caption/S | 9 → 11 |
| `.t-mono-display`, `.t-mono-m`, `.t-mono-code` | 0 | The same names | Same |
| `.t-mono-s` | 2 in 2 | Mono/S | 12, same |
| `.t-mono-xs`, `.t-mono-xxs` | 0 | Mono/S or Mono/Eyebrow | No call sites |
| `.t-mono-eyebrow` | 1 in 1, plus 2 CSS reads of its variable | Mono/Eyebrow | 10 → 11 |
| `.t-trim` | 17 in 6 | Nothing. Every style trims | Removed as each call site is rebuilt |

How Phase 1 lands this without moving layouts (finding 5):

- `tokens.css` defines the twenty classes under their final names, trimmed.
- `legacy-bridge.css` defines one untrimmed twin per new style a current call site needs, named `.tu-*` (`.tu-body-m`, `.tu-label-m`, `.tu-caption-m` and so on): the same font shorthand and tracking variables, no `text-box`.
- The codemod renames every existing `.t-*` use to the `.tu-*` twin of its new style from the table. A call site that already pairs with `.t-trim` goes straight to the final trimmed class and drops `.t-trim`.
- From Phase 2 on, a rebuilt component or screen uses the final `.t-*` classes. Phase 10 deletes the `.tu-*` twins, and a grep for `tu-` is that phase's check that no text was left untrimmed.

The only type that changes size in Phase 1 is on the rows above that say so: panel titles 17 → 18, the five `.t-body-m` and fourteen `.t-label-l` and `.t-caption-m` sites as read, small buttons 12 → 13, and the three sites under 11.

## 6. Control classes

Not tokens, but the same kind of debt. These are the earlier control families that `docs/design/new-look/PLAN.md` Phase 9 was to delete. `PLAN.md` in this folder says which phase removes each, with the count of files still reading them.
