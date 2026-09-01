-- Settings & Admin: the workspace becomes editable.
--
-- Until now the companies row was written once at onboarding and never again —
-- a typo in the name or slug was permanent, every admin read dates in their
-- own browser's timezone, and the defaults for a new public link were
-- hardcoded in the dialog. This migration gives Settings something to write:
-- workspace facts on companies, a per-company canvas-size opt-out, two brand
-- enforcement switches on brand_kits, and per-user notification preferences.
-- No policy from 0006 or 0026 is weakened; every new table gets its own
-- scoped RLS below.

-- ---------------------------------------------------------------------------
-- 1. Workspace facts. timezone is an IANA zone name every admin-facing date
--    follows, so two people in the same company read the same day boundaries
--    (Insights buckets by it). The link_default_* trio seeds the create form
--    in TemplateLinksDialog — defaults, not caps; each link still sets its
--    own values.
-- ---------------------------------------------------------------------------

alter table companies
  add column timezone text not null default 'UTC',
  add column link_default_allow_uploads boolean not null default true,
  add column link_default_expiry_days int
    check (link_default_expiry_days is null or link_default_expiry_days > 0),
  add column link_default_use_cap int
    check (link_default_use_cap is null or link_default_use_cap > 0);

-- Slug availability for the inline check in Settings. RLS hides other
-- tenants' companies from a signed-in admin, so a plain select cannot answer
-- "is this slug taken" — this security-definer function answers the boolean
-- and nothing else. Slug existence is not a secret (it is how workspaces are
-- addressed); the rows behind it stay invisible.
create function public.slug_available(p_slug text, p_company_id uuid)
  returns boolean
  language sql stable security definer set search_path = public as $$
    select not exists (
      select 1 from companies where slug = p_slug and id is distinct from p_company_id
    )
  $$;

revoke all on function public.slug_available(text, uuid) from public, anon;
grant execute on function public.slug_available(text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Per-company canvas-size opt-out. canvas_presets stays global reference
--    data (seed.sql is still its only writer); this join records which of
--    the globally enabled sizes a workspace has turned OFF. No row means
--    enabled — a new preset is offered everywhere until someone hides it.
-- ---------------------------------------------------------------------------

create table company_canvas_presets (
  company_id uuid not null references companies(id) on delete cascade,
  preset_id  text not null references canvas_presets(id) on delete cascade,
  enabled    boolean not null default true,
  primary key (company_id, preset_id)
);

alter table company_canvas_presets enable row level security;

-- Members read (the builder's size picker filters by this); admins write.
create policy member_read_company_canvas_presets on company_canvas_presets for select
  using (company_id in (select current_company_ids()));
create policy admin_write_company_canvas_presets on company_canvas_presets for all
  using (is_company_admin(company_id)) with check (is_company_admin(company_id));

-- ---------------------------------------------------------------------------
-- 3. Brand enforcement. Two switches read by the client-side style resolver
--    (src/lib/brand/resolveStyle.ts), not by the UI layer:
--      * allow_style_override — when true, a field's own values win over its
--        bound type style (the style fills gaps only). Default false keeps
--        the existing behavior: a bound style's properties are locked.
--      * allow_off_palette — when false, a field's solid fill that is not one
--        of the brand palette hexes renders as the nearest palette color.
--        Default true keeps existing behavior: any hex renders as authored.
-- ---------------------------------------------------------------------------

alter table brand_kits
  add column allow_style_override boolean not null default false,
  add column allow_off_palette    boolean not null default true;

-- ---------------------------------------------------------------------------
-- 4. Notification preferences, one row per user. Preferences only in this
--    phase — nothing sends mail yet, and the Account section says so. The
--    columns default to true so flipping delivery on later honors what
--    people chose rather than starting everyone silent.
-- ---------------------------------------------------------------------------

create table user_notification_prefs (
  user_id         uuid primary key references users(id) on delete cascade,
  invite_accepted boolean not null default true,
  weekly_digest   boolean not null default true,
  link_expiring   boolean not null default true,
  updated_at      timestamptz not null default now()
);

alter table user_notification_prefs enable row level security;

-- Strictly self-scoped: not even a company admin reads another member's
-- notification choices.
create policy self_read_notification_prefs on user_notification_prefs for select
  using (user_id = auth.uid());
create policy self_write_notification_prefs on user_notification_prefs for insert
  with check (user_id = auth.uid());
create policy self_update_notification_prefs on user_notification_prefs for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
