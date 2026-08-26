-- Minimal stand-ins for the parts of a Supabase project that the migrations
-- reference but that a bare Postgres does not have: the auth schema, the
-- storage schema, and the three PostgREST roles.
--
-- These are STUBS for the surfaces the migrations touch. The policies,
-- functions, grants, and cascades under test are the REAL ones, applied from
-- the real migration files in order.

do $$
declare r record;
begin
  for r in select * from (values
      ('anon', false), ('authenticated', false),
      ('service_role', true), ('supabase_auth_admin', false)
    ) as t(name, bypass) loop
    if not exists (select 1 from pg_roles where rolname = r.name) then
      execute format('create role %I nologin %s', r.name,
                     case when r.bypass then 'bypassrls' else '' end);
    end if;
  end loop;
end $$;

create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb default '{}'
);

-- Supabase's auth.uid() reads the request's JWT claims. The stub reads a GUC
-- so a test can become a specific user with `set local`.
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create schema storage;
create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text not null,
  owner uuid
);
create function storage.foldername(name text) returns text[]
  language sql immutable as $$
    select string_to_array(name, '/')
  $$;

grant usage on schema public, auth, storage to anon, authenticated, service_role;
-- Mirrors the default privileges a real Supabase project applies to tables
-- created by `postgres` — without them the column-grant tightening in 0026
-- would have nothing to tighten and the check would pass vacuously.
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
