-- Template chat (docs/design/template-chat/PROMPT.md): optional member
-- fields, a relative shrink floor, template chats that remember their
-- template, first-run hints, and per-call model usage.
--
-- template_fields.is_optional, template_fields.min_font_scale
--   Written by: the builder, through TemplateStore (rows.ts fieldToRow).
--   Null means "unset" for both: a null is_optional is a required field, as
--   before; a null min_font_scale falls back to min_font_size_px, then 18px.
--   Read by: every surface that renders or validates a template, and the
--   public-template function (which passes field columns through).
--
-- generate_threads.template_id
--   Written by: the template chat, through GenerateThreadStore.
--   Read by: Recent and History, to reopen a template chat on its template.
--
-- member_hints
--   Written and read by: the chat page, through MemberHintStore, for the
--   signed-in member only.
--
-- ai_usage_events
--   Written by: the Edge Functions that call the model (service role only).
--   Read by: company admins, through ai_usage_summary, on Settings > Usage.
--
-- Ship this before the functions and the client: both read these columns.

-- ── template_fields ─────────────────────────────────────────────────────
alter table template_fields
  add column is_optional boolean,
  add column min_font_scale numeric(3,2)
    check (min_font_scale is null or (min_font_scale >= 0.25 and min_font_scale <= 1));

-- ── generate_threads ────────────────────────────────────────────────────
alter table generate_threads
  add column template_id uuid references templates(id) on delete set null;

create index generate_threads_owner_template
  on generate_threads (company_id, user_id, template_id, updated_at desc);

-- A thread may only point at a template of its own company. Security
-- definer because a member's RLS on templates hides unpublished ones, and a
-- chat whose template is later unpublished must still save.
create function template_in_company(tid uuid, cid uuid) returns boolean
  language sql stable security definer set search_path = public as $$
    select exists (select 1 from templates t where t.id = tid and t.company_id = cid)
  $$;
revoke all on function template_in_company(uuid, uuid) from public, anon;
grant execute on function template_in_company(uuid, uuid) to authenticated;

drop policy self_insert_generate_threads on generate_threads;
drop policy self_update_generate_threads on generate_threads;
create policy self_insert_generate_threads on generate_threads for insert
  with check (
    user_id = auth.uid()
    and company_id in (select current_company_ids())
    and (template_id is null or template_in_company(template_id, company_id)));
create policy self_update_generate_threads on generate_threads for update
  using (user_id = auth.uid() and company_id in (select current_company_ids()))
  with check (
    user_id = auth.uid()
    and company_id in (select current_company_ids())
    and (template_id is null or template_in_company(template_id, company_id)));

-- ── member_hints ────────────────────────────────────────────────────────
-- First-run hints, one row per user. Strictly self-scoped, like
-- user_notification_prefs.
create table member_hints (
  user_id                 uuid primary key default auth.uid() references users(id) on delete cascade,
  plus_opened_at          timestamptz,
  template_chats_started  integer not null default 0 check (template_chats_started >= 0),
  updated_at              timestamptz not null default now()
);

alter table member_hints enable row level security;

create policy self_read_member_hints on member_hints for select
  using (user_id = auth.uid());
create policy self_insert_member_hints on member_hints for insert
  with check (user_id = auth.uid());
create policy self_update_member_hints on member_hints for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Atomic helpers. Security invoker, so the policies above decide.
create function note_template_chat_started() returns integer
  language sql volatile security invoker set search_path = public as $$
    insert into member_hints (user_id, template_chats_started)
    values (auth.uid(), 1)
    on conflict (user_id) do update
      set template_chats_started = member_hints.template_chats_started + 1,
          updated_at = now()
    returning template_chats_started
  $$;

create function mark_plus_opened() returns void
  language sql volatile security invoker set search_path = public as $$
    insert into member_hints (user_id, plus_opened_at)
    values (auth.uid(), now())
    on conflict (user_id) do update
      set plus_opened_at = coalesce(member_hints.plus_opened_at, now()),
          updated_at = now()
  $$;

revoke all on function note_template_chat_started() from public, anon;
revoke all on function mark_plus_opened() from public, anon;
grant execute on function note_template_chat_started() to authenticated;
grant execute on function mark_plus_opened() to authenticated;

-- ── ai_usage_events ─────────────────────────────────────────────────────
-- One row per model call. company_id is null for calls made before a
-- company exists (brand-from-website runs during onboarding); only the
-- operator sees those rows.
create table ai_usage_events (
  id                  bigint generated always as identity primary key,
  company_id          uuid references companies(id) on delete cascade,
  user_id             uuid references users(id) on delete set null,
  fn                  text not null check (fn in ('template-generate', 'template-autobuild', 'brand-from-website')),
  kind                text not null check (kind in ('generate', 'retry', 'repair', 'freestyle', 'autobuild', 'brand')),
  model               text not null,
  input_tokens        integer not null default 0,
  output_tokens       integer not null default 0,
  cache_read_tokens   integer not null default 0,
  cache_write_tokens  integer not null default 0,
  created_at          timestamptz not null default now()
);

create index ai_usage_events_company_recent on ai_usage_events (company_id, created_at desc);

alter table ai_usage_events enable row level security;

-- Company admins read their company's rows. No write policies: only the
-- service role writes here, so a member can never forge or erase usage.
-- A null company_id never satisfies is_company_admin.
create policy admin_read_ai_usage_events on ai_usage_events for select
  using (is_company_admin(company_id));
revoke insert, update, delete, truncate on ai_usage_events from anon, authenticated;

-- Security invoker: the admin-only read policy decides who gets numbers; a
-- member gets zeros.
create function ai_usage_summary(p_company uuid, p_since timestamptz)
  returns table (requests bigint, input_tokens bigint, output_tokens bigint)
  language sql stable security invoker set search_path = public as $$
    select count(*)::bigint,
           coalesce(sum(e.input_tokens), 0)::bigint,
           coalesce(sum(e.output_tokens), 0)::bigint
      from ai_usage_events e
     where e.company_id = p_company and e.created_at >= p_since
  $$;
revoke all on function ai_usage_summary(uuid, timestamptz) from public, anon;
grant execute on function ai_usage_summary(uuid, timestamptz) to authenticated;
