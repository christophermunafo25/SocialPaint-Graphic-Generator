// Compose, the model's side: the message a compose call sends and the tool
// the model must answer with. The message lays out the brand (color keys,
// type styles, fonts, logos and brand images), the house style measured
// across the team's templates, and the references and current drafts element
// by element, each element with an id the model can name in `from` to reuse
// its whole look. compose.ts builds the context; composeValidate.ts checks
// the answer.

import {
  alphaOf,
  median,
  normalizeHex,
  round1,
  round2,
  teamLogoVector,
  type ComposeBrand,
  type ComposeContext,
  type CornersLike,
  type EffectLike,
  type GradientLike,
  type HouseStyle,
  type RefElement,
  type RefTemplate,
} from "./compose.ts";

// ---------------------------------------------------------------------------
// What the model reads
// ---------------------------------------------------------------------------

function colorLabel(hex: string, brand: ComposeBrand): string {
  const hit = brand.colors.find((c) => c.hex === hex);
  return hit ? hit.key : hex;
}

const pct = (n: number) => `${Math.round(n * 100)}%`;
const px = (n: number) => `${Math.round(n)}`;
/** A string as the model reads it: quoted, whitespace collapsed, and cut at
 * a word boundary past `max` with how long the whole was, since a sample's
 * length is what tells the model how much copy a box was drawn for. */
const quote = (s: string, max: number) => {
  const text = s.replace(/\s+/g, " ").trim();
  if (text.length <= max) return JSON.stringify(text);
  const cut = text.slice(0, max);
  const word = cut
    .slice(0, Math.max(cut.lastIndexOf(" "), Math.floor(max / 2)))
    .replace(/[\s.,;:]+$/, "");
  return `${JSON.stringify(`${word}...`)} (${text.length} chars)`;
};

function gradientText(g: GradientLike, brand: ComposeBrand): string {
  const stops = g.stops
    .map((s) => `${colorLabel(s.color, brand)} ${round2(s.position)}`)
    .join(", ");
  return g.kind === "radial"
    ? `radial gradient [${stops}]`
    : `linear gradient ${Math.round(g.angle)}deg [${stops}]`;
}

function effectsText(effects: EffectLike[] | undefined, brand: ComposeBrand): string[] {
  const out: string[] = [];
  for (const fx of effects ?? []) {
    if (fx.type === "dropShadow") {
      const color = `${colorLabel(normalizeHex(fx.color) ?? fx.color, brand)} ${pct(alphaOf(fx.color))}`;
      out.push(
        fx.x === 0 && fx.y === 0
          ? `glow ${px(fx.blur)} ${color}`
          : `shadow ${px(fx.x)},${px(fx.y)} blur ${px(fx.blur)} ${color}`,
      );
    } else if (fx.type === "innerShadow") {
      out.push(`inner shadow ${px(fx.x)},${px(fx.y)} blur ${px(fx.blur)}`);
    } else if (fx.type === "layerBlur") {
      out.push(`blur ${px(fx.radius)}`);
    } else {
      out.push(`grain ${pct(alphaOf(fx.color))}`);
    }
  }
  return out;
}

function radiusText(c: CornersLike | undefined): string | undefined {
  if (!c) return undefined;
  return c.tl === c.tr && c.tr === c.br && c.br === c.bl
    ? `radius ${px(c.tl)}`
    : `radius ${px(c.tl)},${px(c.tr)},${px(c.br)},${px(c.bl)}`;
}

