# New look, Phase 8b: onboarding screen reference

Read from "Master UX-UI" (`mEJRslarcQDkgPeY6AObi5`), page "Create account" (257:2), on 2026-10-08, read only. The page is drawn in **Light only**; there are no Dark twins.

The reads were `get_metadata` on the flow diagram (259:5330) and on three form columns, `get_design_context` on the Onboarding shell (257:3), the Option tile set (257:4145), every frame's left column and every frame's `sp-auth-panel`, and screenshots of all ten frames.

The sign-in pages are in `PHASE-8B-SCREENS.md`. This file uses the same conventions: the file wins where it disagrees with any plan, and §9 lists what the frames leave open.

---

## 1. Frames

All ten are **1440 × 1053**: a left column 736 wide beside an `sp-auth-panel` 688 wide.

| Step | Frame | Left column | Panel | Reference (1x) |
|---|---|---|---|---|
| 01 · About you | 258:16 | 258:17 | 258:38 | `reference/onboarding-01-about-you.png` |
| 02 · Set up for | 258:262 | 258:263 | 258:284 | `reference/onboarding-02-set-up-for.png` |
| 03 · Your team | 258:438 | 258:439 | 258:460 | `reference/onboarding-03-your-team.png` |
| 04 · First up | 258:708 | 258:709 | 258:730 | `reference/onboarding-04-first-up.png` |
| 05 · Website | 259:357 | 259:358 | 259:379 | `reference/onboarding-05-website.png` |
| 05b · Add your brand (no website) | 259:5170 | 259:5171 | 259:5192 | `reference/onboarding-05b-add-your-brand.png` |
| 06 · Pulling your brand | 259:478 | 259:479 | 259:500 | `reference/onboarding-06-pulling.png` |
| 07 · Your brand | 259:630 | 259:631 | 259:652 | `reference/onboarding-07-your-brand.png` |
| 08 · Invite your team | 259:799 | 259:800 | 259:821 | `reference/onboarding-08-invite.png` |
| 09 · Workspace ready | 259:968 | 259:969 | 259:990 | `reference/onboarding-09-ready.png` |

Building blocks: Onboarding shell 257:3; Option tile 257:4145 (Default 257:4118, Hover 257:4127, Selected 257:4136).

---

## 2. The flow

The diagram (259:5330, "Create account", subtitle "From sign up to a workspace that already has the brand in it") draws one row of nodes joined by 2 px connectors:

Sign up → Check your email → 01 About you → 02 Set up for → 03 Your team → 04 First up → 05 Website → 06 Pulling your brand → 07 Your brand → 08 Invite your team → 09 Workspace ready → Brand Templates

- "Sign up" and "Check your email" carry the eyebrow "IN LOGIN FLOW" (they are the sign-in pages); "Brand Templates" carries "APP" (the destination after 09).
- **The 05b branch:** a node "Add your brand" with the eyebrow "05B · NO WEBSITE" sits under 05. A line drops from 05 (259:5385), runs right under 06 (259:5386), and rises into **07** (259:5387). So 05b skips 06 (nothing to pull) and rejoins at 07 "Your brand".
- The trigger is the text link "I don't have a website" on 05.

### Step counter

There is no "Step N of M" text and no counter. The only progress affordance is a **segmented bar** at the top of the form column:

- 6 segments, each 76.67 × 4, radius 2, 4 apart, filling the 480 column (258:22).
- Done segments: raw `#0B0B0C`. To-do segments: raw `rgba(11,11,12,0.1)`. Neither is bound to a variable.
- The current step counts as done (01 shows one dark segment).

| Step | Dark segments |
|---|---|
| 01 | 1 |
| 02 | 2 |
| 03 | 3 |
| 04 | 4 |
| 05, 05b, 06, 07 | 5 |
| 08 | 6 |
| 09 | no bar at all |

So the six segments read as: you, set up for, team, first up, brand (05/05b/06/07 together), invite.

### Back

