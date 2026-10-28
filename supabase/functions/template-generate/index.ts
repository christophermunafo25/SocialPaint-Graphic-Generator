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
// Generate makes NEW designs (mode "freestyle" on the wire, compose.ts):
// every published template is read into a house style and the most relevant
// ones are shown element by element, so a new post reuses the team's exact
// looks and layout habits, with Brand Studio's colors, type styles, fonts,
// logos and images as its only materials. A library request with no pinned
// template (a chat saved before Generate composed) may still find that no
// template suits its brief; the model then says so and a new design is
// composed instead of a template being forced to fit.
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
  validateGeneration,
  validateRepair,
  type CandidateTemplate,
  type FieldRowLike,
  type GenerateModelOutput,
  type GeneratePlatform,
  type RepairFieldRequest,
  type RepairModelOutput,
  type TemplateRowLike,
} from "../_shared/generateValidate.ts";
import {
  detailsSection,
  documentsSection,
  factsSection,
  parseDetails,
  parseFacts,
  type FactInput,
  parseDocuments,
  pickToolUse,
  resolveDetails,
  validateQuestion,
  type DocumentInput,
  type ModelContentBlock,
  type ResolvedDetail,
} from "../_shared/generateValidate.ts";
import {
  brandAssetSource,
  buildBrand,
  composeContext,
  parseCurrentDesigns,
  refFromStored,
  unhintedCanvas,
  type AssetRowLike,
  type KitRowLike,
  type RefTemplate,
  type Row,
  type TemplateRowLike as ComposeTemplateRow,
} from "../_shared/compose.ts";
import { COMPOSE_TOOL, composeUserText } from "../_shared/composePrompt.ts";
import {
  chooseComposeResult,
  leftOutWarnings,
  validateCompose,
  type ComposeValidation,
} from "../_shared/composeValidate.ts";
import { recordModelUsage, type AnthropicUsage, type UsageKind } from "../_shared/usage.ts";
import { COMPOSE_SYSTEM_PROMPT, GENERATE_SYSTEM_PROMPT } from "./prompt.ts";

const ANTHROPIC_MODEL = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-4-6";

/** Real retrieval is a later problem; this cap is where it will go. Ordered
 * by most recently updated, and the response says so when it truncates. */
const CANDIDATE_CAP = 40;

/** How many published templates a new design learns from (the house style
 * reads all of them; the most relevant are shown element by element). */
const COMPOSE_TEMPLATE_CAP = 40;

/** A new design's answer is longer than a fill's: every element with its
 * box and look, so the ceiling grows with the number of designs asked for,
 * and it bounds how long the call runs. */
const composeMaxTokens = (count: number) => Math.min(8000, 1600 + 2200 * count);
const FILL_MAX_TOKENS = 4000;

/** The platform answers 504 to a request still running at 150 seconds, so
 * every compose call ends inside this budget, counted from the request's
 * start, and a retry that would have under RETRY_FLOOR_MS of it left is
 * skipped in favor of what the first answer saved. */
const REQUEST_BUDGET_MS = 140_000;
const RETRY_FLOOR_MS = 30_000;

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

/** A library follow-up's brief as one brief: the chat's first brief, a blank
 * line, then the new message, the earlier text giving way first when the
 * two run past the 1,500 characters a brief may have. Mirrors composeBrief
 * in src/lib/generate/chatReducer.ts, which folds a new design's follow-ups
 * the same way. */
function foldBrief(previous: string, next: string): string {
  const room = 1500 - next.length - 2;
  if (room <= 0) return next.slice(0, 1500);
  const head = previous.slice(0, room).trimEnd();
  return head ? `${head}\n\n${next}` : next;
}

/** Offered beside propose_posts when the model may choose among templates
 * (no pin): its way to say that no template suits the brief, so a new
 * design is composed instead of a template being forced to fit. */
