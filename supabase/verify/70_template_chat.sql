-- Template chat (0039): optional fields and the relative floor persist; a
-- thread can point only at a template of its own company (published or
-- not); member_hints is strictly self-scoped; ai_usage_events is readable by
-- a company's admins only, never writable by any client, and a row with no
-- company is seen by nobody but the operator. Against the real policies,
-- applied from the real migrations. assert_that comes from 20_checks.sql.

\set ON_ERROR_STOP on
\pset pager off

insert into auth.users (id, email) values
  ('aa700000-0000-4000-8000-00000000000a', 'tc-admin-a@example.com'),
  ('aa700000-0000-4000-8000-00000000000b', 'tc-member-a@example.com'),
  ('aa700000-0000-4000-8000-00000000000c', 'tc-other-a@example.com'),
  ('bb700000-0000-4000-8000-00000000000a', 'tc-admin-b@example.com');

insert into companies (id, name, slug) values
  ('ca700000-0000-4000-8000-00000000000a', 'TC A', 'tc-a'),
  ('cb700000-0000-4000-8000-00000000000b', 'TC B', 'tc-b');

insert into memberships (user_id, company_id, role) values
  ('aa700000-0000-4000-8000-00000000000a', 'ca700000-0000-4000-8000-00000000000a', 'admin'),
  ('aa700000-0000-4000-8000-00000000000b', 'ca700000-0000-4000-8000-00000000000a', 'member'),
  ('aa700000-0000-4000-8000-00000000000c', 'ca700000-0000-4000-8000-00000000000a', 'member'),
  ('bb700000-0000-4000-8000-00000000000a', 'cb700000-0000-4000-8000-00000000000b', 'admin');

insert into templates (id, company_id, name, status, canvas_width, canvas_height) values
  ('7e700000-0000-4000-8000-0000000000a1', 'ca700000-0000-4000-8000-00000000000a',
   'A published', 'published', 1080, 1350),
  ('7e700000-0000-4000-8000-0000000000a2', 'ca700000-0000-4000-8000-00000000000a',
   'A draft', 'draft', 1080, 1350),
  ('7e700000-0000-4000-8000-0000000000b1', 'cb700000-0000-4000-8000-00000000000b',
   'B published', 'published', 1080, 1350);

insert into ai_usage_events (company_id, user_id, fn, kind, model, input_tokens, output_tokens) values
  ('ca700000-0000-4000-8000-00000000000a', 'aa700000-0000-4000-8000-00000000000b',
   'template-generate', 'generate', 'claude-test', 100, 10),
  ('ca700000-0000-4000-8000-00000000000a', 'aa700000-0000-4000-8000-00000000000b',
   'template-generate', 'retry', 'claude-test', 50, 5),
  ('cb700000-0000-4000-8000-00000000000b', 'bb700000-0000-4000-8000-00000000000a',
   'template-autobuild', 'autobuild', 'claude-test', 7000, 700),
  (null, 'aa700000-0000-4000-8000-00000000000a',
   'brand-from-website', 'brand', 'claude-test', 9000, 900);

\echo ''
\echo '=== TEMPLATE FIELDS: OPTIONAL AND THE RELATIVE FLOOR ==='

do $$
declare refused boolean;
begin
  insert into template_fields
    (template_id, field_key, label, type, x, y, width, height, is_optional, min_font_scale)
  values ('7e700000-0000-4000-8000-0000000000a1', 'apply_link', 'Apply link', 'text',
          0, 0, 100, 40, true, 0.75);
  perform assert_that('an optional field with a 75% floor saves',
    (select is_optional and min_font_scale = 0.75 from template_fields
      where template_id = '7e700000-0000-4000-8000-0000000000a1' and field_key = 'apply_link'));

  insert into template_fields (template_id, field_key, label, type, x, y, width, height)
  values ('7e700000-0000-4000-8000-0000000000a1', 'headline', 'Headline', 'text', 0, 0, 100, 40);
  perform assert_that('an existing-style field leaves both columns null',
    (select is_optional is null and min_font_scale is null from template_fields
      where template_id = '7e700000-0000-4000-8000-0000000000a1' and field_key = 'headline'));

  refused := false;
  begin
    update template_fields set min_font_scale = 0.2
     where template_id = '7e700000-0000-4000-8000-0000000000a1' and field_key = 'headline';
  exception when check_violation then refused := true;
  end;
  perform assert_that('a floor under 25% is refused', refused);

  refused := false;
  begin
    update template_fields set min_font_scale = 1.1
     where template_id = '7e700000-0000-4000-8000-0000000000a1' and field_key = 'headline';
  exception when check_violation then refused := true;
  end;
  perform assert_that('a floor over 100% is refused', refused);

  update template_fields set min_font_scale = 0.25
   where template_id = '7e700000-0000-4000-8000-0000000000a1' and field_key = 'headline';
  perform assert_that('a 25% floor is allowed',
    (select min_font_scale = 0.25 from template_fields
      where template_id = '7e700000-0000-4000-8000-0000000000a1' and field_key = 'headline'));
