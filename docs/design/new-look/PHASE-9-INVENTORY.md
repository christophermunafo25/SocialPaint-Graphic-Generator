# New look, Phase 9: inventory

`PHASE-9.md` builds from this file. Phase 9 has no screens of its own, so this file stands where earlier phases had a screen reference:

- **Part A** is what the Figma file offers the phase: the components the leftover legacy controls move onto, and the system pages the lint rules enforce.
- **Part B** is what is left in the code, counted on `main` at 9106c8d (2026-10-08).
- **Part C** is the data the phase drops, with prod facts checked on 2026-10-08.

The counts come from regex scans, not an AST, so treat them as close rather than exact. Re-run them at the start of the phase, because `main` moves.

---

# Part A: the Figma file

Read from "Master UX-UI" (`mEJRslarcQDkgPeY6AObi5`) on 2026-10-08, read only.

## A1. What is designed and what is not

| Page | Id | State |
|---|---|---|
| Brand Templates | 0:1 | Built (Phase 4) |
| Generate | 8:674 | Built (Phase 5) |
| **Template Builder** | **8:675** | **Empty.** The page exists with no frames on it. |
| Brand Studio | 8:676 | Built (Phase 6) |
| Insights and Analytics | 8:677 | Built (Phase 8) |
| Settings | 8:678 | Built (Phase 7) |
| All Screens | 13:679 | Empty |
| Master UI Elements | 24:674 | The component library and Interaction states (105:641). Phase 2 built it. |
| Master Design System | 3:15162 | Color (62:2), Type (65:2), Radius and spacing (34:2), Elevation (35:2) |

There are still no frames for the Template Builder, onboarding, the sign-in gate, bulk fill, or the public link page around its form. PLAN.md's Scope gives those surfaces the new tokens and nothing else. That leaves Phase 9 with a conflict, which §9 D1 rules on: PLAN's Phase 9 row also deletes "the old control classes", and those surfaces are the classes' last users.

## A2. Where each leftover control would go

Each legacy control has a primitive built from a Master component in Phase 2.

| Legacy | Primitive | Master component |
|---|---|---|
| `.sp-btn`, `.sp-btn-primary`, `.sp-btn-ghost`, `.sp-btn[data-tone="danger"]` | `Button` (kind primary, neutral, destructive) | Button 43:123 |
| `.sp-btn-lg` | `Button size="lg"` | Button 43:123 |
| `.sp-icon-btn` | `IconButton` | Icon button 95:516 |
| `.sp-input`, `.sp-input-lg` | `Input` and `Field` | Input 48:37, Field 48:38 |
| `.sp-seg` | `SegmentedControl` | Segmented control 49:51 |
| `.sp-chip` (Size gallery) | `Chip` or `ChoiceChip` | Chip 98:515, Choice chip 98:532 |
| `ui/Select.tsx` (builder inspector, bulk fill) | `Select` and `CompactSelect` | Select 49:40, Compact select 99:568 |
| `ConfirmDialog`, `ui/alert-dialog.tsx` | `Modal` | Modal 58:484 |
| `components/Tooltip.tsx` (Sidebar, AttachMenu) | primitive `Tooltip` | Tooltip 58:434 |

## A3. What the lint rules enforce

- **Colours:** every colour a component reads is a token in Design System › Color, generated into `tokens.css`.
- **Type:** every text style is a `.t-*` class from Design System › Type.
- **Radius, spacing and elevation:** the Radius and spacing and the Elevation frames map to `--radius-*`, `--space-*` and `--elevation-*`.

---

# Part B: the code

## B1. The bridge (`src/styles/legacy-bridge.css`, 40 lines)

The bridge has 15 names, none defined anywhere else, so deleting the file breaks every reader that hasn't moved. Readers by name:

