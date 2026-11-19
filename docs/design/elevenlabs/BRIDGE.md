# ElevenLabs: the bridge

Every name that was added, changed, moved or removed between the new-brand export and the ElevenLabs export, and every component change, so a phase can tell a deliberate change from a regression. The new-brand bridge (`docs/design/new-brand/BRIDGE.md`) still holds the names from before that program, and both bridges empty out in Phase E9.

## 1. The source

| Before | Now |
|---|---|
| "Master UX UI New Brand (Copy)", `1dYWgFH2V8i9Jez2ylI3ky` | "Master UX-UI New Brand Eleven Labs Inspired", `dQ8bQq3V7Bue5pvFrI2g9X` |
| Color modes Light and Dark, plus two v2 modes the export never read | Light and Dark only |
| `figma-export/code.js` pointed at the earlier file | Points at the new file. Its checks are unchanged |
| `build-tokens.mjs` sized `--space-`, `--radius-`, `--size-`, `--type-size-`, `--stroke-` and `--focus-offset` | Also sizes `--layout-` in px |

## 2. Added

Thirty-four names, all from `tokens.css`.

| Name | What it is |
|---|---|
| `--gray-0` to `--gray-950` (17 steps) | The interface ramp the Color tokens now read |
| `--surface-card` | Template, result and content cards |
| `--surface-shell` | The shell behind the sidebar and Main |
| `--surface-stage` | The stage behind a template preview |
| `--surface-soft` | Icon tiles, segmented tracks, the stepper, progress tracks and pending steps |
| `--border-field` | A field's edge at rest |
| `--border-field-hover` | A field's edge under the pointer |
| `--plate-dark`, `--plate-light` | Logo proof grounds, fixed in both themes |
| `--neutral-850` | `#1C1F1E`, the lockup's ink on Light |
| `--logo-ink` | The lockup and its mark, `--neutral-850` on Light and `--neutral-50` on Dark |
| `--radius-chip` 10, `--radius-tile` 8, `--radius-tag` 6, `--radius-composer` 27, `--radius-shell` 0 | The new radius steps |
| `--stroke-shell-edge` 0 | The sidebar's top, left and bottom edges |
| `--layout-shell-inset` 0 | The gap around and between the sidebar and Main |

## 3. Moved into `tokens.css`

Three names other stylesheets declared. Phase E1 deleted those declarations (built), so `tokens.css` owns them and `npm run tokens:check` passes.

| Name | Was | Now |
|---|---|---|
| `--radius-tag` | `8px` in `socialpaint.css` `:root` | 6, Scale `radius/tag` |
| `--plate-dark` | `#0b0b0c` in `socialpaint.css` | `#0A0A0A`, Color `plate/dark` |
| `--plate-light` | `#f9f9f8` in `socialpaint.css` | `#FAFAFA`, Color `plate/light` |

## 4. Removed

Twenty-four primitives the ElevenLabs Color tokens no longer read. Only two were read outside `tokens.css`, both by `legacy-bridge.css`, and Phase E1 repointed them (built).

| Removed | Read by | Now |
|---|---|---|
| `--neutral-700` | `--ink-700` in `legacy-bridge.css` (read by `--chip-tile-active`) | `--ink-700: var(--gray-700)` |
| `--neutral-800` | `--ink-800` in `legacy-bridge.css` (read by `--bg-raised`) | `--ink-800: var(--gray-800)` |
| `--neutral-300`, `--neutral-400`, `--neutral-600` | Nothing | Gone |
| `--alpha-ink-5`, `-8`, `-12`, `-16` | Nothing | Gone |
| `--alpha-white-6`, `-10`, `-16`, `-20` | Nothing | Gone |
| `--alpha-black-5`, `-15` | Nothing | Gone |
| `--alpha-slime-10`, `-30`, `-60` | Nothing (the old `--glow-accent` read 30 and 60) | Gone |
| `--green-slime-hover`, `-pressed`, `--green-deep-moss-hover`, `-pressed` | Nothing | Gone |
| `--red-200`, `--red-400` | Nothing | Gone |

