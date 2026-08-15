import { toPng } from "html-to-image";
import type { BrandKit, TemplateSchema } from "../types";
import { buildExportFontEmbedCss, ensureSchemaFontsLoaded } from "./fonts";

export type ExportOutcome = "downloaded" | "shared" | "canceled";

/** An export blocked because an image isn't in the canvas. The message is
 * member-facing — export UIs show it verbatim. */
export class ExportAssetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExportAssetError";
  }
}

const labelList = (els: HTMLElement[]): string =>
  [...new Set(els.map((el) => `“${el.dataset.fieldLabel ?? "Image"}”`))].join(", ");

/** The export gate: every image the canvas paints must be a loaded data URL
 * before toPng runs. html-to-image rasterizes in an isolated context that
 * silently drops anything it can't fetch — a missing logo in a downloaded
 * PNG is worse than an error, so this fails LOUDLY instead. Waits out
 * in-flight fetches (canvas images convert to data URLs on mount; clicking
 * export during that window is normal), then refuses on failure. */
export async function ensureImagesReady(node: HTMLElement): Promise<void> {
  const deadline = Date.now() + 15_000;
  for (;;) {
    const marked = Array.from(node.querySelectorAll<HTMLElement>("[data-image-status]"));
    const failed = marked.filter((el) => el.dataset.imageStatus === "failed");
    if (failed.length) {
      throw new ExportAssetError(
        `${labelList(failed)} failed to load, so the export was stopped — a graphic with a ` +
          `missing image shouldn't go out. Check your connection or re-add the image, then try again.`,
      );
    }
    // Belt and braces: a non-data src here means some path bypassed the
    // data-URL pipeline — the exact silent-hole bug this gate exists for.
    // Waiting won't fix it, so fail immediately.
    const remote = Array.from(node.querySelectorAll("img")).filter(
      (img) => !img.src.startsWith("data:"),
    );
    if (remote.length) {
      throw new ExportAssetError(
        "An image on this graphic isn't export-safe. Reload the page and try again — " +
          "if it keeps happening, contact support.",
      );
    }
    const loading = marked.filter((el) => el.dataset.imageStatus === "loading");
    if (!loading.length) return;
    if (Date.now() > deadline) {
      throw new ExportAssetError(
        `${labelList(loading)} ${loading.length === 1 ? "is" : "are"} still loading. ` +
          `Give it a moment and try again.`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

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
export async function exportSchemaPng(
  schema: TemplateSchema,
  node: HTMLElement,
  brandKit?: BrandKit | null,
): Promise<ExportOutcome> {
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
  const blob = await (await fetch(dataUrl)).blob();

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
