// Auto-build: Claude turns an imported design into a finished template
// proposal. This function EXTRACTS (per source), ASKS (one forced tool call),
// VALIDATES (never trusting model output), and RESPONDS. It writes nothing to
// the database — the client applies the proposal to its draft and saves
// through templateStore like any manual edit.
//
// A Figma source is the import itself (import intent, Phase 1): the same
// run figma-import makes, then one forced tool call for what the layer
// names leave open, applied to the imported fields without touching their
// geometry. If that call fails the import still lands on its keys.

import { requireRole, serviceClient } from "../_shared/figma.ts";
import {
  GENERIC_ERROR,
  HttpError,
  handleOptions,
  jsonResponder,
  logError,
} from "../_shared/http.ts";
import {
  optionalEnum,
  optionalString,
  parseBody,
  parseCanvaUrl,
  requireEnum,
  requireNumber,
  requireOwnStorageRef,
  requireString,
  requireUuid,
} from "../_shared/validate.ts";
import { warningStrings, type ExtractionResult } from "../_shared/extract.ts";
import { importResponse, runFigmaImport } from "../_shared/figmaImportRun.ts";
import {
  applyIntentProposal,
  intentAsk,
  intentReport,
  intentRequest,
  readIntentAnswer,
  runIntentPass,
  skippedIssue,
  unfilledIssue,
  type IntentAnswer,
  type IntentBrand,
  type KitTypeStyle,
} from "../_shared/importIntent.ts";
import {
  AutobuildValidationError,
  validateProposal,
  type AutobuildSourceKind,
  type ModelProposal,
} from "../_shared/autobuildValidate.ts";
import { AUTOBUILD_DEFAULT_MODEL, AUTOBUILD_SYSTEM_PROMPT } from "./prompt.ts";
import { recordModelUsage, type AnthropicUsage, type UsageKind } from "../_shared/usage.ts";
import { canvaEnabled, getCanvaToken } from "../_shared/canva.ts";
import {
  CanvaExportError,
  assertPngExportable,
  exportPagePng,
  getDesignInfo,
  readPngDimensions,
  type ExportDeps,
} from "../_shared/canvaRestExport.ts";

type DesignSource =
  | { kind: "figma"; url: string }
  | { kind: "canva"; url: string }
  | { kind: "image"; backgroundUrl: string; canvasWidth: number; canvasHeight: number };

const ANTHROPIC_MODEL = Deno.env.get("ANTHROPIC_MODEL") ?? AUTOBUILD_DEFAULT_MODEL;

// ---------------------------------------------------------------------------
// Extractors
// ---------------------------------------------------------------------------

const CANVA_LINK_HELP =
  "Open the design in Canva and copy the link from the browser's address bar. It starts with canva.com/design/.";

/** Canva path: a flat PNG of page 1 through the documented Connect REST
 * export (canvaRestExport.ts). There is no element list, so the model
 * proposes boxes from the picture exactly as on the image path, and there
 * is NO layered recompose: the export stays as the background and fields
 * overlay their baked artwork, which is why the response carries no
 * sourceUrl. Canva's element geometry exists only on its MCP server, which
 * is parked (see canvaMcp.ts). */