Back is a button in the actions row, not a header affordance. It sits on 02, 03, 04, 05, 05b, 07 and 08. On 01 the instance exists but is hidden (258:32, 68 × 44, `hidden`), so Continue spans the full 480. 06 has no actions at all. 09 has only its primary button.

---

## 3. The Onboarding shell (257:3)

### Geometry

- **Frame:** `surface/page` (`#F9F9F8`), padding 16 top, right and bottom, none on the left, two children in a row. Same as sign in.
- **Left column (257:4):** flex 1 (736 at 1440), padding 32 top and bottom, 48 (`space/xl`) left and right, a vertical stack:
  1. **Header:** Logo (Master 54:66, 148 × 24) top left.
  2. Flexible spacer.
  3. **Form column (257:3993):** **480** wide, centred, a stack **40** apart: progress bar, title, questions, actions.
  4. Flexible spacer.
  5. **Footer links:** "Terms of Service" and "Privacy Policy", Caption/S on `text/secondary`, 16 (`space/sm`) apart.
- **Title (257:4001):** Title/Page (30, 1.2, −0.6) on `text/strong`, full width, **left-aligned**, wraps to two lines when long (06).
- **Questions (257:4002):** a stack; questions are 32 apart (28 on 05b and 07). Each question is a stack 12 apart (10 on 07): a **question label** in **Label/L** (15, 1.25, −0.15, Medium) on text/strong, then the control.
- **Actions (257:4003):** a row 12 apart. Back: Button, neutral look on `surface/sunken`, height 44, padding 18, radius 9 (`radius/control-md`), Button/M on `text/strong`, hugs (68 wide). Continue: Button primary (`btn-primary-bg` `#082A23`, `btn-primary-fg` `#17FF7E`), height 44, flex 1.
- **Actions group (05, 08 only):** when a text link follows the buttons, the actions row and the link sit in a stack **24** apart, centred. The link is Label/M in raw `#0B0B0C`.

### Differences from the sign-in layout

| | Sign in (`PHASE-8B-SCREENS.md` A2) | Onboarding |
|---|---|---|
| Form column width | 400 | **480** |
| Form column gap | 32 (`space/lg`) | **40** |
| Title alignment | centred, one line | **left**, may wrap |
| Progress | none | **6-segment bar**, 4 tall, at the top of the column |
| Field labels | Field: Label/XS on text/secondary, 6 to the control | **Question label: Label/L on text/strong, 12 to the control** |
| Actions | a centred stack 24 apart; primary full width | a **row 12 apart: Back (hug) + primary (flex 1)**; optional link 24 below |
| Panel content | Composer (Master 61:504), 560 wide, 5 px white 25% border | **Workspace preview**, 440 wide, **6 px** white 25% border, content changes per step (§6) |
| Panel fill | art image, radius 20 (`radius/card`) | the same in every frame. The shell's own panel (257:24) differs: radius **25** and a CSS gradient (two linear gradients, `rgba(20,228,255,…)` over `rgba(23,255,126,0.75)` → `rgba(216,248,200,0.75)` → `rgba(233,252,227,0.75)`) in place of the art. Build from the frames. |
| Frame, left column padding, logo, spacers, footer | | unchanged |

---

## 4. Option tile (257:4145)

A new component, no existing primitive. Props: `label`, `description`, `showDescription`, `showIcon`, `icon`, `state` (Default | Hover | Selected).

