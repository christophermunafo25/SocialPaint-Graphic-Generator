// One Figma import, shared by figma-import and template-autobuild (import
// intent, Phase 1): fetch the tree, walk it with its keys and its layout,
// land the artwork, then render the background (a template) or decompose
// what the walk left over (pasted elements). Whatever asks the model, or
// doesn't, starts from this result, so both routes land the same thing.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  MAX_UNITS,
  fetchFillMap,
  fetchNodeTree,
  figmaGet,
  getFigmaToken,
  mapLimit,
  parseFigmaUrl,
  rehost,
  renderNodes,
} from "./figma.ts";
import { HttpError, logError } from "./http.ts";
import type { FigmaNode, ImportWarning, ImportedEffect, SuggestedField } from "./extract.ts";
import { fillRefsOf, importFrame, landImageAssets, maskIdsOf, renderIdsOf } from "./importFrame.ts";
import { decomposeFrame, pruneTree, type LayerNode, type Unit } from "./figmaLayers.ts";
import type { CapTrim, FieldIntent } from "./frameIntent.ts";
import { applyKitLogos } from "./importIntent.ts";
import type { ParseReport } from "./recipe.ts";

export type ImportMode = "template" | "elements";

export interface FigmaImportRun {
  mode: ImportMode;
  frameName: string;
  /** The frame's (or the pasted layer's) size. */
  width: number;
  height: number;
  /** In paint order, artwork landed, keys and layout applied. */
  fields: SuggestedField[];
  intents: FieldIntent[];
  parse: ParseReport;
  capTrim: CapTrim[];
  /** Every issue so far. The caller adds its own, then responds. */
  details: ImportWarning[];
  sourceUrl: string;
  /** Template mode. */
  backgroundUrl?: string;
  canvasEffects?: ImportedEffect[];
  tree?: LayerNode;
  /** Elements mode: what the walk didn't claim, in paint order. */
  units?: Array<Omit<Unit, "nodeId">>;
  /** A render at scale 1 for the model's eyes, when asked for and when
   * Figma gave one. */
  modelImageUrl?: string;
}

async function renderUrl(
  fileKey: string,
  nodeId: string,
  scale: 1 | 2,
  token: string,
): Promise<{ url: string | null; status: number }> {
  const res = await figmaGet(
    `/v1/images/${fileKey}?ids=${encodeURIComponent(nodeId)}&format=png&scale=${scale}`,
    token,
  );
  if (!res.ok) return { url: null, status: res.status };
  const body = (await res.json()) as { images: Record<string, string | null> };
  return { url: body.images[nodeId] ?? null, status: res.status };
}

/** The kit's primary logo per surface, as storage references. */
async function kitLogoSources(
  db: SupabaseClient,
  companyId: string,
): Promise<{ light?: string; dark?: string }> {
  const { data: kit } = await db
    .from("brand_kits")
    .select("primary_logo_asset_id, primary_logo_light_asset_id, primary_logo_dark_asset_id")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .maybeSingle();
  const row = (kit ?? {}) as Record<string, string | null>;
  const lightId = row.primary_logo_light_asset_id ?? row.primary_logo_asset_id;
  const darkId = row.primary_logo_dark_asset_id ?? row.primary_logo_asset_id;
  const ids = [...new Set([lightId, darkId].filter((v): v is string => Boolean(v)))];
  if (!ids.length) return {};
  const { data: assets } = await db
    .from("brand_assets")
    .select("id, storage_path")
    .eq("company_id", companyId)
    .eq("kind", "logo")
    .in("id", ids);
  const pathById = new Map(
    ((assets ?? []) as Array<{ id: string; storage_path: string }>).map((a) => [
      a.id,
      a.storage_path,
    ]),
  );
  // A storage_path is a reference, a bare path in the brand bucket, or an
  // outside URL (storageRef.ts).
  const source = (id: string | null | undefined): string | undefined => {
    const path = id ? pathById.get(id) : undefined;
    if (!path) return undefined;
    return /^(https?:\/\/|brand-assets\/|template-backgrounds\/)/.test(path)
      ? path
      : `brand-assets/${path}`;
  };
  return { light: source(lightId), dark: source(darkId) };
}

