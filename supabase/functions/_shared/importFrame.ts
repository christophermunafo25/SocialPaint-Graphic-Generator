// The network-free half of a Figma template import, extracted PURE from
// figma-import/index.ts so the fidelity harness can replay an import offline
// against a saved node tree (brand-system Phase 4). The edge function fetches
// and re-hosts; everything that decides what the import becomes lives here.

import {
  effectsOf,
  walk,
  type FigmaNode,
  type ImportedEffect,
  type ImportWarning,
  type SuggestedField,
} from "./extract.ts";
import { logError } from "./http.ts";

export interface FrameImport {
  fields: SuggestedField[];
  /** Template mode: the frame's own effects (its grain, an inner glow),
   * which land on the canvas. */
  canvasEffects?: ImportedEffect[];
  warnings: ImportWarning[];
}

/** Fields from the tree, coordinates relative to the node's own box.
 * Template mode walks the frame's CHILDREN (the frame itself is the
 * background); elements mode walks the node itself, so a single pasted text
 * layer is its own element. */
export function importFrame(
  root: FigmaNode,
  mode: "template" | "elements" = "template",
): FrameImport {
  const frame = root.absoluteBoundingBox!;
  const fields: SuggestedField[] = [];
  const warnings: ImportWarning[] = [];
  const taken = new Set<string>();
  const seenIds = new Set<string>();
  try {
    const roots = mode === "elements" ? [root] : (root.children ?? []);
    for (const child of roots) walk(child, frame, fields, warnings, taken, seenIds);
  } catch (e) {
    logError("importFrame", e);
    warnings.push({
      layer: root.name,
      nodeId: root.id,
      issue: "field detection stopped early, so map the fields by hand.",
      severity: "degraded",
    });
  }
  if (mode === "template" && !fields.length) {
    warnings.push({
      layer: root.name,
      nodeId: root.id,
      issue:
        "no text, image or shape layers were found, so draw fields on the imported background.",
      severity: "info",
    });
  }
  // The canvas draws grain and inner shadows; a frame's drop shadow or blur
  // has nothing around it to paint on, so it is left out, and said once.
  const warn = (issue: string, severity: "info" | "degraded" = "degraded") =>
    warnings.push({ layer: root.name, nodeId: root.id, issue, severity });
  const rootEffects = mode === "template" ? effectsOf(root, warn) : undefined;
  const canvasEffects = rootEffects?.filter((e) => e.type === "noise" || e.type === "innerShadow");
  if (rootEffects && canvasEffects && canvasEffects.length < rootEffects.length) {
    warn(
      "the frame's own shadow or blur can't be drawn on the canvas, so it was left out.",
      "info",
    );
  }
  return { fields, canvasEffects: canvasEffects?.length ? canvasEffects : undefined, warnings };
}

/** Image-fill refs the import needs resolved (/v1/files/{key}/images). */
export const fillRefsOf = (fields: SuggestedField[]): string[] =>
  fields.flatMap((f) => (f.type === "image" && f.fillImageRef ? [f.fillImageRef] : []));

/** Node ids the import needs rendered: plain image fields, plus the fallback
 * for fills that couldn't be resolved (children bake in there, but the
 * element staying visible beats an empty hole). */
export const renderIdsOf = (
  fields: SuggestedField[],
  fills: Record<string, string | null | undefined>,
): string[] =>
  fields
    .filter((f) => f.type === "image" && (!f.fillImageRef || !fills[f.fillImageRef]))
    .map((f) => f.sourceNodeId);

/** Mask nodes the import needs rendered alone. */
export const maskIdsOf = (fields: SuggestedField[]): string[] =>
  fields.flatMap((f) => (f.maskNodeId ? [f.maskNodeId] : []));

export interface ImportSources {
  fills: Record<string, string | null | undefined>;
  renders: Record<string, string | null | undefined>;
  masks: Record<string, string | null | undefined>;
}

/** Give every fixed image field its designed artwork, and every masked field
 * its mask, from resolved sources. `host` re-homes a source URL (storage in
 * the edge function, the identity offline) and answers null on failure. A
 * field whose children were lifted separately gets the bare image FILL (a
 * node render would bake the lifted children into the pixels twice);
 * everything else keeps the exact node render. Strips the import-internal
 * keys. */
export async function landImageAssets(
  fields: SuggestedField[],
  sources: ImportSources,
  host: (url: string, kind: "element" | "mask") => Promise<string | null>,
  warnings: ImportWarning[],
): Promise<void> {
  for (const f of fields.filter((f) => f.type === "image")) {
    let renderUrl: string | null | undefined;
    if (f.fillImageRef) {
      renderUrl = sources.fills[f.fillImageRef];
      if (!renderUrl) {
        renderUrl = sources.renders[f.sourceNodeId];
        warnings.push({
          layer: f.label,
          nodeId: f.sourceNodeId,
          issue:
            "the image fill couldn't be resolved, so the elements inside it are baked into the image.",
          severity: "degraded",
        });
      }
      delete f.fillImageRef;
    } else {
      renderUrl = sources.renders[f.sourceNodeId];
    }
    const hosted = renderUrl ? await host(renderUrl, "element") : null;
    if (hosted) f.staticValue = hosted;
    else {
      // Nothing to show fixed: land it as an (empty) member field so the
      // admin sees the gap instead of an invisible element.
      f.static = undefined;
      warnings.push({
        layer: f.label,
        nodeId: f.sourceNodeId,
        issue: "the image couldn't be rendered, so it landed as an empty field.",
        severity: "degraded",
      });
    }
  }
  // Custom-shape masks: each mask node rendered ALONE; the field clips
  // whatever image it holds, member replacements included, to that render's
  // alpha channel.
  for (const f of fields.filter((f) => f.maskNodeId)) {
    const renderUrl = sources.masks[f.maskNodeId!];
    const hosted = renderUrl ? await host(renderUrl, "mask") : null;
    if (hosted) f.maskUrl = hosted;
    else {
      warnings.push({
        layer: f.label,
        nodeId: f.sourceNodeId,
        issue: "the mask couldn't be rendered, so the image imports as a plain rectangle.",
        severity: "degraded",
      });
    }
    delete f.maskNodeId;
  }
}
