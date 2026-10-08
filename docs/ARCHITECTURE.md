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
                              DesignImportProvider, GenerateProvider,
                              GenerateThreadStore
  supabase/                   Supabase implementations (+ FigmaImporter → Edge Functions)
  local/                      localStorage dev implementations
  index.ts                    Factory: picks backend from env
src/lib/auth/AuthContext.tsx  Auth boundary (dev switcher now, Supabase Auth later)
src/lib/brand/BrandContext.tsx Active company's kit/assets/locations + theming
src/lib/render/              Canvas math: data-URL pipeline, autofit, fonts, toPng export
src/lib/bulk/                Bulk fill: CSV parser, column mapping, row checks, run loop
                              (pure; the render step is injected)
src/app/components/bulk/     Bulk fill page + the off-screen render stage
src/lib/generate/            Generate chat: thread model and reducer, the run,
                              measure and repair, linked fields, saving (pure;
                              stores and measurer injected)
src/app/components/generate/ Generate chat page, History page, editor panel
src/app/components/SchemaRenderer.tsx  THE renderer — every template goes through it
src/app/components/builder/  Admin Template Builder — a guided wizard:
                              source (PNG/Figma) → Name → Fields → Caption →
                              Tags & details → Publish. The Fields step is an
                              element palette (drag onto canvas) + canvas
                              (multi-select, ⌘C/X/V/D + context menu) + field
                              list (drag = member form order) + inspector
                              (z-order via To front/back; image corner radius)
src/app/components/onboarding/ Create account (OnboardingFlow) and its pieces
supabase/migrations/         Schema + RLS (dev-active, real-ready)
supabase/functions/          figma-status / figma-connect / figma-import /
                              template-generate (Deno)
