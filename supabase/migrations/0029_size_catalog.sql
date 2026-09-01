-- The size catalogue moves into code: SIZE_CATALOG in
-- src/lib/templates/platforms.ts is now the single source of dimension data,
-- carrying the platform mapping and asset-type naming the old canvas_presets
-- rows never had. The database keeps exactly one job — recording which
-- catalogue sizes a workspace turned OFF — so company_canvas_presets stays,
-- re-keyed to catalogue ids, and canvas_presets is retired.

-- 1. Free preset_id from the table being dropped. The column keeps holding
--    ids; they now reference SIZE_CATALOG entries in code.
alter table company_canvas_presets
  drop constraint company_canvas_presets_preset_id_fkey;

-- 2. Re-key existing opt-out rows from the five seeded preset ids to their
--    catalogue equivalents. The new ids could not exist yet (the FK forbade
--    them), so this cannot collide with the primary key.
update company_canvas_presets set preset_id = case preset_id
    when 'square-1440'   then 'general-square-1440'
    when 'ig-post-1080'  then 'ig-square-1080x1080'
    when 'ig-story-1080' then 'ig-story-1080x1920'
    when 'fb-post-1200'  then 'fb-link-1200x630'
    when 'li-post-1200'  then 'li-landscape-1200x627'
    else preset_id
  end
  where preset_id in
    ('square-1440', 'ig-post-1080', 'ig-story-1080', 'fb-post-1200', 'li-post-1200');

-- 3. Nothing reads canvas_presets anymore (its policies go with it).
drop table canvas_presets;
