-- Settings & Admin (0028): the workspace-update role check, canvas preset
-- scoping, notification-pref self-scoping, and the slug availability RPC —
-- against the real policies, applied from the real migrations.
--
-- 20_checks.sql ends by deleting the seeded tenants to prove the cascades,
-- so this file seeds its own two companies rather than borrowing rows that
-- are no longer there.

\set ON_ERROR_STOP on
\pset pager off

-- The opt-out rows point at catalogue ids that live in code since 0029
-- (SIZE_CATALOG in src/lib/templates/platforms.ts); there is no preset
-- table to seed.

insert into auth.users (id, email) values
  ('aa100000-0000-4000-8000-00000000000a', 'settings-admin-a@example.com'),
  ('aa100000-0000-4000-8000-00000000000b', 'settings-member-a@example.com'),
  ('bb100000-0000-4000-8000-00000000000a', 'settings-admin-b@example.com');

insert into companies (id, name, slug) values
  ('ca100000-0000-4000-8000-00000000000a', 'Settings A', 'settings-a'),
  ('cb100000-0000-4000-8000-00000000000b', 'Settings B', 'settings-b');

insert into memberships (user_id, company_id, role) values
  ('aa100000-0000-4000-8000-00000000000a', 'ca100000-0000-4000-8000-00000000000a', 'admin'),
  ('aa100000-0000-4000-8000-00000000000b', 'ca100000-0000-4000-8000-00000000000a', 'member'),
  ('bb100000-0000-4000-8000-00000000000a', 'cb100000-0000-4000-8000-00000000000b', 'admin');

\echo ''
\echo '=== COMPANY UPDATE: ADMINS ONLY ==='

-- A member of company A: their update must match zero rows — RLS filters
-- the row out of the UPDATE entirely, so nothing changes and nothing errors.
set role authenticated;
set request.jwt.claim.sub = 'aa100000-0000-4000-8000-00000000000b';
update companies set name = 'Hijacked' where id = 'ca100000-0000-4000-8000-00000000000a';
reset role;
reset request.jwt.claim.sub;
do $$
begin
  perform assert_that('a member''s company update changes nothing',
    (select name from companies where id = 'ca100000-0000-4000-8000-00000000000a')
      = 'Settings A');
end $$;

-- An admin of company B must not reach company A either.
set role authenticated;
set request.jwt.claim.sub = 'bb100000-0000-4000-8000-00000000000a';
update companies set name = 'Cross-tenant' where id = 'ca100000-0000-4000-8000-00000000000a';
reset role;
reset request.jwt.claim.sub;
do $$
begin
  perform assert_that('another company''s admin cannot update it',
    (select name from companies where id = 'ca100000-0000-4000-8000-00000000000a')
      = 'Settings A');
end $$;

-- The company's own admin can, including the new settings columns.
set role authenticated;
set request.jwt.claim.sub = 'aa100000-0000-4000-8000-00000000000a';
update companies
   set name = 'Settings A renamed', timezone = 'America/New_York',
       link_default_expiry_days = 30
 where id = 'ca100000-0000-4000-8000-00000000000a';
reset role;
reset request.jwt.claim.sub;
do $$
begin
  perform assert_that('the company''s own admin updates it',
    (select name from companies where id = 'ca100000-0000-4000-8000-00000000000a')
      = 'Settings A renamed');
  perform assert_that('timezone and link defaults persist',
    (select timezone = 'America/New_York' and link_default_expiry_days = 30
       from companies where id = 'ca100000-0000-4000-8000-00000000000a'));
end $$;

\echo ''
\echo '=== SLUG AVAILABILITY ==='

set role authenticated;
set request.jwt.claim.sub = 'aa100000-0000-4000-8000-00000000000a';
do $$
begin
  perform assert_that('another tenant''s slug reads as taken',
    slug_available('settings-b', 'ca100000-0000-4000-8000-00000000000a') = false);
  perform assert_that('the company''s own slug reads as available to itself',
    slug_available('settings-a', 'ca100000-0000-4000-8000-00000000000a') = true);
  perform assert_that('an unused slug is available',
    slug_available('brand-new-workspace', 'ca100000-0000-4000-8000-00000000000a') = true);
end $$;
reset role;
reset request.jwt.claim.sub;

\echo ''
\echo '=== CANVAS PRESET OPT-OUTS ==='

set role authenticated;
set request.jwt.claim.sub = 'aa100000-0000-4000-8000-00000000000b';
do $$
declare blocked boolean;
begin
  begin
    insert into company_canvas_presets (company_id, preset_id, enabled)
    values ('ca100000-0000-4000-8000-00000000000a', 'square-1440', false);
    blocked := false;
  exception when insufficient_privilege then blocked := true;
  end;
  perform assert_that('a member cannot write canvas preset opt-outs', blocked);
end $$;
reset role;
reset request.jwt.claim.sub;

set role authenticated;
set request.jwt.claim.sub = 'aa100000-0000-4000-8000-00000000000a';
insert into company_canvas_presets (company_id, preset_id, enabled)
values ('ca100000-0000-4000-8000-00000000000a', 'square-1440', false);
reset role;
reset request.jwt.claim.sub;

set role authenticated;
set request.jwt.claim.sub = 'aa100000-0000-4000-8000-00000000000b';
do $$
begin
  perform assert_that('a member reads their company''s opt-outs (size picker)',
    (select count(*) from company_canvas_presets
      where company_id = 'ca100000-0000-4000-8000-00000000000a') = 1);
end $$;
reset role;
reset request.jwt.claim.sub;

set role authenticated;
set request.jwt.claim.sub = 'bb100000-0000-4000-8000-00000000000a';
do $$
begin
  perform assert_that('another tenant sees none of them',
    (select count(*) from company_canvas_presets) = 0);
end $$;
reset role;
reset request.jwt.claim.sub;

\echo ''
\echo '=== NOTIFICATION PREFS: SELF-SCOPED ==='

set role authenticated;
set request.jwt.claim.sub = 'aa100000-0000-4000-8000-00000000000b';
insert into user_notification_prefs (user_id, weekly_digest)
values ('aa100000-0000-4000-8000-00000000000b', false);
do $$
declare blocked boolean;
begin
  perform assert_that('a user reads their own prefs',
    (select weekly_digest from user_notification_prefs
      where user_id = 'aa100000-0000-4000-8000-00000000000b') = false);
  begin
    insert into user_notification_prefs (user_id)
    values ('aa100000-0000-4000-8000-00000000000a');
    blocked := false;
  exception when insufficient_privilege then blocked := true;
  end;
  perform assert_that('a user cannot write another user''s prefs', blocked);
end $$;
reset role;
reset request.jwt.claim.sub;

-- Not even the company admin reads a member's notification choices.
set role authenticated;
set request.jwt.claim.sub = 'aa100000-0000-4000-8000-00000000000a';
do $$
begin
  perform assert_that('an admin sees no other user''s prefs',
    (select count(*) from user_notification_prefs) = 0);
end $$;
reset role;
reset request.jwt.claim.sub;

\echo ''
\echo '=== DELETE CASCADE COVERS THE NEW TABLES ==='

do $$
begin
  delete from companies where id = 'ca100000-0000-4000-8000-00000000000a';
  perform assert_that('deleting a company removes its canvas opt-outs',
    (select count(*) from company_canvas_presets
      where company_id = 'ca100000-0000-4000-8000-00000000000a') = 0);
  perform assert_that('notification prefs are user-scoped and survive it',
    (select count(*) from user_notification_prefs
      where user_id = 'aa100000-0000-4000-8000-00000000000b') = 1);
end $$;
