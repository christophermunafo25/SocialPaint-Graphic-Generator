# ElevenLabs: the plan

The Figma file "Master UX-UI New Brand Eleven Labs Inspired" (`dQ8bQq3V7Bue5pvFrI2g9X`) holds the ElevenLabs-inspired design system and every product screen in Light and Dark. This program moves the code onto it in phases, one pull request each, merged to `main` as each passes its gate.

It starts once new-brand Phase 6b has merged. It does not undo the new-brand program. That program built the app frame, the primitives and the screens this one restyles, and its decisions stand unless one below changes them. New-brand Phases 7 to 10 were never started, so this program builds those areas straight from the ElevenLabs frames as Phases E6 to E9.

The kit was prepared on 2026-11-17 against `main` at `c54794a`.

## Decisions (CJ)

Settled. Phases build them and do not re-ask.

1. **The ElevenLabs file is the source of truth** for tokens, components and screens. Its Color collection has two modes, Light and Dark, and its Scale collection one, Value. The v2 modes are gone from the file.
2. **Primary actions are ink.** `--action-primary` is gray 900 under a white label in Light and gray 50 under a gray 900 label in Dark. This overturns new-brand decision 3 (Slime primary), because the ElevenLabs file draws it that way on every screen.
3. **Raised surfaces are flat.** Cards, panels and the sidebar take a hairline edge instead of a shadow. Only menus, popovers, dialogs, toasts and the switch thumb cast one.
4. **Fields have a visible edge.** Inputs, selects, text areas and uploads rest on `--surface-field` with a `--border-field` hairline.
5. **The sidebar runs flush** on `--surface-shell` with only a right edge. `--radius-shell` and `--layout-shell-inset` are 0.
6. **The variations bar reads Variation 1, Variation 2 and Variation 3.** The product word stays "variations" in every string the interface shows.
7. **Template thumbnails.** Variation 1 is the dark Now hiring frame and Variation 2 is the white one.
8. **Form spacing follows the Details panel.** A label sits 12 above its control and fields sit 24 apart.
9. **Sign in and Create account are Light only.**
10. **No helper copy.** No hints, helper lines or explainer sublines in the interface.
11. **Selection moves like liquid.** A Segmented Control's thumb travels to a new choice with a drop of the same color trailing it, adapted from the BYQ gooey nav CJ supplied. `PROMPT.md` section 7 is the spec, Foundations › Interactions (`6262:353`) draws it, and `reference/liquid-selection.html` is the build to follow.
12. **The lockup is CJ's update** in the Sidebar (`6243:8529`), on `logo/ink`. The sign-in gate places it too, as instances of CJ's New Logo Dark 1 (`6243:17235`) at 24 tall on `logo/ink` (2026-11-17).
13. **Six microinteractions from BYQ Supply** (2026-11-17). The Toast eases in and waits, icons swap with a drawn check, the checkbox mark draws in, controls shrink while pressed, results and uploads develop in, and Insights numbers roll. `PROMPT.md` sections 7.2 to 7.7 are the spec, Foundations › Interactions (`6262:353`) draws them, and `reference/microinteractions.html` is the build to follow.
14. **No planning phase** (2026-11-17). Each phase is built straight through, with no plan mode and no recon gate. It takes the recommended answer to every open question, lists what it took in its pull request, and stops only before something that cannot be undone.

Still true from the new-brand program: the 2 px focus ring outside every interactive control (decision 5), disabled controls with their own colors (6), the dialog close in the top right (7), the form-only fill page (9), the Generate count control as a plus and minus capsule beside Send (10), the one Result Card with sizes as tabs (11), skeletons for lists and cards (13), Terms of Service and Privacy Policy at the bottom of every page (14), and a shadow is never cut off (17).

Also still true are CJ's answers at the new-brand shell gate (`docs/design/new-brand/PLAN.md`, What Phase 3 found). Main scrolls as one page, with the header row, the content and the footer links moving together, and nothing sticks (2026-11-16). The theme toggle stays beside Collapse and in the mobile bar, though no frame draws it. The lockup is CJ's two files with the gradient mark (2026-11-16). The content has no width cap. The ElevenLabs frames name a scroll region under the Brand Templates filter bar, as the earlier frames did, and CJ's answer stands over it.

