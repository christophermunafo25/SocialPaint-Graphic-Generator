-- A local check of migration 0043 (Phase 7b): workspace_plan() and the RLS
-- on billing_accounts. There is no SQL test harness in this repo, so this
-- runs against a throwaway Postgres with the few Supabase pieces 0043 needs
-- stubbed (auth.uid() from a setting, the anon and authenticated roles,
-- users, companies, memberships, is_company_admin):
--
--   initdb -D /tmp/pg && LC_ALL=en_US.UTF-8 pg_ctl -D /tmp/pg -o "-p 55432" start
--   createdb -h localhost -p 55432 -U "$USER" bt
--   psql -h localhost -p 55432 -d bt -f scripts/billing/check-0043.sql
--
-- Expected: Early access counts this workspace's admins; a member is refused;
-- the owner sees is_owner and caller_has_plan; another admin sees the owner's
-- name; each owner reads only their own billing row; clients write nothing.

do $$ begin create role anon; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated, anon;
create table companies (id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique, created_at timestamptz not null default now());
create table users (id uuid primary key default gen_random_uuid(), email text not null unique, name text, created_at timestamptz not null default now());
create type member_role as enum ('admin', 'member');
create table memberships (user_id uuid not null references users(id) on delete cascade, company_id uuid not null references companies(id) on delete cascade, role member_role not null default 'member', created_at timestamptz not null default now(), primary key (user_id, company_id));
create function is_company_admin(cid uuid) returns boolean language sql stable security definer set search_path = public as $$ select exists (select 1 from memberships where user_id = auth.uid() and company_id = cid and role = 'admin') $$;
grant select on all tables in schema public to authenticated;

\ir ../../supabase/migrations/0043_billing.sql
-- Supabase grants new tables to authenticated by default; 0043 then revokes writes.
grant select, insert, update, delete on billing_accounts to authenticated;
revoke insert, update, delete, truncate on billing_accounts from anon, authenticated;

insert into users (id, email, name) values
 ('00000000-0000-0000-0000-00000000000a','cj@acme.com','CJ Munafo'),
 ('00000000-0000-0000-0000-00000000000b','priya@acme.com',null),
 ('00000000-0000-0000-0000-00000000000c','mo@acme.com','Mo');
insert into companies (id, name, slug) values
 ('00000000-0000-0000-0000-0000000000c1','Acme Health','acme'),
 ('00000000-0000-0000-0000-0000000000c2','Acme Foundation','acme-f');
insert into memberships values
 ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000c1','admin'),
 ('00000000-0000-0000-0000-00000000000b','00000000-0000-0000-0000-0000000000c1','admin'),
 ('00000000-0000-0000-0000-00000000000c','00000000-0000-0000-0000-0000000000c1','member'),
 ('00000000-0000-0000-0000-00000000000b','00000000-0000-0000-0000-0000000000c2','admin');

set role authenticated;
-- Early access, as CJ (admin)
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
\echo '== early access, admin CJ'
select plan, is_owner, owner_name, admins_used, workspaces, caller_has_plan, caller_plan_workspace from workspace_plan('00000000-0000-0000-0000-0000000000c1');
\echo '== member Mo is refused'
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
select * from workspace_plan('00000000-0000-0000-0000-0000000000c1');
reset role;
-- CJ buys Crew on Acme Health (service role writes)
insert into billing_accounts (id, owner_user_id, stripe_customer_id, stripe_subscription_id, plan, "interval", amount, currency, status, period_end, livemode)
 values ('00000000-0000-0000-0000-0000000000aa','00000000-0000-0000-0000-00000000000a','cus_1','sub_1','crew','month',5999,'usd','active', now() + interval '30 days', false);
update companies set billing_account_id = '00000000-0000-0000-0000-0000000000aa' where id = '00000000-0000-0000-0000-0000000000c1';
set role authenticated;
\echo '== on a plan, owner CJ'
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select plan, billing_interval, amount, status, is_owner, owner_name, admins_used, workspaces, caller_has_plan, caller_plan_workspace from workspace_plan('00000000-0000-0000-0000-0000000000c1');
\echo '== on a plan, other admin Priya'
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select plan, is_owner, owner_name, caller_has_plan from workspace_plan('00000000-0000-0000-0000-0000000000c1');
\echo '== Priya on her own workspace (Early access)'
select plan, is_owner, admins_used, workspaces from workspace_plan('00000000-0000-0000-0000-0000000000c2');
\echo '== RLS: Priya reads 0 billing rows; CJ reads 1'
select count(*) from billing_accounts;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select count(*) from billing_accounts;
\echo '== authenticated cannot write'
update billing_accounts set plan = 'portfolio';
