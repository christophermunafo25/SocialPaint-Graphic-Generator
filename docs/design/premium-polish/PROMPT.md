# Premium polish

You are working in the SocialPaint repo. This prompt builds the changes from CJ's premium UI audit of 2026-11-25, which measured the platform at `main` `ec4a525` against ChatGPT's web app. The audit found a sound system with too many visual decisions still in play at once. This work saves white for what people touch, gives selection and the filter bars a single treatment, lets color come from the workspace's own content, and trims the type and radius scales. Every change is in the chrome. Tenant graphics, previews and exports stay exactly as they are.

Read these in full before the first step: `CLAUDE.md`, `docs/design/elevenlabs/RULES.md`, `docs/design/elevenlabs/PLAN.md`, sections 3 to 6 of `docs/design/elevenlabs/PROMPT.md`, and this prompt.

How this runs:

- No plan mode and no recon gates, the way the ElevenLabs program ran (its decision 14). Build each phase straight through, take the recommended answer to anything this prompt leaves open, and list what you took in the pull request. Stop only before something that can't be undone.
- Each phase is one branch and one pull request into `main`, run in order. If the previous phase hasn't merged yet, branch from it and say so in the pull request.
- Work in steps. Run `npm run verify` and commit after each one, with a message that names the phase and step. Never start a step on a red build.
- Each phase opens with "Check before you change": confirm its findings in the code first. A finding that turns out wrong is skipped and explained in the pull request, and the phase carries on.
- If something here is impossible or wrong once you are in the code, build the closest thing the decision allows and explain the conflict in the pull request (RULES.md section 12, item 7).

Before the first step, save this prompt as `docs/design/premium-polish/PROMPT.md` so the `phase-reviewer` subagent can be pointed at it.

## Rules

This work follows `CLAUDE.md` and `docs/design/elevenlabs/RULES.md`. Several decisions below change a rule from that program on purpose, and the rules file stays the one source for the platform UI.

- **Recording a changed rule.** When a phase builds a decision that changes a line in `RULES.md` or `PLAN.md`, it edits that line in the same pull request and marks it "(CJ, 2026-11-25)", the way the card change of 2026-11-24 was recorded.
- **Tokens.** Values change only in `design/tokens/master.tokens.json`, each with its `resolved` values and an updated `description`, and `npm run tokens` regenerates `src/styles/tokens.css`. Never edit `tokens.css` by hand. This follows #222 and #225, which changed the JSON on CJ's word ahead of the Figma file.
- **Figma.** Don't write to the Figma file. Every variable, style, component and frame that should change to match goes on the phase's list of Figma follow-ups for CJ.
- **Semantic tokens only** in components (RULES.md section 3). A new token aliases a primitive, and a new primitive is added only where a decision names one.
- **Hover changes color and nothing else**, and no shadow or focus ring is ever cut off (RULES.md sections 4 and 6).
- **Both themes.** Build and check every change in Light and Dark. Where a decision names only Light, Dark keeps today's value.
- **Copy** follows RULES.md section 9. Every new or changed string is proposed copy and goes in the pull request.
- **Screens.** Before a phase's first change, capture the baseline: `npm run shots -- capture .shots/before`, `npm run shots -- props .shots/props-before.json` and `node scripts/new-look/contrast.mjs .shots/props-before.json --out .shots/contrast-before.json`. Compare at the gate.

## Decisions

CJ approved these on 2026-11-25 when he asked for this program. Build each one as written.

