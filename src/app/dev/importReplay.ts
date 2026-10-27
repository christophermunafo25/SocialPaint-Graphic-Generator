// Offline import replay (brand-system Phase 4): an "import" fixture runs a
// saved Figma node tree through the real importer, the same code the
// figma-import and figma-layers functions and the builder run, with every
// Figma render and image fill served from files beside the fixture instead
// of the network. The resulting template is what an admin would get from
// importing that frame, so the harness can measure imports against Figma.

import type { FigmaLayerUnit, TemplateField, TemplateSchema } from "@/lib/types";
import { suggestFieldKey } from "@/lib/caption";
import { composeFigmaBackground } from "@/lib/figma/composeLayers";
import { stackImported } from "@/lib/figma/importLanding";
import { mergeOverlayFields } from "@/lib/figma/overlayFields";
import type { FigmaNode } from "../../../supabase/functions/_shared/extract.ts";
import {
  fillRefsOf,
  importFrame,
  landImageAssets,
  maskIdsOf,
  renderIdsOf,
} from "../../../supabase/functions/_shared/importFrame.ts";
import {
  decomposeFrame,
  pruneTree,
  type LayerNode,
} from "../../../supabase/functions/_shared/figmaLayers.ts";

export interface ImportReplaySpec {
  /** The fixture's folder name, for its asset files. */
  name: string;
  source: { fileKey: string; nodeId: string };
  /** Root-relative URL of the saved /v1/files/:key/nodes response. */
  figmaNode: string;
  /** Node id (a render) or image ref (a fill) to a file beside the fixture. */
  assets: Record<string, string>;
}

const STAMP = "2026-10-08T00:00:00.000Z";

/** The template an import of the saved frame lands as. Throws, naming every
 * render and fill the replay needs but the fixture doesn't carry, so they
 * can be fetched once with goldens.mjs. */
export async function replayImport(spec: ImportReplaySpec): Promise<TemplateSchema> {
  const res = await fetch(spec.figmaNode);
  if (!res.ok) throw new Error(`No saved node tree at ${spec.figmaNode}`);
  const body = (await res.json()) as { nodes: Record<string, { document: FigmaNode }> };
  const root = body.nodes[spec.source.nodeId]?.document;
  if (!root?.absoluteBoundingBox)
    throw new Error(`The saved tree has no node ${spec.source.nodeId}`);

  const missing = new Set<string>();
  const asset = (key: string, what: string): string | undefined => {
    const file = spec.assets[key];
    if (!file) missing.add(`${what} ${key}`);
    return file && (file.startsWith("/") ? file : `/test/fidelity/fixtures/${spec.name}/${file}`);
  };
  const lookup = (keys: string[], what: string) =>
    Object.fromEntries(keys.map((k) => [k, asset(k, what)]));

  // The server half of figma-import.
  const { fields, warnings } = importFrame(root);
  const fills = lookup(fillRefsOf(fields), "fill");
  const sources = {
    fills,
    renders: lookup(renderIdsOf(fields, fills), "render"),
    masks: lookup(maskIdsOf(fields), "render"),
  };
  await landImageAssets(fields, sources, async (url) => url, warnings);

  // The builder lands the fields, then figma-layers decomposes the pruned
  // tree it sent without them.
  const imported = stackImported(fields as TemplateField[], [], (f, existing) =>
    suggestFieldKey(f.label, existing),
  );
  const lifted = imported.filter((f) => Boolean(f.sourceNodeId));
  const { units } = decomposeFrame(
    pruneTree(root as unknown as LayerNode),
    lifted.map((f) => f.sourceNodeId!),
  );
  for (const u of units) {
    if (u.kind === "node" && u.nodeId) u.url = asset(u.nodeId, "render");
    else if (u.url?.startsWith("imageref:")) u.url = asset(u.url.slice("imageref:".length), "fill");
  }
  if (missing.size) {
    throw new Error(`Replay assets missing for ${spec.name}: ${[...missing].join(", ")}`);
  }
  const layerUnits = units
    .filter((u) => u.kind !== "node" || u.url)
    .map(({ nodeId: _n, ...rest }) => rest) as FigmaLayerUnit[];

  const frame = root.absoluteBoundingBox;
  const canvasWidth = Math.round(frame.width);
  const canvasHeight = Math.round(frame.height);
  const plate = await composeFigmaBackground({
    canvasWidth,
    canvasHeight,
    units: layerUnits,
    warnings: [],
  });

  return {
    id: spec.name,
    companyId: "fidelity",
    name: root.name,
    description: "",
    category: "",
    tags: [],
    status: "published",
    canvasWidth,
    canvasHeight,
    backgroundUrl: URL.createObjectURL(plate),
    captionTemplate: "",
    createdAt: STAMP,
    updatedAt: STAMP,
    fields: mergeOverlayFields(layerUnits, lifted, imported),
  };
}
