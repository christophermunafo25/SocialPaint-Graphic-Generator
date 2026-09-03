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
src/lib/bulk/                Bulk fill: CSV parser, column mapping, row checks, run loop
                              (pure; the render step is injected)
src/app/components/bulk/     Bulk fill page + the off-screen render stage
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
- `company_canvas_presets` — per-workspace canvas-size opt-outs, keyed by
  `SIZE_CATALOG` ids (`src/lib/templates/platforms.ts`, the single source of
  size dimension data since 0029; the old `canvas_presets` table is gone).
- `templates` + `template_fields` — the heart of the system; see
  `docs/TEMPLATE_SCHEMA.md`
- `usage_events` (`open` | `download` | `share` | `bulk_export`) — `open`
  and `download` are recorded inside `SchemaRenderer` so one code path covers
  every template; `share` is the person taking that PNG to LinkedIn, recorded
  by the fill page; `bulk_export` is one graphic rendered by an admin's bulk
  fill run, one event per row, written as a single batch after the run.
  Bulk rows are deliberately not downloads: a run has no opens, so folding
  them in would break the export rate. Every tally names each action
  explicitly (see the `UsageAction` comment in `src/lib/types.ts` for the
  list of sites, and `0027_share_events.sql` for why). `actor` (`member` |
  `public`) and `link_id` separate public-link traffic from the team's own;
  a public fill has no `user_id` and is never given a fabricated one.
- `template_links` — public share links (migration 0026). Tokens are stored
  **hashed**; the plaintext exists only in the response that mints it.
- `template_link_events` — who created, renamed, revoked, or regenerated a
  link. Folds into the audit log when that lands.
- `rate_limit_counters` — fixed-window counters keyed by an opaque string.
  **No client access, ever** — service role only.
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
- **Edge Functions**: every authenticated function calls
  `requireRole(req, companyId, …)` — callers must be a member (status) or
  admin (connect/import/styles/invite/links) of the company they name. The
  two public-link functions are the exceptions and are described below.

Dashboard checklist (Authentication → URL Configuration): set the Site URL to
the production domain and add `http://localhost:5199` + the Vercel URL to
additional redirect URLs so confirmation/invite/reset links land correctly.

## Public template links

An admin generates a link for a **published** template; anyone with it fills
the template in and exports a PNG with no account, no session, and no
membership. See `supabase/migrations/0026_public_links.sql`.

This is a second, deliberately narrow, unauthenticated read path — not a new
route over the existing data path. **RLS is not relaxed anywhere for it.**

- **Entry point.** `main.tsx` matches `/l/<token>` and imports
  `app/public/PublicApp` instead of `app/App`. No AuthProvider, no
  BrandProvider, no RouterProvider, no app shell. The auth gate in `App.tsx`
  is not bypassed; it never runs. (`SchemaRenderer` imports the store module
  for its usage instrumentation, so the factory is still evaluated — but the
  public page passes `instrument={false}`, and the Supabase client is
  constructed lazily inside a store method, so no authenticated call is made
  and no anon client is created.)
- **Token.** 32 bytes from `crypto.getRandomValues`, base64url (43 chars),
  minted server-side and stored as its SHA-256. Not derived from the template
  id. Shown once, at creation — regenerate is the recovery path for a lost
  link.
- **The gate.** `public_link_lookup(token_hash, consume)` applies every
  eligibility rule in ONE locked statement: not revoked, not expired, under
  its cap, template still exists and is still published, company's links
  still enabled (`public_links_enabled` is the seam for billing state). The
  cap is claimed under a row lock, so two simultaneous visitors cannot both
  take the last use. Nothing is cached, so revoking or unpublishing takes
  effect on the very next request.
- **The read.** `public-template` (verify_jwt = false) takes a token in the
  BODY and nothing else. After the lookup, every query key is server-derived
  — there is no id parameter to tamper with. The response is built by an
  allowlist in `_shared/publicTemplate.ts`, swept for unsigned storage
  references, and refuses outright if any asset could not be signed.
