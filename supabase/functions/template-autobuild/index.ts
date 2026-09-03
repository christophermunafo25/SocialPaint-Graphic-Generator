// Auto-build: Claude turns an imported design into a finished template
// proposal. This function EXTRACTS (per source), ASKS (one forced tool call),
// VALIDATES (never trusting model output), and RESPONDS. It writes nothing to
// the database — the client applies the proposal to its draft and saves
// through templateStore like any manual edit.

import {
  figmaGet,
  getFigmaToken,
  parseFigmaUrl,
  requireRole,
  serviceClient,
} from "../_shared/figma.ts";
import {
  GENERIC_ERROR,
  HttpError,
  handleOptions,
  jsonResponder,
  logError,
} from "../_shared/http.ts";
import {
  optionalString,
  parseBody,
  parseCanvaUrl,
  requireEnum,
  requireNumber,
  requireOwnStorageRef,
  requireString,
  requireUuid,
} from "../_shared/validate.ts";
import {
  figmaFieldsToElements,
  walk,
  warningStrings,
  type ExtractionResult,
  type FigmaNode,
  type ImportWarning,
  type SuggestedField,
} from "../_shared/extract.ts";
import {
  AutobuildValidationError,
  validateProposal,
  type AutobuildSourceKind,
  type ModelProposal,
  type ValidatedField,
} from "../_shared/autobuildValidate.ts";
import { AUTOBUILD_SYSTEM_PROMPT } from "./prompt.ts";
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

const ANTHROPIC_MODEL = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-4-6";

// ---------------------------------------------------------------------------
// Extractors
// ---------------------------------------------------------------------------