async function extractCanva(
  db: ReturnType<typeof serviceClient>,
  companyId: string,
  url: string,
): Promise<ExtractionResult & { modelImageUrl: string }> {
  const parsed = parseCanvaUrl(url);
  if (!parsed) throw new HttpError(400, `That is not a Canva design link. ${CANVA_LINK_HELP}`);
  if ("shortLink" in parsed) {
    throw new HttpError(400, `Canva share links (canva.com/d/) cannot be read. ${CANVA_LINK_HELP}`);
  }
  const token = await getCanvaToken(db, companyId);
  if (!token) {
    throw new HttpError(
      400,
      "Canva is not connected for this workspace. Connect it from Settings.",
    );
  }

  const deps: ExportDeps = {
    fetch: (input, init) => fetch(input, init),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    now: () => Date.now(),
  };
  let bytes: Uint8Array;
  let info: Awaited<ReturnType<typeof getDesignInfo>>;
  try {
    info = await getDesignInfo(deps, token, parsed.designId);
    await assertPngExportable(deps, token, parsed.designId);
    const exported = await exportPagePng(deps, token, parsed.designId);
    if (exported.ttlMs !== null && exported.ttlMs <= 0) {
      throw new CanvaExportError("http", "Canva's export link had already expired. Try again.");
    }
    const res = await fetch(exported.url);
    if (!res.ok) {
      throw new CanvaExportError("http", `Could not download Canva's export (${res.status}).`);
    }
    bytes = new Uint8Array(await res.arrayBuffer());
  } catch (e) {
    if (e instanceof CanvaExportError) {
      // Every refusal names Canva so an admin does not read it as the
      // builder being broken; the code and status go to the log.
      logError("template-autobuild", `canva export ${e.code} ${e.status ?? ""}: ${e.message}`);
      throw new HttpError(e.status === 429 ? 429 : 502, e.message);
    }
    throw e;
  }
  const { width, height } = readPngDimensions(bytes);

  const path = `${companyId}/autobuild-canva-${Date.now()}.png`;
  const upload = await db.storage
    .from("template-backgrounds")
    .upload(path, bytes, { contentType: "image/png" });
  if (upload.error) {
    logError("template-autobuild", upload.error);
    throw new HttpError(500, "Storage upload failed — try again.");
  }
  const backgroundUrl = `template-backgrounds/${path}`;

  const warnings = [
    "Canva shares a flat image of the design, so field boxes are proposed from the picture. Check their positions in the inspector.",
    "The original text stays baked into the picture, so each editable text field gets a Fixed plate of the backdrop colour beneath it. Check the plates where the backdrop is a photo or gradient.",
  ];
  if (info.pageCount > 1) {
    warnings.push(`This design has ${info.pageCount} pages — only page 1 imported.`);
  }

  return {
    backgroundUrl,
    canvasWidth: width,
    canvasHeight: height,
    elements: [],
    warnings,
    modelImageUrl: backgroundUrl,
  };
}

/** Flat-image path: the background is already uploaded; there is no geometry. */
function extractImage(
  source: Extract<DesignSource, { kind: "image" }>,
): ExtractionResult & { modelImageUrl: string } {
  return {
    backgroundUrl: source.backgroundUrl,
    canvasWidth: Math.round(source.canvasWidth),
    canvasHeight: Math.round(source.canvasHeight),
    elements: [],
    warnings: [],
    modelImageUrl: source.backgroundUrl,
  };
}

// ---------------------------------------------------------------------------
// Anthropic call
// ---------------------------------------------------------------------------

const PROPOSE_TEMPLATE_TOOL = {
  name: "propose_template",
  description: "Propose the complete template configuration for this design.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["fields", "template", "rationale"],
    properties: {
      fields: {
        type: "array",
        description: "One entry per element, ordered as the member FORM should read.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["label", "fieldKey", "type"],
          properties: {
            sourceId: {
              type: "string",
              description:
                "The extraction element this field is. Omit only on a flat-image import.",
            },
            box: {
              type: "object",
              additionalProperties: false,
              required: ["x", "y", "width", "height"],
              description: "Flat-image imports only — proposed bounding box in canvas pixels.",
              properties: {
                x: { type: "number" },
                y: { type: "number" },
                width: { type: "number" },
                height: { type: "number" },
              },
            },
            label: { type: "string" },
            fieldKey: { type: "string" },
            type: { type: "string", enum: ["text", "multiline", "image", "select"] },
            options: { type: "array", items: { type: "string" } },
            static: {
              type: "boolean",
              description: "true = Fixed: stays on the canvas, leaves the member form.",
            },
            placeholder: { type: "string" },
            typeStyleKey: { type: "string" },
            colorKey: { type: "string" },
            plateHex: {
              type: "string",
              description:
                "Flat Canva imports, editable text fields only: the solid colour behind this text in the picture, as #RRGGBB. The system paints a Fixed rectangle of it under the field so the baked text does not show through. Omit when the backdrop is a photo or gradient.",
            },
          },
        },
      },
      template: {
        type: "object",
        additionalProperties: false,
        required: ["name", "description", "category", "tags", "captionTemplate"],
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          category: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
          captionTemplate: { type: "string" },
        },
      },
      rationale: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["fieldKey", "why"],
          properties: { fieldKey: { type: "string" }, why: { type: "string" } },
        },
      },
    },
  },
};