```

## Data model

Every tenant-owned table carries `company_id` → `companies`. See
`supabase/migrations/0001_schema.sql` for full DDL. (Locations were removed
from the platform in migration 0009.)

- `companies`, `users`, `memberships` (role: `admin` | `member`)
- `brand_kits` (palette jsonb, `type_styles` jsonb — the brand rules engine's
  named roles, `guidelines` jsonb — accepted free-text rules, heading/body
  font refs (unread since migration 0042; the font roles live on the type
  styles), primary logo) — one active per company. Unlimited colors, type
  styles, and rules.
- `brand_assets` (logo | font | image; Storage-backed)
- `company_canvas_presets` — per-workspace canvas-size opt-outs, keyed by
  `SIZE_CATALOG` ids. No longer read or written: since the new look's Phase 3
  every workspace offers the whole catalogue (`src/lib/templates/platforms.ts`,
  the single source of size dimension data since 0029), and Phase 9 drops the
  table.
- `templates` + `template_fields` — the heart of the system; see
  `docs/TEMPLATE_SCHEMA.md`. `templates.variants` (migration 0031) holds the
  template's colourways as one jsonb blob keyed by `field_key`, like
  `layout_groups`: appearance overrides over ONE shared field array, never
  a second copy of the structure. `usage_events.variant_id` records which
  look an open, download, or bulk row rendered in. Migration 0031 is live on
  the linked project (applied 2026-09-09).
- `usage_events` (`open` | `download` | `share` | `bulk_export`) — `open`
  and `download` are recorded inside `SchemaRenderer` so one code path covers
  every template; `share` is the person taking that PNG to LinkedIn, recorded
  by the fill page; `bulk_export` is one graphic rendered by an admin's bulk
  fill run, one event per row, written as a single batch after the run
  (migration 0030, live on the linked project since 2026-09-03).
  Bulk rows are deliberately not downloads: a run has no opens, so folding
  them in would break the export rate. Every tally names each action
  explicitly (see the `UsageAction` comment in `src/lib/types.ts` for the
  list of sites, and `0027_share_events.sql` for why). `actor` (`member` |
  `public`) and `link_id` separate public-link traffic from the team's own;
  a public fill has no `user_id` and is never given a fabricated one.
  A member row inserted without a user takes the inserting session's
  (`usage_events_attribute_member`, migration 0044): the fill page recorded
  `user_id` null until then, so earlier member events stay unattributed.
  Edge Functions run with no session, so one that ever logs a member event
  passes the user itself.
- `template_links` — public share links (migration 0026). Tokens are stored
  **hashed**; the plaintext exists only in the response that mints it.
  `pinned_variant_id` (0031) pins a link to one look; null lets the visitor
  choose.
- `template_link_events` — who created, renamed, revoked, or regenerated a
  link. Folds into the audit log when that lands.
- `rate_limit_counters` — fixed-window counters keyed by an opaque string.
  **No client access, ever** — service role only.
- `integration_connections` — Figma and Canva tokens, one row per
  `(company, provider)`. **No client access, ever** — Edge Functions only,
  via service role.
- `canva_oauth_states` — the server-side half of a Canva connect in
  flight (state nonce, PKCE verifier). Single-use, ten-minute TTL. **No
  client access, ever.**
- `generate_threads` (migration 0038): saved Generate chats, one row per
  chat (title, `platforms` text[], `preview` and `turns` jsonb). **Private
  to its author**: every policy is `user_id = auth.uid()`, so not even a
  company admin reads another member's chats. Never holds a photo or any
  `data:` value. See Generate below. `template_id` (migration 0040) scopes a
  template chat to its template; the insert and update policies only accept
  a template of the row's own company, and a deleted template nulls it.
- `template_fields.is_optional` and `min_font_scale` (migration 0040): an
  admin can mark a member field optional, and the shrink floor can be a
  fraction of the set size. See `docs/TEMPLATE_SCHEMA.md`. The legacy
  `required` column is never read.
- `member_hints` (migration 0040): first-run hints, one row per user,
  strictly self-scoped (`user_id = auth.uid()`, like
  `user_notification_prefs`), written only through the atomic RPCs
  `note_template_chat_started()` and `mark_plus_opened()`.
- `ai_usage_events` (migration 0040): one row per model call, with its
  function, kind, model and token counts. **Written only by Edge Functions
  (service role)**; there are no insert, update or delete policies, so no
  member can forge or erase usage. Company admins read their company's rows
  (`ai_usage_summary(p_company, p_since)`, security invoker, so the
  admin-only read policy decides who gets numbers). Rows with a null
  `company_id` (onboarding's `brand-from-website`) are visible to no one
  but the operator.

The database ships **empty of tenant data**. Onboarding creates everything.

## Auth & multi-tenancy (LIVE as of migration 0006)

Real Supabase Auth is enabled. `0006_real_auth.sql` dropped the dev
pass-through policies and activated production RLS:

- **Identity**: email/password via Supabase Auth. `auth.users` inserts mirror
  into `public.users` via the `handle_new_user` trigger. The gate is
  `auth/AuthPage.tsx` (the controller) over `AuthScreen.tsx` (every view
  from props): sign in, sign up, reset password, reset link sent, check
  your email and new password. The rules and our error words are in
  `src/lib/auth/gateErrors.ts`; Supabase's own text goes to the console
  and Sentry only. A reset link signs the person in, so
  `src/lib/auth/recovery.ts` keeps the gate on New password until it's
  saved (App reads it alongside the session).
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
  `requireRole(req, companyId, …)` — callers must be a member (status,
  generate) or admin (connect/import/styles/invite/links) of the company
  they name. The two public-link functions are the exceptions and are
  described below.

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
  minted server-side and stored as its SHA-256, which is all the gate
  checks. Not derived from the template id. Since migration 0033 the
  plaintext is stored too (admin-readable), so Settings › Sharing and
  Insights can copy a link again later; links minted before 0033 have none,
  and New address (regenerate) gives them one.
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
  makes the exported PNG identical on both paths. Only objects under
  `{bucket}/{companyId}/` of the link's own company are signed. Every
  reference (background, fixed image, mask, variation background and image
  swap, font file) is a value the company's admin wrote, and the service
  role signs whatever it is handed, so `payloadAssetRefs` holds each one to
  `isCompanyStorageRef` and a template naming any other object refuses the
  whole link with the same 404. Link creation (`template-links`) counts such
  an object as missing and never looks it up. `supabase/verify/storage_ref_audit.sql`
  is a read-only query that lists any such reference already in the database.
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
- **Variations.** An unpinned link serves every variation (whitelisted key
  by key, image overrides signed) and the page shows the same "Choose a
  look" step a member sees. A pinned link serves exactly the pinned
  variation, so the picker never appears and the other colourways never
  leave the tenant; a pin to a since-deleted look falls back to the
  default rather than breaking the link. Downloads report the look.

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

Token values come from the Figma file "Master UX-UI". `design/tokens/master.tokens.json`
is its export (made with the development plugin in `design/tokens/figma-export/`), and
`npm run tokens` generates `src/styles/tokens.css` from it with `scripts/build-tokens.mjs`.
Nobody edits either file by hand. While the new look moves page by page
(`docs/design/new-look/`), `src/styles/legacy-bridge.css` points old token names at the
Figma ones. `npm run tokens:check`, part of `npm run verify` and CI, fails when
`tokens.css` is out of date or when a stylesheet redeclares a token it owns.

Interface controls are the primitives in `src/app/components/primitives/`, one per
component on the Figma file's Master UI Elements page, styled in
`src/styles/primitives.css` with their interaction states built in and tested in the
happy-dom Vitest project. In development, `/dev/ui` renders every primitive and the
file's Interaction states table. Screens move onto the primitives in the phase that
rebuilds them (`docs/design/new-look/PLAN.md`); the `.sp-btn`, `.sp-input` and
`.sp-chat-*` classes stay until nothing uses them.

The shell is the sidebar (`src/app/components/Sidebar.tsx`: the Figma Sidebar component,
expanded or collapsed, built on the primitives and styled in `src/styles/shell.css`) and
the page header (`layout/Page.tsx`: a title and its actions). Settings opens from the
account gear and holds People (`/people` and `/settings/team` redirect there), workspace
switching (the Workspaces card) and sign out; on the local backend the dev role switch
sits in `DevBackendBanner`. What each role reaches is `screenFor` (`src/app/router.tsx`)
and `settingsSections.ts`, pinned by `src/app/routes.test.ts`.

Billing (Phase 7b, `docs/design/new-look/PHASE-7B.md`): plans are bought and changed on
Stripe. `billing` (plans, checkout, portal, keep) sends people to Checkout or to the customer
portal's page for one change; `billing-webhook` (no JWT; the Stripe signature authenticates)
fetches each subscription and writes its state to `billing_accounts`, one row per payer, and
links the workspace it covers through `companies.billing_account_id`. Admins read a workspace's
plan with `workspace_plan()`. The rules live in `supabase/functions/_shared/billing*.ts`
(tested under vitest); the plan catalog is mirrored in `src/lib/billing/catalog.ts`. Nothing is
enforced, and without the Stripe secrets every workspace is on Early access.

Settings is on the new look (Phase 7; styles in `src/styles/settings.css`, the `sp-st-*`
classes). Each section is a column of primitive `SettingsCard`s with the action in the card's
header; the rail items are real links, and legal links sit at the foot. Feedback with no place
on the page goes to one toast (`settings/settingsToast.tsx`), and every destructive action keeps
a confirm on `Modal` (`settings/SettingsConfirm.tsx`: `ConfirmModal`, and `TypedConfirmModal`
for revoke-all and delete). The Plan card shows the no-plan state, "Early access", until billing
lands in Phase 7b. Sharing's rows copy a link's address (its token is stored since 0033); links made
before 0033 need New address first.

Brand Studio is on the new look (Phase 6; styles in `src/styles/brand-studio.css`, the
`sp-bs-*` classes). Detail pages head themselves with `BreadcrumbHeader` (save status and
Undo on the right); file rows and cards carry `RowMenu` / `RowContextMenu` (the same menu
on right-click); preview cards use `PreviewOverlay decorative`. Escape on an in-place edit
also drops that edit's undo steps (`brand.cancelTo`).

Brand Templates is on the new look (Phase 4; styles in `src/styles/brand-templates.css`).
The library's template card is one button that steps through its looks on hover. A page
under the library (the fill page, the template chat) heads itself with
`layout/Breadcrumb.tsx` in place of a title. The fill page (`TemplateFill`, shared with the
public link page) is a step form, one field per step on the Field primitive (a photo on the
Upload control, whose picking and cropping is `imagePick.tsx`, shared with Generate's
editor), then a finish step with the look, the caption with Copy and the downloads, beside
a live Preview card. Both chats' Edit details is `details/DetailsPanel.tsx`: every
field in one panel, with Close and Discard; Generate's adds a size switch and its own stage.

## Insights

`src/app/components/admin/Dashboard.tsx` (admins only; new look, Phase 8).
`stores.usage.getInsightEvents` reads the raw events for the current window
and the previous one of the same length, and `src/lib/insights/buildInsights.ts`
does all the counting, so the dev and production backends can't disagree.
Every `usage_events` read in `src/lib/stores/supabase/usageStore.ts` pages
through `readAllPages` (1,000 rows a page, ordered by `created_at` then `id`),
since PostgREST caps an unpaged read without saying so.

- **Filters** live in the URL (`range`, `template`, `member`, `platform`;
  the defaults stay off it) and replace the history entry. They narrow the
  events and never redefine a count. The member filter's last entry, Public
  links, keeps `actor = 'public'` rows. Platform matches a template by
  `classifySize`. An unknown id reads as "all".
- **The digest** (`src/lib/insights/digest.ts`) builds its heading and
  sentence from the numbers alone: the export count and change, the leading
  template's share when it is 20% or more, and the busiest weekday and part
  of day in the workspace's zone.
- **Export CSV** writes one row per template in scope, and its filename
  carries the filters.
- **Public links** lists the five busiest active links. Copy is disabled
  for links made before 0033, which stored no token.


`renderSchemaBlob` (src/lib/render/exportPng.ts) is THE rasterization path —
the single export (`exportSchemaPng`, which adds delivery) and bulk fill both
call it. It ports the proven technique from the original generators: dimensions from the schema (never hardcoded),
all raster assets pre-converted to data URLs (html-to-image drops
cross-origin images silently), a double `toPng` with 150 ms pause (Safari
decode warm-up), `navigator.share` on mobile with download fallback. Custom
uploaded fonts are embedded via `fontEmbedCSS`; Google fonts render from the
document font cache.

## The way in: the gate and onboarding

Both render through `PreAppShell` (new look, Phase 8b; Figma 194:2 and
257:2): the logo, the form and the legal links beside the `sp-auth-panel`
art, always Light. The Terms of Service and Privacy Policy links read
`src/lib/legal.ts`, which points at placeholders until the pages exist.

Onboarding (`onboarding/OnboardingFlow.tsx`) asks About you, Set up for,
Your team, First up, Website (or Add your brand without one), then pulls
the brand (`brand-from-website`), shows it for review, invites the team and
lands on Workspace ready. Every answer stays in the flow's state until Your
brand's "Looks good", which creates the workspace with its creator as admin
(`create_company_with_admin`), saves its website and profile, uploads the
logo, saves the kit (born with font roles) and seeds the starters, all
through `src/lib/onboarding/service.ts`, so leaving earlier leaves nothing
behind. The person's name goes to `users.name` and their role to
`users.job_role`; the workspace's answers go to `companies.profile`
(migration 0045). Nothing in the app reads the answers yet.

The in-app "Create company" path runs the same flow from Your team. The
flow's side effects sit behind `OnboardingServices`, so `/dev/onboarding`
(and `/dev/auth` for the gate) render every step without a backend for the
screenshot run.

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
URL, so image slots render as the template designed them. A template with
several looks reads an optional `variant` / `variation` / `look` column,
matched by name (case-insensitive); an unknown name is a row-level note and
the row renders in the default look.

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
rendered row in one write, never as downloads. The enum value arrived in
migration 0030, which is live on the linked project (applied 2026-09-03).

## Generate

A member describes a post in their own words and gets finished drafts back,
filled into the company's published templates, then edits and downloads
them without leaving the page. Generate is a chat at `/generate`: a Start
state (greeting, composer, Recent), a thread of messages and assistant
turns, an editor panel beside the thread, and a History page at
`/generate/history`. A saved chat reopens at `/generate/c/<id>`. The
design and behavior spec is `docs/design/generate-chat/PROMPT.md`; the new
look (Phase 5) is `docs/design/new-look/PHASE-5.md`.

- **Pure modules**, unit-tested, in `src/lib/generate/`: the chat
  model (`chat.ts`) and its reducer (`chatReducer.ts`), one run
  (`chatRun.ts`), the measurement and repair passes (`measureProposal.ts`,
  `repairProposal.ts`), freestyle assembly (`designToSchema.ts`), Try next
  (`tryNext.ts`), the editor's linked fields (`linkedFields.ts`), card
  export rules (`draftDownload.ts`), and saving (`threadStorage.ts`,
  `threadSaver.ts`, `historyPaging.ts`, and the `data:` guard in
  `dataUrls.ts`, a leaf with no chat imports because both thread stores
  run it and the store layer reaches the public link page's bundle).
- **Components** in `src/app/components/generate/`: `GeneratePage` (Start
  and thread), `GenerateHistoryPage`, `EditorPanel`, and the hooks that hold
  the side effects (`useChatController`, `useThreadPersistence`,
  `useDraftDownload`). The chat's pieces on the new look, shared with the
  template chat, are in `src/app/components/chat/`: `ChatComposer` (on
  `useComposer`), `AttachMenu` (Upload, and Generate's Details), the
  messages, `GenerateTurn` on the Result card primitive, `CaptionCard` and
  `GenerateHeader`. Styles are `src/styles/generate.css`.
- **Server**: `supabase/functions/template-generate/` (the function and its
  system prompt) and `_shared/generateValidate.ts` (every parser and
  validator, pure, so vitest runs the same code the function does).

### The run

`template-generate` requires the caller to be a member of the company it
names, reads that company's published library (and, for freestyle, its
brand kit), and writes nothing but the shared rate-limit counters
(`consume_rate_limit`: 10 calls per member and 40 per company in 10
minutes, failing closed, since every call costs money; a repair round draws
on the same buckets). The model key is the `ANTHROPIC_API_KEY` secret;
without it the function answers 503 and says so.

- **Library** (the default). The candidates are the company's published
  templates with their field lists (the 40 most recently updated, with a
  warning past that). `templateIdHint` (the template chat) narrows
  them to one; `platformHint` narrows them to templates sized for that
  platform, or falls back to the whole library with a warning. One forced
  tool call (`propose_posts`): the model picks a `templateId` from the
  candidates and writes string values into fields an admin exposed, and
  nothing else, so the output is on brand by construction. It fills only
  the fields it has facts for; an empty field is legal and costs no retry,
  and the chat flags it (the Fill in row). `validateGeneration` checks every
  value; a failure retries once with the errors attached, then answers 502.
- **Freestyle** (`mode: "freestyle"`). The model proposes new layouts
  (`propose_designs`) for the platform's canvas, held to brand palette keys
  and brand type styles, with up to 12 published templates digested as
  style reference. A kit with no colors is refused with a 400. Each
  proposal carries its `design` and a synthetic `freestyle-N` templateId.
  The chat runs freestyle when the library is empty, for "Try another
  layout", and to revise freestyle drafts.

**Details.** A Generate message can carry detail tags from the attach
menu: Headline, Date & time, Location and Link, one of each, typed as
text. They are not tied to a template, so they travel as `facts` (a kind
and a value, `parseFacts`), quoted into the prompt for library and
freestyle runs alike, and the model uses each as written wherever a field
fits it. A run with facts never asks a question first. The template chat's
`details` are different: field-keyed, applied verbatim to its one template.

**Measure and repair in the browser.** Deno has no font stack, so the
function can only count characters. `measureProposal` lays every value out
against real glyphs through the same autofit and layout code that paints.
A library proposal that overflows gets one repair round (`repairProposal`:
the overflowing fields go back with character budgets derived from that
measurement, the server rewrites only those, and the result is measured
again); one that still overflows is dropped with a warning. A freestyle
proposal becomes a complete `TemplateSchema` (`designToSchema`) and is
measured; the server shrink-sizes its text, so there is no repair round and
an overflow drops it. A member never sees text off the edge.

**One run at a time.** `chatReducer` owns every transition of the thread;
components never mutate a turn. `runChat` sequences a run with every side
effect injected (the stores, the measurer, ids, the clock), and
`useChatController` holds which run is current and refuses a send while one
is in flight. A run is an assistant turn, and the turn's id is the run id:
step 1 while the model is asked (skeleton cards), step 2 as each proposal
resolves and its draft replaces its skeleton in place, step 3 while a
repair round is in flight and in any case before the last proposal
resolves, then done. The bar moves by step, never by time. A failed request
ends the turn as an error with the server's sentence (the rate-limit one
included), and so does a run whose every proposal was dropped; both offer
Try again.

**Stop.** `GenerateProvider.generate` and `repair` take `{ signal }`; the
Supabase provider forwards it to `functions.invoke`, and the local provider
has nothing to abort. Stop settles the turn as stopped at once, keeping the
drafts that already landed, then aborts. Two guards keep a late answer out
of the thread: the run checks after every await that it is still the
current one (Stop, New chat and leaving the page all clear it), and the
reducer ignores any action whose run id names a turn that is gone or
finished. An aborted request can still finish on the server and count
toward the limit.

### Follow-ups, reply and title

The request and the response kept their shape; the chat added three
optional fields. Each is validated server-side, and a client and a
deployment that disagree about them still work together.

- **`followUp`** (request). A message sent inside a chat carries the
  chat's first brief and the latest finished turn's library drafts
  (template id, name, and current text values; never an image value or a
  data URL). `parseFollowUp` holds it to its limits (brief 1 to 1,500
  characters, at most 3 drafts and 60 values each, name 120, key 60, value
  4,000) and answers 400 otherwise. It never narrows the candidates:
  `followUpSection` adds it to the model's text after the brief, matched
  against the published list before any hint narrows it (so "Make a
  Facebook version" keeps the drafts), and a draft whose template is not on
  that list is dropped silently. A freestyle follow-up sends no `followUp`;
  the client folds the brief so far into `brief` instead.
- **`reply` and `title`** (response). Optional properties of both propose
  tools. `validateReplyAndTitle` strips invisible characters, collapses
  whitespace, rewrites every em dash, and holds the reply to 280 characters
  (cut at a sentence or word boundary) and the title to 2 to 60 characters
  with no closing punctuation. An unusable one is dropped silently, never costing a
  retry, and the JSON body leaves it out.

The client tolerates their absence. With no `reply` (or when a draft was
dropped, since the model wrote its reply before the browser measured) the
turn shows its own sentence; with no `title` the chat is named from the
first brief's first six words. An older deployment ignores `followUp`, so a
follow-up reads there as a fresh brief. No string the function can show a
member (errors, warnings) carries an em dash.

### The photo never leaves the browser

A photo attached in the composer (uploaded, pasted, dropped, or a Brand
Studio image fetched through `loadDataUrl`) is downscaled to a data URL and
snapshotted on its message, in memory. Only `hasImage` and `imageAspect`
reach the function; the model may name the slot the photo belongs in
(`imageTargetFieldKey`, validated to be a member image slot). The photo is
laid over a draft's values whenever a card, the editor or an export paints
it, and is never written into the draft. It is not uploaded to Storage, not
sent to the model, and not saved with the chat: a saved message keeps
`hadPhoto`, the aspect alone, and a reopened chat says the photo was not
kept.

### Editing and export

Choosing a draft opens the editor panel beside the chat (an overlay sheet
below 1180px wide); nothing navigates. `linkedFields.ts` builds one form for
all of a turn's drafts: member text, multiline and select fields link by
`fieldKey`, else by normalized label (selects only with identical options),
at most one field per draft, and an edit writes to every draft in the
group. Image slots are never linked: each one the photo does not fill is
listed after the text fields, labelled with its size when there are
several.

Both ways out go through the one rasterization path. The panel's preview is
a live `SchemaRenderer`, and Download PNG is that renderer's `exportPng()`
(`exportSchemaPng`, built on `renderSchemaBlob`), the fill page's own path.
A card's Download skips the editor: `useDraftDownload` mounts one
`SchemaRenderer` per request off-screen (the `BulkExportStage` technique),
waits for the commit of those values plus two frames, calls `exportPng()`,
and runs one export at a time. Like the fill page, neither exports while a
required field is empty; a card's Download opens the editor on the gap
instead. So a PNG from the chat is the fill page's PNG for the same
template and values.

Usage stays inside `SchemaRenderer`. A published library draft renders with
`instrument` on (`instrumentsUsage`): opening it in the panel records the
fill page's `open` and Download PNG its `download`, and a card download
records both, so Insights counts Generate traffic as it counted the fill
page. The panel keeps each size it has shown mounted until it closes, so
switching back to a size records no second `open`. A freestyle draft has no template row to credit:
it renders with `instrument={false}` and records nothing, as thumbnails do.
An admin can save a freestyle draft to the library as a published template.

### Saved chats

`generate_threads` (migration 0038) holds one row per chat, reached through
`GenerateThreadStore` (`stores.generateThreads`): a Supabase store and a
localStorage one scoped to a fixed dev user, which page, search and order
through the same helpers (`src/lib/stores/generateThreads.ts`).

- **Private to its author.** Every policy is `user_id = auth.uid()` and
  `company_id in current_company_ids()`, like `user_notification_prefs`, so
  not even a company admin reads another member's chats. `user_id` defaults
  to `auth.uid()` and the client never sends it.
  `supabase/verify/50_generate_threads.sql` checks this against the real
  policies (`run.sh` runs it).
- **What is stored** (`toStoredThread`): complete exchanges only, each a
  message with its finished answer (done, stopped or error), at most 40
  turns; per draft its proposal (a freestyle `design` included), canvas and
  current values; the title (the server's, else the brief-derived one);
  `platforms`, the drafts' distinct primary platforms, for History's
  filter; and `preview`, the first draft of the first done turn, for the
  cards. **Never stored:** the photo, any `data:` value at any depth
  (`toStoredThread` strips them, and both stores refuse a write that still
  holds one: `assertNoDataUrls`), a run in flight, schemas, UI state.
  Reopening refetches each library template (one gone or unpublished
  leaves a card that says so and cannot be edited or exported) and
  rebuilds freestyle drafts from their designs.
- **Save points** (`threadSaver.ts`). The first finished turn creates the
  chat; each later finished turn updates it, and so does an edit, 800ms
  after the last. Nothing is written mid-run, one write per chat is in
  flight at a time, and a pending edit is written when the tab hides or the
  page goes. A failed write never interrupts the chat: the thread stays in
  memory, the dock says "This chat isn't saved yet.", and the next save
  point tries again. Pages that read chats wait for writes in flight first
  (`threadWritesSettled`).
- **The page key.** App keys the chat page by workspace and
  `generatePageKey`: `chat:<id>` for a saved chat, `new` for every new one.
  After its first save the page replaces `/generate` with `/generate/c/<id>`
  on a route marked `savedInPlace` (never in the URL), which keeps the key
  `new`, so the page does not remount and the photo, the open editor and the
  composer's text stay. A reload, back and forward read the URL alone and
  mount the saved chat fresh.
- **Paging.** Recent reads 4 chats; History reads 12 at a time as the member
  scrolls, filtered by platform (array contains) and a title search
  (`ilike`, with `%` and `_` escaped), both in the URL. Keyset on
  `(updated_at desc, id desc)`, never offset: `nextBefore` is an opaque
  cursor naming a page's last chat by both keys, checked on the way back in
  before it becomes a filter, so chats saved in the same instant never
  repeat or skip. There is no `updated_at` trigger; the store stamps it on
  every write. The store can `remove` a chat; History does not offer that
  yet.

### Deploying

1. Apply migration 0038 (`supabase db push`). Until it is applied the chat
   still runs, but nothing saves and the dock says so.
2. Redeploy the function (`supabase functions deploy template-generate`)
   for `followUp`, `reply`, `title` and the reworded messages. The client
   also runs against the older deployment, with the fallbacks above.

## Template chat

A member opens a brand template, says what the post is for in one message,
and SocialPaint builds the graphic right away. Whatever the message did not
cover is flagged on the result for the member to fill in by hand, so a post
takes one model turn instead of a back-and-forth. It lives at
`/templates/<templateId>/chat` (a saved one at `.../chat/<threadId>`,
Edit details at `...?edit=<draftId>&field=<fieldKey>`). The spec is
`docs/design/template-chat/PROMPT.md`.

It is the Generate chat in a second mode, not a parallel system: the same
reducer, run, controller, thread store, renderer and editor, scoped to one
template for the whole thread (`ChatThread.templateId`,
`generate_threads.template_id`). `TemplateChatPage` loads the template and
hands it to `GenerateChat` as `template`.

- **Entry.** A Brand Templates card opens the fill page: filling in by hand
  is the default. The fill page offers "Use AI to assist", which opens the
  chat, when the template is published and `stores.generate.isConfigured()`.
  That one switch is true wherever the model is reachable, and on the local
  backend in a development build, where a stand-in
  (`src/lib/stores/local/templateChatStandIn.ts`, imported behind
  `import.meta.env.DEV`) answers both chats: the template chat with the
  answers as typed and every other field from its placeholder, Generate
  with up to its count of published templates, those sized for the platform
  hint first, filled from their placeholders and the message's details. It
  refuses freestyle, which needs the model.
  The chat links back to the fill page ("Fill in by hand") and, for admins,
  Bulk fill and Public link. A template
  that is unpublished or not the company's shows "This template isn't
  available any more."; a saved template chat whose template is gone opens
  at `/generate/c/<id>` as an ordinary Generate chat, and that route hands a
  chat whose template is live back to its template's page.
- **The questions.** A new template chat opens on its first question, not a
  brief (`interview.ts`, rendered by `chat/TemplateChatViews.tsx`). The questions are
  built from the template's fields, never by the model: one per member
  text, multiline or select field in the default look, then one photo
  question for the first member image slot. Required fields come first;
  optional ones offer Skip, and a skipped field is left off. Answers are
  checked against the field (maxLength, a select's options) and held in the
  page; nothing is saved until the last answer, which sends one message on
  its own: every answer as a `details` entry, the photo as the message's
  photo, and `UserTurn.interview.skipped`. The thread shows that message as
  the questions and answers again (`interviewTranscript`), rebuilt from the
  template and the saved details.
- **The run.** Every message pins the template (`templateIdHint`), asks for
  one draft, and sends the answers as structured `details` (applied
  verbatim; the model never writes them, and writes only the caption, reply
  and title). A first message with no details and no document may still be
  answered with one question (`allowQuestion`, the `ask_member` tool), which
  only a template with nothing but skipped optional fields can reach now.
  The question settles the turn as done with no drafts (`questionArrived`),
  never "nothing fit".
- **Looks.** A draft carries its `variantId`: a new draft takes the
  template's default, a follow-up's keeps the previous draft's, and the
  Looks card beside the result switches instantly with no model call.
  Measurement, requiredness, the Fill in row and every renderer read the
  look-applied schema.
- **Empty fields and fit.** The model fills only what it has facts for.
  Every chat surface paints with `emptyFields="chat"`: an empty optional
  field is left off, an empty required one keeps its slot and paints
  nothing. `fillInEntries` lists what is missing; `tooLongFields` (the
  measurement pass's "overflows", against the look) what does not fit at its
  floor. Either blocks the card's Download and Download PNG. A draft that
  still overflows after repair is kept and flagged, never dropped, and
  repair never rewrites a value the member typed (`ChatDraft.memberKeys`,
  from the answers and edits), which a follow-up also carries forward when
  its proposal leaves it empty.
- **Edit details.** The thread gives way to a stage (the draft rendered
  large, with Missing markers in the renderer's overlay, never exported) and
  `EditorPanel` beside it, drawn as the Details panel: the look switch, the
  fields with Missing and Too long on their error lines and Edited on their
  label rows, a Caption field (the member's
  own caption, `captionOverride`; the template's caption template is never
  used), Discard (the drafts as the panel found them, `draftsRestored`) and
  Download PNG. Opening it is a history entry, so Back returns to the thread.
  Edits never call the model.
- **The views.** A template chat renders on the new look's Composer,
  Message bubble and Assistant message (`chat/`), sharing the chat box's
  behaviour with Generate through `useComposer`; Generate keeps its own
  views until Phase 5 of the new look.
- **The chat box** (both chats): the plus opens Upload (Photo, File, Brand
  Studio). The Details section and the plus hint went when the questions
  came in; `MemberHintStore` and its RPCs remain but nothing reads them.

### Documents

The File row takes one PDF, TXT or MD file per message, at most 10 MB, read
**in the browser** (`documentText.ts`; PDFs through `pdfjs-dist`'s legacy
build, loaded lazily in its own chunk, first 10 pages). The text is
whitespace-collapsed and capped at 12,000 characters, sent once as
`documents` with that message, and never uploaded or saved: a saved message
keeps `hadDocument`, the file's name and kind. The server quotes it to the
model as JSON inside a section that marks it untrusted data, so nothing in a
document can change the template, the tool or the rules. A follow-up does
not resend it; its facts are already in the drafts.

### AI usage metering

Every Anthropic response in `template-generate` (first attempt, validation
retry, repair, freestyle), `template-autobuild` and `brand-from-website` is
written to `ai_usage_events` by `_shared/usage.ts` (`recordModelUsage`),
with the service role. A logging failure is logged and swallowed; it never
fails the member's request. `brand-from-website` runs before a company
exists, so it logs with no company and the caller's user. Settings → Usage
shows admins this calendar month's requests and tokens
(`UsageStore.getAiUsage`, from the workspace's local midnight on the 1st);
the local backend has no model calls and shows no card. It measures and
nothing more: no quotas or credits.

### Deploying the template chat

Ship in this order: migration `0040` (the functions select `is_optional`
and write `ai_usage_events`; the client writes both new field columns and
reads `template_id`), then `template-generate`, `template-autobuild` and
`brand-from-website`, then the app (an older function ignores `details`,
`documents` and `allowQuestion`). Run `supabase/verify/run.sh` against a
real Postgres; `70_template_chat.sql` covers the new policies.

## Brand rules engine & design-system import

Brand Studio defines unlimited **type styles** ("Heading", "Body", …). Every
property a style defines is an enforced rule ("Heading is always UPPERCASE",
"Body never exceeds 120 characters"): fields bind via `typeStyleKey`, the
builder locks the bound controls, and `resolveFieldStyle` applies the style at
render time so a Brand Studio change restyles every template instantly.

**Font roles** (migration 0042, `src/lib/brand/fontRoles.ts`): one type style
holds `useFor: "heading"` and one `"body"`, set with the Use for chips in the
style's All properties. New builder text and starter slots copy the role
style's face (no binding); fonts load from the faces the styles use; the setup
strip's fonts check is ready when both roles are held. Kits stored before the
migration are given roles as they load (`withFontRoles`), by the same rule
the SQL runs. `brand_kits.heading_font` / `body_font` stay in the table,
unread, until Phase 9 of the new look.

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

## Canva integration

Auto-build only (there is no plain Canva import); off unless `CANVA_ENABLED`
and a Connect API client id are set. Client code talks ONLY to our Edge
Functions:

- `canva-auth` — the OAuth lifecycle: `status`, `start` (PKCE, with the
  state and verifier held server-side in `canva_oauth_states`, single-use,
  ten-minute TTL), `callback` (code exchange), `disconnect`. Admin-only;
  the redirect target must be one of our own origins. Tokens land in
  `integration_connections` with `provider = 'canva'`, next to Figma's.
  Canva access tokens are short-lived and refresh tokens rotate, so
  `_shared/canva.ts` refreshes under a lease column
  (`refresh_lease_until`) that lets exactly one invocation refresh while
  the rest wait for its result.
- `template-autobuild` with `source.kind = "canva"` — the link is parsed
  with the host pinned to canva.com (`/design/<id>/…` only; `canva.com/d/`
  share codes are per-request and no Canva API resolves them, so the admin
  is told to copy the address-bar link instead), then
  `_shared/canvaRestExport.ts` walks the documented Connect API: `GET
  /v1/designs/{id}` for the page count, `GET …/export-formats` to confirm
  page 1 exports as PNG, `POST /v1/exports`, and `GET /v1/exports/{id}`
  polled with doubling backoff under a 90-second ceiling. The PNG is fetched
  inside the signed URL's own `X-Amz-Expires` window, its dimensions are
  read from the IHDR header, and it is re-hosted in `template-backgrounds`.
  Export quality and compression stay at Canva's defaults. `license_required`
  and `approval_required` get their own admin-facing sentences; everything
  else names Canva and the status. All of it is under `design:content:read`
  and `design:meta:read`.

What comes back is a flat picture with no element list, so the proposal
runs exactly as the image path does: Claude proposes conservative boxes,
the validator clamps them, and the response reports `sourceKind: "canva"`
for provenance. There is no layered recompose (no `sourceUrl`): the export
stays as the background with the source text baked in. So the request also
asks the model for a `plateHex` per editable text field, the solid colour
it sees behind that text, and the validator pushes a Fixed rect of that
colour with the field's own box immediately before the field, which the
builder's import z-orders beneath it. The plate hides the baked twin on a
solid backdrop; on a photo or gradient the model omits the colour, the
warnings count the unplated fields, and the admin decides in the
inspector.

**Why flat.** Canva's element geometry (position, size, rotation, text
runs, image fills, shape paths) is only exposed by its MCP server at
`mcp.canva.com`, not by the Connect REST API. That server publishes no
version and no deprecation policy, and its `read-design` payload changed
shape once already while we were building against it, from line-oriented
markdown to a JSON object, without an error: the client accepted three
names for one field, so a wrong shape became an empty string. Its published
terms also prohibit exporting design structure into another design tool
without written consent, and its redirect URI allowlist is granted by
application. A buyer's vendor review asks which APIs an integration uses,
and the answer has to be a documented, licensed one. So the MCP client and
its markdown parser are parked in `_shared/canvaMcp.ts` and
`_shared/canvaCdf.ts` (nothing imports them), the captured JSON payloads
sit in `_shared/canvaMcpFixtures.ts` as evidence of the shape, and one test
records that the old parser does not read them. If that path ever resumes,
every silent fallback becomes an assertion that names a format change,
logged under a distinct tag so a drift shows up in Sentry within hours,
and the client registers through a Client ID Metadata Document rather than
dynamic registration.

## Environment

See `.env.example`. Client env (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
is safe to expose — security comes from RLS. Figma and Canva secrets exist
only as Edge Function secrets. No secrets in code, ever.

Local dev: `npm run dev`. With Supabase: `supabase start` (or a hosted
project), `supabase db push` (or run migrations), `supabase functions deploy
figma-status figma-connect figma-import canva-auth integration-status
template-autobuild template-generate brand-from-website`, fill `.env`.
The model-backed functions need the `ANTHROPIC_API_KEY` (and optionally
`ANTHROPIC_MODEL`) secret.
