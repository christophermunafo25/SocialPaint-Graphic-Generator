# New brand: the bridge

The platform reads three generations of token names today: the earliest stylesheet's own (`--bg-surface`, `--state-primary`), the earlier Figma file's (`--text-strong`, `--btn-primary-bg`, `--radius-control`), and from Phase 1 the new file's (`--action-primary`, `--radius-sm`, `--space-16`). Screens move to the new names one phase at a time. Until Phase 10 every older name keeps working through `src/styles/legacy-bridge.css`, which Phase 1 rewrites to point at the new tokens.

This file is the confirmed map. It was built in Phase 0 by counting every `var(--name)` read in `src/` (main at `ab8a9f5`, after #182 merged) and reading the rules behind the rows of `PROMPT.md` section 5. "Reads" is the number of `var()` uses outside `tokens.css`, then the number of files.

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
   | `--purple-kara` | `#9F60FF`, a bright purple (line 169) | 1 CSS read and `celebrate.ts` | Rename the old one to `--purple-legacy` and repoint. The new primitive is the deep `#4B3383` |

   Phase 1 built this as written. `--border-control-legacy` and `--purple-legacy` are declared in `socialpaint.css` and are not bridged: they keep their old values until Phase 6 removes their readers.
   | `--font-mono` | The Geist Mono stack (line 198) | 24 in 15 files | Same role. Delete the old declaration and let `tokens.css` own it with the same stack |

2. **`--state-selected` keeps its name but not its job.** Today it is a solid fill (`#F9F9F8` Light, `#2F3133` Dark) for 4 reads. The new value is ink at 8% in Light and white at 10% in Dark. It still reads correctly on a raised surface, which is where all four readers sit, so it is owned by `tokens.css` with the new value and listed as an expected change.

3. **`--text-muted` and `--text-subtle` do have a match.** Section 5 says to decide per reader. The file's Docs page (Map, `2223:1066`) folds `text/secondary`, `text/muted` and `text/subtle` into `text/secondary`, one tone at `#636363`. `--text-subtle` has no readers. `--text-muted` has 89 reads in 33 files, and all of them are supporting text, none a disabled control. The bridge points both at `--text-secondary`.

4. **The text style classes are missing from the map, and same-named classes do not mean the same thing.** The new Body/S is 13, where today's `.t-body-s` is 14. Leaving class names alone would shrink every body text by a step. The file's own map moves each old style to a new style of a different name (section 5 below). Phase 1 renames call sites with a codemod, so no text changes size except where the file says it does.

5. **Trim by default cannot land in Phase 1 on the existing call sites.** The twenty new classes trim to cap height. About 355 call sites use a `.t-*` class today and 17 of them opt in to `.t-trim`. Turning trim on under all of them would shrink every text box (a Label/M line goes from 20 tall to 10) and move every layout before its screen is rebuilt. Phase 1 therefore generates the twenty classes trimmed, as the file has them, and gives existing call sites a bridged class that carries the new size without the trim (section 5). A screen takes the trimmed class when its phase rebuilds its layout.

6. **The radius row needs a holding value.** Section 5 says not to map radius by nearest value, and section 6 names each component's step. That decides what a rebuilt component uses. Until then the old names still need a value, and the file's Docs page gives one by role (section 4 below). Phase 2 then sets each primitive's radius from its own row.

7. **`--state-pressed` is 12% ink in Light, not 10%**, and `--state-hover` stays at 5%. Section 5 has this right. The earlier rules said 10%.

8. **`--elevation-small` and the others change shape, not only name.** The earlier drops were offset 2 right and 2 down. The new ones are offset 0 and 2, 4 or 8 down. Every card shadow moves on screen.

9. **`--switch-background`** is the earlier file's off-track token (`switch/track-off`, 3 reads). Section 5 names `--switch-track-off`, which never existed in code. The off state now comes from the Switch component: its track filled with `--border-control` (Phase 2 read this from the file; an earlier version of this line said an edge on `--control-track`).

10. **Tailwind names.** `theme.css` declares `--radius-sm`, `--radius-md`, `--radius-lg` and `--radius-xl` inside `@theme inline` as steps off the old `--radius`, and Tailwind's own theme defines `--font-sans` and `--font-mono`. The new tokens use all six names. Tailwind's are emitted inside a cascade layer and `tokens.css` is unlayered, so the tokens win, and `@theme inline` utilities carry their value inline. Phase 1 confirms that with `shots props` instead of trusting it, and removes the four radius lines from `theme.css` (no TSX uses a `rounded-sm` to `rounded-xl` utility).

## 2. Color

### Names `tokens.css` owns under the same name

| Name | Reads | Change |
|---|---|---|
| `--surface-page` | 10 in 5 | None (`#F9F9F8`, `#0B0B0C`) |
| `--surface-raised` | 44 in 10 | Dark `#171819` → `#171817` |
| `--surface-sunken` | 56 in 13 | Dark `#2F3133` → `#232425` |
| `--surface-inverse` | 8 in 5 | None |
| `--text-primary` | 73 in 24 | Light `#272727` → `#0B0B0C`; Dark `#F1F1F1` → `#F1F1EF` |
| `--text-secondary` | 201 in 37 | None (`#636363`, `#A0A0A0`) |
| `--text-inverse` | 6 in 4 | None |
| `--border-strong` | 47 in 22 | Light `#272727` 16% → `#0B0B0C` 16%; Dark paper 20% → white 20% |
| `--border-raised` | 1 in 1 | Dark paper 20% → white 20% |
| `--state-hover` | 7 in 4 | None |
| `--state-pressed` | 1 in 1 | Light 10% → 12%; Dark 12% → 16% |
| `--state-selected` | 4 in 2 | Solid fill → ink 8% in Light, white 10% in Dark (finding 2) |
| `--control-track` | 2 in 2 | None |
| `--control-thumb` | 1 in 1 | Dark `#2F3133` → `#232425` |
| `--shadow-raised`, `--shadow-floating`, `--bevel-top`, `--bevel-bottom` | 2 in 2, then 0 | Dark top bevel white 15% → 16% |
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
| `--text-muted` | 89 in 33 | `--text-secondary` | Light `#272727` 70% → `#636363`; Dark paper 56% → `#A0A0A0` |
| `--text-subtle` | 0 | Not bridged | Deleted |
| `--text-on-fill` | 5 in 1 | `--text-on-color` | None |
| `--border-default` | 27 in 10 | `--border-subtle` | Ink tone only |
| `--input-bg` | 7 in 4 | `--surface-field` | Dark paper 8% → white 10% |
| ~~`--overlay-scrim`~~ | 0 | Removed in Phase 2 | The Dialog reads `--surface-scrim` |
| ~~`--tag-overlay-bg`~~ | 0 | Removed in Phase 2 | The Overlay Tag reads `--surface-overlay` |
| `--overlay-hover` | 1 in 1 | `--state-pressed` | Deep Moss 35% dim → the pressed tint. The preview hover is rebuilt in Phases 4 and 5 |
| `--overlay-control`, `--overlay-control-fg` | 1, 1 | `--surface-raised`, `--text-primary` | The Edit button on a preview follows the theme in Dark |
| `--overlay-edge` | 1 in 1 | `--border-strong` | Holding value. No component uses the role in the new file |
| `--ring` | 23 in 7 | `--border-focus` | Light `#272727` → `#0B0B0C` |
| `--focus-width` | 15 in 4 | `--stroke-focus` | 1 → 2 on every ring |
| `--btn-primary-bg`, `--btn-primary-fg` | 5 in 4, 4 in 3 | `--action-primary`, `--action-on-primary` | Light: Deep Moss under Slime → Slime under black. Dark: label Deep Moss → black |
| `--btn-primary-bg-hover` | 2 in 1 | `--action-primary-hover` | A color in place of a tint layer. Its two readers set `background`, so a plain color works |
| `--state-error` | 14 in 5 | `--feedback-error` | `#D43535` and `#EC5656` → `#FA3030` in both themes. Phase 2 moved the primitives onto the split roles: fills to `--action-danger`, text to `--feedback-error-text`, a field's edge to `--feedback-error`, grounds to `--feedback-error-surface`. The readers left are page rules and the Composer, which move with their screens |
| `--state-danger`, `--state-danger-on-surface` | 4 in 1, 4 in 2 | `--feedback-error` | The same |
| ~~`--state-hover-inverse`, `--state-pressed-inverse`~~ | 0 | Removed in Phase 2 | The primary button reads `--action-primary-hover` and `-pressed`. Attach is a Filled icon button and the switch has no fill state |
| ~~`--state-hover-on-color`, `--state-pressed-on-color`~~ | 0 | Removed in Phase 2 | Send reads `--action-accent-hover` and `-pressed`, Destructive `--action-danger-hover` and `-pressed` |
| `--state-selection` | 2 in 1 | `--editor-selection` | None (`#0D99FF`) |
| ~~`--control-fill`~~ | 0 | Removed in Phase 4, with its last readers: the Platform chip and the library's chips |
| ~~`--switch-track-on`~~ | 0 | Removed in Phase 2 | The Switch reads `--control-on` |
| `--switch-background` | 1 in 1 | `--border-control` | The shadcn theme's switch token in `theme.css`. The Switch itself fills its off track with `--border-control` (finding 9, corrected in section 6) |
| ~~`--status-active-bg`, `--status-active-fg`~~ | 0 | Removed in Phase 2 | The Badge reads `--status-active-surface` and `--status-active-text` |
| ~~`--status-positive-bg`~~ | 0 | Removed in Phase 2 | The Badge reads `--status-positive-surface` |
| ~~`--chip-selected-bg`, `--chip-selected-tile`~~ | 0 | Removed in Phase 4: the rebuilt Platform chip reads `--surface-inverse` and `--surface-raised` |
| `--chip-tile` | 2 in 2 | `--action-neutral` | Dark `#0B0B0C` → white 10% |
| ~~`--tag-detail-fg`~~ | 0 | Removed in Phase 2 | An editable detail is a Chip |
| ~~`--tag-sent-bg`, `--tag-sent-fg`, `--tag-sent-border`~~ | 0 | Removed in Phase 2 | A sent detail is a Default Tag |
| `--field-green`, `-blue`, `-pink`, `-warm`, `-purple` | 3, 1, 1, 0, 1 | `--deep-green` and the other four | New palette |
| `--accent-green-subtle`, `--accent-green-glow` | 0, 0 | Not bridged | Deleted. `--glow-hint` has no readers either |
| `--elevation-small` | 29 in 7 | `--elevation-1-raised` | Drop 2/2 blur 8 → 0/2 blur 8 |
| `--elevation-medium` | 6 in 3 | `--elevation-2-overlay` | Drop 4/4 blur 16 on `--shadow-raised` → 0/4 blur 16 on `--shadow-floating` |
| ~~`--elevation-large`~~ | 0 | Removed in Phase 5, with its last reader: the Recent and History cards' hover lift | Hover keeps the card's Elevation/1 (`RULES.md` section 6) |
| `--elevation-floating` | 1 in 1 | `--elevation-3-floating` | 8/8 → 0/8, blur 32 |

### Earlier primitives still read by name

Components were never meant to read these, but `socialpaint.css` and three TS files do. They are bridged so the brand moments follow the new palette.

| Old name | Reads | Points at |
|---|---|---|
| `--slime` | 17 in 2, plus `platformIcons.tsx`, `celebrate.ts`, `TemplateBuilder.tsx` | `--green-slime` |
| `--deep-moss` | 1 in 1 | `--green-deep-moss` |
| `--lapis` (and `--aqua`, which aliases it, 5 in 2) | 1 in 1 | `--blue-lapis` |
| `--fire` | 3 in 1 | `--warm-fire` |
| `--ink-900`, `--ink-800`, `--ink-700` | 5, 1, 2 | `--neutral-900`, `--neutral-800`, `--neutral-700` |
| `--paper-050`, `--paper-100` | 4, 2 | `--neutral-50`, `--neutral-200` |

Every other earlier primitive has no reader outside `tokens.css` and is not bridged.

### The first stylesheet's names

`legacy-bridge.css` bridges these today. They stay bridged, repointed one step further.

| Old name | Reads | Points at |
|---|---|---|
| `--bg-canvas` | 14 in 6 | `--surface-page` |
| `--bg-surface`, `--bg-card` | 46 in 20, 5 in 1 | `--surface-raised` |
| `--text-heading` | 1 in 1 | `--text-primary` |
| `--border` | 48 in 18 | `--border-subtle` |
| `--gen-sunken` | 1 in 1 | `--surface-sunken` |
| ~~`--gen-inverse`, `--gen-on-inverse`~~ | 0 | Removed in Phase 2. Progress reads `--text-primary` on `--surface-field` |
| `--fill-action`, `--text-on-action` | 4 in 3, 7 in 5 | `--surface-inverse`, `--text-inverse` |
| `--shadow-card` | 2 in 1 | The drop of Elevation/1 Raised: `0 2px 8px 0 var(--shadow-raised)` |

### Left on their old values until their screens move

These play several roles or belong to one screen, exactly as `docs/design/new-look/BRIDGE.md` section 3 left them. Their values contain the old palette only where noted, and the phase named removes them.

| Names | Reads | Phase |
|---|---|---|
| `--state-primary` | 36 in 15 | Slime in Dark and `#272727` in Light, through `--slime`, so it follows the bridge. Readers move per area in Phases 4 to 9 |
| `--bg-hover`, `--bg-raised`, `--bg-plate` | 25 in 12, 12 in 5, 4 in 2 | Per area, 4 to 9 |
| `--editor-accent`, `--editor-line`, `--editor-handle`, `--editor-artboard-edge` | 22, 14, 4, 1 | 6. `--editor-accent` becomes `--editor-selection`. Phase 6b removed `--editor-pasteboard`: the stage is the pasteboard |
| `--nav-active-bg`, `--nav-active-fg`, `--nav-hover-bg`, `--nav-hover-fg` | 6, 6, 5, 5 | 6 |
| `--edge-*`, `--card-*`, `--chip-*` (the stylesheet's own), `--shadow-rest`, `--radius-media`, `--radius-media-inner`, `--radius-tag` | 1 to 11 each | 6b. Phase 6a removed `--shadow-card-hover`, `--radius-control-lg` and `--edge-alpha-hover`, whose last readers were the earlier list card and size gallery |
| ~~`--start-*`~~ | 0 | Removed in Phase 6a with the builder's start screen, their only reader |
| ~~`--gen-fade`, `--gen-fade-h`~~ | 0 | Removed in Phase 5. The chats' scroll fade reads `--surface-page`, and each chat scroller sets its fade heights (`--chat-fade-top`, `--chat-fade-bottom`), which its scroll padding reads too |
| `--gen-marker-*`, `--gen-h-tag` | 1 to 3 each | Cleanup: only the hidden template chat's Missing markers read them |
| ~~`--sb-bg`, `--sb-border`, `--sb-fg-active`~~ | 0 | Removed in Phase 3. The mobile bar reads `--surface-raised`, `--border-subtle` and `--text-primary` |
| `--chrome-top` | 4 in 4 | Not a bridge: the shell's own measure, defined in `shell.css` since Phase 3. The mobile bar's height below 1024 (0 beside the rail). The frame's narrow minimum height, the Brand Templates and Template Builder filter bars below 1024 and Generate's editor sheet offset from it. Stays while the mobile bar does |
| `--page-pad` | 10 in 3 | Not a bridge: the shell's own measure, defined in `shell.css` since Phase 3 on `--space-48`, `-32`, `-24` and `-16` by width. The frame's header row and footer read it below 1024. Its other readers go with their screens: the public link page's column (Phase 4), Generate's thread and History, which reach into Main's gutters by it at 32 (Phase 5), and the pre-app shell (`auth.css`, Phase 9) |
| ~~`--page-max`~~ | 0 | Removed in Phase 4: the public link page's column caps itself (`.sp-public__column`, 1720). The app frame has no cap |
| `--state-warning`, `--fill-warning`, `--fill-attention`, `--danger-wash`, `--accent-wash` | 1 to 6 each | With each screen that moves its alert blocks onto the Alert, which reads `--feedback-warning-*` and `--feedback-error-surface`. Phase 2 built the Alert and moved no page onto it. Most readers are in the builder (Phase 6) |
| `--ease`, `--dur-state`, `--dur-panel` | 54 in 6, 58 in 6, 8 in 4 | Bridged in Phase 1 to `--motion-easing-standard`, `--motion-duration-fast` (140 → 120 ms) and `--motion-duration-base` (220 → 200 ms). The reduced-motion override that zeroes them stays |
| `--type-caption-size`, `--type-label-size`, `--type-cardtitle-size` and the rest of the stylesheet's type variables | 67 in 21, 43 in 20, 14 in 8 | Per area, 4 to 9. Their values (12, 13, 17) are untouched in Phase 1 |
| `--font-ui`, `--font-head`, `--font-body`, `--weight-ui`, `--weight-head`, `--track-head` | 25, 15, 2, 15, 15, 16 | `--font-ui` is bridged to `--font-sans`. The rest go in Phase 10 |

## 3. Spacing

Bridged by value. Nothing moves.

| Old | Reads | New |
|---|---|---|
| `--space-3xs` | 55 in 16 | `--space-4` |
| `--space-2xs` | 167 in 25 | `--space-8` |
| `--space-xs` | 99 in 25 | `--space-12` |
| `--space-sm` | 119 in 13 | `--space-16` |
| `--space-md` | 69 in 17 | `--space-24` |
| `--space-lg` | 18 in 9 | `--space-32` |
| `--space-xl` | 15 in 6 | `--space-48` |
| `--space-2xl` | 4 in 2 | `--space-64` |
| `--space-3xl` | 4 in 4 | `--space-96` |

`--space-2`, `-6`, `-20` and `-40` are new steps. The file's map for values typed by hand: 9 and 10 become 8 (or 12 where it is padding), 13 and 14 become 12, 18 becomes 16 (or 20 on card padding), 45 becomes 48.

## 4. Radius

Holding values, by the role each old token played (the file's Docs map). A rebuilt component takes the step its row in `PROMPT.md` section 6 names, which is not always this one: a Segment is `--radius-xs`, Upload and Alert are `--radius-md`.

| Old | Reads | Holds at | Shift |
|---|---|---|---|
| `--radius-control` (7) | 94 in 31 | `--radius-sm` (8) | +1 |
| `--radius-menu-item` (7) | 1 in 1 | `--radius-sm` (8) | +1 |
| `--radius-control-md` (9) | 22 in 7 | `--radius-sm` (8) | -1 |
| `--radius-media-plate` (15) | 16 in 7 | `--radius-md` (12) | -3 |
| `--radius-menu` (16) | 6 in 4 | `--radius-lg` (16) | None |
| `--radius-card` (20) | 42 in 16 | `--radius-xl` (20) | None |
| `--radius-pill` (999) | 43 in 13 | `--radius-full` (999) | None |

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
| `.t-title-card` | 5 in 4 | Title/Card | 18, same |
| `.t-title-panel` | 13 in 9 | Title/Card | 17 → 18 |
| `.t-body-l` | 3 in 3 | Body/L | 16, same. Line height 1.5 → 24px, the same |
| `.t-body-m` | 5 in 4 | Body/L in the chats, Body/M elsewhere | 15 → 16 or 14. Read each of the five |
| `.t-body-s` | 54 in 32 | Body/M | 14, same. Line height 1.4 → 20px |
| `.t-body-xs` | 23 in 6 | Body/S | 13, same |
| `.t-label-l` | 14 in 12 | Label/M, or Label/L where a frame emphasises the row | 15 → 14 or 16. Read each of the fourteen |
| `.t-label-m` | 37 in 22 | Label/M | 14, same. Tracking 1% → 0 |
| `.t-label-s` | 17 in 10 | Label/S | 13, same. Tracking 1% → 0 |
| `.t-label-xs` | 46 in 25 | Label/XS | 12, same |
| `.t-label-xxs` | 1 in 1 | Label/XS | 10 → 12 |
| `.t-button-m`, `.t-control-m` | 9 in 8, 2 in 2 | Label/M | 14, same |
| `.t-button-s` | 5 in 4 | Label/S | 12 → 13 |
| `.t-control-s` | 2 in 2 | Label/S | 13, same |
| `.t-caption-m` | 14 in 10 | Body/S, or Caption/M where a frame sets a meta line at 12 | 13 → 13 or 12. Read each of the fourteen |
| `.t-caption-s` | 66 in 35 | Caption/M | 12, same |
| `.t-caption-xs` | 4 in 4 | Caption/S | 11, same |
| `.t-caption-xxs` | 1 in 1 | Caption/S | 9 → 11 |
| `.t-mono-display`, `.t-mono-m`, `.t-mono-code` | 0 | The same names | Same |
| `.t-mono-s` | 4 in 3 | Mono/S | 12, same |
| `.t-mono-xs` | 1 in 1 | Mono/S | 10 → 12. The hex field in `ColorControl.tsx` (Phase 1 found this call site) |
| `.t-mono-xxs` | 0 | Mono/S or Mono/Eyebrow | No call sites |
| `.t-mono-eyebrow` | 1 in 1, plus 2 CSS reads of its variable | Mono/Eyebrow | 10 → 11 |
| `.t-trim` | 17 in 6 | Nothing. Every style trims | Removed as each call site is rebuilt |

How Phase 1 lands this without moving layouts (finding 5):

- `tokens.css` defines the twenty classes under their final names, trimmed.
- `legacy-bridge.css` defines one untrimmed twin per new style a current call site needs, named `.tu-*` (`.tu-body-m`, `.tu-label-m`, `.tu-caption-m` and so on): the same font shorthand and tracking variables, no `text-box`.
- The codemod renames every existing `.t-*` use to the `.tu-*` twin of its new style from the table. A call site that already pairs with `.t-trim` goes straight to the final trimmed class and drops `.t-trim`. So do the six sites on `.t-button-s` and `.t-label-xxs`, which trimmed on their own in the earlier file.
- From Phase 2 on, a rebuilt component or screen uses the final `.t-*` classes. Phase 10 deletes the `.tu-*` twins, and a grep for `tu-` is that phase's check that no text was left untrimmed.

The only type that changes size in Phase 1 is on the rows above that say so: panel titles 17 → 18, the five `.t-body-m` and fourteen `.t-label-l` and `.t-caption-m` sites as read, small buttons 12 → 13, and the four sites under 11.

What Phase 1 found while building this:

- The motion durations are zeroed under reduced motion by `tokens.css` itself (the generator writes the rule). The bridge cannot hold it: the token check fails when the bridge declares a name `tokens.css` owns. `--dur-state` and `--dur-panel` follow through their `var()`.
- One stylesheet rule names a text class in a selector (`.sp-gen-start__unavailable > .tu-body-m` in `generate.css`), so the rename covered it.
- The rule in `brand-templates.css` that reads `--type-label-l` keeps the name, so its text goes from 15 to 16.
- Sixteen `.tu-*` twins existed after Phase 1. Title/Display, Mono/Display, Mono/M and Mono/Code have no call site and no twin. Phase 2 removed the Title/Section and Title/Group twins, so fourteen are left.
- The template card title is Label/M in the new library frame (`2308:4`), which Phase 4 read again; Phase 1's hold at Label/M was right, and the card takes the trimmed `.t-label-m`.
- The Glow/Accent composite is `--glow-accent-shadow`, because `--glow-accent` is the Color token for the glow's color.

## 6. What Phase 2 removed and found

Phase 2 rebuilt the primitives on the new tokens. The rules in `primitives.css` for the components on the Components page read no bridged name. The rules that still do belong to the Product components that live beside them (the Platform chip, the result card, the look tile, the preview overlay, the composer, the message bubbles, the settings card, the stat and the option tile) and to the two earlier mechanics those components use (`.ui-tint`, `.ui-ring-tight`).

Removed from `legacy-bridge.css`, each with no reader left in `src/`:

- `--overlay-scrim`, `--tag-overlay-bg`
- `--state-hover-inverse`, `--state-pressed-inverse`, `--state-hover-on-color`, `--state-pressed-on-color`
- `--switch-track-on`, `--status-active-bg`, `--status-active-fg`, `--status-positive-bg`
- `--tag-detail-fg`, `--tag-sent-bg`, `--tag-sent-fg`, `--tag-sent-border`
- `--gen-inverse`, `--gen-on-inverse`
- The `.tu-title-section` and `.tu-title-group` twins

Corrections to this file:

- Finding 9 described an off Switch as a `--border-control` edge on `--control-track`. The file draws the off track filled with `--border-control`, and that is what was built.
- The `--chip-*` row said platform chips are rebuilt in Phase 2. The Platform chip is on the Product components page, and the Phase 2 gate left it to Phase 4 with its bridge lines.
- The warning and wash names were listed for Phase 2. They are page names with no reader in the primitives, so they go with their screens.
- A text style class on an `<input>` or a `<textarea>` is wrong in practice: the trim clips an input's accents and descenders in Chromium, and in a text area it moves the value and not the placeholder. Both take their type from the style's variables in `primitives.css`, with no class. `RULES.md` section 5 says so.

## 7. Control classes

Not tokens, but the same kind of debt. These are the earlier control families that `docs/design/new-look/PLAN.md` Phase 9 was to delete. `PLAN.md` in this folder says which phase removes each, with the count of files still reading them.

## 8. What Phase 3 removed and found

Phase 3 built the app frame. The shell (`AppShell.tsx`, `Sidebar.tsx`, `BrandMark.tsx`, `layout/Page.tsx` and `shell.css`) reads no name from `legacy-bridge.css` and none of `socialpaint.css`'s own. It reads tokens and the measures it defines itself (`--page-pad` and `--chrome-top`, the rows above; Phase 3 also defined `--page-max`, which Phase 4 removed). The mobile bar's layer is a number, as in `primitives.css`, since z-index is not a Figma token. It has no inline style objects except the fade's measured scrollbar gutter, a custom property set as `ScrollFade` sets it.

Removed, each with no reader left in `src/`:

- `--sb-bg`, `--sb-border` and `--sb-fg-active`, with the mobile bar's inline styles
- `AppShell`'s inline `--bg-canvas` and `--font-ui` (the frame sets `--surface-page` and `--font-sans`)
- `logo-on-light.svg`, `logo-on-dark.svg` and `mark.svg`, which drew the mark in old Slime: the lockup and the mark are now path data (`brandArt.ts`) filled from `--text-primary` and `--text-secondary`

Kept, defined in `shell.css` where the shell owns them, and corrected above: `--chrome-top` is the shell's own measure for the mobile bar, `--page-pad` still has readers below 1024, in Generate and in the pre-app shell, and `--page-max` caps only the public link page's column.

Added: `--frame-inset-bottom`, set to 0 inside a frame with footer links below 1024 and read with the home-indicator inset as its fallback by the pages' bottom padding, since the footer links carry the inset there.

## 9. What Phase 4 removed and found

Phase 4 moved Brand Templates onto its frames. The rules it rebuilt (the library, the template card, the fill page, the Details panel's base, the public links dialog and the public page's chrome) read tokens only.

Removed, each with no reader left in `src/`:

- `--control-fill`, `--chip-selected-bg` and `--chip-selected-tile` (the rebuilt Platform chip reads `--surface-raised`, `--surface-field` and `--surface-inverse`)
- `--page-max` (the public link page's column caps itself)
- `.ui-ring-tight`, whose one user was the Platform chip (it takes the 2 px ring 2 out)
- `details/LinkedInMark.tsx` (Post to LinkedIn carries no icon in `2308:3596`)
- the fill page's step form rules (`.sp-fill__step*`, `.sp-fill__rail`, `.sp-fill__looks`, the Preview card) and the shelves' `--shelf-visible` sizing

Kept for a later phase: `.sp-lib-link`, the earlier underlined "View all", which Generate's Recent still uses (Phase 5), and Generate's preview stage rules inside the Details panel, which still read `--radius-control-md` and `--border-default` (Phase 5). Phase 5 removed both.

## 10. What Phase 5 removed and found

Phase 5 moved Generate onto its frames: the chat box and its plus menu, the thread with one Result card a turn, the editor beside it, Start, Recent and History. The rules it rebuilt (the composer, the attach menu and its panels, the Result card, the assistant message and the sent message, the chat cards, the attachment tiles and the editor's preview stage) read tokens only.

Removed, each with no reader left in `src/`:

- `--elevation-large`, whose last readers were the Recent and History cards' hover lift
- `--gen-fade` and `--gen-fade-h` (above), and the rebuilt rules' reads of `--focus-width`, now `--stroke-focus`
- `chat/CaptionCard.tsx` and its rules (`.sp-tchat-caption*`, and the caption skeleton's switch, circle and lines): the caption is part of the Result card
- `captionTabs` in `draftView.ts`: the card's switch names the drafts with `linkedFields`' `sizeNames`, as the editor's does
- `PlatformSelect` in `chat/Attachments.tsx`: Platform is in the plus menu's Output section
- the per-draft cards (`.sp-gen-results`, `.sp-gen-result*` but `__gone`, `.sp-tchat-result`, `.sp-tchat-preview`), the earlier Result card's rules in `primitives.css` (`104:602`), and the column width `useThreadScroll` measured for them
- `.sp-lib-link`, the earlier underlined "View all", and the saved chat sketch's sunken wells (`.sp-gen-loading__*`), now Skeletons
- the composer text area's dead `ui-ring-none` class: its focus rings the whole chat box, as a field's does

Kept for a later phase: `LookTile` and the Looks card, which only the hidden template chat draws (cleanup), and `PreviewOverlay`, which Brand Studio's covers, swatches and logo plates use (Phase 7). `TypeStylesDetail.tsx` still names the dead `ui-ring-none` (Phase 7).

## 11. What Phase 6a removed and found

Phase 6a moved the Template Builder's list and how a template starts onto their frames: the list with its row menu, New template, Choose a size, and the import dialogs. The rules it rebuilt (`src/styles/template-builder.css`) read tokens only.

Removed, each with no reader left in `src/`:

- `--cover-ground`, `--cover-card`, `--cover-back` and `--cover-chrome-1` to `-3`, which only the SVG size covers read: the covers are the file's photographs, exported as WebP
- the builder's start screen (`BuildPicker.tsx`, `StartGlyphs.tsx`, `ImportLinkPopup.tsx`) and its rules (`.sp-start*`, `.sp-start-card*`, `.sp-start-tile`, `.sp-import-pop*`, `.sp-hero-title`)
- the earlier size gallery's rules (`.sp-sizegrid`, `.sp-sizecard*`, `.sp-railitem`, `.sp-chipbar`, `.sp-chip` and its parts) and `templates/TemplateSearchField.tsx` with `.sp-searchfield*`
- the list card's inline rename, its AI-built label and its icon buttons, and the earlier card's rules (`.sp-template-card__meta*`, `.sp-media-card*`, `.sp-grid-media`) with `SkeletonCard`, `.sp-skeleton-card` and `.sp-skeleton__line`
- `templates/GroupChips.tsx`, which nothing imported, and `.sp-railfade*`, whose last live reader was the earlier size gallery
- `--start-*` (the start screen's tiles, with their hex), `--shadow-card-hover`, `--radius-control-lg`, `--edge-alpha-hover`, `--control-sm`, `--control-md` and `--border-width`, which lost their last readers with the screens above

Kept for Phase 6b: `CanvasSizePicker`, which the editor's resize popover still uses, and the editor's own loading pulse on `.sp-skeleton__block`. `.sp-chip-in`, the upload chip's entrance, is a different class and stays. The type ramp's `--type-h2-*` lost its last reader too, and stays: the stylesheet keeps unread steps of the ramp whole, and deletes only unread component tokens.

## 12. What Phase 6b removed and found

Phase 6b moved the Template Builder's editor onto its frames: the top bar, the carded workspace, the rail, the stage's controls, the inspector, Preview and Publish. Its rules (`src/styles/template-builder.css`) read tokens only.

Removed, each with no reader left in `src/`:

- the step bar and its panels (`WizardStepper.tsx`, `BuilderShell.tsx` with `BuilderRail`, `RailHeader`, `RailTabs`, `BuilderSlideOver` and the rail width and collapse hooks), the filmstrip (`VariantFilmstrip.tsx`), and `InlineEdit.tsx`, whose last reader was the group inspector
- the earlier builder rules in `socialpaint.css`: the bar, rails, grips, slide-over, stub and tools (`.sp-builder__*`), the palette tiles' hover hues (`.sp-palette-tile`), `.sp-panel-title`, the inline edit (`.sp-inline-edit*`) and the builder's skeleton (`.sp-skeleton__block` and its pulse)
- `--editor-pasteboard` (the stage is the pasteboard) and `--flash-rgb`, the inline edit's confirm wash, with its hex triplet

Kept for Phase 10: the size popover's insides (`CanvasSizePicker`), the fill picker (`FillPicker`), the icon picker's search, the background reflow dialog and the shortcuts panel, which the frames do not draw and which still read `.sp-btn`, `.sp-input`, `.sp-icon-btn`, `.sp-seg` and `.sp-tabstrip`; `compactControlStyle` and `inspectorLabelStyle` stay for the fill picker. The gradient's stops keep `ColorControl`.

Off the scale, kept as drawn: the Element Tiles' gap 9, Add's gap 10, the Form Row's gap and right padding 10, and the fill row's gap 10. The stage fits the artboard inside insets of 76, 72, 60 and 72 (`STAGE_FIT_INSETS`, and Preview's padding), which clear its controls: the capsule's 16 and 44 and 16 above, the tools' 16 and 40 and 16 at the sides, the selects' 16 and 28 and 16 below. The Layer Row and the fill row's swatch take radius/sm (the file draws 7). The Element Tile's hover lays `--state-hover` over its fill, as `321:77` draws it, and RULES section 6 records it as an exception.

