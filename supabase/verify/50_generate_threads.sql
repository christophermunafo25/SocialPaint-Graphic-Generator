-- Generate chats (0038): generate_threads is strictly self-scoped. The
-- author reads and writes their own chats; nobody else does, not another
-- member of the same company and not that company's admin; a write can
-- never land in a company the writer is not in or under someone else's
-- name; and every chat goes with its company or its author. Against the
-- real policies, applied from the real migrations.
--
-- 30_settings.sql and 40_canva.sql seed their own tenants; this file does
-- the same so it does not depend on which earlier file cleaned up after
-- itself. assert_that comes from 20_checks.sql.

\set ON_ERROR_STOP on
\pset pager off

insert into auth.users (id, email) values
  ('aa300000-0000-4000-8000-00000000000a', 'chats-admin-a@example.com'),
  ('aa300000-0000-4000-8000-00000000000b', 'chats-author-a@example.com'),
  ('aa300000-0000-4000-8000-00000000000c', 'chats-member-a@example.com'),
  ('bb300000-0000-4000-8000-00000000000a', 'chats-admin-b@example.com');

insert into companies (id, name, slug) values
  ('ca300000-0000-4000-8000-00000000000a', 'Chats A', 'chats-a'),
  ('cb300000-0000-4000-8000-00000000000b', 'Chats B', 'chats-b');

insert into memberships (user_id, company_id, role) values
  ('aa300000-0000-4000-8000-00000000000a', 'ca300000-0000-4000-8000-00000000000a', 'admin'),
  ('aa300000-0000-4000-8000-00000000000b', 'ca300000-0000-4000-8000-00000000000a', 'member'),
  ('aa300000-0000-4000-8000-00000000000c', 'ca300000-0000-4000-8000-00000000000a', 'member'),
  ('bb300000-0000-4000-8000-00000000000a', 'cb300000-0000-4000-8000-00000000000b', 'admin');

\echo ''
\echo '=== GENERATE CHATS: THE AUTHOR ==='

-- The author of company A writes the way the store writes: no user_id in
-- the insert (the column defaults to auth.uid()), turns and a preview as
-- jsonb, the platforms array.
set role authenticated;
set request.jwt.claim.sub = 'aa300000-0000-4000-8000-00000000000b';
insert into generate_threads (id, company_id, title, platforms, preview, turns) values
  ('9e300000-0000-4000-8000-000000000001', 'ca300000-0000-4000-8000-00000000000a',
   'Creative Director post', '{instagram,linkedin}',
   '{"templateId": "t-1", "values": {"headline": "We''re hiring"}, "canvas": {"width": 1080, "height": 1350}}',
   '[{"id": "u1", "role": "user", "text": "We''re hiring a Creative Director", "variations": 2, "intent": "brief"}]'),
  ('9e300000-0000-4000-8000-000000000002', 'ca300000-0000-4000-8000-00000000000a',
   'Webinar promo', '{linkedin}', null, '[]');
do $$
declare n int;
begin
  perform assert_that('the author reads their own chats',
    (select count(*) from generate_threads) = 2);
  perform assert_that('user_id defaults to the signed-in author',
    (select bool_and(user_id = 'aa300000-0000-4000-8000-00000000000b') from generate_threads));
  perform assert_that('turns and preview round-trip as jsonb',
    (select turns -> 0 ->> 'text' = 'We''re hiring a Creative Director'
            and preview -> 'canvas' ->> 'width' = '1080'
       from generate_threads where id = '9e300000-0000-4000-8000-000000000001'));
  perform assert_that('the platform filter matches through the array',
    (select count(*) from generate_threads where platforms @> array['instagram']) = 1);

  update generate_threads
     set title = 'Creative Director hiring post', updated_at = now()
   where id = '9e300000-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  perform assert_that('the author updates their own chat', n = 1);

  delete from generate_threads where id = '9e300000-0000-4000-8000-000000000002';
  get diagnostics n = row_count;
  perform assert_that('the author deletes their own chat', n = 1);
  perform assert_that('and it is gone',
    (select count(*) from generate_threads
      where id = '9e300000-0000-4000-8000-000000000002') = 0);
end $$;

-- A title past the column's 120 characters is refused by the check, not
-- stored truncated.
do $$
declare refused boolean := false;
begin
  begin
    insert into generate_threads (company_id, title)
    values ('ca300000-0000-4000-8000-00000000000a', repeat('x', 121));
  exception when check_violation then refused := true;
  end;
  perform assert_that('a title over 120 characters is refused', refused);
end $$;

