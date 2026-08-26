# SocialPaint

A multi-tenant, self-service brand template portal. Marketing admins design locked templates once; everyone else fills in a few fields and downloads a perfectly on-brand graphic.

The core design principle is **subtraction**: the only thing an end user can change is the content of the fields the admin defined. Layout, typography, colors, and logos stay exactly where the brand team put them.

## How it works

**Admins** build templates in a Figma-style canvas editor: start from a blank canvas, an uploaded PNG, or an imported Figma frame, then place text, image, select, and shape elements with a full inspector (position, layout, typography, fill, opacity, layers). Publishing makes the template available to members.

**Members** open a published template, fill in the fields the admin exposed (with guardrails like character limits, required fields, and auto-fit text), preview the result live, and export a pixel-perfect PNG. A caption template merges their answers into ready-to-post copy.

**Brand Studio** holds each company's kit: unlimited palette colors, heading and body fonts (Google Fonts or uploads), logos, and named type styles that act as a rules engine. A field bound to the "Heading" style inherits everything that style defines, and changing the style restyles every bound field across every template instantly.

## Features

- Figma-style template builder: drag elements from a palette, multi-select, copy/paste/duplicate, context menus, z-ordering, rotation, and a collapsible inspector
- Shapes (rectangle, ellipse, triangle, star, line) with solid, brand-palette, or gradient fills that survive PNG export
- Canvas backgrounds: solid color, gradient, or image
- Figma import: paste a frame link and every detected text layer or image placeholder becomes a candidate field you can accept or leave baked into the background
- Design-system import: fill the brand kit from a design-tokens JSON, a guidelines markdown file, or a connected Figma file's published styles
- Guarded member inputs: max length, required, auto-fit and fixed-width text, aspect-ratio-enforced image cropping
- Caption templates with `{field_key}` merge tags
- Reliable PNG export (fonts embedded, cross-origin images pre-converted, mobile share sheet support)
- Public template links: an admin shares a link, and anyone who opens it fills the template in and downloads a PNG — no account, no sign-in. Links can be named, capped, given an expiry, revoked immediately, and regenerated
- Insights dashboard: opens, downloads, 30-day trend, template leaderboard, with public-link traffic counted apart from the team's own
- Multi-tenant auth on Supabase (email/password, invites, admin and member roles, row-level security), with light and dark themes throughout

## Quick start

No backend setup required. The app ships with a localStorage dev backend behind the same store interfaces the production backend uses.

```bash
npm i
npm run dev
```

Open the printed localhost URL and the first-run wizard walks you through creating a company, brand kit, and first template. A switcher chip in the header shows which backend is active, and the dev backend adds a tenant/role switcher so you can preview the portal as an admin or a member.

## Running against Supabase

1. Create a Supabase project and copy `.env.example` to `.env`:

   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   ```

   These are client-safe values; security comes from row-level security policies, not secrecy.

2. Apply the migrations in `supabase/migrations/` (via `supabase db push` or the SQL editor). The database ships empty of tenant data; onboarding creates everything.

3. Set the CORS origin allowlist, then deploy the Edge Functions. `ALLOWED_ORIGINS` is a comma-separated list of exact origins; a `*` matches one run of letters/digits/hyphens (a Vercel preview hash, a localhost port) and never a dot or slash. Functions fail closed — with the secret unset, no browser origin is allowed and OAuth/invite redirect targets are all rejected.

   ```bash
   supabase secrets set ALLOWED_ORIGINS="https://www.socialpaint.ai,https://socialpaint.ai,http://localhost:*"
   supabase functions deploy figma-status figma-connect figma-import figma-layers figma-styles invite-member template-links
   ```

   The two public-link functions are the only ones that accept a caller with no JWT, which `supabase/config.toml` records per function — do not add a global `verify_jwt = false`. Deploying them reads that file, so no extra flag is needed:

   ```bash
   supabase secrets set PUBLIC_LINK_IP_PEPPER="$(openssl rand -hex 32)"
   supabase functions deploy public-template public-link-event
   ```

4. In the Supabase dashboard (Authentication → URL Configuration), set the Site URL to your production domain and add your local and hosted URLs to the additional redirect URLs so confirmation, invite, and reset links land correctly.

### Figma integration (optional)

The manual builder always works without it. To enable Figma import, an admin connects a Figma personal access token from Settings; the token is stored server-side and used only by Edge Functions. The client never talks to the Figma API directly. OAuth is also implemented: set `FIGMA_CLIENT_ID`, `FIGMA_CLIENT_SECRET`, and `FIGMA_OAUTH_REDIRECT_URI` via `supabase secrets set` to enable it.

## Architecture at a glance

Pure React SPA (React 18, Vite, Tailwind v4) with Supabase as the backend. Components import only the store interfaces in `src/lib/stores/interfaces.ts`; a factory picks the Supabase or localStorage implementation from the environment, so both backends exercise identical UI code paths.

A template is data, not code: a background plus an ordered array of guarded fields, rendered everywhere by the single `SchemaRenderer` component. The renderer also records usage events, which is why one code path covers every template in the analytics.

```
src/lib/types.ts              Domain types (TemplateSchema, BrandKit, …)
src/lib/stores/               Data layer (Supabase + localStorage backends)
src/lib/auth/                 Auth boundary (Supabase Auth or dev switcher)
src/lib/brand/                Brand kit context, type-style resolution, imports
src/lib/render/               Canvas math, fonts, auto-fit, PNG export
src/app/components/           App shell, portal, SchemaRenderer
src/app/components/builder/   Admin template builder (wizard + canvas editor)
supabase/migrations/          Schema, RLS, storage policies
supabase/functions/           Edge Functions (Deno): Figma, invites, public links
supabase/verify/              Tenant-isolation checks for public links (needs only psql)
```

Full details:

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): stack, layers, data model, auth, theming, export pipeline
- [docs/TEMPLATE_SCHEMA.md](docs/TEMPLATE_SCHEMA.md): the template and field schema contract
- [docs/public-links-privacy.md](docs/public-links-privacy.md): exactly what a public link records about a visitor, and what it deliberately does not

## Scripts

| Command                    | What it does                                                                    |
| -------------------------- | ------------------------------------------------------------------------------- |
| `npm run dev`              | Start the Vite dev server (set `PORT` to pick a port)                           |
| `npm run build`            | Production build                                                                |
| `npm run verify`           | Typecheck (app + Deno), lint, format check, unit tests                          |
| `./supabase/verify/run.sh` | Tenant-isolation and lifecycle checks for public links, against a real Postgres |

## Origins

The project began as an internal template generator for a healthcare marketing team and was generalized into a multi-tenant product. The original design exploration came out of Figma Make; see [ATTRIBUTIONS.md](ATTRIBUTIONS.md) for third-party notices.
