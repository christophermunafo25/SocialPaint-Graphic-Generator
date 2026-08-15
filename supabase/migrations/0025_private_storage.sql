-- Private storage: brand-assets and template-backgrounds stop being
-- world-readable. Reads become tenant-scoped; the client mints short-lived
-- signed URLs, and Storage's sign endpoint enforces the select policy below.
--
-- DEPLOY COUPLING: this migration breaks any client still calling
-- publicUrl() — push it in the same window as the signing-resolver app code,
-- db push first, app deploy immediately after.

-- ---------------------------------------------------------------------------
-- 1. Buckets → private. Metadata-only; existing objects are untouched.
-- ---------------------------------------------------------------------------

update storage.buckets set public = false
  where id in ('brand-assets', 'template-backgrounds');

-- ---------------------------------------------------------------------------
-- 2. Anonymous read goes away; reads become tenant-scoped, mirroring the
--    0006 write policies: a member reads objects whose first path segment
--    is a company they belong to.
--
--    One deliberate difference from the 0006 shape: the segment is compared
--    as TEXT instead of cast with ::uuid. A select policy is evaluated
--    against every row a storage query touches, and a single stray object
--    whose first folder isn't a valid UUID would make the cast THROW and
--    poison the whole query. Text comparison fails closed instead.
-- ---------------------------------------------------------------------------

drop policy if exists public_read_storage on storage.objects;

drop policy if exists tenant_read_storage on storage.objects;
create policy tenant_read_storage on storage.objects for select
  using (
    bucket_id in ('brand-assets', 'template-backgrounds')
    and (storage.foldername(name))[1] in (
      select c::text from current_company_ids() c
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Data rewrite: rows that persisted full public URLs (uploadBackground
--    callers, the figma-layers / figma-import / template-autobuild Edge
--    Functions, and duplicate()'s copy-by-resolved-URL) become
--    bucket-qualified storage references the signing resolver can parse:
--
--        https://<host>/storage/v1/object/public/<bucket>/<path>
--     →  <bucket>/<path>
--
--    The qualified form is unambiguous against bare paths because bare
--    paths start with a company UUID, never a bucket name.
--
--    Safety on existing data:
--      * bare-path rows (brand_assets, older template rows) don't match the
--        pattern — untouched;
--      * genuinely external URLs (a background re-hosted elsewhere) don't
--        match the two bucket names — untouched, and they keep working
--        since they were never behind these buckets;
--      * text static_values don't match — untouched;
--      * re-running is a no-op: a rewritten value no longer matches.
--
--    Paths never need URL-decoding: every upload path is sanitized to
--    [a-zA-Z0-9._-] segments before upload, so the public URL's path is
--    byte-identical to the stored object key.
-- ---------------------------------------------------------------------------

update templates
   set background_storage_path = regexp_replace(
         background_storage_path,
         '^https?://[^/]+/storage/v1/object/public/((brand-assets|template-backgrounds)/)',
         '\1')
 where background_storage_path
       ~ '^https?://[^/]+/storage/v1/object/public/(brand-assets|template-backgrounds)/';

update template_fields
   set static_value = regexp_replace(
         static_value,
         '^https?://[^/]+/storage/v1/object/public/((brand-assets|template-backgrounds)/)',
         '\1')
 where static_value
       ~ '^https?://[^/]+/storage/v1/object/public/(brand-assets|template-backgrounds)/';

update brand_assets
   set storage_path = regexp_replace(
         storage_path,
         '^https?://[^/]+/storage/v1/object/public/((brand-assets|template-backgrounds)/)',
         '\1')
 where storage_path
       ~ '^https?://[^/]+/storage/v1/object/public/(brand-assets|template-backgrounds)/';
