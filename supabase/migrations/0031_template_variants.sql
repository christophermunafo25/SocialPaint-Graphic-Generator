-- Template variations: one template carrying several colourways that share a
-- single set of fields and one geometry. Stored as one jsonb blob on the
-- template (TemplateVariant[] in src/lib/types.ts), exactly like
-- layout_groups in 0020.
--
-- Deliberately NOT a table and NOT columns on template_fields: saves replace
-- fields wholesale (delete + reinsert mints new row ids), so a variation's
-- per-element overrides are keyed by field_key — the one save-stable field
-- identifier — and the client round-trips the whole structure verbatim.
-- Null means single-variant: the pre-feature rendering path, unchanged.
--
-- A variation may override APPEARANCE only (fill, gradient, bound type
-- style, opacity, a fixed element's content, visibility, and the canvas
-- background). Geometry, type, guardrails and identity are shared and can
-- never diverge; the client's VariantFieldOverride type is closed to them
-- and the merge ignores any such key found in stored JSON.
alter table templates add column variants jsonb;

-- Which variation an event was rendered with, so Insights can say which
-- looks get used. Text rather than uuid: variant ids are minted client-side
-- (crypto.randomUUID where available, a timestamp fallback where not) and
-- are never joined against anything. Null on every event recorded before
-- this column existed and on every single-variant template.
alter table usage_events add column variant_id text;

-- A public link can pin one variation: the visitor sees no picker and that
-- look renders. Null (the default, and the state of every existing link)
-- means the visitor chooses when the template has more than one look. Not
-- a foreign key — the id lives inside templates.variants, not in a table —
-- and a pin naming a since-deleted variation falls back to the default at
-- render time rather than breaking the link.
alter table template_links add column pinned_variant_id text;

-- The column grant in 0026 is per-column, so the new column needs naming
-- for the admin UI to read it back.
grant select (pinned_variant_id) on template_links to authenticated;

-- The lookup hands the Edge Function everything it needs to serve the link
-- in one locked statement; the pin travels with it. Same body as 0026 plus
-- one column — see that file for the security argument.
create or replace function public_link_lookup(p_token_hash text, p_consume boolean)
  returns jsonb
  language sql volatile security definer set search_path = public as $$
  with eligible as (
    select l.id           as link_id,
           l.template_id  as template_id,
           t.company_id   as company_id,
           l.allow_uploads as allow_uploads,
           l.pinned_variant_id as pinned_variant_id
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
  select to_jsonb(e) from eligible e;
$$;
