import {
  figmaGet,
  getFigmaToken,
  handleOptions,
  json,
  parseFigmaUrl,
  requireRole,
  serviceClient,
} from "../_shared/figma.ts";
import { type FigmaNode, type SuggestedField, walk } from "../_shared/extract.ts";

/** Import a Figma frame: render it to PNG (the template background) and walk
 * its node tree to suggest TemplateFields for the builder overlay. Component
 * instances, masks, and complex effects may not map cleanly — anything
 * suspicious lands in `warnings` and the admin confirms every suggestion.
 * The manual PNG path never depends on this function. */

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  try {
    const { companyId, url } = (await req.json()) as { companyId?: string; url?: string };
    if (!companyId || !url) return json({ error: "companyId and url required" }, 400);

    const caller = await requireRole(req, companyId, "admin");
    if ("error" in caller) return json({ error: caller.error }, caller.status);

    const parsed = parseFigmaUrl(url);
    if (!parsed) {
      return json({ error: "Could not read that link — copy a frame link (with node-id) from Figma." }, 400);
    }

    const db = serviceClient();
    const token = await getFigmaToken(db, companyId);
    if (!token) return json({ error: "Figma is not connected for this company." }, 400);

    // 1. Node subtree.
    const nodesRes = await figmaGet(
      `/v1/files/${parsed.fileKey}/nodes?ids=${encodeURIComponent(parsed.nodeId)}&geometry=paths`,
      token,
    );
    if (!nodesRes.ok) return json({ error: `Figma nodes request failed (${nodesRes.status}).` }, 400);
    const nodesBody = (await nodesRes.json()) as {
      nodes: Record<string, { document: FigmaNode } | null>;
    };
    const root = nodesBody.nodes[parsed.nodeId]?.document;
    if (!root?.absoluteBoundingBox) {
      return json({ error: "That node has no renderable bounds — pick a frame." }, 400);
    }
    const frame = root.absoluteBoundingBox;

    // 2. Render the frame to PNG and re-host it in our Storage (Figma's
    //    render URLs expire after ~14 days).
    const imgRes = await figmaGet(
      `/v1/images/${parsed.fileKey}?ids=${encodeURIComponent(parsed.nodeId)}&format=png&scale=2`,
      token,
    );
    if (!imgRes.ok) return json({ error: `Figma render failed (${imgRes.status}).` }, 400);
    const imgBody = (await imgRes.json()) as { images: Record<string, string | null> };
    const renderUrl = imgBody.images[parsed.nodeId];
    if (!renderUrl) return json({ error: "Figma could not render that frame." }, 400);
    const png = await (await fetch(renderUrl)).arrayBuffer();

    const path = `${companyId}/figma-${Date.now()}.png`;
    const upload = await db.storage
      .from("template-backgrounds")
      .upload(path, png, { contentType: "image/png" });
    if (upload.error) return json({ error: `Storage upload failed: ${upload.error.message}` }, 500);
    const backgroundUrl = db.storage.from("template-backgrounds").getPublicUrl(path).data.publicUrl;

    // 3. Suggested fields from the tree, coordinates relative to the frame.
    const suggestedFields: SuggestedField[] = [];
    const warnings: string[] = [];
    const taken = new Set<string>();
    const seenIds = new Set<string>();
    try {
      for (const child of root.children ?? []) walk(child, frame, suggestedFields, warnings, taken, seenIds);
    } catch (e) {
      warnings.push(`Field detection stopped early (${String(e)}) — background imported; map fields manually.`);
    }
    if (!suggestedFields.length) {
      warnings.push("No text or image layers detected — draw fields manually on the imported background.");
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
    return json({ error: String(e) }, 500);
  }
});