## Judgement calls

Made while building the system. Built as written unless CJ overturns one.

1. **A hover edge for fields.** `--border-strong` and `--border-field` resolve to the same gray in both themes, so a field's hover showed nothing. `border/field-hover` (gray 300 in Light, gray 700 in Dark) now draws the hover edge on Input, Select, Text Area, Upload and Search.
2. **Icon Button has an Outline style.** The sidebar's collapse and settings buttons are bordered rounded squares on the screens, which neither Filled (round) nor Ghost (no edge) draws. Outline is Filled's fill and edge on `--radius-sm`, with the glyph on `--text-secondary` at rest.
3. **Search Field has two sizes.** Large is 46 and sits beside the Platform Chips. Medium is 36 and sits beside other controls in the builder's filter bars.
4. **The filter bar is 46.** Platform Chips and the Large Search Field are `--size-control-lg` with a hairline edge included, so every state of the chip is 46. The selected chip draws its edge in its own fill color.
5. **Logo plates are tokens.** `plate/dark` and `plate/light` stay the same in both themes, replacing the two hex values `socialpaint.css` declared. The Logo Card's light ground used `--surface-page`, which turned dark in Dark, and now reads `--plate-light`.
6. **Bevels and the accent glow stay as transparent tokens** so the elevation composites keep one shape in code. Phase E9 decides whether to delete them.
7. **Field holds a Medium control** and its help text stays off.
8. **Composer · Inline is the Composer.** The earlier Composer (`2216:222`) is deleted from the file. The new one is `6024:218`.
9. **`LookTile` becomes `VariationTile`** when Phase E4 touches Generate. The Figma component is Variation Tile (`2216:315`).
10. **The filled Text Area carries a copy button** for generated captions, drawn with Icon Button and `Icon/copy`.
11. **Loose values moved onto the scale.** Layer Row's 7 corner is `--radius-sm`, and Form Row's 10 gap is `--space-8`.
12. **The page header leads with the area icon.** Every frame's header row carries the area's 18 icon on `--text-secondary`, then the page name in Label/M on `--text-secondary`, or the Breadcrumb one level down. The Page Header component still drew the v2 row (a Title/Page title and no icon), so it was rebuilt from the frames. Title/Page stays in the scale, and no screen sets a page name in it.
13. **The Progress Bar's track is `--surface-soft`.** It read `--surface-field`, which is white in Light, so the track vanished on a white page or card. Pending Progress Steps already used `--surface-soft`.
14. **Generate Start has a header row.** Its frames draw one with the Generate title, where the v2 Start drew none.
15. **The liquid selection runs on the pointer only.** The keyboard and reduced motion place the thumb at once, since the arrows move through options faster than travel can follow. Its timing reuses the motion tokens (base for the thumb, fast and slow for the drop), so no duration or curve was added. Tabs keep changing at once.
16. **The lockup reads `logo/ink`.** CJ's updated lockup was drawn in `#1C1F1E` in both themes and nearly vanished on Dark. `logo/ink` keeps it `#1C1F1E` on Light and makes it `#F9F9F8` on Dark, the colors of the two lockup files, through a new `neutral/850` primitive.
17. **Direct feedback follows the pointer and arrivals play for everyone.** A press, a check and an icon swap land at once from the keyboard, as the liquid selection does, while a toast, a result, an upload and new numbers answer the content and play either way.
18. **One confirmation hold.** `CONFIRM_MS` is 1500 for every check that confirms, where the Result Card held 1500 and the Details panel 1600.
19. **A spinner only past 400 ms.** A busy button keeps its icon for the first 400 ms, so a quick download goes straight to the check. The spinner turns at 60 percent of `--motion-duration-pulse`, the 900 ms the sign-in spinner already uses, and stands still under reduced motion.
20. **An arrow only fades.** Download's glyph fades without scaling, and Send to Stop keeps its instant swap.
21. **The Toast owns its timer** and pauses it while the pointer or focus is on it or the tab is hidden, so its Undo never expires under the pointer (WCAG 2.2.1).

