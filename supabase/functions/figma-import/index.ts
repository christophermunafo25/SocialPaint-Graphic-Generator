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
import {
  walk,
  warningStrings,
  type FigmaNode,
  type ImportWarning,
  type SuggestedField,
} from "../_shared/extract.ts";
import { decomposeFrame, pruneTree, type LayerNode, type Unit } from "../_shared/figmaLayers.ts";

/** Import from Figma. Two modes:
 *
 *  - template (default): render the frame to PNG (the template background)
 *    and walk its tree to suggest TemplateFields. Every element lands FIXED
 *    with its designed content — the admin opts elements IN to being member
 *    fields — so image elements get their node rendered for staticValue.
 *
 *  - elements: no background at all. The node (a layer link pasted onto the
 *    canvas) becomes live elements: text/image/shape fields from the walk,
 *    and everything left over decomposed into rendered units the client
 *    places as fixed shapes/images in exact paint order.
 *
 * Component instances and complex effects may not map cleanly — anything
 * suspicious lands in `warnings` (with per-layer detail in
 * `warningDetails`) and the admin confirms every suggestion. The manual PNG
 * path never depends on this function. */

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

    // 1. Node subtree — ONE fetch (geometry=paths carries rotation, true
    //    size, and vector geometry); the same tree feeds the field walk, the
    //    decompose step, and (pruned) the client's later recompose.
    const fetched = await fetchNodeTree<FigmaNode & LayerNode>(
      parsed.fileKey,
      parsed.nodeId,
      token,
    );
    if ("error" in fetched) return json({ error: fetched.error }, fetched.status);
    const root = fetched.root;
    if (!root.absoluteBoundingBox) {
      return json({ error: "That node has no renderable bounds — pick a layer or frame." }, 400);
    }
    const frame = root.absoluteBoundingBox;
    const stamp = Date.now();

    // 2. Fields from the tree, coordinates relative to the node's own box.
    //    Template mode walks the frame's CHILDREN (the frame itself is the
    //    background); elements mode walks the node itself — a single pasted
    //    text layer is its own element.
    const suggestedFields: SuggestedField[] = [];
    const details: ImportWarning[] = [];
    const taken = new Set<string>();
    const seenIds = new Set<string>();
    try {
      const roots = mode === "elements" ? [root] : (root.children ?? []);
      for (const child of roots) walk(child, frame, suggestedFields, details, taken, seenIds);
    } catch (e) {
      logError("figma-import", e);
      details.push({
        layer: root.name,
        nodeId: root.id,
        issue: "field detection stopped early — map fields manually.",
        severity: "degraded",
      });
    }

    // 3. Fixed image elements carry their designed artwork. A field whose
    //    children were lifted separately gets the bare image FILL (a node
    //    render would bake the lifted children into the pixels twice);
    //    everything else keeps the exact node render.
    const imageFields = suggestedFields.filter((f) => f.type === "image");
    const fillMap = imageFields.some((f) => f.fillImageRef)
      ? await fetchFillMap(parsed.fileKey, token)
      : {};
    const unresolvedFillFields = imageFields.filter(
      (f) => f.fillImageRef && !fillMap[f.fillImageRef],
    );
    // Node renders in one batched pass: plain image fields, plus the
    // fallback for fills the map couldn't resolve (children bake in there,
    // but the element staying visible beats an empty hole).
    const fieldRenders = await renderNodes(
      parsed.fileKey,
      [...imageFields.filter((f) => !f.fillImageRef), ...unresolvedFillFields].map(
        (f) => f.sourceNodeId,
      ),
      token,
    );
    let assetIndex = 0;
    for (const f of imageFields) {
      let renderUrl: string | null | undefined;
      if (f.fillImageRef) {
        renderUrl = fillMap[f.fillImageRef];
        if (!renderUrl) {
          renderUrl = fieldRenders[f.sourceNodeId];
          details.push({
            layer: f.label,
            nodeId: f.sourceNodeId,
            issue: "the image fill couldn't be resolved — nested elements are baked into it.",
            severity: "degraded",
          });
        }
        delete f.fillImageRef;
      } else {
        renderUrl = fieldRenders[f.sourceNodeId];
      }
      const hosted = renderUrl
        ? await rehost(db, renderUrl, `${companyId}/elements/${stamp}-${assetIndex++}.png`)
        : null;
      if (hosted) f.staticValue = hosted;
      else {
        // Nothing to show fixed — land it as an (empty) member field so the
        // admin sees the gap instead of an invisible element.
        f.static = undefined;
        details.push({
          layer: f.label,
          nodeId: f.sourceNodeId,
          issue: "the image couldn't be rendered — it landed as an empty field.",
          severity: "degraded",
        });
      }
    }

    if (mode === "elements") {
      // 4a. Everything the walk didn't claim becomes paintable units in
      //     exact paint order — there is no background to bake them into.
      const claimed = suggestedFields.map((f) => f.sourceNodeId);
      const decomposed = decomposeFrame(root as LayerNode, claimed);
      details.push(...decomposed.warnings);

      // There is no background plate in elements mode: every unit becomes a
      // static field, and fields can represent neither outlines nor clip
      // rects. Drop what can't land, and say so per layer.
      const units: Unit[] = [];
      for (const u of decomposed.units) {
        if (u.kind === "stroke") {
          details.push({
            layer: u.name ?? "layer",
            nodeId: "",
            issue: "this border can't be reproduced as an element — it was left out.",
            severity: "degraded",
          });
          continue;
        }
        if (u.clip && u.kind !== "node") {
          details.push({
            layer: u.name ?? "layer",
            nodeId: "",
            issue: "this layer's mask/clip is dropped when pasted as an element.",
            severity: "degraded",
          });
          delete u.clip;
        }
        units.push(u);
      }

      const nodeUnits = units.filter((u: Unit) => u.kind === "node" && u.nodeId);
      if (nodeUnits.length > MAX_UNITS) {
        return json(
          {
            error: `That layer decomposes into ${nodeUnits.length} pieces — more than the ${MAX_UNITS} this import supports. Simplify or flatten part of it in Figma.`,
          },
          400,
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
            issue: "this piece could not be rendered — skipped.",
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

      return json({
        elementWidth: Math.round(frame.width),
        elementHeight: Math.round(frame.height),
        fields: suggestedFields,
        units: units
          .filter((u: Unit) => u.kind !== "node" || u.url)
          .map(({ nodeId: _n, ...rest }: Unit) => rest),
        warnings: warningStrings(details),
        warningDetails: details,
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
    const backgroundUrl = await rehost(db, renderUrl, `${companyId}/figma-${stamp}.png`);
    if (!backgroundUrl) return json({ error: "Storage upload failed for the background." }, 500);

    if (!suggestedFields.length) {
      details.push({
        layer: root.name,
        nodeId: root.id,
        issue:
          "no text, image, or shape layers detected — draw fields manually on the imported background.",
        severity: "info",
      });
    }

    return json({
      backgroundUrl,
      canvasWidth: Math.round(frame.width),
      canvasHeight: Math.round(frame.height),
      suggestedFields,
      warnings: warningStrings(details),
      warningDetails: details,
      sourceUrl: url,
      // The tree the recompose step should decompose — pruned to paint
      // properties so the client round-trips one consistent snapshot
      // instead of figma-layers re-fetching (and possibly drifting).
      tree: pruneTree(root as LayerNode),
    });
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    logError("figma-import", e);
    return json({ error: GENERIC_ERROR }, 500);
  }
});
