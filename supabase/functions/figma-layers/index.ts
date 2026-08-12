import {
  figmaGet,
  getFigmaToken,
  handleOptions,
  json,
  parseFigmaUrl,
  requireRole,
  serviceClient,
} from "../_shared/figma.ts";

/** Decompose a Figma frame into paintable layer units EXCLUDING the nodes the
 * admin turned into editable fields, so the client can recompose a background
 * with those elements lifted off (instead of baked under the field overlays).
 *
 * Strategy: walk the frame's children in paint order. A subtree with no
 * excluded node renders as a single unit via the Figma image API. A container
 * that DOES hold an excluded node contributes its own fills as synthetic
 * units (solid / linear gradient / image fill) and recurses. Masks, exotic
 * gradients, and effects on recursed containers can't be reproduced — they
 * land in `warnings` and the admin can fall back to the flat render. */

interface Paint {
  type: string;
  visible?: boolean;
  opacity?: number;
  color?: { r: number; g: number; b: number; a?: number };
  gradientStops?: Array<{
    position: number;
    color: { r: number; g: number; b: number; a?: number };
  }>;
  gradientHandlePositions?: Array<{ x: number; y: number }>;
  imageRef?: string;
  scaleMode?: string;
}

interface Node {
  id: string;
  name: string;
  type: string;
  visible?: boolean;
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number };
  fills?: Paint[];
  effects?: Array<{ type: string; visible?: boolean }>;
  isMask?: boolean;
  children?: Node[];
}

interface Unit {
  kind: "node" | "solid" | "gradient" | "imageFill";
  x: number;
  y: number;
  width: number;
  height: number;
  nodeId?: string; // pending render
  url?: string;
  color?: string;
  opacity?: number;
  stops?: Array<{ position: number; color: string }>;
  handles?: Array<{ x: number; y: number }>;
}

const rgba = (c: { r: number; g: number; b: number; a?: number }, opacity = 1): string =>
  `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${((c.a ?? 1) * opacity).toFixed(3)})`;

function subtreeHasExcluded(node: Node, excluded: Set<string>): boolean {
  if (excluded.has(node.id)) return true;
  return (node.children ?? []).some((c) => subtreeHasExcluded(c, excluded));
}

function fillUnits(node: Node, frame: { x: number; y: number }, warnings: string[]): Unit[] {
  const box = node.absoluteBoundingBox;
  if (!box) return [];
  const base = {
    x: Math.round(box.x - frame.x),
    y: Math.round(box.y - frame.y),
    width: Math.round(box.width),
    height: Math.round(box.height),
  };
  const units: Unit[] = [];
  for (const fill of node.fills ?? []) {
    if (fill.visible === false) continue;
    if (fill.type === "SOLID" && fill.color) {
      units.push({ kind: "solid", ...base, color: rgba(fill.color, fill.opacity ?? 1) });
    } else if (fill.type === "GRADIENT_LINEAR" && fill.gradientStops) {
      units.push({
        kind: "gradient",
        ...base,
        opacity: fill.opacity,
        stops: fill.gradientStops.map((s) => ({ position: s.position, color: rgba(s.color) })),
        handles: fill.gradientHandlePositions,
      });
    } else if (fill.type === "IMAGE" && fill.imageRef) {
      units.push({ kind: "imageFill", ...base, url: `imageref:${fill.imageRef}` });
      if (fill.scaleMode && fill.scaleMode !== "FILL") {
        warnings.push(`"${node.name}": image fill uses ${fill.scaleMode} — approximated as cover.`);
      }
    } else if (fill.type?.startsWith("GRADIENT")) {
      if (fill.gradientStops?.length) {
        units.push({
          kind: "solid",
          ...base,
          color: rgba(fill.gradientStops[0].color, fill.opacity ?? 1),
        });
      }
      warnings.push(`"${node.name}": ${fill.type} approximated with a flat color.`);
    }
  }
  return units;
}

function decompose(
  node: Node,
  frame: { x: number; y: number },
  excluded: Set<string>,
  units: Unit[],
  warnings: string[],
): void {
  if (node.visible === false) return;
  if (excluded.has(node.id)) return; // lifted off the background entirely
  const box = node.absoluteBoundingBox;
  if (!box) return;

  if (!subtreeHasExcluded(node, excluded)) {
    units.push({
      kind: "node",
      nodeId: node.id,
      x: Math.round(box.x - frame.x),
      y: Math.round(box.y - frame.y),
      width: Math.round(box.width),
      height: Math.round(box.height),
    });
    return;
  }

  // Container holding an excluded node: paint its own fills, then recurse.
  units.push(...fillUnits(node, frame, warnings));
  if (node.isMask || (node.effects ?? []).some((e) => e.visible !== false)) {
    warnings.push(`"${node.name}": masks/effects on this container can't be reproduced exactly.`);
  }
  for (const child of node.children ?? []) decompose(child, frame, excluded, units, warnings);
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  try {
    const { companyId, url, excludeNodeIds } = (await req.json()) as {
      companyId?: string;
      url?: string;
      excludeNodeIds?: string[];
    };
    if (!companyId || !url || !excludeNodeIds?.length) {
      return json({ error: "companyId, url, excludeNodeIds required" }, 400);
    }
    const caller = await requireRole(req, companyId, "admin");
    if ("error" in caller) return json({ error: caller.error }, caller.status);

    const parsed = parseFigmaUrl(url);
    if (!parsed) return json({ error: "Could not read that frame link." }, 400);
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
      nodes: Record<string, { document: Node } | null>;
    };
    const root = nodesBody.nodes[parsed.nodeId]?.document;
    if (!root?.absoluteBoundingBox) return json({ error: "Pick a frame link." }, 400);
    const frame = root.absoluteBoundingBox;

    const excluded = new Set(excludeNodeIds);
    const units: Unit[] = [];
    const warnings: string[] = [];
    // The frame's own background first, then its children in paint order.
    units.push(...fillUnits(root, frame, warnings));
    for (const child of root.children ?? []) decompose(child, frame, excluded, units, warnings);

    // Render the node units in one batched call.
    const nodeUnits = units.filter((u) => u.kind === "node" && u.nodeId);
    if (nodeUnits.length > 60) {
      return json({ error: "Frame too complex to decompose (over 60 layers)." }, 400);
    }
    if (nodeUnits.length) {
      const ids = nodeUnits.map((u) => u.nodeId).join(",");
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
    if (units.some((u) => u.url?.startsWith("imageref:"))) {
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
      if (up.error) return json({ error: `Storage upload failed: ${up.error.message}` }, 500);
      u.url = db.storage.from("template-backgrounds").getPublicUrl(path).data.publicUrl;
    }

    return json({
      canvasWidth: Math.round(frame.width),
      canvasHeight: Math.round(frame.height),
      units: units.filter((u) => u.kind !== "node" || u.url).map(({ nodeId: _n, ...rest }) => rest),
      warnings,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
