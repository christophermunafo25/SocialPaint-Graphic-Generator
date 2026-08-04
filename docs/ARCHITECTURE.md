# Architecture

A multi-tenant, self-service brand template portal. Marketing admins build
locked templates once; everyone else fills in fields and downloads on-brand
graphics. The core design principle is **subtraction**: the only thing an end
user can change is the content of the fields the admin defined.

## Stack

- **Client**: React 18 + Vite + Tailwind v4 (Figma Make export conventions kept).
  Pure SPA — no custom server.
- **Backend**: Supabase (Postgres + Storage + Edge Functions) as BaaS.
- **Dev fallback**: with no `VITE_SUPABASE_URL` set, the app runs on a
  localStorage backend behind the same store interfaces — zero setup, same UI
  code paths. The switcher chip in the header shows which backend is active.

## Layers

```
src/lib/types.ts            Domain types (TemplateSchema, BrandKit, …)
src/lib/stores/             Data layer — components import ONLY these interfaces
  interfaces.ts               CompanyStore, TemplateStore, BrandKitStore,
                              BrandAssetStore, LocationStore, UsageStore,
                              DesignImportProvider
  supabase/                   Supabase implementations (+ FigmaImporter → Edge Functions)
  local/                      localStorage dev implementations
  index.ts                    Factory: picks backend from env
src/lib/auth/AuthContext.tsx  Auth boundary (dev switcher now, Supabase Auth later)
src/lib/brand/BrandContext.tsx Active company's kit/assets/locations + theming
src/lib/render/              Canvas math: data-URL pipeline, autofit, fonts, toPng export
src/app/components/SchemaRenderer.tsx  THE renderer — every template goes through it
src/app/components/builder/  Admin Template Builder — a guided wizard:
                              source (PNG/Figma) → Name → Fields → Caption →
                              Tags & details → Publish. The Fields step is an
                              element palette (drag onto canvas) + canvas
                              (multi-select, ⌘C/X/V/D + context menu) + field
                              list (drag = member form order) + inspector
                              (z-order via To front/back; image corner radius)
src/app/components/onboarding/ First-run wizard
supabase/migrations/         Schema + RLS (dev-active, real-ready)
supabase/functions/          figma-status / figma-connect / figma-import (Deno)
```

## Data model

Every tenant-owned table carries `company_id` → `companies`. See
`supabase/migrations/0001_schema.sql` for full DDL. (Locations were removed
from the platform in migration 0009.)

- `companies`, `users`, `memberships` (role: `admin` | `member`)
- `brand_kits` (palette jsonb, `type_styles` jsonb — the brand rules engine's
  named roles, `guidelines` jsonb — accepted free-text rules, heading/body
  font refs, primary logo) — one active per company. Unlimited colors, type
  styles, and rules.
- `brand_assets` (logo | font | image; Storage-backed)
- `canvas_presets` — reference data; the ONLY seeded table. v1 enables just
  `square-1440`. Adding Instagram/Story/etc. sizes is a data change, not code:
  flip/insert a row.
- `templates` + `template_fields` — the heart of the system; see
  `docs/TEMPLATE_SCHEMA.md`
- `usage_events` (`open` | `download`) — recorded inside `SchemaRenderer` so
  one code path covers every template
- `integration_connections` — Figma tokens. **No client access, ever** —
  Edge Functions only, via service role.

The database ships **empty of tenant data**. Onboarding creates everything.

## Auth & multi-tenancy (LIVE as of migration 0006)

Real Supabase Auth is enabled. `0006_real_auth.sql` dropped the dev
pass-through policies and activated production RLS:

- **Identity**: email/password via Supabase Auth. `auth.users` inserts mirror
  into `public.users` via the `handle_new_user` trigger. `AuthPage` handles
  sign in / sign up / forgot / recovery.
- **Provider selection**: `SupabaseAuthProvider` (session → memberships →
  company + role) when the Supabase backend is active; `DevAuthProvider`
  (tenant/role switcher) on the localStorage dev backend. Both implement the
  same `AuthState`, so components are identical.
- **Company creation**: only via the security-definer RPC
  `create_company_with_admin` — company + admin membership atomically.
