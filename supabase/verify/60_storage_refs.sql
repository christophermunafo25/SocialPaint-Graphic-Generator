-- Rows for the storage reference audit (storage_ref_audit.sql). run.sh runs
-- the audit after this and requires it to flag exactly the references planted
-- in company B's folder from company A's rows, and none of the legitimate
-- ones: every form the app has written (an explicit reference, a bare legacy
-- path, the legacy public URL, an upper-case company id), external and data
-- URLs, a text field's copy, and company B's own objects.
--
-- Seeds its own tenants, like 50_generate_threads.sql, so it does not depend
-- on what earlier files left behind.

\set ON_ERROR_STOP on

insert into companies (id, name, slug) values
  ('ca600000-0000-4000-8000-00000000000a', 'Refs A', 'refs-a'),
  ('cb600000-0000-4000-8000-00000000000b', 'Refs B', 'refs-b');

insert into templates (id, company_id, name, status, canvas_width, canvas_height,
                       background_storage_path, variants) values
  -- A's clean template: nothing here may be flagged.
  ('a6000000-0000-4000-8000-000000000001', 'ca600000-0000-4000-8000-00000000000a',
   'A clean', 'published', 1080, 1080,
   'template-backgrounds/ca600000-0000-4000-8000-00000000000a/1727500000000-bg.png',
   '[{"id": "v-dark", "name": "Dark",
      "backgroundUrl": "template-backgrounds/ca600000-0000-4000-8000-00000000000a/1727500000000-bg-dark.png",
      "overrides": {
        "logo": {"staticValue": "https://abcd1234.supabase.co/storage/v1/object/public/brand-assets/ca600000-0000-4000-8000-00000000000a/logo/1727500000000-logo-light.png"},
        "headline": {"staticValue": "Hello there"}}},
     {"id": "v-photo", "name": "Photo", "backgroundUrl": "https://images.example.com/bg.png"}]'),
  -- A's tampered template: every source names an object of B's.
  ('a6000000-0000-4000-8000-000000000002', 'ca600000-0000-4000-8000-00000000000a',
   'A tampered', 'published', 1080, 1080,
   'template-backgrounds/cb600000-0000-4000-8000-00000000000b/1727500000000-bg.png',
   '[{"id": "v-borrowed", "name": "Borrowed",
      "backgroundUrl": "template-backgrounds/cb600000-0000-4000-8000-00000000000b/1727500000000-bg-dark.png",
      "overrides": {
        "logo": {"staticValue": "brand-assets/cb600000-0000-4000-8000-00000000000b/logo/1727500000000-logo.png"}}}]'),
  -- B's own template, pointing at B's own objects: not flagged.
  ('b6000000-0000-4000-8000-000000000001', 'cb600000-0000-4000-8000-00000000000b',
   'B clean', 'published', 1080, 1080,
   'template-backgrounds/cb600000-0000-4000-8000-00000000000b/1727500000000-bg.png', null);

insert into template_fields (template_id, sort_order, field_key, label, type,
                             x, y, width, height, is_static, static_value, mask_url) values
  ('a6000000-0000-4000-8000-000000000001', 0, 'headline', 'Headline', 'text',
   0, 0, 100, 100, true, 'brand-assets is our new name', null),
  ('a6000000-0000-4000-8000-000000000001', 1, 'logo', 'Logo', 'image',
   0, 0, 100, 100, true, 'ca600000-0000-4000-8000-00000000000a/logo/1727500000000-logo.png', null),
  ('a6000000-0000-4000-8000-000000000001', 2, 'photo', 'Photo', 'image',
   0, 0, 100, 100, false, null,
   'template-backgrounds/ca600000-0000-4000-8000-00000000000a/masks/1727500000000-0.png'),
  ('a6000000-0000-4000-8000-000000000001', 3, 'badge', 'Badge', 'image',
   0, 0, 100, 100, true, 'brand-assets/CA600000-0000-4000-8000-00000000000A/logo/1727500000000-badge.png', null),
  ('a6000000-0000-4000-8000-000000000001', 4, 'hero', 'Hero', 'image',
   0, 0, 100, 100, true, 'https://cdn.example.com/hero.png', null),
  ('a6000000-0000-4000-8000-000000000001', 5, 'dot', 'Dot', 'image',
   0, 0, 100, 100, true, 'data:image/png;base64,AA', null),
  ('a6000000-0000-4000-8000-000000000002', 0, 'logo', 'Logo', 'image',
   0, 0, 100, 100, true,
   'brand-assets/ca600000-0000-4000-8000-00000000000a/logo/../../cb600000-0000-4000-8000-00000000000b/logo/1727500000000-logo.png',
   null),
  ('a6000000-0000-4000-8000-000000000002', 1, 'photo', 'Photo', 'image',
   0, 0, 100, 100, true,
   'brand-assets/cb600000-0000-4000-8000-00000000000b/image/1727500000000-photo.png',
   'template-backgrounds/cb600000-0000-4000-8000-00000000000b/masks/1727500000000-0.png'),
  ('b6000000-0000-4000-8000-000000000001', 0, 'logo', 'Logo', 'image',
   0, 0, 100, 100, true, 'brand-assets/cb600000-0000-4000-8000-00000000000b/logo/1727500000000-logo.png', null);

insert into brand_assets (company_id, kind, name, storage_path) values
  ('ca600000-0000-4000-8000-00000000000a', 'font', 'Own.woff2',
   'ca600000-0000-4000-8000-00000000000a/font/1727500000000-Own.woff2'),
  ('ca600000-0000-4000-8000-00000000000a', 'font', 'Borrowed.woff2',
   'cb600000-0000-4000-8000-00000000000b/font/1727500000000-Borrowed.woff2'),
  -- Not a font, so no public link signs it: not the audit's business.
  ('ca600000-0000-4000-8000-00000000000a', 'logo', 'Theirs.png',
   'cb600000-0000-4000-8000-00000000000b/logo/1727500000000-Theirs.png'),
  ('cb600000-0000-4000-8000-00000000000b', 'font', 'B.woff2',
   'cb600000-0000-4000-8000-00000000000b/font/1727500000000-B.woff2');
