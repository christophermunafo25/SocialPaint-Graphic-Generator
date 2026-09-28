-- Storage references outside their company's folder. Read-only: one SELECT,
-- nothing created, nothing written, so it is safe to run against production
-- (psql against the project's connection string, or paste it into the SQL
-- editor). run.sh also runs it against seeded rows (60_storage_refs.sql).
--
-- Every row it returns is a value a public link could ask the service role
-- to sign (a template background, an image field's fixed image or mask, a
-- variation's background or image swap, an uploaded font file) that does not
-- sit under "{bucket}/{company_id}/". The public-template function refuses a
-- link whose template holds one (_shared/publicTemplate.ts payloadAssetRefs),
-- so each row here is a template whose public links 404. The app never writes
-- such a value, so a row here was written around the app, and is worth a
-- look at whose objects it names.
--
-- The check mirrors isCompanyStorageRef in _shared/validate.ts: the bucket,
-- then the company id (either case), then one or more segments of
-- [A-Za-z0-9._-] that are not dots alone. References resolve the way
-- refWithImpliedBucket in _shared/publicLink.ts resolves them: an explicit
-- bucket prefix, the legacy public URL, or a bare path under the column's
-- implied bucket. External and data URLs are not storage and are skipped.
-- It reads every variation, served or not, so it is a superset of what any
-- one link signs.

with variants as (
  select t.id as template_id, t.company_id, v
    from templates t
   cross join lateral jsonb_array_elements(
     case jsonb_typeof(t.variants) when 'array' then t.variants else '[]'::jsonb end) v
),
refs (company_id, template_id, source, implied_bucket, value) as (
  select t.company_id, t.id, 'background', 'template-backgrounds', t.background_storage_path
    from templates t
  union all
  select t.company_id, t.id, 'image ' || f.field_key, 'brand-assets', f.static_value
    from template_fields f
    join templates t on t.id = f.template_id
   where f.type = 'image'
  union all
  select t.company_id, t.id, 'mask ' || f.field_key, 'template-backgrounds', f.mask_url
    from template_fields f
    join templates t on t.id = f.template_id
   where f.type = 'image'
  union all
  select company_id, template_id, 'variation background', 'template-backgrounds',
         v ->> 'backgroundUrl'
    from variants
   where jsonb_typeof(v -> 'backgroundUrl') = 'string'
  union all
  -- Only an image field's override names an object; a text field's
  -- staticValue is copy.
  select vr.company_id, vr.template_id, 'variation image ' || o.key, 'brand-assets',
         o.value ->> 'staticValue'
    from variants vr
   cross join lateral jsonb_each(
     case jsonb_typeof(vr.v -> 'overrides') when 'object' then vr.v -> 'overrides'
          else '{}'::jsonb end) o
    join template_fields f
      on f.template_id = vr.template_id and f.field_key = o.key and f.type = 'image'
   where jsonb_typeof(o.value -> 'staticValue') = 'string'
  union all
  select a.company_id, null, 'font ' || a.name, 'brand-assets', a.storage_path
    from brand_assets a
   where a.kind = 'font'
),
resolved as (
  select refs.*,
         case
           when value ~ '^(brand-assets|template-backgrounds)/' then value
           when value ~ '^https?://[^/]+/storage/v1/object/public/(brand-assets|template-backgrounds)/.'
             then regexp_replace(value, '^https?://[^/]+/storage/v1/object/public/', '')
           when value ~ '^(https?|data|blob):' then null
           else implied_bucket || '/' || value
         end as ref
    from refs
   where coalesce(value, '') <> ''
)
select company_id, template_id, source, value
  from resolved
 where ref is not null
   and ref !~* ('^(brand-assets|template-backgrounds)/' || company_id::text
                || '(/[A-Za-z0-9._-]*[A-Za-z0-9_-][A-Za-z0-9._-]*)+$')
 order by company_id, template_id nulls last, source, value;