- **Invites**: the `invite-member` Edge Function (admin-verified from the
  caller's JWT) sends Supabase's invite email and creates the membership.
  People page: invite, change role, remove.
- **RLS**: members read their companies' brand data + published templates;
  admins write; usage events are insert-only for members, readable by admins;
  Storage writes are tenant-scoped by the `{company_id}/` path prefix;
  `integration_connections` has no client policies at all.
- **Edge Functions**: every function calls `requireRole(req, companyId, …)` —
  callers must be a member (status) or admin (connect/import/styles/invite)
  of the company they name.

Dashboard checklist (Authentication → URL Configuration): set the Site URL to
the production domain and add `http://localhost:5199` + the Vercel URL to
additional redirect URLs so confirmation/invite/reset links land correctly.

## App shell

Navigation is a persistent left sidebar (`src/app/components/Sidebar.tsx`,
layout from Figma `KFBFgZBs7Tl9LXovzNUaNP` node 13:28, surface treatment from
the current design system — flat, no glass): a panel pinned to the left
edge, rounded on its right corners, with logo + collapse toggle, six
role-gated destinations (Brand Templates · Template Builder · Insights &
Analytics · Brand Studio · People · Settings & Admin — members see only the
first), and a user block pinned to the bottom (theme toggle, sign out, and —
on the dev backend — the tenant/role switcher). Every sidebar color is a
`--sb-*` token themed for light AND dark in `socialpaint.css`; tenant brand
kits never re-color the shell.

## Theming

The platform chrome is styled by the SocialPaint design system
(`src/styles/socialpaint.css`) and is never re-themed per tenant.
`applyBrandTheme` (src/lib/theme.ts) exposes the active kit's palette as
`--brand-*` CSS variables for template-adjacent surfaces only; tenant brand
expression lives in the template graphics. Fonts load via the Google Fonts css2 API or
runtime `@font-face` with data URLs for uploads (export-safe — see
`src/lib/render/fonts.ts`).

## PNG export

`exportSchemaPng` (src/lib/render/exportPng.ts) ports the proven technique
from the original generators: dimensions from the schema (never hardcoded),
all raster assets pre-converted to data URLs (html-to-image drops
cross-origin images silently), a double `toPng` with 150 ms pause (Safari
decode warm-up), `navigator.share` on mobile with download fallback. Custom
uploaded fonts are embedded via `fontEmbedCSS`; Google fonts render from the
document font cache.

## Adding a company / client

Every client starts from the identical blank slate:

1. Header switcher → **+ Create company…** (or first run routes there
   automatically).
2. Wizard: name → colors → fonts (Google or upload) → logo.
3. Land in the empty admin Templates view → build or import the first
   template → publish.

Everything set in onboarding is editable later in Brand Studio.

## Template creation paths

Two co-equal ways to create a template, both ending in the same schema:

1. **PNG upload** — drop a finished design, draw editable field boxes on it.
2. **Figma link** — paste a frame link; every detected text layer / image
   placeholder lands on the canvas as a real, member-editable field, and the
   frame is recomposed WITHOUT those elements into a background plate. The
   admin then marks whatever shouldn't be member-editable as Fixed in the
   inspector — which keeps the element live and movable but out of the member
   form. There is no pre-selection step: that decision is made in the editor,
   with the canvas in front of you.

## Brand rules engine & design-system import

Brand Studio defines unlimited **type styles** ("Heading", "Body", …). Every
property a style defines is an enforced rule ("Heading is always UPPERCASE",
"Body never exceeds 120 characters"): fields bind via `typeStyleKey`, the
builder locks the bound controls, and `resolveFieldStyle` applies the style at
render time so a Brand Studio change restyles every template instantly.

**Design-system import** (file-based, not a live connector): a design-tokens
JSON (e.g. a Claude Design `tokens.json` export — W3C or flat formats) fills
the palette + type styles; a `guidelines.md` is mined for rule-like lines the
admin reviews and accepts into `brand_kits.guidelines`; or the `figma-styles`
Edge Function pulls a connected Figma file's published color/text styles
(falling back to scanning the document). Parsers: `src/lib/brand/designSystemImport.ts`.

## Figma integration

Core creation path AND design-system source (see above); the manual PNG
builder always works without it. Client code talks ONLY to our Edge Functions:

- `figma-connect` — stores a credential in `integration_connections`.
  v1 primary path is a **personal access token** (validated against `/v1/me`),
  which avoids standing up the OAuth app. OAuth code exchange is implemented
  too: set `FIGMA_CLIENT_ID`, `FIGMA_CLIENT_SECRET`,
  `FIGMA_OAUTH_REDIRECT_URI` via `supabase secrets set` to enable it.
- `figma-status` — is a token stored for this company?
- `figma-styles` — design-system import: a file's published color/text styles
  (or a document scan fallback) → palette entries + brand type styles.
- `figma-import` — parses a frame URL, `GET /v1/files/:key/nodes`, renders the
  frame via `GET /v1/images` (scale 2), re-hosts the PNG in the
  `template-backgrounds` bucket (Figma render URLs expire), and walks the node
  tree: TEXT nodes → suggested text fields (position, font, size, alignment,
  characters as placeholder); image-filled rects/frames → image fields.
  Coordinates are normalized to the frame origin; canvas size comes from the
  frame's bounding box.

Known caveats (handled with `warnings` + graceful fallback): duplicated node
ids from component instances are skipped; masks/effects don't map; if the
tree can't be parsed you still get the rendered background and map fields
manually.

## Environment

See `.env.example`. Client env (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
is safe to expose — security comes from RLS. Figma secrets exist only as Edge
Function secrets. No secrets in code, ever.

Local dev: `npm run dev`. With Supabase: `supabase start` (or a hosted
project), `supabase db push` (or run migrations), `supabase functions deploy
figma-status figma-connect figma-import`, fill `.env`.
