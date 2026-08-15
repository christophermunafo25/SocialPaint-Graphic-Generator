import type { FigmaLayerUnit, LayerRenderResult } from "../types";
import { resolveImageUrl } from "../stores/supabase/signedUrls";

/** Recompose a decomposed Figma frame into a single background PNG on a
 * browser canvas. Units arrive in paint order, frame-relative at scale 1;
 * we draw at 2× to match the quality of the flat frame render. */
const SCALE = 2;

async function loadBitmap(url: string): Promise<ImageBitmap | null> {
  try {
    // Unit urls are storage references since the buckets went private —
    // sign before fetching. External URLs pass through.
    const fetchable = await resolveImageUrl(url);
    if (!fetchable) throw new Error("could not sign the storage reference");
    const blob = await (await fetch(fetchable)).blob();
    return await createImageBitmap(blob);
  } catch (e) {
    console.error("Layer image load failed", url, e);
    return null;
  }
}

function drawGradient(ctx: CanvasRenderingContext2D, u: FigmaLayerUnit): void {
  const [h0, h1] = u.handles ?? [];
  const x0 = u.x + (h0?.x ?? 0) * u.width;
  const y0 = u.y + (h0?.y ?? 0) * u.height;
  const x1 = u.x + (h1?.x ?? 1) * u.width;
  const y1 = u.y + (h1?.y ?? 1) * u.height;
  const g = ctx.createLinearGradient(x0 * SCALE, y0 * SCALE, x1 * SCALE, y1 * SCALE);
  for (const stop of u.stops ?? []) {
    g.addColorStop(Math.min(1, Math.max(0, stop.position)), stop.color);
  }
  ctx.globalAlpha = u.opacity ?? 1;
  ctx.fillStyle = g;
  ctx.fillRect(u.x * SCALE, u.y * SCALE, u.width * SCALE, u.height * SCALE);
  ctx.globalAlpha = 1;
}

function drawCover(ctx: CanvasRenderingContext2D, bmp: ImageBitmap, u: FigmaLayerUnit): void {
  const dw = u.width * SCALE;
  const dh = u.height * SCALE;
  // A cropped fill (Figma scaleMode STRETCH) carries the exact source
  // window in its transform: rows [a, c, tx] / [b, d, ty] map the layer's
  // unit square onto normalized image space, so the visible portion of the
  // image is the rect (tx, ty, a, d). Without it, center-crop cover.
  const t = u.transform;
  const a = t?.[0]?.[0];
  const d = t?.[1]?.[1];
  if (t && a && d) {
    ctx.drawImage(
      bmp,
      (t[0][2] ?? 0) * bmp.width,
      (t[1][2] ?? 0) * bmp.height,
      a * bmp.width,
      d * bmp.height,
      u.x * SCALE,
      u.y * SCALE,
      dw,
      dh,
    );
    return;
  }
  const scale = Math.max(dw / bmp.width, dh / bmp.height);
  const sw = dw / scale;
  const sh = dh / scale;
  const sx = (bmp.width - sw) / 2;
  const sy = (bmp.height - sh) / 2;
  ctx.drawImage(bmp, sx, sy, sw, sh, u.x * SCALE, u.y * SCALE, dw, dh);
}

export async function composeFigmaBackground(result: LayerRenderResult): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = result.canvasWidth * SCALE;
  canvas.height = result.canvasHeight * SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  for (const unit of result.units) {
    // Units marked afterExcluded paint above lifted fields — they become
    // static fields (overlayFields.ts), never part of the background plate.
    if (unit.afterExcluded) continue;
    if (unit.kind === "solid" && unit.color) {
      ctx.fillStyle = unit.color;
      ctx.fillRect(unit.x * SCALE, unit.y * SCALE, unit.width * SCALE, unit.height * SCALE);
    } else if (unit.kind === "gradient") {
      drawGradient(ctx, unit);
    } else if ((unit.kind === "node" || unit.kind === "imageFill") && unit.url) {
      const bmp = await loadBitmap(unit.url);
      if (!bmp) continue;
      if (unit.kind === "imageFill") {
        ctx.globalAlpha = unit.opacity ?? 1;
        drawCover(ctx, bmp, unit);
        ctx.globalAlpha = 1;
      } else {
        // Node renders are exact 2× captures of their bounding box.
        ctx.drawImage(bmp, unit.x * SCALE, unit.y * SCALE, unit.width * SCALE, unit.height * SCALE);
      }
      bmp.close();
    }
  }

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Canvas export failed"))), "image/png");
  });
}
