import React, { useCallback, useState } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { RefreshCw, Upload } from "lucide-react";
import type { TemplateField } from "@/lib/types";
import { downscaleImage } from "@/lib/render/downscaleImage";
import { ImageCropper } from "./ImageCropper";

/** Hard cap on member photo uploads — referenced in the rejection copy. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB

/** Uploads are downscaled to this long edge before cropping. Templates render
 * at schema canvas size (1440 today), so anything past 2048 costs memory in
 * three places (original, crop, double toPng) and adds no visible quality. */
const MAX_UPLOAD_EDGE_PX = 2048;

const rejectionMessage = (code: string | undefined): string => {
  switch (code) {
    case "file-too-large":
      return "That image is over 10MB. Try a smaller one.";
    case "file-invalid-type":
      return "That file type isn't supported. Use a JPG, PNG, or WEBP.";
    case "too-many-files":
      return "Please add one image at a time.";
    default:
      return "We couldn't read that file. Try a different image.";
  }
};

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

  const onDrop = useCallback((accepted: File[]) => {
    const file = accepted[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      downscaleImage(reader.result as string, MAX_UPLOAD_EDGE_PX)
        .then((scaled) => {
          setUploadError(null);
          setOriginal(scaled);
          setCropping(true);
        })
        .catch((e) => {
          console.error("Upload decode failed", e);
          setUploadError(rejectionMessage(undefined));
        });
    };
    reader.onerror = () => setUploadError(rejectionMessage(undefined));
    reader.readAsDataURL(file);
  }, []);

  const onDropRejected = useCallback((rejections: FileRejection[]) => {
    setUploadError(rejectionMessage(rejections[0]?.errors[0]?.code));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    accept: { "image/*": [".png", ".jpg", ".jpeg", ".webp"] },
    maxFiles: 1,
    maxSize: MAX_UPLOAD_BYTES,
  });

  const aspect = field.aspectRatio ?? field.width / field.height;

  return (
    <>
      {cropping && original && (
        <ImageCropper
          imageSrc={original}
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
            style={{ width: 36, height: 36, borderRadius: "var(--radius-control)", background: "var(--volt)" }}
          >
            <Upload style={{ width: 15, height: 15, color: "var(--text-primary)" }} />
          </span>
        )}
        <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          {value ? "Replace image" : "Click or drag to upload"}
        </p>
      </div>
      {uploadError && (
        <p role="alert" style={{ fontSize: 12, color: "var(--state-primary)", marginTop: 6 }}>
          {uploadError}
        </p>
      )}
    </>
  );
}