export async function runFigmaImport(opts: {
  db: SupabaseClient;
  companyId: string;
  url: string;
  mode: ImportMode;
  /** Also fetch a scale 1 render for the model. */
  modelImage?: boolean;
}): Promise<FigmaImportRun> {
  const { db, companyId, url, mode } = opts;
  const parsed = parseFigmaUrl(url);
  if (!parsed) {
    throw new HttpError(
      400,
      "That isn't a link to a Figma frame. Copy the link to a frame in Figma and try again.",
    );
  }
  const token = await getFigmaToken(db, companyId);
  if (!token) throw new HttpError(400, "Figma is not connected for this company.");

  // 1. Node subtree, fetched once (geometry=paths carries rotation, true
  //    size and vector geometry). The same tree feeds the field walk, the
  //    decompose step and, pruned, the client's later recompose.
  const fetched = await fetchNodeTree<FigmaNode & LayerNode>(parsed.fileKey, parsed.nodeId, token);
  if ("error" in fetched) throw new HttpError(fetched.status, fetched.error);
  const root = fetched.root;
  if (!root.absoluteBoundingBox) {
    throw new HttpError(400, "That layer has nothing to draw. Pick a frame or a visible layer.");
  }
  const frame = root.absoluteBoundingBox;
  const stamp = Date.now();

  // The model's picture is asked for now and awaited last, so it costs no
  // time of its own. A failure only means the model reads the list alone.
  const modelImage = opts.modelImage
    ? renderUrl(parsed.fileKey, parsed.nodeId, 1, token).catch(() => ({ url: null, status: 0 }))
    : null;

  // 2. Fields from the tree, with the keys in the layer names and the auto
  //    layout around them applied (importFrame: the pure half the fidelity
  //    harness replays offline).
  const {
    fields,
    canvasEffects,
    warnings: details,
    intents,
    parse,
    capTrim,
  } = importFrame(root, mode);

  // 3. Image elements carry their designed artwork, and custom-shape masks
  //    their alpha: resolve fills first, then render what is left in one
  //    batched pass each, and re-host everything.
  const fillRefs = fillRefsOf(fields);
  const fills = fillRefs.length ? await fetchFillMap(parsed.fileKey, token) : {};
  const renders = await renderNodes(parsed.fileKey, renderIdsOf(fields, fills), token);
  const maskIds = maskIdsOf(fields);
  const masks = maskIds.length ? await renderNodes(parsed.fileKey, maskIds, token) : {};
  let assetIndex = 0;
  let maskIndex = 0;
  await landImageAssets(
    fields,
    { fills, renders, masks },
    (source, kind) =>
      rehost(
        db,
        source,
        kind === "mask"
          ? `${companyId}/masks/${stamp}-${maskIndex++}.png`
          : `${companyId}/elements/${stamp}-${assetIndex++}.png`,
      ),
    details,
  );

  // A keyed logo takes the kit's own. Reading the kit never fails an import.
  if (intents.some((i) => i.declared.kind === "logo")) {
    try {
      applyKitLogos(fields, intents, await kitLogoSources(db, companyId), details);
    } catch (e) {
      logError("figma-import-run", e);
    }
  }

  const base = {
    mode,
    frameName: root.name,
    width: Math.round(frame.width),
    height: Math.round(frame.height),
    fields,
    intents,
    parse,
    capTrim,
    details,
    sourceUrl: url,
  };

  if (mode === "elements") {
    // 4a. Everything the walk didn't claim becomes paintable units in exact
    //     paint order: there is no background to bake them into.
    const claimed = fields.map((f) => f.sourceNodeId);
    const decomposed = decomposeFrame(root as LayerNode, claimed);
    details.push(...decomposed.warnings);

    // There is no background plate in elements mode: every unit becomes a
    // static field, and fields can represent neither outlines nor clip
    // rects. Drop what can't land, and say so per layer.
    const units: Unit[] = [];
    for (const u of decomposed.units) {
      if (u.kind === "stroke") {
        // A uniform solid stroke unit lands as a stroked shape field
        // client-side (overlayFields' unitField); anything else still
        // drops, with the warning.
        if (!(u.color && u.strokeWeight)) {
          details.push({
            layer: u.name ?? "layer",
            nodeId: "",
            issue: "this border can't be drawn as an element, so it was left out.",
            severity: "degraded",
          });
          continue;
        }
      }
      if (u.clip && u.kind !== "node") {
        details.push({
          layer: u.name ?? "layer",
          nodeId: "",
          issue: "this layer's mask or clip is left out when it's pasted as an element.",
          severity: "degraded",
        });
        delete u.clip;
      }
      units.push(u);
    }

    const nodeUnits = units.filter((u: Unit) => u.kind === "node" && u.nodeId);
    if (nodeUnits.length > MAX_UNITS) {
      throw new HttpError(
        400,
        `That layer breaks into ${nodeUnits.length} pieces, more than the ${MAX_UNITS} an import can take. Flatten part of it in Figma and try again.`,
      );
    }
    const unitRenders = await renderNodes(
      parsed.fileKey,
      nodeUnits.map((u: Unit) => u.nodeId!),
      token,
    );
    for (const u of nodeUnits) {
      u.url = unitRenders[u.nodeId!] ?? undefined;
      if (!u.url) {
        details.push({
          layer: u.name ?? "layer",
          nodeId: u.nodeId!,
          issue: "this piece couldn't be rendered, so it was left out.",
          severity: "degraded",
        });
      }
    }
    if (units.some((u: Unit) => u.url?.startsWith("imageref:"))) {
      const unitFillMap = await fetchFillMap(parsed.fileKey, token);
      for (const u of units) {
        if (u.url?.startsWith("imageref:")) {
          u.url = unitFillMap[u.url.slice("imageref:".length)] ?? undefined;
          if (!u.url) {
            details.push({
              layer: u.name ?? "layer",
              nodeId: "",
              issue: "an image fill could not be resolved and was skipped.",
              severity: "degraded",
            });
          }
        }
      }
    }
    const toRehost = units.filter((u) => u.url?.startsWith("http"));
    await mapLimit(toRehost, 8, async (u, i) => {
      u.url = (await rehost(db, u.url!, `${companyId}/elements/${stamp}-r${i}.png`)) ?? undefined;
      if (!u.url) {
        details.push({
          layer: u.name ?? "layer",
          nodeId: "",
          issue: "a layer image failed to download and was skipped.",
          severity: "degraded",
        });
      }
    });

    return {
      ...base,
      units: units
        .filter((u: Unit) => u.kind !== "node" || u.url)
        .map(({ nodeId: _n, ...rest }: Unit) => rest),
      modelImageUrl: (await modelImage)?.url ?? undefined,
    };
  }

  // 4b. Template mode: render the whole frame to PNG and re-host it as the
  //     template background.
  const render = await renderUrl(parsed.fileKey, parsed.nodeId, 2, token);
  if (!render.url) {
    throw new HttpError(
      400,
      render.status >= 400
        ? `Figma render failed (${render.status}).`
        : "Figma could not render that frame.",
    );
  }
  const backgroundUrl = await rehost(db, render.url, `${companyId}/figma-${stamp}.png`);
  if (!backgroundUrl) throw new HttpError(500, "Storage upload failed for the background.");

  return {
    ...base,
    backgroundUrl,
    canvasEffects,
    // The tree the recompose step should decompose, pruned to paint
    // properties so the client round-trips one consistent snapshot instead
    // of figma-layers re-fetching (and possibly drifting).
    tree: pruneTree(root as LayerNode),
    // The 2x render stands in when the scale 1 one didn't come: the API
    // downsizes it.
    modelImageUrl: opts.modelImage ? ((await modelImage)?.url ?? render.url) : undefined,
  };
}

/** The response both functions send for a run, with whatever the caller
 * adds (the intent report, the template's details). */
export function importResponse(
  run: FigmaImportRun,
  warningStrings: (details: ImportWarning[]) => string[],
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  const issues = { warnings: warningStrings(run.details), warningDetails: run.details };
  if (run.mode === "elements") {
    return {
      elementWidth: run.width,
      elementHeight: run.height,
      fields: run.fields,
      units: run.units ?? [],
      ...issues,
      sourceUrl: run.sourceUrl,
      ...extra,
    };
  }
  return {
    backgroundUrl: run.backgroundUrl,
    canvasWidth: run.width,
    canvasHeight: run.height,
    suggestedFields: run.fields,
    canvasEffects: run.canvasEffects,
    ...issues,
    sourceUrl: run.sourceUrl,
    tree: run.tree,
    ...extra,
  };
}
