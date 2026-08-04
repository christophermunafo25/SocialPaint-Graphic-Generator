-- Provenance for AI-built templates: which model, from what source, and what
-- it decided. When a template misbehaves we need to know whether a human or a
-- model chose its fields.
alter table templates
  add column autobuild_meta jsonb;
