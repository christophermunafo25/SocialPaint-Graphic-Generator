-- Phase 8: lifecycle and isolation, against the real migrations, the real
-- policies, and the real gate function.

\set ON_ERROR_STOP on
\pset pager off

create or replace function assert_that(label text, actual boolean) returns void
  language plpgsql as $$
begin
  if actual is not true then
    raise exception 'FAIL: %', label;
  end if;
  raise notice 'pass  %', label;
end $$;

create or replace function lookup(tok text, consume boolean default true) returns jsonb
  language sql as $$ select public_link_lookup(encode(sha256(tok::bytea), 'hex'), consume) $$;

\echo ''
\echo '=== LIFECYCLE ==='

do $$
declare r jsonb;
begin
  -- A live token resolves to exactly one link and one template.
  r := lookup('token-a');
  perform assert_that('live token resolves', r is not null);
  perform assert_that('resolves to the right link',
    r ->> 'link_id' = '1a000000-0000-4000-8000-000000000001');
  perform assert_that('resolves to the right template',
    r ->> 'template_id' = '11111111-0000-4000-8000-00000000000a');
  perform assert_that('carries the company for server-side queries only',
    r ->> 'company_id' = 'c0000000-0000-4000-8000-00000000000a');
  perform assert_that('does not leak the use count to the caller',
    not (r ? 'use_count'));
  perform assert_that('an open is counted',
    (select use_count from template_links where id = '1a000000-0000-4000-8000-000000000001') = 1);
  perform assert_that('last used is stamped',
    (select last_used_at is not null from template_links
      where id = '1a000000-0000-4000-8000-000000000001'));

  -- Revoked.
  perform assert_that('a revoked token is refused', lookup('token-revoked') is null);

  -- Expired.
  perform assert_that('an expired token is refused', lookup('token-expired') is null);

  -- Cap. Two uses allowed, the third refused.
  perform assert_that('capped link: first use allowed', lookup('token-capped') is not null);
  perform assert_that('capped link: second use allowed', lookup('token-capped') is not null);
  perform assert_that('capped link: third use refused', lookup('token-capped') is null);
  perform assert_that('a refused open does not increment past the cap',
    (select use_count from template_links where id = '1a000000-0000-4000-8000-000000000004') = 2);

  -- Draft template.
  perform assert_that('a link to an unpublished template is refused', lookup('token-draft') is null);

  -- Unpublish a template that HAS a working link.
  update templates set status = 'draft' where id = '11111111-0000-4000-8000-00000000000a';
  perform assert_that('unpublishing disables every link to the template immediately',
    lookup('token-a') is null);
  update templates set status = 'published' where id = '11111111-0000-4000-8000-00000000000a';
  perform assert_that('republishing brings its links back', lookup('token-a') is not null);

  -- The download endpoint resolves without claiming a use.
  update template_links set use_count = 0, use_cap = 1
   where id = '1a000000-0000-4000-8000-000000000001';
  perform assert_that('a download event resolves the link',
    lookup('token-a', false) is not null);
  perform assert_that('a download event does not eat a use',
    (select use_count from template_links where id = '1a000000-0000-4000-8000-000000000001') = 0);
  update template_links set use_cap = null
   where id = '1a000000-0000-4000-8000-000000000001';
end $$;

\echo ''
\echo '=== TOKEN REFUSAL IS UNIFORM ==='

