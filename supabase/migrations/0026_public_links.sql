-- Public template links: a published template becomes fillable by someone
-- with no account, no session, and no membership.
--
-- The shape of the security argument, because it is the whole feature:
--
--   * RLS is NOT relaxed. Not one policy in 0006 or 0025 weakens. An
--     anonymous caller still reads nothing through the anon key, and the
--     policies added here grant the anon role nothing either.
--   * The ONLY anonymous path is public_link_lookup() below, reached from an
--     Edge Function running as the service role. That function takes a token
--     hash and nothing else, and returns one link plus its template id. It
--     is the single place an anonymous caller reaches privileged access.
--   * The token is stored HASHED. This database does not contain a working
--     key to any customer's template.
--
-- DEPLOY COUPLING: public_link_lookup and consume_rate_limit are revoked
-- from public/anon/authenticated at the bottom of this file. Do not grant
-- them back — an anon client holding the (public) anon key could otherwise
-- call them over PostgREST and probe tokens directly, bypassing the Edge
-- Function's rate limiting entirely.

-- ---------------------------------------------------------------------------
-- 1. Links
-- ---------------------------------------------------------------------------

create table template_links (
  id            uuid primary key default gen_random_uuid(),
  template_id   uuid not null references templates(id) on delete cascade,
  -- Admin-facing label ("Speaker confirmation email"). Never sent to a
  -- public visitor; it is the admin's own filing system.
  name          text not null default '',
  -- SHA-256 of the token, lowercase hex. The token itself is returned once,
  -- at creation, and is not recoverable afterwards — regenerate is the
  -- recovery path. Unique, so this doubles as the lookup index.
  token_hash    text not null unique,
  -- Per-link switch for image fields. A product control, not a security
  -- control: member uploads never reach storage (they are cropped to a data
  -- URL in the browser and embedded straight into the PNG), so a public
  -- upload is not a write to our infrastructure. This exists for the admin
  -- who does not want a stranger's photo on their brand's graphic.
  allow_uploads boolean not null default true,
  expires_at    timestamptz,
  -- Cap on OPENS, not on distinct people — counting people would mean
  -- fingerprinting them, which this feature deliberately does not do.
  use_cap       int check (use_cap is null or use_cap > 0),
  use_count     int not null default 0,
  revoked_at    timestamptz,
  created_by    uuid references users(id) on delete set null,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz
);
create index template_links_by_template on template_links (template_id, created_at desc);

-- Every link action, so "who created a public link to which template, and
-- who revoked it" has an answer. Folds into the audit log from prompt 14 —
-- this table is a placeholder for that, not a competitor to it.
create type template_link_action as enum ('created', 'updated', 'revoked', 'regenerated');