interface BrandContextFull {
  typeStyles: Array<{ key: string; name: string }>;
  colors: Array<{ key: string; name: string; hex: string }>;
  catalog: Array<{ name: string; category: string }>;
}

/** Read the model's design image. A storage reference is downloaded via the
 * service client (the buckets are private); only non-reference URLs — the
 * Figma render CDN — are fetched over HTTP. */
async function fetchPngBase64(db: ReturnType<typeof serviceClient>, src: string): Promise<string> {
  let buf: Uint8Array;
  const ref = /^(brand-assets|template-backgrounds)\/(.+)$/.exec(src);
  if (ref) {
    const { data, error } = await db.storage.from(ref[1]).download(ref[2]);
    if (error || !data) {
      throw new HttpError(502, "Could not read the design image from storage.");
    }
    buf = new Uint8Array(await data.arrayBuffer());
  } else {
    const res = await fetch(src);
    if (!res.ok) throw new HttpError(502, `Could not fetch the design image (${res.status}).`);
    buf = new Uint8Array(await res.arrayBuffer());
  }
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    binary += String.fromCharCode(...buf.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function buildUserText(
  extraction: ExtractionResult,
  brand: BrandContextFull,
  hint: string | undefined,
  sourceKind: AutobuildSourceKind,
  platesBehindText: boolean,
): string {
  const parts: string[] = [];
  parts.push(
    `Canvas: ${extraction.canvasWidth}x${extraction.canvasHeight}px. Source: ${sourceKind}.`,
  );
  if (sourceKind === "image") {
    parts.push(
      "This is a flat image import — there is no element list. Propose fields with conservative bounding boxes (box, in canvas pixels). Prefer fewer confident fields to many uncertain ones.",
    );
    if (platesBehindText) {
      parts.push(
        "This picture is a Canva export and its original text stays baked into the background. For every editable text field, also give plateHex: the solid colour visible behind that text in the picture, as #RRGGBB. The system paints a Fixed rectangle of it under the field so the baked text does not show through. If the backdrop there is a photo or a gradient rather than a solid colour, omit plateHex.",
      );
    }
  } else {
    parts.push(
      `Extracted elements (reference by sourceId; all geometry is authoritative):\n${JSON.stringify(extraction.elements)}`,
    );
  }
  parts.push(
    `Brand kit — type styles: ${JSON.stringify(brand.typeStyles)}; palette: ${JSON.stringify(brand.colors)}.`,
  );
  parts.push(
    brand.catalog.length
      ? `Existing catalog (reuse this category/tag vocabulary): ${JSON.stringify(brand.catalog)}`
      : "The catalog is empty — choose a sensible first category.",
  );
  if (hint) parts.push(`Admin's note: ${hint}`);
  return parts.join("\n\n");
}

/** One model call. Every response that comes back is metered as `kind`
 * (ai_usage_events) before anything else happens to it; `record` never
 * throws. */
async function callClaude(
  apiKey: string,
  imageBase64: string,
  userText: string,
  meter: {
    record: (kind: UsageKind, usage: AnthropicUsage | undefined) => Promise<void>;
    kind: UsageKind;
  },
  retryErrors?: { priorContent: unknown[]; toolUseId: string; errors: string[] },
): Promise<{ proposal: ModelProposal; toolUseId: string; raw: unknown[] }> {
  const messages: unknown[] = [
    {
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: "image/png", data: imageBase64 } },
        { type: "text", text: userText },
      ],
    },
  ];
  if (retryErrors) {
    messages.push({ role: "assistant", content: retryErrors.priorContent });
    messages.push({
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: retryErrors.toolUseId,
          is_error: true,
          content: `Your proposal failed validation: ${retryErrors.errors.join(" ")} Correct these and call propose_template again.`,
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
        { type: "text", text: AUTOBUILD_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      tools: [PROPOSE_TEMPLATE_TOOL],
      tool_choice: { type: "tool", name: "propose_template" },
      messages,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    logError("template-autobuild", `model request failed (${res.status}): ${detail.slice(0, 500)}`);
    throw new HttpError(502, `The model request failed (${res.status}) — try again.`);
  }
  const body = (await res.json()) as {
    content: Array<{ type: string; id?: string; name?: string; input?: unknown }>;
    usage?: AnthropicUsage;
  };
  await meter.record(meter.kind, body.usage);
  const toolUse = body.content.find((b) => b.type === "tool_use" && b.name === "propose_template");
  if (!toolUse?.input) throw new HttpError(502, "The model returned no proposal.");
  return {
    proposal: toolUse.input as ModelProposal,
    toolUseId: toolUse.id ?? "",
    raw: body.content,
  };
}

// ---------------------------------------------------------------------------
// The Figma route: one forced tool call over the imported fields.
// ---------------------------------------------------------------------------

/** How long the import waits for the model before landing on its keys.
 * The Figma work comes first, and the two together have to end inside the
 * platform's limit on a request. */
const INTENT_TIMEOUT_MS = 90_000;

/** One model call for a Figma import. A response that comes back is metered
 * before it is read. Throws when no response comes back; the caller lands
 * the import without it. */
async function callIntentModel(
  apiKey: string,
  imageBase64: string | null,
  userText: string,
  mode: "template" | "elements",
  record: (usage: AnthropicUsage | undefined) => Promise<void>,
): Promise<IntentAnswer> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal: AbortSignal.timeout(INTENT_TIMEOUT_MS),
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(
      intentRequest({
        model: ANTHROPIC_MODEL,
        system: AUTOBUILD_SYSTEM_PROMPT,
        mode,
        imageBase64,
        userText,
      }),
    ),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`model request failed (${res.status}): ${detail.slice(0, 500)}`);
  }
  const answer = readIntentAnswer(await res.json());
  await record(answer.usage);
  return answer;
}

