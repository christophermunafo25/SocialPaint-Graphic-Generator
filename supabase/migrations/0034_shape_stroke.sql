-- Shape strokes: an outline drawn inside the box (inner stroke), so the
-- painted size never exceeds width × height. stroke_width_px is px and >= 1
-- whenever stroke_color is set (enforced client-side, like opacity's range);
-- both null means no stroke.
alter table template_fields
  add column if not exists stroke_color text;

alter table template_fields
  add column if not exists stroke_width_px numeric;
