import { describe, expect, it } from "vitest";
import {
  SURROGATE_TEMPLATE_ID,
  buildPublicPayload,
  findUnsignedRefs,
  payloadAssetRefs,
  signValue,
  type Row,
} from "./publicTemplate.ts";

/** A templates row as Postgres hands it over, including every column that
 * must NOT reach a public visitor. */
const TEMPLATE: Row = {
  id: "8f1c0f5e-1111-4444-8888-aaaaaaaaaaaa",
  company_id: "c0000000-0000-4000-8000-000000000001",
  name: "Speaker announcement",
  description: "Square graphic for the confirmation email",
  category: "events",
  tags: ["conference", "internal-only"],
  status: "published",
  canvas_width: 1440,
  canvas_height: 1440,
  background_storage_path: "template-backgrounds/co/bg.png",
  background_color: null,
  background_gradient: null,
  layout_groups: null,
  caption_template: "{name} is speaking!",
  autobuild_meta: {
    model: "internal-model-name",
    sourceKind: "figma",
    rationale: [{ fieldKey: "name", why: "How this customer works" }],
  },
  created_at: "2026-01-02T03:04:05Z",
  updated_at: "2026-02-02T03:04:05Z",
};

const FIELDS: Row[] = [
  {
    id: "aaaaaaaa-1111-4444-8888-aaaaaaaaaaaa",
    sort_order: 0,
    field_key: "name",
    label: "Your name",
    type: "text",
    type_style_key: "heading",
    font_family: null,
    static_value: null,
    required: true,
    max_length: 40,
  },
  {
    id: "bbbbbbbb-2222-4444-8888-bbbbbbbbbbbb",
    sort_order: 1,
    field_key: "logo",
    label: "Logo",
    type: "image",
    type_style_key: null,
    font_family: null,
    is_static: true,
    static_value: "brand-assets/co/logo.png",
    required: false,
  },
  {
    id: "cccccccc-3333-4444-8888-cccccccccccc",
    sort_order: 2,
    field_key: "headshot",
    label: "Your photo",
    type: "image",
    type_style_key: null,
    font_family: "Archivo",
    static_value: null,
    required: true,
  },
];

const BRAND_KIT: Row = {
  colors: [
    { key: "ink", name: "Ink", hex: "#101010" },
    { key: "unused", name: "Confidential Accent", hex: "#ABCDEF" },
  ],
  type_styles: [
    { key: "heading", font: { source: "custom", family: "Cooper Display" }, colorKey: "ink" },
    { key: "never-bound", font: { source: "google", family: "Oswald" }, colorKey: "unused" },
  ],
  guidelines: ["Never place the logo on a photograph."],
  heading_font: { source: "custom", family: "Cooper Display" },
  body_font: { source: "google", family: "Inter" },
  primary_logo_asset_id: "dddddddd-4444-4444-8888-dddddddddddd",
};

const FONT_ASSETS: Row[] = [
  {
    name: "Cooper-Bold.woff2",
    storage_path: "brand-assets/co/fonts/cooper.woff2",
    metadata: { family: "Cooper Display", weight: 700, format: "woff2" },
  },
  {
    name: "Unrelated-Regular.woff2",
    storage_path: "brand-assets/co/fonts/unrelated.woff2",
    metadata: { family: "Unrelated Sans" },
  },
];

const SIGNED = new Map([
  [
    "template-backgrounds/co/bg.png",
    "https://x.supabase.co/storage/v1/object/sign/template-backgrounds/co/bg.png?token=A",
  ],
  [
    "brand-assets/co/logo.png",
    "https://x.supabase.co/storage/v1/object/sign/brand-assets/co/logo.png?token=B",
  ],
  [
    "brand-assets/co/fonts/cooper.woff2",
    "https://x.supabase.co/storage/v1/object/sign/brand-assets/co/fonts/cooper.woff2?token=C",
  ],
]);

const build = (over: Partial<Parameters<typeof buildPublicPayload>[0]> = {}) =>
  buildPublicPayload({
    template: TEMPLATE,
    fields: FIELDS,
    brandKit: BRAND_KIT,
    fontAssets: FONT_ASSETS,
    signed: SIGNED,
    allowUploads: true,
    assetTtlSeconds: 300,
    ...over,
  });

describe("payloadAssetRefs", () => {
  it("names the background, static images, and only the fonts in use", () => {
    const refs = payloadAssetRefs({
      template: TEMPLATE,
      fields: FIELDS,
      brandKit: BRAND_KIT,
      fontAssets: FONT_ASSETS,
    });
    expect(refs.map((r) => `${r.bucket}/${r.path}`).sort()).toEqual([
      "brand-assets/co/fonts/cooper.woff2",
      "brand-assets/co/logo.png",
      "template-backgrounds/co/bg.png",
    ]);
  });

  it("does not name a font whose family no field renders with", () => {
    const refs = payloadAssetRefs({
      template: TEMPLATE,
      fields: FIELDS,
      brandKit: BRAND_KIT,
      fontAssets: FONT_ASSETS,
    });
    expect(refs.some((r) => r.path.includes("unrelated"))).toBe(false);
  });
});

