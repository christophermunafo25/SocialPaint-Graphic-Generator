import { toPng } from "html-to-image";
import type { BrandKit, TemplateSchema } from "../types";
import { buildExportFontEmbedCss, ensureSchemaFontsLoaded } from "./fonts";

export type ExportOutcome = "downloaded" | "shared" | "canceled";

/** Export a rendered schema node to PNG and hand it to the user.
 *
 * Ported from the reference Generator's handleDownload:
 *  - dimensions come from the SCHEMA, never a literal
 *  - toPng runs twice with a short pause (Safari image-decode warm-up)
 *  - mobile tries navigator.share with a File, falling back to a download
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
        "Timed out waiting for images to load — check the connection and try again.",
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
      `Couldn't load ${failed.join(", ")} — the graphic would export with it missing.`,
    );
  }
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
  const options = {
    width: schema.canvasWidth,
    height: schema.canvasHeight,
    pixelRatio: 1,
    canvasWidth: schema.canvasWidth,
    canvasHeight: schema.canvasHeight,
    // We embed fonts ourselves; never let html-to-image walk the document's
    // stylesheets (slow, and it would inline the app shell fonts too).
    skipFonts: !fontEmbedCss,
    ...(fontEmbedCss ? { fontEmbedCSS: fontEmbedCss } : {}),
  };

  await toPng(node, options);
  await new Promise((resolve) => setTimeout(resolve, 150));
  const dataUrl = await toPng(node, options);

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
