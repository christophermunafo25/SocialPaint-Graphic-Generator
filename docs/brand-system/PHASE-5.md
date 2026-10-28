# Brand system, Phase 5: the system model

You are working in the SocialPaint repo. Brand Studio holds a flat palette and a list of type styles:

- **Colour.** A colour can be Primary, Secondary or Accent, but nothing knows which one is the ground or which ink sits on which fill.
- **Type size.** Type sizes are fixed pixels, so a headline that fits 1080×1350 fails 1200×627.
- **Enforcement.** Off-palette enforcement clamps only text colours and gradient stops. Shape fills, strokes, plates and the canvas background go unchecked.

This phase lays the model Track B builds on:

- a versioned `brand_kits.system`;
- pure resolvers for colour roles, schemes with contrast fixes, and a canvas-relative type scale;
- enforcement that closes the off-palette hole.

It adds no screens. Done when the resolvers are tested and every existing fixture renders unchanged.

Read these in full before planning:

- `CLAUDE.md`
- `docs/brand-system/PLAN.md`
- `docs/brand-system/RULES.md`
- `docs/brand-system/strategy/BRAND-SYSTEM.md` ("Colors", "Light and dark", "Typography", "Data model sketch")
- `.claude/skills/brand-kit-change/SKILL.md`
- this prompt

## Decisions

Decided by CJ on 2026-10-27:

1. **Start now.** Phase 5 adds no Brand Studio screens, so it doesn't wait for new-look Phase 9. Phases 6 and 7 still do.
2. **D1, colour roles.** Eight graphic roles replace Primary, Secondary and Accent: Ground, Soft, Deep, Accent, Card, Ink on light, Ink on dark and Emphasis.
   - The roles are derived first, and the admin corrects them.
   - Secondary takes the role its use in the templates shows.
3. **D3, type sizes.** A per-canvas table plus one brand ratio. A type style's colour becomes a role.
4. **D4, storage.** One versioned `brand_kits.system` jsonb. The `brand_references` table comes with Phase 10.

## Gates

- **Gate A (recon):** CJ approves:
  - the shapes below;
  - the role derivation rules;
  - the scheme table;
  - the type table.
- **Gate B:** CJ approves the `palette-enforcement` fixture's golden and baselines.

## The shape (proposed at Gate A)

```ts
export type ColorRole =
  | "ground" | "soft" | "deep" | "accent" | "card" | "inkOnLight" | "inkOnDark" | "emphasis";
export type SchemeId = "light" | "dark" | "brand" | "accent" | "tonal";
export type TypeRole = "display" | "headline" | "subhead" | "body" | "label" | "cta" | "number";

export interface BrandSystem {
  version: 1;
  color?: {
    roles?: Partial<Record<ColorRole, string>>; // role -> palette key: the admin's corrections
    neutrals?: "cool" | "mono" | "warm";
  };
  schemes?: { enabled?: SchemeId[]; preferred?: SchemeId };
  type?: { ratio?: number; roles?: Partial<Record<TypeRole, string>> }; // role -> type style key
}

// BrandKit
system?: BrandSystem;

// BrandTypeStyle
colorRole?: ColorRole; // resolved per scheme once a template states its scheme (Phase 6)
```

- **`BrandColor.role` stays readable.** The role resolver reads it as a hint.
- **Migration 0052** adds `brand_kits.system jsonb`, with no backfill. 0051 is left for the size-families program, whose open PR also numbered a migration 0049.

## What exists to build on

- **Contrast and accent walking.** `src/lib/templates/starters/materialize.ts` has `walkAccent`, `pickOnAccent`, `resolveSlots` and the Light and Dark slot tables.
- **Fallback neutrals.** `starters/neutrals.ts` holds them.
- **Palette clamping.** `clampToPalette` in `src/lib/brand/resolveStyle.ts` clamps text colours and gradient stops when `allowOffPalette` is false.
- **The kit round trip:**
  - `kitShape()` in `src/app/components/admin/brand/kitPlumbing.ts` rebuilds the kit on every autosave;
  - `SupabaseBrandKitStore.upsert` writes every column;
  - `toBrandKit` reads them back.

## What not to touch

- **Brand Studio screens.** The Colors and Light & dark pages are Phase 6; Type, Layout, Shape & effects and the Character pad are Phase 7.
- **"Add colourway"**, and binding `colorRole` at render time per variant scheme. Both are Phase 6.
- **Generation and import.** That covers `template-generate`, autobuild, and imports filling the system (Phase 8).
- **Starters** moving onto the resolvers.
- **New-look Phase 9's files.**
- **The `brand_references` table.**
- **Removing `BrandColor.role`.**

## Steps

Commit after each step with `npm run verify` green, and stop at each gate.

1. **Recon.** Report the shapes, the derivation rules, the scheme table and the type table. **Gate A.**
2. **Type, storage and plumbing.** Follow the `brand-kit-change` skill end to end:
   - the type and migration 0052;
   - rows, the store, `kitShape` and the local backend;
   - round-trip tests.
3. **Colour roles.** `paletteUsage(templates)` and `deriveColorRoles(kit, usage?)`, with each role's source recorded.
4. **Schemes.** `resolveScheme(kit, scheme, usage?)` with contrast fixes, and `schemeSupport(kit)`. The starters' contrast helpers move into a shared module, with their behaviour unchanged.
5. **Type scale.** `typeScale(canvas, kit)` and `trackingPx(style, size)`.
6. **Enforcement.**
   - When `allowOffPalette` is false, shape fills, strokes, plates, icon colours and the canvas background clamp to the palette and the resolved roles, keeping alpha.
   - Add a synthetic `palette-enforcement` fixture. **Gate B.**
7. **Close-out:**
   - **Docs:** `TEMPLATE_SCHEMA.md`, `ARCHITECTURE.md`, `CEILING.md` ("Since Phase 5") and `PLAN.md`.
   - **Review:** run `phase-reviewer` and `fidelity-checker`.
   - **PR:** open the pull request.

## Deploy order

Saves write `system` as soon as a kit holds one, so migration 0052 must be applied in production before this phase merges. No function deploy is needed.

## Done when

- **Resolvers.** Roles, schemes, the type scale and enforcement are pure and tested.
- **Autosave.** A Brand Studio autosave keeps `system`.
- **Fixtures.**
  - With `allowOffPalette` off, the `palette-enforcement` fixture clamps every coloured surface.
  - Every other fixture is unchanged.
