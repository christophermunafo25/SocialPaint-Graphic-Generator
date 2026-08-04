-- Figma-parity typography: a field carries a full face, not a weight alone.
--
-- font_style   — "normal" | "italic"
-- font_stretch — CSS font-stretch KEYWORD ("condensed", "expanded", …), never
--                a percentage: the keyword is what the canvas font shorthand
--                accepts, and a percentage there invalidates the whole
--                shorthand and silently reverts measurement to the default face.
--
-- Both nullable with no default, and null reads as normal, so every template
-- saved before this renders exactly as it did. brand_kits.type_styles needs no
-- migration — it is jsonb, and BrandTypeStyle gained the same two properties.

alter table template_fields
  add column if not exists font_style   text,
  add column if not exists font_stretch text;