create table template_link_events (
  id         uuid primary key default gen_random_uuid(),
  link_id    uuid not null references template_links(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  action     template_link_action not null,
  actor_id   uuid references users(id) on delete set null,
  -- Never the token or its hash. Names, expiry changes, prior use counts.
  detail     jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index template_link_events_by_link on template_link_events (link_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 2. RLS: admins READ their own company's links. Nobody writes from a
--    client — every mutation goes through the template-links Edge Function
--    so token minting and the audit trail live in exactly one place.
-- ---------------------------------------------------------------------------

alter table template_links       enable row level security;
alter table template_link_events enable row level security;

create policy admin_read_template_links on template_links for select
  using (exists (
    select 1 from templates t
    where t.id = template_id and is_company_admin(t.company_id)
  ));

-- Column grants on top of the row policy. A hash is not a working key, so an
-- admin reading their own token_hash is not a vulnerability — but there is no
-- reason for it to travel to a browser either, and the narrowest grant that
-- still works is the one to write down. Table-level SELECT would override a
-- per-column revoke, so it is replaced rather than amended.
revoke select on template_links from anon, authenticated;
grant select (
  id, template_id, name, allow_uploads, expires_at, use_cap, use_count,
  revoked_at, created_by, created_at, last_used_at
) on template_links to authenticated;

create policy admin_read_template_link_events on template_link_events for select
  using (is_company_admin(company_id));

-- ---------------------------------------------------------------------------
-- 3. Attribution: a public fill has no user to attribute it to, and we do
--    not invent one. `actor` says where the event came from; `link_id` says
--    through which link. user_id stays NULL for public events and is never
--    given a sentinel.
-- ---------------------------------------------------------------------------

create type usage_actor as enum ('member', 'public');

alter table usage_events add column actor usage_actor not null default 'member';
alter table usage_events add column link_id uuid references template_links(id) on delete set null;
create index usage_events_by_link on usage_events (link_id) where link_id is not null;

-- Existing rows are member events by construction (there was no other kind),
-- and the column default already labelled them. The insert policy tightens
-- so a signed-in member cannot mint rows that claim to be public traffic.
drop policy if exists member_insert_usage_events on usage_events;
create policy member_insert_usage_events on usage_events for insert
  with check (
    company_id in (select current_company_ids())
    and (user_id is null or user_id = auth.uid())
    and actor = 'member'
    and link_id is null
  );

-- ---------------------------------------------------------------------------
-- 4. Rate limiting.
--
--    Prompt 06 has not landed, and an unauthenticated endpoint cannot ship
--    without limiting. This is the smallest primitive that does the job:
--    fixed-window counters keyed by an opaque string. Prompt 06 should
--    absorb it (more key kinds, quota accounting) rather than replace it.
--
--    Keys are caller-supplied and already opaque — the Edge Function passes
--    a peppered hash of the IP, never the IP. Retention is one day.
-- ---------------------------------------------------------------------------

create table rate_limit_counters (
  bucket_key   text not null,
  window_start timestamptz not null,
  count        int not null default 0,
  primary key (bucket_key, window_start)
);
create index rate_limit_counters_sweep on rate_limit_counters (window_start);

alter table rate_limit_counters enable row level security;
-- No policies at all: service role only, exactly like integration_connections.

create function consume_rate_limit(p_key text, p_limit int, p_window_seconds int)
  returns boolean
  language plpgsql volatile security definer set search_path = public as $$
declare
  w timestamptz;
  n int;
begin
  w := to_timestamp(
         floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
       );
  insert into rate_limit_counters (bucket_key, window_start, count)
       values (p_key, w, 1)
  on conflict (bucket_key, window_start)
    do update set count = rate_limit_counters.count + 1
  returning count into n;

  -- Opportunistic sweep on the first hit of a new key/window, so the table
  -- cannot grow without a scheduled job. Indexed range, usually empty.
  if n = 1 then
    delete from rate_limit_counters where window_start < now() - interval '1 day';
  end if;

  return n <= p_limit;
end $$;

-- ---------------------------------------------------------------------------
-- 5. The gate.
--
--    Every reason a public link can be refused lives here, in one predicate,
--    evaluated per request. Nothing is cached, so unpublishing a template or
--    revoking a link takes effect on the very next request — confirmed
--    rather than assumed, because `templates.status` is read inside this
--    predicate and nowhere else on the public path.
--
--    The cap is claimed under a row lock in the same statement that checks
--    it, so two simultaneous visitors cannot both slip past the last use.
-- ---------------------------------------------------------------------------

-- The seam for prompt 08. Today every company's links work; when billing
-- state exists, the past-due clause goes HERE and nowhere else.
create function public_links_enabled(p_company_id uuid) returns boolean
  language sql stable set search_path = public as $$
    select p_company_id is not null
  $$;

comment on function public_links_enabled(uuid) is
  'Prompt 08 seam: return false for companies whose billing state should disable public links.';

/** Resolve a token hash to exactly one link, or NULL.
 *
 * p_consume = true claims one use (the page open). The download event calls
 * it with false so a single fill does not eat two uses.
 *
 * Returns jsonb rather than a table so the OUT parameter names cannot
 * collide with (and silently shadow) the column names in the predicate. */
create function public_link_lookup(p_token_hash text, p_consume boolean)
  returns jsonb
  language sql volatile security definer set search_path = public as $$
  with eligible as (
    select l.id           as link_id,
           l.template_id  as template_id,
           t.company_id   as company_id,
           l.allow_uploads as allow_uploads
      from template_links l
      join templates t on t.id = l.template_id
     where l.token_hash = p_token_hash
       and l.revoked_at is null
       and (l.expires_at is null or l.expires_at > now())
       and (l.use_cap is null or l.use_count < l.use_cap)
       and t.status = 'published'
       and public_links_enabled(t.company_id)
       for update of l
  ),
  consumed as (
    update template_links l
       set use_count = l.use_count + 1,
           last_used_at = now()
      from eligible e
     where l.id = e.link_id and p_consume
    returning l.id
  )
  select to_jsonb(e) from eligible e
$$;

-- ---------------------------------------------------------------------------
-- 6. Grants. These two functions are security definer and reach across
--    tenants by design; only the service role may call them.
-- ---------------------------------------------------------------------------

revoke all on function consume_rate_limit(text, int, int) from public, anon, authenticated;
revoke all on function public_link_lookup(text, boolean) from public, anon, authenticated;
grant execute on function consume_rate_limit(text, int, int) to service_role;
grant execute on function public_link_lookup(text, boolean) to service_role;

-- ---------------------------------------------------------------------------
-- 7. Cascade inventory (for prompt 09)
--
--   delete company  → templates            (0001, on delete cascade)
--                   → template_links       (via templates, on delete cascade)
--                   → template_link_events (company_id, on delete cascade)
--                   → usage_events         (0001, on delete cascade)
--   delete template → template_links       (on delete cascade)
--                   → template_link_events (via template_links)
--                   → usage_events         (0001, on delete cascade)
--   delete link     → template_link_events (on delete cascade)
--                   → usage_events.link_id (on delete set null — the counts
--                     survive; only the attribution to a now-gone link goes)
--   delete user     → template_links.created_by  (on delete set null)
--                   → template_link_events.actor_id (on delete set null)
--
-- Nothing here is orphaned by any of those deletions, and no public link can
-- outlive the template it points at.
-- ---------------------------------------------------------------------------