| # | Build | Changes |
|---|---|---|
| D1 | Light `surface/page` from gray/0 to gray/50 (#FAFAFA), and Light `surface/stage` from gray/50 to gray/100 (#F5F5F5) so the preview stage still reads on the page. Cards, panels, fields, menus and the composer stay white, and the sidebar now shares the page's gray behind its hairline | RULES.md sections 3, 10 and 13. PLAN.md "What changed from v2", the Page row |
| D2 | The composer lifts in Light. A new effect style, Elevation/Composer, pairs a near layer on a new `shadow/composer-near` (alpha/black-5) with a far halo on a new `shadow/composer-far` (a new primitive, alpha/black-3). Both are alpha/transparent in Dark, where the composer already lifts by value. The hairline stays | RULES.md section 4 (raised surfaces are flat, the composer named among them) and its composites table. ElevenLabs decision 3 |
| D3 | Inside the composer, the count stepper drops its `--surface-soft` capsule at rest. Its buttons, count and hit areas stay, and each button hovers on `--state-hover` | PROMPT.md section 5.1, the Stepper row |
| D4 | A new `text/item` color, gray/700 (#333333) in Light and gray/300 (#D4D4D4) in Dark, for Nav Items (the sidebar and the Settings rail), Menu Items and the builder's Layer and Form Rows at rest, icons included. Hover and selected stay `--text-primary`. Metadata, labels, placeholders, header titles and footer links stay `--text-secondary` | RULES.md sections 5 and 6 (nav icons on `--text-secondary` at rest) |
| D5 | The 64 header row loses its bottom hairline on every page, the builder's own bar included | RULES.md sections 4 and 10. ElevenLabs judgement call 12 |
| D6 | The sidebar's theme toggle, collapse and account settings buttons become Ghost icon buttons | RULES.md section 10, the Sidebar row. ElevenLabs judgement call 2 |
| D7 | A selected Chip or Platform Chip takes `--state-selected` under `--text-primary`. Solid ink stays for the one primary action per view | RULES.md section 6, Selected |
| D8 | The filter bar drops to 36. Platform Chips take `--size-control-md` and `--radius-sm`, with the logo at 16 and no tile, no edge at rest, and a down chevron only on the selected chip, where its menu opens. The Medium Search Field sits beside them. This covers the library, History and Choose a size | RULES.md section 4 (the 46 exception) and section 10 (Brand Templates). ElevenLabs judgement calls 3 and 4 |
| D9 | Template cards lose the go arrow and the variation tag over the preview. The meta line keeps "N variations" and shows the variation's name while the card steps through them | RULES.md section 10 (Brand Templates). Template Card `4018:129` |
| D10 | Builder template cards show a status Badge only for Draft | Builder Template Card `4018:156` |
| D11 | When no shelf holds more cards than one row fits at the current width, the library shows one grid in shelf order with no shelf headers. Shelves return once any shelf overflows | The library frame `6010:2064` |
| D12 | Download PNG always draws as an enabled primary on the fill page and the public link. Pressed with a required value missing, it keeps today's behavior and the field shows its error. `aria-disabled` is set only while exporting | Fill page frame 04 (`6010:2553`) and the comment above `incomplete` in `TemplateFill.tsx` |
| D13 | The empty library gives admins one primary button into Template Builder and gives members their own title and line. Search hides while the library is empty | The empty state in `Portal.tsx` |
| D14 | Insights change badges turn Neutral. Exports, Opens and Posted carry an 8 dot in their chart series color beside their label, and Active members carries none | The family tones in `ChangeBadge.tsx`. RULES.md section 7 |
| D15 | Each Brand Studio overview cover shows the workspace's own content once its category has some: colors as swatches, the primary logo on its plate, "Aa" in the heading font, a specimen in the first two type styles, or up to three photos. Empty categories and Import keep the shared art | RULES.md section 2 (shared platform art), and the September decision that covers carry the SocialPaint brand |
| D16 | Type sizes collapse to 12, 14, 16, 18, 24 and 40. Body/S and Label/S go from 13 to 14, Caption/S and Mono/Eyebrow from 11 to 12, Title/Group from 20 to 18 and Title/Page from 30 to 24. Title/Display and Title/Metric stay 40 | RULES.md section 5 (nothing below 11 becomes nothing below 12). PROMPT.md section 3.4 |
| D17 | Generate's Start greeting moves from Title/Display (40) to Title/Section (24) | Generate Start `6023:3097` |
| D18 | Radii follow nesting. `radius/md` and `radius/chip` go from 10 to 8, and `radius/tag` from 6 to 8. Previews and wells inset 8 inside a 16 card move from `--radius-lg` to `--radius-sm`, so their corners stay concentric. `radius/lg` 12 stays for menus, popovers, toasts and message bubbles, whose 8 items sit 4 in. `radius/xs` stays for checkboxes and marks under 20 | RULES.md section 4, the radius table |
| D19 | Polish, item by item: (a) one label style for fields in the builder inspector, and no field label that repeats its section; (b) Caption keeps its label row's Copy and drops the copy button inside the field, on the fill page and the public link; (c) the public link page shows the workspace's logo, or its name, at the top, and its two notes about saving on this device become one status line by Download PNG; (d) Ghost "View all" buttons line their text up with the content edge; (e) a History card with no result shows Generate's area icon in its well; (f) Generate's area icon swaps Sparkles for lucide `SquarePen` | RULES.md section 8 for (f), since `SquarePen` joins the Icons board as a Figma follow-up. RULES.md section 9 for (c), since the two notes are helper copy the rules already rule out |

Kept as they are, with no change from this work:

- Terms of Service and Privacy Policy stay at the bottom of every page (new-brand decision 14).
- The empty image field's label stays at 35% black in `SchemaRenderer`, as `PLAN.md` records under "What the contrast and keyboard pass left".
- The card treatment of 2026-11-24: white, the thin `--border-card` edge, Elevation/Card and its hover.
- Generate's composer stays one line between the plus and Send, with the stepper beside Send.

## The audit's findings

Each phase's first step checks its rows. Measurements are from the 2026-11-25 captures at 1440 in Light unless a row says otherwise.

| # | Finding | Measured | Where |
|---|---|---|---|
| M1 | White text on the Insights banner falls under 4.5:1 | The digest sentence (Title/Group, 20 Medium) sits on art at 3.1:1 at its lightest and 3.5:1 median. The title and date share the art. Axe passes it because it can't read contrast over an image | `.sp-in-digest::before` in `src/styles/insights.css` draws `--surface-scrim` at `opacity: 0.7`, so 35% |
| F1 | Light puts white cards on a white page | `--surface-page` and `--surface-card` are both gray/0, so cards separate only by the 0.5 `--border-card` edge and Elevation/Card. Dark lifts by value: #0A0A0A page, #121212 cards | `master.tokens.json`, `tokens.css` |
| F2 | The composer, the product's hero, sits flat | 720 by 54 at `--radius-composer`, a `--border-raised` hairline on white, no shadow. The stepper's `--surface-soft` capsule is the heaviest thing in the bar | `.ui-composer` and `.ui-stepper` in `src/styles/primitives.css` |
| F3 | Two text colors carry nearly all the chrome | Nav items, placeholders, metadata, header titles and footer links all read `--text-secondary` (#6B6B6B) | `.ui-nav-item`, `.ui-menu-item`, `PageHeader` |
| F4 | Lines that add noise | A `--border-subtle` hairline under the header row on every page, and Outline icon buttons (white fill and an edge) in the sidebar | `.sp-frame__head` in `src/styles/shell.css`, `Sidebar.tsx` |
| F5 | Selected filters use the primary button's ink | Platform Chips and Chips select on `--surface-inverse`, the same ink as Primary, so on Brand Templates the selected filter is the darkest object on screen | `.ui-platform-chip` in `primitives.css` |
| F6 | The filter bars run at 46 | 46 tall at `--radius-chip`, a 36 logo tile and a chevron on every chip, eight controls in the library's bar, where every other toolbar is 36 | `.ui-platform-chip`, `.ui-search[data-size="lg"]`, `.sp-lib-filterbar` |
| F7 | The variation tag covers the template, and the go arrow repeats the card's click | The dark tag over the preview's bottom left hides footer text on Stat highlight and Feature highlight. The meta line already says "2 variations" | `templates/TemplateCard.tsx` (`.sp-tcard__looks`, `.sp-tcard__go`) |
| F8 | Status on every builder card | All six cards say Published beside a filter that says Published 6 | `admin/BuilderTemplateCard.tsx` |
| F9 | Shelves leave rows empty | Six starters sit in five shelves, four of them holding one card, so the library runs 2,425 tall at 1440. Every new workspace starts here | `Portal.tsx`, `templates/PlatformShelf.tsx` |
| F10 | The fill page's main action looks disabled | Download PNG draws `--text-disabled` on `--action-disabled` until required values are in, though it stays pressable and points to what's missing | `TemplateFill.tsx`, `src/app/public/PublicFillPage.tsx` |
| F11 | The empty library has no way forward | No button, the same line for members who can't publish, and a search control with nothing to search | `Portal.tsx` (`.sp-lib-empty`) |
| F12 | KPI badges fill with four brand families | Deep Moss, Ocean Tide, Purple Kara and Orchid as each card's identity, while the arrow and words carry the direction | `admin/insights/ChangeBadge.tsx`, `admin/Dashboard.tsx` (`KPIS`) |
| F13 | Brand Studio covers show SocialPaint's brand to every workspace | Acme's colors are #2F3B4C and #C9A227, and its filled Colors cover shows SocialPaint greens labeled #2BFFA3 | `admin/BrandStudio.tsx`, `src/assets/socialpaint/brand-studio/` |
| F14 | Ten type sizes, most within two pixels of each other | 11, 12, 13, 14, 16, 18, 20, 24, 30 and 40 in use. Class counts in the components: caption-m 77, label-m 60, body-s 52, body-m 52, label-xs 41, label-s 31 | The `.t-*` classes |
| F15 | Radii that rarely share a curve | 6, 8, 10, 12 and 16 plus full in regular use (stylesheet counts: sm 53, xl 33, xs 25, md 22, lg 21). Card previews sit at 12 inside a 16 card with 8 padding | Every `--radius-*` read in `src/styles` |
| F16 | Small things | The builder inspector mixes three label styles and repeats SIZE over Size. Caption has two copy controls. The public link never says whose page it is and explains local saving in two notes. "View all" sits 13 to 21 inside the content edge. History shows empty wells. Generate's icon is Sparkles | `builder/InspectorControls.tsx`, `details/DetailsPanel.tsx`, `public/PublicFillPage.tsx`, `generate/RecentChats.tsx`, `templates/PlatformShelf.tsx`, `generate/HistoryCard.tsx`, `areas.ts` |
| F17 | The greeting is louder than the screen needs | Generate's Start greeting is Title/Display, 40 Medium | Generate Start |

## Phases

| Phase | Builds | Done when |
|---|---|---|
| P1 | Surfaces, the composer and the banner: M1, D1 to D6 | The banner passes 4.5:1, Light is off-white with white kept for what people touch, and the composer matches the reference profile |
| P2 | Selection and the filter bars: D7, D8 | Every filter bar is 36 and every selected chip is gray, on all three surfaces that use them |
| P3 | Cards, the library and the fill page: D9 to D13 | Cards show only the template, a small library reads as one grid, and every main action reads as available |
| P4 | Color from content: D14, then D15 as its own pull request | Chrome color comes from chart series and the workspace's own brand |
| P5 | The type and radius scale: D16 to D18 | Six type sizes and nested radii, with nothing clipped or overflowing at 1440, 1024 and 390 |
| P6 | Polish: D19 | Each item built, or skipped with the reason |

---

## Phase P1: Surfaces, the composer and the banner

### Why this phase exists

The page and nearly everything on it are pure white in Light, so nothing lifts by value and the composer, the product's hero, reads as an outline. The banner's white text also misses AA. This phase moves Light to the model Dark already uses and fixes the banner.

### Read before writing

| File | Why |
|---|---|
| `design/tokens/master.tokens.json` | `color` (surface/page, surface/stage, surface/shell, the description of surface/raised, text/*, shadow/*), `primitives` (alpha), `effectStyles` |
| `scripts/build-tokens.mjs` | How colors, effect styles and descriptions become `tokens.css`, and what `tokens:check` compares |
| `src/styles/insights.css` | `.sp-in-digest`, its `::before` scrim and `__tile` |
| `src/styles/shell.css` | `.sp-frame__head`, its hairline and the min-height that counts it |
| `src/styles/template-builder.css` | `.sp-builder__bar`, the editor's own header row |
| `src/styles/primitives.css` | `.ui-composer`, `.ui-stepper`, `.ui-iconbtn` and its variants, `.ui-nav-item`, `.ui-menu-item` |
| `src/app/components/Sidebar.tsx` | `SidebarThemeToggle` and the Outline collapse and settings buttons |
| `src/app/components/primitives/Navigation.tsx`, `primitives/Menu.tsx` | Nav Item and Menu Item at rest |
| `src/app/components/builder/` | The Layer and Form Rows that take `text/item` |
| `src/app/components/chat/ChatComposer.tsx` | The composer and its stepper |
| `docs/design/elevenlabs/PLAN.md`, "Card edges" | How the last token change was recorded, and the kind of measurement it used |

### Scope

In: the tokens D1, D2 and D4 name, the components that read them, the banner's scrim, the header row's hairline, the sidebar's three buttons, the composer's shadow and its stepper.

Out: everything later phases own, Dark values no decision names, and the sign-in gate's own composer (`.sp-auth-composer`).

### What not to touch

- `SchemaRenderer.tsx`, `src/lib/render/**` and the export path. Previews and exports never read a platform token (RULES.md section 2).
- The card treatment of 2026-11-24.
- `src/lib/types.ts`, `src/lib/stores/**`, `supabase/**` and the migrations.

### Steps

#### Step 1: Check before you change

- Capture the baseline (Rules, Screens).
- Confirm M1 and F1 to F4 in the code and on the baseline, with file and line.
- List every element that paints a token resolving to gray/50 in Light (`surface/shell`, `surface/stage`, `plate/light` and any other) directly on `surface/page`, and every place that uses `surface/page` as a fill, such as `.sp-in-digest__tile`. Each one either keeps working on #FAFAFA or gets its fix in Step 3.

#### Step 2: The banner (M1)

- Remove `opacity: 0.7` from `.sp-in-digest::before`, so the scrim is `--surface-scrim` at its full 50%. The audit's arithmetic puts the lightest spot at about 4.7:1.
- Measure the lightest spot behind each line of white text at 2x, in both themes. A short Playwright script on the dev server with `deviceScaleFactor: 2`, seeded the way `scripts/new-look/shots.mjs` seeds it, is enough. Sample the art around and between the lines. Every spot reaches 4.5:1.
- If a spot misses, add the alpha step that passes as a new primitive with its own semantic token for the banner's scrim, and report the numbers.
- Record the banner in RULES.md section 13, and in the pull request as an exception to the frame's drawn 35%.

#### Step 3: The off-white page (D1)

- In the JSON, Light `surface/page` aliases gray/50 and Light `surface/stage` aliases gray/100. Update the description of `surface/raised`, which says it matches the page in Light. Run `npm run tokens`.
- Fix each item from Step 1's list through the token it should read. No literals.
- Check every screen in Light. White cards, panels, fields and menus now lift off the page, the sidebar and Main read as one surface split by the sidebar's hairline, and the fill page's stage still reads against the page.

#### Step 4: The item text color (D4)

- Add `text/item` to the JSON, gray/700 in Light and gray/300 in Dark, with its description. Regenerate.
- Nav Item, Menu Item and the builder's Layer and Form Rows read it at rest for label and icon. Hover and selected stay `--text-primary`, and nothing else changes color.
- It reads 12.10:1 on #FAFAFA and 11.59:1 on the #F5F5F5 hover in Light, and 12.64:1 on the #121212 shell in Dark.

#### Step 5: The header row and the sidebar buttons (D5, D6)

- `.sp-frame__head` drops its `border-bottom` and the hairline its `min-height` adds, so the row is 64. `.sp-builder__bar` does the same.
- In `Sidebar.tsx` the theme toggle, collapse and account settings buttons take the Ghost Icon Button: no fill and no edge at rest, `--state-hover` on hover, the glyph on `--text-secondary` at rest and `--text-primary` on hover. The mobile bar is already Ghost.

#### Step 6: The composer (D2, D3)

- Add the primitive alpha/black-3, the colors `shadow/composer-near` (alpha/black-5 in Light) and `shadow/composer-far` (alpha/black-3 in Light), both alpha/transparent in Dark, and the effect style Elevation/Composer as `--elevation-composer`. Start from `0 1px 3px 0 var(--shadow-composer-near), 0 8px 40px 0 var(--shadow-composer-far)`.
- `.ui-composer` keeps its hairline and adds `box-shadow: var(--elevation-composer)`. The focus outline on `.ui-composer:has(.ui-composer__input:focus-visible)` still draws outside it.
- Tune the two layers against CJ's reference, ChatGPT's composer as measured from his screenshots on 2026-11-25. Below the composer the page darkens by 3.5% at 0.5 from the edge, 2% at 4, 1.2% from 8 to 14, 0.8% from 15 to 36 and 0.4% from 37 to 66, then nothing. Above it the page darkens by 2% at 0.5, 1.2% at 4, 0.8% from 7 to 28 and 0.4% from 29 to 58. Measure your render at 2x on Generate Start in Light and land within half a point of each value.
- No container clips the halo. Generate Start's column and the thread's scroll region get the RULES.md section 4 padding and negative margin if they do.
- Inside `.ui-composer`, the stepper's capsule drops `--surface-soft`. The minus, the count and the plus keep their hit areas, and each button hovers on `--state-hover`. The Stepper elsewhere keeps its capsule.

#### Step 7: Rules and records

- RULES.md: section 3 for the new tokens; section 4, where the composer is no longer flat and Elevation/Composer joins the composites table; sections 5 and 6 for `text/item`; section 10 for Main on the off-white page, the header row without its hairline and the Ghost sidebar buttons; section 13 for secondary text at 5.11:1 on the page and 4.89:1 on the stage, and for the banner.
- PLAN.md: a "Premium polish" note under the decisions listing D1 to D6, and the Page row of "What changed from v2".
- Figma follow-ups: the variables and effect style above, the Sidebar's three buttons, the Page Header's hairline, the Composer, and the Insights digest's scrim.

### Gate

- `npm run verify` and `npm run build` pass.
- The screenshot comparison shows only the page and stage color, the item text color, the header row, the sidebar buttons, the composer and the banner. Explain anything else.
- `npm run shots -- props .shots/props-after.json`, then `node scripts/new-look/contrast.mjs .shots/props-after.json --baseline .shots/contrast-before.json`, reports nothing worse except secondary text on the page (5.33:1 to 5.11:1) and on the stage (to 4.89:1), both still above 4.5.
- The pull request carries the banner's lightest spots in both themes, the composer's measured profile beside the reference values, and Generate Start before and after in Light.
- `npm run shots -- a11y .shots/a11y-after.json` is clean apart from the empty image label PLAN.md keeps.
- No shadow or focus ring is cut off anywhere, the composer's halo included.

---

## Phase P2: Selection and the filter bars

### Why this phase exists

The library's selected filter uses the primary button's ink, so it is the darkest object on screen and competes with the page's real action. The filter bars are also the only 46 controls in the app, with a tile and a chevron on every chip.

### Read before writing

| File | Why |
|---|---|
| `src/styles/primitives.css` | `.ui-platform-chip` and the comment above it, `.ui-chip`, `.ui-search[data-size="lg"]` and `[data-size="md"]` |
| `src/app/components/primitives/Chips.tsx`, `primitives/SearchField.tsx` | Platform Chip, Chip and Search Field, and their tests |
| `src/styles/brand-templates.css` | `.sp-lib-filterbar`, `.sp-lib-chips` and the rail's 12 padding |
| `src/app/components/Portal.tsx` | The library's filter bar |
| `src/app/components/generate/GenerateHistoryPage.tsx`, `src/styles/generate.css` | History's filter bar |
| `src/app/components/builder/SizeGallery.tsx` | Choose a size, where the chips sit beside the Medium search |

### Scope

In: the selected state of Chip and Platform Chip, the Platform Chip's size and anatomy, and the Search Field each bar uses.

Out: Segmented Controls, which keep their thumb, and Tabs.

### What not to touch

- The chip menus' contents and the filtering logic.
- Everything P1 changed.

### Steps

#### Step 1: Check before you change

- Capture the baseline.
- Confirm F5 and F6 on the library, History and Choose a size.

#### Step 2: Selected (D7)

- Chip and Platform Chip take `--state-selected` under `--text-primary` when selected, and the selected Platform Chip's glyph is `--text-primary` too. Pressed stays as it is.

#### Step 3: The 36 bar (D8)

- Platform Chip: `--size-control-md` tall at `--radius-sm`, the logo at `--size-icon-sm` with no tile, no edge at rest and `--action-neutral-hover` on hover. A down chevron shows only on the selected chip, which opens its menu as it does today.
- The library and History use the Medium Search Field.
- The chip rail keeps its 12 padding so no focus ring is cut.
- Update the Chips and Search Field tests to the new sizes and states.

#### Step 4: Rules and records

- RULES.md: section 4, where the 46 exception goes; section 6, Selected; section 10, Brand Templates. PLAN.md: judgement calls 3 and 4.
- Figma follow-ups: Platform Chip `53:96`, Chip `2212:187`, Search Field `50:62` and the Filter bar pattern `6227:1610`.

### Gate

- `npm run verify` and `npm run build` pass.
- The comparison shows only the three filter bars and selected chips.
- A keyboard pass finds the ring on every chip, uncut.
- The a11y run is as clean as P1 left it.

---

## Phase P3: Cards, the library and the fill page

### Why this phase exists

The template card draws two things on top of the template, a new workspace opens onto a mostly empty library, and the fill page's one primary action looks unavailable until the form is complete.

### Read before writing

| File | Why |
|---|---|
| `src/app/components/templates/TemplateCard.tsx` | The card button, `.sp-tcard__looks` (the tag), `.sp-tcard__go` (the arrow), and how hover and focus step through variations |
| `src/styles/brand-templates.css` | `.sp-tcard*`, `.sp-lib-shelf*`, `.sp-lib-empty` |
| `src/app/components/admin/BuilderTemplateCard.tsx` | The status Badge |
| `src/app/components/Portal.tsx` | Browsing, the shelves, search and the empty state |
| `src/app/components/templates/PlatformShelf.tsx`, `src/lib/templates/groups.ts` | Shelves and their groups |
| `src/app/components/TemplateFill.tsx` | `incomplete`, `aria-disabled` and the missing-field path |
| `src/app/public/PublicFillPage.tsx` | The public link's Download PNG |
| `src/app/components/details/DetailsPanel.tsx` | How a missing required value shows its error |

### Scope

In: the template card's chrome, the builder card's Badge, the library's layout choice and empty state, and Download PNG's look on the fill page and the public link.

Out: the preview itself, which is a tenant graphic, and every search and platform result view.

### What not to touch

- `SchemaRenderer`, `TemplateThumbnail` and how variations render.
- The validation and export logic behind Download PNG. Only its look and `aria-disabled` change.

### Steps

#### Step 1: Check before you change

- Capture the baseline.
- Confirm F7 to F11.

#### Step 2: Cards (D9)

- Remove the arrow and the tag. While a card steps through its variations, its meta line shows the variation's name in place of the count, then returns to the count. Reduced motion shows the first variation, as it does today.
- The card stays one button with its keyboard ring.

#### Step 3: Builder status (D10)

- The Badge shows only for Draft.

#### Step 4: One grid for a small library (D11)

- A pure helper decides between shelves and one grid from the groups and the number of cards one row fits at the current width (the shelf card is 302 wide; read the gap from the stylesheet). It has tests.
- One grid reuses the Template Builder list's grid. Resizing across the threshold keeps the scroll position, and the platform and search views keep their result groups.

#### Step 5: The fill page's action (D12)

- Download PNG draws as an enabled primary in every state but exporting. Pressed early, it keeps today's behavior: it says what is missing and moves focus to the field, and the field shows its error. `aria-disabled` is set only while exporting.
- The public link does the same.
- Tests for both states on both pages.

#### Step 6: The empty library (D13)

- Admins keep "Publish your first template" and its line and get one primary button, "Open Template Builder", to `/template-builder`.
- Members get "No templates yet" and "Templates show up here once your team publishes them."
- Search hides while the library is empty.
- All three strings are proposed copy. Tests for both roles.

#### Step 7: Rules and records

- RULES.md: section 6 (the template card) and section 10 (Brand Templates and the fill page), plus the comment above `incomplete` in `TemplateFill.tsx`.
- Figma follow-ups: Template Card `4018:129`, Builder Template Card `4018:156`, the library frame `6010:2064`, fill page frame 04 `6010:2553` and its public link twin.

### Gate

- `npm run verify` and `npm run build` pass.
- The comparison shows only the cards, the library's layout, the empty state and Download PNG.
- A screenshot of the library with the six starters, in both themes, before and after.
- The a11y run is as clean as P2 left it.

---

## Phase P4: Color from content

### Why this phase exists

The chrome's color should come from what the workspace makes. Insights paints each metric in a brand family that carries no meaning, and Brand Studio shows SocialPaint's own colors on a workspace's filled categories.

### Read before writing

| File | Why |
|---|---|
| `src/app/components/admin/insights/ChangeBadge.tsx` | `TONE` and `KpiFamily` |
| `src/app/components/admin/Dashboard.tsx` | `KPIS` and how each Metric gets its badge |
| `src/app/components/primitives/Containers.tsx` | `Metric` |
| `src/app/components/admin/insights/TrendCard.tsx` | The series colors: `--accent-green`, `--accent-blue`, `--accent-purple` |
| `src/app/components/admin/BrandStudio.tsx`, `src/app/components/admin/brand/` | The overview cards and what each category's data holds |
| `src/styles/brand-studio.css` | `.sp-bs-cat` and `.sp-bs-cat__cover`, which keeps 3:2 |
| `src/assets/socialpaint/brand-studio/` | The shared cover art |

### Scope

In: the change badges, a series dot on Metric, and the overview covers.

Out: the trend chart, the detail pages of Brand Studio, and the shared art for empty categories and Import.

### What not to touch

- `BrandKit` and every table column. If a cover needs data the types can't carry, build the rest and propose the shape in the pull request.
- How tenant fonts load for graphics. A cover reuses that path, and the chrome's own faces stay private (RULES.md section 5).

### Steps

#### Step 1: Check before you change

- Capture the baseline.
- Confirm F12 and F13. List what each category's data offers a cover, and how a tenant font loads for previews.

#### Step 2: Badges and dots (D14)

- ChangeBadge uses the Neutral tone for every metric, keeping its arrow, its words and its screen reader copy.
- Metric takes an optional series color and draws an 8 dot before its label. Exports, Opens and Posted pass the tokens TrendCard uses, so each dot matches its chart series. Active members passes none.
- Tests for the badge and the dot.

#### Step 3: Covers from content (D15), as its own pull request

- Each category's cover, once the category has content, draws on `--plate-light` or the plate a logo's tag asks for. Colors shows up to six swatches. Logos shows the primary logo. Fonts shows "Aa" in the primary heading font. Type styles shows a two-line specimen in the first two styles. Images shows up to three photos cropped to the cover.
- Import and every empty category keep the shared art.
- A cover loads as a skeleton in the cover's shape, nothing shifts as data arrives, the hover and the 0.98 press stay, and a tenant font never reaches chrome text.
- Tests for which cover each state gets.

#### Step 4: Rules and records

- RULES.md: section 2 (shared art for empty categories and Import only) and section 7.
- Figma follow-ups: the Metric and Badge boards, the Insights frame `6095:1030`, and the Brand Studio overview `6085:1601` with its covers.

### Gate

- `npm run verify` and `npm run build` pass, for each pull request.
- Insights in both themes, before and after, and Brand Studio's overview for an empty workspace and for the seeded one.
- The a11y run is as clean as P3 left it.

---

## Phase P5: The type and radius scale

### Why this phase exists

Ten type sizes, most within two pixels of each other, read as inconsistency, and six radii mean nested shapes rarely share a curve. This phase touches every screen, so it runs after the others have settled.

### Read before writing

| File | Why |
|---|---|
| `design/tokens/master.tokens.json` | `textStyles` and the radius entries in `scale` |
| `src/styles/` | Every `--radius-*` read, by component |
| `src/app/` | Every `.t-*` class, against the counts in F14 |
| `docs/design/elevenlabs/RULES.md` sections 4 and 5 | The radius table and the type rules |

### Scope

In: the token values D16 and D18 name, the components that move from `--radius-lg` to `--radius-sm`, the greeting's style, and the layout fixes the larger small sizes need.

Out: Title/Display and Title/Metric, and folding the duplicate text styles D16 leaves, which is later cleanup.

### What not to touch

- Tenant graphics and everything inside the artboard, which never read platform type or radii.
- Class names. Every `.t-*` class keeps its name, so components don't change for D16.

### Steps

#### Step 1: Check before you change

- Capture the baseline at 1440, 1024 and 390 in both themes.
- Confirm F14, F15 and F17. List every element on `--radius-lg` and whether it sits 8 inside a 16 card.

#### Step 2: Radii (D18)

- In the JSON, `radius/md`, `radius/chip` and `radius/tag` become 8. Regenerate.
- The previews and wells that sit 8 inside a 16 card move from `--radius-lg` to `--radius-sm`: the template, builder template, recent and history card previews, and Brand Studio's plates and swatches. Menus, popovers, toasts and message bubbles stay on `--radius-lg`.

#### Step 3: Type (D16)

- In the JSON, each changed style becomes a copy of the style it now matches: Body/S of Body/M, Label/S of Label/M, Caption/S of Caption/M, Title/Group of Title/Card, and Title/Page of Title/Section. Mono/Eyebrow becomes 12/16 and keeps its +4% and uppercase. Regenerate.
- Fix whatever the larger small sizes push, in the 320 inspector, the 380 Details panel, Settings and the builder rail at 1440 and 1024. Fix the layout, and never shrink the type back to make room.

#### Step 4: The greeting (D17)

- Generate Start's greeting takes Title/Section. Put Start before and after side by side in the pull request.

#### Step 5: Rules and records

- RULES.md: section 4's radius table and section 5 (nothing below 12). PROMPT.md section 3.4.
- Figma follow-ups: the radius variables, the five text styles, and the Generate Start frame.

### Gate

- `npm run verify` and `npm run build` pass.
- Every route at 1440, 1024 and 390 in both themes, checked for clipping, truncation, wrapped labels and overflow. List each fix.
- The contrast report against the baseline shows nothing worse.
- The a11y run is as clean as P4 left it.

---

## Phase P6: Polish

### Why this phase exists

Small inconsistencies the audit found, each cheap on its own, that together decide whether the product reads as finished.

### Read before writing

| File | Why |
|---|---|
| `src/app/components/builder/InspectorControls.tsx`, `builder/ElementPalette.tsx` | The inspector's section headings and field labels |
| `src/app/components/details/DetailsPanel.tsx`, `primitives/Field.tsx` | Caption's label row action and the TextArea's `copy` prop |
| `src/app/public/PublicFillPage.tsx`, `src/app/public/PublicFrame.tsx` | The public page, its two notes and its footer |
| `src/app/components/generate/RecentChats.tsx`, `templates/PlatformShelf.tsx`, `admin/insights/` | The Ghost "View all" buttons |
| `src/app/components/generate/HistoryCard.tsx` | The empty well |
| `src/app/components/areas.ts` | `AREA_ICON.generate` |

### Scope

In: the six items of D19.

Out: generated captions outside the fill page and the public link, which keep their copy button.

### What not to touch

- The public payload's shape, unless (c) needs it. Then build the rest and propose the change in the pull request, with Edge Function mirrors kept byte-identical.

### Steps

#### Step 1: Check before you change

- Capture the baseline.
- Confirm each part of F16.

#### Step 2: The six items (D19)

- (a) Section headings in the inspector stay Mono/Eyebrow. A field label that repeats its section heading goes, so SIZE over Size keeps SIZE, and every other field label uses Label/XS on `--text-secondary`.
- (b) Caption keeps its label row's Copy and drops the TextArea's copy button, on the fill page and the public link.
- (c) The public link page shows the workspace's primary logo at the top, 24 tall on the plate its tag asks for, or the workspace's name in Label/M when there is no logo. The two notes about saving on this device become one status line by Download PNG, "Saved on this device", as proposed copy.
- (d) Each Ghost "View all" pulls its label onto the content edge with a negative inline margin equal to its padding, so the text lines up and the hit area keeps its size.
- (e) A History card with no result shows Generate's area icon at 18 on `--text-secondary`, centered in its well.
- (f) `AREA_ICON.generate` becomes lucide `SquarePen`, which also changes Generate's Nav Item and page header.

#### Step 3: Rules and records

- RULES.md: section 8 for `SquarePen` and section 9 for the public link's notes.
- Figma follow-ups: `SquarePen` on the Icons board, the inspector boards, the History Card `4018:1728`, and the public link frame.

### Gate

- `npm run verify` and `npm run build` pass.
- The comparison shows only the six items.
- The a11y run is as clean as P5 left it.

---

## Not in this work

- Moving Terms of Service and Privacy Policy, which new-brand decision 14 keeps on every page.
- The empty image field's label in `SchemaRenderer`, which PLAN.md keeps as drawn.
- Tenant graphics, previews and exports: `SchemaRenderer`, `renderSchemaBlob`, `exportSchemaPng` and `canvasGesture.ts`.
- `TemplateSchema`, `TemplateField`, `LayoutGroup`, `BrandKit` and every table column.
- The sign-in gate's art and its composer, and any Dark value no decision names.
- Writing to the Figma file.
- A custom icon set. The Generate glyph is the only icon change.
- Folding the duplicate text styles D16 leaves.

## Gate report (every phase)

End each phase with this report. Then run `phase-reviewer`, naming this prompt, the phase and `docs/design/elevenlabs/RULES.md` as the rules it follows. Fix every must-fix finding and open the pull request into `main`.

1. Commits, one line each.
2. The decisions built, any finding the check corrected or skipped, and every RULES.md and PLAN.md line changed.
3. Tests added, by file.
4. Screenshots of every changed screen in Light and Dark with the comparison, and the contrast report against the baseline.
5. Figma follow-ups: every variable, style, component and frame the file needs to match.
6. Proposed copy: every string the phase added or changed.
7. Anything outside the scope you noticed and left alone, and anything you were unsure of.
8. The tails of `npm run verify` and `npm run build`.
