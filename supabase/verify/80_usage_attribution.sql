-- Member attribution on usage events (0044; PHASE-8.md §9 D2): a member's
-- event inserted without a user comes back as theirs, one that names its
-- user keeps it, and a public-link event stays unattributed. The local dev
-- backend never runs this trigger, so this is where it is checked.

\set ON_ERROR_STOP on
\pset pager off

insert into auth.users (id, email) values
  ('aa800000-0000-4000-8000-00000000000a', 'usage-admin-a@example.com'),
  ('aa800000-0000-4000-8000-00000000000b', 'usage-member-a@example.com');

insert into companies (id, name, slug) values
  ('ca800000-0000-4000-8000-00000000000a', 'Usage A', 'usage-a');

insert into memberships (user_id, company_id, role) values
  ('aa800000-0000-4000-8000-00000000000a', 'ca800000-0000-4000-8000-00000000000a', 'admin'),
  ('aa800000-0000-4000-8000-00000000000b', 'ca800000-0000-4000-8000-00000000000a', 'member');

insert into templates (id, company_id, name, status, canvas_width, canvas_height) values
  ('11800000-0000-4000-8000-00000000000a', 'ca800000-0000-4000-8000-00000000000a',
   'Usage template', 'published', 1080, 1080);

\echo ''
\echo '=== MEMBER EVENTS CARRY THEIR MEMBER ==='

-- The fill page's insert, as the browser makes it: no user_id.
set role authenticated;
set request.jwt.claim.sub = 'aa800000-0000-4000-8000-00000000000b';
insert into usage_events (company_id, template_id, action)
  values ('ca800000-0000-4000-8000-00000000000a', '11800000-0000-4000-8000-00000000000a', 'open');
-- A caller that names its own user keeps it.
insert into usage_events (company_id, template_id, action, user_id)
  values ('ca800000-0000-4000-8000-00000000000a', '11800000-0000-4000-8000-00000000000a',
          'download', 'aa800000-0000-4000-8000-00000000000b');
reset role;
reset request.jwt.claim.sub;

-- A public link's event, as the Edge Function writes it under the service
-- key (no session, so auth.uid() is null).
insert into usage_events (company_id, template_id, action, actor)
  values ('ca800000-0000-4000-8000-00000000000a', '11800000-0000-4000-8000-00000000000a',
          'open', 'public');

do $$
begin
  perform assert_that('a member''s event inserted without a user comes back attributed',
    (select user_id from usage_events
      where company_id = 'ca800000-0000-4000-8000-00000000000a'
        and action = 'open' and actor = 'member')
      = 'aa800000-0000-4000-8000-00000000000b');
  perform assert_that('an event that names its user keeps it',
    (select user_id from usage_events
      where company_id = 'ca800000-0000-4000-8000-00000000000a' and action = 'download')
      = 'aa800000-0000-4000-8000-00000000000b');
  perform assert_that('a public event stays unattributed',
    (select user_id is null from usage_events
      where company_id = 'ca800000-0000-4000-8000-00000000000a' and actor = 'public'));
end $$;

-- The insert policy still refuses a member naming someone else.
set role authenticated;
set request.jwt.claim.sub = 'aa800000-0000-4000-8000-00000000000b';
do $$
begin
  begin
    insert into usage_events (company_id, template_id, action, user_id)
      values ('ca800000-0000-4000-8000-00000000000a', '11800000-0000-4000-8000-00000000000a',
              'open', 'aa800000-0000-4000-8000-00000000000a');
    raise exception 'FAIL: a member recorded an event as another member';
  exception when insufficient_privilege then
    raise notice 'pass  a member still cannot record an event as someone else';
  end;
end $$;
reset role;
reset request.jwt.claim.sub;
