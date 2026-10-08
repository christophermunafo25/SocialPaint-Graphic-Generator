# New look, Phase 8b: screen reference

Read from "Master UX-UI" (`mEJRslarcQDkgPeY6AObi5`), page "Sign in and sign up" (194:2, section 200:167), on 2026-10-08, read only. The reads were `get_metadata` on the section, `get_design_context` on Sign in Light and on each screen's form column, and screenshots of the eight Light frames.

`PHASE-8B.md` builds from this file. Where the live file disagrees, the file wins, and `PHASE-8B.md` §8 and §9 rule on what the file leaves open.

The panel art is `sp-auth-panel` on the Assets page (221:3321, 688 × 1021).

---

# Part A: what is drawn

## A1. Frames

All sixteen are **1440 × 1053**. Every Dark frame matches its Light twin node for node.

**Only the Light frames are built** (PHASE-8B §9 D1: the gate stays Light), so only the Light references are saved.

| Screen | Light | Dark (not built) | Reference (1x) |
|---|---|---|---|
| Sign in | 200:168 | 204:563 | `reference/auth-sign-in.png` |
| Sign in · Error | 201:254 | 204:635 | `auth-sign-in-error.png` |
| Sign up | 201:289 | 204:707 | `auth-sign-up.png` |
| Sign up · Error | 201:332 | 204:778 | `auth-sign-up-error.png` |
| Check your email | 201:373 | 204:849 | `auth-check-email.png` |
| Reset password | 201:414 | 204:904 | `auth-reset.png` |
| Reset link sent | 201:454 | 204:966 | `auth-reset-sent.png` |
| New password | 201:495 | 204:1021 | `auth-new-password.png` |

## A2. The layout (every screen)

- **The frame:** `surface/page`, padding 16 on the top, right and bottom (none on the left), two children in a row.
- **Left column:** 736 wide at 1440 (flex 1), full height, padding 32 top and bottom, 48 (`space/xl`) left and right, a vertical stack:
  1. **Header:** the Logo (Master 54:66, 148 × 24) at the top left.
  2. A flexible spacer.
  3. **The form column:** 400 wide, centred, a stack 32 (`space/lg`) apart: title, fields, actions.
  4. A flexible spacer, the same as above, so the form column sits in the vertical centre.
  5. **Footer links:** "Terms of Service" and "Privacy Policy", Caption/S on `text/secondary`, 16 (`space/sm`) apart, bottom left.
- **Right panel (`sp-auth-panel`):** 688 wide, the full height of the frame less its 16 padding (1021), radius 20 (`radius/card`).
  - The art image fills it (`object-cover`), and a **Composer** (Master 61:504) sits centred on it, 560 wide.
  - The composer's prompt reads "Make a hiring post for our creative director role", with the attach button, "Any platform", "Variations 1" and Send.
  - Its edge: a 5 px border at `rgba(255,255,255,0.25)` and Elevation/Floating (bevels plus 8/8 blur 32 `shadow/floating`).
  - **In Dark, the panel and its composer are unchanged:** the art keeps its light gradient, and the composer stays Light (white surface, ink text). Only the left column changes theme.

## A3. The form column parts

| Part | Spec | Primitive |
|---|---|---|
| Title | Title/Page (30, 1.2, −0.6), `text/strong`, centred, one line | `.t-title-page` |
| Fields | A stack 24 (`space/md`) apart | |
| Field | Master Field 48:38: Label/XS label on `text/secondary`, 6 down to a 40 Input (`input/fill`, radius 9, padding 12, Body/S on `text/strong`) | `Field` + `Input` |
| Field error | Caption/S on `state/error` under the control, 6 down. The control doesn't change, and the field grows from 61 to 82. | `Field error=` |
| Password group | The password Field, then 12 (`space/xs`) down to the "forgot row": "Forgot password?" in Label/M on `text/strong`, right-aligned. Sign in only. | |
| Actions | A stack 24 apart, centred | |
| Primary button | Large (44), full width, primary (Deep Moss and Slime in Light, Slime and Deep Moss in Dark), Button/M | `Button kind="primary" size="lg"` |
| Switch line | Body/S prompt on `text/secondary`, 4 (`space/3xs`) apart from a Label/M link on `text/strong`, baseline aligned | |
| Consent (sign up only) | Caption/S on `text/secondary`, centred, 215 wide (two lines). "Terms of Service" and "Privacy Policy" in Label/XS weight on `text/strong`. | |
| Message (check email, link sent) | Body/M (15, 1.5) on `text/secondary`, centred, 400 wide, with the address in Medium on `text/strong` | `.t-body-m` |

The Light consent and message frames draw their emphasis spans in a raw `#0B0B0C`. The Dark consent frame draws its spans raw too: `#A0A0A0` for the sentence and `#F1F1F1` for the links. These are unbound slips for `text/secondary` and `text/strong` (§8 of the prompt).

