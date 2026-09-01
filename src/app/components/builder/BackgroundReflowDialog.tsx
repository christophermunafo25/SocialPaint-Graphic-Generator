import React, { useState } from "react";
import { SignedImg } from "../SignedImg";
import { useSignedUrl } from "@/lib/render/useSignedUrl";
import { dominantEdgeColor } from "@/lib/templates/edgeColor";

/** One crop preview: the background image inside a box of the given canvas
 * aspect, cover-cropped exactly as the renderer will crop it. */
function CropPreview({
  url,
  size,
  label,
}: {
  url: string;
  size: { width: number; height: number };
  label: string;
}) {
  const r = size.width / size.height;
  return (
    <figure className="flex-1 min-w-0">
      <figcaption className="sp-eyebrow" style={{ marginBottom: 4 }}>
        {label}
      </figcaption>
      <div
        className="mx-auto overflow-hidden"
        data-radius-control
        style={{
          aspectRatio: `${size.width} / ${size.height}`,
          ...(r >= 1 ? { width: "100%", maxWidth: 200 } : { height: 150, width: 150 * r }),
          border: "1px solid var(--border-strong)",
          background: "var(--bg-inset)",
        }}
      >
        <SignedImg
          src={url}
          alt={`${label} background crop`}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      </div>
    </figure>
  );
}

/** The 3.2 decision: an uploaded background image cannot be adapted to a new
 * aspect ratio, so the admin — never the code — picks what happens to it.
 * The side-by-side shows exactly what `cover` will crop at the new shape. */
export function BackgroundReflowDialog({
  backgroundUrl,
  source,
  target,
  hasFigmaProvenance,
  onKeep,
  onRemove,
  onSolid,
}: {
  backgroundUrl: string;
  source: { width: number; height: number };
  target: { width: number; height: number };
  /** Fields carry Figma sourceNodeId provenance — the pixel-exact route is a
   * re-import of the frame at the new size, and the dialog says so. */
  hasFigmaProvenance: boolean;
  /** Keep the image and accept the new crop (also the dismiss default). */
  onKeep(): void;
  /** Drop the image; the admin uploads a replacement in the builder. */
  onRemove(): void;
  /** Swap to a solid sampled from the image's dominant edge — null when the
   * image couldn't be read, so the caller can say so instead of guessing. */
  onSolid(hex: string | null): void;
}) {
  const image = useSignedUrl(backgroundUrl);
  const [sampling, setSampling] = useState(false);

  const pickSolid = async () => {
    if (!image.url || sampling) return;
    setSampling(true);
    onSolid(await dominantEdgeColor(image.url));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Background image at the new shape"
      style={{ background: "color-mix(in srgb, var(--text-on-accent) 55%, transparent)" }}
      onClick={onKeep}
    >
      <div
        className="w-full max-w-lg p-5 space-y-4"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-strong)",
          borderRadius: "var(--radius-card)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-1">
          <h2
            style={{
              fontFamily: "var(--font-head)",
              fontWeight: "var(--weight-head)",
              fontSize: "var(--type-cardtitle-size)",
              letterSpacing: "var(--track-head)",
              color: "var(--text-primary)",
            }}
          >
            The background image can't change shape
          </h2>
          <p style={{ fontSize: "var(--type-label-size)", color: "var(--text-secondary)" }}>
            A {target.width}×{target.height} canvas crops the image differently. Pick what happens
            to it — nothing is decided for you.
          </p>
        </div>

        <div className="flex gap-4 items-start">
          <CropPreview
            url={backgroundUrl}
            size={source}
            label={`Now — ${source.width}×${source.height}`}
          />
          <CropPreview
            url={backgroundUrl}
            size={target}
            label={`New crop — ${target.width}×${target.height}`}
          />
        </div>

        {hasFigmaProvenance && (
          <p style={{ fontSize: "var(--type-caption-size)", color: "var(--text-secondary)" }}>
            This template came from Figma. For a pixel-exact background, resize the source frame
            there and re-import it from the canvas footer — that re-renders the design instead of
            stretching pixels.
          </p>
        )}

        <div className="space-y-2">
          <button className="sp-btn sp-btn-primary w-full" onClick={onKeep}>
            Keep the image and accept the crop
          </button>
          <button
            className="sp-btn w-full"
            onClick={() => void pickSolid()}
            disabled={!image.url || sampling}
          >
            {sampling ? "Reading the image…" : "Swap to a solid color from the image's edges"}
          </button>
          <button className="sp-btn sp-btn-ghost w-full" onClick={onRemove}>
            Remove it — I'll upload a replacement
          </button>
        </div>
      </div>
    </div>
  );
}
