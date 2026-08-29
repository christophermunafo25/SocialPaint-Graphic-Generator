// Generate: a member's brief in, filled template proposals out. This function
// EXTRACTS (the published library as a candidate list), ASKS (one forced tool
// call), VALIDATES (never trusting model output), and RESPONDS. It writes
// nothing to the database beyond the shared rate-limit counters — the client
// renders the proposals and seeds the existing fill page with the chosen one.
//
// The model's only degrees of freedom are a templateId from the candidate
// set and string values for fields an admin deliberately exposed. Layout,
// type, color, and every locked property are unreachable by construction.
//
// v1 is the authenticated portal. The public-link variant would change how
// companyId and the candidate list are resolved — which is why candidates
// are built here and passed into the model call explicitly, never queried
// implicitly inside it.

import { requireRole, serviceClient } from "../_shared/figma.ts";
import {
  GENERIC_ERROR,
  HttpError,
  corsHeadersFor,
  handleOptions,
  jsonResponder,
  logError,
} from "../_shared/http.ts";
import {
  optionalEnum,
  optionalInt,
  parseBody,
  requireNumber,
  requireString,
  requireUuid,
} from "../_shared/validate.ts";
import {
  GENERATE_PLATFORM_IDS,
  GenerateValidationError,
  buildRepairRequests,
  candidateFromRows,
  canvasForPlatform,
  modelCandidates,
  validateFreestyle,
  validateGeneration,
  validateRepair,
  type CandidateTemplate,
  type FieldRowLike,
  type FreestyleModelOutput,
  type GenerateModelOutput,
  type GeneratePlatform,
  type RepairFieldRequest,
  type RepairModelOutput,
  type TemplateRowLike,
} from "../_shared/generateValidate.ts";
import { GENERATE_SYSTEM_PROMPT } from "./prompt.ts";

const ANTHROPIC_MODEL = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-4-6";

/** Real retrieval is a later problem; this cap is where it will go. Ordered
 * by most recently updated, and the response says so when it truncates. */
const CANDIDATE_CAP = 40;

/** Rate limits. Unlike auto-build (admin-only, rare), this endpoint is
 * member-facing and every call costs money. Both buckets ride the shared
 * consume_rate_limit counters from the public-links work — reusing that
 * primitive instead of growing a second one.
 *
 *  - Per user: enough for honest iteration on a post, a wall for a loop.
 *  - Per company: a ceiling so one company's members cannot collectively
 *    turn this into a load generator. */
const LIMITS = {
  perUser: { limit: 10, windowSeconds: 600 },
  perCompany: { limit: 40, windowSeconds: 600 },
} as const;

// ---------------------------------------------------------------------------
// Anthropic call
// ---------------------------------------------------------------------------

const PROPOSE_POSTS_TOOL = {
  name: "propose_posts",
  description:
    "Propose ready-to-edit posts: for each, a candidate templateId, values for its fields, a caption, and one sentence on why the template fits.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["proposals"],
    properties: {
      proposals: {
        type: "array",
        minItems: 1,
        maxItems: 3,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["templateId", "values", "caption", "why"],
          properties: {
            templateId: {
              type: "string",
              description: "The id of one candidate template.",
            },
            values: {
              type: "array",
              description:
                "One entry per non-image field of the chosen template. Never include image fields.",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["fieldKey", "value"],
                properties: {
                  fieldKey: { type: "string" },
                  value: { type: "string" },
                },
              },
            },
            caption: {
              type: "string",
              description: "One or two sentences the member would post alongside the graphic.",
            },
            why: {
              type: "string",
              description: "One sentence: why this template fits this brief.",
            },
            imageTargetFieldKey: {
              type: "string",
              description:
                "Only when the member has supplied a photo: the fieldKey of the image field it belongs in.",
            },
          },
        },
      },
    },
  },
};

