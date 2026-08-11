-- Auto-layout groups: ordered stacks over the flat template_fields, stored
-- as one jsonb blob on the template (LayoutGroup[] in src/lib/types.ts).
--
-- Deliberately NOT a table and NOT columns on template_fields: saves replace
-- fields wholesale (delete + reinsert mints new row ids), so groups reference
-- children by field_key — the one save-stable field identifier — and the
-- client round-trips the whole structure verbatim. Null means no groups: the
-- pre-feature rendering path, unchanged.
alter table templates add column layout_groups jsonb;
