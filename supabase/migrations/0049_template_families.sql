-- Size families (line breaks and size families, Phase 2; D3).
--
-- templates.family_id links the copies "Create a version for another size"
-- makes into one template in several sizes. Every member stays an ordinary
-- template with its own fields, looks, status, links and usage, and nothing
-- is shared at render time. Null means no family, which is every template
-- before this migration.
--
--  - family_id is an opaque id the app mints (crypto.randomUUID()). There is
--    no families table. The app writes it only through
--    TemplateStore.setFamily; template saves never touch it.
--  - templates_family_idx serves listFamily (company_id, family_id).
--  - templates_family_size_key allows one member per size in a family.
--    company_id leads, so another workspace can never claim a size.
--
-- No new policies: admin_update_templates (0006) already limits writes to
-- the workspace's admins, and member_read_templates covers reads.

alter table templates add column if not exists family_id uuid;

create index if not exists templates_family_idx
  on templates (company_id, family_id) where family_id is not null;

create unique index if not exists templates_family_size_key
  on templates (company_id, family_id, canvas_width, canvas_height)
  where family_id is not null;