function buildUserText(
  brief: string,
  candidates: CandidateTemplate[],
  count: number,
  platformHint: string | undefined,
  hinted: boolean,
  image: { aspect: number | undefined } | undefined,
): string {
  const parts: string[] = [];
  parts.push(`Brief: ${brief}`);
  if (platformHint) parts.push(`The member is posting on: ${platformHint}.`);
  if (image) {
    parts.push(
      `The member has already supplied a photo${
        image.aspect !== undefined ? ` (width over height about ${image.aspect.toFixed(2)})` : ""
      }. Prefer candidates with a member image slot, and set imageTargetFieldKey to the field their photo belongs in. Still never write a value for any image field.`,
    );
  }
  if (hinted) {
    parts.push(
      `The member picked this template themselves — fill it. Return ${count === 1 ? "one proposal" : `${count} proposals, each a distinct take on the brief`}.`,
    );
  } else {
    parts.push(
      `Return exactly ${count} proposal${count === 1 ? "" : "s"}${count > 1 ? ", each using a different template where the library allows it" : ""}.`,
    );
  }
  parts.push(
    `Candidate templates (choose templateId from these; the fields listed are the only ones you may write):\n${JSON.stringify(modelCandidates(candidates))}`,
  );
  return parts.join("\n\n");
}

/** The repair round's tool: rewrites for exactly the named fields, nothing
 * else — no caption, no why, no template choice. */
const REPAIR_VALUES_TOOL = {
  name: "repair_values",
  description: "Rewrite the named field values so each fits its measured character budget.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["values"],
    properties: {
      values: {
        type: "array",
        description: "One entry per field listed in the repair request.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["fieldKey", "value"],
          properties: {
            fieldKey: { type: "string" },
            value: { type: "string" },
          },
        },
      },
    },
  },
};

async function callClaude<T>(
  apiKey: string,
  userText: string,
  tool: { name: string } & Record<string, unknown>,
  retryErrors?: { priorContent: unknown[]; toolUseId: string; errors: string[] },
): Promise<{ output: T; toolUseId: string; raw: unknown[] }> {
  const messages: unknown[] = [{ role: "user", content: [{ type: "text", text: userText }] }];
  if (retryErrors) {
    messages.push({ role: "assistant", content: retryErrors.priorContent });
    messages.push({
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: retryErrors.toolUseId,
          is_error: true,
          content: `Your proposals failed validation: ${retryErrors.errors.join(" ")} Correct these and call ${tool.name} again.`,
        },
      ],
    });
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 4000,
      system: [
        { type: "text", text: GENERATE_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      tools: [tool],
      tool_choice: { type: "tool", name: tool.name },
      messages,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    logError("template-generate", `model request failed (${res.status}): ${detail.slice(0, 500)}`);
    throw new HttpError(502, `The model request failed (${res.status}) — try again.`);
  }
  const body = (await res.json()) as {
    content: Array<{ type: string; id?: string; name?: string; input?: unknown }>;
  };
  const toolUse = body.content.find((b) => b.type === "tool_use" && b.name === tool.name);
  if (!toolUse?.input) throw new HttpError(502, "The model returned no proposals.");
  return {
    output: toolUse.input as T,
    toolUseId: toolUse.id ?? "",
    raw: body.content,
  };
}

// ---------------------------------------------------------------------------
// Rate limiting — the shared fixed-window counters (migration 0026)
// ---------------------------------------------------------------------------

async function consume(
  db: ReturnType<typeof serviceClient>,
  buckets: Array<{ key: string; limit: number; windowSeconds: number }>,
): Promise<boolean> {
  const results = await Promise.all(
    buckets.map(async ({ key, limit, windowSeconds }) => {
      const { data, error } = await db.rpc("consume_rate_limit", {
        p_key: key,
        p_limit: limit,
        p_window_seconds: windowSeconds,
      });
      if (error) {
        // A limiter that cannot answer fails CLOSED — this endpoint spends
        // money per call, and running it unmetered is the worse failure.
        logError("template-generate", error);
        return false;
      }
      return data === true;
    }),
  );
  return results.every(Boolean);
}

