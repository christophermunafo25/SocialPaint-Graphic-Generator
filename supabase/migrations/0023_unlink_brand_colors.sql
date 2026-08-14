-- Unlink field-level brand color bindings (prompt 23).
--
-- Fields stopped carrying live palette references: picking a brand color now
-- copies its hex onto the field at pick time. This bakes any legacy
-- color_key rows exactly as the renderer resolved them — the active kit's
-- hex for the key — so every template renders identically before and after.
-- A key that no longer resolves keeps the field's existing color_hex
-- fallback, which is precisely what the renderer showed for it already.
--
-- freezeBrandColors() has baked keys on every save since 2026-08-04 and the
-- template library was reset on 2026-08-07, so this is expected to touch
-- zero rows; it exists to make that a guarantee instead of an assumption.
--
-- The color_key column itself stays (hidden, unread) — drop it in a later
-- migration once it has been dead in production for a while. Type-style
-- color bindings (brand_kits.type_styles[].colorKey) are deliberately NOT
-- touched: type styles remain the one sanctioned live brand channel.

update template_fields f
set
  color_hex = coalesce(
    (
      select c ->> 'hex'
      from templates t
      join brand_kits k on k.company_id = t.company_id and k.is_active,
      lateral jsonb_array_elements(k.colors) c
      where t.id = f.template_id
        and c ->> 'key' = f.color_key
      limit 1
    ),
    f.color_hex
  ),
  color_key = null
where f.color_key is not null;