const COMPOSE_NEW_TOOL = {
  name: "compose_new_design",
  description:
    "Call instead of propose_posts when no candidate template's purpose suits the brief. A new design is composed from the brand and the team's templates instead.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["reason"],
    properties: {
      reason: { type: "string", description: "One sentence: why no template fits." },
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
  facts: FactInput[] = [],
): string {
  const parts: string[] = [];
  parts.push(`Brief: ${brief}`);
  // A chat follow-up reads as context for the brief, so it sits right after
  // it (followUpSection, built by the caller against the published list).
  if (followUpText) parts.push(followUpText);
  if (details.length > 0) parts.push(detailsSection(details));
  if (facts.length > 0) parts.push(factsSection(facts));
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
  /** The response ran into its token limit, so its tool input may be cut. */
  truncated: boolean;
}

/** The system prompt and token limit a call runs with. */
interface CallSetup {
  system: string;
  maxTokens: number;
  /** Ends the call when the request's time budget runs out. */
  signal?: AbortSignal;
}

const FILL_CALL: CallSetup = { system: GENERATE_SYSTEM_PROMPT, maxTokens: FILL_MAX_TOKENS };

/** A call ended by its time budget (setup.signal), not by the model. */
const isTimeout = (e: unknown): boolean =>
  e instanceof DOMException && (e.name === "TimeoutError" || e.name === "AbortError");

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
  setup: CallSetup,
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
      max_tokens: setup.maxTokens,
      system: [{ type: "text", text: setup.system, cache_control: { type: "ephemeral" } }],
      tools,
      tool_choice:
        tools.length === 1
          ? { type: "tool", name: tools[0].name }
          : { type: "any", disable_parallel_tool_use: true },
      messages,
    }),
    signal: setup.signal,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    logError("template-generate", `model request failed (${res.status}): ${detail.slice(0, 500)}`);
    throw new HttpError(502, `The model request failed (${res.status}). Try again.`);
  }
  const body = (await res.json()) as {
    content: ModelContentBlock[];
    usage?: AnthropicUsage;
    stop_reason?: string;
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
    truncated: body.stop_reason === "max_tokens",
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
// Compose: Generate's new designs (composeValidate.ts has the constraint set). The
// model proposes layout, and what keeps it on brand is what it builds from:
// Brand Studio as its only materials, the team's published templates as a
// measured house style and as references whose looks it reuses by id, and
// the deterministic checks that place, recolor and gate the result.
// ---------------------------------------------------------------------------

interface ComposeInput {
  brief: string;
  platformHint: GeneratePlatform | undefined;
  count: number;
  image: { aspect: number | undefined } | undefined;
  documents: DocumentInput[];
  facts: FactInput[];
  /** A follow-up's current drafts (D1, D2), already parsed. */
  drafts: RefTemplate[];
  /** When the request arrived (Date.now()), for REQUEST_BUDGET_MS. */
  startedAt: number;
}

/** What a compose call needs from the database: the brand kit, the brand
 * assets, and every published template with its fields. */
async function loadComposeMaterial(
  db: ReturnType<typeof serviceClient>,
  companyId: string,
): Promise<{ kit: KitRowLike | null; assets: AssetRowLike[]; published: RefTemplate[] }> {
  // Each asset kind has its own limit, so a large media library never
  // pushes the logos or the fonts out.
  const assetsOf = (kind: "logo" | "image" | "font", limit: number) =>
    db
      .from("brand_assets")
      .select("id, kind, name, storage_path, metadata")
      .eq("company_id", companyId)
      .eq("kind", kind)
      .order("created_at", { ascending: false })
      .limit(limit);
  const [kitRes, logoRes, fontRes, imageRes, templateRes] = await Promise.all([
    db
      .from("brand_kits")
      .select(
        "colors, type_styles, guidelines, primary_logo_asset_id, primary_logo_dark_asset_id, primary_logo_light_asset_id, allow_off_palette, allow_style_override",
      )
      .eq("company_id", companyId)
      .eq("is_active", true)
      .maybeSingle(),
    assetsOf("logo", 30),
    assetsOf("font", 30),
    assetsOf("image", 40),
    db
      .from("templates")
      .select("*")
      .eq("company_id", companyId)
      .eq("status", "published")
      .order("updated_at", { ascending: false })
      .limit(COMPOSE_TEMPLATE_CAP),
  ]);
  for (const res of [kitRes, logoRes, fontRes, imageRes, templateRes]) {
    if (res.error) {
      logError("template-generate", res.error);
      throw new HttpError(500, GENERIC_ERROR);
    }
  }
  const assets = [logoRes, fontRes, imageRes].flatMap((res) => (res.data ?? []) as AssetRowLike[]);
  const templates = (templateRes.data ?? []) as Array<ComposeTemplateRow & Row>;
  const fieldsByTemplate = new Map<string, Row[]>();
  // Paged: forty templates of imported layers can pass the API's 1,000 row
  // cap, and a cut page would lose each template's top layers.
  const FIELD_PAGE = 1000;
  for (let from = 0; templates.length > 0 && from < 5 * FIELD_PAGE; from += FIELD_PAGE) {
    const { data: fieldRows, error } = await db
      .from("template_fields")
      .select("*")
      .in(
        "template_id",
        templates.map((t) => t.id),
      )
      .order("template_id", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + FIELD_PAGE - 1);
    if (error) {
      logError("template-generate", error);
      throw new HttpError(500, GENERIC_ERROR);
    }
    for (const row of (fieldRows ?? []) as Row[]) {
      const id = String(row.template_id);
      const list = fieldsByTemplate.get(id) ?? [];
      list.push(row);
      fieldsByTemplate.set(id, list);
    }
    if ((fieldRows ?? []).length < FIELD_PAGE) break;
  }
  const logoSources = new Set(
    assets.filter((a) => a.kind === "logo").map((a) => brandAssetSource(a.storage_path)),
  );
  const published = templates
    .map((t, i) => refFromStored(`T${i + 1}`, t, fieldsByTemplate.get(t.id) ?? [], logoSources))
    .filter((r): r is RefTemplate => r !== null);
  return { kit: (kitRes.data ?? null) as KitRowLike | null, assets, published };
}

async function handleCompose(
  json: ReturnType<typeof jsonResponder>,
  db: ReturnType<typeof serviceClient>,
  apiKey: string,
  companyId: string,
  meter: Meter,
  input: ComposeInput,
  carried: string[] = [],
): Promise<Response> {
  const { kit, assets, published } = await loadComposeMaterial(db, companyId);
  const brand = buildBrand({ kit, assets, refs: published });
  if (!brand.colors.some((c) => c.source !== "neutral")) {
    throw new HttpError(
      400,
      "New designs need your brand colors. Add colors in Brand Studio first.",
    );
  }

  const canvas = input.platformHint
    ? canvasForPlatform(input.platformHint)
    : (unhintedCanvas(published, input.drafts) ?? canvasForPlatform(undefined));
  const ctx = composeContext({
    canvas,
    brand,
    published,
    brief: input.brief,
    drafts: input.drafts,
    hasPhoto: Boolean(input.image),
  });
  const extraSections: string[] = [];
  if (input.facts.length > 0) extraSections.push(factsSection(input.facts));
  if (input.documents.length > 0) extraSections.push(documentsSection(input.documents));
  const userText = composeUserText(ctx, {
    brief: input.brief,
    count: input.count,
    platform: input.platformHint,
    photoAspect: input.image ? (input.image.aspect ?? null) : undefined,
    extraSections,
  });

  const tools = [COMPOSE_TOOL];
  const remaining = () => REQUEST_BUDGET_MS - (Date.now() - input.startedAt);
  const setup = (): CallSetup => ({
    system: COMPOSE_SYSTEM_PROMPT,
    maxTokens: composeMaxTokens(input.count),
    signal: AbortSignal.timeout(Math.max(1_000, remaining())),
  });
  let first: ClaudeAttempt;
  try {
    first = await callClaude(apiKey, setup(), userText, tools, {
      record: meter,
      kind: "freestyle",
    });
  } catch (e) {
    if (!isTimeout(e)) throw e;
    logError("template-generate", "compose call ran out of time");
    return json({ error: "Generate ran out of time on this brief. Try again." }, 504);
  }
  let result: ComposeValidation = validateCompose(first.input, ctx, input.count);
  if (first.truncated || result.errors.length > 0) {
    if (remaining() < RETRY_FLOOR_MS) {
      logError("template-generate", "compose retry skipped, out of time");
    } else {
      // One retry. A response cut off at its token limit cannot be shown
      // back to the model as a tool call, so that retry starts over with a
      // note. A retry that fails (a model error, an empty answer, the time
      // budget) keeps what the first answer saved.
      try {
        const second = first.truncated
          ? await callClaude(
              apiKey,
              setup(),
              `${userText}\n\nYour last answer ran past the length limit. Keep each design to at most ${Math.min(ctx.elementCap, 14)} elements and the copy short.`,
              tools,
              { record: meter, kind: "retry" },
            )
          : await callClaude(
              apiKey,
              setup(),
              userText,
              tools,
              { record: meter, kind: "retry" },
              { prior: first, errors: result.errors },
            );
        result = chooseComposeResult(result, validateCompose(second.input, ctx, input.count));
      } catch (e) {
        logError("template-generate", e);
      }
    }
  }
  if (result.notes.length > 0) {
    console.info("[template-generate] compose notes", result.notes.slice(0, 40));
  }
  if (result.designs.length === 0) {
    return json(
      {
        error:
          "Generate couldn't make a usable design from this brief. Try again, or reword the brief.",
      },
      502,
    );
  }

  return json({
    proposals: result.designs.map((d, i) => ({
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
        backgroundGradient: d.backgroundGradient,
        canvasEffects: d.canvasEffects,
        captionTemplate: d.captionTemplate,
        fields: d.fields,
      },
    })),
    // The chat's reply and title: undefined unless the model gave usable
    // ones, and JSON drops undefined keys.
    reply: result.reply,
    title: result.title,
    warnings: [...carried, ...result.warnings, ...leftOutWarnings(result.errors)],
    meta: {
      model: ANTHROPIC_MODEL,
      generatedAt: new Date().toISOString(),
      candidateCount: published.length,
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
  let attempt = await callClaude(apiKey, FILL_CALL, userText, tools, {
    record: meter,
    kind: "repair",
  });
  let validated;
  try {
    validated = validateRepair(attempt.input as RepairModelOutput, requests);
  } catch (e) {
    if (!(e instanceof GenerateValidationError)) throw e;
    attempt = await callClaude(
      apiKey,
      FILL_CALL,
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
  const startedAt = Date.now();
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
    // A new design's follow-up carries its drafts themselves (D1, D2), so a
    // message like "make the date Friday" revises them in place. Parsed in
    // both modes; only compose reads it.
    const drafts = parseCurrentDesigns(body.currentDesigns, companyId) ?? [];

    // Template chat fields (PROMPT §10.1). Details belong to one template, so
    // they need its hint, and a freestyle design has no fields to hold them.
    // Documents are text the browser extracted; nothing else of the file
    // ever arrives.
    const detailInputs = parseDetails(body.details) ?? [];
    const documents = parseDocuments(body.documents) ?? [];
    // Generate's facts (new look, Phase 5): not tied to a template, so they
    // go with any request, library or freestyle.
    const facts = parseFacts(body.facts) ?? [];
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
      facts.length === 0 &&
      documents.length === 0;

    const composeInput: ComposeInput = {
      brief,
      platformHint,
      count,
      image,
      documents,
      facts,
      drafts,
      startedAt,
    };
    if (mode === "freestyle") {
      return await handleCompose(json, db, apiKey, companyId, meter, composeInput);
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
      if (templateIdHint) {
        throw new HttpError(400, "No published templates to generate from. Publish one first.");
      }
      // Nothing to fill: a new design, from the brand alone.
      return await handleCompose(json, db, apiKey, companyId, meter, {
        ...composeInput,
        brief: followUp ? foldBrief(followUp.previousBrief, brief) : brief,
      });
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
      facts,
    );
    // A pinned template is the member's choice; otherwise the model may say
    // that no template suits the brief, and a new design is composed.
    const tools = templateIdHint
      ? mayAsk
        ? [PROPOSE_POSTS_TOOL, ASK_MEMBER_TOOL]
        : [PROPOSE_POSTS_TOOL]
      : [PROPOSE_POSTS_TOOL, COMPOSE_NEW_TOOL];
    const settle = (a: ClaudeAttempt) =>
      a.toolName === COMPOSE_NEW_TOOL.name
        ? { composeInstead: true as const }
        : a.toolName === ASK_MEMBER_TOOL.name
          ? { question: validateQuestion(a.input) }
          : validateGeneration(a.input as GenerateModelOutput, candidates, count, details);
    let attempt = await callClaude(apiKey, FILL_CALL, userText, tools, {
      record: meter,
      kind: "generate",
    });
    let validated;
    try {
      validated = settle(attempt);
    } catch (e) {
      if (!(e instanceof GenerateValidationError)) throw e;
      attempt = await callClaude(
        apiKey,
        FILL_CALL,
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

    // No template suits the brief: a new design instead of a forced fill.
    // The library's warnings so far (a truncated list) still apply.
    if ("composeInstead" in validated) {
      return await handleCompose(
        json,
        db,
        apiKey,
        companyId,
        meter,
        { ...composeInput, brief: followUp ? foldBrief(followUp.previousBrief, brief) : brief },
        warnings,
      );
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
