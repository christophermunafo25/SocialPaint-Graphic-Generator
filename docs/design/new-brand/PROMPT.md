# New brand: the platform on the new design system

This is the Claude Code prompt for moving the SocialPaint platform onto the design system and screens in the Figma file "Master UX UI New Brand (Copy)" (`1dYWgFH2V8i9Jez2ylI3ky`). Save it in the repo as `docs/design/new-brand/PROMPT.md`.

It replaces the Figma file "Master UX-UI" (`mEJRslarcQDkgPeY6AObi5`) as the source of truth for platform UI. It does not replace `docs/design/new-look/`. That program built the structure this one restyles, and its loop (plan, steps, `npm run verify`, screenshots, one pull request per phase) is the loop this one uses.

**Start with Phase 0 (section 12). It writes no product code.** Read this file, `CLAUDE.md`, `docs/design/new-look/PLAN.md`, `RULES.md` and `BRIDGE.md` in full first. Connect the Figma MCP server before you start, because this prompt names nodes instead of carrying pictures of them.

---

## 1. Sources of truth

**Figma file** `1dYWgFH2V8i9Jez2ylI3ky`. Read frames and components by node id with `get_design_context`, `get_screenshot` and `get_variable_defs`. Every product frame is 1440 wide.

| Page | Node | Holds |
|---|---|---|
| Design System | `2201:2` | Overview board `2202:2` with the page index and counts |
| Foundations | `4012:1192` | Color, Typography, Spacing, Radius, Control sizes, Elevation, Borders and focus, Icons, Motion |
| Components | `4012:1193` | Shared components, one board per group, each block in Light with a Dark preview under it |
| Product components | `4012:1194` | Pieces that belong to one area, same Light and Dark layout |
| Patterns | `4012:1195` | App shell (the Sidebar), Generate, Insights, Forms and overlays |
| Docs | `4012:1196` | The audit of the earlier system, decisions, accessibility notes, final check |
| Brand Templates | `2308:2` | 7 states, Light and Dark |
| Generate | `8:674` | 11 states, Light and Dark |
| Template Builder | `8:675` | 15 frames, Light only, plus three proposal sections |
| Brand Studio | `8:676` | 19 states, Light and Dark |
| Insights and Analytics | `8:677` | 1 screen, Light and Dark |
| Settings | `8:678` | 7 sections, Light and Dark |
| Sign in and sign up | `194:2` | 8 screens. Built in Light only |
| Create account | `257:2` | 10 steps, Light only |

Many screen node ids are the same ones `docs/design/new-look/PLAN.md` lists for the old file (`13:1453`, `13:832`, `13:14570` and so on). The ids match but the file is different, so always pass the new file key.

**In the repo**, the things this program builds on:

- `CLAUDE.md`. Its "Architecture to build on, never around" section and its rules apply to every phase here without exception.
- `docs/design/new-look/`: the earlier program. Its decisions stand unless section 2, 2b or 7 of this prompt changes them.
- `design/tokens/master.tokens.json`, `design/tokens/figma-export/code.js`, `scripts/build-tokens.mjs`, `src/styles/tokens.css`: the token pipeline.
- `src/app/components/primitives/` and `src/styles/primitives.css`: the shared controls.
- `scripts/new-look/shots.mjs` and `/dev/ui`: the screenshot loop and the primitives sheet.

Where this prompt and the Figma file disagree, the file wins and you record the difference. Where this prompt says something about the code that turns out to be wrong once you are in it, stop and say so instead of improvising.

---

## 2. What is settled

CJ made these calls. Build them and do not re-ask.

1. **The new file is the source of truth** for tokens, components and screens. Tokens keep Figma's names.
2. **New brand palette.** Slime is `#2BFFA3` and Deep Moss is `#123D34`. The full primitive set is in section 4.
3. **Primary buttons are Slime with a primary black label in both themes** (`--action-primary` under `--action-on-primary`). Deep Moss with a Slime label is gone from buttons.
4. **Destructive buttons are `#FA3030` with a white label in both themes** (`--action-danger` under `--action-on-danger`).
5. **Focus is a 2 px ring, 2 px outside the element, on every interactive control**, text fields included. It replaces the 1 px ring and the caret-only field focus.
6. **Disabled controls take their own colors** (`--action-disabled` under `--text-disabled`). The 40% opacity rule is gone.
7. **A dialog's close button sits in its top right corner.**
8. **"Looks" are called "variations"** in every string the interface shows.
9. **Brand Templates is form only.** A template opens straight to the fill form, then Download PNG, then Download again and Post to LinkedIn. Bulk fill and Public link are options on the fill page. There are no AI chat frames on that page.
10. **The Generate chat box** takes the platform from the plus menu, and its count control is a plus and minus in a gray capsule beside Send with no "variations" word. The frame "Chat box options" (`2345:2827`) is exploration and is not built.
11. **The Generate result is one card with sizes as tabs.**
12. **Every component and pattern is drawn in Light and Dark** in the file, and the platform supports both everywhere except the two flows in decision 16.
13. **Lists and cards load as skeletons**, using the Loading states the components carry.
14. **Terms of Service and Privacy Policy links sit at the bottom of every page** (Footer Links).
15. **No helper copy.** Nothing in the interface explains how the interface works.
16. **Sign in and Create account are Light only.** The sign-in page has Dark frames in the file. They are not built.
17. **A shadow is never cut off.** No card, chip or panel loses part of its shadow to a container edge. Section 7b says how.

Still true from the earlier program: phases go straight to `main` as one pull request each, the app stays multi-tenant, and the frames show sample content that is never seeded into an account.

---

## 2b. Judgement calls

CJ asked for these to be decided on best judgement instead of being put to him. Build them as written. List them in the Phase 0 report so he can overturn any of them.

1. **The template chat is hidden, not deleted.** The fill page no longer links to it and `/templates/:id/chat` redirects to `/templates/:id`. Leave `generate/TemplateChatPage.tsx` and its logic in place and do not restyle them. The cleanup phase removes whatever nothing reads by then. A member who has the old address still lands somewhere useful, and the work is not thrown away while the flow is still being decided.
2. **Template Builder gets Dark without frames.** Its chrome is built from the same tokens and components as every other screen, so it follows the theme. The artboard is a tenant's graphic and is never themed. Review its Dark by screenshot at the gate and check contrast on anything the builder draws itself (selection boxes, handles, the tools column).
3. **Both search components stay, with different jobs.** Search Field (`50:62`), the button that opens into a field, goes in the gallery filter bars beside the platform chips: Brand Templates, Generate History and the Template Builder list. Search (`2207:455`), the open input, goes where search is the main control of a panel or picker.
4. **The template card keeps stepping through its variations on hover and on keyboard focus.** It is CJ's earlier decision, it is built, and it shows what a template offers before anyone opens it. The swap uses `--motion-duration-base` with `--motion-easing-standard`, and with reduced motion on the card shows its first variation only.
5. **"Variations" reaches the code as components are rebuilt.** When a phase rebuilds a component, its name, class and props take the new word (`LookTile` becomes `VariationTile`, `.ui-look-tile` becomes `.ui-variation-tile`, `LookPicker` becomes `VariationPicker`). Data types and columns keep their names. There is no separate rename sweep.
6. **Every page uses one header row.** The frames place page titles at four different heights. The Page Header component wins: a row 36 tall, 16 below the top of Main, with the title centered in it. Titles then sit at the same height on every page. Section 7b has the measurements.