end $$;

\echo ''
\echo '=== GENERATE THREADS: TEMPLATE OWNERSHIP ==='

set role authenticated;
set request.jwt.claim.sub = 'aa700000-0000-4000-8000-00000000000b';
do $$
declare refused boolean;
begin
  insert into generate_threads (id, company_id, title, template_id) values
    ('9e700000-0000-4000-8000-000000000001', 'ca700000-0000-4000-8000-00000000000a',
     'On its own template', '7e700000-0000-4000-8000-0000000000a1');
  perform assert_that('a member saves a chat on their company''s template',
    (select template_id = '7e700000-0000-4000-8000-0000000000a1' from generate_threads
      where id = '9e700000-0000-4000-8000-000000000001'));

  update generate_threads set template_id = '7e700000-0000-4000-8000-0000000000a2'
   where id = '9e700000-0000-4000-8000-000000000001';
  perform assert_that('and on its own unpublished template (autosave keeps working)',
    (select template_id = '7e700000-0000-4000-8000-0000000000a2' from generate_threads
      where id = '9e700000-0000-4000-8000-000000000001'));

  refused := false;
  begin
    insert into generate_threads (company_id, title, template_id) values
      ('ca700000-0000-4000-8000-00000000000a', 'Foreign',
       '7e700000-0000-4000-8000-0000000000b1');
  exception when insufficient_privilege then refused := true;
  end;
  perform assert_that('a chat cannot be created on another company''s template', refused);

  refused := false;
  begin
    update generate_threads set template_id = '7e700000-0000-4000-8000-0000000000b1'
     where id = '9e700000-0000-4000-8000-000000000001';
  exception when insufficient_privilege then refused := true;
  end;
  perform assert_that('nor moved onto one', refused);

  -- With no WHERE, the new row is checked against WITH CHECK alone.
  refused := false;
  begin
    update generate_threads set template_id = '7e700000-0000-4000-8000-0000000000b1';
  exception when insufficient_privilege then refused := true;
  end;
  perform assert_that('not even with no filter', refused);

  update generate_threads set template_id = null
   where id = '9e700000-0000-4000-8000-000000000001';
  perform assert_that('a chat can drop its template',
    (select template_id is null from generate_threads
      where id = '9e700000-0000-4000-8000-000000000001'));
end $$;
reset role;
reset request.jwt.claim.sub;

do $$
begin
  update generate_threads set template_id = '7e700000-0000-4000-8000-0000000000a1'
   where id = '9e700000-0000-4000-8000-000000000001';
  delete from templates where id = '7e700000-0000-4000-8000-0000000000a1';
  perform assert_that('deleting the template keeps the chat, with no template',
    (select template_id is null from generate_threads
      where id = '9e700000-0000-4000-8000-000000000001'));
end $$;

\echo ''
\echo '=== MEMBER HINTS ==='

set role authenticated;
set request.jwt.claim.sub = 'aa700000-0000-4000-8000-00000000000b';
do $$
begin
  perform assert_that('an absent row reads as nothing',
    (select count(*) from member_hints) = 0);
  perform assert_that('the first template chat counts 1', note_template_chat_started() = 1);
  perform assert_that('the second counts 2', note_template_chat_started() = 2);
  perform mark_plus_opened();
  perform assert_that('opening the plus is remembered',
    (select plus_opened_at is not null from member_hints));
end $$;
do $$
declare first_at timestamptz;
begin
  select plus_opened_at into first_at from member_hints;
  perform pg_sleep(0.01);
  perform mark_plus_opened();
  perform assert_that('and only the first time',
    (select plus_opened_at = first_at from member_hints));
end $$;
reset role;
reset request.jwt.claim.sub;

