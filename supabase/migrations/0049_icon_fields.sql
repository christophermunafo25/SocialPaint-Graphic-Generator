-- Icon fields (brand-system Phase 3). Additive; a template without an icon
-- reads and renders exactly as before.
--
-- field_type gains 'icon': a static field that draws vector artwork from
-- path data and recolors like any field (colorHex, textGradient, and a
-- colourway's override). Icons are never member input or required.
--
-- vector: the artwork, read defensively by the renderer
-- (src/lib/render/vector.ts): { viewBox: [minX, minY, w, h], paths: [{ d,
-- paint?: "fill" | "stroke", fillRule?, colorHex? }], stroke?: { width,
-- cap?, join? }, source?: { set: "lucide", name } }. Coordinates and the
-- stroke width are viewBox units, so the art scales with the box. Null on
-- every other field type.
alter type field_type add value if not exists 'icon';

alter table template_fields
  add column if not exists vector jsonb;
