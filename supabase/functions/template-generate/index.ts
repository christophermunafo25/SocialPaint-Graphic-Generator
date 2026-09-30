// Generate: a member's brief in, filled template proposals out. This function
// EXTRACTS (the published library as a candidate list), ASKS (one tool
// call), VALIDATES (never trusting model output), and RESPONDS. It writes
// nothing to the database beyond the shared rate-limit counters and one
// ai_usage_events row per model call — the client renders the proposals as
// chat drafts.
//
// The chat rides the same request. A follow-up adds an optional followUp (the
// chat's first brief and the drafts on screen) that library mode shows the
// model after the brief, so a new message revises the drafts instead of
// starting over; the model may also return a short reply and a chat title,
// validated like the rest and sent back only when usable.
//
// The model's only degrees of freedom are a templateId from the candidate
// set and string values for fields an admin deliberately exposed. Layout,
// type, color, and every locked property are unreachable by construction.
//
// A template chat (Template chat PROMPT §10) pins one template and may add
// the member's own detail values, the text of an attached document, and, on
// a first message with nothing else to go on, leave to ask one question
// instead of building. The model fills only what it has facts for; an empty
// field is legal and the client flags it. Every model response is metered
// into ai_usage_events.
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
  followUpSection,
  modelCandidates,
  parseFollowUp,
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
import {
  detailsSection,
  documentsSection,
  parseDetails,
  parseDocuments,
  pickToolUse,
  resolveDetails,
  validateQuestion,
  type DocumentInput,
  type ModelContentBlock,
  type ResolvedDetail,
} from "../_shared/generateValidate.ts";
import { recordModelUsage, type AnthropicUsage, type UsageKind } from "../_shared/usage.ts";
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

/** The chat's prose, offered next to proposals in both propose tools and
 * never required: a call without them is still a valid call, and
 * validateReplyAndTitle drops an unusable one without costing a retry. The
 * descriptions restate the system prompt's "Reply and title" section. */
const REPLY_AND_TITLE_PROPERTIES = {
  reply: {
    type: "string",
    description:
      "One or two sentences to the member about what you made. If a required field is still empty, name it plainly so they know to add it. Never ask a question, no exclamation marks, no marketing filler, never an em dash.",
  },
  title: {
    type: "string",
    description:
      "Two to five words naming the post, in sentence case, with no closing punctuation.",
  },
};

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
                "Values for the fields you have facts for. Leave out any field the brief, details, documents and current draft do not cover. Never include image fields or fields the member already filled.",
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
      ...REPLY_AND_TITLE_PROPERTIES,
    },
  },
};

/** The one-question tool, offered only when a first message may ask
 * (allowQuestion honored). */
const ASK_MEMBER_TOOL = {
  name: "ask_member",
  description:
    "Ask the member one short question, in one or two sentences, for the few facts that matter most. Only when the request allows it and the brief, details and documents give nothing to put in any field.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["question"],
    properties: {
      question: { type: "string" },
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
  followUpText: string | undefined,
  details: ResolvedDetail[],
  documents: DocumentInput[],
  mayAsk: boolean,
): string {
  const parts: string[] = [];
  parts.push(`Brief: ${brief}`);
  // A chat follow-up reads as context for the brief, so it sits right after
  // it (followUpSection, built by the caller against the published list).
  if (followUpText) parts.push(followUpText);
  if (details.length > 0) parts.push(detailsSection(details));
  if (documents.length > 0) parts.push(documentsSection(documents));
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
      `The member picked this template themselves. Use it for every proposal. Return ${count === 1 ? "one proposal" : `${count} proposals, each a distinct take on the brief`}.`,
    );
  } else {
    parts.push(
      `Return exactly ${count} proposal${count === 1 ? "" : "s"}${count > 1 ? ", each using a different template where the library allows it" : ""}.`,
    );
  }
  parts.push(
    `Candidate templates (choose templateId from these; the fields listed are the only ones you may write):\n${JSON.stringify(modelCandidates(candidates))}`,
  );
  if (mayAsk) {
    parts.push(
      "You may ask the member one question instead of building (see Asking first). Ask only if nothing here gives you a fact for any field.",
    );
  }
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