## What changed from v2

The structure is the same. These are the differences a phase will see on screen.

| Area | v2 | ElevenLabs |
|---|---|---|
| Shell | The sidebar floats as a raised card 12 in from the window edge | The sidebar runs flush on a soft gray panel with a hairline on its right |
| Page | Off-white page under white panels | White page, with soft gray for the sidebar, cards and preview stage |
| Cards | White, lifted by a soft shadow | Soft gray and flat, so the template carries the card |
| Elevation | A soft shadow on every raised surface | Shadows only on dialogs, menus, toasts and the switch and segment thumbs |
| Corner radius | 20 on cards and panels, full on chips, tags and tiles | 16 on cards and panels, 10 on chips, 8 on tiles and 6 on tags |
| Borders | Ink at 8 and 16 percent | `#EFEFEF` on dividers and `#E8E8E8` on controls, fields and panels |
| Fields | Filled gray with no edge | White with a hairline edge |
| Primary action | Slime with a black label | Ink with a white label |
| Secondary text | `#636363` | `#6B6B6B`, which holds 4.5:1 on the page, panels and cards |
| Chat bar | The message on its own line above the plus and Send | The message between the plus and Send, with attachments and details above it |
| Display title | 44 | 40 |
| Page title | Title/Page in a 36 row, 16 under Main's top | The area icon and the page name in Label/M, in a 64 row with a hairline under it |
| Progress tracks | `--surface-field` | `--surface-soft` |
| Selection | The thumb jumps to the new segment | The thumb travels with a liquid drop behind it, on a click or a tap |
| Pressing | Color only | Buttons, icon buttons, Send and chips also shrink to 0.97 |
| Toasts | Appear and vanish at once, and time out under the pointer | Ease in and out, and wait while the pointer or focus is on them |
| Copy and Download | The glyph swaps at once, and Download shows nothing until the file | The glyph crossfades and the check draws itself, and a slow file shows a spinner |
| Checkbox | The mark appears | The mark draws in |
| Results and uploads | The art and the photo replace the skeleton at once | They develop in from a 4px blur |
| Insights | The numbers swap after the dim | The digits that changed roll |

## Phases

One pull request per phase into `main`.

| # | Phase | What lands | Gate | Status |
|---|---|---|---|---|
| E0 | Recon and kit | This folder, the Figma file's system pages and the token patch | CJ merges the kit | Done (this kit's pull request) |
| E1 | Foundation | The token patch (new `master.tokens.json` and `tokens.css`, the exporter on the new file, the `layout` unit rule, the plates and `--radius-tag` owned by `tokens.css`, the two ink names on gray). Every primitive change in `PROMPT.md` section 5.1, the liquid selection in the Segmented Control included, and the microinteractions in sections 7.2 to 7.6 that live in primitives. Every surface that would vanish on a white page, found by audit and fixed from its frame. `/dev/ui` redrawn from the component boards. `CLAUDE.md` points at this folder (`PHASE-E1.md`) | Every changed value is on `BRIDGE.md`'s list. `/dev/ui` matches the boards in both themes. No surface disappears on any route in Light or Dark. The liquid selection and the microinteractions match their references at slow motion | Done (#206) |
| E2 | Shell | The flush sidebar on `--surface-shell` with its right edge, the Outline buttons, CJ's updated lockup on `--logo-ink`, no viewport inset, the 64 header row with its hairline, and the Page Header with the area icon on every page (`PHASE-E2.md`) | Every route reachable in both themes. The shell matches the App shell pattern | Built, pull request open |
| E3 | Brand Templates | The library, the 46 filter bar, search, the fill page with the 380 Details panel, public links | Screens match their frames in both themes | Not started |
| E4 | Generate | The one-line composer, the result thread, History, `VariationTile`, the copy button on captions, the Result Card's arrival and its download check (`PROMPT.md` sections 7.3 and 7.6) | Same | Not started |
| E5 | Template Builder | The list and its dialogs, the editor chrome, the stage, the variations bar, the 320 inspector | Same, and the fidelity checker passes | Not started |
| E6 | Brand Studio | Overview and the eighteen detail states, built from the ElevenLabs frames (replaces new-brand Phase 7) | Same | Not started |
| E7 | Settings and Insights | Seven sections and the dashboard with the Metrics' roll (`PROMPT.md` section 7.7), replacing new-brand Phase 8 | Same | Not started |
| E8 | Sign in and Create account | Eight gate screens and ten onboarding steps, Light only (replaces new-brand Phase 9) | Screens match their frames | Not started |
| E9 | Cleanup | Everything new-brand Phase 10 owes, plus the transparent bevel and glow tokens if CJ agrees, and any bridged name the ElevenLabs phases stopped reading | Nothing legacy left | Not started |