## 5. Changed values

### Color

Forty semantic tokens resolve to new values. Names are unchanged, so these arrive through Phase E1 with no component code.

| Token | CSS | Light before | Light now | Dark before | Dark now |
|---|---|---|---|---|---|
| surface/page | `--surface-page` | `#F9F9F8` | `#FFFFFF` | `#0B0B0C` | `#0A0A0A` |
| surface/raised | `--surface-raised` | `#FFFFFF` | same | `#171817` | `#161616` |
| surface/sunken | `--surface-sunken` | `#ECECEC` | `#EFEFEF` | `#232425` | `#1F1F1F` |
| surface/field | `--surface-field` | `#F1F1EF` | `#FFFFFF` | `#FFFFFF1A` | `#0A0A0A` |
| surface/inverse | `--surface-inverse` | `#0B0B0C` | `#0F0F0F` | `#FFFFFF` | `#FAFAFA` |
| surface/skeleton | `--surface-skeleton` | `#0B0B0C14` | `#EFEFEF` | `#FFFFFF1A` | `#1F1F1F` |
| text/primary | `--text-primary` | `#0B0B0C` | `#0F0F0F` | `#F1F1EF` | `#FAFAFA` |
| text/secondary | `--text-secondary` | `#636363` | `#6B6B6B` | `#A0A0A0` | `#A3A3A3` |
| text/disabled | `--text-disabled` | `#A0A0A0` | `#A3A3A3` | `#636363` | `#6B6B6B` |
| text/inverse | `--text-inverse` | `#FFFFFF` | same | `#0B0B0C` | `#0F0F0F` |
| border/subtle | `--border-subtle` | `#0B0B0C14` | `#EFEFEF` | `#FFFFFF1A` | `#1F1F1F` |
| border/strong | `--border-strong` | `#0B0B0C29` | `#E8E8E8` | `#FFFFFF33` | `#2A2A2A` |
| border/raised | `--border-raised` | `#FFFFFF00` | `#E8E8E8` | `#FFFFFF33` | `#262626` |
| border/focus | `--border-focus` | `#0B0B0C` | `#0F0F0F` | `#FFFFFF` | `#FAFAFA` |
| action/primary | `--action-primary` | `#2BFFA3` | `#0F0F0F` | `#2BFFA3` | `#FAFAFA` |
| action/primary-hover | `--action-primary-hover` | `#28EB97` | `#262626` | `#28EB97` | `#E8E8E8` |
| action/primary-pressed | `--action-primary-pressed` | `#26D88B` | `#333333` | `#26D88B` | `#D4D4D4` |
| action/on-primary | `--action-on-primary` | `#0B0B0C` | `#FFFFFF` | `#0B0B0C` | `#0F0F0F` |
| action/neutral | `--action-neutral` | `#FFFFFF` | same | `#FFFFFF1A` | `#161616` |
| action/neutral-hover | `--action-neutral-hover` | `#0B0B0C0D` | `#F5F5F5` | `#FFFFFF29` | `#1F1F1F` |
| action/neutral-pressed | `--action-neutral-pressed` | `#0B0B0C1F` | `#EFEFEF` | `#FFFFFF33` | `#262626` |
| action/accent | `--action-accent` | `#2BFFA3` | `#0F0F0F` | `#2BFFA3` | `#FAFAFA` |
| action/accent-hover | `--action-accent-hover` | `#28EB97` | `#262626` | `#28EB97` | `#E8E8E8` |
| action/accent-pressed | `--action-accent-pressed` | `#26D88B` | `#333333` | `#26D88B` | `#D4D4D4` |
| action/on-accent | `--action-on-accent` | `#123D34` | `#FFFFFF` | `#123D34` | `#0F0F0F` |
| action/disabled | `--action-disabled` | `#0B0B0C0D` | `#F5F5F5` | `#FFFFFF0F` | `#1A1A1A` |
| state/hover | `--state-hover` | `#0B0B0C0D` | `#F5F5F5` | `#FFFFFF0F` | `#1A1A1A` |
| state/selected | `--state-selected` | `#0B0B0C14` | `#EFEFEF` | `#FFFFFF1A` | `#1F1F1F` |
| state/pressed | `--state-pressed` | `#0B0B0C1F` | `#E8E8E8` | `#FFFFFF29` | `#262626` |
| control/track | `--control-track` | `#F1F1EF` | `#EFEFEF` | `#0B0B0C` | `#1F1F1F` |
| control/thumb | `--control-thumb` | `#FFFFFF` | same | `#232425` | `#333333` |
| control/on | `--control-on` | `#0B0B0C` | `#0F0F0F` | `#F1F1EF` | `#FAFAFA` |
| control/on-mark | `--control-on-mark` | `#FFFFFF` | same | `#0B0B0C` | `#0F0F0F` |
| status/positive-surface | `--status-positive-surface` | `#123D34` | same | `#232425` | `#262626` |
| status/active-surface | `--status-active-surface` | `#BCFFDA` | same | `#232425` | `#262626` |
| status/neutral-surface | `--status-neutral-surface` | `#0B0B0C14` | `#F5F5F5` | `#FFFFFF1A` | `#1F1F1F` |
| shadow/raised | `--shadow-raised` | `#0000000D` | `#FFFFFF00` | `#00000026` | `#FFFFFF00` |
| bevel/top | `--bevel-top` | `#FFFFFF00` | same | `#FFFFFF29` | `#FFFFFF00` |
| bevel/bottom | `--bevel-bottom` | `#FFFFFF00` | same | `#FFFFFF1A` | `#FFFFFF00` |
| glow/accent | `--glow-accent` | `#2BFFA399` | `#FFFFFF00` | `#2BFFA34D` | `#FFFFFF00` |