| Name | Maps to | Readers |
|---|---|---|
| `--bg-canvas` | `--surface-page` | 16: socialpaint.css 11, theme.css, AppShell, ConfigFailureScreen, TemplateBuilder, PublicFrame |
| `--bg-surface` | `--surface-raised` | 53: socialpaint.css 14, TemplateBuilder 8, theme.css 4, about 20 builder and shared files (1–3 each) |
| `--bg-card` | `--surface-raised` | 6, all in socialpaint.css |
| `--text-heading` | `--text-strong` | 1, socialpaint.css |
| `--border` | `--border-default` | 62: socialpaint.css 20, TemplateBuilder 8, BulkFillPage 5, ui/Select 3, FillPicker 3, about 20 more files |
| `--gen-sunken` | `--surface-sunken` | 2: socialpaint.css, Skeleton |
| `--gen-inverse` | `--surface-inverse` | 2, socialpaint.css |
| `--gen-on-inverse` | `--text-inverse` | 1, socialpaint.css |
| `--fill-action` | `--surface-inverse` | 4: TemplateBuilder 2, WizardStepper, theme.css |
| `--text-on-action` | `--text-inverse` | 7: TemplateBuilder 2, theme.css 2, FieldOverlayEditor, WizardStepper, socialpaint.css |
| `--state-danger` | `--state-error` | 6: socialpaint.css 4, ConfirmDialog, AdminTemplates |
| `--state-danger-on-surface` | `--state-error` | 6: socialpaint.css 5, theme.css |
| `--btn-primary-bg-hover` | hover-inverse over `--btn-primary-bg` | 2, socialpaint.css |
| `--shadow-card` | Elevation/Small's drop | 2, socialpaint.css |
| `--shadow-rail` | Elevation/Small's drop | **0** (dead) |

`scripts/build-tokens.mjs` (lines 9 and 211–232) checks the bridge's ownership, and `npm run tokens:check` runs that check.

## B2. Names BRIDGE.md §3 left alone, and the page-scoped groups

These are all defined in `socialpaint.css` and read only there, except where noted.

- **`--nav-active-bg` and `--nav-active-fg`:** 6 readers each, in `.sp-seg`, the tab strip, the size gallery rail and the selected chips.
- **`--media-overlay`:** 1 reader, the template chat's editor sheet scrim.
- **`--shadow-rest`:** 2 readers, the legacy chips and the legacy Tooltip.
- **`--radius-control-lg`:** 8 readers, the large controls, the import popover, the build picker card and the gate.
- **`--gen-*`:** fade, marker and tag. About 11 readers, in the chats' scroll fade and the template chat's Missing marker.
- **Legacy `--chip-*`:** 16 names, read by `.sp-chip` and the legacy platform chip. The Figma-owned `--chip-selected-*` and `--chip-tile` are tokens and stay.
- **`--sb-*`:** 3 names, read by theme.css's sidebar aliases and by `Sidebar.tsx` (3 reads), which is the narrow layout's top bar.
- **`--start-*`:** 11 names, read by the build picker tiles only.
- **`--gate-*`:** 3 names, read by the sign-in gate.
- **`--edge-*`:** 14 names, the "lit edge" system on the legacy cards, chips, rail and tooltip. `--edge-alpha-rail` is dead.
- **`--card-*`:** `--card-highlight` has 2 readers and `--card-shadow-now` has 2. The four `--card-go-*` names are dead.
- **`--viz-series-1` to `-4`:** read only by theme.css's `--chart-*` aliases, which nothing reads. `--viz-series-5` is dead.
- **`--plate-light` and `--plate-dark`:** read by `brand-studio.css`, the logo plates (PHASE-6 §8). There is no plate token in Figma yet.

## B3. Old control classes

The chat family (`.sp-chat-btn`, `-icon-btn`, `-field`, `-select`, `-stepper`) is **already gone**: it has no CSS and no users. What's left is the July family.