/** One element as a line the model reads. */
export function describeElement(e: RefElement, brand: ComposeBrand, value?: string): string {
  const f = e.field;
  const parts: string[] = [e.id];
  const box = `[${px(f.x)},${px(f.y)},${px(f.width)},${px(f.height)}]`;
  if (e.role === "text") {
    parts.push(f.type === "multiline" ? "multiline" : "text");
    if (f.static) parts.push(`fixed ${quote(f.staticValue ?? "", 60)}`);
    else {
      parts.push(`member ${quote(f.label || f.fieldKey, 40)}`);
      if (value) parts.push(`value ${quote(value, 80)}`);
    }
    parts.push(box);
    if (f.typeStyleKey) parts.push(`style ${f.typeStyleKey}`);
    if (f.fontSizePx) parts.push(`${px(f.fontSizePx)}px`);
    if (f.fontFamily) parts.push(`${f.fontFamily}${f.fontWeight ? ` ${f.fontWeight}` : ""}`);
    else if (f.fontWeight) parts.push(`weight ${f.fontWeight}`);
    // The color it renders in: a style's fixed color wins over the field's.
    const styleColor = f.typeStyleKey
      ? brand.typeStyles.find((st) => st.key === f.typeStyleKey)?.colorKey
      : undefined;
    if (styleColor && brand.colors.some((c) => c.key === styleColor)) parts.push(styleColor);
    else if (f.textGradient) parts.push(gradientText(f.textGradient, brand));
    else if (f.colorHex) parts.push(colorLabel(f.colorHex, brand));
    if (f.uppercase) parts.push("upper");
    if (f.letterSpacingPx) parts.push(`tracking ${round1(f.letterSpacingPx)}`);
    if (f.lineHeight) parts.push(`leading ${round2(f.lineHeight)}`);
    parts.push(f.align ?? "left");
    if (f.plateColor) {
      const r = radiusText(f.cornerRadius);
      parts.push(
        `plate ${colorLabel(f.plateColor, brand)} pad ${px(f.platePaddingX ?? 0)}x${px(f.platePaddingY ?? 0)} ${r ?? "fully round"}`,
      );
    }
    if (!f.static && f.maxLength) parts.push(`max ${f.maxLength}`);
    if (!f.static && f.placeholder && !value) parts.push(`sample ${quote(f.placeholder, 48)}`);
  } else if (e.role === "shape") {
    parts.push(`shape ${f.shape ?? "rect"}`, box);
    if (f.textGradient) parts.push(gradientText(f.textGradient, brand));
    else if (f.colorHex) parts.push(`fill ${colorLabel(f.colorHex, brand)}`);
    const r = radiusText(f.cornerRadius);
    if (r) parts.push(r);
    if (f.strokeColor && f.strokeWidthPx) {
      parts.push(
        `stroke ${colorLabel(f.strokeColor, brand)} ${px(f.strokeWidthPx)}px${f.strokeAlign && f.strokeAlign !== "inside" ? ` ${f.strokeAlign}` : ""}`,
      );
    }
  } else if (e.role === "photo") {
    parts.push(`photo member ${quote(f.label || "Photo", 40)}`, box);
    const r = radiusText(f.cornerRadius);
    if (r) parts.push(r);
    if (f.maskUrl) parts.push("shaped mask");
  } else if (e.role === "logo") {
    parts.push("logo", box);
  } else if (e.role === "icon") {
    parts.push(`icon ${quote(f.vector?.source?.name ?? f.label ?? "icon", 40)}`, box);
    if (f.colorHex) parts.push(colorLabel(f.colorHex, brand));
  } else {
    parts.push(`artwork ${quote(f.label || "Artwork", 40)}`, box);
    const r = radiusText(f.cornerRadius);
    if (r) parts.push(r);
  }
  if ((f.opacity ?? 100) < 100) parts.push(`opacity ${Math.round(f.opacity!)}`);
  if (f.rotation) parts.push(`rotated ${Math.round(f.rotation)}`);
  parts.push(...effectsText(f.effects, brand));
  return parts.join(" ");
}

function backgroundText(ref: RefTemplate, brand: ComposeBrand): string {
  const parts: string[] = [];
  if (ref.background.gradient) parts.push(`ground ${gradientText(ref.background.gradient, brand)}`);
  else if (ref.background.color) parts.push(`ground ${colorLabel(ref.background.color, brand)}`);
  else if (!ref.background.hasImage) parts.push("ground white");
  if (ref.background.hasImage) parts.push("a flat background image (not reusable)");
  parts.push(...effectsText(ref.background.effects, brand));
  return parts.join(", ");
}

function referenceText(ref: RefTemplate, brand: ComposeBrand, canvas: ComposeContext): string {
  const same = ref.canvasWidth === canvas.canvasWidth && ref.canvasHeight === canvas.canvasHeight;
  const head = [
    `${ref.id} ${quote(ref.name, 60)}`,
    ref.category ? `category ${quote(ref.category, 40)}` : "",
    `${ref.canvasWidth}x${ref.canvasHeight}${same ? " (this canvas)" : ""}`,
    backgroundText(ref, brand),
  ]
    .filter(Boolean)
    .join(" · ");
  const lines = [head];
  for (const e of ref.elements)
    lines.push(`  ${describeElement(e, brand, ref.values?.[e.field.fieldKey])}`);
  if (ref.captionTemplate) lines.push(`  caption ${quote(ref.captionTemplate, 160)}`);
  return lines.join("\n");
}

