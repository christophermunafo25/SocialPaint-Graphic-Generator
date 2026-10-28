-- The brand's design system (brand-system Phase 5). Additive; a kit without
-- it reads and renders exactly as before.
--
-- system: one versioned jsonb for every pillar of the brand system, in the
-- single-blob pattern of templates.variants (0031) and layout_groups (0020):
-- { version: 1, color?: { roles?: { <role>: <palette key> }, neutrals? },
-- schemes?: { enabled?, preferred? }, type?: { ratio?, roles?: { <role>:
-- <type style key> } } }. It stores only what the admin decided; everything
-- unset is derived by the resolvers in src/lib/brand/system/ at read time.
-- Null means nothing decided yet. No backfill.
alter table brand_kits
  add column if not exists system jsonb;
