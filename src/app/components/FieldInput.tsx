import React, { useCallback, useMemo, useState } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { Crop, RefreshCw, Upload } from "lucide-react";
import type { BrandAsset, TemplateField } from "@/lib/types";
import { useBrandOptional } from "@/lib/brand/BrandContext";
import { loadDataUrl } from "@/lib/render/useDataUrl";
import { downscaleImage } from "@/lib/render/downscaleImage";
import { ImageCropper } from "./ImageCropper";
import { ImageSourceChooser, ImageSourceDialog, pickableAssets } from "./ImageSourceChooser";
import {
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_EDGE_PX,
  UPLOAD_ACCEPT,
  UploadChipView,
  readAndDownscale,
  rejectionMessage,
  useUploadChip,
} from "./imageUpload";

interface FieldInputProps {
  field: TemplateField;
  value: string;
  onChange(value: string): void;
  /** DOM id for the control so the page can associate a real <label>. */
  inputId?: string;
}

/** Member input for one template field. Enforces the field's guardrails
 * (maxLength, aspect-ratio crop, fixed options) — content only, never style. */
export function FieldInput({ field, value, onChange, inputId }: FieldInputProps) {
  switch (field.type) {
    case "text":
      return (
        <input
          id={inputId}
          type="text"
          value={value}
          maxLength={field.maxLength}
          placeholder={field.placeholder ?? field.label}
          aria-required={field.required || undefined}
          onChange={(e) => onChange(e.target.value)}
          className="sp-input"
        />
      );
    case "multiline":
      return (
        <textarea
          id={inputId}
          value={value}
          maxLength={field.maxLength}
          placeholder={field.placeholder ?? field.label}
          aria-required={field.required || undefined}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="sp-input"
          style={{ resize: "vertical" }}
        />
      );
    case "select":
      return (
        <select
          id={inputId}
          value={value}
          aria-required={field.required || undefined}
          onChange={(e) => onChange(e.target.value)}
          className="sp-input"
        >
          <option value="">Select…</option>
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    case "image":
      return <ImageFieldInput field={field} value={value} onChange={onChange} inputId={inputId} />;
  }
}

function ImageFieldInput({ field, value, onChange, inputId }: FieldInputProps) {
  const [original, setOriginal] = useState<string | null>(null);
  const [cropping, setCropping] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  /** The replace-image dialog: open once an image exists and the person
   * asks to swap it. */
  const [replacing, setReplacing] = useState(false);
  const { chip, runChip, clearChip } = useUploadChip();
  // Brand assets are on offer wherever a brand is loaded (the signed-in
  // member page); the public link page mounts no BrandProvider and keeps
  // the device path alone.
  const brand = useBrandOptional();
  const brandAssets = useMemo(() => pickableAssets(brand?.assets ?? []), [brand?.assets]);

  /** A brand logo or image takes the SAME road as a file from the device:
   * fetched as a data URL (so it lives in page state and exports without a
   * hole), downscaled to the standard long edge, then cropped to the
   * field's aspect guardrail like any other photo. */
  const pickBrandAsset = useCallback(
    (asset: BrandAsset) => {
      const processing = loadDataUrl(asset.url)
        .then((dataUrl) => downscaleImage(dataUrl, MAX_UPLOAD_EDGE_PX))
        .then((scaled) => {
          setUploadError(null);
          setOriginal(scaled);
          setCropping(true);
        })
        .catch((e: unknown) => {
          console.error("Brand image load failed", e);
          setUploadError("We couldn't load that brand image. Try again, or upload a file.");
          throw e instanceof Error ? e : new Error(String(e));
        });
      processing.catch(() => clearChip());
      runChip(asset.name, processing);
    },
    [runChip, clearChip],
  );

  const onDrop = useCallback(
    (accepted: File[]) => {
      const file = accepted[0];
      if (!file) return;
      const processing = readAndDownscale(file)
        .then((scaled) => {
          setUploadError(null);
          setOriginal(scaled);
          setCropping(true);
        })
        .catch((e: unknown) => {
          console.error("Upload decode failed", e);
          setUploadError(rejectionMessage(undefined));
          throw e instanceof Error ? e : new Error(String(e));
        });
      processing.catch(() => clearChip());
      runChip(file.name, processing);
    },
    [runChip, clearChip],
  );

  const onDropRejected = useCallback((rejections: FileRejection[]) => {
    setUploadError(rejectionMessage(rejections[0]?.errors[0]?.code));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    accept: UPLOAD_ACCEPT,
    maxFiles: 1,
    maxSize: MAX_UPLOAD_BYTES,
    // With an image in place the well is a drop target only; the click
    // goes to "Replace image", which asks where the new one comes from.
    noClick: Boolean(value),
    noKeyboard: Boolean(value),
  });

  /** A file chosen through the dialog: the same cap and type list the
   * dropzone enforces, then the same road. */
  const pickDeviceFile = useCallback(
    (file: File) => {
      if (file.size > MAX_UPLOAD_BYTES) {
        setUploadError(rejectionMessage("file-too-large"));
        return;
      }
      if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
        setUploadError(rejectionMessage("file-invalid-type"));
        return;
      }
      onDrop([file]);
    },
    [onDrop],
  );

  const aspect = field.aspectRatio ?? field.width / field.height;
  // What the cropper crops: the held original when the upload happened here,
  // else the current value — a value seeded by Generate is the uncropped
  // downscaled original, which is exactly the right source.
  const cropSource = original ?? value;

  return (
    <>
      {cropping && cropSource && (
        <ImageCropper
          imageSrc={cropSource}
          aspect={aspect}
          onCancel={() => setCropping(false)}
          onCropComplete={(cropped) => {
            onChange(cropped);
            setCropping(false);
          }}
        />
      )}
      <ImageSourceDialog
        open={replacing}
        onClose={() => setReplacing(false)}
        assets={brandAssets}
        onPickAsset={pickBrandAsset}
        onPickFile={pickDeviceFile}
        accept="image/png,image/jpeg,image/webp"
      />
      <ImageSourceChooser
        // The inline tabs belong to the FIRST upload. Once an image is in
        // place the question moves into the dialog, behind "Replace image".
        assets={value ? [] : brandAssets}
        onPickAsset={pickBrandAsset}
        device={
          <div
            {...getRootProps({
              role: value ? undefined : "button",
              "aria-label": value
                ? `${field.label}: drop a new image here, or use Replace image`
                : `${field.label}: upload a JPG, PNG, or WEBP image up to 10MB`,
              "aria-required": field.required || undefined,
            })}
            data-active={isDragActive}
            className="sp-dropzone text-center cursor-pointer flex flex-col items-center justify-center gap-2 group"
            style={{
              border: `1.5px dashed ${isDragActive ? "var(--state-primary)" : "var(--border-strong)"}`,
              borderRadius: "var(--radius-control)",
              background: isDragActive ? "var(--accent-wash)" : "var(--bg-surface)",
              padding: 14,
            }}
          >
            <input {...getInputProps({ id: inputId })} />
            {/* Non-visual counterpart of the drag-active highlight. */}
            <span className="sr-only" role="status" aria-live="polite">
              {isDragActive ? "Drop the image to upload" : ""}
            </span>
            {value ? (
              <div
                className="relative w-16 h-16 overflow-hidden"
                style={{ borderRadius: "var(--radius-card)", border: "1px solid var(--border)" }}
              >
                <img src={value} alt="Preview" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <RefreshCw className="w-4 h-4 text-white" />
                </div>
              </div>
            ) : (
              <span
                className="sp-dropzone__icon flex items-center justify-center"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "var(--radius-control)",
                  background: "var(--bg-raised)",
                  border: "1px solid var(--border)",
                }}
              >
                <Upload style={{ width: 15, height: 15, color: "var(--text-primary)" }} />
              </span>
            )}
            {value ? (
              <button
                type="button"
                className="sp-btn sp-btn-ghost"
                onClick={() => setReplacing(true)}
              >
                <RefreshCw style={{ width: 13, height: 13 }} aria-hidden />
                Replace image
              </button>
            ) : (
              <p style={{ fontSize: "var(--type-caption-size)", color: "var(--text-secondary)" }}>
                Click or drag to upload
              </p>
            )}
          </div>
        }
      />
      {value && !cropping && (
        <button
          type="button"
          className="flex items-center gap-1.5"
          style={{
            fontSize: "var(--type-caption-size)",
            color: "var(--text-secondary)",
            marginTop: 6,
          }}
          onClick={() => setCropping(true)}
        >
          <Crop style={{ width: 12, height: 12 }} aria-hidden />
          Adjust crop
        </button>
      )}
      {chip && <UploadChipView chip={chip} doneLabel="Ready to crop" />}
      {uploadError && (
        <p
          role="alert"
          style={{
            fontSize: "var(--type-caption-size)",
            color: "var(--state-primary)",
            marginTop: 6,
          }}
        >
          {uploadError}
        </p>
      )}
    </>
  );
}