### What Phase E2 left for later phases

- Area icons live in `src/app/components/areas.ts` (`AREA_ICON`). The Sidebar's nav and every `PageHeader` read it, so a new page passes `icon={AREA_ICON.<area>}`, and a page one level down takes its parent's.
- `PageHeader` takes `icon`, and its title kind takes `titleIsHeading` for a page whose own heading sits below the header row (Generate Start), as `currentIsHeading` already did for the trail.
- The header row is `.sp-frame__head`: 64 plus a `--border-subtle` hairline, the Page Header centred in it. Phase E5 moves the builder editor's 44 bar into it, so "bare" will want a header row of its own then.
- Main has no padding. The footer links keep 16 under them, and a "self" page with no footer (the fill page, Generate beside its inline editor) keeps Main's old 16 as its own bottom padding.
- The lockup and the collapsed rail's mark draw inline on `--logo-ink` from `brandArt.ts`. The earlier mark (`BrandMark`, `61:467`) still draws Generate's byline and the public link page's footer, which no phase has changed.
- The theme toggle is Outline Small in the sidebar and stays Ghost Small in the mobile bar.

The new-brand program split tokens from primitives, and this one keeps them together in Phase E1. The ElevenLabs values turn the page and raised surfaces white in Light, so a token-only diff would leave fields, cards and progress tracks invisible on `main` until the next phase merged. Folding the primitives in keeps every screen whole at every merge.

## Screen map

Paths are under `src/app/components/` unless they start with `src/`. Routes and entry points are the ones the new-brand program confirmed (`docs/design/new-brand/PLAN.md`, Screen map). Frames are 1440 by 1053 and every Light frame has a Dark twin except the sign-in gate and Create account.

