-- Onboarding's answers (0045; PHASE-8B.md §9 D11): a person writes their own
-- role and nobody else's; a workspace's admin writes its profile and a
-- member can't.

\set ON_ERROR_STOP on
\pset pager off

insert into auth.users (id, email) values
  ('aa850000-0000-4000-8000-00000000000a', 'onb-admin@example.com'),
  ('aa850000-0000-4000-8000-00000000000b', 'onb-member@example.com');

insert into companies (id, name, slug) values
  ('ca850000-0000-4000-8000-00000000000a', 'Onboarding A', 'onboarding-a');

insert into memberships (user_id, company_id, role) values
  ('aa850000-0000-4000-8000-00000000000a', 'ca850000-0000-4000-8000-00000000000a', 'admin'),
  ('aa850000-0000-4000-8000-00000000000b', 'ca850000-0000-4000-8000-00000000000a', 'member');

\echo ''
\echo '=== ONBOARDING ANSWERS ==='

do $$
begin
  perform assert_that('a new workspace starts with an empty profile',
    (select profile = '{}'::jsonb from companies where id = 'ca850000-0000-4000-8000-00000000000a'));
end $$;

set role authenticated;
set request.jwt.claim.sub = 'aa850000-0000-4000-8000-00000000000a';
update users set job_role = 'marketing' where id = 'aa850000-0000-4000-8000-00000000000a';
update users set job_role = 'sales' where id = 'aa850000-0000-4000-8000-00000000000b';
update companies set profile = '{"setup_for": "company", "team_size": "11_50"}'
  where id = 'ca850000-0000-4000-8000-00000000000a';
reset role;
reset request.jwt.claim.sub;

set role authenticated;
set request.jwt.claim.sub = 'aa850000-0000-4000-8000-00000000000b';
update companies set profile = '{"setup_for": "just_me"}'
  where id = 'ca850000-0000-4000-8000-00000000000a';
reset role;
reset request.jwt.claim.sub;

do $$
begin
  perform assert_that('a person sets their own role',
    (select job_role = 'marketing' from users where id = 'aa850000-0000-4000-8000-00000000000a'));
  perform assert_that('and not someone else''s',
    (select job_role is null from users where id = 'aa850000-0000-4000-8000-00000000000b'));
  perform assert_that('an admin writes the workspace profile, and a member can''t change it',
    (select profile ->> 'setup_for' = 'company' and profile ->> 'team_size' = '11_50'
       from companies where id = 'ca850000-0000-4000-8000-00000000000a'));
end $$;
