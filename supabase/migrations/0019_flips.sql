-- Flip controls (inspector Position section): mirror a field's content
-- horizontally / vertically, Figma-style. Rendered as a content-level scale
-- after rotation; null means no flip, so every existing field is unchanged.
alter table template_fields
  add column if not exists flip_x boolean,
  add column if not exists flip_y boolean;