function tooMany(req: Request): Response {
  return new Response(
    JSON.stringify({
      error: `You've hit the generate limit (${LIMITS.perUser.limit} in ${LIMITS.perUser.windowSeconds / 60} minutes) — try again in a few minutes. The library and the manual fill path are unaffected.`,
    }),
    {
      status: 429,
      headers: {
        ...corsHeadersFor(req),
        "Content-Type": "application/json",
        "Retry-After": String(LIMITS.perUser.windowSeconds),
      },
    },
  );
}

// ---------------------------------------------------------------------------
// Freestyle — a new design instead of a library fill (opt-in per request).
// The model proposes layout for once; the palette, the type styles, and the
// published library as reference are what keep it on brand. See the shared
// module for the constraint set.
// ---------------------------------------------------------------------------

const PROPOSE_DESIGNS_TOOL = {
  name: "propose_designs",
  description:
    "Propose new on-brand designs: for each, a name, an optional background palette key, elements with geometry, a caption, and one sentence on the design.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["proposals"],
    properties: {
      proposals: {
        type: "array",
        minItems: 1,
        maxItems: 3,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "fields", "caption", "why"],
          properties: {
            name: { type: "string" },
            backgroundColorKey: {
              type: "string",
              description: "Brand palette key for the canvas fill; omit for white.",
            },
            fields: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["label", "fieldKey", "type", "box"],
                properties: {
                  label: { type: "string" },
                  fieldKey: { type: "string" },
                  type: { type: "string", enum: ["text", "multiline", "image", "shape"] },
                  shape: { type: "string", enum: ["rect", "ellipse"] },
                  static: {
                    type: "boolean",
                    description: "true = part of the design; false = a per-post fact.",
                  },
                  value: {
                    type: "string",
                    description:
                      "Fixed content for static text; the pre-filled member value otherwise. Never for images.",
                  },
                  box: {
                    type: "object",
                    additionalProperties: false,
                    required: ["x", "y", "width", "height"],
                    properties: {
                      x: { type: "number" },
                      y: { type: "number" },
                      width: { type: "number" },
                      height: { type: "number" },
                    },
                  },
                  typeStyleKey: { type: "string" },
                  colorKey: { type: "string" },
                  fontSizePx: { type: "number" },
                  align: { type: "string", enum: ["left", "center", "right"] },
                  uppercase: { type: "boolean" },
                },
              },
            },
            caption: { type: "string" },
            why: { type: "string" },
          },
        },
      },
    },
  },
};

interface BrandKitRow {
  colors: Array<{ key: string; name: string; hex: string }> | null;
  type_styles: Array<{ key: string; name: string }> | null;
  guidelines: string[] | null;
}

/** Reference digest rows: enough of each published template's anatomy for
 * the model to learn the house style — never the whole record. */
interface ReferenceFieldRow {
  template_id: string;
  label: string;
  type: string;
  is_static: boolean | null;
  x: number;
  y: number;
  width: number;
  height: number;
  font_size_px: number | null;
  type_style_key: string | null;
  color_hex: string | null;
}

function buildFreestyleUserText(input: {
  brief: string;
  canvas: { width: number; height: number };
  platform: GeneratePlatform | undefined;
  kit: BrandKitRow;
  references: unknown[];
  count: number;
  image: { aspect: number | undefined } | undefined;
}): string {
  const parts: string[] = [];
  parts.push(`Brief: ${input.brief}`);
  if (input.platform) parts.push(`The member is posting on: ${input.platform}.`);
  if (input.image) {
    parts.push(
      `The member has already supplied a photo${
        input.image.aspect !== undefined
          ? ` (width over height about ${input.image.aspect.toFixed(2)})`
          : ""
      }. Give each design one member image element shaped to suit it.`,
    );
  }
  parts.push(
    `Design NEW graphics for a ${input.canvas.width}x${input.canvas.height}px canvas. Return exactly ${input.count} proposal${input.count === 1 ? "" : "s"}, each a genuinely different composition.`,
  );
  parts.push(
    `Brand palette (use these KEYS, nothing else): ${JSON.stringify(input.kit.colors ?? [])}`,
  );
  parts.push(`Brand type styles: ${JSON.stringify(input.kit.type_styles ?? [])}`);
  if (input.kit.guidelines?.length) {
    parts.push(`Brand guidelines: ${JSON.stringify(input.kit.guidelines)}`);
  }
  parts.push(
    input.references.length
      ? `The team's published templates, as style reference (match their spacing, hierarchy, and voice):\n${JSON.stringify(input.references)}`
      : "The team has no published templates to reference — design cleanly from the palette and type styles alone.",
  );
  return parts.join("\n\n");
}

