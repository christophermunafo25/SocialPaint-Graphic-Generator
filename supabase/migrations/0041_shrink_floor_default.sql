-- Shrink-to-fit text goes back to the 18px floor (CJ, 2026-10-04).
--
-- 0040 gave every text field the builder or an import created a relative
-- floor of 75% of its set size (template_fields.min_font_scale = 0.75), so
-- longer copy stopped shrinking at, say, 45px for a 60px line and the fill
-- page warned that it does not fit. Cleared here on every field: a null
-- min_font_scale falls back to min_font_size_px, then 18px, as before 0040.
-- The column stays, so an admin can still set a field's own floor in the
-- builder (Min text); new fields and imports no longer set one.

update public.template_fields
set min_font_scale = null
where min_font_scale is not null;