### Scale

| Token | Before | Now |
|---|---|---|
| `--radius-xs` | 4 | 6 |
| `--radius-md` | 12 | 10 |
| `--radius-lg` | 16 | 12 |
| `--radius-xl` | 20 | 16 |

### Text and effect styles

| Style | Before | Now |
|---|---|---|
| Title/Display | 44, bound to `type/size/44` | 40, bound to `type/size/40` |
| Elevation/1 Raised | Bevels and a soft drop shadow | Every layer transparent. Raised surfaces are flat with a `--border-raised` hairline |
| Glow/Accent | 12 blur of `--glow-accent` (Slime at 60 and 30) | Transparent |

## 6. Figma-only renames and fixes

These never reached code under their old names, and are listed so nobody looks for them.

| Before | Now |
|---|---|
| Scale `radius/control` | `radius/chip` |
| Primitives `eleven/0` to `eleven/950` | `gray/0` to `gray/950` |
| Color modes "ElevenLabs Light" and "ElevenLabs Dark", Scale mode "ElevenLabs" | Light, Dark and Value |

Fixed in the file while this kit was written, so a phase reading it sees the fixed version.

| Fix | Where |
|---|---|
| Icon Button's Outline variants had no property bindings, so every Outline button showed the ellipsis and the name "More actions". Their icon, focus ring and name now follow the Icon, Focus and Accessible name properties, and the Sidebar's buttons show `Icon/panel-left` (Collapse sidebar) and `Icon/settings` (Settings) | `2206:686`, the ten Outline variants |
| The collapsed Sidebar's mark was a raw near-black that vanished in Dark. It reads `text/primary` | `2218:679`, Collapsed=True |
| The Page Header component still drew the v2 row. It now draws what every frame draws, the area icon, then the title in Label/M on `text/secondary` or the Breadcrumb, with the actions on the right | `4015:764` and its board `6221:1053` |
| The Progress Bar's track read `surface/field`, white on white in Light. It reads `surface/soft` | `2215:272` |
| The Search component rested with no edge. It rests on a `border/field` hairline and hovers on `border/field-hover`, as Input does | `2207:455` |
| CJ's updated lockup, and the mark in the collapsed rail, were raw `#1C1F1E` in both themes and nearly vanished on Dark. They read `logo/ink` | `6243:8529`, `6112:44073` |
| The liquid selection is drawn as a storyboard in Light and Dark with its timing and rules, and the Segmented Control board and the Variations bar pattern point to it | Foundations › Interactions `6262:353` |
| The six microinteractions are drawn after it as sections 7.2 to 7.7, each a storyboard in Light and Dark with its timing, rules and uses. The Toast, Button, Icon Button, Send Button, Checkbox, Chip, Upload and Metric boards carry an Interaction note that points to their section, and the Result Card and Platform Chip descriptions carry one line each | Foundations › Interactions `6262:353`, sections `6280:443`, `6281:497`, `6282:547`, `6282:908`, `6284:737`, `6284:1169` |
| An audit before the handoff (2026-11-17). Twenty-four shelf and Recent labels on Brand Templates and Generate had no text style and now read Label/XS | `6010:2062`, `6023:3095` |
| The App shell and Settings page patterns draw their pages at half size to fit the board. Their descriptions now say so and point to the source frames | `6227:1078`, `6227:2808` |
| Color and border swatches on Foundations were named Rectangle and Frame, and now carry their token names. A zero-radius blur on the Brand Templates scroll fade was removed | Foundations › Color, Borders and elevation, `6107:1637` |
| The eight sign-in screens placed the earlier Logo. On CJ's word (2026-11-17) they place his updated lockup, as instances of New Logo Dark 1 (Default) at 24 tall with their ink on `logo/ink`, the same lockup the Sidebar draws | Sign in and sign up `6101:631`, New Logo Dark 1 `6243:17235` |

