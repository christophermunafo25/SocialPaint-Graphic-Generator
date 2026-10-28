import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  brandAssetSource,
  buildBrand,
  canvasScale,
  composeContext,
  contrastRatio,
  fieldFromStored,
  houseStyle,
  normalizeHex,
  parseCurrentDesigns,
  refFromStored,
  sanitizeImageRect,
  selectReferences,
  unhintedCanvas,
  type AssetRowLike,
  type ComposeContext,
  type ComposedField,
  type KitRowLike,
  type RefTemplate,
  type Row,
} from "./compose.ts";
import { COMPOSE_TOOL, composeUserText } from "./composePrompt.ts";
import {
  chooseComposeResult,
  leftOutWarnings,
  validateCompose,
  type ComposeValidation,
  type ValidatedComposeDesign,
} from "./composeValidate.ts";
import { HttpError } from "./http.ts";

// ---------------------------------------------------------------------------
// Fixtures: a small brand with three published templates
// ---------------------------------------------------------------------------

const CO = "11111111-2222-4333-8444-555555555555";
const OTHER_CO = "99999999-2222-4333-8444-555555555555";

const KIT: KitRowLike = {
  colors: [
    { key: "slime", name: "Slime", hex: "#2BFFA3", role: "primary" },
    { key: "deep_moss", name: "Deep Moss", hex: "#0C3B31", role: "secondary" },
    { key: "mint", name: "Mint", hex: "#E6FFF1" },
    { key: "midnight", name: "Midnight", hex: "#111D1B" },
  ],
  type_styles: [
    {
      key: "heading",
      name: "Heading",
      font: { source: "google", family: "Inter Tight" },
      weight: 600,
      letterSpacingPx: -2,
      lineHeight: 0.94,
      useFor: "heading",
    },
    {
      key: "body",
      name: "Body",
      font: { source: "google", family: "Inter Tight" },
      weight: 400,
      useFor: "body",
    },
  ],
  guidelines: ["The logo sits top left."],
  primary_logo_light_asset_id: "logo-light",
  primary_logo_dark_asset_id: "logo-dark",
};

const ASSETS: AssetRowLike[] = [
  {
    id: "logo-light",
    kind: "logo",
    name: "Logo black.svg",
    storage_path: `${CO}/logo/black.svg`,
    metadata: { surfaces: ["light"] },
  },
  {
    id: "logo-dark",
    kind: "logo",
    name: "Logo white.svg",
    storage_path: `brand-assets/${CO}/logo/white.svg`,
    metadata: { surfaces: ["dark"] },
  },
  {
    id: "img-1",
    kind: "image",
    name: "Product shot.png",
    storage_path: `${CO}/images/product.png`,
    metadata: { width: 1600, height: 1200 },
  },
  {
    id: "font-1",
    kind: "font",
    name: "GeistMono.woff2",
    storage_path: `${CO}/fonts/geist.woff2`,
    metadata: { family: "Geist Mono" },
  },
];

const LIGHT_LOGO = `brand-assets/${CO}/logo/black.svg`;
const DARK_LOGO = `brand-assets/${CO}/logo/white.svg`;

let sort = 0;
const row = (over: Row): Row => ({
  id: `row-${++sort}`,
  label: String(over.field_key ?? "field"),
  is_static: null,
  rotation: null,
  z_index: null,
  opacity: null,
  ...over,
});

const FEATURE: Row & { id: string } = {
  id: "tpl-feature",
  name: "Feature highlight",
  description: "A new product feature with a big headline",
  category: "Product",
  tags: ["launch", "feature"],
  canvas_width: 1080,
  canvas_height: 1350,
  background_color: "#E6FFF1",
  background_gradient: null,
  background_storage_path: null,
  canvas_effects: [{ type: "noise", color: "#1111111a", size: 1.5, density: 0.5, seed: 3 }],
  caption_template: "{headline} is here.",
};

const FEATURE_FIELDS: Row[] = [
  row({
    field_key: "panel",
    label: "Panel",
    type: "shape",
    shape: "rect",
    x: 0,
    y: 0,
    width: 1080,
    height: 700,
    color_hex: "#2BFFA3",
    corner_radius: { tl: 0, tr: 0, br: 40, bl: 40 },
    is_static: true,
  }),
  row({
    field_key: "screenshot",
    label: "Screenshot",
    type: "image",
    x: 140,
    y: 160,
    width: 800,
    height: 480,
    corner_radius: { tl: 20, tr: 20, br: 20, bl: 20 },
    effects: [{ type: "dropShadow", x: 0, y: 16, blur: 40, color: "#1111111f" }],
  }),
  row({
    field_key: "logo",
    label: "Logo",
    type: "image",
    is_static: true,
    static_value: LIGHT_LOGO,
    x: 80,
    y: 72,
    width: 180,
    height: 48,
  }),
  row({
    field_key: "eyebrow",
    label: "Eyebrow",
    type: "text",
    is_static: true,
    static_value: "New feature",
    x: 80,
    y: 760,
    width: 600,
    height: 36,
    font_size_px: 24,
    uppercase: true,
    letter_spacing_px: 1.6,
    color_hex: "#0C3B31",
  }),
  row({
    field_key: "headline",
    label: "Headline",
    type: "multiline",
    type_style_key: "heading",
    x: 80,
    y: 812,
    width: 920,
    height: 220,
    font_size_px: 88,
    color_hex: "#111D1B",
    max_length: 60,
    placeholder: "Ship your best work",
  }),
  row({
    field_key: "body",
    label: "Body",
    type: "multiline",
    type_style_key: "body",
    x: 80,
    y: 1050,
    width: 800,
    height: 110,
    font_size_px: 32,
    color_hex: "#111D1B",
  }),
  row({
    field_key: "cta",
    label: "Button",
    type: "text",
    is_static: true,
    static_value: "Try it free",
    x: 80,
    y: 1200,
    width: 300,
    height: 64,
    font_size_px: 26,
    color_hex: "#0C3B31",
    plate_color: "#2BFFA3",
    plate_padding_x: 28,
    plate_padding_y: 14,
    effects: [{ type: "dropShadow", x: 0, y: 12, blur: 32, color: "#11111126" }],
  }),
  row({
    field_key: "arrow",
    label: "Arrow",
    type: "icon",
    is_static: true,
    x: 400,
    y: 1210,
    width: 44,
    height: 44,
    color_hex: "#0C3B31",
    vector: {
      viewBox: [0, 0, 24, 24],
      paths: [{ d: "M5 12h14M13 5l7 7-7 7", paint: "stroke" }],
      stroke: { width: 2, cap: "round" },
      source: { set: "lucide", name: "arrow-right" },
    },
  }),
];

const HIRING: Row & { id: string } = {
  id: "tpl-hiring",
  name: "We're hiring",
  description: "An open role with a headshot",
  category: "Hiring",
  tags: ["jobs"],
  canvas_width: 1080,
  canvas_height: 1080,
  background_color: "#111D1B",
  background_storage_path: null,
  caption_template: "We're hiring a {role}.",
};

const HIRING_FIELDS: Row[] = [
  row({
    field_key: "sticker",
    label: "Paint sticker",
    type: "image",
    is_static: true,
    static_value: `brand-assets/${CO}/art/sticker.png`,
    x: 760,
    y: 720,
    width: 240,
    height: 240,
    rotation: 12,
    image_rect: { x: -0.25, y: 0, width: 1.5, height: 1 },
  }),
  row({
    field_key: "brand_logo",
    label: "Brand logo",
    type: "image",
    is_static: true,
    static_value: DARK_LOGO,
    x: 72,
    y: 72,
    width: 160,
    height: 44,
  }),
  row({
    field_key: "role",
    label: "Role",
    type: "text",
    type_style_key: "heading",
    x: 72,
    y: 420,
    width: 936,
    height: 160,
    font_size_px: 80,
    color_hex: "#E6FFF1",
  }),
  row({
    field_key: "details",
    label: "Details",
    type: "text",
    type_style_key: "body",
    x: 72,
    y: 600,
    width: 600,
    height: 60,
    font_size_px: 30,
    color_hex: "#E6FFF1",
  }),
];

/** A flat import: everything baked into a background image but a title. */
const FLAT: Row & { id: string } = {
  id: "tpl-flat",
  name: "Old poster",
  description: "",
  category: "",
  tags: [],
  canvas_width: 1080,
  canvas_height: 1350,
  background_storage_path: `template-backgrounds/${CO}/poster.png`,
  caption_template: "",
};
const FLAT_FIELDS: Row[] = [
  row({
    field_key: "title",
    type: "text",
    x: 80,
    y: 80,
    width: 900,
    height: 100,
    font_size_px: 64,
  }),
];