-- The author cannot hand a chat to someone else or move it into a company
-- they are not in. A filtered update reads the row, so the new row is
-- checked against the select policy as well as the update's WITH CHECK,
-- and either refuses it; the unfiltered updates test WITH CHECK alone.
do $$
declare refused boolean;
begin
  refused := false;
  begin
    update generate_threads set user_id = 'aa300000-0000-4000-8000-00000000000c'
     where id = '9e300000-0000-4000-8000-000000000001';
  exception when insufficient_privilege then refused := true;
  end;
  perform assert_that('the author cannot give a chat to another member', refused);

  refused := false;
  begin
    update generate_threads set company_id = 'cb300000-0000-4000-8000-00000000000b'
     where id = '9e300000-0000-4000-8000-000000000001';
  exception when insufficient_privilege then refused := true;
  end;
  perform assert_that('the author cannot move a chat into another company', refused);

  -- With no WHERE, the new row is checked against the update policy's
  -- WITH CHECK alone; the filtered updates above are also refused by the
  -- select policy, so only these fail if WITH CHECK loses a clause. The
  -- author owns one chat here, so each would move exactly that one.
  refused := false;
  begin
    update generate_threads set user_id = 'aa300000-0000-4000-8000-00000000000c';
  exception when insufficient_privilege then refused := true;
  end;
  perform assert_that('not even with no filter (another member)', refused);

  refused := false;
  begin
    update generate_threads set company_id = 'cb300000-0000-4000-8000-00000000000b';
  exception when insufficient_privilege then refused := true;
  end;
  perform assert_that('not even with no filter (another company)', refused);
end $$;
reset role;
reset request.jwt.claim.sub;

\echo ''
\echo '=== ANOTHER MEMBER OF THE SAME COMPANY ==='

set role authenticated;
set request.jwt.claim.sub = 'aa300000-0000-4000-8000-00000000000c';
do $$
declare n int; refused boolean := false;
begin
  perform assert_that('another member reads none of the author''s chats',
    (select count(*) from generate_threads) = 0);
  perform assert_that('not even by id',
    (select count(*) from generate_threads
      where id = '9e300000-0000-4000-8000-000000000001') = 0);

  update generate_threads set title = 'Hijacked'
   where id = '9e300000-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  perform assert_that('another member''s update matches zero rows', n = 0);

  delete from generate_threads where id = '9e300000-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  perform assert_that('another member''s delete matches zero rows', n = 0);

  begin
    insert into generate_threads (company_id, user_id, title)
    values ('ca300000-0000-4000-8000-00000000000a',
            'aa300000-0000-4000-8000-00000000000b', 'Planted');
  exception when insufficient_privilege then refused := true;
  end;
  perform assert_that('another member cannot insert a chat under the author''s name', refused);
end $$;
-- Their own chat, for the user-deletion cascade below.
insert into generate_threads (id, company_id, title, platforms) values
  ('9e300000-0000-4000-8000-00000000000c', 'ca300000-0000-4000-8000-00000000000a',
   'Team spotlight', '{facebook}');
do $$
begin
  perform assert_that('another member reads only their own chat',
    (select count(*) from generate_threads) = 1);
end $$;
reset role;
reset request.jwt.claim.sub;

do $$
begin
  perform assert_that('the author''s chat is untouched by the other member',
    (select title from generate_threads
      where id = '9e300000-0000-4000-8000-000000000001') = 'Creative Director hiring post');
end $$;

\echo ''
\echo '=== THE COMPANY ADMIN ==='

set role authenticated;
set request.jwt.claim.sub = 'aa300000-0000-4000-8000-00000000000a';
do $$
declare n int;
begin
  perform assert_that('the company admin reads none of its members'' chats',
    (select count(*) from generate_threads) = 0);

  update generate_threads set title = 'Admin edit'
   where id = '9e300000-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  perform assert_that('the company admin''s update matches zero rows', n = 0);

  delete from generate_threads where id = '9e300000-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  perform assert_that('the company admin''s delete matches zero rows', n = 0);
end $$;
reset role;
reset request.jwt.claim.sub;

\echo ''
\echo '=== WRITES WITH NO FILTER ==='

-- An UPDATE or DELETE with no WHERE and no RETURNING reads no column, so
-- Postgres checks it against that command's own policy only, not the select
-- policy. The filtered writes above are also stopped by the select policy,
-- so only these catch an update or delete policy that lost its user clause.
-- Each runs in a transaction that is rolled back, so the rows the later
-- sections count are left as they were.
begin;
set local role authenticated;
set local request.jwt.claim.sub = 'aa300000-0000-4000-8000-00000000000c';
update generate_threads set user_id = auth.uid();
set local request.jwt.claim.sub = 'aa300000-0000-4000-8000-00000000000a';
update generate_threads set user_id = auth.uid();
reset role;
do $$
begin
  perform assert_that('an unfiltered update by another member or the admin claims none of the author''s chats',
    (select user_id from generate_threads
      where id = '9e300000-0000-4000-8000-000000000001') = 'aa300000-0000-4000-8000-00000000000b');
end $$;
rollback;

