import React, { useCallback, useState } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { Crop, RefreshCw, Upload } from "lucide-react";
import type { TemplateField } from "@/lib/types";
import { isRequiredField } from "@/lib/templates/fieldRules";
import { useImagePick } from "./imagePick";
import { ImageSourceChooser, ImageSourceDialog } from "./ImageSourceChooser";
import { MAX_UPLOAD_BYTES, UPLOAD_ACCEPT, UploadChipView, rejectionMessage } from "./imageUpload";

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
  const controlClass = "sp-input";
  switch (field.type) {
    case "text":
      return (
        <input
          id={inputId}
          type="text"
          value={value}
          maxLength={field.maxLength}
          placeholder={field.placeholder ?? field.label}
          aria-required={isRequiredField(field) || undefined}
          onChange={(e) => onChange(e.target.value)}
          className={controlClass}
        />
      );
    case "multiline":
      return (
        <textarea
          id={inputId}
          value={value}
          maxLength={field.maxLength}
          placeholder={field.placeholder ?? field.label}
          aria-required={isRequiredField(field) || undefined}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className={controlClass}
          style={{ resize: "vertical" }}
        />
      );
    case "select":
      return (
        <select
          id={inputId}
          value={value}
          aria-required={isRequiredField(field) || undefined}
          onChange={(e) => onChange(e.target.value)}
          className={controlClass}
        >
          {/* The admin's placeholder is the empty option's text; the
              inspector labels it "Empty option" for a dropdown. */}
          <option value="">{field.placeholder || "Select…"}</option>
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
  /** The replace-image dialog: open once an image exists and the person
   * asks to swap it. */
  const [replacing, setReplacing] = useState(false);
  const aspect = field.aspectRatio ?? field.width / field.height;
  // Where the picture comes from, the checks, the downscale and the
  // cropper are the shared image logic (imagePick.tsx).
  const pick = useImagePick({
    aspect,
    current: value,
    onPicked: (image) => onChange(image.dataUrl),
  });
  const { brandAssets, chip, cropper } = pick;
  const uploadError = pick.error;

  const onDrop = useCallback(
    (accepted: File[]) => {
      const file = accepted[0];
      if (file) pick.pickFile(file);
    },
    [pick],
  );

  const onDropRejected = useCallback(
    (rejections: FileRejection[]) => {
      pick.setError(rejectionMessage(rejections[0]?.errors[0]?.code));
    },
    [pick],
  );

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

  return (
    <>
      {cropper}
      <ImageSourceDialog
        open={replacing}
        onClose={() => setReplacing(false)}
        assets={brandAssets}
        onPickAsset={pick.pickAsset}
        onPickFile={pick.pickFile}
        accept="image/png,image/jpeg,image/webp"
      />
      <ImageSourceChooser
        // The inline tabs belong to the FIRST upload. Once an image is in
        // place the question moves into the dialog, behind "Replace image".
        assets={value ? [] : brandAssets}
        onPickAsset={pick.pickAsset}
        device={
          <div
            {...getRootProps({
              role: value ? undefined : "button",
              "aria-label": value
                ? `${field.label}: drop a new image here, or use Replace image`
                : `${field.label}: upload a JPG, PNG, or WEBP image up to 10MB`,
              "aria-required": isRequiredField(field) || undefined,
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
      {value && !cropper && (
        <button
          type="button"
          className="flex items-center gap-1.5"
          style={{
            fontSize: "var(--type-caption-size)",
            color: "var(--text-secondary)",
            marginTop: 6,
          }}
          onClick={pick.recrop}
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
