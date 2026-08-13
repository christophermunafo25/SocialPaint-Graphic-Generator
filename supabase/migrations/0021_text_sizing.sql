-- Text sizing: one explicit mode replaces the auto_fit / fixed_width boolean
-- pair. "shrink": the box is fixed and the font size decreases (measured)
-- until content fits. Null means "free": the font size is fixed and the box
-- grows with content. Both legacy flags map to "shrink" — that is what each
-- was reaching for; the sizing itself is now measured rather than estimated.
-- The old columns stay in place, unread, for rollback safety; a later
-- cleanup migration drops them.
alter table template_fields
  add column if not exists text_sizing text check (text_sizing in ('free', 'shrink'));

update template_fields
  set text_sizing = 'shrink'
  where text_sizing is null
    and (coalesce(auto_fit, false) or coalesce(fixed_width, false));

-- Brand type styles live in jsonb: every style's "autoFit": true becomes
-- "textSizing": "shrink" (and the legacy key is stripped either way).
update brand_kits
  set type_styles = (
    select coalesce(
      jsonb_agg(
        case
          when s ? 'autoFit' then
            (s - 'autoFit')
              || case
                   when (s ->> 'autoFit')::boolean then '{"textSizing": "shrink"}'::jsonb
                   else '{}'::jsonb
                 end
          else s
        end
        order by ord
      ),
      '[]'::jsonb
    )
    from jsonb_array_elements(type_styles) with ordinality as t(s, ord)
  )
  where exists (
    select 1 from jsonb_array_elements(type_styles) as s where s ? 'autoFit'
  );
