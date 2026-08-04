-- Canva auto-build connection storage.
--
-- Tokens live in integration_connections exactly like Figma's, discriminated
-- by provider = 'canva'. Canva issues short-lived access tokens with refresh
-- tokens, so the row grows an expiry and a refresh LEASE: a concurrent-safe
-- claim column so two Edge Function invocations can't race the same refresh
-- token (Canva rotates refresh tokens — losing the race would strand the
-- connection).
--
-- canva_oauth_states holds the server-side half of the PKCE flow: the state
-- nonce and code_verifier never reach the browser after the redirect starts.
-- Rows are single-use and short-lived; the callback deletes them.

alter table integration_connections
  drop constraint if exists integration_connections_provider_check;
alter table integration_connections
  add constraint integration_connections_provider_check
  check (provider in ('figma', 'canva'));

alter table integration_connections
  add column if not exists expires_at timestamptz,
  add column if not exists refresh_lease_until timestamptz;

create table if not exists canva_oauth_states (
  state         text primary key,
  company_id    uuid not null references companies(id) on delete cascade,
  code_verifier text not null,
  created_at    timestamptz not null default now()
);
alter table canva_oauth_states enable row level security;
-- No client policy: Edge Functions only, via the service role.