async function handleFreestyle(
  json: ReturnType<typeof jsonResponder>,
  db: ReturnType<typeof serviceClient>,
  apiKey: string,
  companyId: string,
  input: {
    brief: string;
    platformHint: GeneratePlatform | undefined;
    count: number;
    image: { aspect: number | undefined } | undefined;
  },
): Promise<Response> {
  const warnings: string[] = [];
  const { data: kitRow } = await db
    .from("brand_kits")
    .select("colors, type_styles, guidelines")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .maybeSingle();
  const kit: BrandKitRow = (kitRow as BrandKitRow | null) ?? {
    colors: [],
    type_styles: [],
    guidelines: [],
  };
  if (!kit.colors?.length) {
    throw new HttpError(
      400,
      "Freestyle needs a brand palette to stay on brand — add colors in Brand Studio first.",
    );
  }

  // Style reference: the most recent published templates, digested. Unlike
  // library mode this is context, not a candidate set — no hint narrowing.
  const { data: templateRows } = await db
    .from("templates")
    .select("id, name, category, canvas_width, canvas_height, background_color")
    .eq("company_id", companyId)
    .eq("status", "published")
    .order("updated_at", { ascending: false })
    .limit(12);
  const refRows = (templateRows ?? []) as Array<
    TemplateRowLike & { background_color: string | null }
  >;
  let references: unknown[] = [];
  if (refRows.length > 0) {
    const { data: fieldRows } = await db
      .from("template_fields")
      .select(
        "template_id, label, type, is_static, x, y, width, height, font_size_px, type_style_key, color_hex",
      )
      .in(
        "template_id",
        refRows.map((r) => r.id),
      )
      .order("sort_order", { ascending: true });
    const byTemplate = new Map<string, ReferenceFieldRow[]>();
    for (const row of (fieldRows ?? []) as ReferenceFieldRow[]) {
      const list = byTemplate.get(row.template_id) ?? [];
      if (list.length < 15) list.push(row);
      byTemplate.set(row.template_id, list);
    }
    references = refRows.map((r) => ({
      name: r.name,
      category: r.category,
      canvasWidth: r.canvas_width,
      canvasHeight: r.canvas_height,
      backgroundColor: r.background_color,
      elements: (byTemplate.get(r.id) ?? []).map((f) => ({
        label: f.label,
        type: f.type,
        static: f.is_static === true || undefined,
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height,
        fontSizePx: f.font_size_px ?? undefined,
        typeStyleKey: f.type_style_key ?? undefined,
        colorHex: f.color_hex ?? undefined,
      })),
    }));
  }

  const canvas = canvasForPlatform(input.platformHint);
  const ctx = {
    canvasWidth: canvas.width,
    canvasHeight: canvas.height,
    palette: (kit.colors ?? []).map(({ key, hex }) => ({ key, hex })),
    typeStyleKeys: (kit.type_styles ?? []).map((s) => s.key),
  };
  const userText = buildFreestyleUserText({
    brief: input.brief,
    canvas,
    platform: input.platformHint,
    kit,
    references,
    count: input.count,
    image: input.image,
  });

  let attempt = await callClaude<FreestyleModelOutput>(apiKey, userText, PROPOSE_DESIGNS_TOOL);
  let validated;
  try {
    validated = validateFreestyle(attempt.output, ctx, input.count);
  } catch (e) {
    if (!(e instanceof GenerateValidationError)) throw e;
    attempt = await callClaude<FreestyleModelOutput>(apiKey, userText, PROPOSE_DESIGNS_TOOL, {
      priorContent: attempt.raw,
      toolUseId: attempt.toolUseId,
      errors: e.errors,
    });
    try {
      validated = validateFreestyle(attempt.output, ctx, input.count);
    } catch {
      return json(
        {
          error:
            "Freestyle couldn't produce a usable design from this brief. The library and the manual fill path are unaffected — try again, or generate from your templates instead.",
        },
        502,
      );
    }
  }

  return json({
    proposals: validated.designs.map((d, i) => ({
      templateId: `freestyle-${i + 1}`,
      templateName: d.name,
      values: d.values,
      caption: d.caption,
      why: d.why,
      imageFieldsNeeded: d.imageFieldsNeeded,
      design: {
        name: d.name,
        canvasWidth: d.canvasWidth,
        canvasHeight: d.canvasHeight,
        backgroundColor: d.backgroundColor,
        captionTemplate: d.captionTemplate,
        fields: d.fields,
      },
    })),
    warnings: [...warnings, ...validated.warnings],
    meta: {
      model: ANTHROPIC_MODEL,
      generatedAt: new Date().toISOString(),
      candidateCount: references.length,
      briefLength: input.brief.length,
      mode: "freestyle",
    },
  });
}

