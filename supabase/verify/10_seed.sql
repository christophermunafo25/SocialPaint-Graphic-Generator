-- Two tenants, so every isolation check has a real other-company to fail
-- against rather than an absence.

insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-00000000000a', 'admin-a@example.com'),
  ('a0000000-0000-4000-8000-00000000000b', 'member-a@example.com'),
  ('b0000000-0000-4000-8000-00000000000a', 'admin-b@example.com');

-- public.users is populated by the on_auth_user_created trigger from 0006,
-- which is the real production path — so the seed does not write it directly.

insert into companies (id, name, slug) values
  ('c0000000-0000-4000-8000-00000000000a', 'Company A', 'company-a'),
  ('c0000000-0000-4000-8000-00000000000b', 'Company B', 'company-b');

insert into memberships (user_id, company_id, role) values
  ('a0000000-0000-4000-8000-00000000000a', 'c0000000-0000-4000-8000-00000000000a', 'admin'),
  ('a0000000-0000-4000-8000-00000000000b', 'c0000000-0000-4000-8000-00000000000a', 'member'),
  ('b0000000-0000-4000-8000-00000000000a', 'c0000000-0000-4000-8000-00000000000b', 'admin');

insert into templates (id, company_id, name, status, canvas_width, canvas_height) values
  ('11111111-0000-4000-8000-00000000000a', 'c0000000-0000-4000-8000-00000000000a',
   'A published', 'published', 1440, 1440),
  ('11111111-0000-4000-8000-00000000000d', 'c0000000-0000-4000-8000-00000000000a',
   'A draft', 'draft', 1440, 1440),
  ('22222222-0000-4000-8000-00000000000a', 'c0000000-0000-4000-8000-00000000000b',
   'B published', 'published', 1440, 1440);

-- Tokens: the hash column holds sha256(token). These are the digests of the
-- literal strings 'token-a', 'token-b', 'token-revoked', and so on, computed
-- the same way the Edge Function computes them.
insert into template_links (id, template_id, name, token_hash, expires_at, use_cap) values
  ('1a000000-0000-4000-8000-000000000001', '11111111-0000-4000-8000-00000000000a',
   'A live', encode(sha256('token-a'::bytea), 'hex'), null, null),
  ('1a000000-0000-4000-8000-000000000002', '11111111-0000-4000-8000-00000000000a',
   'A revoked', encode(sha256('token-revoked'::bytea), 'hex'), null, null),
  ('1a000000-0000-4000-8000-000000000003', '11111111-0000-4000-8000-00000000000a',
   'A expired', encode(sha256('token-expired'::bytea), 'hex'), now() - interval '1 day', null),
  ('1a000000-0000-4000-8000-000000000004', '11111111-0000-4000-8000-00000000000a',
   'A capped', encode(sha256('token-capped'::bytea), 'hex'), null, 2),
  ('1d000000-0000-4000-8000-000000000001', '11111111-0000-4000-8000-00000000000d',
   'A draft link', encode(sha256('token-draft'::bytea), 'hex'), null, null),
  ('2b000000-0000-4000-8000-000000000001', '22222222-0000-4000-8000-00000000000a',
   'B live', encode(sha256('token-b'::bytea), 'hex'), null, null);

update template_links set revoked_at = now()
 where id = '1a000000-0000-4000-8000-000000000002';
