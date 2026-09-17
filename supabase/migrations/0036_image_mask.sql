-- Alpha masks on image fields: an image source (storage reference, like
-- static_value) whose alpha channel clips the field's image — the Figma
-- importer's custom-shape mask groups. Null = no mask.
alter table template_fields
  add column if not exists mask_url text;
