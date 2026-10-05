-- Font roles move onto type styles (new look, Phase 6; PHASE-6.md §9 D3).
--
-- One style is used for Heading and one for Body: type_styles[].useFor is
-- "heading", "body" or null. This is the client rule in
-- src/lib/brand/fontRoles.ts (migrateFontRoles), in SQL:
--
--  - only kits whose styles carry no useFor yet (it never runs twice);
--  - the styles keyed heading and body take those roles; every other style
--    gets useFor null;
--  - a style still on its default face (Google Montserrat for heading and
--    subhead, Google Inter for body) takes the account's chosen face
--    (heading_font for heading and subhead, body_font for body), when one is
--    set and differs; any other face is the admin's own and stays.
--
-- heading_font and body_font stay, unread, until Phase 9. Kits with no
-- styles are left alone: the app reads the defaults with the kit's faces.
-- Run scripts/brand/font-roles-dry-run.sql first; CJ reads its counts
-- before this runs on prod.

with pending as (
  select k.id, k.heading_font, k.body_font, k.type_styles
  from public.brand_kits k
  where jsonb_typeof(k.type_styles) = 'array'
    and jsonb_array_length(k.type_styles) > 0
    and not exists (
      select 1 from jsonb_array_elements(k.type_styles) e where e ? 'useFor'
    )
),
migrated as (
  select
    p.id,
    jsonb_agg(
      (
        case
          when e ->> 'key' in ('heading', 'subhead')
            and e -> 'font' ->> 'source' = 'google'
            and e -> 'font' ->> 'family' = 'Montserrat'
            and p.heading_font is not null
            and not (p.heading_font ->> 'source' = 'google'
                     and p.heading_font ->> 'family' = 'Montserrat')
            then e || jsonb_build_object('font', p.heading_font)
          when e ->> 'key' = 'body'
            and e -> 'font' ->> 'source' = 'google'
            and e -> 'font' ->> 'family' = 'Inter'
            and p.body_font is not null
            and not (p.body_font ->> 'source' = 'google'
                     and p.body_font ->> 'family' = 'Inter')
            then e || jsonb_build_object('font', p.body_font)
          else e
        end
      )
      || jsonb_build_object(
        'useFor',
        case when e ->> 'key' in ('heading', 'body') then to_jsonb(e ->> 'key') else 'null'::jsonb end
      )
      order by ord
    ) as type_styles
  from pending p,
    jsonb_array_elements(p.type_styles) with ordinality as t(e, ord)
  group by p.id
)
update public.brand_kits k
set type_styles = m.type_styles
from migrated m
where k.id = m.id;
