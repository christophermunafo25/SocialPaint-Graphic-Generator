import React, { useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { BrandAsset } from "@/lib/types";
import { useBrandOptional } from "@/lib/brand/BrandContext";
import { loadDataUrl } from "@/lib/render/useDataUrl";
import { downscaleImage } from "@/lib/render/downscaleImage";
import { ImageCropper } from "./ImageCropper";
import { pickableAssets } from "./ImageSourceChooser";
import {
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_EDGE_PX,
  readAndDownscale,
  rejectionMessage,
  useUploadChip,
} from "./imageUpload";

/** A picked picture, cropped to its field. `name` is the picked file's or
 * brand image's name. */
export interface PickedImage {
  dataUrl: string;
  name: string;
}

export interface ImagePick {
  /** Brand logos and images on offer: wherever a brand is loaded (the
   * signed-in pages). The public link page mounts no brand, so it is empty
   * there and the device is the only road. */
  brandAssets: BrandAsset[];
  /** A file from the device or one dropped on the control. Checks the size
   * and type the dropzones enforce, then downscales and opens the cropper. */
  pickFile(file: File): void;
  /** A brand image takes the same road as a file: fetched as a data URL
   * (it lives in page state and exports without a hole), downscaled, then
   * cropped like any other photo. */
  pickAsset(asset: BrandAsset): void;
  /** Re-crop the value in place (the Generate editor's "Adjust crop"). */
  recrop(): void;
  /** The last pick's problem, for the field's error line. */
  error: string | null;
  setError(error: string | null): void;
  /** The processing chip of today's dropzone field (Generate keeps it). */
  chip: ReturnType<typeof useUploadChip>["chip"];
  /** The cropper while one is open, portalled to <body>: inline, an
   * ancestor's mask, overflow or transform would clip it. Render it. */
  cropper: React.ReactNode;
}

/**
 * The image logic every photo field shares (new look, Phase 4, §9 D5):
 * where a picture comes from, its size and type checks, the downscale, and
 * the cropper every pick opens before the photo lands. The fill page's
 * Upload row and the Generate editor's dropzone field both run on it, so
 * the two cannot drift apart.
 *
 * `aspect` is the field's crop guardrail. `current` is the field's value,
 * the source for a re-crop when nothing was picked here (a value seeded by
 * Generate is the uncropped downscaled original).
 */
export function useImagePick({
  aspect,
  current,
  onPicked,
}: {
  aspect: number;
  current: string;
  onPicked(image: PickedImage): void;
}): ImagePick {
  const brand = useBrandOptional();
  const brandAssets = useMemo(() => pickableAssets(brand?.assets ?? []), [brand?.assets]);
  const [original, setOriginal] = useState<{ dataUrl: string; name: string } | null>(null);
  const [cropping, setCropping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { chip, runChip, clearChip } = useUploadChip();

  const process = useCallback(
    (name: string, work: Promise<string>, failure: string) => {
      const processing = work
        .then((scaled) => {
          setError(null);
          setOriginal({ dataUrl: scaled, name });
          setCropping(true);
        })
        .catch((e: unknown) => {
          console.error("Image load failed", e);
          setError(failure);
          throw e instanceof Error ? e : new Error(String(e));
        });
      processing.catch(() => clearChip());
      runChip(name, processing);
    },
    [runChip, clearChip],
  );

  const pickFile = useCallback(
    (file: File) => {
      if (file.size > MAX_UPLOAD_BYTES) {
        setError(rejectionMessage("file-too-large"));
        return;
      }
      if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
        setError(rejectionMessage("file-invalid-type"));
        return;
      }
      process(file.name, readAndDownscale(file), rejectionMessage(undefined));
    },
    [process],
  );

  const pickAsset = useCallback(
    (asset: BrandAsset) =>
      process(
        asset.name,
        loadDataUrl(asset.url).then((dataUrl) => downscaleImage(dataUrl, MAX_UPLOAD_EDGE_PX)),
        "We couldn't load that brand image. Try again, or upload a file.",
      ),
    [process],
  );

  const source = original?.dataUrl ?? current;
  const cropper =
    cropping && source
      ? createPortal(
          <ImageCropper
            imageSrc={source}
            aspect={aspect}
            onCancel={() => setCropping(false)}
            onCropComplete={(cropped) => {
              onPicked({ dataUrl: cropped, name: original?.name ?? "" });
              setCropping(false);
            }}
          />,
          document.body,
        )
      : null;

  return {
    brandAssets,
    pickFile,
    pickAsset,
    recrop: () => setCropping(true),
    error,
    setError,
    chip,
    cropper,
  };
}
