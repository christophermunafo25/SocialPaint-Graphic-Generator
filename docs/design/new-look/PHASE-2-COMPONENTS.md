# New look, Phase 2: component reference

Extracted from the Figma file "Master UX-UI" (`mEJRslarcQDkgPeY6AObi5`) on 2026-10-03, read only: bound variables, auto-layout, text styles and effect styles for every variant on Master UI Elements (`24:674`), and the Interaction states table (`105:641`). `PHASE-2.md` builds from this file. Where this file and the live Figma file disagree, the Figma file wins; where this file lists something as surprising, `PHASE-2.md` §8 gives the ruling.

`docs/design/new-look/reference/interaction-states.png` is the table exported at 1x (3172 × 4532), the reference for the `/dev/ui` gate.

Token names are the CSS custom properties in `src/styles/tokens.css`. Text styles are the `.t-*` classes in the same file. "Unbound" means a raw value in Figma; "unknown" means the tools did not expose it.

Contents:

- Part A: controls (buttons, icon buttons, fields and pickers, toggles)
- Part B: chips, tags, avatars, navigation, menus and overlays, containers
- Part C: the Interaction states table and the chat components

---

# Part A: controls

Source: read-only Plugin API dump of every variant in each set (bound variables, auto-layout, text styles, effect styles), plus get_design_context on 43:13 and get_variable_defs on 43:123. File key mEJRslarcQDkgPeY6AObi5. Read 2026-10-03.

Conventions in this doc:
- `--x` is the CSS custom property from `src/styles/tokens.css`; the Figma variable name is in brackets the first time.
- "unbound" means Figma holds a raw number or colour there, with no variable or style.
- Padding is written `top/right/bottom/left`.
- **Hover layering.** Every "fill + state" below is two paints on the same node: the base fill, then the state colour stacked on top at the alpha the variable already carries. The paint opacity only repeats the variable's alpha, so nothing is applied twice. In CSS that is `background: linear-gradient(var(--state-hover), var(--state-hover)), var(--base)` or an overlay pseudo-element. "Pressed doubles it" means the `-pressed` token, which has twice the alpha. It does not mean stacking hover and pressed together.
- **Focus ring (shared).** Every set has a `Focus` boolean prop (default false) that shows a hidden absolute frame. Pattern A (outside): frame at -3,-3, 6px bigger than the control, 1px INSIDE stroke `--ring` [focus/ring], weight `--focus-width` [focus/width]. That draws a 1px ring with a 2px gap, which equals `outline: var(--focus-width) solid var(--ring); outline-offset: var(--focus-offset)`. Ring radius = control radius + 3 (unbound: 12 / 10 / 999). Pattern B (tight, Segment and Tab only): frame at -1,-1, radius 8 (unbound), so the ring sits against the edge.
- **Disabled** is the whole component at opacity 0.4 (Stepper button uses 0.32). No colour tokens change.

## Token values used in this slice (Light / Dark)

| Figma variable | CSS property | Light | Dark |
|---|---|---|---|
| button/primary-bg | --btn-primary-bg | deep-moss #082a23 | slime #17ff7e |
| button/primary-fg | --btn-primary-fg | slime #17ff7e | deep-moss #082a23 |
| surface/sunken | --surface-sunken | paper-100 #ececec | ink-700 #2f3133 |
| control/fill | --control-fill | paper-100 #ececec | ink-800 #171819 |
| surface/raised | --surface-raised | paper-000 #fff | ink-800 #171819 |
| surface/inverse | --surface-inverse | ink-900 #0b0b0c | paper-000 #fff |
| input/fill | --input-bg | paper-075-warm #f1f1ef | paper-075 @8% |
| control/track | --control-track | paper-075-warm #f1f1ef | ink-900 #0b0b0c |
| control/thumb | --control-thumb | paper-000 #fff | ink-700 #2f3133 |
| switch/track-on | --switch-track-on | ink-900 | paper-075 #f1f1f1 |
| switch/track-off | --switch-background | ink-900 @16% | paper-075 @30% |
| state/error | --state-error | #d43535 | #ec5656 |
| text/strong | --text-strong | ink-900 #0b0b0c | paper-075 #f1f1f1 |
| text/secondary | --text-secondary | ink-500 #636363 | ink-300 #a0a0a0 |
| text/inverse | --text-inverse | paper-000 #fff | ink-900 #0b0b0c |
| accent/green | --accent-green | slime | slime |
| accent/blue / accent/purple | --accent-blue / --accent-purple | lapis / violet | same |
| field/green | --field-green | deep-moss | deep-moss |
| state/hover | --state-hover | ink-900 @5% | paper-000 @6% |
| state/pressed | --state-pressed | ink-900 @10% | paper-000 @12% |
| state/hover-inverse | --state-hover-inverse | paper-000 @6% | ink-900 @5% |
| state/pressed-inverse | --state-pressed-inverse | paper-000 @12% | ink-900 @10% |
| state/hover-on-color | --state-hover-on-color | ink-900 @5% | ink-900 @5% |
| state/pressed-on-color | --state-pressed-on-color | ink-900 @10% | ink-900 @10% |
| state/selected | --state-selected | paper-050 #f9f9f8 | ink-700 #2f3133 |
| focus/ring | --ring | ink-750 #272727 | paper-000 #fff |
| focus/width | --focus-width | 1px | 1px |
| radius/control | --radius-control | 7 | |
| radius/field | --radius-control-md | 9 | |
| radius/pill | --radius-pill | 999 | |
| space/3xs, 2xs, xs, sm | --space-3xs/2xs/xs/sm | 4 / 8 / 12 / 16 | |
| theme/is-light, theme/is-dark | none (boolean; build-tokens.mjs skips it, since it is the `[data-theme]` selector) | | |

Text styles used (Figma style → class): Button/M → `.t-button-m` (500 14/1.25, -1%); Button/S → `.t-button-s` (500 12/1.3, -1%, cap-height trim, which the class includes); Body/S → `.t-body-s` (400 14/1.4); Body/XS → `.t-body-xs` (400 13/1.4); Control/M → `.t-control-m` (500 14/normal, -1%); Control/S → `.t-control-s` (500 13/1.3, -1%); Label/XS → `.t-label-xs` (500 12/1.25). All are Raveo Display.

