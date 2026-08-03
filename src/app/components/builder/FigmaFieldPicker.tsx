import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Image as ImageIcon, Type as TypeIcon } from "lucide-react";
import type { BrandKit, DesignImportResult, FieldType, TemplateField } from "@/lib/types";
import { useDataUrl } from "@/lib/render/useDataUrl";

interface FigmaFieldPickerProps {
  result: DesignImportResult;
  kit: BrandKit | null;
  onConfirm(fields: TemplateField[]): void;
  onBack(): void;
}

interface Candidate {
  field: TemplateField;
  include: boolean;
}

/** Interactive review of a Figma import: every detected text layer and image
 * placeholder is a CANDIDATE; the admin decides which become editable input
 * fields (with label, type, and a type-style binding) — everything else
 * stays baked into the locked background. */
export function FigmaFieldPicker({ result, kit, onConfirm, onBack }: FigmaFieldPickerProps) {
  const [candidates, setCandidates] = useState<Candidate[]>(
    result.suggestedFields.map((field) => ({ field, include: true })),
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);
  const backgroundDataUrl = useDataUrl(result.backgroundUrl);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setScale(Math.min(el.offsetWidth / result.canvasWidth, 1));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [result.canvasWidth]);

  const included = useMemo(() => candidates.filter((c) => c.include), [candidates]);

  const update = (id: string, patch: Partial<Candidate> | { field: Partial<TemplateField> }) =>
    setCandidates((prev) =>
      prev.map((c) =>
        c.field.id === id
          ? "field" in patch
            ? { ...c, field: { ...c.field, ...(patch.field as Partial<TemplateField>) } }
            : { ...c, ...(patch as Partial<Candidate>) }
          : c,
      ),
    );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Frame with candidate overlay */}
      <div className="lg:col-span-7">
        <div className="sp-card p-4">
          <p className="mb-3" style={{ fontSize: "var(--type-caption-size)", color: "var(--text-muted)" }}>
            {result.suggestedFields.length} elements detected. Checked elements become editable
            inputs and are lifted off the background; everything unchecked stays baked into the
            locked design.
          </p>
          <div
            ref={containerRef}
            className="relative w-full overflow-hidden"
            style={{ aspectRatio: `${result.canvasWidth} / ${result.canvasHeight}` }}
          >
            <div
              style={{
                width: result.canvasWidth,
                height: result.canvasHeight,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
                position: "absolute",
                background: "#fff",
              }}
            >
              {backgroundDataUrl && (
                <img
                  src={backgroundDataUrl}
                  alt=""
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                />
              )}
            </div>
            {candidates.map(({ field, include }) => (
              <button
                key={field.id}
                onClick={() => {
                  setActiveId(field.id);
                  update(field.id, { include: !include });
                }}
                onMouseEnter={() => setActiveId(field.id)}
                title={`${field.label} — click to ${include ? "exclude" : "include"}`}
                style={{
                  position: "absolute",
                  left: field.x * scale,
                  top: field.y * scale,
                  width: field.width * scale,
                  height: field.height * scale,
                  border: include ? "2px solid var(--state-primary)" : "1.5px dashed rgba(35,31,35,0.35)",
                  background:
                    activeId === field.id
                      ? "var(--accent-wash-strong)"
                      : include
                        ? "var(--accent-wash)"
                        : "transparent",
                  cursor: "pointer",
                }}
              />
            ))}
          </div>
        </div>
        {result.warnings.map((w) => (
          <p key={w} className="mt-2 rounded-lg px-3 py-2" style={{ fontSize: "var(--type-caption-size)", background: "var(--bg-hover)", color: "var(--text-secondary)" }}>
            {w}
          </p>
        ))}
      </div>

      {/* Candidate list */}
      <div className="lg:col-span-5 space-y-3">
        <div className="sp-card divide-y" style={{ borderColor: "var(--border)" }}>
          {candidates.map(({ field, include }) => (
            <div
              key={field.id}
              className="flex items-center gap-2.5 px-3 py-2.5"
              style={{
                borderColor: "var(--border)",
                background: activeId === field.id ? "var(--bg-raised)" : undefined,
              }}
              onMouseEnter={() => setActiveId(field.id)}
            >
              <input
                type="checkbox"
                checked={include}
                onChange={(e) => update(field.id, { include: e.target.checked })}
              />
              {field.type === "image" ? (
                <ImageIcon style={{ width: 13, height: 13, color: "var(--text-muted)", flexShrink: 0 }} />
              ) : (
                <TypeIcon style={{ width: 13, height: 13, color: "var(--text-muted)", flexShrink: 0 }} />
              )}
              <input
                className="flex-1 bg-transparent outline-none min-w-0"
                style={{ fontSize: "var(--type-label-size)", color: include ? "var(--text-primary)" : "var(--text-disabled)" }}
                value={field.label}
                disabled={!include}
                onChange={(e) => update(field.id, { field: { label: e.target.value } })}
              />
              <select
                className="sp-input"
                style={{ width: "auto", padding: "4px 6px", fontSize: 11 }}
                value={field.type}
                disabled={!include}
                onChange={(e) => update(field.id, { field: { type: e.target.value as FieldType } })}
              >
                <option value="text">Text</option>
                <option value="multiline">Multiline</option>
                <option value="image">Image</option>
                <option value="select">Dropdown</option>
              </select>
              {(field.type === "text" || field.type === "multiline") && (
                <select
                  className="sp-input"
                  style={{ width: "auto", padding: "4px 6px", fontSize: 11 }}
                  value={field.typeStyleKey ?? ""}
                  disabled={!include}
                  title="Bind to a brand type style"
                  onChange={(e) => update(field.id, { field: { typeStyleKey: e.target.value || undefined } })}
                >
                  <option value="">No style</option>
                  {(kit?.typeStyles ?? []).map((ts) => (
                    <option key={ts.key} value={ts.key}>{ts.name}</option>
                  ))}
                </select>
              )}
            </div>
          ))}
          {candidates.length === 0 && (
            <p className="px-3 py-6 text-center" style={{ fontSize: "var(--type-label-size)", color: "var(--text-muted)" }}>
              Nothing was detected — the background imported; draw fields manually in the next step.
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={onBack} className="sp-btn sp-btn-ghost">
            <ArrowLeft style={{ width: 13, height: 13 }} />
            Back
          </button>
          <button
            onClick={() => onConfirm(included.map((c) => c.field))}
            className="sp-btn sp-btn-primary flex-1"
          >
            <Check style={{ width: 13, height: 13 }} />
            {included.length
              ? `Create template with ${included.length} field${included.length !== 1 ? "s" : ""}`
              : "Continue with background only"}
          </button>
        </div>
        <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
          You can refine guardrails, positions, and styling for each field in the builder next.
        </p>
      </div>
    </div>
  );
}