| Surface | Files | Legacy uses |
|---|---|---|
| **Template Builder** | TemplateBuilder, FieldInspector, SizeGallery, AutoBuildDialog, BackgroundReflowDialog, GroupInspector, FigmaImportDialog, CanvaImportDialog, ShortcutsPanel, CanvasSizePicker, BuilderShell, FillPicker, InspectorControls, CaptionEditor, VariantFilmstrip | `sp-btn` 59, `sp-icon-btn` 9, `sp-input` 27, `sp-seg` 3, `sp-chip` 4 |
| **Template Builder list** (`admin/AdminTemplates.tsx`, `/template-builder`) | 1 | `sp-btn` 3, `sp-input` 1 |
| **Sign-in gate** (Phase 8b) and **onboarding** | auth/AuthPage, onboarding/OnboardingWizard | `sp-btn` and `-lg` 6, `sp-input` and `-lg` 13 |
| **Bulk fill** | bulk/BulkFillPage | `sp-btn` 16 |
| **Public link page** | public/PublicLinkUnavailable | `sp-btn` 2 |
| **Shared** | ErrorState (17 importers), ErrorBoundary, ConfirmDialog, ImageSourceChooser, ImageCropper, ColorControl, ui/Select, ui/alert-dialog | `sp-btn` 21, `sp-input` 7 |
| **Dead** | `FieldInput.tsx` (no importers) | `sp-btn` 2, `sp-input` 1 |

`.sp-segmented` has no users. The primitive `SegmentedControl` replaced it.

## B4. Dead code in the stylesheets

- **Size:** `socialpaint.css` is 5,637 lines (9,797 at the start of the program).
- **Dead custom properties in socialpaint.css:** 54 of 225, with nothing reading them.
  - Type: `--type-display-*`, `--type-h1-*`, `--type-button-*`, `--type-data-*`, `--type-caption-track`.
  - Layout: `--bp-sm`, `--bp-md`, `--bp-2xl`, `--container-*`, `--grid-*`, five `--z-*`, `--density-*`.
  - Surface, state and shadow: `--text-on-surface*`, `--bg-surface-raised`, `--bg-surface-hover`, `--state-info`, `--fill-info`, `--state-attention`, `--state-warning-on-surface`, `--fill-danger`, four `--cover-*`, four `--card-go-*`, `--shadow-sm`, `--shadow-md`.
  - Leftovers: `--edge-alpha-rail`, `--viz-series-5`, `--moveable-color`.
- **Dead classes:** 33 of 272.
  - Moveable: four `moveable-*` rules. No moveable package is installed.
  - Legacy controls: `sp-btn-solar`, `sp-btn-tertiary`, `sp-btn-danger` (the live rule is `[data-tone="danger"]`), `sp-segmented*`, `sp-input--mini`.
  - Logos and layout: the Logos-detail leftovers (`sp-logo-toolbar`, `sp-logo-editing`, `sp-style-value-input`, `sp-face-picker*`, `sp-mesh`), `sp-grid-12`, `sp-span-*`, `sp-filterbar`, `sp-card-link*`.
  - Upload and editing: `sp-chip-out`, `sp-done-in`, `sp-template-card__desc`, `sp-section-title`, `sp-color-editing`, `sp-contrast-line`.
  - Twelve more are built in template literals (`sp-builder__rail--*`, `sp-builder__grip--*`, `sp-start-card--*`, `sp-import-pop--*`). Those are live.
- **Tailwind theme:** `theme.css` (156 lines) is shadcn's alias layer. Its `--chart-*`, `--sidebar-*` and `--card-foreground` aliases have no readers. Its `@theme inline` colours feed Tailwind utilities.
- **Empty and stray files:** `globals.css` is empty, and `default_shadcn_theme.css` sits at the repo root.
- **The stylesheet header** (lines 1–125) still states the July design system's rules, including the "governing rule" PLAN.md retired. Phase 1 left it for Phase 9 to rewrite.

## B5. Raw colours and inline type

- **Raw colours in CSS:** 110, all in `socialpaint.css`. Every other stylesheet has none.
- **Raw colours in TSX:** 73 in 14 files.
  - `platformIcons.tsx` has 34 (brand marks: platform logos in their own colours).
  - FillPicker 10, SchemaRenderer 5 (template rendering, which is tenant content), ColorControl 3, GradientEditor 3, FieldOverlayEditor 3, ConfirmDialog 2, BrandMark 2, and 1–2 in a few others.
  - `.ts` files hold 287 more, mostly tests and starter palettes.
