import React, { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import type { FieldValues, TemplateField } from "@/lib/types";
import { isRequiredField } from "@/lib/templates/fieldRules";
import { addPhotoPlaceholder } from "@/lib/templates/fieldCopy";
import { useImagePick } from "../imagePick";
import { ImageSourceDialog } from "../ImageSourceChooser";
import {
  Field,
  IconButton,
  Input,
  SegmentedControl,
  Select,
  TextArea,
  Upload,
} from "../primitives";

/** How long "Copied" stays on the caption's action, as today. */
export const COPIED_MS = 1600;

export interface DetailsLook {
  options: Array<{ id: string; label: string }>;
  selectedId: string | null;
  onSelect(id: string): void;
}

export interface DetailsCaption {
  value: string;
  onChange(next: string): void;
  /** Edited, in the template chat. */
  edited?: boolean;
}

export interface DetailsPanelProps {
  /** "Details" on the fill page, "Edit details" in the template chat. */
  title: string;
  /** The header's close button (the template chat's Edit details). */
  onClose?(): void;
  closeLabel?: string;
  /** Look, as a Segmented control, when the template has more than one. */
  look?: DetailsLook | null;
  /** The member fields to show, in the template's order. */
  fields?: TemplateField[];
  values?: FieldValues;
  onValueChange?(fieldKey: string, value: string): void;
  /** The field rows, built by the caller from DetailField, in place of
   * `fields` (the template chat, whose rows edit a draft). */
  fieldRows?: React.ReactNode;
  /** A field's character cap, where the brand sets one. */
  maxLengthFor?(field: TemplateField): number | undefined;
  /** A field's error line: a required value missing, or the value too long. */
  errors?: Record<string, string | undefined>;
  /** Edited markers (the template chat only): the value differs from when
   * the panel opened. */
  isEdited?(fieldKey: string): boolean;
  caption?: DetailsCaption | null;
  /** The footer's buttons. */
  footer: React.ReactNode;
  /** The form the fields sit in, for focusFirstInvalid; it is also the
   * fields' scroller. */
  formRef?: React.Ref<HTMLFormElement>;
  /** The panel itself, and what the caller puts on it (the template chat's
   * Escape and focus handling). */
  panelRef?: React.Ref<HTMLElement>;
  panelProps?: React.HTMLAttributes<HTMLElement>;
  closeRef?: React.Ref<HTMLButtonElement>;
  className?: string;
}

/**
 * The Details panel (new look, 156:782 and 13:8148): one component,
 * configured per place (PHASE-4.md §9 D4). The fill page titles it
 * "Details"; the template chat "Edit details", with a close button. The
 * fields come from the template in both: Look, every member field (a photo
 * as the Upload control), then Caption, whose label row carries Copy. The
 * fields scroll inside the panel; the title and the footer stay put.
 */
export function DetailsPanel({
  title,
  onClose,
  closeLabel = "Close",
  look,
  fields = [],
  values = {},
  onValueChange,
  fieldRows,
  maxLengthFor,
  errors = {},
  isEdited,
  caption,
  footer,
  formRef,
  panelRef,
  panelProps,
  closeRef,
  className,
}: DetailsPanelProps) {
  const titleId = useId();
  const lookLabelId = useId();
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(copiedTimer.current), []);

  const copyCaption = async () => {
    if (!caption) return;
    await navigator.clipboard.writeText(caption.value);
    setCopied(true);
    window.clearTimeout(copiedTimer.current);
    copiedTimer.current = window.setTimeout(() => setCopied(false), COPIED_MS);
  };

  return (
    <section
      ref={panelRef}
      aria-labelledby={titleId}
      {...panelProps}
      className={["sp-details", className].filter(Boolean).join(" ")}
    >
      <div className="sp-details__head">
        <h2 id={titleId} className="t-title-card">
          {title}
        </h2>
        {onClose && <IconButton ref={closeRef} icon={X} label={closeLabel} onClick={onClose} />}
      </div>

      <form
        ref={formRef}
        className="sp-details__fields"
        noValidate
        onSubmit={(e) => e.preventDefault()}
      >
        {look && look.options.length > 1 && (
          <div className="ui-field">
            <div className="ui-field__row">
              <span id={lookLabelId} className="t-label-xs ui-field__label">
                Look
              </span>
            </div>
            <SegmentedControl
              aria-labelledby={lookLabelId}
              options={look.options}
              selectedId={look.selectedId}
              onSelect={look.onSelect}
              className="sp-details__look"
            />
          </div>
        )}

        {fieldRows}
        {fields.map((field) => (
          <DetailField
            key={field.id}
            field={field}
            value={values[field.fieldKey] ?? ""}
            onChange={(v) => onValueChange?.(field.fieldKey, v)}
            maxLength={maxLengthFor?.(field) ?? field.maxLength}
            error={errors[field.fieldKey]}
            edited={isEdited?.(field.fieldKey) ?? false}
          />
        ))}

        {caption && (
          <Field
            label="Caption"
            edited={caption.edited}
            action={{ label: copied ? "Copied" : "Copy", onClick: () => void copyCaption() }}
          >
            <TextArea value={caption.value} onChange={(e) => caption.onChange(e.target.value)} />
          </Field>
        )}
      </form>

      <div className="sp-details__foot">{footer}</div>
    </section>
  );
}

