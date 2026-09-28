-- Generate chats: one row per chat, private to the member who made it.
-- Photos are never stored (the member's photo never leaves the browser);
-- turns hold briefs, hints, proposals and field values only.
--
-- Written by: the Generate chat page, through GenerateThreadStore
-- (src/lib/stores/supabase/generateThreadStore.ts), which refuses any write
-- carrying a data: value before it reaches this table.
-- Read by: Recent on the Generate start state, and the History page.
--
-- There is no updated_at trigger convention in this repo: the store sets
-- updated_at explicitly on every update. History pages on
-- (updated_at desc, id desc), so two chats saved in the same instant never
-- repeat or skip across a page boundary.
create table generate_threads (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  user_id     uuid not null default auth.uid() references users(id) on delete cascade,
  title       text not null default '' check (char_length(title) <= 120),
  platforms   text[] not null default '{}',
  preview     jsonb,
  turns       jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index generate_threads_owner_recent
  on generate_threads (company_id, user_id, updated_at desc);

alter table generate_threads enable row level security;

-- Strictly self-scoped, like user_notification_prefs: not even a company
-- admin reads another member's chats.
create policy self_read_generate_threads on generate_threads for select
  using (user_id = auth.uid() and company_id in (select current_company_ids()));
create policy self_insert_generate_threads on generate_threads for insert
  with check (user_id = auth.uid() and company_id in (select current_company_ids()));
create policy self_update_generate_threads on generate_threads for update
  using (user_id = auth.uid() and company_id in (select current_company_ids()))
  with check (user_id = auth.uid() and company_id in (select current_company_ids()));
create policy self_delete_generate_threads on generate_threads for delete
  using (user_id = auth.uid() and company_id in (select current_company_ids()));