## 7. Components

| Change | Figma | Code |
|---|---|---|
| Added an Outline style to Icon Button | `2206:686`, Style=Outline, ten variants | Add `"outline"` to `IconButtonProps["variant"]` and a `[data-variant="outline"]` block in `.ui-iconbtn` (Phase E1, built) |
| Added a Size property to Search Field | `50:62`, Size=Large 46 and Medium 36 | Add `size?: "lg" \| "md"` to `SearchFieldProps` (Phase E1, built) |
| Fields rest with a hairline and hover with a darker one | Input, Select, Text Area, Upload | `.ui-input`, `.ui-select`, `.ui-upload` borders (Phase E1, built) |
| Button and Icon Button icons follow their label color | `2206:542`, `2206:686` | Check each kind and the disabled state (Phase E1, built) |
| Nav Item icons and labels sit on `--text-secondary` at rest | `2213:109` | Already built so in `.ui-nav-item`. Phase E1 checked it against the board (no change) |
| Chip and Badge on `--radius-chip`, Tag on `--radius-tag` | `2212:187`, `2212:130`, `2212:143` | `.ui-chip`, `.ui-badge`, `.ui-tag` (Phase E1, built) |
| Stepper, pending progress steps and the Progress Bar's track on `--surface-soft` | `2211:227`, `2221:1105`, `2215:272` | `.ui-stepper`, `.ui-progress`, `.ui-progress-bar` (Phase E1, built) |
| Search rests with a hairline | `2207:455` | `.ui-input--box` inside `Search` (Phase E1, built) |
| Page Header leads with the area icon and names the page in Label/M | `4015:764` | `PageHeader` gains an `icon` prop, and the title kind sets Label/M on `--text-secondary` (Phase E2, built) |
| Generate Start gains a header row | `6023:3097` | `generate/GeneratePage.tsx` passes a `PageHeader` (Phase E2, built) |
| The builder editor's bar becomes the 64 header row | `6072:3662` | `builder/TemplateBuilder.tsx` (Phase E5, built) |
| Field holds a Medium control | `4015:628` | Already the default: `Field` passes its control through and `Input`, `Select` and `Search` default to Medium. Phase E1 set the label 12 over the control (built) |
| The filled Text Area carries a copy button | `2207:298` | `TextArea` gains `copy`, set by the Details panel's caption on the fill page, in Generate's editor and in the Template Builder's preview (Phase E4, built), and Publish template's caption (Phase E5, built) |
| Composer · Inline is the Composer | `6024:218` | `chat/ChatComposer.tsx` (Phase E4, built) |
| The v2 Composer is retired | `2216:222`, deleted | Its layout went in Phase E4 (built) |
| `LookTile` becomes `VariationTile` | `2216:315` | `primitives/Previews.tsx`, `.ui-look-tile` to `.ui-variation-tile` (Phase E4, built) |
| The Sidebar runs flush with the Logo and Outline buttons | `2218:679` | `Sidebar.tsx`, `src/styles/shell.css` (Phase E2, built) |
| Template, Builder Template, Recent and History Cards on `--surface-card` | `4018:129`, `4018:156`, `4018:183`, `4018:1728` | `.sp-tcard`, `.sp-gen-card`, `.sp-tbcard` (Phase E1, so no card vanishes on the white page) |
| Platform Chip is 46 on `--radius-chip` with a `--radius-tile` logo tile | `53:96` | `.ui-platform-chip` (Phase E3, built) |
| Logo Card grounds on the plates | `4018:1794` | `admin/brand/LogosDetail.tsx` already reads `--plate-*` (Phase E6) |
| Segmented Control gains the liquid selection | `2211:213`, Foundations › Interactions `6262:353` | `.ui-segmented` and `SegmentedControl` in `primitives/Toggles.tsx`, after `reference/liquid-selection.html` (Phase E1, built) |
| The lockup is CJ's update, on `--logo-ink` | `6243:8529` | `BrandMark.tsx` (Phase E2, built) |
| The Toast eases in and out and owns a timer that pauses | `2213:213`, Foundations › Interactions `6262:353` | `Toast` gains `open`, `duration` and `onTimeout`, and `.ui-toast` its transitions. `admin/brand/kitPlumbing.ts` and `admin/settings/settingsToast.tsx` pass 5000 and 4000 in place of their own `setTimeout` (Phase E1, built). The other four callers move their timers onto it in their own phases, `TemplateFill.tsx` (Phase E3, built), `generate/EditorPanel.tsx` and `generate/GeneratePage.tsx` (Phase E4, built) and `admin/AdminTemplates.tsx` (Phase E5, built), and the builder editor's notices in `builder/TemplateBuilder.tsx` (Phase E5, built) |
| Button and Icon Button swap icons with a drawn check, and show a spinner past 400 ms when busy | `2206:542`, `2206:686` | An icon slot in `Button` and `IconButton`, a `busy` prop, and `CONFIRM_MS` in place of the two `COPIED_MS` (Phase E1, built) |
| The Checkbox's mark draws in | `2211:148` | `CheckMark` in `primitives/Toggles.tsx` renders both paths, `.ui-check__mark` (Phase E1, built) |
| Buttons, icon buttons, Send and chips shrink while pressed | `2206:542`, `2206:686`, `2206:754`, `2212:187`, `53:96` | `.ui-btn`, `.ui-iconbtn`, `.ui-send`, `.ui-chip`, `.ui-platform-chip` (Phase E1, built) |
| A picked or dropped photo develops in, and a slow upload pulses | `2211:278` | `Upload` gains `busy`, `.ui-upload__thumb` (Phase E1, built). `builder/TemplateBuilder.tsx` and `builder/FieldInspector.tsx`, the only callers that track an upload, pass it (Phase E5, built) |
| Result art develops in, and Download confirms with a check | `2216:287` | `ResultCard` gains `arrive`, set by `chat/GenerateTurn.tsx` and `chat/TemplateChatViews.tsx` (Phase E4, built) |
| Metric values roll when the member changes the range | `2215:223` | `Metric` gains `roll`, a digit roll on `useRoll`'s timing. Insights draws its numbers with `admin/insights/InsightKpi.tsx` today, so `admin/Dashboard.tsx` moves them onto `Metric`, or `InsightKpi` takes the roll (Phase E7) |

## 8. Restored in Figma

The two Now hiring reference frames (Variation 1 dark, Variation 2 white) were rebuilt from the Template Thumbnail variants and sit in the Templates column of Product components as `6223:3579` and `6223:3609`. Their earlier ids (`6148:5716`, `6148:5698`) no longer resolve.