Effect used: Elevation/Thumb → `--elevation-thumb` (0 1px 3px #00000014; the colour is raw and the same in both modes).

Icons: every icon instance uses the `Size=16` variant of its set (each set has Size=16 and Size=18). Sets are scaled to 14 (Button Small, Attach) and 20 (Search). The Size=16 stroke is 1.333.

---

## Button — 43:123 (COMPONENT_SET)

Props: `Kind` Primary | Neutral | Neutral on page | Destructive · `Size` Large | Medium | Default | Small · `State` Default | Hover | Pressed | Disabled · `Label` text "Button" · `Show icon` bool (false) · `Icon` instance swap (default 39:127) · `Focus` bool.
Layout: horizontal, centred both ways, hug width, fixed height. The icon comes before the label.

| Size | H | pad x | gap | radius | icon | label style |
|---|---|---|---|---|---|---|
| Large | 44 | 18 (unbound) | 8 `--space-2xs` | 9 `--radius-control-md` | 16 | Button/M `.t-button-m` |
| Medium | 40 | 18 (unbound) | 8 `--space-2xs` | 9 `--radius-control-md` | 16 | Button/M |
| Default | 36 | 16 `--space-sm` | 6 (unbound) | 7 `--radius-control` | 16 | Button/M |
| Small | 28 | 10 (unbound) | 6 (unbound) | 7 `--radius-control` | 14 (Size=16 scaled) | Button/S `.t-button-s` (trimmed, text box 9 tall) |

Padding y is 0 everywhere; the height is fixed. There is no border and no effect. The default icon is icon/plus, hidden; the icon takes the label colour (the Neutral sample's vectors are `--text-strong`).

| Kind | Default fill | Hover (stacked) | Pressed (stacked) | Label |
|---|---|---|---|---|
| Primary | --btn-primary-bg | + --state-hover-inverse | + --state-pressed-inverse | --btn-primary-fg |
| Neutral (inside cards/panels) | --surface-sunken | + --state-hover | + --state-pressed | --text-strong |
| Neutral on page | --control-fill | + --state-hover | + --state-pressed | --text-strong |
| Destructive | --state-error | + --state-hover-on-color | + --state-pressed-on-color | --text-inverse |

Disabled: the Default fill at opacity 0.4. Focus: pattern A, ring radius 12 for L/M and 10 for Default/Small.

## Send button — 44:9

Props: `Action` Send | Stop · `State` Default | Hover | Pressed · `Focus`.

| | value |
|---|---|
| size | 36×36 fixed, no padding, centred |
| radius | 999 `--radius-pill` |
| fill | --accent-green; Hover + --state-hover-on-color; Pressed + --state-pressed-on-color |
| Send glyph | icon/arrow-up Size=16, 16px, colour --field-green |
| Stop glyph | frame 12×12 with radius 2 (unbound; `--radius-xs` would fit), holding a rect filled --field-green. Not an icon component |
| focus | pattern A, ring 42×42 r999 |

## Row menu trigger — 44:29

Props: `State` Default | Hover | Open | Disabled · `Focus`.

| | value |
|---|---|
| size | 32×32, centred, radius 7 `--radius-control` |
| icon | icon/ellipsis Size=16, 16px, --text-secondary in every state |
| fill | Default none · Hover --state-hover · Open --surface-sunken · Disabled none at op 0.4 |
| focus | pattern A, r10 |

## Icon button — 95:516

Props: `Style` Filled | Ghost · `State` Default | Hover | Pressed | Selected | Disabled · `Icon` swap (default 39:143, icon/x) · `Focus`. Selected exists only for Ghost (Filled has 4 variants).

| Style | size | radius | Default | Hover | Pressed | Selected | icon colour |
|---|---|---|---|---|---|---|---|
| Filled | 32×32 | 999 `--radius-pill` | --surface-sunken | + --state-hover | + --state-pressed | n/a | --text-strong |
| Ghost | 32×32 | 7 `--radius-control` | none | --state-hover | --state-pressed | --state-selected | --text-secondary; Selected → --text-strong |

Icon is 16px. Disabled: op 0.4. Focus: pattern A, r999 (Filled) or r10 (Ghost).

## Attach button — 102:569

Props: `State` Default | Hover | Pressed · `Focus`.

| | value |
|---|---|
| size | 28×28, radius 7 `--radius-control` |
| fill | --surface-inverse; Hover + --state-hover-inverse; Pressed + --state-pressed-inverse |
| icon | icon/plus Size=16 scaled to 14px, colour **--surface-raised** (a surface token used as a glyph colour) |
| focus | pattern A, r10 |

## Theme toggle — 102:574

Props: `State` Default | Hover | Pressed · `Focus`.

| | value |
|---|---|
| size | 32×32, radius 999 **unbound** (no radius variable) |
| fill | --surface-sunken; Hover + --state-hover; Pressed + --state-pressed |
| glyph | hand-drawn frames, not icon components. "sun" is 15×15 (5px circle and 8 rays, stroke 1.5 --text-secondary), visible bound to theme/is-light. "moon" is 15×15 (one vector 11.24, stroke 0.94 --text-secondary), visible bound to theme/is-dark |
| focus | pattern A, r999 |

## Input — 48:37

Props: `Size` Default | Small | Multiline · `State` Placeholder | Filled | Focused | Hover · `Text` text "Creative Director". There is **no Disabled state and no Focus ring prop**: by design, focus is the caret only.

| Size | W×H (sample) | padding | gap | align | radius | text style |
|---|---|---|---|---|---|---|
| Default | 320×40 | 0/12/0/12 (x bound `--space-xs`) | 2 (unbound) | left, v-centre | 9 `--radius-control-md` | Body/S `.t-body-s` |
| Small | 320×32 | 0/10/0/10 (unbound) | 2 | left, v-centre | **7 `--radius-control`** | Body/XS `.t-body-xs` |
| Multiline | 320×100 | 10/12/10/12 (y unbound, x `--space-xs`) | 2 | top-left | 9 `--radius-control-md` | Body/S |

| State | fill | text colour | extra |
|---|---|---|---|
| Placeholder | --input-bg | --text-secondary | |
| Filled | --input-bg | --text-strong | |
| Focused | --input-bg | --text-secondary (the sample shows placeholder text with the caret) | caret rect 2×18 (Small 2×16), fill --text-strong, before the text, gap 2 |
| Hover | --input-bg + --state-hover | --text-secondary | |

No border, no effect. Width is fixed at 320 in the sample (fill-width in use).

## Field — 48:38 (single COMPONENT)

Vertical stack, gap 6 (unbound), width 320, hug height (61, or taller with the error). Children: a "label row" (horizontal) holding the label text (Label/XS `.t-label-xs`, --text-secondary, sample "Headline"), then a nested **Input** instance (Size=Default, State=Filled, exposed).

Updated 2026-10-04: `Error` boolean (default off) and `Error text` (sample "Add a headline."). The error sits 6 under the input, in Caption/S `.t-caption-s`, colour --state-error. The input itself does not change. Light and Dark example: 182:1965. There is no hint or helper text (RULES §9).

## Select — 49:40

Props: `Size` Default | Large · `State` Default | Placeholder | Hover | Open | Disabled · `Value` text "Moss" · `Focus`.

| Size | W×H | padding | gap | radius |
|---|---|---|---|---|
| Default | 200×36 | 0/12/0/12 (x `--space-xs`) | 2 (unbound) | 9 `--radius-control-md` |
| Large | 200×40 | same | 2 | 9 |

Value: Body/S `.t-body-s`, fill-width. Chevron: icon/chevron-down Size=16, 16px, --text-secondary, at the right end.

| State | fill | value colour |
|---|---|---|
| Default | --input-bg | --text-strong |
| Placeholder | --input-bg | --text-secondary |
| Hover | --input-bg + --state-hover | --text-strong |
| Open | --input-bg + --state-pressed | --text-strong |
| Disabled | --input-bg, op 0.4 | --text-strong |

Focus: pattern A, r12.

## Switch — 49:45

Props: `Checked` On | Off · `State` Default | Hover · `Focus`. No Disabled variant.

| | value |
|---|---|
| track | 36×20, padding 2 all sides (unbound), radius 999 `--radius-pill` |
| knob | 16×16 ellipse, fill **--surface-raised** (not --control-thumb). On = right-aligned, Off = left-aligned |
| On | --switch-track-on; Hover + --state-hover-inverse |
| Off | --switch-background [switch/track-off]; Hover + --state-hover |
| focus | pattern A, 42×26 r999 |

## Segment — 49:50 and Segmented control — 49:51

Segment props: `State` Selected | Default | Hover · `Label` text "Instagram" · `Focus`.

| | value |
|---|---|
| segment | H 32, hug width, padding 0/14/0/14 (unbound), gap 0, radius 7 `--radius-control` |
| label | Control/S `.t-control-s`; --text-secondary (Default, Hover), --text-strong (Selected) |
| Default fill | none |
| Hover fill | --state-hover |
| Selected | --control-thumb plus effect Elevation/Thumb → `--elevation-thumb` |
| focus | pattern B (tight): -1 inset, r8 unbound |

Segmented control (single COMPONENT): hug both ways (sample 175×40), padding 4 `--space-3xs` all sides, gap 4 `--space-3xs`, radius 9 `--radius-control-md`, fill --control-track. Children are Segment instances (sample: Instagram Selected, LinkedIn Default).

## Tab — 49:62 and Tabs — 49:63

Tab props: `State` Selected | Default | Hover · `Label` text "Exports" · `Show dot` bool (true) · `Focus`.

| | value |
|---|---|
| tab | hug both (sample 89×29), padding 6/12/6/12 (x `--space-xs`, y unbound), gap 7 (unbound), radius 7 `--radius-control` |
| dot | 10×10 ellipse, series colour (sample --accent-green; in Tabs: --accent-green, --accent-blue, --accent-purple) |
| label | Control/M `.t-control-m`; --text-secondary (Default, Hover), --text-strong (Selected) |
| fills | Default none · Hover --state-hover · Selected --control-thumb + `--elevation-thumb` |
| focus | pattern B, r8 |

Tabs (single COMPONENT): hug (265×35), padding 3 all sides (unbound), gap 2 (unbound), radius 9 `--radius-control-md`, fill --control-track.

## Search field — 50:62

Props: `State` Collapsed | Hover | Open · `Query` text "hiring" · `Focus`.

| State | size | padding | gap | fill | contents |
|---|---|---|---|---|---|
| Collapsed | 50×50 | 8/6/8/6 (unbound) | 7 | --control-fill | icon/search (Size=16 scaled to **20**), --text-strong |
| Hover | 50×50 | same | 7 | --control-fill + --state-hover | same |
| Open | 440×50 fixed | 8/13/8/15 (unbound) | 10 (unbound) | --control-fill | search icon 20; value Body/S `.t-body-s` --text-strong, fill-width; "Clear search" 14×14 frame with a raw x vector (4.67, stroke 1.17 --text-secondary), not an icon component |

Radius 9 `--radius-control-md` in all states. Focus: pattern A, r12, on Collapsed and Hover only. Open has no ring and uses the caret, though the caret layer is **not drawn** in Open.

## Filter — 99:547

Props: `State` Default | Hover | Open · `Label` text "Last 30 days" · `Focus`.

| | value |
|---|---|
| size | hug width (125), H 36 |
| padding / gap | 0/12/0/14 (unbound, asymmetric) / 10 (unbound) |
| radius | 9 `--radius-control-md` |
| label | Control/M `.t-control-m`, --text-strong |
| chevron | **raw vector** 9×4.5, stroke 1.5 --text-strong (not icon/chevron-down) |
| fill | --control-fill · Hover + --state-hover · Open + --state-pressed |
| focus | pattern A, r12 |

## Compact select — 99:568

Props: `State` Default | Hover | Open · `Value` text "Any platform" · `Focus`.

| | value |
|---|---|
| size | hug width (105), H 28 |
| padding / gap | 0/6/0/9 (unbound) / 6 (unbound) |
| radius | 7 `--radius-control` |
| value | Button/S `.t-button-s` (trimmed), --text-strong |
| chevron | icon/chevron-down Size=16, 16px, **--text-strong** (Select uses --text-secondary) |
| fill | --surface-sunken · Hover + --state-hover · Open + --state-pressed |
| focus | pattern A, r10 |

## Stepper button — 100:544 and Stepper — 100:545

Stepper button props: `State` Default | Hover | Pressed | Disabled · `Icon` swap (default 39:135, icon/minus) · `Focus`.

| | value |
|---|---|
| size | 28×28, radius 999 `--radius-pill` |
| icon | 16px, --text-strong |
| fill | Default none · Hover --state-hover · Pressed --state-pressed |
| Disabled | op **0.32** (not 0.4) |
| focus | pattern A, r999 |

Stepper (single COMPONENT; props `Label` "Variations", `Value` "1"): hug width (147), H 28, padding 0/3/0/9 (unbound), gap 6 (unbound), radius 7 `--radius-control`, fill --surface-sunken. Children: the label (Button/S `.t-button-s`, --text-strong), then a "stepper" row with gap 0: Decrease (Stepper button, sample Disabled) · a "value" frame 20×28 holding the number (Button/S, --text-strong, centred) · Increase (Stepper button with icon/plus).

---

## Inconsistencies and decisions a builder needs

1. **Button radius splits by size.** Large and Medium use radius/field (9); Default and Small use radius/control (7). The radius/control token description says "Buttons", so either the split is intended or L/M are wrong.
2. **Button Medium is Large minus 4px of height.** Padding (18) and gap (8) are the same. Large/Medium padding (18) and the gap at Default/Small (6) are off the spacing scale, and so is Small's padding (10).
3. **Input Small uses radius/control 7.** Default and Multiline use radius/field 9, and the radius/field description says "Inputs".
4. **Select Default is 36; Input Default is 40.** Select "Large" (40) is the one that matches Input. Select and Input both use gap 2 (off-scale; it only matters for the caret).
5. **Input has no Disabled state.** Field now has error text (see Field) and, by decision, no helper text.
6. **Ghost icon button Selected in Light uses --state-selected = paper-050.** That is the same colour as --surface-page (paper-050), so a selected ghost on the page is invisible in Light.
7. **Attach button glyph uses --surface-raised** as its colour. The Switch knob also uses --surface-raised rather than --control-thumb, so in Dark the knob is ink-800 on a paper-075 On track.
8. **Destructive label is --text-inverse.** In Dark that is ink-900 on #ec5656, while Light is white on #d43535. Confirm the dark label colour is intended.
9. **Neutral and Neutral-on-page look identical in Light** (both paper-100). They differ only in Dark (ink-700 vs ink-800).
10. **Theme toggle radius is unbound** (999 raw); every other pill binds radius/pill. Its sun and moon glyphs are hand-drawn frames toggled by theme/is-light / is-dark, which are not CSS variables. Code would switch on `[data-theme]`.
11. **Not every glyph is an icon component.** Raw vectors are used for the Filter chevron, the Search clear "x" and the Send "stop" square, whose 2px radius is unbound even though --radius-xs exists. Decide whether the code uses the icon set for these.
12. **Icon scaling.** Every icon uses the Size=16 master, scaled to 14 (Button Small, Attach) and 20 (Search), so the strokes scale too. The Size=18 variants are never used.
13. **Stepper button disabled is 0.32 opacity**; everything else uses 0.4.
14. **Off-scale or unbound spacing:** Search (8/6, 8/13/8/15, gap 10), Filter (0/12/0/14, gap 10), Compact select (0/6/0/9, gap 6), Stepper (0/3/0/9, gap 6), Tab (y 6, gap 7), Tabs (padding 3, gap 2), Segment (x 14), Switch (padding 2), Field (gap 6), Multiline input (y 10).
15. **Focus-ring radii are raw** (12/10/8/999). In CSS, `outline` follows border-radius automatically, so nothing is needed if the ring is built as an outline.
16. **Compact select chevron is --text-strong; Select chevron is --text-secondary.**
17. **Elevation/Thumb has a raw colour** (#00000014) and no dark variant (`--elevation-thumb` is fixed). Selected Segment and Tab thumbs in Dark get the same faint shadow.
18. **Search Open has no caret layer** even though the description says it shows the caret. Its value text is --text-strong.
19. **Switch has no Disabled variant.**

---

# Part B: chips, tags, navigation, menus and containers

Read-only extraction, 2026-10-03. Figma variable code syntax already emits the CSS names from `src/styles/tokens.css`, so every token below is a real custom property. "unbound" means a raw value in Figma. "unknown" means the tools did not show it.

## 0. Shared conventions

**Hover/pressed on a filled base.** Figma stacks a `state/*` fill over the base fill. In CSS: `background: linear-gradient(var(--state-hover), var(--state-hover)), var(--base)`. Where the base is transparent (Nav item, Rail item, Menu item), the tint is the whole fill.

**Focus.** Every focus ring is a boolean `Focus` prop that shows a "focus ring" layer: 1px `--focus-width` border, `--ring` color. There are two placements:
- *tight* (against the edge): inset −1px, radius = base + 1
- *offset* (2px outside): inset −3px, radius = base + 3

**Text style to class.** A Figma `Trimmed/*` style maps to its class plus `.t-trim`. Two exceptions: `.t-button-s` and `.t-label-xxs` already carry the trim.

**Tokens used in this slice (Light / Dark):**

| CSS var | Light | Dark |
|---|---|---|
| --text-strong | #0B0B0C | #F1F1F1 |
| --text-primary | #272727 | #F1F1F1 |
| --text-secondary | #636363 | #A0A0A0 |
| --text-inverse | #FFF | #0B0B0C |
| --text-on-fill | #FFF | #FFF |
| --surface-sunken | #ECECEC | #2F3133 |
| --surface-raised | #FFF | #171819 |
| --surface-page | #F9F9F8 | #0B0B0C |
| --surface-inverse | #0B0B0C | #FFF |
| --control-fill | #ECECEC | #171819 |
| --input-bg | #F1F1EF | paper-075 8% |
| --state-hover | ink-900 5% | white 6% |
| --state-pressed | ink-900 10% | white 12% |
| --state-selected | #F9F9F8 | #2F3133 |
| --status-positive-bg | #082A23 | #2F3133 |
| --status-active-bg | #17FF7E | #2F3133 |
| --status-active-fg | #082A23 | #17FF7E |
| --accent-green | #17FF7E | #17FF7E |
| --accent-blue | #14E4FF | #14E4FF |
| --field-green | #082A23 | #082A23 |
| --chip-selected-bg | #0B0B0C | #2F3133 |
| --chip-selected-tile | #2F3133 | #171819 |
| --chip-tile | #FFF | #0B0B0C |
| --tag-overlay-bg | ink-900 72% | ink-900 72% |
| --tag-detail-fg | ink-900 65% | #F1F1F1 |
| --tag-sent-bg | #D1D1D1 | #FFF |
| --tag-sent-fg | ink-900 75% | #0B0B0C |
| --tag-sent-border | transparent | paper-075 50% |
| --border-default | ink-750 8% | paper-075 10% |
| --border-raised | transparent | paper-075 20% |
| --ring | #272727 | #FFF |

`--elevation-small` is 2/2/8 and `--elevation-medium` is 4/4/16. Both include the bevel insets, which are transparent in Light and 15%/10% white in Dark. Both use `--shadow-raised` (5% Light, 15% Dark).

---

## 1. Status (52:51)
Description: "Positive for connected integrations, Active for live links, Neutral for everything else."

**Props:** `tone` Positive | Active | Neutral; `size` Default | Small; `label` (text, default "Connected"). There are no icon slots.

**Layout:** hug × hug. Padding x is `--space-2xs` (8). Padding y is 3 (Default) or 5 (Small), both unbound. Radius `--radius-pill`. No border, no effect.

| | Default | Small |
|---|---|---|
| size | 76×21 (hug) | 66×17 (hug) |
| text style | Label/XS → `.t-label-xs` (12/1.25) | Trimmed/Label/XXS → `.t-label-xxs` (10, trimmed) |

| tone | fill | label |
|---|---|---|
| Positive | --status-positive-bg | --accent-green |
| Active | --status-active-bg | --status-active-fg |
| Neutral | --surface-sunken | --text-secondary |

**Surprises:**
- In Dark, all three tones share the same #2F3133 fill. Positive and Active also render identically there (slime on #2F3133).
- The py values 3 and 5 are off-scale.

## 2. Tag (52:63)
Description: "Default labels logos and fonts. Overlay sits on a color or image. Filter is a search suggestion. Missing marks a field the template still needs." Filter and Missing are buttons.

**Props:** `kind` Default | Overlay | Filter | Missing; `state` Default | Hover (Hover exists only for Filter and Missing); `label` (default "Primary"); `focus` boolean.

**Shared:** gap 6 (unbound), radius `--radius-pill`, centered.

| kind | h | padding | fill (default → hover) | border | label style / color | slots |
|---|---|---|---|---|---|---|
| Default | 22 | x `--space-2xs` 8 | --surface-sunken | none | Caption/S `.t-caption-s` / --text-strong | label |
| Overlay | 21 | x 8 | --tag-overlay-bg | none | Caption/XS `.t-caption-xs` (11/1.3) / --text-on-fill | label |
| Filter | 28 | x 10 (unbound) | --surface-sunken → + --state-hover | none | Caption/S / --text-secondary | label |
| Missing | 28 | l 10 (unbound), r `--space-xs` 12 | transparent → --state-hover | 1px --text-secondary | Caption/S / --text-secondary | icon/plus 10×10 (--text-secondary) + label |

**Focus:** tight (inset −1) on Default, Overlay and Filter; inset −2 on Missing. Radius 999 (unbound).

**Surprises:**
- Default and Overlay have a Focus ring but no Hover, and the description says only Filter and Missing are interactive.
- Missing's ring sits at −2 while the others sit at −1.
- Missing uses a text color token (`--text-secondary`) as its border.
- Heights 22/21 come from hug with fixed h, so they differ by 1px.

## 3. Platform logo (53:73)
Description: "Platform marks for the platform chips. All uses the layout grid icon."

**Props:** `platform` All | LinkedIn | Instagram | Facebook | Email | Web. Each mark is 20×20 and exported as an SVG asset.

| platform | node | bound color |
|---|---|---|
| All | 53:47 | --text-strong (layout grid) |
| LinkedIn | 53:51 | --text-strong |
| Instagram | 53:57 | --text-strong |
| Facebook | 53:60 | --text-strong (vector bleeds −9.78%/−10%) |
| Email | 53:67 | --text-strong + --field-green (bleeds −10%) |
| Web | 53:72 | --text-strong + --accent-blue (bleeds −10%) |

**Surprises:**
- Email binds `--field-green` and Web binds `--accent-blue`, but the render shows only ink. The layer each token sits on is unknown; it may be hidden.
- The marks are SVGs with bound fills, so the code needs inline SVG with `currentColor` to flip in Dark.

## 4. Platform chip (53:96)
Description: "sits on the page on control/fill. Hover adds state/hover. Selected turns the chip ink... white label. Focus 1px against the edge (--focus-ring-tight)."

**Props:** `state` Default | Hover | Selected; `label` (default "All"); `platform` (instance swap slot, default Platform logo All); `focus`.

**Layout:** fixed h 50, width hug (96 in the sample). Padding l 7, r 9 (both unbound), y `--space-2xs` 8. Gap 7 (unbound). Radius `--radius-control-md` (9).

**Tile slot:** 36×36, radius `--radius-control` (7), clips content, holds a 20px logo centered.

**Trailing chevron:** 14px icon/chevron-right (51:72). Selected rotates it 90° so it reads as a down chevron.

| state | chip fill | tile fill | logo color | label color | chevron |
|---|---|---|---|---|---|
| Default | --control-fill | --chip-tile | --text-strong | --text-strong | right, --text-secondary |
| Hover | --control-fill + --state-hover | --chip-tile | --text-strong | --text-strong | right, --text-secondary |
| Selected | --chip-selected-bg | --chip-selected-tile | --accent-green | --text-on-fill | rotated 90°, --text-on-fill |

**Label:** Trimmed/Button/M → `.t-button-m .t-trim` (14, −1%).

**Focus:** tight, inset −1, radius 10 (unbound).

**Surprises:**
- Paddings 7/9 and gap 7 are off-scale.
- In Selected, the logo is a separate "logo" layer (53:76) that binds `--accent-green`. It is not the Platform logo instance, so the swap slot behaves differently there.
- There is no Selected+Hover variant.

## 5. Detail tag (61:464)
Description: "A detail added to the composer. Editable shows the remove button and Hover adds state/hover. Sent is how it reads inside a sent message. Keyboard focus lands on the remove button, 1px ring 2px outside its edge."

**Props:** `state` Editable | Hover | Sent; `label` (default "socialpaint.ai/careers"); `showIcon` boolean; `icon` (swap, default icon/globe); `focus`.

**Shared:** h 28, gap 6 (unbound), radius `--radius-pill`. Lead icon 15×15 icon/globe; 15px is off the 16/18 icon sizes.

| state | padding | fill | border | label / icon color | remove |
|---|---|---|---|---|---|
| Editable | l 9, r 6 (unbound) | --surface-page | none | --tag-detail-fg | icon/x 14px, --tag-detail-fg |
| Hover | l 9, r 6 | --surface-page + --state-hover | none | --tag-detail-fg | yes |
| Sent | x 9 | --tag-sent-bg | 0.75px --tag-sent-border | --tag-sent-fg | none |

**Label:** Trimmed/Caption/S → `.t-caption-s .t-trim`.

**Focus:** a 20×20 circle ring centered on the remove button, right 3px, radius 999.

**Surprises:**
- The Sent border is 0.75px, a sub-pixel width.
- `--surface-page` as the tag fill is #0B0B0C in Dark, the same as the page. The tag relies on whatever surface it sits on (the composer).

## 6. Chip (98:515)
Description: "Suggestion chip under a result. Sits on the page, so it uses control/fill. Hover adds state/hover and Pressed adds state/pressed. Focus tight."

**Props:** `state` Default | Hover | Pressed; `label` (default "Add a location"); `focus`.

**Layout:** h 28, width hug (96 in the sample). Padding x 10 (unbound). Radius `--radius-control` (7).

| state | fill |
|---|---|
| Default | --control-fill |
| Hover | --control-fill + --state-hover |
| Pressed | --control-fill + --state-pressed |

**Label:** Button/S → `.t-button-s` (12/1.3, −1%, trim built in), color `--text-strong`.

**Focus:** tight, inset −1, radius 8.

## 7. Choice chip (98:532)
Description: "One option in a set of choices, like a color role in the color editor... Focus 1px 2px outside the edge."

**Props:** `state` Default | Hover | Selected; `label` (default "Primary"); `focus`.

**Layout:** h 24, width hug (62 in the sample). Padding x 10 (unbound). Radius `--radius-pill`.

| state | fill | label |
|---|---|---|
| Default | --surface-sunken | --text-strong |
| Hover | --surface-sunken + --state-hover | --text-strong |
| Selected | --surface-inverse | --text-inverse |

**Label:** Label/XS → `.t-label-xs`.

**Focus:** offset, inset −3, radius 999.

**Surprise:** there is no Selected+Hover variant.

## 8. Avatar (54:62)
Description: "Initials avatar. Square is the workspace tile. Large is the sidebar account avatar, with a hairline border."

**Props:** `size` Large | Default; `shape` Circle | Square; `initials` (default "CM").

| size | px | border |
|---|---|---|
| Large | 38×38 | 1px --border-default |
| Default | 32×32 | none |

**Radius:** Circle uses `--radius-pill`; Square uses `--radius-control` (7). **Fill:** `--surface-sunken`. **Initials:** Label/XS `.t-label-xs`, `--text-strong`, centered.

**Surprise:** 38 is off the usual sizing.

## 9. Logo (54:66) and Logo mark (61:467)
**Logo:** 148×24, single SVG asset; the vector bleeds −4.17% vertically. Description: "The mark stays slime; the word uses text/primary so it flips in Dark." Only `--text-primary` is bound.

**Logo mark:** 20×20 SVG, bound to `--accent-green`. Description: "as used to sign assistant messages."

**Surprises:**
- The slime in the Logo's mark is unbound (raw color), while the standalone Logo mark binds `--accent-green`.
- The wordmark uses `--text-primary` (#272727), not `--text-strong` (#0B0B0C) like the rest of the chrome.

## 10. Nav item (54:83)
Description: "Hover adds state/hover. Selected takes state/selected... label and icon in full ink. Focus 1px 2px outside the edge."

**Props:** `state` Default | Hover | Selected; `label` (default "Generate"); `icon` (swap, default icon/sparkles 18); `focus`.

**Layout:** h 36, w 285 in the component; fills the width in the sidebar. Padding x 10 (unbound). Gap `--space-xs` (12). Radius `--radius-control` (7). Icon 18×18.

| state | fill | label + icon |
|---|---|---|
| Default | none | --text-secondary |
| Hover | --state-hover | --text-secondary |
| Selected | --state-selected | --text-strong |

**Label:** Label/M → `.t-label-m` (14/1.25).

**Focus:** offset, inset −3, radius 10.

## 11. Settings rail item (54:100)
Same as Nav item except for the differences below. Description: "It sits on the page, so Selected takes control/fill... Focus against the edge (--focus-ring-tight)."

- w 200
- Selected fill is `--control-fill` (#ECECEC Light / #171819 Dark), not `--state-selected`
- Focus is tight: inset −1, radius 8

| state | fill | label + icon |
|---|---|---|
| Default | none | --text-secondary |
| Hover | --state-hover | --text-secondary |
| Selected | --control-fill | --text-strong |

**Surprise:** Nav uses an offset ring and Rail uses a tight ring, though the rows are otherwise identical. This looks deliberate per the descriptions.

## 12. Sidebar (56:646). Structure of the Page=Brand Templates variant (56:76) only
**Props:** `page` Brand Templates | Generate | Template Builder | Insights and Analytics | Brand Studio | Settings. Settings selects no nav item and lights up the gear. "People now lives in Settings."

**Outer frame:** 335×1053, column. Padding l 10, t 10, b 10, **r 0** (all unbound).

**Panel "sidebar" (56:77):**
- fills the outer frame, column
- padding 20 (unbound), gap `--space-md` (24)
- radius `--radius-card` (20), clips content
- fill `--surface-raised`
- effect Elevation/Small → `--elevation-small`
- stroke `--border-raised` with unequal widths: top 0.65, sides 0.25, bottom 0.55 (unbound)

Children, top to bottom:

1. **header** (56:78), row, space-between, full width:
   - Logo 148×24 on the left
   - "utility" group on the right, gap `--space-2xs` (8):
     - **Theme toggle** (44:43): 32×32 circle, fill `--surface-sunken`, radius 999 (unbound), sun icon 15px in `--text-secondary`. The sun shows in Light and the moon in Dark, bound to theme/is-light and theme/is-dark.
     - **collapse** (56:94): 32×32, `--radius-pill`, no fill, icon/panel-left 15px in `--text-secondary`.
2. **nav** (56:98): column, gap 2 (unbound), full width. Five Nav items:
   - Brand Templates: icon/paintbrush, Selected
   - Generate: icon/sparkles
   - Template Builder: icon/frame
   - Insights & Analytics: icon/chart-column
   - Brand Studio: icon/pencil-ruler
3. **spacer** (56:161): flex 1.
4. **Account** instance (Default), full width.

**Surprises:**
- The outer right padding is 0 while the other sides are 10.
- Panel padding 20 is off the scale (space-md is 24).
- The hairline widths are fractional and unbound.
- The Theme toggle radius is raw 999, not `--radius-pill`.
- Header icons are 15px, off the 16/18 icon sizes.

## 13. Account (56:1330)
Description: "The gear is an Icon button (Ghost). Settings open selects it while Settings is showing."

**Props:** `state` Default | Settings open; `name` (default "CJ Munafo"); `email` (default "cj@acmehealth.com").

**Layout:** row, w 285 (fills in the sidebar), gap `--space-xs` (12), items centered.

**Slots, left to right:**
- Avatar Large Circle (38)
- text column, flex 1, clips overflow:
  - name: Label/S `.t-label-s`, `--text-strong`
  - email: Caption/XS `.t-caption-xs`, `--text-secondary`
- settings button: Icon button Ghost, 32×32, `--radius-control` (7), icon/settings 16px

| state | gear fill | gear icon |
|---|---|---|
| Default | none | --text-secondary |
| Settings open | --state-selected | --text-strong |

**Surprise:** the name and email have no line gap and no truncation ellipsis set. The column only clips overflow.

## 14. Menu (57:423), Menu label (57:419), Menu divider (57:421), Menu item (96:507)

**Menu:** w 200 (sample), column.
- Padding 6 (unbound), radius `--radius-menu` (16), fill `--surface-raised`.
- Effect Elevation/Medium → `--elevation-medium`. No border.
- Items slot is a column with gap 2 (unbound).
- Description: "Drop Menu items, labels and dividers into the Items slot. The row menu has no icons; the attach menu adds them."

**Menu label:** padding t 10, l 10, b 6, r 0 (all unbound). Text is Trimmed/Label/XS → `.t-label-xs .t-trim`, color `--text-secondary`. The sample text is "UPLOAD".

**Menu divider:** w 288 (sample), h 9. Padding `--space-3xs` (4) on all sides around a 1px line filled with `--border-default`.

**Menu item:**
- Props: `state` Default | Hover | Selected; `label` (default "Photo"); `showIcon` (default true); `icon` (swap, default icon/image 18); `showMeta` (default false); `meta` (default "Optional"); `showChevron` (default false).
- Layout: h 34, w 288 (sample). Padding l 10 (unbound), r `--space-2xs` (8), y `--space-2xs` (8). Gap 10 (unbound). Radius `--radius-control` (7).
- Slots, left to right:
  - icon (18)
  - label: flex 1, Trimmed/Body/S → `.t-body-s .t-trim`, `--text-strong`
  - meta: Trimmed/Caption/S → `.t-caption-s .t-trim`, `--text-secondary`
  - chevron: 16px, color unbound
  - check: icon/check 16, shown on Selected only

| state | fill | trailing |
|---|---|---|
| Default | none | none |
| Hover | --state-hover | none |
| Selected | --state-selected | icon/check 16 |

Focus is roving: it uses the hover tint, with no ring.

**Surprises:**
- Menu item uses `--radius-control`, not `--radius-menu-item`. Both are 7, but the purpose-named token is unused.
- Menu uses Elevation/Medium, while the `shadow/floating` description says it is for menus and popovers (`--elevation-floating`).
- Menu has no `--border-raised` stroke, but Toast does. In Dark, menus get no hairline.
- "UPLOAD" may be literal caps; the style's textCase is ORIGINAL. Whether it is literal text or a node override is unknown.
- The chevron color is unbound.

## 15. Toast (58:431)
Description: "Confirmation toast with an optional undo."

**Props:** `message` (default "Added “Custom 1”"); `action` (default "Undo"); `showAction`.

**Layout:** hug, 194×46 (sample). Padding x `--space-sm` (16), y `--space-xs` (12). Gap `--space-sm` (16). Radius `--radius-menu` (16).

**Fill, border, effect:** fill `--surface-raised`, 1px `--border-raised`, Elevation/Medium → `--elevation-medium`.

**Text:**
- message: Body/S `.t-body-s`, `--text-strong`
- action: Button/M `.t-button-m`, `--text-strong`

**Surprise:** the action is plain text, not a Button instance. It has no hover or focus state.

## 16. Tooltip (58:434)
Description: "Chart tooltip. Label is the point, value is the reading."

**Props:** `label` (default "Tue, Sep 8"); `value` (default "56 exports").

**Layout:** 149×32 hug. Padding x 10, y 7 (both unbound). Gap `--space-2xs` (8). Radius `--radius-control-md` (9).

**Fill, border, effect:** fill `--surface-raised`, 1px `--border-default`, Elevation/Medium → `--elevation-medium`.

**Text:**
- label: Caption/S `.t-caption-s`, `--text-secondary`
- value: Label/S `.t-label-s`, `--text-strong`

**Surprise:** Tooltip uses `--border-default`, while Toast uses `--border-raised`.

## 17. Progress (58:450)
Description: "Step progress under the generating message."

**Props:** `step` 1 | 2 | 3. The label text is baked per variant, e.g. "1 of 3 · Reading your job post"; there is no text prop.

**Layout:** row, gap `--space-xs` (12), items centered.

**Track:** 120×4, `--surface-sunken`, radius `--radius-xs` (2), clips content.

**Fill:** `--surface-inverse`, radius `--radius-xs`. Width is 40 (step 1), 80 (step 2) or 120 (step 3).

**Label:** Label/XS `.t-label-xs`, `--text-secondary`.

## 18. Progress bar (58:451)
Description: "Import progress. Resize the bar to show how far along it is."

**Layout:** 320×4. Track `--surface-sunken` with `--radius-pill`. Bar `--accent-green` with `--radius-pill`, w 128 in the sample. There are no props.

**Surprise:** Progress and Progress bar disagree. Progress uses radius-xs and an ink fill; Progress bar uses a pill radius and a slime fill.

## 19. Settings card (58:460)
Description: "Settings section card. The section's rows go in the Content slot. The header action is a Button you can change or hide."

**Props:** `title` (default "Workspaces"); `showAction`; `children` (Content slot).

**Layout:** w 783 (sample), column. Padding `--space-md` (24). Gap 20 (unbound). Radius `--radius-card`.

**Fill, effect, border:** fill `--surface-raised`, Elevation/Small → `--elevation-small`, no border.

**header:** row, space-between, gap `--space-sm`.
- title: Title/Panel `.t-title-panel` (17, −1%), `--text-strong`
- action: Button Neutral, Default size, h 36, padding x `--space-sm`, gap 6, `--radius-control`, fill `--surface-sunken`. It holds icon/plus 16 and a Button/M label in `--text-strong`.

**Content sample:** a Field with gap 6. Its label is Label/XS in `--text-secondary`. Its Input is h 40, fill `--input-bg`, radius `--radius-control-md`, padding x `--space-xs`, with Body/S text in `--text-strong`.

## 20. Card (58:476)
Description: "Insights card. Charts and tables go in the Content slot."

**Props:** `title` (default "Your month in brief"); `subtitle` (default "Aug 17 to Sep 15"); `showSubtitle`; `children`.

**Layout:** w 689 (sample). Padding x 28 (unbound), y `--space-md` (24). Gap `--space-sm` (16). Radius `--radius-card`.

**Fill, effect, border:** fill `--surface-raised`, Elevation/Small → `--elevation-small`, no border.

**header:** gap `--space-3xs` (4).
- title: Title/Panel, `--text-strong`
- subtitle: Caption/M `.t-caption-m`, `--text-secondary`

**Content:** defaults to a Metric.

**Surprises:**
- Card uses padding x 28, Settings card 24, and Modal 24.
- The gap is 20 in Settings card and Modal but 16 here.
- No card has the `--border-raised` hairline that the Sidebar panel has.

## 21. Modal (58:484)
Description: "Dialog shell with a title and a close button (an Icon button, Filled). Put the form or list in the Content slot."

**Props:** `title` (default "Public links"); `showIcon`; `icon` (swap, default icon/link 18); `children`.

**Layout:** w 560. Padding `--space-md` (24). Gap 20 (unbound). Radius `--radius-card`.

**Fill, effect, border:** fill `--surface-raised`, Elevation/Medium → `--elevation-medium`, no border.

**header:** space-between.
- title group: gap `--space-2xs` (8), 18px icon, then Title/Card `.t-title-card` (18, −1%) in `--text-strong`
- close: Icon button Filled, 32×32, `--radius-pill`, fill `--surface-sunken`, icon/x 16 in `--text-strong`

**Content:** a Field sample, the same as in Settings card.

**Surprise:** there is no scrim in the component (`--overlay-scrim` exists).

## 22. Stat (59:449)
Description: "Small label over a value, used in link and plan details."

**Props:** `label` (default "Created"); `value` (default "Sep 14, 2026").

**Layout:** column, gap `--space-3xs` (4).

**Text:**
- label: Label/XS `.t-label-xs`, `--text-secondary`
- value: Body/S `.t-body-s`, `--text-strong`

## 23. Metric (59:452)
Description: "Large number with its label, used on the Plan and usage page."

**Props:** `label` (default "Exports"); `value` (default "1,046").

**Layout:** column, gap `--space-xs` (12).

**Text:**
- label: Label/L `.t-label-l` (15, −1%), `--text-strong`
- value: Title/Metric `.t-title-metric` (40/1.1, −3%), `--text-strong`

---

## Unbound values found (for a tokens decision)
- **Padding / gap:** 3, 5 (Status); 6 (tag, detail-tag and button gaps; menu padding; Field gap); 7 and 9 (Platform chip); 10 (Tag Filter/Missing, Chip, Choice chip, Nav/Rail/Menu item x, Menu label, Sidebar outer); 2 (nav and menu item gap); 20 (Sidebar panel padding; Settings card and Modal gap); 28 (Card x); Tooltip 10/7.
- **Radius:** 999 raw on the Theme toggle and all focus rings; focus-ring radii 8 and 10.
- **Stroke:** 0.75 (Detail tag Sent); 0.65/0.25/0.55 (Sidebar panel).
- **Color:** the Logo's slime mark; the Menu item chevron.

---

# Part C: the Interaction states table and the chat components

Source: Figma file mEJRslarcQDkgPeY6AObi5 "Master UX-UI", read 2026-10-03 with `use_figma` (read-only scripts), `get_design_context`, and `get_screenshot`. Token names below are CSS custom properties from `src/styles/tokens.css`, with the Figma variable name in brackets where they differ. Values come from `design/tokens/master.tokens.json`.

**How paint opacity works here.** When a fill is bound to an alpha variable, Figma reports a paint opacity equal to that variable's alpha. Examples: `state/hover` is @0.05 in Light and @0.06 in Dark, and `switch/track-off` is @0.16 in Light and @0.30 in Dark. This is the token's own alpha, not an extra multiplier. Use the token as it is, with no added `opacity`.

**Figma to CSS name map (only names that differ from the simple slash-to-dash rule):**

| Figma variable | CSS property |
|---|---|
| focus/ring | `--ring` |
| button/primary-bg / -fg | `--btn-primary-bg` / `--btn-primary-fg` |
| input/fill | `--input-bg` |
| switch/track-off | `--switch-background` |
| radius/field | `--radius-control-md` (9) |
| radius/inset | `--radius-media-plate` (15) |

All other names convert directly: surface/raised → `--surface-raised`, state/hover-inverse → `--state-hover-inverse`, chip/selected-bg → `--chip-selected-bg`, and so on. Text styles map to `.t-*` classes; `Trimmed/X` becomes `.t-x` plus `.t-trim`.

---

## JOB 1: Interaction states (105:641, 3172×4531, page "Master UI Elements")

### Page layout

- **Root (105:641).** Fill `--surface-page` (Light; the root has no explicit mode). Vertical auto-layout, padding 64 on all sides (unbound), gap 48 (`--space-xl`).
- **Header (105:642).** 1100 wide, vertical, gap 16 (`--space-sm`).
  - Title (105:643): "Interaction states". `.t-title-page`, colour `--text-strong`.
  - Rules frame (105:644): vertical, gap 8 (`--space-2xs`). Six paragraphs, each `.t-body-m` in `--text-secondary`, 1100 wide. Verbatim:
    1. "Static is the confirmed look of each element, in Light and Dark."
    2. "Hover lays state/hover over the element: ink at 5% in Light and white at 6% in Dark. Fills that flip between modes, like the primary button, take state/hover-inverse, and Slime or red fills take state/hover-on-color. Hover changes nothing else."
    3. "Pressed is for actions and doubles the tint."
    4. "Selected is for things that stay chosen. Its fill depends on the surface underneath: state/selected on raised surfaces, control/fill on the page, the thumb in a track, and ink for chips. The label goes to full ink. Open menus and focused fields count as selected, and a selected item keeps its look on hover."
    5. "Disabled is 40% opacity with no hover. Previews dim under Deep Moss at 35% with the Edit button on hover, and picker tiles take a ring."
    6. "Focus is the code’s keyboard ring: a 1px line of focus/ring, ink in Light and white in Dark. Most elements draw it 2px outside the edge; chips, tags, track items, rail items and look tiles draw it against the edge. Text fields show the caret, and menu items and previews show their hover look." (This uses a curly apostrophe in "code’s".)
- **Table (105:650).** 3044 wide, vertical, gap 0, at y=411.
  - Every table row (header, family and component rows) is horizontal with gap 24 (`--space-md`): a label column 300 wide, then a Light column 1348 wide (x=324), then a Dark column 1348 wide (x=1696).
  - Every Light and Dark column fills with `--surface-page`.
  - Dark columns set the variable mode explicitly: collection 16:675, mode 16:2 (Dark). In code, wrap each Dark column in `data-theme="dark"`. Light columns inherit Light.
- **Column header (105:651, h71).**
  - Label cell: "Element", `.t-label-m` in `--text-secondary`, bottom padding 12.
  - Light (105:654) and Dark (105:660) cells: padding 16/16/12/16, vertical, gap 8 (`--space-2xs`).
  - Mode title: "Light" or "Dark", `.t-label-l` in `--text-strong`.
  - State names sit in a horizontal row, gap 12 (`--space-xs`), each 320 wide, `.t-caption-m` in `--text-secondary`:

    | Text | x in states row | x in table row |
    |---|---|---|
    | "Static" | 0 | 16 |
    | "Hover" | 332 | 348 |
    | "Selected or pressed" | 664 | 680 |
    | "Focus" | 996 | 1012 |

- **Family header rows (h79).**
  - Label: vertical, padding 40/0/16/0. Title in `.t-title-card` (Title/Card) and `--text-strong`.
  - Light and Dark columns are empty, filled with `--surface-page`.
  - Families: "Buttons", "Icon buttons", "Chips and tags", "Fields and pickers", "Toggles", "Navigation and menus", "Previews".
- **Component rows.**
  - Label frame (for example 105:669): 300 wide, vertical, gap 4 (`--space-3xs`), padding 16/0/16/0.
    - Name: `.t-label-l` in `--text-strong`.
    - Caption (the "rule" layer): `.t-caption-m` in `--text-secondary`. It renders 284 wide and wraps to 2 lines.
  - Light and Dark columns: horizontal, padding 8/16/8/16, gap 12 (`--space-xs`).
  - Row height is the cell height plus 16.
- **State cells.** Each cell is a plain frame, not an instance: 320 wide, radius 15 (`--radius-media-plate` / radius/inset, bound), vertical, padding 16/16/12/16, gap 10 (unbound), centred.
  - The cell holds one component instance set to that state, then a caption below it in `.t-caption-s` and `--text-secondary`.
  - The cell fill is the surface the element lives on (listed per row below). It uses the same token in both modes.
  - The caption is usually the state name, with the exceptions shown in the rows.
- **Overlays are fills, not layers.** Hover and pressed are a second fill stacked on the same element. Example: `[--surface-sunken, --state-hover]`. In CSS: `background: linear-gradient(var(--state-hover), var(--state-hover)), var(--surface-sunken)`.
- **Focus ring.** A "focus ring" frame inside the instance: absolutely positioned, 1px INSIDE stroke in `--ring`, raw (unbound) radius. There are two geometries:
  - **OUT** (offset −3, size +6). The line sits 2px outside the edge, which equals `outline: 1px solid var(--ring); outline-offset: 2px`. The ring radius is the element radius + 3 (control 7 → 10, field 9 → 12, pill → 999).
  - **EDGE** (offset −1, size +2). The line sits directly against the edge, which equals `outline-offset: 0`. The ring radius is the element radius + 1 (7 → 8, 9 → 10).
- **Dark side.** Each Dark cell repeats the Light structure and tokens exactly, only in Dark mode. The one structural difference is the Theme toggle, which shows a moon instead of the sun. Captions are the same on both sides.

### Rows

Columns are Static / Hover / Selected-or-pressed / Focus.

- **Element** is component::variant.
- **Bg** is the cell fill.
- **Ov** is the overlay fill added on top.
- **Lbl** is the label colour.
- **Focus** gives the ring geometry.

**Buttons**

1. **Button · Primary** (105:668; Light 105:672, Dark 105:700). Row height 105. Caption: "button/primary-bg, then state/hover-inverse and state/pressed-inverse".
   - Element: `Button` Kind=Primary, 126×36, radius `--radius-control`, label "Download PNG" in `.t-button-m`.
   - Bg `--surface-raised`.
   - Static: fill `--btn-primary-bg`, label `--btn-primary-fg`.
   - Hover: adds Ov `--state-hover-inverse`.
   - Column 3 ("Pressed"): adds Ov `--state-pressed-inverse`.
   - Focus: OUT, r10.
2. **Button · Neutral** (105:722). h105. Caption: "Inside cards: surface/sunken, then state/hover and state/pressed".
   - Element: Kind=Neutral, 90×36, "Copy link", fill `--surface-sunken`, label `--text-strong`.
   - Bg `--surface-raised`.
   - Hover: Ov `--state-hover`. Pressed: Ov `--state-pressed`.
   - Focus: OUT, r10.
3. **Button · Neutral on page** (105:774). h105. Caption: "On the page: control/fill, then state/hover and state/pressed".
   - Element: Kind=Neutral on page, 104×36, "Export CSV", fill `--control-fill`, label `--text-strong`.
   - Bg `--surface-page`.
   - Hover: `--state-hover`. Pressed: `--state-pressed`.
   - Focus: OUT, r10.
4. **Button · Destructive** (105:828). h105. Caption: "state/error, then state/hover-on-color and state/pressed-on-color".
   - Element: Kind=Destructive, 72×36, "Delete", fill `--state-error`, label `--text-inverse`.
   - Bg `--surface-raised`.
   - Hover: `--state-hover-on-color`. Pressed: `--state-pressed-on-color`.
   - Focus: OUT, r10.
5. **Send button** (105:882). h105. Caption: "accent/green in both modes, then state/hover-on-color and state/pressed-on-color".
   - Element: Send button Action=Send, 36×36, radius `--radius-pill`, fill `--accent-green`.
   - Icon: arrow-up 16, stroke `--field-green`, 1.33.
   - Bg `--surface-raised`.
   - Hover: `--state-hover-on-color`. Pressed: `--state-pressed-on-color`.
   - Focus: OUT, r999.
6. **Attach button** (105:924). h97. Caption: "surface/inverse, then state/hover-inverse and state/pressed-inverse".
   - Element: 28×28, radius `--radius-control`, fill `--surface-inverse`.
   - Icon: plus at 14, stroke `--surface-raised`, 1.17.
   - Bg `--surface-raised`.
   - Hover: `--state-hover-inverse`. Pressed: `--state-pressed-inverse`.
   - Focus: OUT, r10.

**Icon buttons**

7. **Icon button · Filled** (105:968). h101. Caption: "surface/sunken, then state/hover and state/pressed".
   - Element: Style=Filled, 32×32, radius `--radius-pill`, fill `--surface-sunken`, icon x 16.
   - Bg `--surface-raised`.
   - Hover: `--state-hover`. Pressed: `--state-pressed`.
   - Focus: OUT, r999.
8. **Icon button · Ghost** (105:1010). h101. Caption: "state/hover, then state/selected with the icon in text/strong".
   - Element: Style=Ghost, 32×32, radius `--radius-control`, no fill, icon settings (Size=18 component, drawn at 16).
   - Bg `--surface-raised`.
   - Hover: `--state-hover`.
   - Column 3 ("Selected"): fill `--state-selected`.
   - Focus: OUT, r10.
9. **Row menu trigger** (105:1064). h101. Caption: "state/hover, then surface/sunken while its menu is open".
   - Element: 32×32, radius `--radius-control`, no fill, icon ellipsis.
   - Bg `--surface-raised`.
   - Hover: `--state-hover`.
   - Column 3 ("Open"): fill `--surface-sunken`.
   - Focus: OUT, r10.
10. **Theme toggle** (105:1112). h101. Caption: "surface/sunken, then state/hover and state/pressed".
    - Element: 32×32, radius raw 999 (unbound), fill `--surface-sunken`.
    - Glyph: Light shows a sun (ellipse plus 8 rays, stroke `--text-secondary` 1.5). Dark shows a moon (vector, stroke `--text-secondary` 0.94).
    - Bg `--surface-raised`.
    - Hover: `--state-hover`. Pressed: `--state-pressed`.
    - Focus: OUT, r999.
11. **Stepper button** (105:1205). h97. Caption: "state/hover, then state/pressed, on the stepper track".
    - Element: 28×28, radius `--radius-pill`, no fill, icon minus.
    - Bg `--surface-sunken`.
    - Hover: `--state-hover`. Pressed: `--state-pressed`.
    - Focus: OUT, r999.

**Chips and tags**

12. **Chip** (108:853). h97. Caption: "control/fill, then state/hover and state/pressed".
    - Element: Chip, 96×28, radius `--radius-control`, fill `--control-fill`, "Add a location" in `.t-button-s` and `--text-strong`.
    - Bg `--surface-page`.
    - Hover: `--state-hover`. Pressed: `--state-pressed`.
    - Focus: EDGE, r8.
13. **Choice chip** (108:883). h93. Caption: "surface/sunken and state/hover, then surface/inverse with text/inverse".
    - Element: 62×24, radius `--radius-pill`, fill `--surface-sunken`, "Primary" in `.t-label-xs` and `--text-strong`.
    - Bg `--surface-raised`.
    - Hover: `--state-hover`.
    - Column 3 ("Selected"): fill `--surface-inverse`, label `--text-inverse`.
    - Focus: **OUT**, r999.
14. **Platform chip** (108:913). h119. Caption: "control/fill and state/hover, then chip/selected-bg".
    - Element: 96×50, radius `--radius-control-md`, fill `--control-fill`.
    - Inside: a 36×36 tile (fill `--chip-tile`, radius `--radius-control`) holding the Platform logo "All" (LayoutGrid, stroke `--text-strong` 1.25), then label "All" (`.t-button-m` + `.t-trim`, `--text-strong`), then a chevron-right at 14.
    - Bg `--surface-page`.
    - Hover: `--state-hover`.
    - Column 3 ("Selected"):
      - Element fill `--chip-selected-bg`.
      - Tile `--chip-selected-tile`.
      - Logo stroke `--accent-green`.
      - Label `--text-on-fill`.
      - The screenshot shows the chevron pointing down.
    - Focus: EDGE, r10.
15. **Tag · Filter** (108:997). h97. Caption: "surface/sunken, then state/hover".
    - Element: Tag Kind=Filter, 51×28, radius `--radius-pill`, fill `--surface-sunken`, "Hiring" in `.t-caption-s` and `--text-secondary`.
    - Bg `--surface-page`.
    - Hover: `--state-hover`.
    - Column 3 is an empty cell captioned "No selected state".
    - Focus: EDGE, r999.
16. **Detail tag** (108:1023). h97. Caption: "surface/page, then state/hover".
    - Element: Detail tag, State=Editable, 166×28, radius `--radius-pill`, fill `--surface-page`.
    - Contents: globe icon 15, "socialpaint.ai/careers" (`.t-caption-s` + `.t-trim`, `--tag-detail-fg`), remove icon x at 14.
    - Bg `--surface-raised`.
    - Hover: `--state-hover`.
    - Column 3: "No selected state".
    - Focus: a 20×20 r999 ring around the remove x only (at 143,4). It wraps the x icon's 14px box plus 3px all round.

**Fields and pickers**

17. **Input** (108:1082). h109. Caption: "input/fill and state/hover, then the caret while focused".
    - Element: Input, Size=Default, 288×40, radius `--radius-control-md`, fill `--input-bg`, value "Creative Director" in `.t-body-s` and `--text-secondary`.
    - Bg `--surface-raised`.
    - Static uses State=Placeholder.
    - Hover: `--state-hover`.
    - Column 3 ("Focused"): State=Focused. It adds a 2×18 caret rect in `--text-strong` before the text. There is no fill change.
    - Column 4 caption: "Focus shows the caret". It shows the same Focused variant and has no ring.
18. **Select** (108:1114). h105. Caption: "input/fill and state/hover, then state/pressed while open".
    - Element: 200×36, radius `--radius-control-md`, fill `--input-bg`, "Moss" in `.t-body-s` and `--text-strong`, chevron-down 16.
    - Bg `--surface-raised`.
    - Hover: `--state-hover`.
    - Column 3 ("Open"): Ov `--state-pressed`.
    - Focus: OUT, r12.
19. **Compact select** (108:1156). h97. Caption: "surface/sunken and state/hover, then state/pressed while open".
    - Element: 105×28, radius `--radius-control`, fill `--surface-sunken`, "Any platform" in `.t-button-s` and `--text-strong`, chevron-down 16.
    - Bg `--surface-raised`.
    - Hover: `--state-hover`.
    - Open: `--state-pressed`.
    - Focus: OUT, r10.
20. **Filter** (108:1198). h105. Caption: "control/fill and state/hover, then state/pressed while open".
    - Element: 125×36, radius `--radius-control-md`, fill `--control-fill`, "Last 30 days" in `.t-control-m` and `--text-strong`, chevron vector stroke `--text-strong` 1.5.
    - Bg `--surface-page`.
    - Hover: `--state-hover`.
    - Open: `--state-pressed`.
    - Focus: OUT, r12.
21. **Search field** (108:1234). h119. Caption: "control/fill and state/hover, then the open field".
    - Element: 288×50, radius `--radius-control-md`, fill `--control-fill`, search icon at 20.
    - Bg `--surface-page`.
    - Static uses State=Collapsed.
    - Hover: `--state-hover`.
    - Column 3 ("Open"): no overlay. It shows the value "hiring" (`.t-body-s`, `--text-strong`) and a 14px "Clear search" x (stroke `--text-secondary` 1.17).
    - Focus: OUT, r12, on the collapsed field.

**Toggles**

22. **Switch** (109:1031). h89. Caption: "switch/track-off and state/hover, then switch/track-on".
    - Element: 36×20, radius `--radius-pill`, fill `--switch-background`, 16×16 knob in `--surface-raised`.
    - Bg `--surface-raised`.
    - Hover: `--state-hover`.
    - Column 3 ("On"): fill `--switch-track-on`.
    - Focus: OUT, r999.
23. **Segment** (109:1061). h101. Caption: "state/hover over control/track, then control/thumb with Elevation/Thumb".
    - Element: 86×32, radius `--radius-control`, no fill, "Instagram" in `.t-control-s` and `--text-secondary`.
    - Bg `--control-track`.
    - Hover: `--state-hover`.
    - Selected: fill `--control-thumb`, shadow `--elevation-thumb`, label `--text-strong`.
    - Focus: EDGE, r8.
24. **Tab** (109:1091). h98. Caption: "state/hover over control/track, then control/thumb with Elevation/Thumb".
    - Element: 89×29, radius `--radius-control`, a 10px dot in `--accent-green`, "Exports" in `.t-control-m` and `--text-secondary`.
    - Bg `--control-track`.
    - Hover: `--state-hover`.
    - Selected: `--control-thumb` with `--elevation-thumb`, label `--text-strong`.
    - Focus: EDGE, r8.

**Navigation and menus**

25. **Nav item** (109:1132). h105. Caption: "state/hover, then state/selected with the label in text/strong".
    - Element: 285×36, radius `--radius-control`, sparkles icon 18, "Generate" in `.t-label-m` and `--text-secondary`.
    - Bg `--surface-raised`.
    - Hover: `--state-hover`.
    - Selected: `--state-selected`, label `--text-strong`.
    - Focus: OUT, r10.
26. **Settings rail item** (109:1198). h105. Caption: "state/hover, then control/fill with the label in text/strong".
    - Element: 200×36, radius `--radius-control`, building icon 18, "Workspace" in `.t-label-m` and `--text-secondary`.
    - Bg `--surface-page`.
    - Hover: `--state-hover`.
    - Selected: `--control-fill`, label `--text-strong`.
    - Focus: EDGE, r8.
27. **Menu item** (109:1330). h103. Caption: "state/hover, then state/selected with a check".
    - Element: 288×34, radius `--radius-control`, image icon 18, "Photo" in `.t-body-s` + `.t-trim` and `--text-strong`.
    - Bg `--surface-raised`.
    - Hover: `--state-hover`.
    - Selected: `--state-selected` plus a check icon 16 at the trailing end.
    - Column 4 caption: "Focus looks like hover". It shows the State=Hover variant with no ring.

**Previews**

28. **Result card** (109:1405). h412. Caption: "The preview dims under overlay/hover and shows the Edit button".
    - Element: the Result card (see Job 2).
    - Bg `--surface-page`.
    - Hover: the State=Hover variant.
    - Column 3: "No selected state".
    - Column 4 caption: "Focus looks like hover". It shows the State=Hover variant with no ring.
29. **Look tile** (109:1477). h258. Caption: "A border/strong ring on hover, then a text/strong ring".
    - Element: the Look tile (see Job 2).
    - Bg `--surface-sunken`.
    - Hover: ring stroke `--border-strong`, 1px OUTSIDE.
    - Selected: ring stroke `--text-strong`, 1px OUTSIDE.
    - Focus: EDGE. A 134×166 r10 ring wraps the 132×164 "ring" frame, so it lands on the same pixels as the hover and selected ring.

**Screenshot confirmation.** I checked Button · Primary (Dark), Platform chip and Look tile. Each cell is a rounded plate in the cell-fill colour sitting on the `--surface-page` column. The element is centred near the top and the caption sits beneath it. The focus ring is visibly a separate hairline: offset on buttons, flush on the platform chip and look tile.

---

## JOB 2: Chat section (section 61:468 "Chat" on page 24:674)

### Composer (61:504)
- **Box.** COMPONENT, 760 wide (fixed width, hug height), 110 tall.
  - Fill `--surface-raised`.
  - Radius 20, raw and unbound (equals `--radius-card`), corner smoothing 0.6.
  - Shadow `--elevation-small`.
  - Stroke `--border-raised`, **5px OUTSIDE** (all sides 5).
  - Vertical layout, gap 30, padding 20/12/12/20. All of these are unbound.
- **Property.** Placeholder (TEXT). Default: "Describe the post. Add any dates, names, or links it needs."
- **Description.** "Generate composer. Detail tags go in the Tags row. The Send button is exposed so it can switch to Stop."
- **`input`.** The placeholder text, 728 fill width, `.t-body-l` + `.t-trim`, `--text-secondary`.
- **`toolbar`.** Horizontal, gap 12, bottom-aligned (items-end).
  - **`inputs`** fills the width: horizontal, gap 6, padding 4/0/4/0.
    - Attach button (28×28, `--surface-inverse`, `--radius-control`, plus icon at 14).
    - `Tags`: an empty frame, fill width, 28 tall. It is a frame, not a SLOT.
  - **`output`** hugs its content: horizontal, gap 6, centred.
    - Compact select "Any platform" (105×28, `--surface-sunken`, padding 0/6/0/9).
    - Stepper "Variations" (147×28, `--surface-sunken`, `--radius-control`, padding 0/3/0/9, label `.t-button-s`). Inside it: Decrease (Stepper button State=Disabled, opacity 0.32), a value frame 20×28 showing "1" (`.t-button-s`), and Increase.
    - Send button (36×36 `--accent-green`).

### Message bubble (61:505)
- **Box.** COMPONENT, 472 wide (fixed), hug height.
  - Fill `--surface-sunken`.
  - Radius `--radius-menu` (16).
  - No shadow and no stroke.
  - Vertical, gap 10 (unbound), padding 12/16/12/16 (bound to `--space-xs` / `--space-sm`).
- **Properties.**
  - Message (TEXT). Default: "We’re hiring a Creative Director. Keep it fun and pull the details from the job post."
  - Tags (SLOT).
- **Description.** "The person’s message in the chat. Sent detail tags go in the Tags slot."
- **`message`.** `.t-body-m`, `--text-strong`, fill width.
- **`Tags` SLOT.** Horizontal, gap 6, wraps (62 tall with 4 tags).
  - Each tag is a Detail tag, State=Sent, 28 tall:
    - Radius `--radius-pill`, padding 0/9/0/9, gap 6.
    - Fill `--tag-sent-bg`, stroke `--tag-sent-border` 0.75 INSIDE.
    - Label `.t-caption-s` + `.t-trim` in `--tag-sent-fg`.
  - Sample tags: "Come paint with us", "Oct 31, 5:00 PM", "Remote", and "socialpaint.ai/careers" (with a globe icon at 15).

### Assistant message (61:532)
- **Box.** COMPONENT, 760 wide (fill), hug height. Vertical, gap 16 (`--space-sm`), no padding, no fill.
- **Properties.**
  - Message (TEXT). Default: "Here you go, in both sizes with a caption for each. The Apply now button points to socialpaint.ai/careers."
  - Content (SLOT).
- **Description.** "SocialPaint’s reply. Results, the caption card and follow-up chips go in the Content slot."
- **Children, in order:**
  1. Logo mark, 20×20, vector fill `--accent-green`.
  2. `message`: `.t-body-m`, `--text-strong`.
  3. `Content` SLOT: vertical, gap 16 (unbound). Sample content is Follow-ups, laid out horizontally with gap 8 (`--space-2xs`):
     - "Try next" in `.t-caption-m` and `--text-secondary`.
     - Then Chips (28 tall, padding 0/10/0/10, `--control-fill`, `--radius-control`, `.t-button-s`): "Add a location", "Make a Facebook version", "Try another layout".

### Result card (set 104:602; variants 104:571 Default, 104:584 Hover)
- **Properties.**
  - Title (TEXT). Default: "Now hiring".
  - Meta (TEXT). Default: "1080 × 1350".
  - State: Default or Hover.
- **Description.** "A generated post in the chat. Hover dims the preview under overlay/hover (Deep Moss at 35%) and shows the Edit button on overlay/control. Template, recent and history previews follow the same rule. The download is an Icon button. Keyboard focus shows the same overlay and Edit button as hover."
- **Card.** 227×343 (fixed width, hug height).
  - Fill `--surface-raised`.
  - Radius `--radius-card` (20), smoothing 0.6.
  - Shadow `--elevation-small`.
  - Stroke `--border-raised`, INSIDE, with per-side weights: top 0.65, right 0.25, bottom 0.55, left 0.25. This is a lit edge; it is transparent in Light and `paper-075-20` in Dark.
  - Vertical, gap 0, padding 8 all round (`--space-2xs`).
- **`preview`.** 211×264, IMAGE fill, radius `--radius-media-plate` (15), smoothing 0.6.
  - In Hover, a child `hover` frame covers the whole preview: fill `--overlay-hover`, same radius, content centred.
  - Inside it, `edit`: 40×40, `--overlay-control`, `--radius-pill`, holding a pencil icon at 20 (stroke colour unknown; it was not read).
- **`meta`.** Horizontal, gap 8 (`--space-2xs`), padding 16/8/8/8 (`--space-sm` / `--space-2xs`), centred.
  - `text` (fill width): vertical, gap 4 (`--space-3xs`). Contains the title (`.t-label-l`, `--text-strong`) and meta (`.t-label-xs`, `--text-secondary`).
  - Download: an Icon button Style=Filled, 34×34, `--surface-sunken`, `--radius-pill`, download icon 16. The component's standard size is 32; this instance is 34.

### Look tile (set 104:996; variants 104:918 Default, 104:944 Hover, 104:970 Selected)
- **Properties.**
  - Name (TEXT). Default: "Moss".
  - Focus (BOOLEAN). Default: false.
  - State: Default, Hover or Selected.
- **Description.** "One look in the template chat picker. Hover draws a 1px border/strong ring 2px out. Selected draws the ring in full ink (text/strong). Keyboard focus draws a 1px focus/ring around the thumbnail. Turn on Focus to show it."
- **Tile.** 132×189, vertical, gap 8, no fill.
  - **`ring`.** 132×164, radius `--radius-control-md` (9), padding 2 all round.
    - Default: no stroke.
    - Hover: `--border-strong`, 1px OUTSIDE.
    - Selected: `--text-strong`, 1px OUTSIDE.
  - **`thumbnail`.** 128×160, radius `--radius-control`, clips content. It holds an instance "tpl · Now hiring" Look=Moss, which is template artwork using raw values.
  - **`name`.** `.t-control-s`, `--text-strong`.
  - **`focus ring`.** Hidden by default (shown by the Focus boolean). Absolute at (−1,−1), 134×166, 1px INSIDE stroke in `--ring`, raw radius 10.

### Gradient glow (24:700), briefly
- A COMPONENT_SET with Family = Green, Blue, Pink, Warm or Dusk.
- Description: "Decorative glow behind the Generate composer. Family picks the gradient. Kept hidden in the confirmed screens; turn it on per screen."
- **Construction.** Each variant is a 689×286 frame with a white NOISE effect (Grain). Inside it is one ELLIPSE named "Glow" with a 200px LAYER_BLUR. The ellipse stacks 2 to 4 raw linear gradients (all unbound):
  - **Green.** Base: Slime #17ff7e, then Lime #d8f8c8 at 0.49, then Mint #e9fce3. Over it: Lapis #14e4ff fading from 0.42 to 0 by 0.55.
  - **Blue.** Base: #05203a, then Lapis at 0.73, then #c8f6ff. Over it: Slime fading in from 0.45 to 1.
  - **Pink.** Base: #ff6deb, #ff8ff0, #ffb1f4 at 0.47, then Soft Pink. Over it: #9f77ff fading out by 0.45.
  - **Warm.** Base: Fire, then Peach at 0.86, then Vanilla. Over it: Christina fading out by 0.55.
  - **Dusk.** Base: #05203a, #9271d0, #dac6ff, then Soft Pink. Over it: three fades (Christina, Lilac, #05203a).
