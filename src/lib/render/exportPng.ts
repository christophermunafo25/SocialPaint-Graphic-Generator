import { toSvg } from "html-to-image";
import type { BrandKit, TemplateSchema } from "../types";
import { buildExportFontEmbedCss, ensureSchemaFontsLoaded } from "./fonts";
import { withSyncDecodedImages } from "./snapshotDecoding";

export type ExportOutcome = "downloaded" | "shared" | "canceled";

/** Export a rendered schema node to PNG and hand it to the user.
 *
 * Ported from the reference Generator's handleDownload:
 *  - dimensions come from the SCHEMA, never a literal
 *  - the snapshot is drawn twice with a short pause (Safari paints some
 *    images only after the first draw)
 *  - mobile tries navigator.share with a File, falling back to a download
 * Not from the reference: the snapshot's images are set to decode inside the
 * draw (withSyncDecodedImages), so a photo no longer waits on that pause.
 * EVERY font the schema renders with (uploaded AND Google, type-style-bound
 * included) is embedded via fontEmbedCSS — the snapshot SVG rasterizes in an
 * isolated context on Safari/Firefox with no access to the document's font
 * cache, so anything not embedded exports as a system fallback.
 */
/** How long to wait for in-flight images before giving up on the export. */
const IMAGE_READY_TIMEOUT_MS = 15000;

/** An export refused because an image isn't in the canvas. The message names
 * the field and is written for the member — export UIs show it verbatim,
 * which a bare Error's message can't be trusted to be. */
export class ExportAssetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExportAssetError";
  }
}

/** Refuse to rasterize a canvas whose images aren't all embedded.
 *
 * html-to-image resolves happily when it can't fetch an image — it
 * substitutes an empty string, caches that, and returns a PNG with a hole.
 * The renderer marks each image's readiness (`data-image-status`), so the
 * only safe moment to snapshot is when nothing is loading and nothing has
 * failed. Failing loudly here turns a silently broken graphic into an error
 * the member can act on. */
async function ensureImagesReady(node: HTMLElement): Promise<void> {
  const deadline = Date.now() + IMAGE_READY_TIMEOUT_MS;
  while (node.querySelector('[data-image-status="loading"]')) {
    if (Date.now() > deadline) {
      throw new ExportAssetError(
        "Timed out waiting for images to load. Check the connection and try again.",
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const failed = [
    ...new Set(
      Array.from(node.querySelectorAll('[data-image-status="failed"]'), (el) =>
        (el.getAttribute("data-field-label") || "an image").trim(),
      ),
    ),
  ];
  if (failed.length) {
    throw new ExportAssetError(
      `Couldn't load ${failed.join(", ")}. The graphic would export with it missing.`,
    );
  }
}

/** How long a loaded snapshot waits before its first draw.
 *
 * Firefox suppresses painting for the first moments of every document's
 * life, the snapshot image's own document included (5 ms by default, ended
 * by a timer). A draw made in that window paints everything except what is
 * clipped to text, which is how a text gradient and grain on glyphs are
 * drawn. Firefox then keeps that raster for the image, so drawing it again
 * later returns the same picture with the text missing. A timer set once
 * the image has loaded, and no shorter than Firefox's, fires after it
 * however busy the page is. An animation frame does not, and one frame is
 * all html-to-image's own toPng waits.
 *
 * The fidelity harness launches Firefox with that window held open for
 * 40 ms (FIREFOX_PAINT_DELAY_MS in scripts/fidelity/fidelity.mjs), so a
 * first draw that comes too early fails every run there, not only on a
 * slow machine. Keep this wait longer than that value, or every Firefox
 * run of the harness loses its text-clipped fills. */
const SNAPSHOT_SETTLE_MS = 50;

/** The pause between the two draws, the second of which is the export.
 *
 * WebKit starts decoding a large bitmap inside the snapshot only when the
 * snapshot is drawn, and paints nothing of it until the decode lands. The
 * snapshot's images do not wait on this pause: they are decoded inside the
 * draw (withSyncDecodedImages). Two things still do.
 *
 * A CSS image has no such attribute. The one large bitmap the renderer
 * paints as a CSS image is an image field's alpha mask, and while it is
 * undecoded WebKit paints nothing of the masked photo.
 *
 * Before Safari 26 the snapshot's load fires without waiting for the images
 * inside it to load (WebKit bug 290840 changed that). An image that loads
 * after the first draw is decoded in the second. One that loads after the
 * second is missing, as it was before. */
const WARM_UP_PAUSE_MS = 150;

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** A snapshot as an image element: loaded and decoded, not yet drawn. */
function loadSnapshotImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      // A loaded image that refuses decode() can still be drawn.
      image.decode().then(
        () => resolve(image),
        () => resolve(image),
      );
    };
    image.onerror = () => reject(new Error("The export snapshot did not load"));
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.src = url;
  });
}

