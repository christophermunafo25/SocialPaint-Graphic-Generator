-- "fill" joins the text sizing modes: the box stays exactly as drawn and the
-- text is sized to fill it, growing as well as shrinking. 0021 introduced
-- text_sizing with a CHECK that allowed only 'free' and 'shrink', so a field
-- saved in the new mode is rejected by the database and the whole template
-- save fails with it. Widening the constraint is additive — every existing
-- row already satisfies it.
alter table template_fields
  drop constraint if exists template_fields_text_sizing_check;

alter table template_fields
  add constraint template_fields_text_sizing_check
  check (text_sizing is null or text_sizing in ('free', 'shrink', 'fill'));
