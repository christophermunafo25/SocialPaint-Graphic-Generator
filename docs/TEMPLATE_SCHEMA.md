# Template schema

A template is **data, not code**: a background image plus an array of guarded
fields, rendered by the single `SchemaRenderer` component. No per-template JSX
exists anywhere. Source of truth: `src/lib/types.ts` (`TemplateSchema`,
`TemplateField`) ↔ `templates` / `template_fields` tables.

## TemplateSchema

| Field | Notes |
|---|---|
| `canvasWidth` / `canvasHeight` | Pixel size of the canvas. Chosen at creation — a `SIZE_CATALOG` preset (`src/lib/templates/platforms.ts`) or a custom size — and **every consumer reads from here** — renderer scale math, builder overlay, `toPng` export. New preset sizes = new catalogue entries, one file. |
| `backgroundUrl` | Storage URL of the uploaded/imported PNG. Converted to a data URL before render/export. |
| `fields` | Ordered `TemplateField[]`. **Array order is the member FORM order** (the sequence fields appear in the end-user's form — reordered by dragging in the builder's field list). Canvas paint order is the separate per-field `zIndex`. |
| `captionTemplate` | Merge string with `{field_key}` placeholders, e.g. `"{name} celebrated {years} incredible years!"`. Members see the merged result, can edit it, and copy it. Image fields have no caption value. |
| `status` | `draft` \| `published`. Only published templates appear in the member portal. |

## TemplateField

Placement (canvas pixel space):

- `x`, `y`, `width`, `height` — the field box. `x/y` are the box's top-left,
  unless `anchor: "center"` (then they're the box center — for center-anchored
  text à la the original name banner).
- `rotation` — degrees about the box center.
- `zIndex` — canvas paint (layer) order, higher on top; controlled by the
  builder's "To front / To back". Deliberately decoupled from the fields
  array order (= form order). Never negative — layer moves renormalize all
  fields to 0..n-1 so nothing paints behind the background image.

Fixed elements:

- `static: true` + `staticValue` — the element exists on the graphic but is
  NOT member-editable: no form entry, no required check, no tag chip. The
  admin fixes the content (`staticValue` = the text, or an image URL uploaded
  from the inspector). Full canvas editing, styling, z-order, and clipboard
  behavior still apply. A leftover `{tag}` referencing a fixed text element
  merges to its `staticValue`. `select` fields can't be static.

Types:

- `text` / `multiline` — single/multi-line text.
- `image` — member uploads a photo; cropped to `aspectRatio` (falls back to
  the box's own ratio); `objectFit` cover/contain; `cornerRadius`
  (`{tl, tr, br, bl}` px, uniform = all equal via the builder's link toggle)
  renders identically in the builder, member preview, and PNG export because
  all three go through `SchemaRenderer`.
- `select` — fixed `options` list.
- `shape` — decorative design element (`shape`: rect | ellipse | triangle |
  star; a "Line" is a thin rect). Fill reuses the text pipeline (`colorHex` /
  brand `colorKey` / `textGradient`); rects honor `cornerRadius`; non-rects
  render as inline SVG so gradients survive the PNG export. Always
  `static: true` — shapes never appear in the member form.

Brand binding (the rules engine — OPTIONAL, an opt-in reuse convenience;
admins style fields freely and directly by default):

- `typeStyleKey` — binds the field to a named brand type style ("role") from
  the brand kit. Every property the style defines (font, weight, case, color,
  letter spacing, line height, fixed size, max length, auto-fit) overrides the
  field-level values below and is locked: the builder disables those controls
  and shows the rule sentences; changing the style in Brand Studio restyles
  every bound field across every template. Properties the style leaves
  undefined stay field-editable. Resolution lives in
  `src/lib/brand/resolveStyle.ts`.

Locked styling (member can NEVER change these — used when no type style
defines the property):

- `fontFamily`, `fontSizePx`, `align`, `verticalAlign` (top/middle/bottom
  placement within the box, default middle), `uppercase`, `letterSpacingPx`,
  `lineHeight`.
- `colorKey` — a brand-kit palette key, resolved at render time so
  re-branding restyles existing templates; `colorHex` — any exact color via
  the full picker; `textGradient` — an optional text-fill gradient
  (angle + stops). Precedence: type style → colorKey → colorHex; gradient
  wins over solid when set. `fontWeight` is a free 100–900 value.

Guardrails:

- `maxLength` — hard char limit enforced by the input.
- `autoFit` (+ `minFontSizePx`) — shrink-to-fit text. Generalized from the
  reference generators: `fontSize = clamp(min, (2·width)/(len·0.58), fontSizePx)`
  (see `src/lib/render/autoFit.ts`).
- `fixedWidth` — the box width is a HARD constraint: single-line text shrinks
  at exactly the point it would escape (real canvas `measureText` in the
  field's font, letter-spacing accounted for — not the estimate above),
  multi-line wraps at the edge, and both clip so nothing leaves the box.
  Takes precedence over `autoFit` for single-line sizing.
- `aspectRatio` — enforced by the crop dialog for image fields.
- `required` — blocks download until filled.
- `placeholder` — ghost text in the form and on the canvas preview.

Identity:

- `fieldKey` — stable human slug (`team_name`) used by caption merge tags.
  Unique per template; derived from the label (never an auto index), so a
  field named "Employee name" tags as `{employee_name}`. Renaming a field
  re-derives the key AND rewrites existing tags inside `captionTemplate`
  (`retagCaption` in `src/lib/caption.ts`). Copy/paste/duplicate always mints
  a fresh unique key. Field rows are replaced wholesale on each builder save,
  and `fieldKey` is what keeps captions valid across edits.

## Rendering contract

`SchemaRenderer` renders any schema into a live-scaled canvas
(`scale = min(containerW/canvasW, containerH/canvasH, 1)`), places each field
absolutely in canvas space, and exposes `exportPng()` (dimensions from the
schema). It records `open` on mount and `download` after successful export —
the single instrumentation point for the usage dashboard. Builder previews
pass `instrument={false}`.