---

## 3. What does not change

- `SchemaRenderer`, `renderSchemaBlob`, `exportSchemaPng` and `canvasGesture.ts` stay the only paths they are today. This program restyles the chrome around graphics and never changes how a graphic is drawn or exported.
- `TemplateSchema`, `TemplateField`, `LayoutGroup`, `BrandKit` and every table column stay frozen. If a frame needs data the types cannot carry, propose the exact shape at that phase's gate and wait.
- Tenant brand kits style the graphics members make and never the platform chrome. The chrome reads only `tokens.css`.
- The template art in the frames (the "Now hiring" post, the size covers' sample posts, names, counts, chart data) is sample content.
- `docs/brand-system/` keeps running on its own plan. Where a Brand Studio frame here and that program's built behavior disagree, list the difference at the gate instead of picking one.
- Migrations stay additive. Edge Function mirrors stay byte-identical to their twins.

---

## 4. Tokens

The file has three variable collections with 193 variables, 20 text styles and 6 effect styles. Every variable has WEB code syntax, and each CSS name is the variable name with slashes turned into hyphens (`surface/page` is `--surface-page`, `space/8` is `--space-8`).

| Collection | Modes | Count | Holds |
|---|---|---|---|
| Primitives | Value | 65 | Raw colors. Components never read these |
| Color | Light, Dark | 76 | Semantic colors. Every value is an alias to a primitive |
| Scale | Value | 52 | Spacing, radius, control and icon sizes, strokes, type sizes and weights, font families, motion |

### 4.1 The pipeline has to change first

`design/tokens/figma-export/code.js` looks for collections named Primitives, Brand, Radius and Spacing, and `scripts/build-tokens.mjs` reads a JSON shaped the same way. The new file has Primitives, Color and Scale, and Scale carries string values (font families, easing curves) beside numbers. Phase 1 updates the exporter, the JSON shape, the generator and `tokens:check` together, re-exports from the new file, and keeps every guarantee the pipeline has today: nobody edits `tokens.css` or the JSON by hand, CI fails when they disagree, and no other stylesheet declares a token-owned name at theme level.

### 4.2 Primitives

| Primitive | Value | Primitive | Value | Primitive | Value |
|---|---|---|---|---|---|
| `--neutral-0` | `#FFFFFF` | `--alpha-black-5` | `#0000000D` | `--pink-soft-pink` | `#FFDEFC` |
| `--neutral-50` | `#F9F9F8` | `--alpha-black-10` | `#0000001A` | `--warm-fire` | `#FF6A57` |
| `--neutral-100` | `#F1F1EF` | `--alpha-black-15` | `#00000026` | `--warm-choco` | `#4C2116` |
| `--neutral-200` | `#ECECEC` | `--alpha-black-30` | `#0000004D` | `--warm-peach` | `#FFE2D4` |
| `--neutral-300` | `#D1D1D1` | `--alpha-slime-10` | `#2BFFA31A` | `--warm-cream` | `#FFFEF1` |
| `--neutral-400` | `#A0A0A0` | `--alpha-slime-30` | `#2BFFA34D` | `--purple-violet` | `#B595FF` |
| `--neutral-600` | `#636363` | `--alpha-slime-60` | `#2BFFA399` | `--purple-kara` | `#4B3383` |
| `--neutral-700` | `#232425` | `--alpha-transparent` | `#FFFFFF00` | `--purple-lilac` | `#F2E8FF` |
| `--neutral-800` | `#171817` | `--green-slime` | `#2BFFA3` | `--red-50` | `#FFEBEB` |
| `--neutral-900` | `#0B0B0C` | `--green-slime-hover` | `#28EB97` | `--red-200` | `#FEB7B6` |
| `--alpha-ink-5` | `#0B0B0C0D` | `--green-slime-pressed` | `#26D88B` | `--red-300` | `#FF9594` |
| `--alpha-ink-8` | `#0B0B0C14` | `--green-deep-moss` | `#123D34` | `--red-400` | `#FE6766` |
| `--alpha-ink-12` | `#0B0B0C1F` | `--green-deep-moss-hover` | `#254D44` | `--red-600` | `#FA3030` |
| `--alpha-ink-16` | `#0B0B0C29` | `--green-deep-moss-pressed` | `#385C55` | `--red-700` | `#D0121C` |
| `--alpha-ink-45` | `#0B0B0C73` | `--green-lime` | `#BCFFDA` | `--red-800` | `#A40B13` |
| `--alpha-ink-50` | `#0B0B0C80` | `--green-mint` | `#E6FFF1` | `--red-950` | `#3D1011` |
| `--alpha-ink-72` | `#0B0B0CB8` | `--blue-lapis` | `#6EBBFF` | `--amber-50` | `#FFF4DC` |
| `--alpha-white-6` | `#FFFFFF0F` | `--blue-ocean-tide` | `#113B5C` | `--amber-300` | `#F8CB6B` |
| `--alpha-white-10` | `#FFFFFF1A` | `--blue-clouds` | `#D8EDFF` | `--amber-400` | `#F5B73D` |
| `--alpha-white-16` | `#FFFFFF29` | `--blue-selection` | `#0D99FF` | `--amber-700` | `#8A5300` |
| `--alpha-white-20` | `#FFFFFF33` | `--pink-christina` | `#FF7FEE` | `--amber-950` | `#33260A` |
| `--alpha-white-45` | `#FFFFFF73` | `--pink-orchid` | `#53144B` |  |  |

### 4.3 Semantic colors

Light and Dark name the primitive each token aliases.

| Token | Light | Dark |
|---|---|---|
| `--surface-page` | `neutral/50` | `neutral/900` |
| `--surface-raised` | `neutral/0` | `neutral/800` |
| `--surface-sunken` | `neutral/200` | `neutral/700` |
| `--surface-field` | `neutral/100` | `alpha/white-10` |
| `--surface-inverse` | `neutral/900` | `neutral/0` |
| `--surface-overlay` | `alpha/ink-72` | `alpha/ink-72` |
| `--surface-scrim` | `alpha/ink-50` | `alpha/ink-50` |
| `--surface-skeleton` | `alpha/ink-8` | `alpha/white-10` |
| `--text-primary` | `neutral/900` | `neutral/100` |
| `--text-secondary` | `neutral/600` | `neutral/400` |
| `--text-disabled` | `neutral/400` | `neutral/600` |
| `--text-inverse` | `neutral/0` | `neutral/900` |
| `--text-on-color` | `neutral/0` | `neutral/0` |
| `--border-subtle` | `alpha/ink-8` | `alpha/white-10` |
| `--border-strong` | `alpha/ink-16` | `alpha/white-20` |
| `--border-control` | `alpha/ink-45` | `alpha/white-45` |
| `--border-raised` | `alpha/transparent` | `alpha/white-20` |
| `--border-focus` | `neutral/900` | `neutral/0` |
| `--action-primary` | `green/slime` | `green/slime` |
| `--action-primary-hover` | `green/slime-hover` | `green/slime-hover` |
| `--action-primary-pressed` | `green/slime-pressed` | `green/slime-pressed` |
| `--action-on-primary` | `neutral/900` | `neutral/900` |
| `--action-neutral` | `neutral/0` | `alpha/white-10` |
| `--action-neutral-hover` | `alpha/ink-5` | `alpha/white-16` |
| `--action-neutral-pressed` | `alpha/ink-12` | `alpha/white-20` |
| `--action-accent` | `green/slime` | `green/slime` |
| `--action-accent-hover` | `green/slime-hover` | `green/slime-hover` |
| `--action-accent-pressed` | `green/slime-pressed` | `green/slime-pressed` |
| `--action-on-accent` | `green/deep-moss` | `green/deep-moss` |
| `--action-danger` | `red/600` | `red/600` |
| `--action-danger-hover` | `red/700` | `red/700` |
| `--action-danger-pressed` | `red/800` | `red/800` |
| `--action-on-danger` | `neutral/0` | `neutral/0` |
| `--action-disabled` | `alpha/ink-5` | `alpha/white-6` |
| `--state-hover` | `alpha/ink-5` | `alpha/white-6` |
| `--state-selected` | `alpha/ink-8` | `alpha/white-10` |
| `--state-pressed` | `alpha/ink-12` | `alpha/white-16` |
| `--control-track` | `neutral/100` | `neutral/900` |
| `--control-thumb` | `neutral/0` | `neutral/700` |
| `--control-on` | `neutral/900` | `neutral/100` |
| `--control-on-mark` | `neutral/0` | `neutral/900` |
| `--status-positive-surface` | `green/deep-moss` | `neutral/700` |
| `--status-positive-text` | `green/slime` | `green/slime` |
| `--status-active-surface` | `green/lime` | `neutral/700` |
| `--status-active-text` | `green/deep-moss` | `green/slime` |
| `--status-neutral-surface` | `alpha/ink-8` | `alpha/white-10` |
| `--feedback-error` | `red/600` | `red/600` |
| `--feedback-error-surface` | `red/50` | `red/950` |
| `--feedback-error-text` | `red/700` | `red/300` |
| `--feedback-warning` | `amber/400` | `amber/400` |
| `--feedback-warning-surface` | `amber/50` | `amber/950` |
| `--feedback-warning-text` | `amber/700` | `amber/300` |
| `--editor-selection` | `blue/selection` | `blue/selection` |
| `--accent-green` | `green/slime` | `green/slime` |
| `--deep-green` | `green/deep-moss` | `green/deep-moss` |
| `--tint-green` | `green/lime` | `green/lime` |
| `--accent-blue` | `blue/lapis` | `blue/lapis` |
| `--deep-blue` | `blue/ocean-tide` | `blue/ocean-tide` |
| `--tint-blue` | `blue/clouds` | `blue/clouds` |
| `--accent-pink` | `pink/christina` | `pink/christina` |
| `--deep-pink` | `pink/orchid` | `pink/orchid` |
| `--tint-pink` | `pink/soft-pink` | `pink/soft-pink` |
| `--accent-warm` | `warm/fire` | `warm/fire` |
| `--deep-warm` | `warm/choco` | `warm/choco` |
| `--tint-warm` | `warm/peach` | `warm/peach` |
| `--accent-purple` | `purple/violet` | `purple/violet` |
| `--deep-purple` | `purple/kara` | `purple/kara` |
| `--tint-purple` | `purple/lilac` | `purple/lilac` |
| `--wash-green` | `green/mint` | `green/mint` |
| `--wash-warm` | `warm/cream` | `warm/cream` |
| `--shadow-raised` | `alpha/black-5` | `alpha/black-15` |
| `--shadow-floating` | `alpha/black-10` | `alpha/black-30` |
| `--shadow-thumb` | `alpha/black-10` | `alpha/black-30` |
| `--bevel-top` | `alpha/transparent` | `alpha/white-16` |
| `--bevel-bottom` | `alpha/transparent` | `alpha/white-10` |
| `--glow-accent` | `alpha/slime-60` | `alpha/slime-30` |

### 4.4 Scale

| Group | Tokens |
|---|---|
| Spacing | `--space-2`, `-4`, `-6`, `-8`, `-12`, `-16`, `-20`, `-24`, `-32`, `-40`, `-48`, `-64`, `-96`. The name is the value in px |
| Radius | `--radius-xs` 4, `--radius-sm` 8, `--radius-md` 12, `--radius-lg` 16, `--radius-xl` 20, `--radius-full` 999 |
| Control heights | `--size-control-xs` 24, `--size-control-sm` 28, `--size-control-md` 36, `--size-control-lg` 44 |
| Icon sizes | `--size-icon-sm` 16, `--size-icon-md` 18 |
| Strokes and focus | `--stroke-hairline` 1, `--stroke-focus` 2, `--focus-offset` 2 |
| Type | `--type-size-11`, `-12`, `-13`, `-14`, `-16`, `-18`, `-20`, `-24`, `-30`, `-32`, `-40`, `-44`; `--type-weight-regular` 400, `--type-weight-medium` 500; `--font-sans` Inter Tight, `--font-mono` Geist Mono |
| Motion | `--motion-duration-instant` 0, `-fast` 120, `-base` 200, `-slow` 320, `-pulse` 1500 (ms); `--motion-easing-standard` `cubic-bezier(0.2, 0, 0, 1)`, `-enter` `cubic-bezier(0, 0, 0.2, 1)`, `-exit` `cubic-bezier(0.4, 0, 1, 1)` |

The platform faces stay self-hosted under their private " Platform" names, as `RULES.md` section 5 requires. `--font-sans` in Figma maps to that private family in code, never to the public name.

### 4.5 Text styles

Twenty styles replace the 31 `.t-*` classes. All twenty use cap-height trim in Figma, so trim becomes the default and `.t-trim` stops being an opt-in.

| Style | Face | Size | Line height | Tracking | Use |
|---|---|---|---|---|---|
| Title/Display | Inter Tight Medium | 44 | 110% | -1.5% | Marketing-size moments inside the app, like the sign-in headline |
| Title/Metric | Inter Tight Medium | 40 | 110% | -2% | The big number on a metric card |
| Title/Page | Inter Tight Medium | 30 | 120% | -1% | One per screen |
| Title/Section | Inter Tight Medium | 24 | 120% | -0.5% | Sections inside a page |
| Title/Group | Inter Tight Medium | 20 | 130% | -0.5% | Groups inside a section and dialog titles |
| Title/Card | Inter Tight Medium | 18 | 125% | 0 | Card and panel titles |
| Body/L | Inter Tight Regular | 16 | 24px | 0 | Chat messages and summaries |
| Body/M | Inter Tight Regular | 14 | 20px | 0 | Default body text and field values |
| Body/S | Inter Tight Regular | 13 | 18px | 0 | Dense panels like the inspector |
| Label/L | Inter Tight Medium | 16 | 24px | 0 | Emphasised rows and large buttons |
| Label/M | Inter Tight Medium | 14 | 20px | 0 | Buttons, nav items, tabs and menu items |
| Label/S | Inter Tight Medium | 13 | 18px | 0 | Small buttons, segments and compact controls |
| Label/XS | Inter Tight Medium | 12 | 16px | 1% | Field labels, chips and badges |
| Caption/M | Inter Tight Regular | 12 | 16px | 0 | Help text, meta lines and errors |
| Caption/S | Inter Tight Regular | 11 | 14px | 0 | The smallest text in the product |
| Mono/Display | Geist Mono Regular | 32 | 112% | -2% | Large values that should read as data |
| Mono/M | Geist Mono Regular | 14 | 20px | 4% | Values like hex codes and sizes |
| Mono/S | Geist Mono Regular | 12 | 16px | 4% | Small values and axis labels |
| Mono/Eyebrow | Geist Mono Regular | 11 | 14px | 4% | Uppercase section labels |
| Mono/Code | Geist Mono Regular | 12 | 18px | 0 | Code and token names |

Mono/Eyebrow is uppercase. `text-box: trim-both cap alphabetic` is how `.t-trim` works today. In Phase 0, check which browsers the platform supports apply it, and say what an untrimmed fallback does to control heights, because the components are measured with the trim on.

### 4.6 Effect styles

| Style | Layers |
|---|---|
| Elevation/1 Raised | inset 0 1 2 `--bevel-top`, inset 0 -1 1 `--bevel-bottom`, drop 0 2 8 `--shadow-raised` |
| Elevation/2 Overlay | inset 0 1 2 `--bevel-top`, inset 0 -1 1 `--bevel-bottom`, drop 0 4 16 `--shadow-floating` |
| Elevation/3 Floating | inset 0 1 0 `--bevel-top`, inset 0 -1 0 `--bevel-bottom`, drop 0 8 32 `--shadow-floating` |
| Elevation/Thumb | drop 0 1 3 `--shadow-thumb` |
| Glow/Accent | drop 0 0 12 `--glow-accent` |
| Grain/Coarse | Noise. No CSS equivalent, not built, as today |

Cards and metrics use Raised. Menus, tooltips and toasts use Overlay. Dialogs use Floating. The selected segment uses Thumb. Effect styles carry no code syntax, so name the composites after the styles (`--elevation-1-raised`, `--elevation-2-overlay`, `--elevation-3-floating`, `--elevation-thumb`, `--glow-accent`).

---

## 5. From the old names to the new ones

This map comes from reading both token sets side by side. It is a starting point. In Phase 0, confirm every row against the rules that read the old name, and write the finished map as `docs/design/new-brand/BRIDGE.md`.

| Today | New | Note |
|---|---|---|
| `--surface-page`, `--surface-raised`, `--surface-sunken`, `--surface-inverse` | Same names | Dark values move: raised `#171817`, sunken `#232425` |
| `--input-bg` | `--surface-field` | |
| `--overlay-scrim` | `--surface-scrim` | The tag overlay fill becomes `--surface-overlay` |
| `--text-strong`, `--text-primary` | `--text-primary` | One ink for text and icons. The separate `#272727` for data marks is gone |
| `--text-secondary` | Same name | |
| `--text-muted`, `--text-subtle` | No direct match | Each reader becomes `--text-secondary` or `--text-disabled`. Decide per reader from the frames |
| `--text-on-fill` | `--text-on-color` | |
| `--border-default` | `--border-subtle` | `--border-strong` and `--border-raised` keep their names. `--border-control` is new, for checkbox, radio and switch edges |
| `--ring`, `--focus-width` (1) | `--border-focus`, `--stroke-focus` (2) | `--focus-offset` stays 2 |
| `--btn-primary-bg`, `--btn-primary-fg` | `--action-primary`, `--action-on-primary` | Section 2, decision 3 |
| `--state-error` on fills | `--action-danger` | Error text is `--feedback-error-text`, a field's error edge is `--feedback-error`, an alert's ground is `--feedback-error-surface` |
| `--state-hover`, `--state-pressed`, `--state-selected` | Same names | New values: 5%, 12% and 8% ink in Light |
| `--state-hover-inverse`, `--state-hover-on-color` and their pressed twins | Gone | Each action has its own hover and pressed tokens (`--action-primary-hover` and so on) |
| `--control-track`, `--control-thumb` | Same names | `--control-on` and `--control-on-mark` are new, for a switch or checkbox that is on |
| `--switch-track-on`, `--switch-track-off` | `--control-on`, and read the off state from the Switch component | |
| `--status-active-bg`, `--status-active-fg`, `--status-positive-bg` | `--status-active-surface`, `--status-active-text`, `--status-positive-surface`, `--status-positive-text` | `--status-neutral-surface` is new |
| `--accent-*`, `--tint-*`, `--wash-*` | Same names | |
| `--field-green`, `--field-blue`, `--field-pink`, `--field-warm`, `--field-purple` | `--deep-green`, `--deep-blue`, `--deep-pink`, `--deep-warm`, `--deep-purple` | |
| `--state-selection` | `--editor-selection` | |
| `--chip-*`, `--tag-*`, `--control-fill` | No direct match | Read the Chip, Tag, Badge and Segmented Control components |
| `--elevation-small`, `--elevation-medium`, `--elevation-floating`, `--elevation-thumb`, `--glow-hint` | `--elevation-1-raised`, `--elevation-2-overlay`, `--elevation-3-floating`, `--elevation-thumb`, `--glow-accent` | `--elevation-large` has no match |
| `--space-3xs` to `--space-3xl` | `--space-4` to `--space-96` by value | 2, 6, 20 and 40 are new steps |
| `--radius-xs` 2, `--radius-control` 7, `--radius-menu-item` 7, `--radius-control-md` 9, `--radius-media-plate` 15, `--radius-menu` 16, `--radius-card` 20, `--radius-pill` 999 | `--radius-xs` 4, `-sm` 8, `-md` 12, `-lg` 16, `-xl` 20, `-full` 999 | Do not map by nearest value. Each component names its radius in section 6 |

Until every reader has moved, old names point at new tokens through a bridge file, the way `src/styles/legacy-bridge.css` works today. New code reads new names only. The last phase deletes the bridge.

---

## 6. Components

### 6.1 Shared components

Read from the Components page. Sizes are height in px. "Code today" is where the matching primitive lives in `src/app/components/primitives/` unless a longer path is given.

| Component | Node | Variants and properties | Measured | Code today |
|---|---|---|---|---|
| Button | `2206:542` | Kind Primary, Neutral, Ghost, Destructive. Size Small, Medium, Large. State Default, Hover, Pressed, Disabled. Leading and trailing icon | 28, 36, 44. Radius sm. Padding 12, 16, 20. Label/S, Label/M, Label/M | `Button.tsx` `Button` |
| Icon Button | `2206:686` | Style Filled, Ghost. Size Small, Medium. State Default, Hover, Pressed, Selected, Disabled | 28, 36. Radius full. Filled is `--action-neutral` with a `--border-strong` edge | `IconButton.tsx` `IconButton`, `RowMenuTrigger`, `ThemeToggle`, `StepperButton`, and `Button.tsx` `AttachButton`. One component now covers all of them |
| Send Button | `2206:754` | Action Send, Stop. State Default, Hover, Pressed, Disabled | 36. Radius full. `--action-accent` fill | `Button.tsx` `SendButton` |
| Input | `2207:263` | Size Small, Medium, Large. State Default, Hover, Focus, Filled, Error, Disabled. Leading icon | 28, 36, 44. Radius sm. `--surface-field`. Body/S at Small, Body/M above | `Field.tsx` `Input` |
| Text Area | `2207:298` | State Default, Hover, Focus, Filled, Error, Disabled | 96 tall. Radius sm | `Field.tsx` `TextArea` |
| Select | `2207:410` | Size Small, Medium, Large. State Placeholder, Default, Hover, Open, Error, Disabled | 28, 36, 44. Radius sm | `Select.tsx` `Select`, `CompactSelect`, and `Filter.tsx` |
| Search | `2207:455` | State Default, Hover, Focus, Filled | 36. Radius sm | `SearchField.tsx` |
| Search Field | `50:62` | State Collapsed, Open, Hover | The collapsed button that opens into a field | `templates/TemplateSearchField.tsx`, `templates/LibrarySearch.tsx` |
| Field | `4015:628` | Kind Single line, Text area, Upload. Label, Optional, Control slot, error line | Label/XS, 6 above the control. It also has a help text property. Leave it off unless a frame shows it | `Field.tsx` `Field` |
| Switch | `2211:90` | Checked On, Off. State Default, Hover, Disabled | 36 by 20 | `Toggles.tsx` `Switch` |
| Checkbox | `2211:148` | Checked Off, On, Mixed. State Default, Hover, Disabled | 16 box, Body/M label | Find or add |
| Radio | `2211:187` | Checked Off, On. State Default, Hover, Disabled | 16 mark, Body/M label | Find or add |
| Segment, Segmented Control | `2211:211`, `2211:213` | State Selected, Default, Hover, Disabled. Optional dot | Track 36, radius sm, `--control-track`. Segment 28, radius xs, `--control-thumb`, Elevation/Thumb | `Toggles.tsx` `Segment`, `SegmentedControl` |
| Tab, Tabs | `4015:635`, `4015:673` | State Selected, Default | Text tabs on a hairline. The selected tab carries the underline | `Toggles.tsx` `Tab`, `Tabs` |
| Stepper | `2211:227` | Value | 36. Radius full. `--surface-field` | `IconButton.tsx` `Stepper` |
| Upload | `2211:278` | Value Empty, Filled. State Default, Hover | 56. Radius md | `Upload.tsx` |
| Badge | `2212:130` | Tone Positive, Active, Neutral, Error, Warning, Blue, Purple, Pink, Warm. Optional icon | 24. Radius full. Label/XS | `Chips.tsx` `Status` |
| Tag | `2212:143` | Kind Default, Overlay, Outline | 24. Radius full | `Chips.tsx` `Tag`, `DetailTag` |
| Chip | `2212:187` | State Default, Hover, Pressed, Selected, Disabled. Leading icon, remove | 28. Radius full | `Chips.tsx` `Chip`, `ChoiceChip` |
| Avatar | `2212:214` | Size Small, Medium, Large. Shape Circle, Square | 28, 36, 44 | `Navigation.tsx` `Avatar` |
| Nav Item | `2213:109` | State Selected, Default, Hover, Disabled. Label on or off | 36. Radius sm. Selected is `--state-selected` | `Navigation.tsx` `NavItem`, `SettingsRailItem` |
| Breadcrumb | `2213:111` | Parent, Current | Label/M | `layout/Breadcrumb.tsx` |
| Menu Item, Menu | `2213:157`, `2213:159` | State Default, Hover, Selected, Disabled. Icon, meta, chevron | Item 36, radius sm. Menu radius lg, Elevation/2 Overlay | `Menu.tsx` |
| Tooltip | `2213:206` | Label, optional value | Radius sm, Caption/M, Elevation/2 Overlay | `Overlays.tsx` `Tooltip` |
| Toast | `2213:213` | Message, optional action | Radius lg, Body/M, Elevation/2 Overlay | `Overlays.tsx` `Toast` |
| Page Header | `4015:764` | Kind Title, Breadcrumb | Title/Page on the left, the page action on the right. Breadcrumb kind carries the save status and Undo | `layout/Page.tsx` |
| Footer Links | `4015:750` | | Terms of Service and Privacy Policy, Caption/M, centered at the bottom of every page | `generate/LegalLinks.tsx` |
| Card | `2215:141` | State Default, Loading | Radius xl, padding 24, Elevation/1 Raised | `Containers.tsx` `Card` |
| Dialog | `2215:203` | Kind Default, Destructive | Radius xl, padding 24, Title/Group, Elevation/3 Floating. Close in the top right | `Containers.tsx` `Modal`, `ModalPanel`, and `ConfirmDialog.tsx` |
| Metric | `2215:223` | State Default, Loading | Radius xl, padding 20, Title/Metric value | `Containers.tsx` `Metric`, `Stat` |
| Table Row | `2215:270` | State Default, Hover, Loading | 52. Radius sm | Find or add |
| Progress Bar, Progress Steps | `2215:272`, `2221:1105` | Steps 1, 2, 3 | Bar 4 tall, radius full | `Containers.tsx` `Progress`, `ProgressBar` |
| Skeleton | `2215:286` | Shape Line, Block, Circle | Fill `--surface-skeleton`. `--motion-duration-pulse` is the token for its pulse | `Skeleton.tsx` |
| Alert | `2215:302` | Tone Neutral, Error, Warning | Radius md | Find or add. `ErrorState.tsx` is the nearest today |
| Empty State | `2215:304` | Title, Body | Title/Card, one action | Find or add |
| Sidebar | `2218:679` (Patterns) | Collapsed False, True | 320 open, 76 collapsed | `Sidebar.tsx` |

Icons: 62 lucide icons, each at 16 and 18, on the Icons board of the Foundations page. Controls use 16 and navigation uses 18. The 10, 14, 15 and 20 sizes are retired.

### 6.2 Product components

Read from the Product components page. The "likely home" column is a lead, not a fact. Confirm each in Phase 0.

| Board | Component | Node | Likely home |
|---|---|---|---|
| Brand | Logo, Logo Mark | `54:66`, `61:467` | `BrandMark.tsx` |
| Brand | Platform Logo, Platform Chip | `53:73`, `53:96` | `Chips.tsx` `PlatformLogo`, `PlatformChip` |
| Templates | Template Card | `4018:129` | `templates/TemplateCard.tsx` |
| Templates | Builder Template Card | `4018:156` | `admin/AdminTemplates.tsx` |
| Templates | Size Cover (12) | `327:1985` and its siblings | `builder/SizeGallery.tsx`, `src/assets/sizes/` |
| Templates | Template Thumbnail | `25:853` | Sample art. Not built |
| Generate | Composer | `2216:222` | The chat composer under `chat/` and `generate/`. States Empty, Typing, Generating, Details |
| Generate | Message Bubble, Assistant Message | `2216:224`, `2216:235` | `chat/` |
| Generate | Result Card | `2216:287` | `Previews.tsx` `ResultCard`. State Default, Loading |
| Generate | Variation Tile | `2216:315` | `Previews.tsx` `LookTile` |
| Generate | Recent Card, History Card | `4018:183`, `4018:1728` | `generate/RecentCard.tsx`, `generate/HistoryCard.tsx`. History has a Loading state |
| Brand Studio | Overview Card, Color Card, Logo Card, Image Card, Font Row, Type Style Row | `4018:1737`, `4018:1755`, `4018:1794`, `4018:1868`, `4018:1822`, `4018:1849` | `admin/brand/primitives/`, `admin/brand/*Detail.tsx` |
| Template Builder | Layer Row, Form Row, Element Tile, Effect Row | `321:30`, `321:64`, `321:77`, `392:8266` | `builder/LayersPanel.tsx`, `FieldListPanel.tsx`, `ElementPalette.tsx`, `EffectsEditor.tsx` |
| Settings | Settings Card, Member Row, Link Row | `4018:1887`, `4018:1904`, `4018:1928` | `Containers.tsx` `SettingsCard`, `admin/settings/PeopleSection.tsx`, `SharingSection.tsx` |
| Onboarding | Option Tile | `257:4145` | `OptionTile.tsx` |

Logo plates in Brand Studio pin their own ground: a logo drawn for dark surfaces stays on a dark plate in both themes. Keep that pin.

---

## 7. Rules that change

`docs/design/new-look/RULES.md` stays the base. Phase 0 writes `docs/design/new-brand/RULES.md` as that file with these changes, and `CLAUDE.md` points at the new file once CJ approves it.

| Section | Was | Now |
|---|---|---|
| 1 Sources | Master UX-UI, Brand tokens | The new file, the Color and Scale collections |
| 3 Tokens | The Brand names (`--btn-primary-*`, `--input-bg`, `--chip-*`, `--tag-*`) | The names in section 4.3 |
| 4 Corners and spacing | Radius by role (control 7, field 9, card 20), spacing 3xs to 3xl | Radius by step (4, 8, 12, 16, 20, full), spacing by value, control heights 24, 28, 36, 44 |
| 4 Elevation | Small, Medium, Large, Floating | 1 Raised, 2 Overlay, 3 Floating, Thumb |
| 5 Type | 31 classes, trim as an opt-in | 20 styles, trim by default |
| 4 Shadows | Not covered | A shadow is never cut off. Section 7b |
| 6 Hover and pressed | A tint laid over the fill | Each action has hover and pressed tokens. Rows and ghost controls use `--state-hover`, `--state-pressed`, `--state-selected` |
| 6 Disabled | 40% opacity | `--action-disabled` under `--text-disabled` |
| 6 Focus | 1 px ring, fields show only the caret | 2 px ring, 2 px offset, on every interactive control |
| 6 Error | `#D43535` Light, `#EC5656` Dark | `--action-danger` on fills, the `--feedback-error-*` tokens for text, edges and grounds |
| 7 Brand color in chrome | Deep Moss and Slime on the primary action | Slime on the primary action and Send. Read the rest from the frames |
| 8 Icons | lucide at 16 and 18 | The same, with the off sizes retired |
| 9 Copy | "looks" | "variations" |

Sections 2 (multi-tenant), 9 (copy) and 10 (how every phase works) carry over unchanged apart from the word above.

---

## 7b. Structure

Measured from the frames at 1440 wide. Fixed sizes stay fixed and everything marked "fills" takes the space that is left. Layouts below desktop width keep today's behavior.

### The app frame

| Part | Measure |
|---|---|
| Viewport | 12 padding on all four sides, 12 between the sidebar and Main |
| Sidebar | 320 wide, 76 collapsed, full height. 20 padding, 24 between its groups. The account row stays at the bottom |
| Main | Fills. 16 padding top and bottom. A 32 gutter left and right, so content is 1020 wide at 1440 |
| Page Header | A row 36 tall at the top of Main. Title or breadcrumb on the left, actions on the right, 8 between actions |
| Content | Starts 24 below the header. It scrolls inside Main while the header and the footer stay put. A scrolling area ends in an 80 tall fade at its bottom edge |
| Footer Links | Centered at the bottom of Main, 16 between the two links |

Three frames draw the title lower or tighter than this (Brand Templates, the Brand Studio overview, Settings). Judgement call 6 in section 2b applies: build the one header row everywhere.

### Shadow room

Elevation/1 Raised reaches 8 left and right of an element, 6 above and 10 below. Any container that clips its content cuts that off unless it leaves room.

- A container that does not scroll does not clip. Grids, result groups, shelves and the builder workspace are `overflow: visible`.
- A container that scrolls gets 12 of padding on every side it does not scroll toward, and a matching negative margin so nothing moves. The shelf rail is the model: `overflow-x: auto; padding: 12px 0 12px 12px; margin: -12px 0 -12px -12px`. Setting one overflow axis makes the other one clip too, which is why the room above and below has to be padding.
- An edge fade covers the padded box, so a shadow fades out with its card.
- The Figma frames show this as an inner layer named "· scroll" that is 12 larger than its layout box on those sides.

| Where | Sides that need room |
|---|---|
| Platform chip rail (Brand Templates, History) | Top and bottom |
| Shelf rails | Left, top and bottom |
| Filtered and search grids | All four. They do not scroll sideways, so they do not clip |
| Generate thread | Left and right, and the bottom when a result card is last |
| History grid, Template Builder grid | All four |
| Builder rails and inspector inside the workspace | All four |

### Brand Templates

| Part | Measure |
|---|---|
| Filter bar | 56 tall. Search Field (50 square) then the platform chip rail, chips 50 tall with 8 between them. The rail runs off the right edge under a 72 wide fade |
| Shelves | 32 between shelves. A shelf is a header (28 tall, title on the left, View all on the right) then a rail 16 below it |
| Shelf rail | Cards in a row, 16 apart, running off the right edge under a 96 wide fade |
| Template Card | 302 wide. 434 tall for portrait templates, 226 for landscape. 8 padding around the preview |
| Filtered or search view | A result line (28 tall, the count and Clear), then one group per size: a header 32 tall and a grid 16 below it. Three cards across, 327 wide, 16 between columns and rows |
| Fill page | Breadcrumb header with Bulk fill and Public link on the right. Below it a row, 24 apart: the Preview fills, the Details panel is 380 wide |
| Preview | The graphic centered on a stage with 40 padding. The legal links sit under the stage |
| Details panel | 20 padding, 20 between fields. Download PNG pinned to its bottom |

### Generate

| Part | Measure |
|---|---|
| Start | One column 720 wide, centered in Main both ways. The chat box, then Recent 48 below it: a header 28 tall and a list with 12 between cards |
| Chat box | 720 wide, 16 padding, 24 between the text and the controls row |
| Thread | Breadcrumb header with History and New chat. Below it one column 720 wide, centered: the thread fills and scrolls, the chat box sits under it, the legal links under that. 24 between messages |
| Messages | A sent message sits right, up to 440 wide, with attachments above it. An assistant message and a Result Card run the full 720. Result Card has 12 padding |
| Try next | A row of chips under the result, 8 apart |
| History | Breadcrumb header, the page title, a filter row (Search Field then platform chips, 8 apart), then a grid: four cards across, 245 square, 12 between them |

### Template Builder

| Part | Measure |
|---|---|
| List | Header with Restore starters and New template on the right. A filter bar 40 tall: the status Segmented Control on the left, the sort Select and a 40 square search button on the right. A grid of Builder Template Cards, four across, 242 wide, 16 between them |
| Choose a size | A dialog 1040 wide, 24 padding, 20 between header and body. The body is a row 24 apart: a category list 200 wide (rows 36 tall, 2 apart) and the sizes, which are a platform chip row then a grid of Size Covers 16 apart. Close is 28 square in the top right corner |
| Editor frame | The sidebar is collapsed to 76. The builder column has a top bar 44 tall (breadcrumb, status badge, then the Edit and Preview control and Publish on the right) and the workspace 12 below it |
| Workspace | A row, 12 apart: the Layers and Form rail 260 wide, the stage fills, the inspector 320 wide. Rail and inspector have 16 padding |
| Stage | The artboard centered. The variation switcher top center, the tools column on the left edge, canvas size bottom left, zoom bottom right |

### Brand Studio

| Part | Measure |
|---|---|
| Overview | 24 between blocks. A setup strip (16 by 24 padding), then Overview Cards three across, 329 by 277, 16 between them |
| Detail pages | Breadcrumb header with the save status and Undo on the right. Content 24 below |
| Colors | Color Cards in rows, 159 by 149, 12 between them, then the roles summary |

### Insights and Analytics

One column, 24 between blocks: the header (title, Export CSV), a filter row (8 apart), the monthly digest card (24 padding), four Metric cards in a row (16 apart, equal widths), a row 300 tall with the trend card filling and the top templates card 315 wide (16 apart), then the public links card (24 padding).

### Settings

A row 32 apart: the section rail 200 wide (items 2 apart) and the section, which fills (788 at 1440) as a column of Settings Cards 24 apart.

### Sign in and Create account

A row with 16 of margin on the top, right and bottom. The form side fills (32 by 48 padding): the logo top left, the form column centered both ways, the legal links at the bottom. The art panel on the right is 688 wide and full height. The form column is 400 wide for sign in and 480 for Create account, where it holds the questions, the actions row (12 apart) and the progress bar, 40 apart.

---

## 8. Screens

Light and Dark node ids, the route, and where the code starts. Paths are under `src/app/components/` unless they start with `src/`.

### Brand Templates, page `2308:2`

| State | Light | Dark |
|---|---|---|
| 01 Brand Templates | `2308:4` | `2325:1080` |
| 02 Platform filter | `2308:538` | `2325:1368` |
| 03 Search | `2308:739` | `2325:1571` |
| 04 Fill page | `2322:918` | `2325:1746` |
| 05 Fill page, filled | `2308:3272` | `2325:1913` |
| 06 Fill page, downloaded | `2308:3596` | `2325:2080` |
| 07 Fill page, public links | `2323:888` | `2325:2251` |

Routes `/templates?platform=&q=` and `/templates/:id`. Code: `Portal.tsx`, `templates/*`, `TemplateUsePage.tsx`, `TemplateFill.tsx`, `admin/TemplateLinksDialog.tsx`, and `src/app/public/PublicFillPage.tsx`, which shares the form. The fill page today is the step form from the earlier program's amended decision 7. The frames draw one Details panel beside the graphic: Variation, the template's fields, Caption, then Download PNG. This is the biggest behavior change in the program.

### Generate, page `8:674`

| State | Light | Dark |
|---|---|---|
| Start | `13:1453` | `2357:3255` |
| Attach menu | `13:1601` | `2357:3328` |
| Connectors | `13:1850` | `2357:3427` |
| Add a detail | `13:2140` | `2357:3519` |
| Photo attached | `13:2301` | `2357:3582` |
| Details added | `13:2454` | `2357:3656` |
| Sent | `13:2639` | `2344:2754` |
| Generating | `13:2824` | `2344:2885` |
| Result | `13:2985` | `2344:3001` |
| Edit | `13:3150` | `2344:3158` |
| History | `13:3359` | `2344:3394` |

Routes `/generate`, `/generate/c/:id`, `/generate/history`. Code: `generate/*`, `chat/*`.

### Template Builder, page `8:675`, Light only

| Frame | Node |
|---|---|
| Template Builder (the list) | `328:1944` |
| Template Builder, row menu | `329:2206` |
| New template | `329:2660` |
| Choose a size | `329:2970` |
| Import from Figma | `329:3710` |
| Auto build | `329:3981` |
| Auto build, building | `329:4286` |
| Editor, blank | `325:484` |
| Editor, text field | `322:36` |
| Editor, text field, Field tab | `2289:4772` |
| Editor, image field | `325:871` |
| Editor, image field, Field tab | `2289:5676` |
| Editor, preview | `326:924` |
| Publish | `326:1233` |
| Published | `326:1742` |

Routes `/template-builder`, `/template-builder/:id`. Code: `admin/AdminTemplates.tsx`, `builder/*`. The earlier program left the builder out of scope until it was designed. It is designed now. Its Dark comes from the tokens (section 2b, call 2). `330:3938` is a flow diagram, not a screen. The three sections named "(proposal)" (`392:3892` Depth, `434:4312` Icons, `436:4402` Crop) are not approved and are not built.

### Brand Studio, page `8:676`

| State | Light | Dark |
|---|---|---|
| Overview | `13:9043` | `2366:2169` |
| Colors | `13:9309` | `2366:2230` |
| Colors, editing | `13:9470` | `2366:2313` |
| Colors, added | `13:9657` | `2366:2419` |
| Logos | `13:10014` | `2366:2531` |
| Logos, editing | `13:10150` | `2366:2589` |
| Logos, primary changed | `13:10300` | `2366:2659` |
| Type styles | `13:10888` | `2366:2728` |
| Type styles, editing size | `13:11041` | `2366:2787` |
| Type styles, all properties | `13:11196` | `2366:2846` |
| Images | `13:11956` | `2366:2973` |
| Images, uploaded | `13:12050` | `2366:2988` |
| Images, row menu | `13:12176` | `2366:3024` |
| Import | `13:12670` | `2366:3067` |
| Import, importing | `13:12772` | `2366:3088` |
| Import, done | `13:12879` | `2366:3114` |
| Fonts | `13:13689` | `2366:3141` |
| Fonts, row menu | `13:13830` | `2366:3180` |
| Fonts, uploading | `13:13980` | `2366:3225` |

Route `/brand-studio/:category`. Code: `admin/brand/*`.

### Insights and Analytics, page `8:677`

Light `13:832`, Dark `2406:251`. Route `/insights`. Code: `admin/Dashboard.tsx`, `admin/insights/*`.

### Settings, page `8:678`

| Section | Light | Dark |
|---|---|---|
| Workspace | `13:14570` | `2413:1552` |
| People | `13:14769` | `2413:1728` |
| Integrations | `13:15051` | `2413:1987` |
| Plan and usage | `13:15203` | `2413:2113` |
| Sharing | `13:15384` | `2413:2263` |
| Account | `13:15649` | `2413:2520` |
| Advanced | `13:15837` | `2413:2680` |

Route `/settings/:section`. Code: `admin/SettingsAdmin.tsx`, `admin/settings/*`.

### Sign in and sign up, page `194:2`

| Screen | Light | Dark (not built) |
|---|---|---|
| Sign in | `200:168` | `2389:1326` |
| Sign in, error | `201:254` | `2389:1394` |
| Sign up | `201:289` | `2389:1463` |
| Sign up, error | `201:332` | `2389:1530` |
| Check your email | `201:373` | `2389:1598` |
| Reset password | `201:414` | `2389:1647` |
| Reset link sent | `201:454` | `2389:1704` |
| New password | `201:495` | `2389:1753` |

Shown with no session at any URL. Code: `auth/*`, `PreAppShell.tsx`. The gate is pinned to Light today (`data-theme="light"` in `PreAppShell.tsx` and `AuthPanel.tsx`) and stays that way.

### Create account, page `257:2`, Light only

`258:16` About you, `258:262` Set up for, `258:438` Your team, `258:708` First up, `259:357` Website, `259:5170` Add your brand (no website), `259:478` Pulling your brand, `259:630` Your brand, `259:799` Invite your team, `259:968` Workspace ready. Shell `257:3`. Code: `onboarding/*`, `PreAppShell.tsx`.

---

## 9. Phases

One pull request per phase into `main`. Phase 0 may change this order and must say why.

| # | Phase | What lands | Gate highlights |
|---|---|---|---|
| 0 | Recon and plan | `docs/design/new-brand/PLAN.md`, `RULES.md`, `BRIDGE.md`, `PHASE-1.md`. No product code | CJ approves the plan and answers the questions |
| 1 | Foundation | The exporter, JSON, generator and check on the new collections. `tokens.css` regenerated from the new file. A bridge from every old name still read. The 2 px focus ring. The 20 text styles | Every changed value is on the expected list. Nothing breaks |
| 2 | Primitives | Every component in section 6.1 on the new tokens with its states, tested. `/dev/ui` shows each one in Light and Dark the way the Components page does | `/dev/ui` matches the boards in both themes |
| 3 | Shell | The app frame from section 7b: Sidebar, the one Page Header row, Breadcrumb, Footer Links on every page | Every route still reachable in both themes. Titles sit at one height |
| 4 | Brand Templates | The library, filter, search, the form-only fill page, the public link page's form, the public links dialog. The template chat hidden behind a redirect | Screens match their frames in both themes. No shadow cut off on the shelves, the chip rail or the grids |
| 5 | Generate | Every state in section 8, the new chat box, the result card with size tabs, History with skeletons | Same |
| 6 | Template Builder | The list, New template, Choose a size, the import and auto build dialogs, the editor chrome with its Design and Field tabs, Publish | Light matches the frames. Dark reviewed by screenshot. Rendering and gestures untouched |
| 7 | Brand Studio | Overview and the six detail pages | Same. Differences with `docs/brand-system/` listed |
| 8 | Settings and Insights | All seven sections and the dashboard | Same |
| 9 | Sign in and Create account | The eight gate screens and the ten onboarding steps, Light only | Screens match their frames |
| 10 | Cleanup | The bridge, every old token name and every old control class deleted. Whatever the earlier program's Phase 9 still owed. Lint rules against raw colors and inline type | Nothing legacy left |

Each later phase gets its own prompt in `docs/design/new-brand/` when it starts, written from the frames it builds.

---

## 10. How every phase works

The loop in `docs/design/new-look/RULES.md` section 10 applies as written:

1. Read `PLAN.md`, `RULES.md`, `BRIDGE.md` and the phase prompt in this folder before writing code. Plan in plan mode first.
2. Capture the baseline with `npm run shots -- capture .shots/before`.
3. Work in the prompt's steps. Run `npm run verify` and commit after each one. Never start a step on a red build.
4. The gate: `npm run verify` and `npm run build` pass, the screenshot comparison shows only the changes the phase expects, the changed screens match their frames in Light and in Dark, no shadow on a changed screen is cut off by a container edge, and a keyboard pass finds the 2 px ring on every control.
5. Run the `phase-reviewer` subagent before opening the pull request, and the `fidelity-checker` subagent when a phase touches anything near rendering, export, import or template types.
6. The pull request lists what changed, the screenshot report, every exception to the frames or the rules, and any proposed copy.
7. If something in a prompt turns out to be impossible or wrong once you are in the code, stop and explain the conflict.

Compare against the file, not against memory. Pull each frame with `get_screenshot` at 1440 wide and each component from its board.

---

## 11. What not to touch

- `SchemaRenderer`, the export path and `canvasGesture.ts`, beyond class names on the chrome around them.
- The frozen types and every table column.
- Tenant data, starter templates' content and anything a new account is seeded with.
- `docs/brand-system/` and the work it has in flight.
- Layouts below desktop width. They keep today's responsive behavior on the new tokens.
- The three builder proposal sections and the "Chat box options" frame.
- Anything outside the phase you are in. Report it instead.

---

## 12. Phase 0: recon and plan

Do this first. It ends at a gate, and nothing is built until CJ answers.

**Read**

1. This file, `CLAUDE.md`, and `docs/design/new-look/PLAN.md`, `RULES.md` and `BRIDGE.md` in full.
2. `git log` and the status column of both programs' `PLAN.md`, to see which phases of the earlier program are merged and what its cleanup phase still owes. `src/styles/legacy-bridge.css` still exists and the `.sp-btn` family is still read in about 20 files, so some of it is open.
3. The token pipeline: `design/tokens/figma-export/code.js`, `scripts/build-tokens.mjs`, `src/styles/tokens.css`, `src/styles/theme.css`.
4. The Design System, Foundations, Components, Product components and Patterns pages of the Figma file. Read the Docs page for the decisions behind them.

**Find out**

1. Every old token name and every `.t-*` class still read, with a count of readers, and its new name from section 5. Flag each row of section 5 that the code proves wrong.
2. For each component in section 6, the primitive or file that plays its role today, what is missing, and what is extra. Say where two code components fold into one (the Icon Button family, `Select` with `CompactSelect` and `Filter`).
3. For each screen in section 8, the differences between the frame and the route today, split into restyle (tokens and primitives carry it) and behavior (layout, flow or data changes). Be specific about the fill page.
4. Where the old palette is baked in outside `tokens.css`: `scripts/new-look/fixtures/`, `src/assets/`, the Brand Studio covers, the size covers in `src/assets/sizes/`, the auth panel art, any hex in CSS.
5. Whether the supported browsers apply `text-box` trim, and what the fallback costs.
6. Every container in the code that clips (any `overflow` other than visible) and holds a raised card, chip or panel, with whether it scrolls. This is the list section 7b's shadow rule gets applied to.
7. Where the app frame today differs from section 7b: viewport padding, sidebar widths, gutters, the header row, fixed panel widths.
8. Whether the phase order in section 9 is right for this code. Propose a better one if not.

**Write**

- `docs/design/new-brand/PLAN.md`: decisions (section 2), judgement calls (section 2b), scope, phases with gates, the screen map with code entry points confirmed, and what the earlier program still owes.
- `docs/design/new-brand/RULES.md`: the earlier rules with section 7's changes applied and the structure and shadow rules from section 7b, complete enough to stand alone.
- `docs/design/new-brand/BRIDGE.md`: the confirmed old-to-new map.
- `docs/design/new-brand/PHASE-1.md`: the Foundation prompt, with its expected-change list.

**Ask CJ**

Most questions are already answered in sections 2 and 2b. Put only these in the gate report, with what you found and what you recommend:

1. Anything in section 2 or 2b that the code makes impossible or costly as written.
2. Each difference between a Brand Studio frame and what `docs/brand-system/` has built.
3. Any change to a frozen type or a table column that a frame would need.

**Gate**

Stop when the four files are written and the questions are listed. Report what you read, what you found, and the plan. Change no product code in this phase.
