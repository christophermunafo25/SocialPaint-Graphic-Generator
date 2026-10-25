---
name: brand-kit-change
description: The checklist for adding or changing anything stored on brand_kits, including the planned system column. Use whenever a phase changes BrandKit or the brand_kits table.
---

# Changing BrandKit

`BrandKit` is frozen. A change needs CJ's approval of its exact shape at the phase's recon gate. Once approved:

1. **Migration.** Additive, using the number reserved in `docs/brand-system/PLAN.md`. Backfill only when the phase prompt says so.
2. **Type.** The property on `BrandKit` in `src/lib/types.ts`. Absent keeps today's behavior.
3. **Rows.** `BrandKitRow` and `toBrandKitRow` in `src/lib/stores/supabase/rows.ts`.
4. **Store.** `SupabaseBrandKitStore.upsert` in `src/lib/stores/supabase/brandStore.ts` writes every column on every save, so the new column goes there too.
5. **Autosave.** `kitShape()` in `src/app/components/admin/brand/kitPlumbing.ts` builds the draft that every Brand Studio autosave writes, and Settings saves through it as well (`WorkspaceSection.tsx`). A field `kitShape` doesn't carry is reset on the next autosave; its comment on `allowStyleOverride` describes the trap.
6. **Local backend.** The brand kit paths in `src/lib/stores/local/` (`db.ts`, `localStores.ts`), and the screenshot fixture when screens show the new data.
7. **Readers.** Edge Functions that read `brand_kits`: `template-generate` (selects `colors, type_styles, guidelines`), `template-autobuild`, `public-template` and `_shared/publicTemplate.ts`. Update a select only when that function needs the new data.
8. **Tests.** Every pure resolver the change adds has tests.
