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
import { optionalEnum, parseBody, requireString, requireUuid } from "../_shared/validate.ts";
import { type FigmaNode, type SuggestedField, walk } from "../_shared/extract.ts";
import { decomposeFrame, type LayerNode, type Unit } from "../_shared/figmaLayers.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

/** Import from Figma. Two modes:
 *
 *  - template (default): render the frame to PNG (the template background)
 *    and walk its tree to suggest TemplateFields. Every element lands FIXED
 *    with its designed content — the admin opts elements IN to being member
 *    fields — so image elements get their node rendered for staticValue.
 *
 *  - elements: no background at all. The node (a layer link pasted onto the
 *    canvas) becomes live elements: text/image fields from the walk, and
 *    everything left over decomposed into rendered units the client places
 *    as fixed shapes/images in exact paint order.
 *
 * Component instances, masks, and complex effects may not map cleanly —
 * anything suspicious lands in `warnings` and the admin confirms every
 * suggestion. The manual PNG path never depends on this function. */

/** Batched node render at 2×, keyed by node id. */
async function renderNodes(
  fileKey: string,
  ids: string[],
  token: string,
): Promise<Record<string, string | null>> {
  if (!ids.length) return {};
  const res = await figmaGet(
    `/v1/images/${fileKey}?ids=${encodeURIComponent(ids.join(","))}&format=png&scale=2`,
    token,
  );
  if (!res.ok) return {};
  return ((await res.json()) as { images: Record<string, string | null> }).images;
}

/** Download a remote image and re-host it in our Storage (Figma URLs expire
 * and lack reliable CORS). Returns a storage reference ("bucket/path" — the
 * buckets are private; the client signs it), or null on failure. */