function houseText(h: HouseStyle, ctx: ComposeContext): string {
  const brand = ctx.brand;
  const lines: string[] = [];
  const n = h.templateCount;
  lines.push(
    `House style, measured from the team's ${n} published template${n === 1 ? "" : "s"} (pixel values scaled to this canvas):`,
  );
  if (h.sizes.length) {
    lines.push(`- Sizes: ${h.sizes.map((s) => `${s.size} (${s.count})`).join(", ")}`);
  }
  if (h.margin) {
    lines.push(
      `- Margins: everything not bleeding off the edge keeps about ${px(h.margin.side)}px from the sides, ${px(h.margin.top)}px from the top and ${px(h.margin.bottom)}px from the bottom`,
    );
  }
  if (h.logo) {
    lines.push(
      `- Logo: on ${h.logo.count} of ${n}, usually ${h.logo.corner}, about ${px(h.logo.width)}px wide`,
    );
  } else if (n > 0) {
    lines.push("- Logo: the templates carry none");
  }
  if (h.type) {
    const t = h.type;
    const parts = [
      `headline about ${px(t.headline)}px (${px(t.headlineRange[0])} to ${px(t.headlineRange[1])})${t.headlineStyle ? `, style ${t.headlineStyle}` : ""}, ${t.align ?? "left"} aligned`,
    ];
    if (t.body !== undefined) {
      parts.push(`body about ${px(t.body)}px${t.bodyStyle ? `, style ${t.bodyStyle}` : ""}`);
    }
    if (t.ratio !== undefined) parts.push(`headline about ${round1(t.ratio)}x the body`);
    if (t.families.length) parts.push(`fonts ${t.families.join(", ")}`);
    lines.push(`- Type: ${parts.join("; ")}`);
  }
  const g = h.grounds;
  const groundParts = [`light on ${g.light}`, `dark on ${g.dark}`];
  if (g.image) groundParts.push(`photo or image on ${g.image}`);
  if (g.keys.length) {
    groundParts.push(
      `most used ${g.keys.map((k) => `${colorLabel(k.hex, brand)} (${k.count})`).join(", ")}`,
    );
  }
  lines.push(`- Grounds: ${groundParts.join("; ")}`);
  if (h.textColors.length) {
    lines.push(
      `- Text colors: ${h.textColors.map((c) => `${colorLabel(c.hex, brand)} (${c.count})`).join(", ")}`,
    );
  }
  if (h.accentColors.length) {
    lines.push(
      `- Accents on panels, pills and shapes: ${h.accentColors.map((c) => `${colorLabel(c.hex, brand)} (${c.count})`).join(", ")}`,
    );
  }
  const shape: string[] = [];
  if (h.radii.length) {
    shape.push(`corner radius ${h.radii.map((r) => `${px(r.radius)}px (${r.count})`).join(", ")}`);
  } else if (n > 0) {
    shape.push("square corners");
  }
  if (h.pills) shape.push(`${h.pills} pill${h.pills === 1 ? "" : "s"}`);
  if (h.plates > h.pills)
    shape.push(`${h.plates - h.pills} squared plate${h.plates - h.pills === 1 ? "" : "s"}`);
  if (h.strokes) shape.push(`${h.strokes} outlined shape${h.strokes === 1 ? "" : "s"}`);
  if (shape.length) lines.push(`- Shapes: ${shape.join("; ")}`);
  const fx: string[] = [];
  if (h.shadows && h.shadow) {
    fx.push(
      `${h.shadows} drop shadow${h.shadows === 1 ? "" : "s"} (about y ${px(h.shadow.y)}, blur ${px(h.shadow.blur)}, ${pct(h.shadow.alpha)})`,
    );
  }
  if (h.glows) fx.push(`${h.glows} glow${h.glows === 1 ? "" : "s"}`);
  if (h.blurs) fx.push(`${h.blurs} blur${h.blurs === 1 ? "" : "s"}`);
  if (h.gradients) fx.push(`${h.gradients} gradient${h.gradients === 1 ? "" : "s"}`);
  if (h.grain) fx.push(`grain on ${h.grain}`);
  lines.push(`- Effects: ${fx.length ? fx.join("; ") : "none, the team's work is flat"}`);
  const media: string[] = [];
  if (h.photos) {
    media.push(
      `${h.photos} member photo slot${h.photos === 1 ? "" : "s"}${h.photoRadius ? ` at radius ${px(h.photoRadius)}px` : ""}`,
    );
  }
  if (h.icons) media.push(`${h.icons} icon${h.icons === 1 ? "" : "s"}`);
  if (h.artwork) media.push(`${h.artwork} fixed artwork`);
  if (media.length) lines.push(`- Media: ${media.join("; ")}`);
  if (n > 0) {
    lines.push(
      `- Density: about ${Math.round(h.elements.median)} elements a post, at most ${h.elements.max}`,
    );
  }
  if (h.fixedCopy.length) {
    lines.push(`- Fixed copy the team writes: ${h.fixedCopy.map((c) => quote(c, 40)).join(", ")}`);
  }
  return lines.join("\n");
}

