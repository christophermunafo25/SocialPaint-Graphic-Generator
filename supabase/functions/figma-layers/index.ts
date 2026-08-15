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
import { parseBody, requireString, requireStringArray, requireUuid } from "../_shared/validate.ts";
import { decomposeFrame, type LayerNode, type Unit } from "../_shared/figmaLayers.ts";

/** Decompose a Figma frame into paintable layer units EXCLUDING the nodes the
 * admin turned into editable fields, so the client can recompose a background
 * with those elements lifted off (instead of baked under the field overlays).
 *
 * The walk itself (paint order, container fills, crop transforms, and the
 * above-excluded marking) lives in _shared/figmaLayers.ts — this function
 * only does the network half: fetch the tree, render the node units, resolve
 * image fills, and re-host every bitmap in our Storage. */

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  const json = jsonResponder(req);
  try {
    const body = await parseBody(req);
    const companyId = requireUuid(body.companyId, "companyId");
    const url = requireString(body.url, "url", 2048);
    const excludeNodeIds = requireStringArray(body.excludeNodeIds, "excludeNodeIds", {
      maxItems: 200,
      maxLen: 100,
    });

    const caller = await requireRole(req, companyId, "admin");
    if ("error" in caller) return json({ error: caller.error }, caller.status);

    const parsed = parseFigmaUrl(url);
    if (!parsed) return json({ error: "url must be a figma.com frame link." }, 400);
    const db = serviceClient();
    const token = await getFigmaToken(db, companyId);
    if (!token) return json({ error: "Figma is not connected for this company." }, 400);

    const nodesRes = await figmaGet(
      `/v1/files/${parsed.fileKey}/nodes?ids=${encodeURIComponent(parsed.nodeId)}`,
      token,
    );
    if (!nodesRes.ok)
      return json({ error: `Figma nodes request failed (${nodesRes.status}).` }, 400);
    const nodesBody = (await nodesRes.json()) as {
      nodes: Record<string, { document: LayerNode } | null>;
    };
    const root = nodesBody.nodes[parsed.nodeId]?.document;
    if (!root?.absoluteBoundingBox) return json({ error: "Pick a frame link." }, 400);
    const frame = root.absoluteBoundingBox;

    const { units, warnings } = decomposeFrame(root, excludeNodeIds);

    // Render the node units in one batched call.
    const nodeUnits = units.filter((u: Unit) => u.kind === "node" && u.nodeId);
    if (nodeUnits.length > 60) {
      return json({ error: "Frame too complex to decompose (over 60 layers)." }, 400);
    }
    if (nodeUnits.length) {
      const ids = nodeUnits.map((u: Unit) => u.nodeId).join(",");
      const imgRes = await figmaGet(
        `/v1/images/${parsed.fileKey}?ids=${encodeURIComponent(ids)}&format=png&scale=2`,
        token,
      );
      if (!imgRes.ok) return json({ error: `Figma render failed (${imgRes.status}).` }, 400);
      const images = ((await imgRes.json()) as { images: Record<string, string | null> }).images;
      for (const u of nodeUnits) {
        const renderUrl = images[u.nodeId!];
        if (!renderUrl) {
          warnings.push(`A layer could not be rendered (${u.nodeId}) — it was skipped.`);
          continue;
        }
        u.url = renderUrl;
      }
    }

    // Resolve image fills to their source bitmaps.
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

    // Re-host every remote image in our Storage (Figma URLs expire and lack
    // reliable CORS for canvas compositing).
    const stamp = Date.now();
    let i = 0;
    for (const u of units) {
      if (!u.url || u.url.startsWith("http") === false) continue;
      const res = await fetch(u.url);
      if (!res.ok) {
        warnings.push("A layer image failed to download and was skipped.");
        u.url = undefined;
        continue;
      }
      const path = `${companyId}/layers/${stamp}-${i++}.png`;
      const up = await db.storage
        .from("template-backgrounds")
        .upload(path, await res.arrayBuffer(), { contentType: "image/png" });
      if (up.error) {
        logError("figma-layers", up.error);
        return json({ error: "Storage upload failed — try again." }, 500);
      }
      // Storage REFERENCE, not a URL — the buckets are private; the client
      // signs it (and persists it as-is into static_value).
      u.url = `template-backgrounds/${path}`;
    }

    return json({
      canvasWidth: Math.round(frame.width),
      canvasHeight: Math.round(frame.height),
      units: units
        .filter((u: Unit) => u.kind !== "node" || u.url)
        .map(({ nodeId: _n, ...rest }: Unit) => rest),
      warnings,
    });
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    logError("figma-layers", e);
    return json({ error: GENERIC_ERROR }, 500);
  }
});