| Property | Value |
|---|---|
| Layout | row, items centred, gap 12, padding 16 horizontal × 14 vertical |
| Radius | 12 |
| Width | 234 on the component; in use it is 234 (two-column grid, 12 gaps, 01 and 04), full 480 (02), or hug (03 and 04's platforms) |
| Height | 46 with a label only; 63 with label + description |
| Icon | 16, lucide, leading (default `icon/user`); optional |
| Text | a stack 2 apart: label in Label/M (14, 1.25, Medium) on `text/strong`; description in Caption/S (12, 1.25) on `text/secondary`; optional |
| Selected marker | `icon/check` (lucide), 16, trailing, only in Selected |

| State | Fill | Edge |
|---|---|---|
| Default (257:4118) | `surface/raised` (white) | Elevation/Small: bevel top and bottom insets plus drop shadow 2/2 blur 8 `shadow/raised` (`rgba(0,0,0,0.05)`) |
| Hover (257:4127) | white with `rgba(11,11,12,0.05)` laid over it (raw in the code; reads as `state/hover`) | Elevation/Small |
| Selected (257:4136) | `surface/sunken` (`#ECECEC`) | **none** (no shadow, no bevel) |

Text and icon colours do not change between states. In the hug layout the Selected tile grows by 28 (the check plus its gap): on 03 "11–50" is 95 wide where "51–200" is 78. The tile set draws no focus or disabled state.

---

## 5. Screens

Every screen has the Logo, the footer links and the panel; only the form column is listed.

### 01 · About you (258:16)

- Progress: 1 of 6.
- Title: "Let's get to know you" (straight apostrophe as drawn, 258:29).
- Question 1 (258:121): label "What is your name?"; Input, 480 × 40, Filled with "CJ Munafo". No placeholder is drawn.
- Question 2 (258:136): label "What is your role?"; Option tiles, 8, in a **two-column grid** (234 each, 12 gaps both ways), icon + label, no descriptions:

| Tile | Icon | State |
|---|---|---|
| Marketing | sparkles | **Selected** |
| Design | pencil | Default |
| Founder or owner | building | Default |
| People and recruiting | users | Default |
| Events | calendar | Default |
| Sales | chart-column | Default |
| Agency or consultant | box | Default |
| Something else | ellipsis | Default |

  One selected, so single select by inference.
- Actions: "Continue" (primary, full width). Back hidden.
- Panel: YOU filled (§6).

### 02 · Set up for (258:262)

- Progress: 2 of 6.
- Title: "Who are you setting SocialPaint up for?"
- Question 1 (258:367): **no label** (the title is the question). Option tiles, 4, full width (480 × 63), icon + label + description, 12 apart:

| Tile | Description | Icon | State |
|---|---|---|---|
| My company | One brand and the people who post for it | building | **Selected** |
| My clients | Several brands I manage as an agency or consultant | box | Default |
| Our locations | A parent company with many locations or businesses | map-pin | Default |
| Just me | My own personal brand | user | Default |

  Single select by inference.
- Question 2 (258:422): label "How did you hear about SocialPaint?"; Select (Large, 480 × 40) showing "A friend or colleague". The menu's options are not drawn.
- Actions: "Back", "Continue".
- Panel: the same as 01 (this step's answer does not show yet).

### 03 · Your team (258:438)

- Progress: 3 of 6.
- Title: "Tell us about your team"
- Question 1 (258:543): label "What is your company called?"; Input Filled "Acme Health".
- Question 2 (258:547): label "How many people work there?"; Option tiles, 5, **hug width, one wrapping row, 8 apart**, label only, no icon: "Just me", "2–10", "11–50" (**Selected**), "51–200", "201+". Single select by inference. The ranges use an en dash.
- Question 3 (258:568): label "Who will be making graphics?"; Option tiles, 5, hug width, wrapping, 8 apart both ways, label only: "My marketing team" (**Selected**), "Employees across the company" (**Selected**), "Event speakers and attendees", "Clients", "Just me". Two selected, so **multi select**.
- Actions: "Back", "Continue".
- Panel: adds WORKSPACE.

### 04 · First up (258:708)

- Progress: 4 of 6.
- Title: "What do you want to make first?"
- Question 1 (258:813): **no label**. Option tiles, 8, two-column grid (234), icon + label:

| Tile | Icon | State |
|---|---|---|
| Hiring posts | users | **Selected** |
| Event promotion | calendar | **Selected** |
| Speaker announcements | sparkles | Default |
| Product news | box | Default |
| Customer stories | book | Default |
| Team news | user | Default |
| Webinars | globe | Default |
| Something else | ellipsis | Default |

  Two selected: multi select.
- Question 2 (258:912): label "Where do you post the most?"; Option tiles, 5, hug width, wrapping, 8 apart, each with a **platform mark** (Master "Platform logo" 53:73) as the icon: "LinkedIn" (**Selected**), "Instagram" (**Selected**), "Facebook", "Email", "Web". Multi select. Facebook, Email and Web draw their marks as filled black discs; LinkedIn and Instagram as outline marks.
- Actions: "Back", "Continue".
- Panel: adds FIRST UP.

### 05 · Website (259:357)

- Progress: 5 of 6.
- Title: "Where can we find your brand?"
- Question (259:462): label "What is your company website?"; Input Filled "acmehealth.com" (no scheme, no prefix).
- Actions group: "Back", "**Pull my brand**" (primary); 24 below, centred, the link "I don't have a website" (Label/M, raw `#0B0B0C`, straight apostrophe, 259:477). The link goes to 05b.
- Panel: the same as 04.

### 05b · Add your brand, no website (259:5170)

- Progress: 5 of 6.
- Title: "Add your brand"
- Questions 28 apart:
  1. (259:5275) label "What does your logo look like?"; **Upload** (Master 216:2291), 480 × 56, empty: a 40 tile on `surface/raised` with the image icon, placeholder "Upload your logo".
  2. (259:5285) label "What are your brand colors?"; a row 8 apart of colour swatches: two **40 circles** (a dark teal and a teal, about `#0F4C5C` and `#2EC4B6`, drawn as images) and an **add colour** circle, 40, radius 20, raw `rgba(11,11,12,0.05)` with `icon/plus` 16.
  3. (259:5294) label "Which fonts do you use?"; two **Selects** side by side, 12 apart, flex: "Manrope" (filled) and "Pick a body font" (placeholder, `text/secondary`).
- Actions: "Back", "Continue".
- Panel: the same as 04 (the brand row does not fill as you add).

### 06 · Pulling your brand (259:478)

- Progress: 5 of 6.
- Title: "Pulling your brand from acmehealth.com" (wraps to two lines; the domain is the 05 input).
- Loading state (259:583): a stack 8 apart of three **rows**, each 480 wide, padding 16, radius 12, raw white fill, Elevation/Small; label on the left (Label/M), **Status** pill on the right (Master 52:51):

| Row | Label colour | Status | Tone | Pill |
|---|---|---|---|---|
| Logo | raw `#0B0B0C` | "Found" | Positive | `status-positive-bg` `#082A23`, text `accent-green` `#17FF7E` |
| Colors | raw `#0B0B0C` | "Looking" | Active | `status-active-bg` `#17FF7E`, text `status-active-fg` `#082A23` |
| Fonts | raw `#636363` (dimmed) | "Waiting" | Neutral | `surface/sunken`, text `text/secondary` |

  Pills: Label/XS (12 Medium), padding 8 × 3, radius pill. There is no spinner, no progress bar and no percentage; the rows are the progress. The label colour dims while a row waits.
- **No actions**: no Back, no Continue, no Cancel. The step is presumably automatic.
- Panel: the same as 04 (brand still skeleton).

### 07 · Your brand (259:630)

- Progress: 5 of 6.
- Title: "Does this look like your brand?"
- Questions 28 apart, each a label with a 10 gap:
  1. **Logos** (259:735): two logo tiles, 12 apart, flex (234 × 88), radius 12. One on raw `#0F4C5C` with "acme health" in Manrope Bold 22 (−0.66) on `#F7F4EC`; one on raw `#F7F4EC` with Elevation/Small and the wordmark in `#0F4C5C`. (Drawn as live text standing in for the pulled logo files.)
  2. **Colors** (259:742): four swatch cards, 12 apart, flex, each padding 8, gap 8, radius 12, raw white, Elevation/Small: a 48-tall chip (radius 7) and the hex in **Mono/S** (Geist Mono 12, 1.4, tracking 0.48) on raw `#636363`: `#0F4C5C`, `#2EC4B6`, `#FFBF69`, `#F7F4EC` (the last chip has a 1 px raw `rgba(11,11,12,0.06)` border). Then an **add colour** tile, 56 wide, stretches to the cards' height, radius 12, raw `rgba(11,11,12,0.05)`, `icon/plus` 16.
  3. **Fonts** (259:761): two font cards, 12 apart, flex, padding 16, gap 14, radius 12, raw white, Elevation/Small: "Aa" in the font at 28 (Manrope Bold; Manrope Medium), then the name in Label/M ("Manrope Bold", "Manrope Medium") over the role in Caption/S ("Headings", "Body").
- What is editable, as drawn: only the add colour tile is an affordance. Logos, swatches and font cards draw no edit, remove or replace control.
- Actions: "Back", "**Looks good**" (primary).
- Panel: adds BRAND and TEMPLATES.

### 08 · Invite your team (259:799)

- Progress: 6 of 6.
- Title: "Who else should join Acme Health?" (the 03 company name).
- Question (259:904): label "What are their emails?"; a stack 12 apart:
  - Invite row 1 (259:906): Input Filled "maya@acmehealth.com" (flex) + Compact select "Admin", 8 apart.
  - Invite row 2 (259:915): Input Filled "jordan@acmehealth.com" + Compact select "Member" (this row uses `justify-between` with no gap; it reads the same).
  - Invite row 3 (259:923): Input **Placeholder** "name@acmehealth.com" + Compact select "Member".
  - The Compact selects are stretched to **100 × 40** (the component is 28 tall), `surface/sunken`, radius 7 (`radius/control`), Button/S label, chevron-down 16. Row 1's is a detached frame (259:909) with `justify-between`.
  - "Add another" (259:931): Button small (28), `control/fill`, radius 7, padding 10, gap 6, `icon/plus` 14 + Button/S label, hug, left.
  - No remove control on any row.
- Actions group: "Back", "**Send invites**" (primary); 24 below, centred, the link "Skip for now" (Label/M, raw `#0B0B0C`, 259:950).
- Panel: the same as 07.

### 09 · Workspace ready (259:968)

- No progress bar.
- Heading (259:5169), a stack 8 apart: title "Your workspace is ready, CJ" (Title/Page; the first name from 01), subtitle "Six starter templates are already in your brand." in **Body/L** (16, 1.5) on raw `#636363`.
- Starter templates (259:1074): six cards in a wrapping grid, 3 columns of 152, 12 apart both ways. Each card is a stack 8 apart: a 152 × 190 thumb (radius 12, padding 14, gap 6; "acme" Manrope Bold 9, a spacer, a kicker in Manrope Medium 11, a headline in Manrope Bold 19 at 1.05, a 48 × 14 pill radius 7) and the name in **Label/S** (13 Medium) on raw `#0B0B0C`:

| Name | Thumb fill | Kicker | Headline |
|---|---|---|---|
| Now hiring | `#0F4C5C` | "We're hiring" | "Nurse lead" |
| Event promo | `#F7F4EC` + Elevation/Small | "See you at" | "Health Summit" |
| Team news | `#2EC4B6` | "Welcome to" | "the team" |
| Speaker | `#FFBF69` | "Hear from" | "Dr. Rivera" |
| Product news | `#0F4C5C` | "Now open" | "Eastside clinic" |
| Webinar | `#F7F4EC` + Elevation/Small | "Live on May 12" | "Care at home" |

  The thumbs are sample brand content. No hover or click affordance is drawn on the cards.
- Actions: "**Go to my templates**" (primary, full width). No Back, no secondary.
- Panel: the same as 07.

---

## 6. The panel per step

Every frame's `sp-auth-panel` is 688 × 1021, radius 20 (`radius/card`), the art image as fill, Grain/Coarse (noise radius 4). Centred on it is a **Workspace preview**, not the sign-in Composer:

- 440 wide, padding 28, a stack 24 apart, raw white fill, radius 20, a 6 px `rgba(255,255,255,0.25)` border, Elevation/Floating (bevels plus 8/8 blur 32 `shadow/floating`).
- Five rows, each a stack 12 apart with an eyebrow in **Mono/Eyebrow** (Geist Mono 10, uppercase, tracking 0.4) on raw `#636363`: YOU, WORKSPACE, FIRST UP, BRAND, TEMPLATES.
- **Skeleton** rows (raw `#ECECEC`): a 36 square (radius 18 for YOU, 9 otherwise) and two lines 140 × 10 radius 5 and 90 × 8 radius 4 (FIRST UP's first line is 200); BRAND is a 72 × 40 radius 9 block and four 28 circles; TEMPLATES is three flex blocks 145 tall radius 9, 12 apart.
- **Filled** rows: a 36/38 lead, 12 gap, then a name in Label/M on raw `#0B0B0C` over a detail in Caption/S on raw `#636363`, 2 apart.

| Step | YOU | WORKSPACE | FIRST UP | BRAND | TEMPLATES |
|---|---|---|---|---|---|
| 01, 02 | Avatar (Circle, Large 38, `surface/sunken`, hairline `border/default`) "CJ"; "CJ Munafo" / "Marketing" | skeleton | skeleton | skeleton | skeleton |
| 03 | filled | 36 icon tile (raw `#ECECEC`, radius 9, `icon/building`); "Acme Health" / "My company · 11–50 people" | skeleton | skeleton | skeleton |
| 04, 05, 05b, 06 | filled | filled | icon tile with `icon/file-text`; "Hiring posts and event promotion" / "LinkedIn and Instagram" | skeleton | skeleton |
| 07, 08, 09 | filled | filled | filled | logo block 72 × 40 radius 9 on `#0F4C5C` with "acme" (Manrope Bold 15, −0.45, `#F7F4EC`); four 28 swatches (`#0F4C5C`, `#2EC4B6`, `#FFBF69`, `#F7F4EC`); a spacer; "Manrope" in Caption/S `#636363` at the right | three thumbs (flex, 145 tall, radius 9, padding 12, gap 6): "We're hiring / Nurse lead", "See you at / Health Summit", "Welcome to / the team" |

So the panel fills a row **on the step that collects it** (01 shows YOU while you type your name; 03 shows WORKSPACE). Exceptions: 02's answer never appears on its own step (WORKSPACE combines 02 and 03 on 03), and BRAND stays skeleton through 05, 05b and 06, filling only on 07. The panel never shows a brand preview specific to 05b or a progress state on 06. 08 adds nothing (no members row) and 09 adds nothing (still three thumbs, not six).

---

## 7. Text styles and raw colours

### Text styles per screen

| Screen | Styles |
|---|---|
| Shell, every screen | Title/Page, Button/M, Caption/S (footer); panel: Mono/Eyebrow, Label/M, Caption/S, Label/XS (avatar initials) |
| 01 | Label/L, Body/S (input), Label/M (tiles) |
| 02 | Label/M, Caption/S (tile descriptions), Label/L, Body/S (select) |
| 03 | Label/L, Body/S, Label/M |
| 04 | Label/M, Label/L |
| 05 | Label/L, Body/S, Label/M (link) |
| 05b | Label/L, Body/S (upload placeholder, selects) |
| 06 | Label/M (row labels), Label/XS (status pills) |
| 07 | Label/L, Mono/S (hex), Label/M, Caption/S |
| 08 | Label/L, Body/S, Button/S (compact selects, Add another), Label/M (link) |
| 09 | Body/L (subtitle), Label/S (template names) |

Label/L (15 Medium, −0.15) and Label/S (13 Medium) and Mono/S are new to the auth pages; check each has a `.t-*` class. The brand sample text (Manrope) is content, not a style.

### Raw (unbound) colours

| Colour | Where | Nodes | Reads as |
|---|---|---|---|
| `#0B0B0C` | progress done segments | 258:23 and every "step N" rectangle | `text/strong` |
| `rgba(11,11,12,0.1)` | progress to-do segments | 258:24–28 etc. | none (new token, or `border/…`) |
| `#0B0B0C` | question labels | 258:259, 258:423, 258:544, 258:548, 258:569, 258:913, 259:463, 259:5276, 259:5286, 259:5295, 259:736, 259:743, 259:762, 259:905 (258:137 is bound) | `text/strong` |
| `#0B0B0C` | text links | 259:477 "I don't have a website", 259:950 "Skip for now" | `text/strong` |
| `rgba(11,11,12,0.05)` | add colour | 259:5290, 259:757 | `state/hover` or `control/fill` |
| `rgba(11,11,12,0.05)` over white | Option tile Hover | 257:4127 | `state/hover` |
| white | 06 rows | 259:584, 259:588, 259:592 | `surface/raised` |
| `#0B0B0C`, `#636363` | 06 row labels | 259:585, 259:589; 259:593 | `text/strong`; `text/secondary` |
| white | 07 swatch and font cards | 259:745, 259:748, 259:751, 259:754, 259:764, 259:769 | `surface/raised` |
| `#636363` | 07 hex labels, font roles | 259:747, 259:750, 259:753, 259:756, 259:768, 259:773 | `text/secondary` |
| `#0B0B0C` | 07 font names and "Aa" | 259:765, 259:767, 259:770, 259:772 | `text/strong` |
| `rgba(11,11,12,0.06)` | 07 light swatch border | 259:755 | `border/default` |
| `#636363` | 09 subtitle | 259:1073 | `text/secondary` |
| `#0B0B0C` | 09 template names | 259:1082, 259:1090, 259:1098, 259:1106, 259:1114, 259:1122 | `text/strong` |
| white | panel Workspace preview | 258:39 and each frame's preview | `surface/raised` |
| `#636363` | panel eyebrows, details | 258:41, 258:51 etc. | `text/secondary` |
| `#0B0B0C` | panel names | 258:50 etc. | `text/strong` |
| `#ECECEC` | panel skeletons and icon tiles | 258:55 etc., 258:482 etc. | `surface/sunken` |
| `rgba(255,255,255,0.25)` | panel preview border | 258:39 etc. | (same as sign-in composer's) |
| `#0F4C5C`, `#2EC4B6`, `#FFBF69`, `#F7F4EC` | brand sample (07 tiles, swatches, 09 thumbs, panel brand row) | 259:738, 259:740, 259:746, 259:749, 259:752, 259:755, 259:1076 … | brand data, not tokens |
| gradients | shell panel | 257:24 | the art image in the frames |

---

## 8. Primitive map

| Part | Primitive |
|---|---|
| Progress bar (6 segments) | no primitive. Progress / ProgressBar draw one bar; this needs a segmented variant or a new `StepBar`. |
| Title | `.t-title-page` (left-aligned here) |
| Question (Label/L label, 12, control) | no primitive. `Field` looks different (Label/XS on text/secondary, 6 gap). A `Question` wrapper, or a `Field` variant. |
| Name, company, website, invite email | `Input` |
| "How did you hear…", font pickers | `Select` (Large 40) |
| Option tile (grid, full width, hug) | **no primitive (new `OptionTile`)**. The hug, label-only use on 03 and 04 sits close to `ChoiceChip`, but the size (46 tall, radius 12, elevation) is the tile's. |
| Platform marks in 04 tiles | the existing platform brand marks (Master 53:73) |
| Back | `Button kind="neutral" size="lg"` as drawn (`surface/sunken`). It sits on the page, where the Button description says `neutralOnPage` (`control/fill`); both are `#ECECEC` in Light. |
| Continue, Pull my brand, Looks good, Send invites, Go to my templates | `Button kind="primary" size="lg"` |
| "I don't have a website", "Skip for now" | no primitive (the sign-in switch link style) |
| Logo upload (05b) | `Upload` |
| Colour circles (05b), swatch cards (07) | no primitive |
| Add colour (05b circle, 07 tile) | no primitive (closest `IconButton`, but round 40 / 56 × stretch) |
| 06 rows | `Card` (raised, Elevation/Small) + `Status` |
| 07 logo tiles, font cards | `Card` with custom content |
| Role picker (08) | `CompactSelect`, stretched to 100 × 40 |
| "Add another" | `Button kind="neutralOnPage" size="sm"` with a plus icon |
| 09 template cards | no primitive (template thumbnail) |
| Panel preview | `Card`-like floating surface; `Avatar` (Circle, Large) in YOU |

Not used anywhere: TextArea, SearchField, Chip, Tag, Switch, SegmentedControl, Tabs, Tooltip, Menu, IconButton.

---

## 9. Open questions

1. **Errors.** No error state is drawn on any step: empty name, empty company, invalid website, a website that fails to pull, invalid invite email, a duplicate email.
2. **Required answers and a disabled Continue.** Nothing says which questions are required, or whether Continue disables (40%) until they are answered.
3. **06 failure and timing.** What happens when a row can't find anything ("Not found"?), whether 06 advances to 07 by itself, how long it may take, and whether there is a cancel or back. No error tone is drawn for Status.
4. **06 → 07 on partial results.** What 07 shows when logo, colours or fonts came back empty.
5. **07 editing.** Only "add colour" is an affordance. Can a swatch be removed or changed, a logo replaced, a font swapped? Is there an "Edit" path to 05b-style controls? What does "Back" from 07 return to: 05 or 05b?
6. **05b colour picker.** What the add circle opens (the app's popover colour editor?), how many colours are allowed, and how a colour is removed. The colour circles are images, so their exact values are not in the file.
7. **05b fonts.** Two selects with no labels for which is headings and which is body (the placeholder says "Pick a body font"); what the font list is.
8. **Website input.** Whether it takes a full URL or a bare domain, and whether a scheme prefix is shown.
9. **What the tiles change.** Role (01), set-up-for (02), size and makers (03), first-up and platforms (04): what each answer drives in the app. Does "My clients" or "Our locations" (02) change later steps (several brands, several workspaces)? Does 02 "Just me" skip 03 or 08?
10. **Single versus multi select.** Inferred from the frames (01, 02, 03 size: single; 03 makers, 04 both: multi). Confirm, and whether "Something else" opens a text field.
11. **Hug tiles reflow on select.** The check widens a hug tile by 28, so the row can rewrap when a tile is chosen (03, 04 platforms). Reserve the check space or accept the shift?
12. **Back on 01.** The Back instance is hidden. Should 01 have no way back to sign in or sign out?
13. **Progress mapping.** Six segments over nine steps: 05, 05b, 06 and 07 share segment 5; 09 has no bar. Confirm the mapping, and whether segments are clickable.
14. **08 invites.** Remove a row, the role options beyond Admin and Member, the cap on rows, domain checks against the company domain, what "Send invites" does when a row is empty, and the sent state.
15. **09.** "Six starter templates": are these generated from 04's choices? What clicking a thumbnail does. The panel still shows three thumbs while the column shows six.
16. **Panel on 02, 05b, 08.** The panel ignores 02's answer until 03, never reflects 05b's brand input, and adds no member row on 08. Intended?
17. **Hover and focus.** The Option tile has Hover but no focus ring or disabled state; the text links have no hover.
18. **Apostrophes.** "Let's get to know you", "I don't have a website" and the sample "We're hiring" are drawn with straight apostrophes, where the sign-in pages use curly ones ("Let’s get painting"). Use curly in the build?
19. **Dark.** The page is Light only. Does the onboarding left column follow the sign-in pages (left column themes, panel stays Light)?
20. **Shell versus frames.** The shell's panel is radius 25 with a CSS gradient; the frames are radius 20 with the art image. Build from the frames.
21. **Raw colours.** The question labels, links, progress segments, 06 rows and panel preview are unbound (§7). Bind them in the build to the tokens listed.
22. **Narrow widths.** Only 1440 is drawn: how the 480 column, the two-column tile grid and the panel behave on smaller screens.