type Tool = { name: string } & Record<string, unknown>;

/** One model response, narrowed to the tool call acted on. */
interface ClaudeAttempt {
  /** The tool that was actually called, one of the set offered. */
  toolName: string;
  input: unknown;
  toolUseId: string;
  raw: unknown[];
  /** Tools also called in the same response and ignored (pickToolUse). */
  dropped: string[];
}

/** Meters one model response. Built per request, so the caller's company and
 * user ride along; never throws (recordModelUsage). */
type Meter = (kind: UsageKind, usage: AnthropicUsage | undefined) => Promise<void>;

/** One model call. With one tool it is forced; with several, `any` makes the
 * model call exactly one of them. `retry` carries the previous response and
 * its validation errors, and offers the same tool set again. Every response
 * that comes back, usable or not, is metered as `kind` before anything else
 * happens to it. */
async function callClaude(
  apiKey: string,
  userText: string,
  tools: Tool[],
  meter: { record: Meter; kind: UsageKind },
  retry?: { prior: ClaudeAttempt; errors: string[] },
): Promise<ClaudeAttempt> {
  const messages: unknown[] = [{ role: "user", content: [{ type: "text", text: userText }] }];
  if (retry) {
    const called = retry.prior.toolName;
    messages.push({ role: "assistant", content: retry.prior.raw });
    messages.push({
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: retry.prior.toolUseId,
          is_error: true,
          content: `Your ${called} call failed validation: ${retry.errors.join(" ")} Correct these and call ${called} again.`,
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
      tools,
      tool_choice:
        tools.length === 1
          ? { type: "tool", name: tools[0].name }
          : { type: "any", disable_parallel_tool_use: true },
      messages,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    logError("template-generate", `model request failed (${res.status}): ${detail.slice(0, 500)}`);
    throw new HttpError(502, `The model request failed (${res.status}). Try again.`);
  }
  const body = (await res.json()) as {
    content: ModelContentBlock[];
    usage?: AnthropicUsage;
  };
  await meter.record(meter.kind, body.usage);
  const picked = pickToolUse(
    body.content,
    tools.map((t) => t.name),
  );
  if (!picked) throw new HttpError(502, "The model returned no proposals.");
  return {
    toolName: picked.name,
    input: picked.input,
    toolUseId: picked.id,
    raw: body.content,
    dropped: picked.dropped,
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
      error: `You've hit the generate limit (${LIMITS.perUser.limit} in ${LIMITS.perUser.windowSeconds / 60} minutes). Try again in a few minutes. The library and the manual fill path are unaffected.`,
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
      ...REPLY_AND_TITLE_PROPERTIES,
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
  documents: DocumentInput[];
}): string {
  const parts: string[] = [];
  parts.push(`Brief: ${input.brief}`);
  if (input.documents.length > 0) parts.push(documentsSection(input.documents));
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
      : "The team has no published templates to reference. Design cleanly from the palette and type styles alone.",
  );
  return parts.join("\n\n");
}

async function handleFreestyle(
  json: ReturnType<typeof jsonResponder>,
  db: ReturnType<typeof serviceClient>,
  apiKey: string,
  companyId: string,
  meter: Meter,
  input: {
    brief: string;
    platformHint: GeneratePlatform | undefined;
    count: number;
    image: { aspect: number | undefined } | undefined;
    documents: DocumentInput[];
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
      "Freestyle needs a brand palette to stay on brand. Add colors in Brand Studio first.",
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
    documents: input.documents,
  });

  const tools = [PROPOSE_DESIGNS_TOOL];
  let attempt = await callClaude(apiKey, userText, tools, { record: meter, kind: "freestyle" });
  let validated;
  try {
    validated = validateFreestyle(attempt.input as FreestyleModelOutput, ctx, input.count);
  } catch (e) {
    if (!(e instanceof GenerateValidationError)) throw e;
    attempt = await callClaude(
      apiKey,
      userText,
      tools,
      { record: meter, kind: "retry" },
      { prior: attempt, errors: e.errors },
    );
    try {
      validated = validateFreestyle(attempt.input as FreestyleModelOutput, ctx, input.count);
    } catch {
      return json(
        {
          error:
            "Freestyle couldn't produce a usable design from this brief. The library and the manual fill path are unaffected. Try again, or generate from your templates instead.",
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
    // The chat's reply and title: undefined unless the model gave usable
    // ones, and JSON drops undefined keys, so without them the body is
    // exactly what it always was.
    reply: validated.reply,
    title: validated.title,
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
// Repair: round two of the client's measurement pass (see the shared module
// for the contract). Same auth, same quota buckets: a repair is a model call
// and costs exactly what a generate does, and is metered as one.
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
  meter: Meter,
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
    .select("field_key, label, type, is_static, is_optional, max_length, placeholder, options")
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
  const tools = [REPAIR_VALUES_TOOL];
  let attempt = await callClaude(apiKey, userText, tools, { record: meter, kind: "repair" });
  let validated;
  try {
    validated = validateRepair(attempt.input as RepairModelOutput, requests);
  } catch (e) {
    if (!(e instanceof GenerateValidationError)) throw e;
    attempt = await callClaude(
      apiKey,
      userText,
      tools,
      { record: meter, kind: "retry" },
      { prior: attempt, errors: e.errors },
    );
    try {
      validated = validateRepair(attempt.input as RepairModelOutput, requests);
    } catch {
      return json(
        { error: "The rewrite couldn't fit the measured budgets. Drop that proposal." },
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

    const meter: Meter = (kind, usage) =>
      recordModelUsage(db, {
        companyId,
        userId: caller.userId,
        fn: "template-generate",
        kind,
        model: ANTHROPIC_MODEL,
        usage,
      });

    if (body.repair !== undefined) {
      return await handleRepair(json, db, apiKey, companyId, meter, body.repair);
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

    // A chat follow-up: the first brief and the drafts on screen. Parsed in
    // both modes so a malformed one is a 400 wherever it arrives, but only
    // library mode uses it. The client never sends it with freestyle (it
    // folds the earlier brief into `brief` there instead, PROMPT §9.3), so
    // one that arrives anyway is validated and then ignored. It never
    // narrows the candidate list; it only adds a section to the user text.
    const followUp = parseFollowUp(body.followUp);

    // Template chat fields (PROMPT §10.1). Details belong to one template, so
    // they need its hint, and a freestyle design has no fields to hold them.
    // Documents are text the browser extracted; nothing else of the file
    // ever arrives.
    const detailInputs = parseDetails(body.details) ?? [];
    const documents = parseDocuments(body.documents) ?? [];
    if (
      body.allowQuestion !== undefined &&
      body.allowQuestion !== null &&
      typeof body.allowQuestion !== "boolean"
    ) {
      throw new HttpError(400, "allowQuestion must be a boolean.");
    }
    if (detailInputs.length > 0 && (!templateIdHint || mode === "freestyle")) {
      throw new HttpError(400, "details need a templateIdHint and library mode.");
    }
    // A question is only ever the first thing a chat says, and only when the
    // member gave nothing structured to build from; a follow-up (the answer
    // to that question) can never ask again.
    const mayAsk =
      body.allowQuestion === true &&
      mode === "library" &&
      Boolean(templateIdHint) &&
      !followUp &&
      detailInputs.length === 0 &&
      documents.length === 0;

    if (mode === "freestyle") {
      return await handleFreestyle(json, db, apiKey, companyId, meter, {
        brief,
        platformHint,
        count,
        image,
        documents,
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
      throw new HttpError(400, "No published templates to generate from. Publish one first.");
    }
    if (rows.length > CANDIDATE_CAP) {
      rows = rows.slice(0, CANDIDATE_CAP);
      warnings.push(
        `The library has more than ${CANDIDATE_CAP} published templates. Considering the ${CANDIDATE_CAP} most recently updated.`,
      );
    }

    const { data: fieldRows, error: fieldsErr } = await db
      .from("template_fields")
      .select(
        "template_id, field_key, label, type, is_static, is_optional, max_length, placeholder, options",
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
    const published = rows.map((r) => candidateFromRows(r, fieldsByTemplate.get(r.id) ?? []));
    let candidates = published;

    // 2. Hints narrow the set. A named template is an instruction; a platform
    //    is a preference that falls back rather than emptying the list.
    if (templateIdHint) {
      candidates = candidates.filter((c) => c.id === templateIdHint);
      if (candidates.length === 0) {
        throw new HttpError(
          400,
          "That template is not in the published library any more. Pick another or generate without it.",
        );
      }
    } else if (platformHint) {
      const matching = candidates.filter((c) => c.platforms.includes(platformHint));
      if (matching.length > 0) {
        candidates = matching;
      } else {
        warnings.push("No published templates match that platform. Considering the whole library.");
      }
    }

    // A follow-up's drafts are matched against the published list from step
    // 1, not the narrowed one. "Make a Facebook version" (PROMPT §9.4)
    // always hints a platform the drafts' templates don't serve, so matching
    // after step 2 would drop every draft and the member's edits with it.
    // Only this company's published templates can appear, and the model still
    // chooses from `candidates` and is validated against them; a draft's own
    // template reused off that list costs the one retry, like any bad id.
    const followUpText = followUp ? followUpSection(followUp, published) : undefined;

    // With a hint, candidates is exactly that template.
    const details = templateIdHint ? resolveDetails(detailInputs, candidates[0]) : [];

    // 3. One tool call (forced, or one of two when a question is allowed);
    //    one retry carrying the validation errors, offering the same tools.
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
      followUpText,
      details,
      documents,
      mayAsk,
    );
    const tools = mayAsk ? [PROPOSE_POSTS_TOOL, ASK_MEMBER_TOOL] : [PROPOSE_POSTS_TOOL];
    const settle = (a: ClaudeAttempt) =>
      a.toolName === ASK_MEMBER_TOOL.name
        ? { question: validateQuestion(a.input) }
        : validateGeneration(a.input as GenerateModelOutput, candidates, count, details);
    let attempt = await callClaude(apiKey, userText, tools, { record: meter, kind: "generate" });
    let validated;
    try {
      validated = settle(attempt);
    } catch (e) {
      if (!(e instanceof GenerateValidationError)) throw e;
      attempt = await callClaude(
        apiKey,
        userText,
        tools,
        { record: meter, kind: "retry" },
        { prior: attempt, errors: e.errors },
      );
      try {
        validated = settle(attempt);
      } catch {
        return json(
          {
            error:
              "Generate couldn't produce a usable post from this brief. The library and the manual fill path are unaffected. Try rewording the brief, or fill a template directly.",
          },
          502,
        );
      }
    }
    // Both tools in one response should not happen with parallel tool use
    // off; if it does, the proposals win and the question is let go.
    if (attempt.dropped.length > 0) {
      warnings.push(`The model also called ${attempt.dropped.join(", ")}, which was ignored.`);
    }

    // Provenance is the product's stated position: every generated thing
    // can answer which model made it, from which library, and when.
    const meta = {
      model: ANTHROPIC_MODEL,
      generatedAt: new Date().toISOString(),
      candidateCount: candidates.length,
      briefLength: brief.length,
    };

    // A question is a finished turn with no proposals. An older client
    // ignores `question`; an older function never sends it.
    if ("question" in validated) {
      return json({ proposals: [], question: validated.question, warnings, meta });
    }

    return json({
      proposals: validated.proposals,
      // The chat's reply and title: undefined unless the model gave usable
      // ones, and JSON drops undefined keys, so without them the body is
      // exactly what it always was. A client that predates them ignores them.
      reply: validated.reply,
      title: validated.title,
      warnings: [...warnings, ...validated.warnings],
      meta,
    });
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    logError("template-generate", e);
    return json({ error: GENERIC_ERROR }, 500);
  }
});