async function rehost(
  db: SupabaseClient,
  companyId: string,
  url: string,
  path: string,
): Promise<string | null> {
  const res = await fetch(url);
  if (!res.ok) return null;
  const up = await db.storage
    .from("template-backgrounds")
    .upload(path, await res.arrayBuffer(), { contentType: "image/png" });
  if (up.error) return null;
  return `template-backgrounds/${path}`;
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  const json = jsonResponder(req);
  try {
    const body = await parseBody(req);
    const companyId = requireUuid(body.companyId, "companyId");
    const url = requireString(body.url, "url", 2048);
    const mode = optionalEnum(body.mode, "mode", ["template", "elements"] as const);

    const caller = await requireRole(req, companyId, "admin");
    if ("error" in caller) return json({ error: caller.error }, caller.status);

    const parsed = parseFigmaUrl(url);
    if (!parsed) {
      return json(
        {
          error:
            "url must be a figma.com frame link — copy a frame link (with node-id) from Figma.",
        },
        400,
      );
    }

    const db = serviceClient();
    const token = await getFigmaToken(db, companyId);
    if (!token) return json({ error: "Figma is not connected for this company." }, 400);

    // 1. Node subtree.
    const nodesRes = await figmaGet(
      `/v1/files/${parsed.fileKey}/nodes?ids=${encodeURIComponent(parsed.nodeId)}&geometry=paths`,
      token,
    );
    if (!nodesRes.ok)
      return json({ error: `Figma nodes request failed (${nodesRes.status}).` }, 400);
    const nodesBody = (await nodesRes.json()) as {
      nodes: Record<string, { document: FigmaNode & LayerNode } | null>;
    };
    const root = nodesBody.nodes[parsed.nodeId]?.document;
    if (!root?.absoluteBoundingBox) {
      return json({ error: "That node has no renderable bounds — pick a layer or frame." }, 400);
    }
    const frame = root.absoluteBoundingBox;
    const stamp = Date.now();

    // 2. Fields from the tree, coordinates relative to the node's own box.
    //    Template mode walks the frame's CHILDREN (the frame itself is the
    //    background); elements mode walks the node itself — a single pasted
    //    text layer is its own element.
    const suggestedFields: SuggestedField[] = [];
    const warnings: string[] = [];
    const taken = new Set<string>();
    const seenIds = new Set<string>();
    try {
      const roots = mode === "elements" ? [root] : (root.children ?? []);
      for (const child of roots) walk(child, frame, suggestedFields, warnings, taken, seenIds);
    } catch (e) {
      logError("figma-import", e);
      warnings.push("Field detection stopped early — map fields manually.");
    }

    // 3. Fixed image elements carry their designed artwork: render each
    //    image field's node and re-host it as the field's fixed content.
    const imageFields = suggestedFields.filter((f) => f.type === "image");
    const fieldRenders = await renderNodes(
      parsed.fileKey,
      imageFields.map((f) => f.sourceNodeId),
      token,
    );
    let assetIndex = 0;
    for (const f of imageFields) {
      const renderUrl = fieldRenders[f.sourceNodeId];
      const hosted = renderUrl
        ? await rehost(
            db,
            companyId,
            renderUrl,
            `${companyId}/elements/${stamp}-${assetIndex++}.png`,
          )
        : null;
      if (hosted) f.staticValue = hosted;
      else {
        // Nothing to show fixed — land it as an (empty) member field so the
        // admin sees the gap instead of an invisible element.
        f.static = undefined;
        warnings.push(
          `"${f.label}": the image couldn't be rendered — it landed as an empty field.`,
        );
      }
    }

    if (mode === "elements") {
      // 4a. Everything the walk didn't claim becomes paintable units in
      //     exact paint order — there is no background to bake them into.
      const claimed = suggestedFields.map((f) => f.sourceNodeId);
      const { units, warnings: unitWarnings } = decomposeFrame(root as LayerNode, claimed);
      warnings.push(...unitWarnings);

      const nodeUnits = units.filter((u: Unit) => u.kind === "node" && u.nodeId);
      if (nodeUnits.length > 30) {
        return json({ error: "That layer is too complex to paste (over 30 pieces)." }, 400);
      }
      const unitRenders = await renderNodes(
        parsed.fileKey,
        nodeUnits.map((u: Unit) => u.nodeId!),
        token,
      );
      for (const u of nodeUnits) {
        u.url = unitRenders[u.nodeId!] ?? undefined;
        if (!u.url) warnings.push(`A layer piece could not be rendered (${u.nodeId}) — skipped.`);
      }
      if (units.some((u: Unit) => u.url?.startsWith("imageref:"))) {
        const fillsRes = await figmaGet(`/v1/files/${parsed.fileKey}/images`, token);
        const fillMap = fillsRes.ok
          ? (((await fillsRes.json()) as { meta?: { images?: Record<string, string> } }).meta
              ?.images ?? {})
          : {};
        for (const u of units) {
          if (u.url?.startsWith("imageref:")) {
            u.url = fillMap[u.url.slice("imageref:".length)] ?? undefined;
            if (!u.url) warnings.push("An image fill could not be resolved and was skipped.");
          }
        }
      }
      for (const u of units) {
        if (!u.url || !u.url.startsWith("http")) continue;
        u.url =
          (await rehost(
            db,
            companyId,
            u.url,
            `${companyId}/elements/${stamp}-${assetIndex++}.png`,
          )) ?? undefined;
        if (!u.url) warnings.push("A layer image failed to download and was skipped.");
      }

      return json({
        elementWidth: Math.round(frame.width),
        elementHeight: Math.round(frame.height),
        fields: suggestedFields,
        units: units
          .filter((u: Unit) => u.kind !== "node" || u.url)
          .map(({ nodeId: _n, ...rest }: Unit) => rest),
        warnings,
        sourceUrl: url,
      });
    }

    // 4b. Template mode: render the whole frame to PNG and re-host it as
    //     the template background.
    const imgRes = await figmaGet(
      `/v1/images/${parsed.fileKey}?ids=${encodeURIComponent(parsed.nodeId)}&format=png&scale=2`,
      token,
    );
    if (!imgRes.ok) return json({ error: `Figma render failed (${imgRes.status}).` }, 400);
    const imgBody = (await imgRes.json()) as { images: Record<string, string | null> };
    const renderUrl = imgBody.images[parsed.nodeId];
    if (!renderUrl) return json({ error: "Figma could not render that frame." }, 400);
    const backgroundUrl = await rehost(db, companyId, renderUrl, `${companyId}/figma-${stamp}.png`);
    if (!backgroundUrl) return json({ error: "Storage upload failed for the background." }, 500);

    if (!suggestedFields.length) {
      warnings.push(
        "No text or image layers detected — draw fields manually on the imported background.",
      );
    }

    return json({
      backgroundUrl,
      canvasWidth: Math.round(frame.width),
      canvasHeight: Math.round(frame.height),
      suggestedFields,
      warnings,
      sourceUrl: url,
    });
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    logError("figma-import", e);
    return json({ error: GENERIC_ERROR }, 500);
  }
});