/** html-to-image's snapshot as an image element, with the images inside it
 * set to decode in the draw that paints them. Should that edit ever fail, or
 * leave a snapshot that does not load, the snapshot is loaded as
 * html-to-image made it: an export on the fixed pause alone is better than
 * none. That is logged, because nothing else would show it. */
async function loadSnapshot(snapshot: string): Promise<HTMLImageElement> {
  try {
    const marked = withSyncDecodedImages(snapshot);
    if (marked !== snapshot) return await loadSnapshotImage(marked);
  } catch (e) {
    console.error("Export snapshot failed with its images set to decode in the draw", e);
  }
  return loadSnapshotImage(snapshot);
}

function drawSnapshot(image: HTMLImageElement, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No 2D canvas to draw the export on");
  context.drawImage(image, 0, 0, width, height);
  return canvas;
}

/** Rasterize a mounted canvas node to PNG bytes. Throws ExportAssetError
 * when an image in the canvas did not load. This is THE rasterization path:
 * the single export and the bulk export both come through here, which is
 * what makes a bulk PNG identical to the one a member downloads. */
export async function renderSchemaBlob(
  schema: TemplateSchema,
  node: HTMLElement,
  brandKit?: BrandKit | null,
): Promise<Blob> {
  await ensureImagesReady(node);
  await ensureSchemaFontsLoaded(schema, brandKit);
  const fontEmbedCss = await buildExportFontEmbedCss(schema, brandKit);
  const { canvasWidth: width, canvasHeight: height } = schema;
  // The canvas as one SVG image: html-to-image's clone of the node with
  // its fonts and images inlined.
  const snapshot = await toSvg(node, {
    width,
    height,
    // We embed fonts ourselves; never let html-to-image walk the document's
    // stylesheets (slow, and it would inline the app shell fonts too).
    skipFonts: !fontEmbedCss,
    ...(fontEmbedCss ? { fontEmbedCSS: fontEmbedCss } : {}),
  });

  // Loaded and drawn here rather than by html-to-image's toPng, so the
  // snapshot's images decode inside the draw and the first draw waits for
  // the snapshot to settle (SNAPSHOT_SETTLE_MS).
  const image = await loadSnapshot(snapshot);
  await pause(SNAPSHOT_SETTLE_MS);
  drawSnapshot(image, width, height);
  await pause(WARM_UP_PAUSE_MS);
  const dataUrl = drawSnapshot(image, width, height).toDataURL();

  // One Blob serves both branches; browsers handle multi-megabyte base64
  // hrefs inconsistently, so the data URL is dropped as early as possible.
  return (await fetch(dataUrl)).blob();
}

/** Rasterize and hand the PNG to the user: a share sheet on mobile, a
 * download everywhere else. The rasterization itself is renderSchemaBlob;
 * this adds only delivery. */
export async function exportSchemaPng(
  schema: TemplateSchema,
  node: HTMLElement,
  brandKit?: BrandKit | null,
): Promise<ExportOutcome> {
  const blob = await renderSchemaBlob(schema, node, brandKit);

  const fileName = `${schema.name.replace(/[^a-zA-Z0-9_-]+/g, "_") || "graphic"}.png`;
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  if (isMobile && navigator.share) {
    try {
      const file = new File([blob], fileName, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: schema.name });
        return "shared";
      }
    } catch (e) {
      // Closing the share sheet is a decision, not a failure — don't force
      // a download the person just declined.
      if (e instanceof DOMException && e.name === "AbortError") return "canceled";
      // Anything else (e.g. the render outlived the tap's transient
      // activation → NotAllowedError) falls back to a plain download.
      console.log("Share failed, falling back to download", e);
    }
  }

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = fileName;
  link.href = objectUrl;
  link.click();
  // Mobile browsers start blob downloads ASYNCHRONOUSLY after click() —
  // revoking on the next tick aborts them (failed or zero-byte files on
  // iOS Safari). Keep the URL alive well past any plausible start.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  return "downloaded";
}