- **Inline type in TSX:** 259 `fontSize`, `fontWeight`, `fontFamily`, `letterSpacing` and `lineHeight` keys in style objects, across 39 files.
  - TemplateBuilder 49, AdminTemplates 17, FieldInspector 17, FieldListPanel 14, FieldOverlayEditor 12, then BulkFillPage, ImageSourceChooser and AutoBuildDialog at 10 each.
  - The rest are builder files, plus `TypeStylesDetail` (where a preview shows the tenant's own face).
- **Tailwind:** v4 through `@tailwindcss/vite`, with no config file. 49 of 179 TSX files use utilities.
  - The heaviest are TemplateBuilder 159, BulkFillPage 72, AutoBuildDialog 54 and OnboardingWizard 34.
  - The lightest are the shell's `AppShell` and `App.tsx`.
- **Lint:** ESLint (typescript-eslint plus react-hooks) has no style rules. It ignores `src/app/components/ui`, `supabase` and `scripts`. Stylelint isn't installed.

## B6. Packages

- **Never imported:** 40 runtime dependencies (recounted 2026-10-08; an earlier pass said 42 by miscounting Radix).
  - MUI and Emotion: `@mui/material`, `@mui/icons-material`, `@emotion/react`, `@emotion/styled`, `@popperjs/core`, `react-popper`.
  - 20 Radix packages: accordion, aspect-ratio, avatar, checkbox, collapsible, hover-card, label, menubar, navigation-menu, progress, radio-group, scroll-area, select, separator, slider, slot, switch, tabs, toggle and toggle-group.
  - Others: `class-variance-authority`, `cmdk`, `embla-carousel-react`, `input-otp`, `next-themes`, `react-day-picker`, `react-dnd`, `react-dnd-html5-backend`, `react-hook-form`, `react-resizable-panels`, `react-responsive-masonry`, `react-slick`, `sonner`, `vaul`.
- **Imported only by `ui/alert-dialog.tsx`:** `@radix-ui/react-alert-dialog`, `clsx`, `tailwind-merge`, and `tw-animate-css` (its classes).
- **`src/app/components/ui/`** holds three files:
  - `Select.tsx` is used by FieldInspector and BulkFillPage, and `primitives/Select` imports three helpers from it.
  - `alert-dialog.tsx` is used by ConfirmDialog and ImageSourceChooser.
  - `utils.ts` is used only by alert-dialog.
- **Used, and staying:** the Radix context-menu, dropdown-menu, dialog, popover and tooltip packages, `lucide-react`, `motion`, `react-colorful`, `react-dropzone`, `react-easy-crop`, `date-fns`, `html-to-image`, `jszip`, `pdfjs-dist`, `@sentry/react`, `@supabase/supabase-js`, and Tailwind.

---

# Part C: data

## C1. `company_canvas_presets`

- **History:** created in 0028 and altered in 0029. Since Phase 3, no client or Edge Function reads or writes it.
- **Prod on 2026-10-08:** **0 rows**, and no foreign key points at it.
- **References that go with it:**
  - `supabase/verify/30_settings.sql` (lines 105–185, four checks).
  - The local DB's `companyCanvasPresets` key (`src/lib/stores/local/db.ts:17`).
  - Comments in `interfaces.ts:53`, `companyStore.ts:99` and `platforms.ts:103`.
  - ARCHITECTURE.md:66.

## C2. `brand_kits.heading_font` and `body_font`

- **History:** unread since 0042 (Phase 6), when the font roles moved onto the type styles.
- **Prod on 2026-10-08:**
  - 7 kits, and **all 7 already carry roles**, so none needs the load-time pass.
  - **All 7 still hold values** in both columns, as font references (`{source, family}`).
- **Still written by:**
  - `supabase/brandStore.ts:25–26` and `rows.ts` (it maps both ways).
  - `admin/brand/kitPlumbing.ts:30–31` (the defaults).
  - `onboarding/OnboardingWizard.tsx:237–241`, which seeds roles through `migrateFontRoles` and then also stores the faces.
- **Still read by:** `fontRoles.ts`'s `migrateFontRoles` and `withFontRoles`, the load-time pass for kits stored before 0042. That pass also covers local-backend kits saved before Phase 6.
- **Not referenced by any Edge Function.** `brand-from-website` has its own unrelated `headingFont` field in a model schema.

## C3. No other dead tables

- `rate_limit_counters` has no `.from()` readers, but it's live inside `consume_rate_limit`.
- Every other table is read by the client or by functions. Columns weren't audited beyond C2.
