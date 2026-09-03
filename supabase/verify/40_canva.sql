-- Canva connection storage (0018): the token table and the OAuth state
-- table are reachable by the service role alone, and the provider check
-- admits exactly the two providers the Edge Functions know. Against the
-- real policies (there are none, which is the point) from the real
-- migrations.
--
-- 30_settings.sql seeds its own tenants; this file does the same so it does
-- not depend on which earlier file cleaned up after itself.

\set ON_ERROR_STOP on
\pset pager off

insert into auth.users (id, email) values
  ('aa200000-0000-4000-8000-00000000000a', 'canva-admin-a@example.com'),
  ('aa200000-0000-4000-8000-00000000000b', 'canva-member-a@example.com'),
  ('bb200000-0000-4000-8000-00000000000a', 'canva-admin-b@example.com');

insert into companies (id, name, slug) values
  ('ca200000-0000-4000-8000-00000000000a', 'Canva A', 'canva-a'),
  ('cb200000-0000-4000-8000-00000000000b', 'Canva B', 'canva-b');

insert into memberships (user_id, company_id, role) values
  ('aa200000-0000-4000-8000-00000000000a', 'ca200000-0000-4000-8000-00000000000a', 'admin'),
  ('aa200000-0000-4000-8000-00000000000b', 'ca200000-0000-4000-8000-00000000000a', 'member'),
  ('bb200000-0000-4000-8000-00000000000a', 'cb200000-0000-4000-8000-00000000000b', 'admin');

-- One connection per company, written the way the Edge Function writes it
-- (service role, bypassing RLS), plus one connect in flight for company A.
insert into integration_connections
  (company_id, provider, access_token, refresh_token, scope, expires_at, connected_by)
values
  ('ca200000-0000-4000-8000-00000000000a', 'canva', 'secret-access-a', 'secret-refresh-a',
   'design:content:read design:meta:read', now() + interval '4 hours',
   'aa200000-0000-4000-8000-00000000000a'),
  ('cb200000-0000-4000-8000-00000000000b', 'canva', 'secret-access-b', 'secret-refresh-b',
   'design:content:read design:meta:read', now() + interval '4 hours',
   'bb200000-0000-4000-8000-00000000000a');

insert into canva_oauth_states (state, company_id, code_verifier) values
  ('state-a', 'ca200000-0000-4000-8000-00000000000a', 'verifier-a');

\echo ''
\echo '=== CANVA: SCHEMA ==='

do $$
begin
  perform assert_that('integration_connections carries an expiry',
    exists (select 1 from information_schema.columns
             where table_name = 'integration_connections' and column_name = 'expires_at'));
  perform assert_that('integration_connections carries the refresh lease',
    exists (select 1 from information_schema.columns
             where table_name = 'integration_connections'
               and column_name = 'refresh_lease_until'));
  perform assert_that('canva_oauth_states has row level security on',
    (select relrowsecurity from pg_class where relname = 'canva_oauth_states'));
  perform assert_that('canva_oauth_states has no policy at all',
    not exists (select 1 from pg_policies where tablename = 'canva_oauth_states'));
  perform assert_that('integration_connections has no policy at all',
    not exists (select 1 from pg_policies where tablename = 'integration_connections'));
end $$;

\echo ''
\echo '=== CANVA: PROVIDER CHECK ==='

do $$
declare rejected boolean := false;
begin
  begin
    insert into integration_connections (company_id, provider, access_token)
    values ('ca200000-0000-4000-8000-00000000000a', 'dropbox', 'x');
  exception when check_violation then
    rejected := true;
  end;
  perform assert_that('a third provider is rejected by the check', rejected);
  perform assert_that('the check names figma and canva and nothing else',
    exists (select 1 from pg_constraint
             where conname = 'integration_connections_provider_check'
               and pg_get_constraintdef(oid) ~ 'figma'
               and pg_get_constraintdef(oid) ~ 'canva'
               and pg_get_constraintdef(oid) !~ 'dropbox'));
end $$;

\echo ''
\echo '=== CANVA: TOKENS ARE UNREACHABLE FROM EVERY CLIENT ROLE ==='

-- Anonymous.
set role anon;
do $$
begin
  perform assert_that('anon reads no connections',
    (select count(*) from integration_connections) = 0);
  perform assert_that('anon reads no oauth states',
    (select count(*) from canva_oauth_states) = 0);
end $$;
reset role;

-- A member of company A, signed in.
set role authenticated;
set request.jwt.claim.sub = 'aa200000-0000-4000-8000-00000000000b';
do $$
begin
  perform assert_that('a member reads no connections',
    (select count(*) from integration_connections) = 0);
  perform assert_that('a member cannot select canva_oauth_states',
    (select count(*) from canva_oauth_states) = 0);
end $$;
reset role;
reset request.jwt.claim.sub;

-- An admin of company A, signed in: not even their own company's row, and
-- no write of any kind. An insert with no policy raises rather than
-- matching zero rows, so it is caught where the others are counted.
set role authenticated;
set request.jwt.claim.sub = 'aa200000-0000-4000-8000-00000000000a';
do $$
declare refused boolean := false;
begin
  perform assert_that('an admin reads no connections, not even their own company''s',
    (select count(*) from integration_connections) = 0);
  perform assert_that('an admin of company A cannot select company B''s connection',
    (select count(*) from integration_connections
      where company_id = 'cb200000-0000-4000-8000-00000000000b') = 0);
  perform assert_that('an admin cannot select canva_oauth_states',
    (select count(*) from canva_oauth_states) = 0);
  begin
    insert into integration_connections (company_id, provider, access_token)
    values ('ca200000-0000-4000-8000-00000000000a', 'figma', 'planted');
  exception when insufficient_privilege then
    refused := true;
  end;
  perform assert_that('a signed-in admin cannot plant a connection', refused);
  update integration_connections set access_token = 'hijacked';
  delete from canva_oauth_states;
end $$;
reset role;
reset request.jwt.claim.sub;

do $$
begin
  perform assert_that('the planted row does not exist',
    not exists (select 1 from integration_connections where access_token = 'planted'));
  perform assert_that('a signed-in admin cannot overwrite a token',
    not exists (select 1 from integration_connections where access_token = 'hijacked'));
  perform assert_that('a signed-in admin cannot delete oauth states',
    (select count(*) from canva_oauth_states) = 1);
  perform assert_that('the service role path still sees both rows',
    (select count(*) from integration_connections where provider = 'canva') = 2);
end $$;

\echo ''
\echo '=== CANVA: CASCADES ==='

delete from companies where id in
  ('ca200000-0000-4000-8000-00000000000a', 'cb200000-0000-4000-8000-00000000000b');

do $$
begin
  perform assert_that('deleting a company removes its connections',
    not exists (select 1 from integration_connections
                 where company_id in ('ca200000-0000-4000-8000-00000000000a',
                                      'cb200000-0000-4000-8000-00000000000b')));
  perform assert_that('deleting a company removes its in-flight oauth states',
    not exists (select 1 from canva_oauth_states where state = 'state-a'));
end $$;