const LOGO_SOURCES = new Set([LIGHT_LOGO, DARK_LOGO]);

const published = (): RefTemplate[] =>
  [
    refFromStored("T1", FEATURE, FEATURE_FIELDS, LOGO_SOURCES),
    refFromStored("T2", HIRING, HIRING_FIELDS, LOGO_SOURCES),
    refFromStored("T3", FLAT, FLAT_FIELDS, LOGO_SOURCES),
  ].filter((r): r is RefTemplate => r !== null);

const brandFor = (kit: KitRowLike | null = KIT, assets = ASSETS) =>
  buildBrand({ kit, assets, refs: published() });

const contextFor = (over: Partial<Parameters<typeof composeContext>[0]> = {}): ComposeContext =>
  composeContext({
    canvas: { width: 1080, height: 1350 },
    brand: brandFor(),
    published: published(),
    brief: "Announce our new feature: scheduled posts, launching March 3",
    hasPhoto: false,
    ...over,
  });

/** A design the validator should accept as it stands. */
const goodDesign = (over: Row = {}): Row => ({
  name: "Feature launch",
  lead: "R1",
  background: { from: "R1" },
  elements: [
    { key: "panel", type: "shape", from: "R1.1", box: [0, 0, 1080, 640] },
    { key: "logo", type: "logo", box: [80, 72, 180, 48] },
    {
      key: "eyebrow",
      type: "text",
      from: "R1.4",
      static: true,
      value: "New feature",
      box: [80, 720, 600, 36],
    },
    {
      key: "headline",
      label: "Headline",
      type: "multiline",
      from: "R1.5",
      value: "Scheduled posts are here",
      box: [80, 772, 920, 220],
    },
    {
      key: "date",
      label: "Date",
      type: "text",
      from: "R1.6",
      value: "Launching March 3",
      box: [80, 1010, 800, 60],
    },
  ],
  caption: "{headline}, {date}.",
  why: "It follows your Feature highlight layout.",
  ...over,
});

const fieldOf = (fields: ComposedField[], key: string) => {
  const f = fields.find((x) => x.fieldKey === key);
  if (!f) throw new Error(`no field ${key}`);
  return f;
};

// ---------------------------------------------------------------------------
// Color math and stored fields
// ---------------------------------------------------------------------------

describe("color math", () => {
  it("normalizes hex and measures WCAG contrast", () => {
    expect(normalizeHex("#ABC")).toBe("#aabbcc");
    expect(normalizeHex("#11223344")).toBe("#112233");
    expect(normalizeHex("red")).toBeUndefined();
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#2bffa3", "#2bffa3")).toBeCloseTo(1, 5);
  });

  it("scales lengths between canvases by area, held between width and height", () => {
    expect(canvasScale({ width: 1080, height: 1350 }, { width: 1080, height: 1350 })).toBe(1);
    expect(canvasScale({ width: 1080, height: 1350 }, { width: 1080, height: 1080 })).toBeCloseTo(
      0.894,
      3,
    );
    expect(canvasScale({ width: 1080, height: 1350 }, { width: 1080, height: 1920 })).toBeCloseTo(
      1.193,
      3,
    );
  });
});

describe("sanitizeImageRect", () => {
  it("keeps a crop the renderer would draw and drops anything else", () => {
    expect(sanitizeImageRect({ x: -0.5, y: 0.1, width: 2, height: 1.2 })).toEqual({
      x: -0.5,
      y: 0.1,
      width: 2,
      height: 1.2,
    });
    expect(sanitizeImageRect({ x: 0, y: 0, width: 0, height: 1 })).toBeUndefined();
    expect(sanitizeImageRect({ x: 0, y: 0, width: 11, height: 1 })).toBeUndefined();
    expect(sanitizeImageRect({ x: 0, y: "0", width: 1, height: 1 })).toBeUndefined();
    expect(sanitizeImageRect(null)).toBeUndefined();
  });
});