begin;
set local role authenticated;
set local request.jwt.claim.sub = 'aa300000-0000-4000-8000-00000000000c';
delete from generate_threads;
set local request.jwt.claim.sub = 'aa300000-0000-4000-8000-00000000000a';
delete from generate_threads;
reset role;
do $$
begin
  perform assert_that('an unfiltered delete by another member or the admin removes none of the author''s chats',
    exists (select 1 from generate_threads
             where id = '9e300000-0000-4000-8000-000000000001'));
end $$;
rollback;

\echo ''
\echo '=== ANOTHER COMPANY ==='

set role authenticated;
set request.jwt.claim.sub = 'bb300000-0000-4000-8000-00000000000a';
insert into generate_threads (id, company_id, title, platforms) values
  ('9e300000-0000-4000-8000-0000000000b1', 'cb300000-0000-4000-8000-00000000000b',
   'Company update', '{linkedin}');
do $$
declare refused boolean;
begin
  perform assert_that('another company''s admin reads only their own chat',
    (select count(*) from generate_threads) = 1);

  refused := false;
  begin
    insert into generate_threads (company_id, title)
    values ('ca300000-0000-4000-8000-00000000000a', 'Cross-tenant');
  exception when insufficient_privilege then refused := true;
  end;
  perform assert_that('a member of another company cannot insert into company A', refused);

  refused := false;
  begin
    insert into generate_threads (company_id, user_id, title)
    values ('ca300000-0000-4000-8000-00000000000a',
            'aa300000-0000-4000-8000-00000000000b', 'Cross-tenant, borrowed name');
  exception when insufficient_privilege then refused := true;
  end;
  perform assert_that('nor under a company A member''s name', refused);
end $$;
reset role;
reset request.jwt.claim.sub;

\echo ''
\echo '=== LEAVING THE COMPANY ==='

-- The company clause is not decoration: a member removed from the company
-- stops reading the chats they made there, and reads them again if they
-- are added back.
delete from memberships
 where user_id = 'aa300000-0000-4000-8000-00000000000b'
   and company_id = 'ca300000-0000-4000-8000-00000000000a';
set role authenticated;
set request.jwt.claim.sub = 'aa300000-0000-4000-8000-00000000000b';
do $$
declare n int;
begin
  perform assert_that('a member removed from the company reads none of its chats',
    (select count(*) from generate_threads) = 0);
  update generate_threads set title = 'After leaving'
   where id = '9e300000-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  perform assert_that('and updates none', n = 0);

  -- With no filter only the update and delete policies are consulted, so
  -- these are what fail if either loses its company clause.
  begin
    update generate_threads set title = 'After leaving';
    get diagnostics n = row_count;
  exception when insufficient_privilege then n := -1;
  end;
  perform assert_that('not even with no filter', n = 0);
  delete from generate_threads;
  get diagnostics n = row_count;
  perform assert_that('and deletes none, with no filter', n = 0);
end $$;
reset role;
reset request.jwt.claim.sub;
insert into memberships (user_id, company_id, role) values
  ('aa300000-0000-4000-8000-00000000000b', 'ca300000-0000-4000-8000-00000000000a', 'member');
set role authenticated;
set request.jwt.claim.sub = 'aa300000-0000-4000-8000-00000000000b';
do $$
begin
  perform assert_that('added back, they read their chat again',
    (select count(*) from generate_threads) = 1);
end $$;
reset role;
reset request.jwt.claim.sub;

\echo ''
\echo '=== ANON ==='

set role anon;
do $$
declare refused boolean := false;
begin
  perform assert_that('anon reads no chats', (select count(*) from generate_threads) = 0);
  begin
    insert into generate_threads (company_id, user_id, title)
    values ('ca300000-0000-4000-8000-00000000000a',
            'aa300000-0000-4000-8000-00000000000b', 'Anonymous');
  exception when insufficient_privilege then refused := true;
  end;
  perform assert_that('anon cannot insert a chat', refused);
end $$;
reset role;

\echo ''
\echo '=== DELETE CASCADES ==='

do $$
begin
  delete from users where id = 'aa300000-0000-4000-8000-00000000000c';
  perform assert_that('deleting a user removes their chats',
    (select count(*) from generate_threads
      where id = '9e300000-0000-4000-8000-00000000000c') = 0);
  perform assert_that('and no one else''s',
    (select count(*) from generate_threads
      where id = '9e300000-0000-4000-8000-000000000001') = 1);

  delete from companies where id = 'ca300000-0000-4000-8000-00000000000a';
  perform assert_that('deleting a company removes every chat in it',
    (select count(*) from generate_threads
      where company_id = 'ca300000-0000-4000-8000-00000000000a') = 0);
  perform assert_that('another company''s chats are untouched',
    (select count(*) from generate_threads
      where id = '9e300000-0000-4000-8000-0000000000b1') = 1);
end $$;