// ---------------------------------------------------------------------------
// Repair — round two of the client's measurement pass (see the shared module
// for the contract). Same auth, same quota buckets: a repair is a model call
// and costs exactly what a generate does.
// ---------------------------------------------------------------------------

interface RepairBody {
  templateId: string;
  brief: string;
  fields: Array<{ fieldKey: string; value: string; characterBudget: number }>;
}

function parseRepair(raw: unknown): RepairBody {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new HttpError(400, "repair must be an object.");
  }
  const r = raw as Record<string, unknown>;
  const templateId = requireUuid(r.templateId, "repair.templateId");
  const brief = requireString(r.brief, "repair.brief", 1500);
  if (!Array.isArray(r.fields) || r.fields.length < 1 || r.fields.length > 20) {
    throw new HttpError(400, "repair.fields must be an array of 1 to 20 entries.");
  }
  const fields = r.fields.map((f, i) => {
    if (typeof f !== "object" || f === null) {
      throw new HttpError(400, `repair.fields[${i}] must be an object.`);
    }
    const e = f as Record<string, unknown>;
    return {
      fieldKey: requireString(e.fieldKey, `repair.fields[${i}].fieldKey`, 60),
      value: requireString(e.value, `repair.fields[${i}].value`, 4000),
      characterBudget: requireNumber(e.characterBudget, `repair.fields[${i}].characterBudget`, {
        min: 1,
        max: 4000,
      }),
    };
  });
  return { templateId, brief, fields };
}

function buildRepairUserText(
  brief: string,
  candidate: CandidateTemplate,
  requests: RepairFieldRequest[],
): string {
  return [
    `Repair request for template "${candidate.name}". The member's brief: ${brief}`,
    `Template fields, for context:\n${JSON.stringify(modelCandidates([candidate])[0].fields)}`,
    `These values measured too long against the real template. Rewrite each one within its hard characterBudget (count characters):\n${JSON.stringify(requests)}`,
    "Every other value is staying exactly as it is.",
  ].join("\n\n");
}

