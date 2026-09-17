// Dogfood harness: run a real production design through the ACTUAL import
// code — the same walk() and decomposeFrame() the figma-import edge function
// calls, template mode (walk the frame's children) — and write a readable
// snapshot of what an admin would get.
//
//   FIGMA_TOKEN=<personal access token> deno run --allow-net=api.figma.com \
//     --allow-env --allow-read --allow-write supabase/verify/figma-dogfood.ts
//
// The first run fetches the node tree exactly as fetchNodeTree does and
// saves the raw JSON to a gitignored fixture, so reruns are deterministic,
// offline, and free (no token needed once the fixture exists). The snapshot
// lands next to this script; diff it across importer changes.
//
// Design under test: file g9mjhQHoPVgYbBIPKR1VsT (SocialPaint Brand
// Guidelines), node 62:1210, "Feature Highlight Post / Light / Green",
// 1080 × 1350.

import {
  walk,
  warningStrings,
  type FigmaNode,
  type ImportWarning,
  type SuggestedField,
} from "../functions/_shared/extract.ts";
import { decomposeFrame, type LayerNode, type Unit } from "../functions/_shared/figmaLayers.ts";

const FILE_KEY = "g9mjhQHoPVgYbBIPKR1VsT";
const NODE_ID = "62:1210";

const here = new URL(".", import.meta.url).pathname;
const fixturePath = `${here}fixtures/figma-${FILE_KEY}-${NODE_ID.replace(":", "-")}.json`;
const snapshotPath = `${here}figma-dogfood.snapshot.md`;

async function loadTree(): Promise<unknown> {
  try {
    return JSON.parse(await Deno.readTextFile(fixturePath));
  } catch {
    // No fixture yet — fetch it, exactly as fetchNodeTree does.
    const token = Deno.env.get("FIGMA_TOKEN");
    if (!token) {
      console.error(
        `No fixture at ${fixturePath} and FIGMA_TOKEN is not set.\n` +
          "Set FIGMA_TOKEN to a Figma personal access token for the first run.",
      );
      Deno.exit(1);
    }
    const res = await fetch(
      `https://api.figma.com/v1/files/${FILE_KEY}/nodes?ids=${encodeURIComponent(NODE_ID)}&geometry=paths`,
      { headers: { "X-Figma-Token": token } },
    );
    if (!res.ok) {
      console.error(`Figma nodes request failed (${res.status}).`);
      Deno.exit(1);
    }
    const body = await res.json();
    await Deno.mkdir(`${here}fixtures`, { recursive: true });
    await Deno.writeTextFile(fixturePath, JSON.stringify(body, null, 2));
    console.log(`Fixture saved to ${fixturePath}`);
    return body;
  }
}

const body = (await loadTree()) as { nodes: Record<string, { document?: unknown } | null> };
const root = body.nodes[NODE_ID]?.document as (FigmaNode & LayerNode) | undefined;
if (!root?.absoluteBoundingBox) {
  console.error("Fixture holds no renderable node.");
  Deno.exit(1);
}
const frame = root.absoluteBoundingBox;

// Template mode: walk the frame's CHILDREN (the frame itself is the plate).
const fields: SuggestedField[] = [];
const warnings: ImportWarning[] = [];
const taken = new Set<string>();
const seenIds = new Set<string>();
for (const child of root.children ?? []) {
  walk(child as FigmaNode, frame, fields, warnings, taken, seenIds);
}

// What the recompose bakes into the background around the lifted fields.
const claimed = fields.map((f) => f.sourceNodeId);
const decomposed = decomposeFrame(root as LayerNode, claimed);

const fmt = (v: unknown) => (v === undefined ? "—" : JSON.stringify(v));
const lines: string[] = [
  `# figma-dogfood snapshot`,
  ``,
  `File ${FILE_KEY}, node ${NODE_ID} — "${root.name}", ${Math.round(frame.width)} × ${Math.round(frame.height)}.`,
  ``,
  `## Suggested fields (${fields.length})`,
  ``,
  `| # | label | sourceNodeId | type | shape | box | radius | stroke | notes |`,
  `| - | ----- | ------------ | ---- | ----- | --- | ------ | ------ | ----- |`,
  ...fields.map((f, i) => {
    const box = `${f.x},${f.y} ${f.width}×${f.height}${f.rotation ? ` r${f.rotation}` : ""}`;
    const radius = f.cornerRadius ? `${f.cornerRadius.tl}/${f.cornerRadius.tr}/${f.cornerRadius.br}/${f.cornerRadius.bl}` : "—";
    const stroke = f.strokeColor ? `${f.strokeColor}@${f.strokeWidthPx}px` : "—";
    const notes = [
      f.static ? "static" : "member",
      f.staticValue ? `value=${JSON.stringify(f.staticValue.slice(0, 40))}` : "",
      f.colorHex ?? "",
      f.textGradient ? "gradient" : "",
      f.fontFamily ? `${f.fontFamily} ${f.fontSizePx ?? ""}px` : "",
      f.fillImageRef ? `fillRef=${f.fillImageRef}` : "",
    ]
      .filter(Boolean)
      .join(" ");
    return `| ${i} | ${f.label} | ${f.sourceNodeId} | ${f.type} | ${f.shape ?? "—"} | ${box} | ${radius} | ${stroke} | ${notes} |`;
  }),
  ``,
  `## Decomposed units (${decomposed.units.length}) — the background plate`,
  ``,
  `| # | kind | name | box | afterExcluded | detail |`,
  `| - | ---- | ---- | --- | ------------- | ------ |`,
  ...decomposed.units.map((u: Unit, i) => {
    const detail = [
      u.color ?? "",
      u.stops ? `${u.stops.length}-stop ${u.gradientType ?? "linear"} gradient` : "",
      u.strokeWeight ? `strokeWeight=${u.strokeWeight}` : "",
      u.nodeId ? `nodeId=${u.nodeId}` : "",
      u.clip ? `clip=${fmt(u.clip)}` : "",
      u.cornerRadius ? `radius=${fmt(u.cornerRadius)}` : "",
    ]
      .filter(Boolean)
      .join(" ");
    return `| ${i} | ${u.kind} | ${u.name ?? "—"} | ${Math.round(u.x)},${Math.round(u.y)} ${Math.round(u.width)}×${Math.round(u.height)} | ${u.afterExcluded ?? "—"} | ${detail} |`;
  }),
  ``,
  `## Warnings — field walk (${warnings.length})`,
  ``,
  ...warningStrings(warnings).map((w) => `- ${w}`),
  ``,
  `## Warnings — decompose (${decomposed.warnings.length})`,
  ``,
  ...warningStrings(decomposed.warnings).map((w) => `- ${w}`),
  ``,
];

await Deno.writeTextFile(snapshotPath, lines.join("\n"));
console.log(`Snapshot written to ${snapshotPath}`);
console.log(
  `${fields.length} fields, ${decomposed.units.length} units, ` +
    `${warnings.length}+${decomposed.warnings.length} warnings.`,
);