/** The kit as the model pass reads it: the palette and type styles, and
 * for a template the catalog's names and categories. */
async function loadIntentBrand(
  db: ReturnType<typeof serviceClient>,
  companyId: string,
  mode: "template" | "elements",
): Promise<IntentBrand> {
  const { data: kitRow } = await db
    .from("brand_kits")
    .select("colors, type_styles")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .maybeSingle();
  const colors = ((kitRow?.colors ?? []) as Array<{ key: string; name: string; hex: string }>).map(
    ({ key, name, hex }) => ({ key, name, hex }),
  );
  const typeStyles = (kitRow?.type_styles ?? []) as KitTypeStyle[];
  if (mode !== "template") return { colors, typeStyles, catalog: [] };
  const { data: templateRows } = await db
    .from("templates")
    .select("name, category")
    .eq("company_id", companyId)
    .limit(40);
  return {
    colors,
    typeStyles,
    catalog: (templateRows ?? []) as Array<{ name: string; category: string }>,
  };
}

// ---------------------------------------------------------------------------

/** Validate the polymorphic `source` before anything runs. The image kind's
 * backgroundUrl is fetched SERVER-SIDE later — pinning it to our own Storage
 * bucket is what keeps this endpoint from being an SSRF primitive. */
function validateSource(raw: unknown): DesignSource {
  if (typeof raw !== "object" || raw === null) {
    throw new HttpError(400, "source must be an object.");
  }
  const src = raw as Record<string, unknown>;
  const kind = requireEnum(src.kind, "source.kind", ["figma", "canva", "image"] as const);
  if (kind === "image") {
    return {
      kind,
      backgroundUrl: requireOwnStorageRef(
        src.backgroundUrl,
        "source.backgroundUrl",
        "template-backgrounds",
      ),
      canvasWidth: requireNumber(src.canvasWidth, "source.canvasWidth", { min: 1, max: 20000 }),
      canvasHeight: requireNumber(src.canvasHeight, "source.canvasHeight", { min: 1, max: 20000 }),
    };
  }
  return { kind, url: requireString(src.url, "source.url", 2048) };
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  const json = jsonResponder(req);
  try {
    const body = await parseBody(req);
    const companyId = requireUuid(body.companyId, "companyId");
    const source = validateSource(body.source);
    const hint = optionalString(body.hint, "hint", 500);
    const mode = optionalEnum(body.mode, "mode", ["template", "elements"] as const) ?? "template";
    if (mode === "elements" && source.kind !== "figma") {
      throw new HttpError(400, "mode elements needs a Figma source.");
    }

    const caller = await requireRole(req, companyId, "admin");
    if ("error" in caller) return json({ error: caller.error }, caller.status);

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return json(
        {
          error:
            "Auto-build is not configured: set the ANTHROPIC_API_KEY secret (supabase secrets set) and redeploy.",
        },
        503,
      );
    }

    const db = serviceClient();

    const record = (kind: UsageKind, usage: AnthropicUsage | undefined) =>
      recordModelUsage(db, {
        companyId,
        userId: caller.userId,
        fn: "template-autobuild",
        kind,
        model: ANTHROPIC_MODEL,
        usage,
      });

    // A Figma source: the import, then the model pass over its fields.
    if (source.kind === "figma") {
      const run = await runFigmaImport({ db, companyId, url: source.url, mode, modelImage: true });
      const ask = intentAsk(run.fields, run.intents);
      // The import never depends on the model: when the pass decides
      // nothing, the fields stand exactly as the keys put them.
      const pass = await runIntentPass({
        mode,
        frameName: run.frameName,
        width: run.width,
        height: run.height,
        fields: run.fields,
        intents: run.intents,
        ask,
        hint,
        deps: {
          brand: () => loadIntentBrand(db, companyId, mode),
          picture: () =>
            run.modelImageUrl ? fetchPngBase64(db, run.modelImageUrl) : Promise.resolve(null),
          call: (imageBase64, userText) =>
            callIntentModel(apiKey, imageBase64, userText, mode, (usage) =>
              record("autobuild", usage),
            ),
        },
      });
      if (pass.failed) logError("template-autobuild", `model pass: ${pass.failed}`);
      const outcome = pass.outcome;
      if (outcome) run.details.push(...outcome.issues);
      // A frame with no text or image has no form to fill in, so there is
      // nothing to say about it.
      if (!outcome && ask.elements.length) run.details.push(unfilledIssue(run.frameName, mode));
      if (outcome && ask.skipped) run.details.push(skippedIssue(run.frameName, ask.skipped));

      const intent = intentReport({
        fields: run.fields,
        intents: run.intents,
        parse: run.parse,
        capTrim: run.capTrim,
        filledBy: outcome ? "model" : "keys",
        formOrder: outcome?.formOrder,
        cost: pass.cost,
      });
      return json(
        importResponse(run, warningStrings, {
          frameName: run.frameName,
          intent,
          ...(outcome
            ? {
                ...(outcome.template ? { template: outcome.template } : {}),
                rationale: outcome.rationale,
                meta: {
                  model: ANTHROPIC_MODEL,
                  sourceKind: "figma",
                  generatedAt: new Date().toISOString(),
                  elementCount: run.fields.length,
                  editableCount: intent.formOrder.length,
                },
              }
            : {}),
        }),
      );
    }

    // 1. Extract.
    let extraction: ExtractionResult & { modelImageUrl: string };
    if (source.kind === "image") {
      extraction = extractImage(source);
    } else {
      if (!canvaEnabled()) return json({ error: "Canva auto-build is not enabled." }, 501);
      extraction = await extractCanva(db, companyId, source.url);
    }

    // 2. Brand kit + catalog context.
    const { data: kitRow } = await db
      .from("brand_kits")
      .select("colors, type_styles")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .maybeSingle();
    const colors = (kitRow?.colors ?? []) as Array<{ key: string; name: string; hex: string }>;
    const typeStyles = ((kitRow?.type_styles ?? []) as Array<{ key: string; name: string }>).map(
      ({ key, name }) => ({ key, name }),
    );
    const { data: templateRows } = await db
      .from("templates")
      .select("name, category")
      .eq("company_id", companyId)
      .limit(40);
    const catalog = (templateRows ?? []) as Array<{ name: string; category: string }>;

    // 3. The design, as the model sees it.
    const imageBase64 = await fetchPngBase64(db, extraction.modelImageUrl);

    // Canva arrives as a flat export with no element list, so the model and
    // the validator treat it as the image path. The response still reports
    // "canva" for provenance. The validator's own canva branch belongs to
    // the parked geometry path and is unreachable from here.
    const proposalKind: AutobuildSourceKind = source.kind === "canva" ? "image" : source.kind;
    // The Canva export has its text baked in with no recompose to lift it,
    // so editable text gets a plate of the backdrop colour beneath it.
    const platesBehindText = source.kind === "canva";

    // 4. One forced tool call; one retry carrying the validation errors.
    const userText = buildUserText(
      extraction,
      { typeStyles, colors, catalog },
      hint,
      proposalKind,
      platesBehindText,
    );
    let attempt = await callClaude(apiKey, imageBase64, userText, { record, kind: "autobuild" });
    let validated;
    try {
      validated = validateProposal(
        attempt.proposal,
        extraction,
        {
          typeStyleKeys: typeStyles.map((s) => s.key),
          colors: colors.map(({ key, hex }) => ({ key, hex })),
        },
        proposalKind,
        { platesBehindText },
      );
    } catch (e) {
      if (!(e instanceof AutobuildValidationError)) throw e;
      attempt = await callClaude(
        apiKey,
        imageBase64,
        userText,
        { record, kind: "retry" },
        {
          priorContent: attempt.raw,
          toolUseId: attempt.toolUseId,
          errors: e.errors,
        },
      );
      try {
        validated = validateProposal(
          attempt.proposal,
          extraction,
          {
            typeStyleKeys: typeStyles.map((s) => s.key),
            colors: colors.map(({ key, hex }) => ({ key, hex })),
          },
          proposalKind,
          { platesBehindText },
        );
      } catch {
        return json(
          {
            error:
              "Auto-build couldn't read this design. The plain import and the blank canvas are unaffected — build it manually and try auto-build on another design.",
          },
          502,
        );
      }
    }

    const warnings = [...extraction.warnings, ...validated.warnings];

    const editableCount = validated.fields.filter((f) => !f.static).length;
    return json({
      sourceKind: source.kind,
      backgroundUrl: extraction.backgroundUrl,
      canvasWidth: extraction.canvasWidth,
      canvasHeight: extraction.canvasHeight,
      sourceUrl: extraction.sourceUrl,
      fields: validated.fields,
      template: validated.template,
      rationale: validated.rationale,
      warnings,
      meta: {
        model: ANTHROPIC_MODEL,
        sourceKind: source.kind,
        generatedAt: new Date().toISOString(),
        elementCount: validated.fields.length,
        editableCount,
      },
    });
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    logError("template-autobuild", e);
    return json({ error: GENERIC_ERROR }, 500);
  }
});
