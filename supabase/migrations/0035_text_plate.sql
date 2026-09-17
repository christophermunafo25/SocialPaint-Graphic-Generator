-- Text plates (pills): a plate painted behind a text field's rendered box,
-- plus padding, sharing the field's corner_radius (unset radius renders
-- fully rounded — a true pill). All nullable; plate_color absent = no plate.
alter table template_fields
  add column if not exists plate_color text;

alter table template_fields
  add column if not exists plate_padding_x numeric;

alter table template_fields
  add column if not exists plate_padding_y numeric;
