-- Billing on Stripe (new look, Phase 7b; docs/design/new-look/PHASE-7B.md).
--
-- A plan belongs to the person who buys it (the billing owner) and covers
-- the workspace it was bought in. One billing_accounts row per owner holds
-- their Stripe customer and the current state of their one subscription;
-- companies.billing_account_id says which workspace that subscription
-- covers. Stripe is the source of truth: the billing-webhook function
-- fetches each subscription and writes what it says, so a duplicate or
-- out-of-order event leaves the same row.
--
-- Nothing here limits anything: seats and brands are shown against the
-- plan's catalog numbers, never enforced, and public_links_enabled (0026)
-- stays true for everyone.
--
-- Writes: only the service role. The billing function creates an owner's
-- row (their customer) at their first checkout; the webhook writes every
-- plan field and the workspace link. Owners read their own row; admins
-- read a workspace's plan through workspace_plan(), which also answers
-- who pays.

create table billing_accounts (
  id                      uuid primary key default gen_random_uuid(),
  -- Restrict, not cascade: a paying customer's record is never dropped by
  -- a user cleanup. Delete the subscription first.
  owner_user_id           uuid not null unique references users(id) on delete restrict,
  stripe_customer_id      text not null unique,
  stripe_subscription_id  text unique,
  plan                    text check (plan in ('canvas', 'studio', 'crew', 'portfolio')),
  "interval"              text check ("interval" in ('month', 'year')),
  -- The current price, in the currency's smallest unit (cents).
  amount                  integer check (amount >= 0),
  currency                text,
  -- Stripe's subscription status, as Stripe spells it.
  status                  text,
  -- The subscription item's current_period_end (since API version
  -- 2025-03-31.basil it is no longer on the subscription).
  period_end              timestamptz,
  cancel_at_period_end    boolean not null default false,
  cancel_at               timestamptz,
  -- Test-mode rows come from the sandbox run on this project (Q2); the
  -- go-live step deletes them.
  livemode                boolean not null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

alter table billing_accounts enable row level security;

create policy owner_read_billing_account on billing_accounts for select
  using (owner_user_id = auth.uid());
revoke insert, update, delete, truncate on billing_accounts from anon, authenticated;

-- Which plan covers a workspace. Null is Early access.
alter table companies
  add column billing_account_id uuid references billing_accounts(id) on delete set null;
create index companies_billing_account on companies (billing_account_id)
  where billing_account_id is not null;

-- One open Checkout Session per workspace (Q8): starting a new one expires
-- the older. The service role alone reads and writes it.
create table billing_checkout_sessions (
  company_id          uuid primary key references companies(id) on delete cascade,
  session_id          text not null,
  billing_account_id  uuid not null references billing_accounts(id) on delete cascade,
  expires_at          timestamptz not null,
  created_at          timestamptz not null default now()
);

alter table billing_checkout_sessions enable row level security;
revoke all on billing_checkout_sessions from anon, authenticated;

-- A workspace's plan, for its admins: the plan fields, whether the caller
-- pays for it, who does (display name, else email), the admins and the
-- workspaces on the plan, and whether the caller already pays for a plan
-- that hasn't ended (and on which workspace), which hides Upgrade for them
-- (Q9). On Early access the plan fields are null and the counts are this
-- workspace's. A non-admin gets an error, not an empty row.
create function workspace_plan(p_company uuid)
  returns table (
    plan                  text,
    billing_interval      text,
    amount                integer,
    currency              text,
    status                text,
    period_end            timestamptz,
    cancel_at_period_end  boolean,
    cancel_at             timestamptz,
    is_owner              boolean,
    owner_name            text,
    admins_used           bigint,
    workspaces            bigint,
    caller_has_plan       boolean,
    caller_plan_workspace text
  )
  language plpgsql stable security definer set search_path = public as $$
begin
  if not is_company_admin(p_company) then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;

  return query
  with acct as (
    select a.*
      from companies c
      join billing_accounts a on a.id = c.billing_account_id
     where c.id = p_company
  ),
  covered as (
    -- The workspaces on the plan; this one alone on Early access.
    select c.id
      from companies c
     where c.billing_account_id = (select id from acct)
    union
    select p_company
  ),
  mine as (
    select a.id
      from billing_accounts a
     where a.owner_user_id = auth.uid()
       and a.stripe_subscription_id is not null
       and a.status in ('active', 'trialing', 'past_due', 'unpaid', 'paused')
  )
  select acct.plan,
         acct."interval",
         acct.amount,
         acct.currency,
         acct.status,
         acct.period_end,
         coalesce(acct.cancel_at_period_end, false),
         acct.cancel_at,
         coalesce(acct.owner_user_id = auth.uid(), false),
         (select coalesce(nullif(u.name, ''), u.email) from users u where u.id = acct.owner_user_id),
         (select count(distinct m.user_id)
            from memberships m
           where m.company_id in (select id from covered) and m.role = 'admin'),
         (select count(*) from covered),
         exists (select 1 from mine),
         (select c.name
            from companies c
           where c.billing_account_id in (select id from mine)
           order by c.name
           limit 1)
    from (select 1) one
    left join acct on true;
end
$$;

revoke all on function workspace_plan(uuid) from public, anon;
grant execute on function workspace_plan(uuid) to authenticated;
