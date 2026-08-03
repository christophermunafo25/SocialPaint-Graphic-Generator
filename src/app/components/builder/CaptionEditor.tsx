import React, { useRef } from "react";
import type { TemplateField } from "@/lib/types";

interface CaptionEditorProps {
  value: string;
  fields: TemplateField[];
  onChange(value: string): void;
}

/** Caption merge-template editor with insertable {field_key} tags. */
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

  // Static elements have no member value to merge — no tag chip.
  const taggable = fields.filter((f) => f.type !== "image" && !f.static);

  return (
    <div className="space-y-2">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        placeholder="e.g. Join us in congratulating {name} on {years} incredible years!"
        className="sp-input"
        style={{ resize: "vertical" }}
      />
      {taggable.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="sp-eyebrow">Insert</span>
          {taggable.map((f) => (
            <button
              key={f.id}
              onClick={() => insertTag(f.fieldKey)}
              style={{ fontFamily: "var(--font-mono)", fontSize: 11, padding: "3px 8px", borderRadius: "var(--radius-control)", background: "var(--bg-hover)", color: "var(--text-secondary)" }}
            >
              {"{"}{f.fieldKey}{"}"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