do $$
declare wrong text[] := array[
    'token-a-but-wrong',            -- one character off a live token
    'token-A',                      -- case flipped
    '',                             -- empty
    'not-a-token-at-all',           -- random
    '../../etc/passwd',             -- path traversal shaped
    ''' or 1=1 --',                 -- injection shaped
    repeat('x', 4096)               -- oversized
  ];
  t text;
begin
  foreach t in array wrong loop
    perform assert_that(format('refused, and identically to a revoked one: %L', left(t, 24)),
      lookup(t) is null);
  end loop;

  -- The refusal from a revoked token and from one that never existed are the
  -- SAME value. There is nothing here for a prober to tell apart.
  perform assert_that('revoked and never-existed are the same answer',
    lookup('token-revoked') is not distinct from lookup('never-existed'));
end $$;

\echo ''
\echo '=== ISOLATION: ONE LINK REACHES ONE TEMPLATE ==='

do $$
declare r jsonb;
begin
  r := lookup('token-a');
  perform assert_that('company A''s token never names company B''s template',
    r ->> 'template_id' <> '22222222-0000-4000-8000-00000000000a');
  perform assert_that('company A''s token never names company B''s company id',
    r ->> 'company_id' <> 'c0000000-0000-4000-8000-00000000000b');

  r := lookup('token-b');
  perform assert_that('company B''s token reaches only company B',
    r ->> 'company_id' = 'c0000000-0000-4000-8000-00000000000b');

  -- The function takes a hash and nothing else. There is no id, no company,
  -- and no filter a caller could steer — which is the point.
  perform assert_that('the gate accepts exactly two arguments, one of them a hash',
    (select count(*) from information_schema.parameters
      where specific_name in (
        select specific_name from information_schema.routines
         where routine_name = 'public_link_lookup')
        and parameter_mode = 'IN') = 2);
end $$;

\echo ''
\echo '=== ISOLATION: RLS DENIES EVERY CLIENT ROLE ==='

do $$
declare n int;
begin
  perform assert_that('template_links has RLS enabled',
    (select relrowsecurity from pg_class where relname = 'template_links'));
  perform assert_that('template_link_events has RLS enabled',
    (select relrowsecurity from pg_class where relname = 'template_link_events'));
  perform assert_that('rate_limit_counters has RLS enabled',
    (select relrowsecurity from pg_class where relname = 'rate_limit_counters'));
  perform assert_that('rate_limit_counters has no policy at all — service role only',
    (select count(*) from pg_policies where tablename = 'rate_limit_counters') = 0);
  perform assert_that('template_links has no write policy for any client',
    (select count(*) from pg_policies
      where tablename = 'template_links' and cmd <> 'SELECT') = 0);
  perform assert_that('no client role may read the token hash column',
    not has_column_privilege('authenticated', 'template_links', 'token_hash', 'select')
    and not has_column_privilege('anon', 'template_links', 'token_hash', 'select'));
  perform assert_that('an admin can still read the columns the UI needs',
    has_column_privilege('authenticated', 'template_links', 'use_count', 'select'));

  -- The security-definer functions must not be callable over PostgREST.
  perform assert_that('anon cannot execute the gate',
    not has_function_privilege('anon', 'public_link_lookup(text, boolean)', 'execute'));
  perform assert_that('authenticated cannot execute the gate',
    not has_function_privilege('authenticated', 'public_link_lookup(text, boolean)', 'execute'));
  perform assert_that('anon cannot execute the rate limiter',
    not has_function_privilege('anon', 'consume_rate_limit(text, int, int)', 'execute'));
  perform assert_that('the service role can execute the gate',
    has_function_privilege('service_role', 'public_link_lookup(text, boolean)', 'execute'));
end $$;

-- Anonymous: no JWT at all. Two shapes of denial, and both count.
set role anon;
do $$
declare denied boolean;
begin
  -- template_links is denied at the GRANT level, before RLS is even
  -- consulted — anon holds no privilege on the table at all.
  begin
    perform count(*) from template_links;
    denied := false;
  exception when insufficient_privilege then denied := true;
  end;
  perform assert_that('anon is refused the link table outright', denied);

  -- Everywhere else the grant exists and RLS filters it to nothing, which is
  -- the same answer by a different route.
  perform assert_that('anon reads no link audit events',
    (select count(*) from template_link_events) = 0);
  perform assert_that('anon reads no templates', (select count(*) from templates) = 0);
  perform assert_that('anon reads no companies', (select count(*) from companies) = 0);
  perform assert_that('anon reads no brand kits', (select count(*) from brand_kits) = 0);
  perform assert_that('anon reads no usage', (select count(*) from usage_events) = 0);
end $$;
reset role;

-- A member of company A — not an admin.
set role authenticated;
set request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000b';
do $$
begin
  perform assert_that('a member of the company still sees no links',
    (select count(*) from template_links) = 0);
end $$;
reset role;

-- An admin of company A.
set role authenticated;
set request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';
do $$
begin
  perform assert_that('an admin sees their own template''s links',
    (select count(*) from template_links) = 5);
  perform assert_that('an admin sees NONE of the other company''s links',
    (select count(*) from template_links
      where id = '2b000000-0000-4000-8000-000000000001') = 0);
end $$;
reset role;
reset request.jwt.claim.sub;

\echo ''
\echo '=== ANALYTICS: A MEMBER CANNOT FORGE PUBLIC TRAFFIC ==='

set role authenticated;
set request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000b';
do $$
declare blocked boolean;
begin
  -- A member's own event is fine.
  insert into usage_events (company_id, template_id, action, user_id, actor)
  values ('c0000000-0000-4000-8000-00000000000a', '11111111-0000-4000-8000-00000000000a',
          'download', 'a0000000-0000-4000-8000-00000000000b', 'member');
  perform assert_that('a member records their own download', true);

  -- Claiming to be public traffic is refused.
  begin
    insert into usage_events (company_id, template_id, action, actor)
    values ('c0000000-0000-4000-8000-00000000000a', '11111111-0000-4000-8000-00000000000a',
            'download', 'public');
    blocked := false;
  exception when insufficient_privilege then blocked := true;
  end;
  perform assert_that('a member cannot write a row claiming to be public traffic', blocked);

  -- Attaching someone else's link is refused.
  begin
    insert into usage_events (company_id, template_id, action, actor, link_id)
    values ('c0000000-0000-4000-8000-00000000000a', '11111111-0000-4000-8000-00000000000a',
            'download', 'member', '1a000000-0000-4000-8000-000000000001');
    blocked := false;
  exception when insufficient_privilege then blocked := true;
  end;
  perform assert_that('a member cannot attribute their event to a public link', blocked);
end $$;
reset role;
reset request.jwt.claim.sub;

\echo ''
\echo '=== RATE LIMITER ==='

do $$
declare allowed int := 0; refused int := 0; i int;
begin
  for i in 1..10 loop
    if consume_rate_limit('verify:key', 6, 60) then allowed := allowed + 1;
    else refused := refused + 1; end if;
  end loop;
  perform assert_that('the limiter allows exactly the limit', allowed = 6);
  perform assert_that('and refuses everything past it', refused = 4);
  perform assert_that('a different key has its own budget',
    consume_rate_limit('verify:other', 6, 60));
  perform assert_that('an opaque key is all that is stored — no address',
    (select count(*) from rate_limit_counters where bucket_key like '%.%.%.%') = 0);

  -- A stale window is swept on the next new key.
  insert into rate_limit_counters (bucket_key, window_start, count)
  values ('verify:ancient', now() - interval '3 days', 1);
  perform consume_rate_limit('verify:sweep-trigger', 10, 60);
  perform assert_that('windows older than a day are swept away',
    (select count(*) from rate_limit_counters where bucket_key = 'verify:ancient') = 0);
end $$;

\echo ''
\echo '=== CASCADES: NOTHING IS ORPHANED ==='

do $$
declare before_links int; before_events int;
begin
  insert into template_link_events (link_id, company_id, action, actor_id)
  values ('1a000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-00000000000a',
          'created', 'a0000000-0000-4000-8000-00000000000a');
  insert into usage_events (company_id, template_id, action, actor, link_id)
  values ('c0000000-0000-4000-8000-00000000000a', '11111111-0000-4000-8000-00000000000a',
          'open', 'public', '1a000000-0000-4000-8000-000000000001');

  -- Deleting a LINK keeps the counts but drops the attribution.
  select count(*) into before_events from usage_events where link_id is not null;
  perform assert_that('a public usage row exists to test with', before_events = 1);
  delete from template_links where id = '1a000000-0000-4000-8000-000000000004';
  perform assert_that('deleting a link removes its audit rows',
    (select count(*) from template_link_events
      where link_id = '1a000000-0000-4000-8000-000000000004') = 0);

  -- Deleting a TEMPLATE takes its links with it.
  delete from templates where id = '11111111-0000-4000-8000-00000000000a';
  perform assert_that('deleting a template removes every link to it',
    (select count(*) from template_links
      where template_id = '11111111-0000-4000-8000-00000000000a') = 0);
  perform assert_that('and every audit row for those links',
    (select count(*) from template_link_events
      where link_id = '1a000000-0000-4000-8000-000000000001') = 0);
  perform assert_that('and its usage rows',
    (select count(*) from usage_events
      where template_id = '11111111-0000-4000-8000-00000000000a') = 0);
  perform assert_that('a deleted template''s token is dead', lookup('token-a') is null);

  -- Deleting a COMPANY takes everything.
  delete from companies where id = 'c0000000-0000-4000-8000-00000000000a';
  perform assert_that('deleting a company removes its templates',
    (select count(*) from templates
      where company_id = 'c0000000-0000-4000-8000-00000000000a') = 0);
  perform assert_that('and every link under them',
    (select count(*) from template_links l
      join templates t on t.id = l.template_id
     where t.company_id = 'c0000000-0000-4000-8000-00000000000a') = 0);
  perform assert_that('and its link audit trail',
    (select count(*) from template_link_events
      where company_id = 'c0000000-0000-4000-8000-00000000000a') = 0);
  perform assert_that('leaving no link row pointing at a missing template',
    (select count(*) from template_links l
      left join templates t on t.id = l.template_id where t.id is null) = 0);

  -- The other tenant is untouched throughout.
  perform assert_that('company B is entirely unaffected', lookup('token-b') is not null);

  -- Deleting a USER leaves links standing, unattributed.
  select count(*) into before_links from template_links;
  delete from users where id = 'b0000000-0000-4000-8000-00000000000a';
  perform assert_that('deleting a user does not delete their links',
    (select count(*) from template_links) = before_links);
end $$;

\echo ''
\echo 'ALL CHECKS PASSED'
