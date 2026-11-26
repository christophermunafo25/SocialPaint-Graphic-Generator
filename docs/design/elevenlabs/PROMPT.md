# ElevenLabs: the brief

This is the brief every phase reads with `RULES.md`. Section numbers are stable, so phase prompts and pull requests can point at them.

## 1. Sources of truth

- **Figma file** "Master UX-UI New Brand Eleven Labs Inspired", key `dQ8bQq3V7Bue5pvFrI2g9X`. The page map is in `README.md` and the screen map in `PLAN.md`. Always pass this key. The earlier file `1dYWgFH2V8i9Jez2ylI3ky` is retired as a source.
- **Tokens** come from its Primitives, Color and Scale collections through `design/tokens/master.tokens.json` and the generated `src/styles/tokens.css`. Never edit either by hand.
- **Components** are read by node id with `get_design_context` and `get_screenshot`. Each component's board on its type page shows every variant in a Light panel and a Dark panel, and both are the spec.
- **Patterns** (`4012:1195`) show how components sit together on the approved screens, cloned from those screens in both themes.

## 2. Settled

`PLAN.md` holds CJ's decisions and the judgement calls. A phase builds them and does not re-ask.

## 3. Variables

Three collections, each found by its exact name.

| Collection | Modes | Count | Holds |
|---|---|---|---|
| Primitives | Value | 59 | Raw colors. Hidden from every property picker, and never read by a component |
| Color | Light, Dark | 85 | Semantic colors. Every value is an alias to a primitive |
| Scale | Value | 59 | Spacing, radius, sizes, strokes, type sizes and weights, font families, motion |

Every variable carries WEB code syntax, and the CSS name is the variable name with each slash turned into a dash, so `surface/raised` is `var(--surface-raised)` and `space/16` is `var(--space-16)`.

### 3.1 Primitives

