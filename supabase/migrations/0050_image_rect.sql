-- Image placement inside the box (brand-system Phase 4). Additive; a
-- template without it reads and renders exactly as before.
--
-- image_rect: where an image field's image sits inside its box, as fractions
-- of the box: { x, y, width, height }. The image is fitted into that rect
-- with the field's object fit (cover by default) and clipped by the box, its
-- corners and its mask, so a designer's crop survives an import and a
-- member's replacement photo lands in the same rect. Fractions, so a resize
-- keeps the crop. Null means the rect is the box itself, the behaviour every
-- template had before this column.
alter table template_fields
  add column if not exists image_rect jsonb;
