import React, { useRef } from "react";
import type { TemplateField } from "@/lib/types";
import { Chip, Field, TextArea } from "../primitives";

interface CaptionEditorProps {
  value: string;
  fields: TemplateField[];
  onChange(value: string): void;
}

/** The caption your team gets beside the finished graphic (Publish,
 * 326:1233): the text, then a chip for each field your team fills in,
 * which puts that field's tag where the cursor is. Fixed elements and
 * images have no value to merge, so they get no chip. */
export function CaptionEditor({ value, fields, onChange }: CaptionEditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const insertTag = (fieldKey: string) => {
    const el = ref.current;
    const tag = `{${fieldKey}}`;
    if (!el) {
      onChange(value + tag);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    onChange(value.slice(0, start) + tag + value.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + tag.length, start + tag.length);
    });
  };

  const taggable = fields.filter((f) => f.type !== "image" && !f.static);

  return (
    <div className="sp-caption-editor">
      <Field label="Caption">
        <TextArea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Join us in congratulating {name}"
        />
      </Field>
      {taggable.length > 0 && (
        <div className="sp-caption-editor__tags" role="group" aria-label="Insert a field">
          {taggable.map((f) => (
            <Chip key={f.id} aria-label={`Insert ${f.label}`} onClick={() => insertTag(f.fieldKey)}>
              {f.label}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}