async function handleRepair(
  json: ReturnType<typeof jsonResponder>,
  db: ReturnType<typeof serviceClient>,
  apiKey: string,
  companyId: string,
  rawRepair: unknown,
): Promise<Response> {
  const repair = parseRepair(rawRepair);

  const { data: templateRow, error: templateErr } = await db
    .from("templates")
    .select("id, name, description, category, tags, canvas_width, canvas_height")
    .eq("id", repair.templateId)
    .eq("company_id", companyId)
    .eq("status", "published")
    .maybeSingle();
  if (templateErr) {
    logError("template-generate", templateErr);
    return json({ error: GENERIC_ERROR }, 500);
  }
  if (!templateRow) {
    throw new HttpError(400, "That template is not in the published library any more.");
  }
  const { data: fieldRows, error: fieldsErr } = await db
    .from("template_fields")
    .select("field_key, label, type, is_static, required, max_length, placeholder, options")
    .eq("template_id", repair.templateId)
    .order("sort_order", { ascending: true });
  if (fieldsErr) {
    logError("template-generate", fieldsErr);
    return json({ error: GENERIC_ERROR }, 500);
  }
  const candidate = candidateFromRows(
    templateRow as TemplateRowLike,
    (fieldRows ?? []) as FieldRowLike[],
  );
  const { requests, errors } = buildRepairRequests(candidate, repair.fields);
  if (errors.length > 0) throw new HttpError(400, errors.join(" "));

  const userText = buildRepairUserText(repair.brief, candidate, requests);
  let attempt = await callClaude<RepairModelOutput>(apiKey, userText, REPAIR_VALUES_TOOL);
  let validated;
  try {
    validated = validateRepair(attempt.output, requests);
  } catch (e) {
    if (!(e instanceof GenerateValidationError)) throw e;
    attempt = await callClaude<RepairModelOutput>(apiKey, userText, REPAIR_VALUES_TOOL, {
      priorContent: attempt.raw,
      toolUseId: attempt.toolUseId,
      errors: e.errors,
    });
    try {
      validated = validateRepair(attempt.output, requests);
    } catch {
      return json(
        { error: "The rewrite couldn't fit the measured budgets — drop that proposal." },
        502,
      );
    }
  }

  return json({
    values: validated.values,
    warnings: validated.warnings,
    meta: { model: ANTHROPIC_MODEL, generatedAt: new Date().toISOString() },
  });
}

// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  const json = jsonResponder(req);
  try {
    const body = await parseBody(req);
    const companyId = requireUuid(body.companyId, "companyId");

    const caller = await requireRole(req, companyId, "member");
    if ("error" in caller) return json({ error: caller.error }, caller.status);

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return json(
        {
          error:
            "Generate is not configured: set the ANTHROPIC_API_KEY secret (supabase secrets set) and redeploy.",
        },
        503,
      );
    }

    const db = serviceClient();

    const allowed = await consume(db, [
      { key: `gen:user:${caller.userId}`, ...LIMITS.perUser },
      { key: `gen:company:${companyId}`, ...LIMITS.perCompany },
    ]);
    if (!allowed) return tooMany(req);

    if (body.repair !== undefined) {
      return await handleRepair(json, db, apiKey, companyId, body.repair);
    }

    const brief = requireString(body.brief, "brief", 1500);
    const platformHint = optionalEnum(body.platformHint, "platformHint", GENERATE_PLATFORM_IDS);
    const templateIdHint =
      body.templateIdHint === undefined || body.templateIdHint === null
        ? undefined
        : requireUuid(body.templateIdHint, "templateIdHint");
    const count = optionalInt(body.count, "count", { min: 1, max: 3 }) ?? 3;
    const mode = optionalEnum(body.mode, "mode", ["library", "freestyle"] as const) ?? "library";

    // The photo never crosses the wire — only that one exists, and its
    // shape. Absent both, this request is byte-for-byte what it always was.
    if (
      body.hasImage !== undefined &&
      body.hasImage !== null &&
      typeof body.hasImage !== "boolean"
    ) {
      throw new HttpError(400, "hasImage must be a boolean.");
    }
    const imageAspect =
      body.imageAspect === undefined || body.imageAspect === null
        ? undefined
        : requireNumber(body.imageAspect, "imageAspect", { min: 0.1, max: 10 });
    const image = body.hasImage === true ? { aspect: imageAspect } : undefined;

    if (mode === "freestyle") {
      return await handleFreestyle(json, db, apiKey, companyId, {
        brief,
        platformHint,
        count,
        image,
      });
    }

    // 1. The candidate list — published templates plus their field lists.
    //    The field list is what actually lets the model judge fit; a
    //    template's name alone is not enough.
    const warnings: string[] = [];
    const { data: templateRows, error: templatesErr } = await db
      .from("templates")
      .select("id, name, description, category, tags, canvas_width, canvas_height")
      .eq("company_id", companyId)
      .eq("status", "published")
      .order("updated_at", { ascending: false })
      .limit(CANDIDATE_CAP + 1);
    if (templatesErr) {
      logError("template-generate", templatesErr);
      return json({ error: GENERIC_ERROR }, 500);
    }
    let rows = (templateRows ?? []) as TemplateRowLike[];
    if (rows.length === 0) {
      throw new HttpError(400, "No published templates to generate from — publish one first.");
    }
    if (rows.length > CANDIDATE_CAP) {
      rows = rows.slice(0, CANDIDATE_CAP);
      warnings.push(
        `The library has more than ${CANDIDATE_CAP} published templates — considering the ${CANDIDATE_CAP} most recently updated.`,
      );
    }

    const { data: fieldRows, error: fieldsErr } = await db
      .from("template_fields")
      .select(
        "template_id, field_key, label, type, is_static, required, max_length, placeholder, options",
      )
      .in(
        "template_id",
        rows.map((r) => r.id),
      )
      .order("sort_order", { ascending: true });
    if (fieldsErr) {
      logError("template-generate", fieldsErr);
      return json({ error: GENERIC_ERROR }, 500);
    }
    const fieldsByTemplate = new Map<string, FieldRowLike[]>();
    for (const row of (fieldRows ?? []) as Array<FieldRowLike & { template_id: string }>) {
      const list = fieldsByTemplate.get(row.template_id) ?? [];
      list.push(row);
      fieldsByTemplate.set(row.template_id, list);
    }
    let candidates = rows.map((r) => candidateFromRows(r, fieldsByTemplate.get(r.id) ?? []));

    // 2. Hints narrow the set. A named template is an instruction; a platform
    //    is a preference that falls back rather than emptying the list.
    if (templateIdHint) {
      candidates = candidates.filter((c) => c.id === templateIdHint);
      if (candidates.length === 0) {
        throw new HttpError(
          400,
          "That template is not in the published library any more — pick another or generate without it.",
        );
      }
    } else if (platformHint) {
      const matching = candidates.filter((c) => c.platforms.includes(platformHint));
      if (matching.length > 0) {
        candidates = matching;
      } else {
        warnings.push(
          "No published templates match that platform — considering the whole library.",
        );
      }
    }

    // 3. One forced tool call; one retry carrying the validation errors.
    //    No vision input: the templates are known structured data and the
    //    field list carries the signal (unlike auto-build, which reads an
    //    unknown design and needs the pixels).
    const userText = buildUserText(
      brief,
      candidates,
      count,
      platformHint,
      Boolean(templateIdHint),
      image,
    );
    let attempt = await callClaude<GenerateModelOutput>(apiKey, userText, PROPOSE_POSTS_TOOL);
    let validated;
    try {
      validated = validateGeneration(attempt.output, candidates, count);
    } catch (e) {
      if (!(e instanceof GenerateValidationError)) throw e;
      attempt = await callClaude<GenerateModelOutput>(apiKey, userText, PROPOSE_POSTS_TOOL, {
        priorContent: attempt.raw,
        toolUseId: attempt.toolUseId,
        errors: e.errors,
      });
      try {
        validated = validateGeneration(attempt.output, candidates, count);
      } catch {
        return json(
          {
            error:
              "Generate couldn't produce a usable post from this brief. The library and the manual fill path are unaffected — try rewording the brief, or fill a template directly.",
          },
          502,
        );
      }
    }

    return json({
      proposals: validated.proposals,
      warnings: [...warnings, ...validated.warnings],
      // Provenance is the product's stated position: every generated thing
      // can answer which model made it, from which library, and when.
      meta: {
        model: ANTHROPIC_MODEL,
        generatedAt: new Date().toISOString(),
        candidateCount: candidates.length,
        briefLength: brief.length,
      },
    });
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    logError("template-generate", e);
    return json({ error: GENERIC_ERROR }, 500);
  }
});
