import React, { useCallback, useState } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { Crop, RefreshCw, Upload } from "lucide-react";
import type { TemplateField } from "@/lib/types";
import { ImageCropper } from "./ImageCropper";
import {
  MAX_UPLOAD_BYTES,
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
  const { chip, runChip, clearChip } = useUploadChip();

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
  });

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
      <div
        {...getRootProps({
          role: "button",
          "aria-label": `${field.label}: upload a JPG, PNG, or WEBP image up to 10MB`,
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
        <p style={{ fontSize: "var(--type-caption-size)", color: "var(--text-secondary)" }}>
          {value ? "Replace image" : "Click or drag to upload"}
        </p>
      </div>
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