| Area | Light | Dark | Route | Code entry points |
|---|---|---|---|---|
| Brand Templates | 01 `6010:2064`, 02 Platform filter `6010:2306`, 03 Search `6010:2436` | `6107:1123`, `6107:1381`, `6107:1583` | `/templates?platform=&q=` | `Portal.tsx`, `templates/*` |
| Fill page | 04 `6010:2553`, 05 Filled `6010:2627`, 06 Downloaded `6010:2701`, 07 Public links `6010:2777` | `6107:1766`, `6107:1946`, `6107:2126`, `6107:2310` | `/templates/:id`, `/l/:token` | `TemplateUsePage.tsx`, `TemplateFill.tsx`, `details/DetailsPanel.tsx`, `admin/TemplateLinksDialog.tsx`, `src/app/public/*` |
| Generate | Start `6023:3097`, Attach menu `6023:3153`, Connectors `6023:3236`, Add a detail `6023:3328`, Photo attached `6023:3391`, Details added `6023:3449`, Sent `6023:3520`, Generating `6023:3555`, Result `6023:3578`, Edit `6023:3605`, History `6023:3648` | `6109:1834`, `6109:1980`, `6109:2239`, `6109:2537`, `6109:2701`, `6109:2850`, `6109:3042`, `6109:3200`, `6109:3343`, `6109:3527`, `6109:3789` | `/generate`, `/generate/c/:id`, `/generate/history` | `generate/*`, `chat/*` |
| Template Builder list | List `6072:4269`, Menu `6072:4455`, New template `6072:4650`, Choose a size `6072:4848`, Import from Figma `6072:5107`, Auto build `6072:5308`, Building `6072:5515` | `6109:9059`, `6109:9416`, `6109:9817`, `6109:10214`, `6109:10885`, `6109:11273`, `6109:11682` | `/template-builder` | `admin/AdminTemplates.tsx`, `admin/BuilderTemplateCard.tsx`, `builder/NewTemplateDialog.tsx`, `SizeGallery.tsx`, `FigmaImportDialog.tsx`, `AutoBuildDialog.tsx` |
| Template Builder editor | Text field `6072:3662`, its Field tab `6072:6359`, Blank `6072:3787`, Image field `6072:3855`, its Field tab `6072:6457`, Preview `6072:3928`, Publish `6072:3977`, Published `6072:4139` | `6113:6384`, `6109:12115`, `6109:7591`, `6109:7811`, `6109:12430`, `6113:6757`, `6109:8209`, `6109:8670` | `/template-builder/:id` | `builder/TemplateBuilder.tsx` and the files new-brand Phase 6b lists |
| Brand Studio | Overview `6085:1601`, Colors `6085:1662`, editing `6085:1745`, added `6085:1851`, Logos `6085:1963`, editing `6085:2021`, primary changed `6085:2091`, Type styles `6085:2160`, editing size `6085:2219`, all properties `6085:2278`, Images `6085:2405`, uploaded `6085:2420`, row menu `6085:2456`, Import `6085:2499`, importing `6085:2520`, done `6085:2546`, Fonts `6085:2573`, row menu `6085:2612`, uploading `6085:2657` | `6109:14247` and the eighteen states after it in the same order (`6109:14371` to `6109:16799`) | `/brand-studio/:category` | `admin/BrandStudio.tsx`, `admin/brand/*` |
| Insights | `6095:1030` | `6110:165` | `/insights` | `admin/Dashboard.tsx`, `admin/insights/*` |
| Settings | Workspace `6095:1220`, People `6095:1291`, Integrations `6095:1392`, Plan and usage `6095:1427`, Sharing `6095:1494`, Account `6095:1602`, Advanced `6095:1664` | `6110:1347`, `6110:1536`, `6110:1808`, `6110:1947`, `6110:2110`, `6110:2380`, `6110:2553` | `/settings/:section` | `admin/SettingsAdmin.tsx`, `admin/settings/*` |
| Sign-in gate | Sign in `6101:633`, error `6101:671`, Sign up `6101:710`, error `6101:747`, Check your email `6101:785`, Reset password `6101:810`, Reset link sent `6101:840`, New password `6101:865` | Light only | No session | `PreAppShell.tsx`, `auth/*` |
| Create account | About you `6101:954`, Set up for `6101:1072`, Your team `6101:1184`, First up `6101:1307`, Website `6101:1429`, Add your brand `6101:2067`, Pulling your brand `6101:1538`, Your brand `6101:1652`, Invite your team `6101:1793`, Workspace ready `6101:1912` | Light only | First sign-in with no workspace | `onboarding/*`, `primitives/OptionTile.tsx` |
| Shell | Sidebar `2218:679`, App shell pattern `6227:1078` | Same frames, Dark panel | all | `AppShell.tsx`, `Sidebar.tsx`, `layout/*`, `BrandMark.tsx`, `primitives/PageHeader.tsx`, `src/styles/shell.css` |
| System | Foundations `4012:1192`, Components `4012:1193` and the six type pages, Product components `4012:1194`, Patterns `4012:1195` | Dark panels on every board | `/dev/ui` | `src/styles/*`, `primitives/*`, `src/app/dev/*` |

Component node ids did not change between the two files, so the `(Figma 2206:542)` comments in the primitives stay correct. Screen ids did change, so always pass the new file key and the ids above.

## Scope

In scope: every frame in the screen map, the shell, and the system pages they draw from.

Out of scope: layouts below desktop width (they keep today's behavior on the new tokens), the "Chat box options" frame (`6023:4409`), the Dark frames of the sign-in gate and Create account, the artboard and every tenant graphic, and everything `RULES.md` section 11 lists.
