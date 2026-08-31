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

/** Trace the unit's box as a path, rounded when the unit carries corners.
 * roundRect is in every target browser; the rect fallback keeps ancient
 * engines drawing something rather than throwing. */
function boxPath(ctx: CanvasRenderingContext2D, u: FigmaLayerUnit): void {
  ctx.beginPath();
  const x = u.x * SCALE;
  const y = u.y * SCALE;
  const w = u.width * SCALE;
  const h = u.height * SCALE;
  const cr = u.cornerRadius;
  if (cr && typeof ctx.roundRect === "function") {
    const cap = Math.min(w, h) / 2;
    const r = (v: number) => Math.max(0, Math.min(cap, v * SCALE));
    ctx.roundRect(x, y, w, h, [r(cr.tl), r(cr.tr), r(cr.br), r(cr.bl)]);
  } else {
    ctx.rect(x, y, w, h);
  }
}

/** Run `draw` inside the unit's clip rect and rotation (about the unit's
 * center — the same origin the field renderer uses), restoring after. */
function withUnitTransform(
  ctx: CanvasRenderingContext2D,
  u: FigmaLayerUnit,
  draw: () => void,
): void {
  ctx.save();
  if (u.clip) {
    ctx.beginPath();
    ctx.rect(u.clip.x * SCALE, u.clip.y * SCALE, u.clip.width * SCALE, u.clip.height * SCALE);
    ctx.clip();
  }
  if (u.rotation) {
    const cx = (u.x + u.width / 2) * SCALE;
    const cy = (u.y + u.height / 2) * SCALE;
    ctx.translate(cx, cy);
    ctx.rotate((u.rotation * Math.PI) / 180);
    ctx.translate(-cx, -cy);
  }
  draw();
  ctx.restore();
}

function buildGradient(ctx: CanvasRenderingContext2D, u: FigmaLayerUnit): CanvasGradient | string {
  const [h0, h1] = u.handles ?? [];
  const x0 = (u.x + (h0?.x ?? 0) * u.width) * SCALE;
  const y0 = (u.y + (h0?.y ?? 0) * u.height) * SCALE;
  const x1 = (u.x + (h1?.x ?? 1) * u.width) * SCALE;
  const y1 = (u.y + (h1?.y ?? 1) * u.height) * SCALE;
  const stops = (u.stops ?? []).map((s) => ({
    position: Math.min(1, Math.max(0, s.position)),
    color: s.color,
  }));
  let g: CanvasGradient;
  if (u.gradientType === "radial") {
    // Handle 0 is the center, handle 1 the radius endpoint.
    g = ctx.createRadialGradient(x0, y0, 0, x0, y0, Math.max(1, Math.hypot(x1 - x0, y1 - y0)));
  } else if (u.gradientType === "angular") {
    if (typeof ctx.createConicGradient !== "function") {
      return stops[0]?.color ?? "rgba(0,0,0,0)";
    }
    g = ctx.createConicGradient(Math.atan2(y1 - y0, x1 - x0), x0, y0);
  } else {
    g = ctx.createLinearGradient(x0, y0, x1, y1);
  }
  for (const stop of stops) g.addColorStop(stop.position, stop.color);
  return g;
}

function drawGradient(ctx: CanvasRenderingContext2D, u: FigmaLayerUnit): void {
  ctx.globalAlpha = u.opacity ?? 1;
  ctx.fillStyle = buildGradient(ctx, u);
  boxPath(ctx, u);
  ctx.fill();
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
      withUnitTransform(ctx, unit, () => {
        ctx.fillStyle = unit.color!;
        boxPath(ctx, unit);
        ctx.fill();
      });
    } else if (unit.kind === "stroke" && unit.color && unit.strokeWeight) {
      withUnitTransform(ctx, unit, () => {
        ctx.strokeStyle = unit.color!;
        ctx.lineWidth = unit.strokeWeight! * SCALE;
        boxPath(ctx, unit);
        ctx.stroke();
      });
    } else if (unit.kind === "gradient") {
      withUnitTransform(ctx, unit, () => drawGradient(ctx, unit));
    } else if ((unit.kind === "node" || unit.kind === "imageFill") && unit.url) {
      const bmp = await loadBitmap(unit.url);
      if (!bmp) continue;
      withUnitTransform(ctx, unit, () => {
        ctx.globalAlpha = unit.opacity ?? 1;
        if (unit.kind === "imageFill") {
          if (unit.cornerRadius) {
            boxPath(ctx, unit);
            ctx.clip();
          }
          drawCover(ctx, bmp, unit);
        } else {
          // Node renders are exact 2× captures of their bounding box —
          // rotation and effects are already baked into the pixels.
          ctx.drawImage(
            bmp,
            unit.x * SCALE,
            unit.y * SCALE,
            unit.width * SCALE,
            unit.height * SCALE,
          );
        }
        ctx.globalAlpha = 1;
      });
      bmp.close();
    }
  }

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Canvas export failed"))), "image/png");
  });
}