set role authenticated;
set request.jwt.claim.sub = 'aa700000-0000-4000-8000-00000000000c';
do $$
declare n int; refused boolean;
begin
  perform assert_that('another member reads none of it',
    (select count(*) from member_hints) = 0);
  update member_hints set template_chats_started = 0;
  get diagnostics n = row_count;
  perform assert_that('nor resets it', n = 0);

  refused := false;
  begin
    insert into member_hints (user_id, template_chats_started)
    values ('aa700000-0000-4000-8000-00000000000b', 0);
  exception when insufficient_privilege then refused := true;
  end;
  perform assert_that('nor writes a row in someone else''s name', refused);

  perform assert_that('their own count starts at 1', note_template_chat_started() = 1);
end $$;
reset role;
reset request.jwt.claim.sub;

set role authenticated;
set request.jwt.claim.sub = 'aa700000-0000-4000-8000-00000000000a';
do $$
begin
  perform assert_that('not even the company admin reads a member''s hints',
    (select count(*) from member_hints) = 0);
end $$;
reset role;
reset request.jwt.claim.sub;

do $$
begin
  perform assert_that('the member''s own row was kept at 2',
    (select template_chats_started from member_hints
      where user_id = 'aa700000-0000-4000-8000-00000000000b') = 2);
end $$;

\echo ''
\echo '=== AI USAGE ==='

set role authenticated;
set request.jwt.claim.sub = 'aa700000-0000-4000-8000-00000000000b';
do $$
declare refused boolean; s record;
begin
  perform assert_that('a member reads no usage rows',
    (select count(*) from ai_usage_events) = 0);
  select * into s from ai_usage_summary('ca700000-0000-4000-8000-00000000000a', now() - interval '1 day');
  perform assert_that('and the summary gives them zeros', s.requests = 0 and s.input_tokens = 0);

  refused := false;
  begin
    insert into ai_usage_events (company_id, fn, kind, model)
    values ('ca700000-0000-4000-8000-00000000000a', 'template-generate', 'generate', 'forged');
  exception when insufficient_privilege then refused := true;
  end;
  perform assert_that('a member cannot write a usage row', refused);
end $$;
reset role;
reset request.jwt.claim.sub;

set role authenticated;
set request.jwt.claim.sub = 'aa700000-0000-4000-8000-00000000000a';
do $$
declare refused boolean; s record; n int;
begin
  perform assert_that('an admin reads their company''s rows and no others',
    (select count(*) from ai_usage_events) = 2
    and (select bool_and(company_id = 'ca700000-0000-4000-8000-00000000000a') from ai_usage_events));
  perform assert_that('never a row with no company, even their own onboarding call',
    (select count(*) from ai_usage_events where company_id is null) = 0);

  select * into s from ai_usage_summary('ca700000-0000-4000-8000-00000000000a', now() - interval '1 day');
  perform assert_that('the summary totals their company',
    s.requests = 2 and s.input_tokens = 150 and s.output_tokens = 15);
  select * into s from ai_usage_summary('cb700000-0000-4000-8000-00000000000b', now() - interval '1 day');
  perform assert_that('and gives zeros for another company', s.requests = 0);
  select * into s from ai_usage_summary('ca700000-0000-4000-8000-00000000000a', now() + interval '1 day');
  perform assert_that('the since bound is honored', s.requests = 0);

  refused := false;
  begin
    delete from ai_usage_events;
  exception when insufficient_privilege then refused := true;
  end;
  perform assert_that('an admin cannot erase usage', refused);

  refused := false;
  begin
    update ai_usage_events set input_tokens = 0;
  exception when insufficient_privilege then refused := true;
  end;
  perform assert_that('nor rewrite it', refused);
end $$;
reset role;
reset request.jwt.claim.sub;

set role anon;
do $$
declare refused boolean;
begin
  perform assert_that('anon reads no usage', (select count(*) from ai_usage_events) = 0);
  refused := false;
  begin
    perform note_template_chat_started();
  exception when insufficient_privilege then refused := true;
  end;
  perform assert_that('anon cannot bump a hint count', refused);
end $$;
reset role;

set role service_role;
do $$
begin
  insert into ai_usage_events (company_id, fn, kind, model, input_tokens)
  values ('ca700000-0000-4000-8000-00000000000a', 'template-generate', 'repair', 'claude-test', 1);
  perform assert_that('the service role writes usage',
    (select count(*) from ai_usage_events where kind = 'repair') = 1);
end $$;
reset role;