async function extractFigma(
  db: ReturnType<typeof serviceClient>,
  companyId: string,
  url: string,
): Promise<ExtractionResult & { modelImageUrl: string }> {
  const parsed = parseFigmaUrl(url);
  if (!parsed)
    throw new HttpError(
      400,
      "Could not read that link — copy a frame link (with node-id) from Figma.",
    );
  const token = await getFigmaToken(db, companyId);
  if (!token) throw new HttpError(400, "Figma is not connected for this company.");

  const nodesRes = await figmaGet(
    `/v1/files/${parsed.fileKey}/nodes?ids=${encodeURIComponent(parsed.nodeId)}&geometry=paths`,
    token,
  );
  if (!nodesRes.ok) throw new HttpError(400, `Figma nodes request failed (${nodesRes.status}).`);
  const nodesBody = (await nodesRes.json()) as {
    nodes: Record<string, { document: FigmaNode } | null>;
  };
  const root = nodesBody.nodes[parsed.nodeId]?.document;
  if (!root?.absoluteBoundingBox)
    throw new HttpError(400, "That node has no renderable bounds — pick a frame.");
  const frame = root.absoluteBoundingBox;

  // Two renders: scale 2 for the stored background (matching figma-import),
  // scale 1 for the model's eyes — a frame is nearly always <=1568 at 1x, so
  // no client-side resampling is needed in this runtime.
  const imgRes = await figmaGet(
    `/v1/images/${parsed.fileKey}?ids=${encodeURIComponent(parsed.nodeId)}&format=png&scale=2`,
    token,
  );
  if (!imgRes.ok) throw new HttpError(400, `Figma render failed (${imgRes.status}).`);
  const imgBody = (await imgRes.json()) as { images: Record<string, string | null> };
  const renderUrl = imgBody.images[parsed.nodeId];
  if (!renderUrl) throw new HttpError(400, "Figma could not render that frame.");
  const png = await (await fetch(renderUrl)).arrayBuffer();

  const path = `${companyId}/autobuild-${Date.now()}.png`;
  const upload = await db.storage
    .from("template-backgrounds")
    .upload(path, png, { contentType: "image/png" });
  if (upload.error) {
    logError("template-autobuild", upload.error);
    throw new HttpError(500, "Storage upload failed — try again.");
  }
  // Storage REFERENCE — the buckets are private; the client signs it.
  const backgroundUrl = `template-backgrounds/${path}`;

  const scale1Res = await figmaGet(
    `/v1/images/${parsed.fileKey}?ids=${encodeURIComponent(parsed.nodeId)}&format=png&scale=1`,
    token,
  );
  let modelImageUrl = renderUrl; // fall back to the 2x render — the API downsizes
  if (scale1Res.ok) {
    const body = (await scale1Res.json()) as { images: Record<string, string | null> };
    modelImageUrl = body.images[parsed.nodeId] ?? renderUrl;
  }

  const suggested: SuggestedField[] = [];
  const details: ImportWarning[] = [];
  const taken = new Set<string>();
  const seenIds = new Set<string>();
  const warnings: string[] = [];
  try {
    for (const child of root.children ?? []) walk(child, frame, suggested, details, taken, seenIds);
  } catch (e) {
    logError("template-autobuild", e);
    warnings.push("Element detection stopped early.");
  }
  warnings.unshift(...warningStrings(details));

  return {
    backgroundUrl,
    canvasWidth: Math.round(frame.width),
    canvasHeight: Math.round(frame.height),
    elements: figmaFieldsToElements(suggested),
    sourceUrl: url,
    warnings,
    modelImageUrl,
  };
}

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
    "Canva imports keep the original artwork visible behind editable text — give editable text a fill or a background shape behind it.",
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
            required: { type: "boolean" },
            maxLength: { type: "number" },
            placeholder: { type: "string" },
            typeStyleKey: { type: "string" },
            colorKey: { type: "string" },
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
): string {
  const parts: string[] = [];
  parts.push(
    `Canvas: ${extraction.canvasWidth}x${extraction.canvasHeight}px. Source: ${sourceKind}.`,
  );
  if (sourceKind === "image") {
    parts.push(
      "This is a flat image import — there is no element list. Propose fields with conservative bounding boxes (box, in canvas pixels). Prefer fewer confident fields to many uncertain ones.",
    );
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

async function callClaude(
  apiKey: string,
  imageBase64: string,
  userText: string,
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
  };
  const toolUse = body.content.find((b) => b.type === "tool_use" && b.name === "propose_template");
  if (!toolUse?.input) throw new HttpError(502, "The model returned no proposal.");
  return {
    proposal: toolUse.input as ModelProposal,
    toolUseId: toolUse.id ?? "",
    raw: body.content,
  };
}

// ---------------------------------------------------------------------------
// Fixed images need real content: a static image field is lifted off the
// background by the recompose, so without a staticValue it would vanish.
// Render those nodes individually and re-host them; if a render fails, the
// field degrades to editable (visible placeholder) rather than to nothing.
// ---------------------------------------------------------------------------

async function bakeStaticImages(
  db: ReturnType<typeof serviceClient>,
  companyId: string,
  sourceUrl: string,
  fields: ValidatedField[],
  warnings: string[],
): Promise<void> {
  const targets = fields.filter((f) => f.static && f.type === "image" && f.sourceNodeId);
  if (!targets.length) return;
  const parsed = parseFigmaUrl(sourceUrl);
  const token = parsed ? await getFigmaToken(db, companyId) : null;
  const degrade = (f: ValidatedField, why: string) => {
    f.static = undefined;
    f.staticValue = undefined;
    warnings.push(`"${f.label}": ${why} — left member-editable so it stays visible.`);
  };
  if (!parsed || !token) {
    targets.forEach((f) => degrade(f, "couldn't render its artwork"));
    return;
  }
  try {
    const ids = targets.map((f) => f.sourceNodeId!).join(",");
    const res = await figmaGet(
      `/v1/images/${parsed.fileKey}?ids=${encodeURIComponent(ids)}&format=png&scale=2`,
      token,
    );
    const body = res.ok
      ? ((await res.json()) as { images: Record<string, string | null> })
      : { images: {} };
    for (const f of targets) {
      const url = body.images[f.sourceNodeId!];
      if (!url) {
        degrade(f, "Figma couldn't render its artwork");
        continue;
      }
      const png = await (await fetch(url)).arrayBuffer();
      const path = `${companyId}/autobuild-static-${crypto.randomUUID()}.png`;
      const upload = await db.storage
        .from("template-backgrounds")
        .upload(path, png, { contentType: "image/png" });
      if (upload.error) {
        degrade(f, "its artwork upload failed");
        continue;
      }
      f.staticValue = `template-backgrounds/${path}`;
    }
  } catch {
    targets
      .filter((f) => f.static && !f.staticValue)
      .forEach((f) => degrade(f, "couldn't render its artwork"));
  }
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

    // 1. Extract.
    let extraction: ExtractionResult & { modelImageUrl: string };
    if (source.kind === "figma") {
      extraction = await extractFigma(db, companyId, source.url);
    } else if (source.kind === "image") {
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

    // 4. One forced tool call; one retry carrying the validation errors.
    const userText = buildUserText(extraction, { typeStyles, colors, catalog }, hint, proposalKind);
    let attempt = await callClaude(apiKey, imageBase64, userText);
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
      );
    } catch (e) {
      if (!(e instanceof AutobuildValidationError)) throw e;
      attempt = await callClaude(apiKey, imageBase64, userText, {
        priorContent: attempt.raw,
        toolUseId: attempt.toolUseId,
        errors: e.errors,
      });
      try {
        validated = validateProposal(
          attempt.proposal,
          extraction,
          {
            typeStyleKeys: typeStyles.map((s) => s.key),
            colors: colors.map(({ key, hex }) => ({ key, hex })),
          },
          source.kind,
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

    // 5. Fixed image fields get their artwork baked, or degrade to editable.
    if (source.kind === "figma" && extraction.sourceUrl) {
      await bakeStaticImages(db, companyId, extraction.sourceUrl, validated.fields, warnings);
    }

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
