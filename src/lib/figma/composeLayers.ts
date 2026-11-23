import type { FigmaLayerUnit, LayerRenderResult } from "../types";
import { resolveImageUrl } from "../stores/supabase/signedUrls";

/** Recompose a decomposed Figma frame into a single background PNG on a
 * browser canvas. Units arrive in paint order, frame-relative at scale 1;
 * we draw at 2× to match the quality of the flat frame render. */
const SCALE = 2;

/** A decoded layer image: an ImageBitmap, or an <img> where the engine
 * couldn't make one. Both draw onto a canvas and know their size. */
type LayerImage = ImageBitmap | HTMLImageElement;

/** Decode through an <img>, the path every engine supports. */
function decodeImage(blob: Blob): Promise<HTMLImageElement> {
  const src = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("the image could not be decoded"));
    img.src = src;
  }).finally(() => URL.revokeObjectURL(src)) as Promise<HTMLImageElement>;
}

async function loadBitmap(url: string): Promise<LayerImage | null> {
  try {
    // Unit urls are storage references since the buckets went private —
    // sign before fetching. External URLs pass through.
    const fetchable = await resolveImageUrl(url);
    if (!fetchable) throw new Error("could not sign the storage reference");
    const blob = await (await fetch(fetchable)).blob();
    // createImageBitmap is the fast path, but WebKit can refuse a large
    // image (the fidelity harness's WebKit drops a 1376 x 2042 panel), and a
    // refused layer would leave a hole in the plate: fall back to an <img>.
    try {
      return await createImageBitmap(blob);
    } catch {
      return await decodeImage(blob);
    }
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
    // Handle 0 is the center, handles 1 and 2 the ends of the two radii. A
    // canvas radial gradient is a circle, so draw it at the first radius and
    // let drawGradient squash it into the ellipse.
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

/** The squash that turns a radial unit's circle into its ellipse: the
 * second radius over the first, applied along the second radius's axis.
 * Identity for every other unit. */
function radialSquash(u: FigmaLayerUnit): DOMMatrix | null {
  const [h0, h1, h2] = u.handles ?? [];
  if (u.gradientType !== "radial" || !h0 || !h1 || !h2) return null;
  const ax = { x: (h1.x - h0.x) * u.width, y: (h1.y - h0.y) * u.height };
  const ay = { x: (h2.x - h0.x) * u.width, y: (h2.y - h0.y) * u.height };
  const r1 = Math.hypot(ax.x, ax.y);
  const r2 = Math.hypot(ay.x, ay.y);
  if (r1 < 1e-6 || r2 < 1e-6 || Math.abs(r2 - r1) < 1e-3) return null;
  const cx = (u.x + h0.x * u.width) * SCALE;
  const cy = (u.y + h0.y * u.height) * SCALE;
  const angle = Math.atan2(ay.y, ay.x);
  return new DOMMatrix()
    .translate(cx, cy)
    .rotate((angle * 180) / Math.PI)
    .scale(r2 / r1, 1)
    .rotate((-angle * 180) / Math.PI)
    .translate(-cx, -cy);
}

function drawGradient(ctx: CanvasRenderingContext2D, u: FigmaLayerUnit): void {
  ctx.globalAlpha = u.opacity ?? 1;
  ctx.fillStyle = buildGradient(ctx, u);
  // The path is fixed when traced; the gradient is read in the transform at
  // fill time. So trace the box first, then squash only the paint.
  boxPath(ctx, u);
  const squash = radialSquash(u);
  if (squash) {
    ctx.save();
    ctx.transform(squash.a, squash.b, squash.c, squash.d, squash.e, squash.f);
    ctx.fill();
    ctx.restore();
  } else {
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawCover(ctx: CanvasRenderingContext2D, bmp: LayerImage, u: FigmaLayerUnit): void {
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

  // Fetch every drawable bitmap up front, concurrently — the signed-URL
  // batcher coalesces same-tick requests, and a big plate would otherwise
  // serialize hundreds of sign+download round trips through the paint loop.
  const urls = [
    ...new Set(
      result.units
        .filter((u) => !u.afterExcluded && (u.kind === "node" || u.kind === "imageFill") && u.url)
        .map((u) => u.url!),
    ),
  ];
  const bitmaps = new Map<string, LayerImage | null>(
    await Promise.all(urls.map(async (u) => [u, await loadBitmap(u)] as const)),
  );

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
      const bmp = bitmaps.get(unit.url);
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
    }
  }
  // A url can back several units — close bitmaps only once every unit drew.
  for (const bmp of bitmaps.values()) if (bmp && "close" in bmp) bmp.close();

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Canvas export failed"))), "image/png");
  });
}
