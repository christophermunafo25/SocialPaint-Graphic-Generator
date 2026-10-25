---
name: field-property
description: The end-to-end checklist for adding or changing a TemplateField property (column, types, stores, renderer, builder, variants, import, docs, fixtures). Use whenever a phase adds or changes a property on template fields.
---

# Adding a TemplateField property

`TemplateField` is frozen. A new property needs CJ's approval of its exact shape at the phase's recon gate. Once approved, wire it everywhere the text plate properties from migration 0035 went. That change touched `types.ts`, `rows.ts`, `SchemaRenderer.tsx`, `layout.ts`, `FieldInspector.tsx`, `FieldOverlayEditor.tsx`, `fieldOps.ts`, `variants.ts`, the starters and `extract.ts`.

1. **Migration.** `supabase/migrations/00NN_<name>.sql`, using the number reserved in `docs/brand-system/PLAN.md`: nullable columns on `template_fields`, with a header comment in the style of 0034 and 0035.
2. **Type.** The property on `TemplateField` in `src/lib/types.ts`, with a doc comment saying what absent means. Absent renders exactly as today.
3. **Rows.** In `src/lib/stores/supabase/rows.ts`: the row type, `toTemplateField` (row to field) and `fieldToRow` (field to row), plus a case in `rows.test.ts`.
4. **Variants.** Classify the key in `src/lib/templates/variants.ts`. Its compile-time check fails until every `TemplateField` key is either structural or a `VariantFieldOverride` key. Add it to `VariantFieldOverride` only when a colourway may change it.
5. **Renderer.** Paint it in `src/app/components/SchemaRenderer.tsx`, and measure it in `src/lib/render/layout.ts` when it changes the painted box.
6. **Builder.** The control in `FieldInspector.tsx`, the operations in `fieldOps.ts`, and `FieldOverlayEditor.tsx`. That file contains a NUL byte, so search it with `grep -a`.
7. **Starters.** `src/lib/templates/starters/` when blueprints should use it.
8. **Import.** `supabase/functions/_shared/extract.ts` when Figma has the property, then `npm run typecheck:deno`.
9. **The hand-kept lists the steps above miss** (found in brand-system Phase 1):
   - `src/lib/templates/rescale.ts` (`scaleFieldType`) when the property holds px lengths, including inside variation overrides; its completeness test fails until the key is classified.
   - `src/app/components/builder/fieldOps.ts` style copy lists (`TEXT_STYLE_PROPS`, `IMAGE_STYLE_PROPS`, `SHAPE_STYLE_PROPS`) when it is a look.
   - `supabase/functions/_shared/publicTemplate.ts`: its own `VARIANT_OVERRIDE_KEYS` copy when it is overridable, and the template allowlist plus `supabase/functions/public-template/index.ts`'s select for a new `templates` column.
   - `supabase/functions/_shared/autobuildValidate.ts` (`ValidatedField`) when the importer or autobuild should carry it.
   - `src/lib/stores/supabase/templateStore.ts` create and update for a new `templates` column.
   - Write a new column only when it is set (`fieldToRow`, the store), so saves keep working if the app ships before the migration.
10. **Docs.** `docs/TEMPLATE_SCHEMA.md`.
11. **Fixture.** A fidelity fixture that exercises the property, passing on all three engines.
