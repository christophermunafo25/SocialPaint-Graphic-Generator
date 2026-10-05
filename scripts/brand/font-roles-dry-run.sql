-- Dry run for supabase/migrations/0042_font_roles_on_type_styles.sql
-- (PHASE-6.md §9 D3). Read only: what the migration would change, for the
-- active kits (the ones the app reads; the migration updates every kit).
--
--   kits_pending      kits whose styles get roles (no useFor yet)
--   styles_restyled   styles whose face changes to the account's chosen face
--   kits_restyled     kits with at least one restyled style
--   fields_restyled   template fields bound to a restyled style: the fields
--                     that will render in a new face
--   templates_restyled  templates holding those fields

with pending as (
  select k.id, k.company_id, k.heading_font, k.body_font, k.type_styles
  from public.brand_kits k
  where k.is_active
    and jsonb_typeof(k.type_styles) = 'array'
    and jsonb_array_length(k.type_styles) > 0
    and not exists (
      select 1 from jsonb_array_elements(k.type_styles) e where e ? 'useFor'
    )
),
restyled as (
  select p.id as kit_id, p.company_id, e ->> 'key' as style_key
  from pending p, jsonb_array_elements(p.type_styles) e
  where (
      e ->> 'key' in ('heading', 'subhead')
      and e -> 'font' ->> 'source' = 'google'
      and e -> 'font' ->> 'family' = 'Montserrat'
      and p.heading_font is not null
      and not (p.heading_font ->> 'source' = 'google' and p.heading_font ->> 'family' = 'Montserrat')
    ) or (
      e ->> 'key' = 'body'
      and e -> 'font' ->> 'source' = 'google'
      and e -> 'font' ->> 'family' = 'Inter'
      and p.body_font is not null
      and not (p.body_font ->> 'source' = 'google' and p.body_font ->> 'family' = 'Inter')
    )
),
fields as (
  select f.id, f.template_id
  from public.template_fields f
  join public.templates t on t.id = f.template_id
  join restyled r on r.company_id = t.company_id and r.style_key = f.type_style_key
)
select
  (select count(*) from pending) as kits_pending,
  (select count(*) from restyled) as styles_restyled,
  (select count(distinct kit_id) from restyled) as kits_restyled,
  (select count(*) from fields) as fields_restyled,
  (select count(distinct template_id) from fields) as templates_restyled;
