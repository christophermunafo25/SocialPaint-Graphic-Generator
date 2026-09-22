# Starter templates

Every new company gets six ready-made, brand-matched templates the moment
onboarding completes. Seeding is client-side: `OnboardingWizard.finish()`
calls `seedStarterTemplates` after the brand kit upsert, and the inserts go
through the ordinary `stores.templates.create()` path — the
`create_company_with_admin` RPC has already made the caller an admin, so RLS
passes with no service role and no seeding edge function.

## The blueprint model

`src/lib/templates/starters/` holds the whole feature:

- `types.ts` — the blueprint model. A `StarterBlueprint` is
  `TemplateSchema`-shaped, but every color-bearing property carries a
  symbolic `SlotColor` (`surface`, `surfaceAlt`, `ink`, `inkMuted`,
  `accent`, `onAccent`, `border`) and every font a `SlotFont` (`display`,
  `body`, `label`). The only text tokens are `{company.name}` and
  `{company.website}`.
- `blueprints.ts` — the six designs, transcribed from the seeding spec's
  appendix. Geometry, copy, and the type ramp are data; nothing here is a
  component, which is why this module (and `neutrals.ts`) are the sanctioned
  homes for the hexes.
- `neutrals.ts` — the fixed neutral values for both colorways, the accent
  fallback, and the font fallbacks. Surfaces, ink, and borders are identical
  for every tenant; ONLY the accent slot pair carries tenant color, which is
  what makes seeding safe for any palette.
- `materialize.ts` — pure: blueprint + tenant context in, `NewTemplateInput`
  out. The accent comes from the role ladder (accent, secondary, primary,
  first entry, fallback), is contrast-walked per surface (WCAG 2.1 ratios
  via `src/lib/color.ts`, HSL lightness steps of 4, capped at 20), and gets
  an `onAccent` of near-black or white, whichever clears 4.5. Each template
  ships a Light default variant and a Dark variant whose overrides carry,
  per field, only the keys that differ.
- `seed.ts` — the seeder. Idempotent by `starterKey` (looked up in
  `autobuildMeta`), sequential, never throws; failures are collected per
  template and surface as a toast, because seeding must never fail
  onboarding.

Provenance lives in `autobuildMeta`: `{ source: "starter", starterKey,
starterVersion, seededAt }`, alongside the pre-existing required keys
(`model` and `sourceKind` read "starter"). There are no new columns.

## The drift tradeoff, and the restore action

Colors are baked at seed time. If the tenant later changes their palette,
seeded templates keep their baked colors — there is no live palette binding
(`template_fields.color_key` stays retired). The recovery path is the
"Restore starters" action on the Template Builder page: because the seeder
skips `starterKey`s that still exist, restore only recreates deleted
starters, so re-coloring one after a palette change is delete, then restore.
A second click is a no-op. The same button is the backfill for companies
created before this feature existed.

## The variant override extension

To recolor the CTA plates and slot borders per colorway,
`VariantFieldOverride` gained exactly two keys: `plateColor` and
`strokeColor`. This is a TypeScript change plus the `applyVariantToSchema`
merge in `src/lib/templates/variants.ts` — not a migration; the values ride
the existing `variants` jsonb. The geometry halves (stroke width, plate
paddings) remain structural and shared across looks, and the compile-time
guard in `variants.ts` still proves no structural key can be overridden.
The builder's variation inspector picks the two keys up automatically, since
its write path iterates `VARIANT_OVERRIDE_KEYS`.

## Adding starter 07

1. Bump `STARTER_VERSION` in `starters/index.ts`.
2. Add the blueprint to `blueprints.ts` with a new stable `starterKey`
   ("something-07"), and append it to `STARTER_BLUEPRINTS`.
3. Nothing else. New signups seed it with the rest, and existing tenants get
   it from the restore action, which creates any `starterKey` they are
   missing.

## Brand from website

Onboarding also offers an optional screen in front of step one: the admin
pastes their site's URL, the `brand-from-website` edge function fetches it
(SSRF-gated: https only, public hostnames only, every DNS answer checked
against private ranges on every redirect hop and the logo fetch), makes one
forced `extract_brand` call, validates every field of the model output
server-side, and returns a prefill. The wizard fills the same state the four
steps edit, so the admin reviews everything before finishing; the function
writes nothing. The tenant's website lands in `companies.website`
(migration 0037) as a bare domain, normalized by `src/lib/companyWebsite.ts`,
and the starter templates' footer URL fields read it — a tenant without a
website simply gets no URL fields.