describe("buildPublicPayload — what does NOT cross the boundary", () => {
  const payload = build();
  const asText = JSON.stringify(payload);

  it("withholds the company id", () => {
    expect(payload.template.company_id).toBe("");
    expect(asText).not.toContain("c0000000-0000-4000-8000-000000000001");
  });

  it("withholds the internal template id and every field row id", () => {
    expect(payload.template.id).toBe(SURROGATE_TEMPLATE_ID);
    expect(asText).not.toContain("8f1c0f5e-1111-4444-8888-aaaaaaaaaaaa");
    for (const field of FIELDS) expect(asText).not.toContain(field.id as string);
    const ids = (payload.template.template_fields as Row[]).map((f) => f.id);
    expect(ids).toEqual(["f1", "f2", "f3"]);
  });

  it("withholds the parent id from every field row", () => {
    for (const field of payload.template.template_fields as Row[]) {
      expect(field).not.toHaveProperty("template_id");
    }
  });

  it("withholds build provenance, taxonomy, and timestamps", () => {
    expect(payload.template.autobuild_meta).toBeNull();
    expect(payload.template.category).toBe("");
    expect(payload.template.tags).toEqual([]);
    expect(payload.template.created_at).toBe("");
    expect(asText).not.toContain("internal-model-name");
    expect(asText).not.toContain("How this customer works");
    expect(asText).not.toContain("internal-only");
  });

  it("withholds brand guidelines, the logo pointer, and the kit's fonts", () => {
    expect(payload.brandKit.guidelines).toEqual([]);
    expect(payload.brandKit.primary_logo_asset_id).toBeNull();
    expect(payload.brandKit.heading_font).toBeNull();
    expect(payload.brandKit.body_font).toBeNull();
    expect(asText).not.toContain("Never place the logo on a photograph.");
    expect(asText).not.toContain("dddddddd-4444-4444-8888-dddddddddddd");
  });

  it("withholds palette entries and type styles nothing binds to", () => {
    expect((payload.brandKit.colors as Array<{ key: string }>).map((c) => c.key)).toEqual(["ink"]);
    expect((payload.brandKit.type_styles as Array<{ key: string }>).map((s) => s.key)).toEqual([
      "heading",
    ]);
    expect(asText).not.toContain("Confidential Accent");
    expect(asText).not.toContain("#ABCDEF");
  });

  it("withholds font files for families the schema never renders", () => {
    expect(payload.fontAssets).toHaveLength(1);
    expect(payload.fontAssets[0].name).toBe("Cooper-Bold.woff2");
    expect(asText).not.toContain("unrelated.woff2");
  });
});

describe("buildPublicPayload — what the visitor does receive", () => {
  const payload = build();

  it("keeps everything the canvas renders from", () => {
    expect(payload.template.name).toBe("Speaker announcement");
    expect(payload.template.canvas_width).toBe(1440);
    expect(payload.template.caption_template).toBe("{name} is speaking!");
    expect(payload.template.status).toBe("published");
    const fields = payload.template.template_fields as Row[];
    expect(fields.map((f) => f.field_key)).toEqual(["name", "logo", "headshot"]);
    // The guardrails travel with the field, so what the admin locked stays
    // locked on the public page.
    expect(fields[0].max_length).toBe(40);
    expect(fields[0].required).toBe(true);
  });

  it("replaces every storage reference with a signed URL", () => {
    expect(payload.template.background_storage_path).toContain("/object/sign/");
    const logo = (payload.template.template_fields as Row[])[1];
    expect(logo.static_value).toContain("/object/sign/");
    expect(payload.fontAssets[0].storage_path).toContain("/object/sign/");
    expect(findUnsignedRefs(payload)).toEqual([]);
  });

  it("carries the upload switch and the signature lifetime", () => {
    expect(payload.allowUploads).toBe(true);
    expect(build({ allowUploads: false }).allowUploads).toBe(false);
    expect(payload.assetTtlSeconds).toBe(300);
  });
});

describe("signValue", () => {
  it("blanks an object we failed to sign rather than leaking its path", () => {
    // Empty makes the renderer mark the image unresolved and the export gate
    // refuse. A visitor shipping a PNG with a hole where the logo should be
    // is the worst outcome this feature can produce.
    expect(signValue("brand-assets", "brand-assets/co/missing.png", new Map())).toBe("");
  });

  it("passes an external URL through untouched", () => {
    expect(signValue("brand-assets", "https://cdn.example.com/a.png", new Map())).toBe(
      "https://cdn.example.com/a.png",
    );
  });

  it("passes a data URL through untouched", () => {
    expect(signValue("brand-assets", "data:image/png;base64,AA", new Map())).toBe(
      "data:image/png;base64,AA",
    );
  });
});

describe("findUnsignedRefs", () => {
  it("catches a storage reference that survived the allowlist", () => {
    const payload = build({ signed: new Map() });
    // Nothing signed → the background blanks, but a reference reaching the
    // payload through a column the builder does not sign must be caught.
    const leaky = {
      ...payload,
      template: { ...payload.template, background_storage_path: "template-backgrounds/co/bg.png" },
    };
    expect(findUnsignedRefs(leaky)).toEqual(["template-backgrounds/co/bg.png"]);
  });

  it("passes a fully signed payload", () => {
    expect(findUnsignedRefs(build())).toEqual([]);
  });
});