## A4. Copy, screen by screen

| Screen | Title | Fields | Actions |
|---|---|---|---|
| Sign in | "Let’s get painting" (no "!") | Email; Password; "Forgot password?" | "Sign in"; "Don’t have an account?" + "Sign up" |
| Sign in · Error | the same | Password error: "That email and password don’t match." | the same |
| Sign up | "Create your account" | Email; Password (no hint line) | "Create account"; consent: "By creating an account, you agree to the Terms of Service and Privacy Policy."; "Already have an account?" + "Sign in" |
| Sign up · Error | the same | Password error: "Use at least 8 characters." | the same |
| Check your email | "Check your email" | Message: "We sent a confirmation link to **{email}**. Open it, then come back and sign in." | "Back to sign in" (primary) |
| Reset password | "Reset password" | Email | "Send reset link"; "Back to sign in" (link) |
| Reset link sent | "Check your email" | Message: "We sent a reset link to **{email}**. Open it to choose a new password." | "Back to sign in" (primary) |
| New password | "Choose a new password" | "New password" | "Save password" |

Every button label is sentence case. The sample address `cj@acmehealth.com` is placeholder content (PLAN decision 6).

## A5. Text styles used

Title/Page, Label/XS, Body/S, Body/M, Label/M, Button/M, Caption/S, plus the composer's own (Trimmed/Body/L, Button/S). Every one has a `.t-*` class.

---

# Part B: what it stands on

## B1. The code today

- **`auth/AuthPage.tsx` (270 lines):** one component with five views (`signin`, `signup`, `forgot`, `checkEmail`, `setPassword`) and the Supabase calls inline:
  - `signInWithPassword`, `signUp`, `resetPasswordForEmail` (redirect to the origin) and `updateUser`;
  - the `PASSWORD_RECOVERY` event opens `setPassword`.
- **It renders as "Auth · Gate Light" (2026-09-18):** a solo light card centred over the orbit artwork (`gate-orbit.webp`), with BrandMark at 64 over the title. That look is forced light (`tone="light"`) whatever the user's theme.
- **Controls:** `.sp-input.sp-input-lg`, `.sp-btn.sp-btn-primary.sp-btn-lg` and `.sp-gate__link`, styled by about 210 `sp-gate*` rules in `socialpaint.css` and the `--gate-*` tokens.
- **What differs from the frames:**
  - **Submit is disabled** until the view's rule passes (email and password; 8 characters on sign up).
  - **Errors:** an error is one `role="alert"` paragraph above the button, showing Supabase's raw message.
  - **Notices:** "Password reset link sent. Check your email." shows in place (there's no Reset link sent screen), and "Password updated." returns to sign in.
  - **Sign up** shows the help line "At least 8 characters." under the password before submitting.
  - **Copy:** the labels are Title Case ("Sign In", "Create Account", "Send Reset Link", "Save Password", "Back to Sign In").
- **`PreAppShell.tsx`:**
  - **Layouts:** `split` (a 584 form panel beside a Slime hero) and `solo` (the panel centred).
  - **Tones:** `dark`, `app` and `light`.
  - **Widths:** `form` (584) and `wide` (1220).
  - **Users:** AuthPage (solo, light, orbit) and OnboardingWizard (solo, wide, light with the orbit on first run, `app` for the in-app Create company path). Nothing uses `split` today.
- **The local backend never shows the gate.** `App.tsx` renders AuthPage only with Supabase and no session, and AuthPage calls `supabase()` on mount. So the screenshot run can't capture it.
- **No Terms of Service or Privacy Policy pages exist** in the app, and no URL is configured for them.

## B2. What the frames change

| Part | Today | Drawn |
|---|---|---|
| Layout | Solo card over the orbit art, forced light | Split: the form column on the page beside `sp-auth-panel`, in Light and Dark |
| Brand | BrandMark 64 over the title | The Logo at the top left; no mark over the title |
| Errors | One alert above the button, raw Supabase text | Under the field it belongs to, in the Field's error slot, in our words |
| Password rule | Help line before submit; submit disabled until 8 | No help line (a Field never shows hint text); the error after submit |
| Reset sent | A notice in place | Its own screen, "Check your email" |
| Labels | Title Case | Sentence case |
| Legal | None | The footer links on every screen, and the consent line on sign up |

## B3. Open questions

These are for `PHASE-8B.md` §9:
- the theme the gate follows;
- where the footer and consent links point;
- whether submit stays disabled;
- the copy for the errors the frames don't draw;
- what happens after Save password;
- how the panel's composer is drawn;
- below desktop width;
- how the screenshot run reaches the gate;
- what's left of `PreAppShell` and the orbit art.
