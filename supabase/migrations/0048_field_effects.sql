-- Depth in the renderer (brand-system Phase 1). All nullable; null renders
-- exactly as before.
--
-- effects: a field's depth effects, painted in list order. Each entry is
-- { type: "dropShadow" | "innerShadow", x, y, blur, spread?, color }
-- | { type: "layerBlur", radius } | { type: "noise", color, size, density,
-- seed? }, colors #RRGGBBAA, lengths in canvas px. Read defensively by the
-- renderer (src/lib/render/effects.ts): a malformed entry is skipped.
--
-- stroke_align: where a shape's stroke sits on its edge, 'inside' (the
-- 0034 stroke), 'center' or 'outside'. Null is inside.
--
-- canvas_effects: the same effect list for the whole canvas; noise paints
-- over every field, an inner shadow insets the canvas edge.
--
-- Radial gradients need no column: kind, center and radius ride inside the
-- existing text_gradient and background_gradient jsonb.
alter table template_fields
  add column if not exists effects jsonb;

alter table template_fields
  add column if not exists stroke_align text
    check (stroke_align is null or stroke_align in ('inside', 'center', 'outside'));

alter table templates
  add column if not exists canvas_effects jsonb;