function brandText(ctx: ComposeContext): string {
  const b = ctx.brand;
  const lines: string[] = [];
  lines.push("Colors (use these keys and nothing else):");
  for (const c of b.colors) {
    const tags = [
      c.role,
      c.source === "house"
        ? `used by the team: ${c.usage}`
        : c.source === "neutral"
          ? "plain neutral"
          : undefined,
    ]
      .filter(Boolean)
      .join(", ");
    lines.push(`- ${c.key} ${c.hex} ${quote(c.name, 40)}${tags ? ` (${tags})` : ""}`);
  }
  if (b.typeStyles.length) {
    lines.push("", 'Type styles (bind text with "style"):');
    for (const s of b.typeStyles) {
      const parts: string[] = [];
      if (s.family)
        parts.push(
          `${s.family}${s.weight ? ` ${s.weight}` : ""}${s.italic ? " italic" : ""}${s.stretch ? ` ${s.stretch}` : ""}`,
        );
      else if (s.weight) parts.push(`weight ${s.weight}`);
      if (s.sizePx) parts.push(`fixed at ${px(s.sizePx)}px`);
      if (s.uppercase) parts.push("uppercase");
      if (s.letterSpacingPx) parts.push(`tracking ${round1(s.letterSpacingPx)}`);
      if (s.lineHeight) parts.push(`leading ${round2(s.lineHeight)}`);
      if (s.colorKey) parts.push(`always ${s.colorKey}`);
      if (s.useFor) parts.push(`for ${s.useFor === "heading" ? "headings" : "body copy"}`);
      lines.push(`- ${s.key} ${quote(s.name, 40)}${parts.length ? `: ${parts.join(", ")}` : ""}`);
    }
  }
  if (b.fonts.length) lines.push("", `Fonts you may name in "font": ${b.fonts.join(", ")}`);
  lines.push("");
  if (b.logos.light || b.logos.dark) {
    lines.push(
      'Logo: place it with a "logo" element. The version that reads on the ground under it (light or dark) is used for you.',
    );
  } else if (teamLogoVector(ctx)) {
    lines.push(
      'Logo: place it with a "logo" element. The team\'s own logo art is used, colored to read on the ground under it.',
    );
  } else {
    lines.push("Logo: Brand Studio has none, so leave the logo out.");
  }
  if (b.images.length) {
    lines.push(
      "",
      'Brand images (place with "brandImage" and the id, only when the name clearly suits the post; never in place of the member\'s photo):',
    );
    for (const img of b.images) {
      lines.push(
        `- ${img.id} ${quote(img.name, 60)}${img.aspect ? ` ${round2(img.aspect)}:1` : ""}`,
      );
    }
  }
  if (b.guidelines.length) {
    lines.push("", `Brand guidelines: ${JSON.stringify(b.guidelines)}`);
  }
  return lines.join("\n");
}