- **Gray**, the interface ramp: `gray/0` `#FFFFFF`, `50` `#FAFAFA`, `100` `#F5F5F5`, `150` `#EFEFEF`, `200` `#E8E8E8`, `300` `#D4D4D4`, `400` `#A3A3A3`, `600` `#6B6B6B`, `700` `#333333`, `750` `#2A2A2A`, `800` `#262626`, `850` `#1F1F1F`, `870` `#1A1A1A`, `880` `#161616`, `890` `#121212`, `900` `#0F0F0F`, `950` `#0A0A0A`.
- **Brand neutrals** for template content and the lockup: `neutral/0`, `50`, `100`, `200`, `850` (`#1C1F1E`, the lockup's ink), `900`.
- **Brand families**: green (`slime`, `deep-moss`, `lime`, `mint`), blue (`lapis`, `ocean-tide`, `clouds`, `selection`), pink (`christina`, `orchid`, `soft-pink`), warm (`fire`, `choco`, `peach`, `cream`), purple (`violet`, `kara`, `lilac`).
- **Functional**: red `50`, `300`, `600`, `700`, `800`, `950` and amber `50`, `300`, `400`, `700`, `950`.
- **Alpha**: `ink-45`, `ink-50`, `ink-72`, `white-45`, `black-3` (CJ, 2026-11-25), `black-5`, `black-10`, `black-30`, `transparent`.

### 3.2 Color

Light and Dark name the primitive each token reads.

| Token | Light | Dark | Use |
|---|---|---|---|
| surface/page | gray/50 | gray/950 | The app background, off-white in Light (CJ, 2026-11-25) |
| surface/raised | gray/0 | gray/880 | Panels, menus, popovers, dialogs. Its edge is border/raised |
| surface/sunken | gray/150 | gray/850 | Wells inside a raised surface |
| surface/field | gray/0 | gray/950 | Inputs, selects, text areas, uploads |
| surface/card | gray/50 | gray/890 | Template, result and content cards |
| surface/shell | gray/50 | gray/890 | The shell behind the sidebar and Main |
| surface/stage | gray/100 | gray/890 | The stage behind a template preview, a step under the page in Light (CJ, 2026-11-25) |
| surface/soft | gray/150 | gray/850 | Icon tiles, segmented tracks, the stepper, progress tracks and pending steps |
| surface/inverse | gray/900 | gray/50 | Inverted fills. Selected Chips and Platform Chips are on state/selected (CJ, 2026-11-25) |
| surface/overlay | alpha/ink-72 | alpha/ink-72 | Tags and labels on an image |
| surface/scrim | alpha/ink-50 | alpha/ink-50 | The dimmer behind a dialog |
| surface/skeleton | gray/150 | gray/850 | Skeletons |
| text/primary | gray/900 | gray/50 | Default text and icons |
| text/secondary | gray/600 | gray/400 | Supporting text, placeholders, quiet icons |
| text/item | gray/700 | gray/300 | Nav, menu, layer and form rows at rest, icons included (CJ, 2026-11-25) |
| text/disabled | gray/400 | gray/600 | Disabled text and icons |
| text/inverse | gray/0 | gray/900 | Text on surface/inverse |
| text/on-color | gray/0 | gray/0 | Text on overlays that stay dark |
| border/subtle | gray/150 | gray/850 | Dividers and quiet outlines |
| border/strong | gray/200 | gray/750 | Outlines that read as an edge |
| border/field | gray/200 | gray/750 | The edge of a field |
| border/field-hover | gray/300 | gray/700 | A field under the pointer |
| border/raised | gray/200 | gray/800 | The edge of panels, cards, menus, dialogs, the sidebar |
| border/control | alpha/ink-45 | alpha/white-45 | An unchecked checkbox, radio or switch |
| border/focus | gray/900 | gray/50 | The focus ring |
| action/primary, -hover, -pressed | gray/900, 800, 700 | gray/50, 200, 300 | The primary button |
| action/on-primary | gray/0 | gray/900 | Its label and icon |
| action/neutral, -hover, -pressed | gray/0, 100, 150 | gray/880, 850, 800 | The neutral button, Filled and Outline icon buttons, chips |
| action/accent, -hover, -pressed, on-accent | as primary | as primary | Send and single accent actions |
| action/danger, -hover, -pressed | red/600, 700, 800 | red/600, 700, 800 | Destructive buttons |
| action/on-danger | gray/0 | gray/0 | Their label |
| action/disabled | gray/100 | gray/870 | A disabled button |
| state/hover, selected, pressed | gray/100, 150, 200 | gray/870, 850, 800 | Rows, ghost buttons, menu and nav items |
| control/track, thumb, on, on-mark | gray/150, 0, 900, 0 | gray/850, 700, 50, 900 | Segmented control, switch, checkbox, radio |
| status/positive-surface, -text | green/deep-moss, green/slime | gray/800, green/slime | A positive badge |
| status/active-surface, -text | green/lime, green/deep-moss | gray/800, green/slime | An active badge |
| status/neutral-surface | gray/100 | gray/850 | Neutral badges, default tags, alerts |
| feedback/error, -surface, -text | red/600, 50, 700 | red/600, 950, 300 | Errors |
| feedback/warning, -surface, -text | amber/400, 50, 700 | amber/400, 950, 300 | Warnings |
| editor/selection | blue/selection | blue/selection | Canvas selection |
| plate/dark, plate/light | gray/950, gray/50 | the same | Logo proof grounds, fixed in both themes |
| logo/ink | neutral/850 | neutral/50 | The SocialPaint lockup and its mark, `#1C1F1E` on Light and `#F9F9F8` on Dark |
| accent, deep, tint, wash families | brand primitives | the same | Charts and brand moments, never chrome |
| shadow/raised, bevel/top, bevel/bottom, glow/accent | alpha/transparent | the same | Kept at zero so the composites keep one shape |
| shadow/floating, shadow/thumb | alpha/black-10 | alpha/black-30 | Menus, dialogs, toasts, thumbs |
| shadow/composer-near, shadow/composer-far | alpha/black-5, alpha/black-3 | alpha/transparent | Elevation/Composer (CJ, 2026-11-25) |

### 3.3 Scale

| Group | Tokens |
|---|---|
| Spacing | `space/2`, `4`, `6`, `8`, `12`, `16`, `20`, `24`, `32`, `40`, `48`, `64`, `96` |
| Radius | `xs` 6, `sm` 8, `md` 10, `lg` 12, `xl` 16, `full` 999, `chip` 10, `tile` 8, `tag` 6, `composer` 27, `shell` 0 |
| Control heights | `size/control-xs` 24, `-sm` 28, `-md` 36, `-lg` 44 |
| Icons | `size/icon-sm` 16, `size/icon-md` 18 |
| Strokes | `stroke/hairline` 1, `stroke/focus` 2, `focus/offset` 2, `stroke/shell-edge` 0 |
| Layout | `layout/shell-inset` 0 |
| Type | sizes 11, 12, 13, 14, 16, 18, 20, 24, 30, 32, 40, 44. Weights regular 400, medium 500. `font/sans` Inter Tight, `font/mono` Geist Mono |
| Motion | durations instant 0, fast 120, base 200, slow 320, pulse 1500. Easings standard `cubic-bezier(0.2, 0, 0, 1)`, enter `cubic-bezier(0, 0, 0.2, 1)`, exit `cubic-bezier(0.4, 0, 1, 1)` |

### 3.4 Text styles

Twenty styles, each trimmed to cap height, each a `.t-` class over a `--type-` variable.

| Style | Spec | Use |
|---|---|---|
| Title/Display | Inter Tight Medium 40 / 110%, -1.5% | Marketing-size moments, like the sign-in headline |
| Title/Metric | Medium 40 / 110%, -2% | The big number on a metric card |
| Title/Page | Medium 30 / 120%, -1% | Long-form pages. No app screen sets its page name in it, since the header row names the page in Label/M |
| Title/Section | Medium 24 / 120%, -0.5% | Sections inside a page |
| Title/Group | Medium 20 / 130%, -0.5% | Groups and dialog titles |
| Title/Card | Medium 18 / 125% | Card and panel titles |
| Body/L, M, S | Regular 16/24, 14/20, 13/18 | Chat and summaries, default body, dense panels |
| Label/L, M, S, XS | Medium 16/24, 14/20, 13/18, 12/16 +1% | Large buttons, buttons and nav, compact controls, badges and field labels |
| Caption/M, S | Regular 12/16, 11/14 | Meta lines and errors, the smallest text |
| Mono/Display, M, S | Geist Mono Regular 32/112% -2%, 14/20 +4%, 12/16 +4% | Data values |
| Mono/Eyebrow | Regular 11/14 +4%, uppercase | Section labels |
| Mono/Code | Regular 12/18 | Code and token names |

### 3.5 Effect styles

| Style | CSS | Now |
|---|---|---|
| Elevation/1 Raised | `--elevation-1-raised` | All layers transparent. Raised surfaces are flat and take `--border-raised` |
| Elevation/Composer | `--elevation-composer` | 0 1 6 -1 `--shadow-composer-near` and 0 6 88 2 `--shadow-composer-far`. The composer in Light (CJ, 2026-11-25) |
| Elevation/2 Overlay | `--elevation-2-overlay` | 0 4 16 `--shadow-floating`. Menus and popovers |
| Elevation/3 Floating | `--elevation-3-floating` | 0 8 32 `--shadow-floating`. Dialogs and toasts |
| Elevation/Thumb | `--elevation-thumb` | 0 1 3 `--shadow-thumb`. The switch thumb and the selected segment |
| Glow/Accent | `--glow-accent-shadow` | Transparent |
| Grain/Coarse | none | Noise has no CSS equivalent and is not built |

## 4. Layout

The app shell on a 1440 frame. The Layout board on Foundations draws it to scale.

| Part | Measure |
|---|---|
| Sidebar | 300 plus a hairline right edge. `--surface-shell`, `--border-raised` on the right only, padding `--space-20`, sections `--space-24` apart. Collapsed is 76 |
| Nav items | 36 tall, `--space-4` apart, `--radius-sm` |
| Page header | 64, with no hairline under it (CJ, 2026-11-25). A 36 row centered in it, `--space-32` at the sides. The area's icon at 18 on `--text-secondary`, then the page name in Label/M on `--text-secondary` or the Breadcrumb, and the actions on the right 8 apart |
| Content | `--space-24` at the top, `--space-32` at the sides, sections `--space-32` apart |
| Scroll | Main scrolls and the window never does. The header row, the content and the footer links scroll together, and nothing sticks (CJ, 2026-11-16) |
| Footer Links | At the foot of the content on every page. The frames draw none, and decision 14 keeps them |
| Generate | One 720 column, centered |
| Fill page | The preview stage on `--surface-stage` with `--radius-xl`, and the 380 Details panel on `--surface-raised`, padding `--space-20`, fields `--space-24` apart |
| Filter bar | 36 tall, items `--space-8` apart (CJ, 2026-11-25) |
| Inspector | 320 wide |
| Breakpoint | Under 1024 the sidebar folds into the mobile bar |

## 5. Components

### 5.1 Core

The type pages hold each component's board with its main component. "Change" is what the ElevenLabs file draws differently from the new-brand primitives. "Tokens" means the change arrives through Phase E1 and needs no component code.

| Component | Node | Board | React | File | CSS | Change |
|---|---|---|---|---|---|---|
| Button | `2206:542` | `6219:712` | `Button` | `primitives/Button.tsx` | `.ui-btn` | Tokens. Icons follow the label color in every kind. The icon swaps with a drawn check, a busy button shows a spinner, and it shrinks while pressed (sections 7.3 and 7.5) |
| Icon Button | `2206:686` | `6219:1664` | `IconButton` | `primitives/IconButton.tsx` | `.ui-iconbtn` | New `variant="outline"`, a bordered square on `--radius-sm`, glyph on `--text-secondary` at rest. Disabled glyphs on `--text-disabled`. Swaps, spins and presses as Button (sections 7.3 and 7.5) |
| Send Button | `2206:754` | `6219:2090` | `SendButton` | `primitives/Button.tsx` | `.ui-send` | Tokens. Shrinks while pressed (section 7.5) |
| Input | `2207:263` | `6220:3` | `Input` | `primitives/Field.tsx` | `.ui-input` | Rests on `--surface-field` with a `--border-field` hairline, `--border-field-hover` on hover, `--feedback-error` on error |
| Text Area | `2207:298` | `6220:305` | `TextArea` | `primitives/Field.tsx` | `.ui-input` | As Input. Filled shows the copy Icon Button for generated captions |
| Select | `2207:410` | `6220:430` | `Select` | `primitives/Select.tsx` | `.ui-select` | As Input |
| Search | `2207:455` | `6220:720` | `Search` | `primitives/Search.tsx` | `.ui-input` | As Input. It rests with a `--border-field` hairline and hovers on `--border-field-hover` |
| Search Field | `50:62` | `6220:840` | `SearchField` | `primitives/SearchField.tsx` | `.ui-search` | New `size`: `md` 36 on `--radius-sm`, the default and every filter bar's (CJ, 2026-11-25), and `lg` 46 on `--radius-chip`. A real clear Icon Button. Hover on `--action-neutral-hover` |
| Field | `4015:628` | `6220:980` | `Field` | `primitives/Field.tsx` | `.ui-field` | Holds a Medium control. Label `--space-12` above it. Help text stays off |
| Upload | `2211:278` | `6220:1107` | `Upload` | `primitives/Upload.tsx` | `.ui-upload` | As Input. The empty thumbnail sits on `--surface-soft`. A picked or dropped photo develops in, and a slow upload pulses the tile (section 7.6) |
| Stepper | `2211:227` | `6220:1214` | `Stepper` | `primitives/IconButton.tsx` | `.ui-stepper` | The capsule sits on `--surface-soft`. Inside the composer it has no capsule at rest, and each button hovers on `--state-hover` (CJ, 2026-11-25) |
| Switch | `2211:90` | `6221:3` | `Switch` | `primitives/Toggles.tsx` | `.ui-switch` | Tokens |
| Checkbox | `2211:148` | `6221:101` | `Checkbox` | `primitives/Toggles.tsx` | `.ui-check` | Tokens. The mark draws in (section 7.4) |
| Radio | `2211:187` | `6221:259` | `Radio` | `primitives/Toggles.tsx` | `.ui-check` | Tokens |
| Segment | `2211:211` | `6221:375` | `Segment` | `primitives/Toggles.tsx` | `.ui-segmented` | Tokens. Inside a Segmented Control the thumb draws its selected fill (section 7) |
| Segmented Control | `2211:213` | `6221:459` | `SegmentedControl` | `primitives/Toggles.tsx` | `.ui-segmented` | The liquid selection (section 7) |
| Badge | `2212:130` | `6222:3` | `Badge` | `primitives/Chips.tsx` | `.ui-badge` | `--radius-chip` instead of full |
| Tag | `2212:143` | `6222:156` | `Tag` | `primitives/Chips.tsx` | `.ui-tag` | `--radius-tag` instead of full |
| Chip | `2212:187` | `6222:216` | `Chip` | `primitives/Chips.tsx` | `.ui-chip` | `--radius-chip` instead of full. Selected on `--state-selected` under `--text-primary` (CJ, 2026-11-25). Shrinks while pressed (section 7.5) |
| Avatar | `2212:214` | `6222:352` | `Avatar` | `primitives/Navigation.tsx` | `.ui-avatar` | Tokens |
| Tooltip | `2213:206` | `6222:434` | `Tooltip` | `primitives/Overlays.tsx` | `.ui-tooltip` | Tokens |
| Toast | `2213:213` | `6222:470` | `Toast` | `primitives/Overlays.tsx` | `.ui-toast` | Tokens. Eases in and out, and its timer waits while the pointer or focus is on it (section 7.2) |
| Alert | `2215:302` | `6222:526` | `Alert` | `primitives/Alert.tsx` | `.ui-alert` | Tokens |
| Progress Bar | `2215:272` | `6222:592` | `ProgressBar` | `primitives/Containers.tsx` | `.ui-progress-bar` | The track on `--surface-soft` |
| Progress Steps | `2221:1105` | `6222:626` | `Progress` | `primitives/Containers.tsx` | `.ui-progress` | Pending steps on `--surface-soft` |
| Skeleton | `2215:286` | `6222:710` | `Skeleton` | `primitives/Skeleton.tsx` | `.ui-skeleton` | Tokens. `--surface-skeleton` is now solid gray |
| Empty State | `2215:304` | `6222:770` | `EmptyState` | `primitives/EmptyState.tsx` | `.ui-empty` | Tokens |
| Nav Item | `2213:109` | `6221:525` | `NavItem` | `primitives/Navigation.tsx` | `.ui-nav-item` | The icon and label rest on `--text-item` and lift to `--text-primary` (CJ, 2026-11-25) |
| Breadcrumb | `2213:111` | `6221:621` | `Breadcrumb` | `primitives/PageHeader.tsx` | `.ui-breadcrumb` | Tokens |
| Menu Item | `2213:157` | `6221:659` | `MenuItem` | `primitives/Menu.tsx` | `.ui-menu` | Rests on `--text-item` and lifts to `--text-primary` when highlighted or selected (CJ, 2026-11-25) |
| Menu | `2213:159` | `6221:803` | `Menu` | `primitives/Menu.tsx` | `.ui-menu` | `--surface-raised`, a `--border-raised` hairline, `--elevation-2-overlay`, `--radius-lg` 12 |
| Tab | `4015:635` | `6221:959` | `Tab` | `primitives/Toggles.tsx` | `.ui-tabs` | Tokens |
| Tabs | `4015:673` | `6221:1011` | `Tabs` | `primitives/Toggles.tsx` | `.ui-tabs` | Tokens |
| Page Header | `4015:764` | `6221:1053` | `PageHeader` | `primitives/PageHeader.tsx` | `.ui-page-header` | Rebuilt. The area icon at 18 on `--text-secondary` leads, then the title in Label/M on `--text-secondary`, or the Breadcrumb. Sits in the 64 header row, which has no hairline under it since 2026-11-25 (CJ) |
| Footer Links | `4015:750` | `6221:1160` | `FooterLinks` | `primitives/PageHeader.tsx` | `.ui-footer-links` | Tokens |
| Card | `2215:141` | `6222:835` | `Card` | `primitives/Containers.tsx` | `.ui-card` | Flat on `--surface-raised` with a `--border-raised` hairline and `--radius-xl` 16 |
| Dialog | `2215:203` | `6222:915` | `Modal` | `primitives/Containers.tsx` | `.ui-modal-scrim` | `--surface-raised`, a `--border-raised` hairline, `--elevation-3-floating`, `--radius-xl` 16 |
| Metric | `2215:223` | `6222:1093` | `Metric` | `primitives/Containers.tsx` | `.ui-metric` | Flat, as Card. The value rolls when the member changes the range (section 7.7) |
| Table Row | `2215:270` | `6222:1166` | `TableRow` | `primitives/TableRow.tsx` | `.ui-table` | Tokens |

### 5.2 Product components

On `4012:1194`, one column per area.

| Component | Node | Code | Change |
|---|---|---|---|
| Sidebar | `2218:679` | `Sidebar.tsx` | Flush on `--surface-shell`, right edge only. Open, the Logo beside the theme toggle and a collapse button, and a settings button in the account row. Collapsed, the mark above Expand, and the avatar alone. All four are Ghost Small (CJ, 2026-11-25) |
| Logo, Logo Mark | `54:66`, `61:467` | `BrandMark.tsx` | CJ updated the lockup in the Sidebar (`6243:8529`, its mark in the collapsed rail `6112:44073`), on `logo/ink`, so it is near-black on Light and off-white on Dark. The sign-in gate places the same lockup as instances of CJ's New Logo Dark 1 (`6243:17235`, Default) at 24 tall on `logo/ink` (CJ, 2026-11-17). Logo (`54:66`) still draws the earlier lockup on Create account and the Cover |
| Platform Logo | `53:73` | `primitives/Chips.tsx` | Artwork |
| Platform Chip | `53:96` | `primitives/Chips.tsx` | 36 tall (`--size-control-md`), `--radius-sm`, the logo at 16 with no tile, no fill or edge at rest, hover on `--state-hover`. Selected on `--state-selected` under `--text-primary` with a down chevron, the only chip that shows one (CJ, 2026-11-25). Shrinks while pressed (section 7.5) |
| Template Card, Builder Template Card | `4018:129`, `4018:156` | `templates/TemplateCard.tsx`, `admin/BuilderTemplateCard.tsx` | Flat on `--surface-card` |
| Template Thumbnail | `25:853` | `TemplateThumbnail.tsx` | Artwork with Variation 1, 2 and 3 |
| Size Covers | `327:1985` and eleven more | `builder/SizeGallery.tsx` | Artwork |
| Composer | `6024:218` | `chat/ChatComposer.tsx` | One line between the plus and Send on `--radius-composer`, attachments and details stacked above. Lifts in Light on Elevation/Composer (CJ, 2026-11-25) |
| Message Bubble, Assistant Message | `2216:224`, `2216:235` | `chat/Messages.tsx` | Tokens |
| Result Card | `2216:287` | `primitives/Previews.tsx` | The stage on `--surface-stage`. The art develops in when a run finishes, and its downloads confirm with a check (sections 7.3 and 7.6) |
| Variation Tile | `2216:315` | `primitives/Previews.tsx` (`LookTile`) | Rename to `VariationTile` |
| Recent Card, History Card | `4018:183`, `4018:1728` | `generate/RecentCard.tsx`, `generate/HistoryCard.tsx` | Flat on `--surface-card` |
| Overview, Color, Logo and Image Cards, Font and Type Style Rows | `4018:1737`, `4018:1755`, `4018:1794`, `4018:1868`, `4018:1822`, `4018:1849` | `admin/brand/*` | Logo plates on `--plate-dark` and `--plate-light` |
| Layer Row, Form Row, Element Tile, Effect Row | `321:30`, `321:64`, `321:77`, `392:8266` | `builder/*` | Rows on `--radius-sm` with `--space-8` gaps |
| Settings Card, Slot, Member Row, Link Row | `4018:1887`, `4018:1873`, `4018:1904`, `4018:1928` | `primitives/Containers.tsx`, `admin/settings/*`, `admin/TemplateLinksDialog.tsx` | Tokens |
| Option Tile | `257:4145` | `primitives/OptionTile.tsx` | Tokens |

## 6. Patterns

On `4012:1195`, each in Light and Dark.

| Pattern | Board | Source | Built from |
|---|---|---|---|
| App shell | `6227:1078` | Brand Templates `6010:2064` | Sidebar, Nav Item, Avatar, Icon Button Outline, Breadcrumb |
| Filter bar | `6227:1610` | `6010:2071` | Search Field Medium, Platform Chip, Platform Logo (CJ, 2026-11-25) |
| Composer and recent posts | `6227:1771` | `6023:3101` | Composer, Icon Button, Stepper, Send Button, Recent Card |
| Result thread | `6227:1950` | `6023:3587` | Message Bubble, Assistant Message, Result Card, Segmented Control, Button |
| Variations bar | `6227:2171` | `6072:3701` | Segmented Control, Segment, Template Thumbnail |
| Inspector | `6227:2381` | `6072:3728` | Tabs, Field, Input, Select, Segmented Control, Switch |
| Details panel | `6227:2623` | `6010:2570` | Segmented Control, Field, Input, Upload, Text Area, Button |
| Settings page | `6227:2808` | `6095:1220` | Settings Card, Member Row, Link Row, Switch, Select, Badge |

## 7. Interactions

Foundations › Interactions (`6262:353`) draws each one with its timing and rules, and `reference/` in this folder holds the builds to feel and to follow: `liquid-selection.html` for 7.1 and `microinteractions.html` for 7.2 to 7.7. Both have a Slow motion switch that runs everything at four times its duration, and `microinteractions.html` has a Reduced motion switch as well.

Every interaction here keeps the same rules.

- Every duration and curve is a motion token that already exists, so `tokens.css` sets them all to zero under reduced motion. The one value reused from outside the tokens is the Stepper's roll in `primitives/useRoll.ts`.
- A press, a check drawing in and an icon swapping are direct feedback, and they play only when the pointer caused them. When `<html>` carries `data-input="keyboard"` (`primitives/inputModality.ts`) they land at once, as the liquid selection does.
- A toast, a finished result, an uploaded photo and new numbers are arrivals, and they play for everyone, since they answer the content and not the hand.
- First paint never animates. Whatever is on screen when a page loads is simply there.
- Hover never animates beyond its color change, and an arrow glyph only ever fades. Nothing moves or scales an arrow.
- Only `opacity`, `translate`, `scale`, `filter` and `stroke-dashoffset` animate, so nothing shifts the layout, and anything retriggered mid-flight retargets from where it is.
- Each section names the BYQ Supply gem it is adapted from and what was left out of it.

### 7.1 Liquid selection

When one option replaces another in a Segmented Control (`2211:213`), the thumb travels to it and a drop of the same color stretches after it, so the change reads as one object moving. It is adapted from BYQ Supply's Gooey Nav Indicator, which CJ supplied (`reference/gooey-nav-01/`). `reference/liquid-selection.html` is the build to follow: open it, tick Slow motion and click between the options.

Layers, bottom to top:

| Layer | What it is |
|---|---|
| Track | The Segmented Control's own `--control-track` ground |
| Liquid | `aria-hidden` and inset by the track's `--space-4`. A blob that rides under the thumb and an 18 drop, both on `--control-thumb`, under one shared SVG filter (`#sp-goo`, a blur of 4 and then alpha times 22 less 10, in sRGB) followed by `drop-shadow(0 1px 3px var(--shadow-thumb))`, so the strand between them casts Elevation/Thumb |
| Thumb | `aria-hidden` and crisp, on `--control-thumb` at `--radius-xs`, the size of the selected segment. It casts no shadow of its own, since the liquid under it does |
| Segments | The labels, above both, on `--text-secondary`, with the selected one on `--text-primary` |

Timing, on the motion tokens that already exist:

| Part | Moves | Duration | Easing | When |
|---|---|---|---|---|
| Thumb and blob | `translate` and `width` | `--motion-duration-base` | `--motion-easing-standard` | On the click |
| Drop | `scale` 0 to 1 | `--motion-duration-fast` | `--motion-easing-standard` | On the click, where the thumb was |
| Drop | `translate` | `--motion-duration-slow` | `--motion-easing-standard` | After a hold of half of fast |
| Drop | `scale` 1 to 0 | `--motion-duration-fast` | `--motion-easing-standard` | As the thumb lands, after base |
| Label | `color` | `--motion-duration-fast` | `--motion-easing-standard` | On the click, and on hover |

Rules:

- A click or a tap moves the thumb. Hover changes the label color only.
- The arrows, Home and End select at once with no travel and no drop. A selection is the keyboard's when `<html>` carries `data-input="keyboard"` (`primitives/inputModality.ts`) or the click has `detail` 0.
- Reduced motion snaps the thumb and hides the drop. `tokens.css` already sets every duration to 0 there.
- A second click retargets from wherever the thumb is. The timer resets on every change, and nothing waits for an animation to end.
- First paint, a resize and a change to the options place the thumb with no motion. Until it is placed, the selected segment draws its own thumb, so nothing flashes or shifts.
- At rest the control matches the Segment's Selected state in both themes.
- The ring stays on the focused segment, above the thumb.
- Only `translate`, `width` and `scale` animate, on shapes placed out of the flow, and the filter repaints one 28 tall strip for about 300ms. `will-change` goes in only after a measured stutter.

Every Segmented Control gets it, which covers the variations bar (`builder/VariationSwitch.tsx`), the Details panel's Variation picker, Layers and Form, Edit and Preview, the theme in Account and the rest of its uses. Tabs do not, since they swap whole panels and change at once, and neither do Platform Chips, nav items or menus, which have no thumb to move.

### 7.2 The Toast eases in and waits

Adapted from BYQ Supply's Undo Toast. Today a toast appears and vanishes with no motion, and the 5 seconds Brand Studio gives its Undo keep running while the pointer is on its way to the button.

| Part | Moves | Duration | Easing | When |
|---|---|---|---|---|
| Enter | `opacity` 0 to 1 and `translate` from `--space-8` below | `--motion-duration-base` | `--motion-easing-enter` | As it mounts, as a transition from `@starting-style` |
| Exit | `opacity` 1 to 0 and `translate` back down `--space-8` | `--motion-duration-fast` | `--motion-easing-exit` | When its time runs out or Undo is pressed |
| Turn back | Back to rest from wherever it is | `--motion-duration-base` | `--motion-easing-enter` | A new message while it leaves |

Rules:

- The Toast owns its timer. `Toast` gains `open` (default true), `duration` and `onTimeout`. Brand Studio passes its 5000 (`TOAST_MS` in `admin/brand/kitPlumbing.ts`) and Settings its 4000 (`admin/settings/settingsToast.tsx`) in place of their own `setTimeout`.
- The timer pauses while the pointer is over the toast, while focus is inside it and while the tab is hidden, then resumes with the time that was left.
- When `open` turns false it plays its exit and unmounts after `--motion-duration-fast`. A new message while it leaves turns it back, and a message that replaces one on screen changes in place with no replay.
- If focus is inside it when it leaves, focus returns to the page before it unmounts.
- Left out of the gem: the countdown bar, since a line moving for five seconds pulls the eye off the work and the pause already answers the timing, and the Undo button's 1.04 hover scale.

Every Toast eases in from Phase E1, and each one waits and eases out once its caller hands it the timer. Brand Studio's Undo (`admin/BrandStudio.tsx`) and the Settings sections' messages move onto it in Phase E1, the fill page's toast (`TemplateFill.tsx`) in Phase E3, the export toasts (`generate/EditorPanel.tsx`, `generate/GeneratePage.tsx`) in Phase E4, and the Template Builder list's (`admin/AdminTemplates.tsx`) in Phase E5, each keeping its duration.

### 7.3 Icons swap and the check draws itself

Adapted from BYQ Supply's Copy Button and Async Button. Today Copy caption swaps its glyph for a check at once, and Download shows nothing between the click and the file.

| Part | Moves | Duration | Easing | When |
|---|---|---|---|---|
| Leaving glyph | `opacity` 1 to 0 and `scale` 1 to 0.7 | `--motion-duration-base` | `--motion-easing-standard` | When the icon changes |
| Arriving glyph | `opacity` 0 to 1 and `scale` 0.7 to 1 | `--motion-duration-base` | `--motion-easing-standard` | At the same time |
| Check | `stroke-dashoffset` 1 to 0 on `pathLength="1"` | `--motion-duration-base` | `--motion-easing-standard` | After a hold of half of fast |
| Spinner | `rotate` a full turn, looping | `calc(var(--motion-duration-pulse) * 0.6)`, 900 | linear | While busy, once the wait passes 400 ms |

Rules:

- Button and Icon Button animate any change of their `icon` prop inside one 16 slot, so every caller that swaps Copy for Check gets it with no change. The width never changes and the label stays.
- The check is the Checkbox's mark (`M3.5 8.5l3 3 6-7` on 16, at a 1.5 stroke), drawn. On its way out it fades whole and is not undrawn.
- One hold for every confirmation, 1500 ms, as `CONFIRM_MS` in `primitives/`. Today the Result Card holds 1500 (`COPIED_MS` in `Previews.tsx`) and the Details panel 1600 (`details/DetailsPanel.tsx`).
- Button and Icon Button gain `busy`, which sets `aria-busy` and `aria-disabled` as callers do by hand today and shows the spinner in the slot once the wait passes 400 ms. A quicker file goes straight from Download to the check. When the work finishes, the caller shows the check for the hold and Download returns.
- An arrow only fades. Download's glyph never scales, and Send to Stop keeps its instant swap.
- Under reduced motion the glyphs swap at once and the spinner stands still.
- Left out of the gems: the Async Button's collapse into a circle, since the width change moves everything beside it, and the lime and yellow tints, so the check takes the button's own text color.

Copy caption on the Result Card and in the Details panel, Copy on the Sharing, Public links and Template links rows, and Download and Download both on the Result Card. Phase E1 builds the swap, `busy` and `CONFIRM_MS` into Button and Icon Button, and Phase E4 gives the Result Card's downloads their check.

### 7.4 The checkbox mark draws in

Adapted from BYQ Supply's Checkbox Tick.

| Part | Moves | Duration | Easing | When |
|---|---|---|---|---|
| Mark | `stroke-dashoffset` 1 to 0 on `pathLength="1"` | `--motion-duration-fast` | `--motion-easing-standard` | On check |

Rules:

- The mark is always in the box, with the check and the dash as two paths, so a box that is checked when the page loads is simply drawn. `CheckMark` in `primitives/Toggles.tsx` renders both and shows one by state.
- The box keeps its color change. Unchecking clears at once, and moving between checked and mixed clears the old mark at once and draws the new one.
- Several boxes checked by one action draw together, with no stagger.
- Radio's dot does not change.
- Left out of the gem: the squish and bounce (0.82 to 1.12), since people check boxes in runs, the strikethrough on the label, and its 300 ms draw.

Every Checkbox, in Bulk Fill, onboarding and the Option Tiles. Phase E1.

### 7.5 Press scale

Adapted from the Undo button in BYQ Supply's Undo Toast.

| Part | Moves | Duration | Easing | When |
|---|---|---|---|---|
| Control | `scale` 1 to 0.97 | `--motion-duration-fast` | `--motion-easing-standard` | While pressed, and back the same way on release |

Rules:

- Button in every kind and size, Icon Button, Send Button, Chip and Platform Chip. Never when disabled or `aria-disabled`.
- The pressed color still changes as it does today. The scale is the `scale` property, so it never fights a `transform` a component sets.
- Nav items, menu items, table rows, Segments, tiles and cards stay still. A 3 percent shrink on something that wide reads as the layout moving, and a Segment's thumb already answers its press.
- Pointer only, so holding Space on a focused button does not shrink it.

Phase E1.

### 7.6 Results develop in

Adapted from BYQ Supply's Blur-Up Image Reveal, with the drop moment from its Drop Zone.

| Part | Moves | Duration | Easing | When |
|---|---|---|---|---|
| Result art | `opacity` 0 to 1 and `filter: blur(4px)` to none | `--motion-duration-slow` | `--motion-easing-enter` | Once the finished draft's images have decoded |
| Upload thumbnail | The same | `--motion-duration-base` | `--motion-easing-enter` | Once the picked or dropped photo has decoded |

Rules:

- The Result Card's frame and tools take the skeleton's place at once, since the skeleton already has their shape, and only the art arrives. The skeleton holds until the art can paint whole. `ResultCard` gains `arrive`, which the thread sets on the card a run has just finished.
- A revisit, scrolling back through the thread, a reload and switching sizes or drafts show the art at once.
- `Upload` gains `busy`. An upload that runs past 400 ms shows the existing skeleton pulse on the tile until the photo is ready, and a quicker one goes straight to the arrival. A thumbnail that is there when the page loads is simply there.
- No progress bar is drawn, since nothing reports upload progress.
- Left out of the gems: the 1 second timing, the 18px blur, the 1.12 zoom and the random cascade, and Drop Zone's 1.02 scale, glow, bouncing icon and timed progress bar.

The Result Card in Generate and the template chat (`chat/GenerateTurn.tsx`, `chat/TemplateChatViews.tsx`) in Phase E4. Every Upload develops in from Phase E1, and the builder's background and static image uploads (`builder/TemplateBuilder.tsx`, `builder/FieldInspector.tsx`), the only callers that track an upload today, pass `busy` in Phase E5.

### 7.7 Insights numbers roll

Adapted from BYQ Supply's Odometer Counter, on the roll the Variations stepper already has.

| Part | Moves | Duration | Easing | When |
|---|---|---|---|---|
| Old digit | `translate` 18 up (down when the number fell) and `opacity` 1 to 0 | 130 ms | `ease-in` | When the new numbers land |
| New digit | `translate` from 18 below (above when it fell) and `opacity` 0 to 1 | 190 ms | `cubic-bezier(0.3, 1.5, 0.5, 1)` | As the old one leaves |

Rules:

- The timing is `useRoll`'s (`primitives/useRoll.ts`), applied per digit. Move its values into one place both share instead of copying them.
- Only digits that changed roll. Unchanged digits and separators hold still on tabular numerals, a digit that appears rolls in from blank and one that goes rolls out to blank.
- It plays when new numbers land after the member changes the range or a filter, in place of today's swap after the dim. `Metric` gains `roll`, and first load, a background refresh and a page opened at a range swap at once.
- Every Metric rolls together, with no stagger. Screen readers read the whole number once, and the digits are `aria-hidden`.
- Left out of the gem: the two full spins, the reels of 0.85 to 1.25 seconds, the scroll trigger and the fade mask.

The four headline numbers on Insights (`admin/Dashboard.tsx`). Phase E7. They draw with `InsightKpi` (`admin/insights/InsightKpi.tsx`) today, while the frame draws them as frames laid out like Metric, so Phase E7 builds them on `Metric`, or keeps `InsightKpi` and gives it the roll if it has to stay, with the reason in the pull request. The roll is not the count-up new-look Phase 8 removed (its D10), since it never counts from zero and plays only on a change the member made.

## 8. Rules

`RULES.md`. Where a rule and the file disagree, the file wins and the pull request records the exception.

## 9. How every phase works

`RULES.md` section 12.