- **Uniform refusal.** Every rejection returns the same 404 body whatever the
  cause. A revoked token and a never-existed token are indistinguishable, or
  the endpoint becomes an oracle for probing which tokens exist. The admin UI
  is the one place the distinction is shown, to the one person who can act
  on it.
- **Assets.** Per-object signed URLs, 300s, minted by the service role for
  exactly the objects the template paints. They land in the same fields that
  hold storage references for a member, so `SchemaRenderer`, `useDataUrl`,
  `registerCustomFont`, and `exportSchemaPng` run unmodified — which is what
  makes the exported PNG identical on both paths.
- **Uploads.** Nothing is uploaded. Member photo uploads already never reach
  storage: `FieldInput` crops to a data URL in the browser and it goes
  straight into the PNG. So a public fill is not an unauthenticated write,
  and there is no quarantine bucket, no magic-byte check, and no cleanup
  schedule to run. The per-link switch is a product control, not a security
  one.
- **Rate limiting.** `consume_rate_limit` — per IP, global, and per token,
  before the lookup. Keys are a peppered digest of the address with one day
  of retention: events are counted, people are not.
- **Resume.** localStorage, text and select values only (a cropped photo is a
  multi-megabyte data URL that would blow the quota). The page says so.
- **Rendering.** `TemplateFill` is THE fill surface, shared verbatim with the
  member page, so a fix in one is a fix in both.

Run `./supabase/verify/run.sh` against any Postgres to re-check tenant
isolation, the lifecycle, the cascades, and cap concurrency.

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

`renderSchemaBlob` (src/lib/render/exportPng.ts) is THE rasterization path —
the single export (`exportSchemaPng`, which adds delivery) and bulk fill both
call it. It ports the proven technique from the original generators: dimensions from the schema (never hardcoded),
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

### Bulk fill

One published template, one spreadsheet, one graphic per row. An admin opens
**Bulk fill** from the template's fill page (`/templates/<id>/bulk`, rendered
through `adminOnly`), drops a CSV, matches columns to fields, reviews every
row, and downloads a ZIP of PNGs plus a `captions.csv` of the merged caption
for each. It reads a `TemplateSchema` and writes nothing: no template, no
draft, no field.

It is a loop around machinery that already exists. `parseCsv`
(`src/lib/bulk/csv.ts`) is a small owned RFC 4180 subset; `autoMap` matches
headers to fields by key, then label, then the `suggestFieldKey`
normalization, and never by position or edit distance; `checkRows` runs the
template's own guardrails (required, max length, select options) and then
`measureProposal` — the same measurement Generate uses — against real glyphs;
`runBulk` names files `NNN-slug.png` and assembles the archive with `jszip`
(dynamically imported, `STORE` compression, since a PNG is already
compressed). Image fields are out of scope: a CSV cannot carry a cropped data
URL, so image slots render as the template designed them.

Two properties make it safe:

1. **One rasterization path.** `BulkExportStage` keeps a single
   `SchemaRenderer` mounted off-screen (`instrument={false}`, positioned far
   outside the viewport with real dimensions rather than hidden, since a node
   the browser does not lay out rasterizes blank), swaps only its `values`,
   waits for the commit of that exact values object plus two animation
   frames, and calls `renderSchemaBlob` — the same function the single
   export's `exportSchemaPng` is built on. A bulk PNG is byte-identical to the
   one a member downloads by hand.
2. **Overflow is a refusal, not a warning.** A row whose text would not fit
   at the shrink floor, or that fails a guardrail, is shown in the review
   table with a plain-language reason and left out of the ZIP unless the
   person explicitly includes problem rows. Output is on-brand by
   construction, or it is not produced.

Runs are capped at 200 rows (a memory budget: every PNG is held until the
archive is written) and recorded as `bulk_export` usage events, one per
rendered row in one write, never as downloads.

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