/** One field row of the panel: the Field with the control its type takes
 * (Input, TextArea, Select, or the Upload row for a photo). */
export function DetailField({
  field,
  value,
  onChange,
  maxLength,
  error,
  edited,
  optional: optionalProp,
  controlId,
}: {
  field: TemplateField;
  value: string;
  onChange(value: string): void;
  maxLength?: number;
  error?: string;
  edited: boolean;
  /** Whether it can stay empty; by default, from the field. */
  optional?: boolean;
  /** The control's id, for a caller that focuses it. */
  controlId?: string;
}) {
  const optional = optionalProp ?? !isRequiredField(field);
  if (field.type === "image") {
    return (
      <PhotoField
        field={field}
        value={value}
        onChange={onChange}
        error={error}
        edited={edited}
        optional={optional}
        controlId={controlId}
      />
    );
  }
  const required = isRequiredField(field) || undefined;
  return (
    <Field label={field.label} error={error} edited={edited} optional={optional}>
      {field.type === "multiline" ? (
        <TextArea
          id={controlId}
          value={value}
          maxLength={maxLength}
          placeholder={field.placeholder ?? field.label}
          aria-required={required}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : field.type === "select" ? (
        <Select
          id={controlId}
          ariaLabel={field.label}
          size="lg"
          value={value || undefined}
          placeholder={field.placeholder || "Select…"}
          options={(field.options ?? []).map((o) => ({ value: o, label: o }))}
          onSelect={onChange}
        />
      ) : (
        <Input
          id={controlId}
          value={value}
          maxLength={maxLength}
          placeholder={field.placeholder ?? field.label}
          aria-required={required}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  );
}

/** A photo field (PHASE-4.md §9 D5): the Upload row, one button that opens
 * today's picker (brand images or a device file; the device alone where no
 * brand is loaded, as on the public link page). A file dropped on the row
 * takes the same road, and every pick opens the cropper. Re-cropping is
 * Replace. */
function PhotoField({
  field,
  value,
  onChange,
  error,
  edited,
  optional,
  controlId,
}: {
  field: TemplateField;
  value: string;
  onChange(value: string): void;
  error?: string;
  edited: boolean;
  optional: boolean;
  controlId?: string;
}) {
  // The picked file's or brand image's name. Not part of the values (a
  // value is the cropped picture itself), so a photo that arrived another
  // way shows the field's label.
  const [name, setName] = useState("");
  const [asking, setAsking] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pick = useImagePick({
    aspect: field.aspectRatio ?? field.width / field.height,
    current: value,
    onPicked: (image) => {
      setName(image.name);
      onChange(image.dataUrl);
    },
  });
  const placeholder = addPhotoPlaceholder(field.label);
  const shownName = value ? name || field.label : "";

  const open = () => {
    if (pick.brandAssets.length > 0) setAsking(true);
    else fileRef.current?.click();
  };

  return (
    <>
      {pick.cropper}
      <ImageSourceDialog
        open={asking}
        onClose={() => setAsking(false)}
        assets={pick.brandAssets}
        onPickAsset={pick.pickAsset}
        onPickFile={pick.pickFile}
        accept="image/png,image/jpeg,image/webp"
        title={value ? "Replace image" : placeholder}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) pick.pickFile(file);
        }}
      />
      <Field label={field.label} error={error ?? pick.error} edited={edited} optional={optional}>
        <Upload
          id={controlId}
          placeholder={placeholder}
          thumbnail={value || null}
          fileName={shownName}
          // The row's text is its state; the name says the field and what a
          // press does.
          aria-label={
            value ? `${field.label}: ${shownName}. Replace` : `${field.label}: ${placeholder}`
          }
          onClick={open}
          onDropFile={pick.pickFile}
        />
      </Field>
    </>
  );
}