function canvasText(ctx: ComposeContext): string {
  const W = ctx.canvasWidth;
  const H = ctx.canvasHeight;
  const lines = [
    `Canvas: ${W}x${H} px. Keep text, the logo and buttons at least ${ctx.margin}px inside the left and right edges${
      ctx.safeTop === ctx.margin && ctx.safeBottom === ctx.margin
        ? " and the top and bottom"
        : `, below y ${ctx.safeTop} and above y ${H - ctx.safeBottom} (the platform's own controls cover the rest)`
    }. Shapes, panels and photos may bleed off the edge.`,
  ];
  if (ctx.expectLogo)
    lines.push("The team puts its logo on most posts, so every design carries it.");
  lines.push(`Use at most ${ctx.elementCap} elements in a design.`);
  return lines.join(" ");
}

/** The model's user text for a compose call. The sections the caller builds
 * from shared helpers (facts, documents) arrive ready to insert. */
export function composeUserText(
  ctx: ComposeContext,
  request: {
    brief: string;
    count: number;
    platform?: string;
    photoAspect?: number | null;
    extraSections?: string[];
  },
): string {
  const parts: string[] = [];
  parts.push(`Brief: ${request.brief}`);
  for (const s of request.extraSections ?? []) parts.push(s);
  if (request.platform) parts.push(`The member is posting on: ${request.platform}.`);
  if (request.photoAspect !== undefined) {
    parts.push(
      `The member has supplied a photo${
        request.photoAspect !== null
          ? ` (width over height about ${request.photoAspect.toFixed(2)})`
          : ""
      }. Give each design one member photo slot (type "image") framed the way the team frames photos.`,
    );
  } else {
    parts.push("The member has not supplied a photo, so the designs have no member photo slot.");
  }
  if (ctx.drafts.length) {
    parts.push(
      [
        'The member\'s current drafts, which their message is about (name any element id, such as D1.3, in "from"):',
        ...ctx.drafts.map((d) => referenceText(d, ctx.brand, ctx)),
      ].join("\n"),
    );
  }
  parts.push(canvasText(ctx));
  parts.push(brandText(ctx));
  if (ctx.house.templateCount > 0) parts.push(houseText(ctx.house, ctx));
  parts.push(
    ctx.references.length
      ? [
          'The team\'s templates, most relevant to this brief first. Name any element id (R1.4) in "from" to reuse its exact look, and a template id (R1) in background "from" to reuse its ground:',
          ...ctx.references.map((r) => referenceText(r, ctx.brand, ctx)),
        ].join("\n")
      : "The team has no published templates yet. Design cleanly from the colors and type styles: one clear hierarchy, generous space, no decoration.",
  );
  parts.push(
    `Return exactly ${request.count} design${request.count === 1 ? "" : "s"}${
      request.count > 1
        ? ", each a genuinely different composition, led by a different template where more than one suits the brief"
        : ""
    }.`,
  );
  return parts.join("\n\n");
}

// ---------------------------------------------------------------------------
// The tool
// ---------------------------------------------------------------------------

const COLOR_KEY = { type: "string", description: "A key from the color list." };

const GRADIENT_SCHEMA = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["linear", "radial"] },
    angle: {
      type: "number",
      description: "Linear only. Degrees, CSS convention: 180 runs top to bottom.",
    },
    center: {
      type: "array",
      items: { type: "number" },
      description: "Radial only. [x, y] as fractions of the box; [0.5, 0.5] is the middle.",
    },
    radius: {
      type: "array",
      items: { type: "number" },
      description: "Radial only. [x, y] radii as fractions of the box.",
    },
    stops: {
      type: "array",
      items: {
        type: "object",
        properties: { color: COLOR_KEY, at: { type: "number", description: "0 to 1." } },
        required: ["color", "at"],
      },
    },
  },
  required: ["stops"],
};

const EFFECT_SCHEMA = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["dropShadow", "innerShadow", "layerBlur", "noise"] },
    x: { type: "number" },
    y: { type: "number" },
    blur: { type: "number" },
    spread: { type: "number" },
    radius: { type: "number", description: "layerBlur only." },
    color: COLOR_KEY,
    alpha: { type: "number", description: "0 to 1." },
    size: { type: "number", description: "noise only: grain size in px." },
    density: { type: "number", description: "noise only: 0 to 1." },
  },
  required: ["type"],
};

const ELEMENT_SCHEMA = {
  type: "object",
  properties: {
    key: { type: "string", description: "snake_case, unique in the design. Caption tags use it." },
    type: {
      type: "string",
      enum: ["text", "multiline", "image", "shape", "logo", "icon", "artwork", "brandImage"],
    },
    label: {
      type: "string",
      description: "Member fields: the fact it holds, such as Headline or Date.",
    },
    from: {
      type: "string",
      description:
        "A reference element id (R2.4, or D1.3 in a follow-up) whose whole look this element reuses. Position and content come from you.",
    },
    box: {
      type: "array",
      items: { type: "number" },
      description: "[x, y, width, height] in canvas pixels from the top left.",
    },
    static: {
      type: "boolean",
      description: "Text only: true for fixed copy that belongs to the design.",
    },
    value: { type: "string", description: "Text only: the copy." },
    style: { type: "string", description: "Text only: a type style key." },
    font: {
      type: "object",
      properties: { family: { type: "string" }, weight: { type: "number" } },
      description: "Text only: a family from the font list, when no type style fits.",
    },
    size: { type: "number", description: "Text only: font size in px." },
    color: COLOR_KEY,
    align: { type: "string", enum: ["left", "center", "right"] },
    valign: { type: "string", enum: ["top", "middle", "bottom"] },
    uppercase: { type: "boolean" },
    tracking: { type: "number", description: "Letter spacing in px." },
    leading: { type: "number", description: "Line height as a multiple of the size." },
    shape: { type: "string", enum: ["rect", "ellipse", "triangle", "star"] },
    radius: {
      description:
        "Corner radius in px: one number, or [topLeft, topRight, bottomRight, bottomLeft].",
      anyOf: [{ type: "number" }, { type: "array", items: { type: "number" } }],
    },
    fill: { ...GRADIENT_SCHEMA, description: "A gradient fill for a shape or text." },
    stroke: {
      type: "object",
      properties: {
        color: COLOR_KEY,
        width: { type: "number" },
        align: { type: "string", enum: ["inside", "center", "outside"] },
      },
      required: ["color", "width"],
    },
    plate: {
      type: "object",
      properties: { color: COLOR_KEY, padX: { type: "number" }, padY: { type: "number" } },
      required: ["color"],
      description: "Text only: a plate behind the text. With no radius it is a pill.",
    },
    opacity: { type: "number", description: "0 to 100." },
    rotation: { type: "number" },
    effects: { type: "array", items: EFFECT_SCHEMA },
    surface: {
      type: "string",
      enum: ["light", "dark"],
      description: "Logo only: force a version.",
    },
    asset: { type: "string", description: "brandImage only: a brand image id such as I1." },
  },
  required: ["key", "type", "box"],
};

export const COMPOSE_TOOL = {
  name: "propose_designs",
  description:
    "Propose new on-brand designs: for each, the template it follows, its ground, its elements in paint order, a caption, and one sentence on the design.",
  input_schema: {
    type: "object",
    required: ["proposals"],
    properties: {
      proposals: {
        type: "array",
        minItems: 1,
        maxItems: 3,
        items: {
          type: "object",
          required: ["name", "elements", "caption", "why"],
          properties: {
            name: { type: "string", description: "Two to four words naming the layout." },
            lead: {
              type: "string",
              description: "The reference id this design follows, such as R2, or none.",
            },
            background: {
              type: "object",
              properties: {
                from: { type: "string", description: "A reference id whose ground to reuse." },
                color: COLOR_KEY,
                fill: GRADIENT_SCHEMA,
                grain: {
                  type: "object",
                  properties: {
                    color: COLOR_KEY,
                    alpha: { type: "number" },
                    size: { type: "number" },
                    density: { type: "number" },
                  },
                  required: ["color"],
                },
              },
            },
            elements: { type: "array", items: ELEMENT_SCHEMA },
            caption: {
              type: "string",
              description:
                "One or two sentences the member would post, with {key} tags for member fields.",
            },
            why: { type: "string", description: "One sentence to the member on the design." },
          },
        },
      },
      reply: {
        type: "string",
        description:
          "One or two sentences to the member about the post. If a fact the post needs is missing, name it. Never ask a question, no exclamation marks, never an em dash.",
      },
      title: {
        type: "string",
        description:
          "Two to five words naming the post, in sentence case, with no closing punctuation.",
      },
    },
  },
};