describe("fieldFromStored", () => {
  it("reads a template_fields row and a client field alike", () => {
    const fromRow = fieldFromStored({
      field_key: "headline",
      label: "Headline",
      type: "text",
      x: "80",
      y: 100,
      width: 900,
      height: 200,
      font_size_px: "88",
      min_font_scale: "0.75",
      color_hex: "#111D1B",
      is_static: false,
      unknown_column: "kept out",
    });
    expect(fromRow).toMatchObject({
      fieldKey: "headline",
      x: 80,
      fontSizePx: 88,
      minFontScale: 0.75,
      colorHex: "#111d1b",
      static: false,
    });
    expect(fromRow && "unknown_column" in fromRow).toBe(false);
    const fromClient = fieldFromStored({
      fieldKey: "headline",
      type: "text",
      x: 80,
      y: 100,
      width: 900,
      height: 200,
      fontSizePx: 88,
    });
    expect(fromClient).toMatchObject({ fieldKey: "headline", fontSizePx: 88 });
  });

  it("turns a center-anchored box into its top-left box", () => {
    const f = fieldFromStored({
      type: "text",
      anchor: "center",
      x: 540,
      y: 100,
      width: 400,
      height: 80,
    });
    expect(f).toMatchObject({ x: 340, y: 60 });
  });

  it("drops a field with no type or box, and a vector path that is not path data", () => {
    expect(fieldFromStored({ type: "video", x: 0, y: 0, width: 10, height: 10 })).toBeNull();
    expect(fieldFromStored({ type: "text", x: 0, y: 0, width: 0, height: 10 })).toBeNull();
    const icon = fieldFromStored({
      type: "icon",
      x: 0,
      y: 0,
      width: 24,
      height: 24,
      vector: { viewBox: [0, 0, 24, 24], paths: [{ d: "<script>" }] },
    });
    expect(icon?.vector).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// References, the house style and the brand
// ---------------------------------------------------------------------------

describe("refFromStored", () => {
  const ref = refFromStored("R1", FEATURE, FEATURE_FIELDS, LOGO_SOURCES)!;

  it("numbers elements in paint order and reads each one's role", () => {
    expect(ref.elements.map((e) => [e.id, e.role, e.field.fieldKey])).toEqual([
      ["R1.1", "shape", "panel"],
      ["R1.2", "photo", "screenshot"],
      ["R1.3", "logo", "logo"],
      ["R1.4", "text", "eyebrow"],
      ["R1.5", "text", "headline"],
      ["R1.6", "text", "body"],
      ["R1.7", "text", "cta"],
      ["R1.8", "icon", "arrow"],
    ]);
    expect(ref.background).toMatchObject({ color: "#e6fff1", hasImage: false });
  });

  it("knows a logo by its Brand Studio file or by its name, and other fixed pictures as artwork", () => {
    const hiring = refFromStored("R2", HIRING, HIRING_FIELDS, new Set())!;
    expect(hiring.elements.map((e) => e.role)).toEqual(["artwork", "logo", "text", "text"]);
    const bare = refFromStored(
      "R3",
      HIRING,
      [
        row({
          field_key: "mark",
          type: "image",
          is_static: true,
          static_value: `${CO}/logo/black.svg`,
          x: 0,
          y: 0,
          width: 10,
          height: 10,
        }),
      ],
      LOGO_SOURCES,
    )!;
    expect(bare.elements[0].role).toBe("logo");
  });

  it("leaves out invisible elements", () => {
    const hidden = refFromStored(
      "R1",
      FEATURE,
      [
        ...FEATURE_FIELDS,
        row({
          field_key: "ghost",
          type: "shape",
          x: 0,
          y: 0,
          width: 10,
          height: 10,
          opacity: 0,
          color_hex: "#000000",
        }),
      ],
      LOGO_SOURCES,
    )!;
    expect(hidden.elements.some((e) => e.field.fieldKey === "ghost")).toBe(false);
  });

  it("keeps the largest panels when copy alone would fill the cap", () => {
    const labels = Array.from({ length: 26 }, (_, i) =>
      row({
        field_key: `label_${i}`,
        type: "text",
        x: 80,
        y: 40 * i,
        width: 300,
        height: 30,
        font_size_px: 20,
      }),
    );
    const panels = Array.from({ length: 6 }, (_, i) =>
      row({
        field_key: `panel_${i}`,
        type: "shape",
        x: 0,
        y: 0,
        width: 100 * (i + 1),
        height: 100 * (i + 1),
        color_hex: "#2BFFA3",
        is_static: true,
      }),
    );
    const ref = refFromStored("T1", FEATURE, [...panels, ...labels], LOGO_SOURCES)!;
    const keys = ref.elements.map((e) => e.field.fieldKey);
    expect(keys).toHaveLength(24);
    // The four largest panels, under the twenty topmost labels.
    expect(keys.slice(0, 4)).toEqual(["panel_2", "panel_3", "panel_4", "panel_5"]);
    expect(keys.slice(4)).toEqual(Array.from({ length: 20 }, (_, i) => `label_${i + 6}`));
  });

  it("keeps the copy and the logo of a template with many decorative layers", () => {
    const specks = Array.from({ length: 28 }, (_, i) =>
      row({
        field_key: `speck_${i}`,
        type: "shape",
        shape: "ellipse",
        x: 30 * i,
        y: 10,
        width: 8 + i,
        height: 8 + i,
        color_hex: "#2BFFA3",
        is_static: true,
      }),
    );
    const top = [
      row({
        field_key: "headline",
        type: "multiline",
        x: 80,
        y: 600,
        width: 900,
        height: 200,
        font_size_px: 80,
      }),
      row({
        field_key: "logo",
        label: "Logo",
        type: "image",
        is_static: true,
        static_value: LIGHT_LOGO,
        x: 80,
        y: 72,
        width: 180,
        height: 48,
      }),
    ];
    const ref = refFromStored("T1", FEATURE, [...specks, ...top], LOGO_SOURCES)!;
    expect(ref.elements).toHaveLength(24);
    expect(ref.elements.slice(-2).map((e) => [e.id, e.role, e.field.fieldKey])).toEqual([
      ["T1.23", "text", "headline"],
      ["T1.24", "logo", "logo"],
    ]);
    // The largest decorative layers stay, in paint order; the smallest go.
    const kept = ref.elements.slice(0, -2).map((e) => e.field.fieldKey);
    expect(kept[0]).toBe("speck_6");
    expect(kept.at(-1)).toBe("speck_27");
    expect(kept).not.toContain("speck_5");
  });
});

describe("selectReferences", () => {
  it("puts the template whose purpose matches the brief first and renumbers them", () => {
    const refs = selectReferences(published(), "We're hiring a senior designer", {
      width: 1080,
      height: 1350,
    });
    expect(refs.map((r) => [r.id, r.name])).toEqual([
      ["R1", "We're hiring"],
      ["R2", "Feature highlight"],
      ["R3", "Old poster"],
    ]);
    expect(refs[0].elements[0].id).toBe("R1.1");
  });

  it("prefers the requested size when the words do not decide, and ranks a flat import last", () => {
    const refs = selectReferences(published(), "Something for Friday", {
      width: 1080,
      height: 1350,
    });
    expect(refs.map((r) => r.name)).toEqual(["Feature highlight", "We're hiring", "Old poster"]);
  });

  it("caps how many it shows", () => {
    expect(selectReferences(published(), "x", { width: 1080, height: 1350 }, 2)).toHaveLength(2);
  });
});

describe("buildBrand", () => {
  it("leads with the palette and its roles, then the team's other colors and plain neutrals", () => {
    const brand = brandFor();
    expect(brand.colors.slice(0, 4).map((c) => [c.key, c.hex, c.role, c.source])).toEqual([
      ["slime", "#2bffa3", "primary", "palette"],
      ["deep_moss", "#0c3b31", "secondary", "palette"],
      ["mint", "#e6fff1", undefined, "palette"],
      ["midnight", "#111d1b", undefined, "palette"],
    ]);
    // Mint is light enough and Midnight dark enough for legible text, so no
    // plain neutral is added.
    expect(brand.colors.some((c) => c.source === "neutral")).toBe(false);
  });

  it("adds a plain white and ink when nothing in the brand is light or dark enough", () => {
    const brand = buildBrand({
      kit: {
        colors: [
          { key: "slime", name: "Slime", hex: "#2BFFA3" },
          { key: "lapis", name: "Lapis", hex: "#6EBBFF" },
        ],
      },
      assets: [],
      refs: [],
    });
    expect(brand.colors.filter((c) => c.source === "neutral").map((c) => [c.key, c.hex])).toEqual([
      ["white", "#ffffff"],
      ["ink", "#111111"],
    ]);
  });

  it("offers no color outside the palette when the brand forbids it", () => {
    const strict = brandFor({ ...KIT, allow_off_palette: false });
    expect(strict.colors.every((c) => c.source === "palette")).toBe(true);
    expect(strict.allowOffPalette).toBe(false);
  });

  it("adds colors the templates use that the palette lacks, by use", () => {
    const brand = buildBrand({
      kit: { colors: [{ key: "slime", name: "Slime", hex: "#2BFFA3" }] },
      assets: [],
      refs: published(),
    });
    const house = brand.colors.filter((c) => c.source === "house");
    expect(house.map((c) => c.hex)).toContain("#111d1b");
    expect(house.find((c) => c.hex === "#111d1b")?.usage).toContain("text");
    expect(house[0].key).toBe("house_1");
  });

  it("reads fonts, logos for each ground, images and guidelines", () => {
    const brand = brandFor();
    expect(brand.fonts).toEqual(["Inter Tight", "Geist Mono"]);
    expect(brand.logos).toEqual({ light: LIGHT_LOGO, dark: DARK_LOGO });
    expect(brand.images).toEqual([
      {
        id: "I1",
        name: "Product shot",
        source: `brand-assets/${CO}/images/product.png`,
        aspect: 1600 / 1200,
      },
    ]);
    expect(brand.guidelines).toEqual(["The logo sits top left."]);
    expect(brandAssetSource("https://cdn.example.com/logo.svg")).toBe(
      "https://cdn.example.com/logo.svg",
    );
  });

  it("falls back to the logo the team's templates place when Brand Studio has none", () => {
    const brand = buildBrand({ kit: KIT, assets: [], refs: published() });
    expect(brand.logos.light).toBe(LIGHT_LOGO);
    expect(brand.logos.dark).toBe(LIGHT_LOGO);
  });
});

describe("houseStyle", () => {
  const house = houseStyle(published(), brandFor());

  it("measures margins, the logo's habit and the type scale", () => {
    expect(house.templateCount).toBe(3);
    // Feature and the flat import keep 80 from the sides, Hiring 72; all
    // three are 1080 on their short side, as this canvas is.
    expect(house.margin!.side).toBeCloseTo(80, 5);
    expect(house.margin!.top).toBeCloseTo(72, 5);
    expect(house.logo).toMatchObject({ count: 2, corner: "top left" });
    expect(house.logo!.width).toBeCloseTo(170, 5);
    // Hiring's 80px headline, on a square, reads larger on a portrait:
    // 88, 89.4 and the flat import's 64 have a median of 88.
    expect(house.type!.headline).toBeCloseTo(88, 5);
    expect(house.type!.headlineStyle).toBe("heading");
    // The body is the copy that is not a label: 32px under Feature's 88.
    expect(house.type!.ratio).toBeCloseTo(88 / 32, 1);
  });

  it("counts grounds, radii, effects and media", () => {
    expect(house.grounds).toMatchObject({ light: 1, dark: 1, image: 1 });
    expect(house.radii.map((r) => r.radius)).toEqual([40, 20]);
    expect(house.pills).toBe(1);
    expect(house.shadows).toBe(2);
    expect(house.grain).toBe(1);
    expect(house.photos).toBe(1);
    expect(house.icons).toBe(1);
    expect(house.artwork).toBe(1);
    expect(house.fixedCopy).toEqual(["New feature", "Try it free"]);
  });
});

describe("composeContext", () => {
  it("takes the team's margin, expects the logo it carries on most posts, and caps elements", () => {
    const ctx = contextFor();
    expect(ctx.margin).toBe(80);
    expect(ctx.safeTop).toBe(80);
    expect(ctx.safeBottom).toBe(80);
    expect(ctx.expectLogo).toBe(true);
    expect(ctx.elementCap).toBe(12);
    expect(ctx.references[0].name).toBe("Feature highlight");
  });

  it("keeps a story's text out of the platform's top and bottom bands", () => {
    const ctx = contextFor({ canvas: { width: 1080, height: 1920 } });
    expect(ctx.safeTop).toBe(250);
    expect(ctx.safeBottom).toBe(450);
  });

  it("expects no logo when Brand Studio and the templates have none", () => {
    const refs = published().map((r) => ({
      ...r,
      elements: r.elements.filter((e) => e.role !== "logo"),
    }));
    const ctx = composeContext({
      canvas: { width: 1080, height: 1350 },
      brand: buildBrand({ kit: KIT, assets: [], refs }),
      published: refs,
      brief: "x",
      hasPhoto: false,
    });
    expect(ctx.expectLogo).toBe(false);
  });
});

describe("unhintedCanvas", () => {
  it("keeps a draft's size, else takes the size the team uses most, the newest on a tie", () => {
    const refs = published();
    expect(unhintedCanvas(refs)).toEqual({ width: 1080, height: 1350 });
    expect(unhintedCanvas([refs[1], refs[0]])).toEqual({ width: 1080, height: 1080 });
    const draft = refFromStored(
      "D1",
      { id: "D1", canvas_width: 1200, canvas_height: 630 },
      [],
      new Set(),
    )!;
    expect(unhintedCanvas(refs, [draft])).toEqual({ width: 1200, height: 630 });
    expect(unhintedCanvas([])).toBeUndefined();
  });
});

describe("composeUserText", () => {
  const text = composeUserText(contextFor(), { brief: "Launch day", count: 2 });

  it("gives the canvas, the brand, the house style and the references by id", () => {
    expect(text).toContain("Brief: Launch day");
    expect(text).toContain("Canvas: 1080x1350 px. Keep text, the logo and buttons at least 80px");
    expect(text).toContain("- slime #2bffa3");
    expect(text).toContain("- heading");
    expect(text).toContain('Fonts you may name in "font": Inter Tight, Geist Mono');
    expect(text).toContain('Logo: place it with a "logo" element.');
    expect(text).toContain("- I1");
    expect(text).toContain("House style, measured from the team's 3 published templates");
    expect(text).toMatch(/R1 "Feature highlight" · category "Product" · 1080x1350 \(this canvas\)/);
    expect(text).toContain('R1.7 text fixed "Try it free"');
    expect(text).toContain("plate slime pad 28x14 fully round");
    expect(text).toContain('R1.8 icon "arrow-right"');
    expect(text).toContain("Return exactly 2 designs");
  });

  it("names the photo slot rule both ways", () => {
    expect(text).toContain("has not supplied a photo");
    expect(
      composeUserText(contextFor({ hasPhoto: true }), { brief: "x", count: 1, photoAspect: 1.5 }),
    ).toContain("width over height about 1.50");
  });

  it("carries no em dash", () => {
    expect(text.includes("—")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe("validateCompose: a design built from the team's elements", () => {
  const ctx = contextFor();
  const out = validateCompose(
    { proposals: [goodDesign()], reply: "A launch post.", title: "Launch post" },
    ctx,
    1,
  );
  const [design] = out.designs;

  it("passes with no errors and keeps member values and the caption template", () => {
    expect(out.errors).toEqual([]);
    expect(design.values).toEqual({
      headline: "Scheduled posts are here",
      date: "Launching March 3",
    });
    expect(design.captionTemplate).toBe("{headline}, {date}.");
    expect(design.caption).toBe("Scheduled posts are here, Launching March 3.");
    expect(out.reply).toBe("A launch post.");
    expect(out.title).toBe("Launch post");
  });

  it("reuses the reference's ground, panel and type exactly", () => {
    expect(design.backgroundColor).toBe("#e6fff1");
    expect(design.canvasEffects).toEqual([
      { type: "noise", color: "#1111111a", size: 1.5, density: 0.5, seed: 3 },
    ]);
    expect(fieldOf(design.fields, "panel")).toMatchObject({
      type: "shape",
      shape: "rect",
      colorHex: "#2bffa3",
      cornerRadius: { tl: 0, tr: 0, br: 40, bl: 40 },
      static: true,
    });
    expect(fieldOf(design.fields, "headline")).toMatchObject({
      type: "multiline",
      typeStyleKey: "heading",
      fontSizePx: 88,
      colorHex: "#111d1b",
      maxLength: 60,
      textSizing: "shrink",
      minFontScale: 0.6,
      placeholder: "Scheduled posts are here",
    });
    expect(fieldOf(design.fields, "eyebrow")).toMatchObject({
      static: true,
      staticValue: "New feature",
      uppercase: true,
      letterSpacingPx: 1.6,
    });
  });

  it("places the logo version that reads on its ground", () => {
    // The logo sits on the Slime panel, a light ground.
    expect(fieldOf(design.fields, "logo")).toMatchObject({
      type: "image",
      static: true,
      staticValue: LIGHT_LOGO,
      objectFit: "contain",
      label: "Logo",
    });
  });

  it("paints in list order with fresh ids", () => {
    expect(design.fields.map((f) => f.zIndex)).toEqual([0, 1, 2, 3, 4]);
    expect(new Set(design.fields.map((f) => f.id)).size).toBe(5);
  });
});

describe("validateCompose: looks, scaled and checked", () => {
  it("scales a copied look to another canvas", () => {
    const ctx = contextFor({ canvas: { width: 1080, height: 1080 } });
    const out = validateCompose(
      {
        proposals: [
          goodDesign({
            elements: [
              { key: "logo", type: "logo", box: [80, 72, 180, 48] },
              {
                key: "headline",
                type: "multiline",
                from: "R1.5",
                value: "Scheduled posts",
                box: [80, 300, 920, 200],
              },
              {
                key: "cta",
                type: "text",
                from: "R1.7",
                static: true,
                value: "Try it free",
                box: [80, 900, 300, 64],
              },
            ],
          }),
        ],
      },
      ctx,
      1,
    );
    const s = canvasScale({ width: 1080, height: 1350 }, { width: 1080, height: 1080 });
    const [d] = out.designs;
    expect(fieldOf(d.fields, "headline").fontSizePx).toBeCloseTo(88 * s, 1);
    const cta = fieldOf(d.fields, "cta");
    expect(cta.platePaddingX).toBeCloseTo(28 * s, 1);
    expect(cta.effects?.[0]).toMatchObject({ type: "dropShadow", x: 0, color: "#11111126" });
    expect((cta.effects?.[0] as { blur: number }).blur).toBeCloseTo(32 * s, 1);
  });

  it("reuses icons and fixed artwork only through from", () => {
    const ctx = contextFor();
    const refs = new Map(ctx.references.map((r) => [r.name, r.id]));
    const hiring = refs.get("We're hiring")!;
    const out = validateCompose(
      {
        proposals: [
          goodDesign({
            elements: [
              ...(goodDesign().elements as Row[]),
              { key: "arrow", type: "icon", from: "R1.8", box: [400, 1100, 44, 44] },
              { key: "sticker", type: "artwork", from: `${hiring}.1`, box: [800, 1000, 200, 200] },
              { key: "drawn", type: "icon", box: [500, 1100, 44, 44] },
              { key: "invented", type: "artwork", box: [600, 1100, 44, 44] },
            ],
          }),
        ],
      },
      ctx,
      1,
    );
    const [d] = out.designs;
    expect(fieldOf(d.fields, "arrow").vector?.source).toEqual({
      set: "lucide",
      name: "arrow-right",
    });
    expect(fieldOf(d.fields, "arrow").colorHex).toBe("#0c3b31");
    expect(fieldOf(d.fields, "sticker")).toMatchObject({
      type: "image",
      static: true,
      staticValue: `brand-assets/${CO}/art/sticker.png`,
      // The template's crop, as fractions of the box, carries as it is.
      imageRect: { x: -0.25, y: 0, width: 1.5, height: 1 },
    });
    expect(d.fields.some((f) => f.fieldKey === "drawn" || f.fieldKey === "invented")).toBe(false);
    expect(out.notes).toEqual([
      'Design 1: dropped icon "Drawn". Icons can only be reused from a template.',
      'Design 1: dropped artwork "Invented". Artwork can only be reused from a template.',
    ]);
  });

  it("places a brand image by its id", () => {
    const out = validateCompose(
      {
        proposals: [
          goodDesign({
            elements: [
              ...(goodDesign().elements as Row[]).slice(0, 2),
              {
                key: "product",
                type: "brandImage",
                asset: "I1",
                radius: 20,
                box: [140, 160, 800, 440],
              },
              ...(goodDesign().elements as Row[]).slice(2),
            ],
          }),
        ],
      },
      contextFor(),
      1,
    );
    expect(fieldOf(out.designs[0].fields, "product")).toMatchObject({
      type: "image",
      static: true,
      staticValue: `brand-assets/${CO}/images/product.png`,
      cornerRadius: { tl: 20, tr: 20, br: 20, bl: 20 },
      objectFit: "cover",
    });
  });

  it("does not copy a look across kinds", () => {
    const out = validateCompose(
      {
        proposals: [
          goodDesign({
            elements: [
              ...(goodDesign().elements as Row[]),
              {
                key: "block",
                type: "shape",
                from: "R1.5",
                color: "deep_moss",
                box: [80, 1100, 200, 20],
              },
            ],
          }),
        ],
      },
      contextFor(),
      1,
    );
    expect(out.notes).toContain('Design 1: "Block": R1.5 is a text, so its look was not reused.');
    expect(fieldOf(out.designs[0].fields, "block")).toMatchObject({
      colorHex: "#0c3b31",
      shape: "rect",
    });
  });

  it("takes only brand colors, fonts and styles", () => {
    const out = validateCompose(
      {
        proposals: [
          goodDesign({
            background: { color: "neon" },
            elements: [
              ...(goodDesign().elements as Row[]),
              {
                key: "tag",
                type: "text",
                static: true,
                value: "Beta",
                style: "display",
                font: { family: "Comic Sans" },
                color: "hotpink",
                box: [700, 1100, 200, 60],
              },
              { key: "blob", type: "shape", color: "hotpink", box: [700, 1180, 100, 40] },
            ],
          }),
        ],
      },
      contextFor(),
      1,
    );
    expect(out.notes).toEqual([
      'Design 1: the ground names "neon", which is not a brand color.',
      'Design 1: "Tag": "hotpink" is not a brand color.',
      'Design 1: "Tag": type style "display" is not in the brand.',
      'Design 1: "Tag": font "Comic Sans" is not one of the brand\'s.',
      'Design 1: "Blob": "hotpink" is not a brand color.',
      'Design 1: dropped shape "Blob". Shapes need a brand color.',
    ]);
  });

  it("builds gradients, strokes, plates and effects from color keys", () => {
    const out = validateCompose(
      {
        proposals: [
          goodDesign({
            background: {
              fill: {
                kind: "radial",
                center: [0.8, 0.1],
                stops: [
                  { color: "slime", at: 0 },
                  { color: "mint", at: 1 },
                ],
              },
              grain: { color: "midnight", alpha: 0.1, size: 1.5, density: 0.6 },
            },
            elements: [
              {
                key: "card",
                type: "shape",
                color: "mint",
                radius: 24,
                stroke: { color: "slime", width: 2 },
                effects: [
                  { type: "dropShadow", y: 16, blur: 40, color: "midnight", alpha: 0.1 },
                  { type: "layerBlur", radius: 8 },
                ],
                box: [80, 300, 920, 600],
              },
              ...(goodDesign().elements as Row[]).slice(1),
              {
                key: "pill",
                type: "text",
                static: true,
                value: "Beta",
                color: "deep_moss",
                plate: { color: "slime", padX: 24, padY: 10 },
                effects: [{ type: "layerBlur", radius: 4 }],
                box: [700, 1100, 200, 60],
              },
            ],
          }),
        ],
      },
      contextFor(),
      1,
    );
    const [d] = out.designs;
    expect(d.backgroundGradient).toEqual({
      angle: 180,
      kind: "radial",
      center: { x: 0.8, y: 0.1 },
      stops: [
        { position: 0, color: "#2bffa3" },
        { position: 1, color: "#e6fff1" },
      ],
    });
    expect(d.canvasEffects).toEqual([
      { type: "noise", color: "#111d1b1a", size: 1.5, density: 0.6, seed: 7 },
    ]);
    expect(fieldOf(d.fields, "card")).toMatchObject({
      colorHex: "#e6fff1",
      cornerRadius: { tl: 24, tr: 24, br: 24, bl: 24 },
      strokeColor: "#2bffa3",
      strokeWidthPx: 2,
      effects: [
        { type: "dropShadow", x: 0, y: 16, blur: 40, color: "#111d1b1a" },
        { type: "layerBlur", radius: 8 },
      ],
    });
    expect(fieldOf(d.fields, "pill")).toMatchObject({
      plateColor: "#2bffa3",
      platePaddingX: 24,
      platePaddingY: 10,
    });
    expect(fieldOf(d.fields, "pill").effects).toBeUndefined();
    expect(out.notes).toEqual(['Design 1: "Pill": a blur only goes on shapes and images.']);
  });

  it("snaps every reused color into the palette when the brand forbids off-palette color", () => {
    const strict = brandFor({ ...KIT, allow_off_palette: false });
    const ctx = contextFor({ brand: strict });
    const out = validateCompose(
      {
        proposals: [
          goodDesign({
            elements: [
              ...(goodDesign().elements as Row[]),
              {
                key: "cta",
                type: "text",
                from: "R1.7",
                static: true,
                value: "Try it free",
                box: [80, 1180, 300, 64],
              },
            ],
          }),
        ],
      },
      ctx,
      1,
    );
    const cta = fieldOf(out.designs[0].fields, "cta");
    const palette = strict.colors.map((c) => c.hex);
    expect(palette).toContain(cta.colorHex);
    expect(palette).toContain(cta.plateColor);
    // The shadow keeps its strength in the nearest palette color.
    expect(cta.effects?.[0]).toMatchObject({ color: "#111d1b26" });
  });
});

describe("validateCompose: placement and legibility", () => {
  it("keeps text and the logo inside the margins and a story's safe band", () => {
    const ctx = contextFor({ canvas: { width: 1080, height: 1920 } });
    const out = validateCompose(
      {
        proposals: [
          goodDesign({
            elements: [
              { key: "logo", type: "logo", box: [20, 40, 180, 48] },
              {
                key: "headline",
                type: "multiline",
                from: "R1.5",
                value: "Scheduled posts",
                box: [20, 600, 1060, 300],
              },
              {
                key: "date",
                type: "text",
                from: "R1.6",
                value: "March 3",
                box: [80, 1800, 600, 60],
              },
            ],
          }),
        ],
      },
      ctx,
      1,
    );
    const [d] = out.designs;
    expect(fieldOf(d.fields, "logo")).toMatchObject({ x: 80, y: 250 });
    expect(fieldOf(d.fields, "headline")).toMatchObject({ x: 80, width: 920 });
    expect(fieldOf(d.fields, "date").y).toBe(1920 - 450 - 60);
  });

  it("chooses the logo for dark grounds over a dark panel, and honors a forced version", () => {
    const out = validateCompose(
      {
        proposals: [
          goodDesign({
            elements: [
              { key: "dark", type: "shape", color: "midnight", box: [0, 0, 1080, 300] },
              { key: "logo", type: "logo", box: [80, 72, 180, 48] },
              { key: "forced", type: "logo", surface: "light", box: [80, 1200, 180, 48] },
              {
                key: "headline",
                type: "multiline",
                from: "R1.5",
                value: "Scheduled posts",
                box: [80, 500, 920, 200],
              },
            ],
          }),
        ],
      },
      contextFor(),
      1,
    );
    const [d] = out.designs;
    expect(fieldOf(d.fields, "logo").staticValue).toBe(DARK_LOGO);
    expect(fieldOf(d.fields, "forced").staticValue).toBe(LIGHT_LOGO);
  });

  it("recolors text that would not read on its ground", () => {
    const out = validateCompose(
      {
        proposals: [
          goodDesign({
            background: { color: "midnight" },
            elements: [
              { key: "logo", type: "logo", box: [80, 72, 180, 48] },
              {
                key: "headline",
                type: "multiline",
                from: "R1.5",
                value: "Scheduled posts",
                box: [80, 500, 920, 200],
              },
            ],
          }),
        ],
      },
      contextFor(),
      1,
    );
    const headline = fieldOf(out.designs[0].fields, "headline");
    expect(headline.colorHex).not.toBe("#111d1b");
    expect(contrastRatio(headline.colorHex!, "#111d1b")).toBeGreaterThanOrEqual(3);
    // Mint: the team's own text color on dark grounds (the hiring post).
    expect(headline.colorHex).toBe("#e6fff1");
    expect(out.notes).toContain(
      'Design 1: "Headline" now uses Mint so it reads on its background.',
    );
  });

  it("moves locked text to a sibling style that reads, or keeps its face as baked values", () => {
    const kit = {
      ...KIT,
      type_styles: [
        {
          key: "heading",
          name: "Heading",
          font: { source: "google", family: "Inter Tight" },
          weight: 600,
          colorKey: "midnight",
          useFor: "heading",
        },
        {
          key: "heading_dark",
          name: "Heading on dark",
          font: { source: "google", family: "Inter Tight" },
          weight: 600,
          colorKey: "mint",
          useFor: "heading",
        },
        {
          key: "label",
          name: "Label",
          font: { source: "google", family: "Geist Mono" },
          weight: 500,
          colorKey: "midnight",
          uppercase: true,
        },
      ],
    };
    const ctx = contextFor({ brand: buildBrand({ kit, assets: ASSETS, refs: published() }) });
    const out = validateCompose(
      {
        proposals: [
          goodDesign({
            background: { color: "midnight" },
            elements: [
              { key: "logo", type: "logo", box: [80, 72, 180, 48] },
              {
                key: "headline",
                type: "multiline",
                style: "heading",
                value: "Scheduled posts",
                size: 88,
                box: [80, 500, 920, 200],
              },
              {
                key: "kicker",
                type: "text",
                static: true,
                style: "label",
                value: "New",
                size: 24,
                box: [80, 440, 300, 40],
              },
            ],
          }),
        ],
      },
      ctx,
      1,
    );
    const [d] = out.designs;
    expect(fieldOf(d.fields, "headline").typeStyleKey).toBe("heading_dark");
    const kicker = fieldOf(d.fields, "kicker");
    expect(kicker.typeStyleKey).toBeUndefined();
    expect(kicker).toMatchObject({ fontFamily: "Geist Mono", fontWeight: 500, uppercase: true });
    expect(contrastRatio(kicker.colorHex!, "#111d1b")).toBeGreaterThanOrEqual(4.5);
  });

  it("sends text straight on a photo back, and lets a scrim carry it", () => {
    const photo = { key: "photo", type: "image", label: "Photo", box: [0, 0, 1080, 1350] };
    const onPhoto = validateCompose(
      {
        proposals: [
          goodDesign({
            elements: [
              photo,
              { key: "logo", type: "logo", box: [80, 72, 180, 48] },
              {
                key: "headline",
                type: "multiline",
                from: "R1.5",
                value: "Scheduled posts",
                box: [80, 900, 920, 200],
              },
            ],
          }),
        ],
      },
      contextFor({ hasPhoto: true }),
      1,
    );
    expect(onPhoto.designs).toEqual([]);
    expect(onPhoto.errors).toContain(
      'Design 1: text "Headline" sits straight on a photo. Put a plate behind it, or a panel between the photo and the text.',
    );
    const scrim = validateCompose(
      {
        proposals: [
          goodDesign({
            elements: [
              photo,
              {
                key: "scrim",
                type: "shape",
                color: "midnight",
                opacity: 70,
                box: [0, 800, 1080, 550],
              },
              { key: "logo", type: "logo", box: [80, 72, 180, 48] },
              {
                key: "headline",
                type: "multiline",
                from: "R1.5",
                color: "white",
                value: "Scheduled posts",
                box: [80, 900, 920, 200],
              },
            ],
          }),
        ],
      },
      contextFor({ hasPhoto: true }),
      1,
    );
    expect(scrim.errors).toEqual([]);
    expect(scrim.designs[0].imageFieldsNeeded).toEqual([
      { fieldKey: "photo", label: "Photo", required: true },
    ]);
  });

  it("sends overlapping text and a missing logo back for the retry", () => {
    const out = validateCompose(
      {
        proposals: [
          goodDesign({
            elements: [
              {
                key: "headline",
                type: "multiline",
                from: "R1.5",
                value: "Scheduled posts",
                box: [80, 500, 920, 200],
              },
              {
                key: "date",
                type: "text",
                from: "R1.6",
                value: "March 3",
                box: [80, 600, 920, 60],
              },
            ],
          }),
        ],
      },
      contextFor(),
      1,
    );
    expect(out.designs).toEqual([]);
    expect(out.errors).toEqual([
      'Design 1: "Headline" and "Date" overlap. Give each its own space.',
      'Design 1: the logo is missing. The team carries it on most posts, usually top left; add a "logo" element.',
    ]);
  });

  it("leaves the logo out with a warning when the brand has none", () => {
    const refs = published().map((r) => ({
      ...r,
      elements: r.elements.filter((e) => e.role !== "logo"),
    }));
    const brand = buildBrand({ kit: KIT, assets: [], refs });
    const ctx = composeContext({
      canvas: { width: 1080, height: 1350 },
      brand,
      published: refs,
      brief: "x",
      hasPhoto: false,
    });
    const out = validateCompose({ proposals: [goodDesign(), goodDesign()] }, ctx, 2);
    expect(out.errors).toEqual([]);
    // Once, about the brand, however many designs wanted the logo.
    expect(out.warnings).toEqual([
      "Your brand has no logo file yet, so these designs leave it out.",
    ]);
  });
});

describe("validateCompose: what survives", () => {
  it("keeps the first designs the count allows, and caps elements", () => {
    const many = Array.from({ length: 16 }, (_, i) => ({
      key: `dot_${i}`,
      type: "shape",
      color: "slime",
      box: [80 + i * 50, 1250, 20, 20],
    }));
    const out = validateCompose(
      {
        proposals: [
          goodDesign({ elements: [...(goodDesign().elements as Row[]), ...many] }),
          goodDesign(),
        ],
      },
      contextFor(),
      1,
    );
    expect(out.designs).toHaveLength(1);
    expect(out.designs[0].fields).toHaveLength(12);
    expect(out.notes.slice(0, 2)).toEqual([
      "The model returned 2 designs. Keeping the first 1.",
      "Design 1: 21 elements. Keeping the first 12.",
    ]);
  });

  it("keeps a hairline rule, a shape thin on one side only", () => {
    const out = validateCompose(
      {
        proposals: [
          goodDesign({
            elements: [
              ...(goodDesign().elements as Row[]),
              { key: "rule", type: "shape", color: "deep_moss", box: [80, 1100, 920, 1] },
              { key: "speck", type: "shape", color: "deep_moss", box: [80, 1150, 4, 4] },
            ],
          }),
        ],
      },
      contextFor(),
      1,
    );
    expect(fieldOf(out.designs[0].fields, "rule")).toMatchObject({ width: 920, height: 1 });
    expect(out.notes).toEqual(['Design 1: dropped "Speck", box under 8px after clamping.']);
  });

  it("drops what cannot be drawn and says why", () => {
    const out = validateCompose(
      {
        proposals: [
          goodDesign({
            caption: "Hi {ghost}",
            elements: [
              ...(goodDesign().elements as Row[]),
              { key: "weird", type: "video", box: [0, 0, 100, 100] },
              { key: "boxless", type: "text", value: "x" },
              { key: "sliver", type: "text", value: "x", box: [80, 1200, 4, 4] },
              { key: "away", type: "shape", color: "slime", box: [2000, 0, 100, 100] },
              { key: "tagline", type: "text", static: true, value: "", box: [80, 1180, 300, 40] },
              { key: "blank", type: "text", label: "Location", box: [600, 1180, 300, 40] },
            ],
          }),
        ],
      },
      contextFor(),
      1,
    );
    expect(out.notes).toEqual([
      'Design 1: dropped "Weird", unknown type "video".',
      'Design 1: dropped "Boxless", no usable box.',
      'Design 1: dropped "Sliver", box under 8px after clamping.',
      'Design 1: dropped "Away", it lies off the canvas.',
      'Design 1: dropped fixed text "Tagline", no content.',
      'Design 1: editable "Location" has no value, left for the member.',
      "Design 1: caption tag {ghost} doesn't match any field, so it was removed.",
    ]);
    expect(out.designs[0].caption).toBe("Hi");
  });

  it("refuses a design with too little left, keeping the model-facing dash for the retry", () => {
    const out = validateCompose(
      {
        proposals: [
          goodDesign({ elements: [{ key: "logo", type: "logo", box: [80, 72, 180, 48] }] }),
        ],
      },
      contextFor(),
      1,
    );
    expect(out.designs).toEqual([]);
    expect(out.errors).toEqual([
      "Design 1: too little survived validation (1 elements, 0 editable text) — propose a fuller design.",
    ]);
    expect(leftOutWarnings(out.errors)).toEqual([
      "One design didn't pass the brand checks, so it was left out.",
    ]);
  });

  it("says so when nothing came back at all", () => {
    expect(validateCompose({}, contextFor(), 1).errors).toEqual([
      "No usable designs survived validation.",
    ]);
    expect(validateCompose(null, contextFor(), 1).errors).toEqual([
      "No usable designs survived validation.",
    ]);
  });

  it("keeps what the checks corrected out of what the member reads", () => {
    const out = validateCompose(
      {
        proposals: [
          goodDesign({
            background: { color: "ghost — bg" },
            elements: [
              ...(goodDesign().elements as Row[]),
              { key: "stray", label: "Stray—thing", type: "bogus — x", box: [0, 0, 10, 10] },
            ],
          }),
        ],
      },
      contextFor(),
      1,
    );
    expect(out.warnings).toEqual([]);
    expect(out.notes).toEqual([
      'Design 1: the ground names "ghost — bg", which is not a brand color.',
      'Design 1: dropped "Stray—thing", unknown type "bogus — x".',
    ]);
  });

  it("writes no em dash into any warning or note in the source", () => {
    const source = readFileSync(new URL("./composeValidate.ts", import.meta.url), "utf8");
    const calls = [...source.matchAll(/(?:warnings|notes)\.push\(([\s\S]*?)\);/g)].map((m) => m[1]);
    expect(calls.length).toBeGreaterThan(15);
    expect(calls.filter((c) => c.includes("—") || c.includes("\\u2014"))).toEqual([]);
  });
});

describe("validateCompose: photos, contrast and odd input", () => {
  const withPhoto = () =>
    goodDesign({
      elements: [
        ...(goodDesign().elements as Row[]),
        { key: "photo", type: "image", from: "R1.2", box: [140, 160, 800, 400] },
      ],
    });

  it("keeps one required slot for the member's photo and makes any other optional", () => {
    const two = goodDesign({
      elements: [
        ...(goodDesign().elements as Row[]),
        { key: "photo", type: "image", from: "R1.2", box: [140, 160, 380, 400] },
        { key: "second", type: "image", box: [560, 160, 380, 400] },
      ],
    });
    const out = validateCompose({ proposals: [two] }, contextFor({ hasPhoto: true }), 1);
    expect(out.errors).toEqual([]);
    expect(out.designs[0].imageFieldsNeeded.map((f) => [f.fieldKey, f.required])).toEqual([
      ["photo", true],
      ["second", false],
    ]);
  });

  it("makes a photo slot optional when the member sent no photo", () => {
    const none = validateCompose({ proposals: [withPhoto()] }, contextFor(), 1);
    expect(none.errors).toEqual([]);
    expect(fieldOf(none.designs[0].fields, "photo").optional).toBe(true);
    expect(none.designs[0].imageFieldsNeeded).toEqual([
      { fieldKey: "photo", label: "Photo", required: false },
    ]);
    const sent = validateCompose({ proposals: [withPhoto()] }, contextFor({ hasPhoto: true }), 1);
    expect(fieldOf(sent.designs[0].fields, "photo").optional).toBeUndefined();
    expect(sent.designs[0].imageFieldsNeeded[0].required).toBe(true);
  });

  it("sends a design back when no brand color reads on its ground", () => {
    const steel: KitRowLike = {
      colors: [
        { key: "steel", name: "Steel", hex: "#5A7D9A", role: "primary" },
        { key: "ink", name: "Ink", hex: "#262A33" },
        { key: "paper", name: "Paper", hex: "#F4F6F8" },
      ],
      type_styles: [],
      guidelines: [],
    };
    const ctx = composeContext({
      canvas: { width: 1080, height: 1350 },
      brand: buildBrand({ kit: steel, assets: [], refs: [] }),
      published: [],
      brief: "Quarterly update",
      hasPhoto: false,
    });
    const design = (bodySize: number) => ({
      proposals: [
        {
          name: "Steel",
          background: { color: "steel" },
          elements: [
            {
              key: "headline",
              type: "multiline",
              color: "paper",
              value: "Quarterly update",
              size: 96,
              box: [80, 300, 920, 240],
            },
            {
              key: "body",
              label: "Body",
              type: "multiline",
              color: "paper",
              value: "What changed this quarter, and why it matters to you.",
              size: bodySize,
              box: [80, 600, 900, 160],
            },
          ],
          caption: "",
          why: "",
        },
      ],
    });
    // Paper on steel is 4:1: enough for a 96px headline, not for body copy.
    const body = validateCompose(design(30), ctx, 1);
    expect(body.designs).toEqual([]);
    expect(body.errors).toEqual([
      'Design 1: no brand color reads on the ground under "Body" (the best reaches 4:1 and it needs 4.5:1). Put it on another ground, a panel or a plate.',
    ]);
    expect(validateCompose(design(60), ctx, 1).errors).toEqual([]);
  });

  it("drops an element whose type is a built-in property name instead of throwing", () => {
    const out = validateCompose(
      {
        proposals: [
          goodDesign({
            elements: [
              ...(goodDesign().elements as Row[]),
              { key: "odd", type: "constructor", from: "R1.1", box: [0, 0, 100, 100] },
            ],
          }),
        ],
      },
      contextFor(),
      1,
    );
    expect(out.errors).toEqual([]);
    expect(out.notes).toContain('Design 1: dropped "Odd", unknown type "constructor".');
  });
});

describe("the answer a compose request keeps", () => {
  const answer = (designs: number, over: Partial<ComposeValidation> = {}): ComposeValidation => ({
    designs: Array.from(
      { length: designs },
      (_, i) => ({ name: `Design ${i + 1}` }) as ValidatedComposeDesign,
    ),
    warnings: [],
    notes: [],
    errors: [],
    ...over,
  });

  it("takes the retry unless it saved fewer designs, and keeps both answers' notes", () => {
    const first = answer(1, {
      errors: ["Design 2: overlap."],
      notes: ["first"],
      reply: "First reply.",
      title: "First",
    });
    const better = chooseComposeResult(first, answer(2, { notes: ["second"], title: "Second" }));
    expect(better.designs).toHaveLength(2);
    expect(better.errors).toEqual([]);
    expect(better.notes).toEqual(["first", "second"]);
    expect([better.reply, better.title]).toEqual(["First reply.", "Second"]);

    const worse = chooseComposeResult(answer(2), answer(1, { errors: ["Design 2: overlap."] }));
    expect(worse.designs).toHaveLength(2);
    expect(worse.errors).toEqual([]);
  });

  it("gives way to the retry when the first answer saved nothing", () => {
    const out = chooseComposeResult(
      answer(0, { errors: ["Design 1: a."] }),
      answer(0, { errors: ["Design 1: b."] }),
    );
    expect(out.errors).toEqual(["Design 1: b."]);
  });

  it("tells the member how many designs were left out, in plain words", () => {
    expect(leftOutWarnings([])).toEqual([]);
    expect(leftOutWarnings(["No usable designs survived validation."])).toEqual([]);
    expect(leftOutWarnings(["Design 2: overlap.", "Design 2: the logo is missing."])).toEqual([
      "One design didn't pass the brand checks, so it was left out.",
    ]);
    expect(leftOutWarnings(["Design 1: overlap.", "Design 3: overlap."])).toEqual([
      "2 designs didn't pass the brand checks, so they were left out.",
    ]);
  });
});

describe("a logo drawn as vector art in the team's templates", () => {
  const GTM: Row & { id: string } = {
    id: "tpl-gtm",
    name: "Feature highlight",
    description: "",
    category: "Product",
    tags: [],
    canvas_width: 1080,
    canvas_height: 1350,
    background_color: "#FFFFFF",
    caption_template: "",
  };
  const GTM_FIELDS: Row[] = [
    row({
      field_key: "logo",
      label: "Logo",
      type: "icon",
      is_static: true,
      x: 69,
      y: 106,
      width: 267,
      height: 47,
      color_hex: "#272727",
      vector: { viewBox: [0, 0, 267, 47], paths: [{ d: "M0 0h267v47H0z" }] },
    }),
    row({
      field_key: "headline",
      label: "Headline",
      type: "multiline",
      x: 69,
      y: 217,
      width: 903,
      height: 351,
      font_size_px: 96,
      color_hex: "#232323",
    }),
  ];
  const refs = [refFromStored("T1", GTM, GTM_FIELDS, new Set())!];
  const brand = buildBrand({ kit: KIT, assets: [], refs });
  const ctx = composeContext({
    canvas: { width: 1080, height: 1350 },
    brand,
    published: refs,
    brief: "Launch day",
    hasPhoto: false,
  });

  it("reads the vector as the logo and expects it, with no logo file in Brand Studio", () => {
    expect(refs[0].elements[0].role).toBe("logo");
    expect(ctx.expectLogo).toBe(true);
    expect(composeUserText(ctx, { brief: "x", count: 1 })).toContain(
      "The team's own logo art is used, colored to read on the ground under it.",
    );
  });

  it("places the team's vector logo, recolored for a dark ground", () => {
    const out = validateCompose(
      {
        proposals: [
          {
            name: "Dark launch",
            background: { color: "midnight" },
            elements: [
              { key: "logo", type: "logo", box: [80, 96, 267, 47] },
              {
                key: "headline",
                type: "multiline",
                color: "mint",
                value: "Launch day",
                size: 96,
                box: [80, 400, 920, 240],
              },
            ],
            caption: "",
            why: "",
          },
        ],
      },
      ctx,
      1,
    );
    expect(out.errors).toEqual([]);
    const logo = fieldOf(out.designs[0].fields, "logo");
    expect(logo).toMatchObject({ type: "icon", static: true, label: "Logo" });
    expect(logo.vector?.paths[0].d).toBe("M0 0h267v47H0z");
    expect(contrastRatio(logo.colorHex!, "#111d1b")).toBeGreaterThanOrEqual(3);
  });

  it("uses that logo even when the brief picks a template without it", () => {
    const as = (id: string, name: string, fields: Row[]) =>
      refFromStored(id, { ...GTM, id: `tpl-${id}`, name }, fields, new Set())!;
    const all = [
      refs[0],
      as("T2", "Product update", GTM_FIELDS),
      as("T3", "We're hiring", [GTM_FIELDS[1]]),
    ];
    const hiring = composeContext({
      canvas: { width: 1080, height: 1350 },
      brand: buildBrand({ kit: KIT, assets: [], refs: all }),
      published: all,
      brief: "We're hiring a senior designer",
      hasPhoto: false,
      referenceCap: 1,
    });
    expect(hiring.references.map((r) => r.name)).toEqual(["We're hiring"]);
    expect(hiring.expectLogo).toBe(true);
    expect(composeUserText(hiring, { brief: "x", count: 1 })).toContain(
      "The team's own logo art is used",
    );
    const out = validateCompose(
      {
        proposals: [
          {
            name: "Hiring",
            background: { color: "mint" },
            elements: [
              { key: "logo", type: "logo", box: [80, 96, 267, 47] },
              {
                key: "headline",
                type: "multiline",
                color: "midnight",
                value: "We're hiring",
                size: 96,
                box: [80, 400, 920, 240],
              },
            ],
            caption: "",
            why: "",
          },
        ],
      },
      hiring,
      1,
    );
    expect(out.errors).toEqual([]);
    expect(fieldOf(out.designs[0].fields, "logo").type).toBe("icon");
  });
});

// ---------------------------------------------------------------------------
// The member's current drafts
// ---------------------------------------------------------------------------

describe("parseCurrentDesigns", () => {
  const design = {
    name: "Feature launch",
    canvasWidth: 1080,
    canvasHeight: 1350,
    backgroundColor: "#e6fff1",
    captionTemplate: "{headline}",
    fields: [
      {
        id: "a",
        fieldKey: "logo",
        label: "Logo",
        type: "image",
        static: true,
        staticValue: LIGHT_LOGO,
        x: 80,
        y: 72,
        width: 180,
        height: 48,
      },
      {
        id: "b",
        fieldKey: "foreign",
        label: "Sticker",
        type: "image",
        static: true,
        staticValue: `brand-assets/${OTHER_CO}/x.png`,
        x: 0,
        y: 0,
        width: 10,
        height: 10,
      },
      {
        id: "c",
        fieldKey: "url",
        label: "Photo",
        type: "image",
        static: true,
        staticValue: "https://evil.example.com/x.png",
        x: 0,
        y: 0,
        width: 10,
        height: 10,
      },
      {
        id: "d",
        fieldKey: "headline",
        label: "Headline",
        type: "multiline",
        x: 80,
        y: 772,
        width: 920,
        height: 220,
        fontSizePx: 88,
      },
    ],
  };

  it("keeps this company's images, the member's text, and reads the logo as a logo", () => {
    const [d] = parseCurrentDesigns(
      [
        {
          design,
          values: [
            { fieldKey: "headline", value: "Scheduled posts" },
            { fieldKey: "photo", value: "data:image/png;base64,AAAA" },
          ],
        },
      ],
      CO,
    )!;
    expect(d.id).toBe("D1");
    expect(d.elements.map((e) => [e.id, e.role, e.field.fieldKey])).toEqual([
      ["D1.1", "logo", "logo"],
      ["D1.2", "text", "headline"],
    ]);
    expect(d.values).toEqual({ headline: "Scheduled posts" });
  });

  it("keeps fixed text and drops another company's image or mask in either spelling", () => {
    const box = { x: 80, y: 80, width: 300, height: 40 };
    const [d] = parseCurrentDesigns(
      [
        {
          design: {
            ...design,
            fields: [
              {
                ...box,
                id: "e",
                fieldKey: "eyebrow",
                label: "Eyebrow",
                type: "text",
                static: true,
                staticValue: "NEW FEATURE",
              },
              {
                ...box,
                id: "f",
                field_key: "art",
                label: "Art",
                type: "image",
                is_static: true,
                static_value: `brand-assets/${OTHER_CO}/x.png`,
              },
              {
                ...box,
                id: "g",
                fieldKey: "masked",
                label: "Photo",
                type: "image",
                mask_url: `template-backgrounds/${OTHER_CO}/mask.png`,
              },
              {
                ...box,
                id: "h",
                fieldKey: "texture",
                label: "Texture",
                type: "image",
                static: true,
                staticValue: `${CO}/textures/grain.png`,
              },
            ],
          },
          values: [],
        },
      ],
      CO,
    )!;
    expect(d.elements.map((e) => [e.role, e.field.label])).toEqual([
      ["text", "Eyebrow"],
      ["artwork", "Texture"],
    ]);
    expect(d.elements[0].field.staticValue).toBe("NEW FEATURE");
  });

  it("refuses the wrong shape with a 400 that names it", () => {
    const status = (raw: unknown) => {
      try {
        parseCurrentDesigns(raw, CO);
      } catch (e) {
        return e instanceof HttpError ? `${e.status} ${e.message}` : "other";
      }
      return "ok";
    };
    expect(status(undefined)).toBe("ok");
    expect(status("x")).toBe("400 currentDesigns must be an array of at most 3 entries.");
    expect(status([{ design: {} }])).toBe(
      "400 currentDesigns[0].design must be an object with a fields array.",
    );
    expect(status([{ design: { fields: [], canvasWidth: 0 } }])).toBe(
      "400 currentDesigns[0].design needs a canvasWidth and canvasHeight.",
    );
    expect(status([{ design: { ...design, fields: Array(41).fill(design.fields[3]) } }])).toBe(
      "400 currentDesigns[0].design.fields must have at most 40 entries.",
    );
  });

  it("lets a revision reuse the draft's elements by id", () => {
    const drafts = parseCurrentDesigns([{ design, values: [] }], CO)!;
    const ctx = contextFor({ drafts });
    expect(composeUserText(ctx, { brief: "Make it Friday", count: 1 })).toContain(
      'D1.2 multiline member "Headline" [80,772,920,220]',
    );
    const out = validateCompose(
      {
        proposals: [
          goodDesign({
            elements: [
              { key: "logo", type: "logo", from: "D1.1", box: [80, 72, 180, 48] },
              {
                key: "headline",
                type: "multiline",
                from: "D1.2",
                value: "Scheduled posts, Friday",
                box: [80, 772, 920, 220],
              },
            ],
          }),
        ],
      },
      ctx,
      1,
    );
    expect(out.errors).toEqual([]);
    expect(fieldOf(out.designs[0].fields, "headline").fontSizePx).toBe(88);
  });
});

// ---------------------------------------------------------------------------
// The tool and the prompt
// ---------------------------------------------------------------------------

describe("the compose tool", () => {
  it("offers exactly the element types the validator builds", () => {
    const element = (
      COMPOSE_TOOL.input_schema.properties.proposals.items.properties.elements as {
        items: { properties: { type: { enum: string[] } } };
      }
    ).items.properties.type.enum;
    expect(element.sort()).toEqual(
      ["artwork", "brandImage", "icon", "image", "logo", "multiline", "shape", "text"].sort(),
    );
  });
});

describe("the compose system prompt", () => {
  const source = readFileSync(new URL("../template-generate/prompt.ts", import.meta.url), "utf8");
  const compose = source.slice(source.indexOf("export const COMPOSE_SYSTEM_PROMPT"));

  it("carries no em dash, since the model copies it into captions", () => {
    expect(compose.includes("—")).toBe(false);
  });

  it("tells the model to lead with the team's templates and reuse their looks", () => {
    expect(compose).toContain("## Learn from the team's templates");
    expect(compose).toContain('Reuse the team\'s elements with "from"');
    expect(compose).toContain("Every color is a key from the color list");
    expect(compose).toContain('The logo comes only from a "logo" element');
    expect(compose).toContain("Never put text straight onto a photo slot");
    expect(compose).toContain(
      "Never invent names, dates, prices, links, places, quotes or numbers",
    );
    expect(compose).toContain("## Follow-ups");
  });
});
