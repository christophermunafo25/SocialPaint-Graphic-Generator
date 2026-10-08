-- Billing (0043; PHASE-7B.md): workspace_plan() answers admins only, with
-- who pays and the counts; billing_accounts is readable by its owner alone
-- and writable by no client; billing_checkout_sessions is closed to
-- clients; deleting an account clears its workspace's link. Moved here from
-- the stand-alone scripts/billing/check-0043.sql (Phase 8).

\set ON_ERROR_STOP on
\pset pager off

insert into auth.users (id, email, raw_user_meta_data) values
  ('aa900000-0000-4000-8000-00000000000a', 'billing-owner@example.com', '{"name": "Pat Owner"}'),
  ('aa900000-0000-4000-8000-00000000000b', 'billing-admin@example.com', '{}'),
  ('aa900000-0000-4000-8000-00000000000c', 'billing-member@example.com', '{}');

update users set name = 'Pat Owner' where id = 'aa900000-0000-4000-8000-00000000000a';

insert into companies (id, name, slug) values
  ('ca900000-0000-4000-8000-00000000000a', 'Billing A', 'billing-a'),
  ('cb900000-0000-4000-8000-00000000000b', 'Billing B', 'billing-b');

insert into memberships (user_id, company_id, role) values
  ('aa900000-0000-4000-8000-00000000000a', 'ca900000-0000-4000-8000-00000000000a', 'admin'),
  ('aa900000-0000-4000-8000-00000000000b', 'ca900000-0000-4000-8000-00000000000a', 'admin'),
  ('aa900000-0000-4000-8000-00000000000c', 'ca900000-0000-4000-8000-00000000000a', 'member'),
  ('aa900000-0000-4000-8000-00000000000b', 'cb900000-0000-4000-8000-00000000000b', 'admin');

\echo ''
\echo '=== WORKSPACE PLAN ==='

set role authenticated;
set request.jwt.claim.sub = 'aa900000-0000-4000-8000-00000000000a';
do $$
declare p record;
begin
  select * into p from workspace_plan('ca900000-0000-4000-8000-00000000000a');
  perform assert_that('Early access: no plan, this workspace''s two admins, one workspace',
    p.plan is null and p.admins_used = 2 and p.workspaces = 1 and not p.caller_has_plan);
end $$;

set request.jwt.claim.sub = 'aa900000-0000-4000-8000-00000000000c';
do $$
begin
  begin
    perform * from workspace_plan('ca900000-0000-4000-8000-00000000000a');
    raise exception 'FAIL: a member read the workspace plan';
  exception when insufficient_privilege then
    raise notice 'pass  a member is refused the workspace plan';
  end;
end $$;
reset role;
reset request.jwt.claim.sub;

-- The owner buys Crew on Billing A (the service role writes, as the
-- billing function and webhook do).
insert into billing_accounts (id, owner_user_id, stripe_customer_id, stripe_subscription_id,
                              plan, "interval", amount, currency, status, period_end, livemode)
values ('ab900000-0000-4000-8000-00000000000a', 'aa900000-0000-4000-8000-00000000000a',
        'cus_verify', 'sub_verify', 'crew', 'month', 5999, 'usd', 'active',
        now() + interval '30 days', false);
update companies set billing_account_id = 'ab900000-0000-4000-8000-00000000000a'
 where id = 'ca900000-0000-4000-8000-00000000000a';

set role authenticated;
set request.jwt.claim.sub = 'aa900000-0000-4000-8000-00000000000a';
do $$
declare p record;
begin
  select * into p from workspace_plan('ca900000-0000-4000-8000-00000000000a');
  perform assert_that('the owner sees the plan as theirs, and that they already have one',
    p.plan = 'crew' and p.is_owner and p.owner_name = 'Pat Owner'
      and p.caller_has_plan and p.caller_plan_workspace = 'Billing A');
  perform assert_that('the owner reads their own billing row',
    (select count(*) from billing_accounts) = 1);
end $$;

set request.jwt.claim.sub = 'aa900000-0000-4000-8000-00000000000b';
do $$
declare p record;
begin
  select * into p from workspace_plan('ca900000-0000-4000-8000-00000000000a');
  perform assert_that('another admin sees who pays, and no plan of their own',
    p.plan = 'crew' and not p.is_owner and p.owner_name = 'Pat Owner'
      and not p.caller_has_plan);
  perform assert_that('another admin reads no billing row',
    (select count(*) from billing_accounts) = 0);
  select * into p from workspace_plan('cb900000-0000-4000-8000-00000000000b');
  perform assert_that('their own workspace is on Early access with its own counts',
    p.plan is null and p.admins_used = 1 and p.workspaces = 1);
end $$;

set request.jwt.claim.sub = 'aa900000-0000-4000-8000-00000000000a';
do $$
begin
  begin
    update billing_accounts set plan = 'portfolio';
    raise exception 'FAIL: a client changed a billing row';
  exception when insufficient_privilege then
    raise notice 'pass  no client writes a billing row';
  end;
  begin
    perform count(*) from billing_checkout_sessions;
    raise exception 'FAIL: a client read the checkout sessions';
  exception when insufficient_privilege then
    raise notice 'pass  checkout sessions are closed to clients';
  end;
end $$;
reset role;
reset request.jwt.claim.sub;

delete from billing_accounts where id = 'ab900000-0000-4000-8000-00000000000a';
do $$
begin
  perform assert_that('deleting the account puts its workspace back on Early access',
    (select billing_account_id is null from companies
      where id = 'ca900000-0000-4000-8000-00000000000a'));
end $$;
