import {
  fetchNodeTree,
  figmaGet,
  getFigmaToken,
  parseFigmaUrl,
  renderNodes,
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
import {
  decomposeFrame,
  warningStrings,
  type ImportWarning,
  type LayerNode,
  type Unit,
} from "../_shared/figmaLayers.ts";

/** Decompose a Figma frame into paintable layer units EXCLUDING the nodes the
 * admin turned into editable fields, so the client can recompose a background
 * with those elements lifted off (instead of baked under the field overlays).
 *
 * The walk itself (paint order, container fills, crop transforms, masks, and
 * the above-excluded marking) lives in _shared/figmaLayers.ts — this function
 * only does the network half: obtain the tree, render the node units, resolve
 * image fills, and re-host every bitmap in our Storage.
 *
 * The import that preceded this call already fetched the node tree, so the
 * caller may supply it (pruned) in `tree` — one fetch, one tree, no drift if
 * the file was edited in between. Without it, the tree is fetched fresh
 * (recompose-after-edit path). */

const MAX_UNITS = 300;

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
    const suppliedTree =
      body.tree && typeof body.tree === "object" && typeof (body.tree as LayerNode).id === "string"
        ? (body.tree as LayerNode)
        : undefined;

    const caller = await requireRole(req, companyId, "admin");
    if ("error" in caller) return json({ error: caller.error }, caller.status);

    const parsed = parseFigmaUrl(url);
    if (!parsed) return json({ error: "url must be a figma.com frame link." }, 400);
    const db = serviceClient();
    const token = await getFigmaToken(db, companyId);
    if (!token) return json({ error: "Figma is not connected for this company." }, 400);

    let root = suppliedTree;
    if (!root) {
      const fetched = await fetchNodeTree<LayerNode>(parsed.fileKey, parsed.nodeId, token);
      if ("error" in fetched) return json({ error: fetched.error }, fetched.status);
      root = fetched.root;
    }
    if (!root.absoluteBoundingBox) return json({ error: "Pick a frame link." }, 400);
    const frame = root.absoluteBoundingBox;

    const { units, warnings } = decomposeFrame(root, excludeNodeIds);
    const details: ImportWarning[] = [...warnings];

    // Render the node units — batched, so a detailed frame imports instead
    // of being refused.
    const nodeUnits = units.filter((u: Unit) => u.kind === "node" && u.nodeId);
    if (nodeUnits.length > MAX_UNITS) {
      return json(
        {
          error: `Frame decomposes into ${nodeUnits.length} layers — more than the ${MAX_UNITS} this import supports. Simplify or flatten part of it in Figma.`,
        },
        400,
      );
    }
    if (nodeUnits.length) {
      const images = await renderNodes(
        parsed.fileKey,
        nodeUnits.map((u: Unit) => u.nodeId!),
        token,
      );
      for (const u of nodeUnits) {
        const renderUrl = images[u.nodeId!];
        if (!renderUrl) {
          details.push({
            layer: u.name ?? "layer",
            nodeId: u.nodeId!,
            issue: "this layer could not be rendered — it was skipped.",
            severity: "degraded",
          });
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

    // Re-host every remote image in our Storage (Figma URLs expire and lack
    // reliable CORS for canvas compositing).
    const stamp = Date.now();
    let i = 0;
    for (const u of units) {
      if (!u.url || u.url.startsWith("http") === false) continue;
      const res = await fetch(u.url);
      if (!res.ok) {
        details.push({
          layer: u.name ?? "layer",
          nodeId: "",
          issue: "a layer image failed to download and was skipped.",
          severity: "degraded",
        });
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
      warnings: warningStrings(details),
      warningDetails: details,
    });
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    logError("figma-layers", e);
    return json({ error: GENERIC_ERROR }, 500);
  }
});
