import React, { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Star, X } from "lucide-react";
import type { BrandKit, FieldValues, TemplateSchema, TemplateVariant } from "@/lib/types";
import { SchemaRenderer } from "../SchemaRenderer";

interface VariantFilmstripProps {
  /** The draft as a schema — every frame renders THIS, through the one
   * renderer, so a structural edit moves every frame at once. */
  schema: TemplateSchema;
  brandKit: BrandKit | null;
  values: FieldValues;
  selectedId: string | undefined;
  /** Per variation, how many contrast warnings the check raised. */
  warningCounts: Map<string, number>;
  onSelect(id: string): void;
  onAdd(): void;
  onRename(id: string, name: string): void;
  onRemove(id: string): void;
  onSetDefault(id: string): void;
}

/** The variations as connected frames, side by side above the canvas — the
 * way a variant set reads in a design tool. Every frame is the same draft
 * painted in a different look, so dragging an element on the canvas moves
 * it in every frame on screen, live: the connection is seen, not explained.
 * One frame is selected; colour edits land on it alone. */
export function VariantFilmstrip({
  schema,
  brandKit,
  values,
  selectedId,
  warningCounts,
  onSelect,
  onAdd,
  onRename,
  onRemove,
  onSetDefault,
}: VariantFilmstripProps) {
  const variants = schema.variants ?? [];
  const multi = variants.length > 1;
  const frameHeight = 84;
  const frameWidth = Math.round((frameHeight * schema.canvasWidth) / schema.canvasHeight);

  return (
    <div
      className="flex items-stretch flex-shrink-0"
      style={{
        gap: "var(--space-2xs)",
        padding: "var(--space-2xs) var(--space-xs)",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-surface)",
        overflowX: "auto",
      }}
    >
      <div
        className="flex flex-col justify-center flex-shrink-0"
        style={{ paddingRight: "var(--space-2xs)", minWidth: 88 }}
      >
        <span className="sp-eyebrow">Variations</span>
        <span style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 2 }}>
          {multi
            ? "Same layout in every frame. Colours per frame."
            : "One look. Add another to start a set."}
        </span>
      </div>
      {multi &&
        variants.map((v) => (
          <Frame
            key={v.id}
            variant={v}
            schema={schema}
            brandKit={brandKit}
            values={values}
            width={frameWidth}
            height={frameHeight}
            selected={v.id === selectedId}
            warnings={warningCounts.get(v.id) ?? 0}
            canRemove={variants.length > 1}
            onSelect={() => onSelect(v.id)}
            onRename={(name) => onRename(v.id, name)}
            onRemove={() => onRemove(v.id)}
            onSetDefault={() => onSetDefault(v.id)}
          />
        ))}
      <button
        type="button"
        onClick={onAdd}
        title={
          multi
            ? "Add a variation: a copy of the selected look, in a new frame"
            : "Add a variation: this look plus a second frame to recolour"
        }
        className="flex flex-col items-center justify-center flex-shrink-0"
        style={{
          width: multi ? frameWidth : undefined,
          minWidth: 72,
          padding: multi ? 0 : "0 var(--space-xs)",
          height: frameHeight + 22,
          border: "1.5px dashed var(--border-strong)",
          borderRadius: "var(--radius-control)",
          color: "var(--text-secondary)",
          fontSize: "var(--type-caption-size)",
          gap: 4,
        }}
      >
        <Plus style={{ width: 14, height: 14 }} />
        Add variation
      </button>
    </div>
  );
}

function Frame({
  variant,
  schema,
  brandKit,
  values,
  width,
  height,
  selected,
  warnings,
  canRemove,
  onSelect,
  onRename,
  onRemove,
  onSetDefault,
}: {
  variant: TemplateVariant;
  schema: TemplateSchema;
  brandKit: BrandKit | null;
  values: FieldValues;
  width: number;
  height: number;
  selected: boolean;
  warnings: number;
  canRemove: boolean;
  onSelect(): void;
  onRename(name: string): void;
  onRemove(): void;
  onSetDefault(): void;
}) {
  const [renaming, setRenaming] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (renaming) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [renaming]);
  // The frame is a preview: it never records usage and never takes pointer
  // events itself — the whole tile is one button.
  const frameStyle = useMemo<React.CSSProperties>(
    () => ({ width, height, pointerEvents: "none" }),
    [width, height],
  );

  return (
    <div
      className="flex flex-col flex-shrink-0"
      style={{ width, gap: 3 }}
      data-selected={selected || undefined}
    >
      <button
        type="button"
        onClick={onSelect}
        onDoubleClick={() => setRenaming(true)}
        aria-pressed={selected}
        aria-label={`${variant.name}${variant.isDefault ? " (default)" : ""}${
          warnings ? `, ${warnings} contrast ${warnings === 1 ? "warning" : "warnings"}` : ""
        }`}
        title={
          selected
            ? "Selected. Colour edits apply to this frame only. Double-click to rename."
            : "Select this variation. Double-click to rename."
        }
        className="relative overflow-hidden"
        style={{
          ...frameStyle,
          pointerEvents: "auto",
          borderRadius: "var(--radius-control)",
          outline: selected ? "2px solid var(--editor-accent)" : "1px solid var(--border)",
          outlineOffset: selected ? 1 : 0,
          background: "var(--bg-hover)",
        }}
      >
        <div style={frameStyle}>
          <SchemaRenderer
            schema={schema}
            values={values}
            brandKit={brandKit}
            instrument={false}
            variantId={variant.id}
          />
        </div>
        {warnings > 0 && (
          <span
            aria-hidden
            title={`${warnings} contrast ${warnings === 1 ? "warning" : "warnings"}`}
            style={{
              position: "absolute",
              top: 3,
              right: 3,
              minWidth: 14,
              height: 14,
              padding: "0 4px",
              borderRadius: "var(--radius-pill)",
              background: "var(--state-warning, #b45309)",
              color: "#fff",
              fontSize: 9,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {warnings}
          </span>
        )}
      </button>
      <div className="flex items-center" style={{ gap: 3, minHeight: 18 }}>
        {renaming ? (
          <input
            ref={inputRef}
            defaultValue={variant.name}
            aria-label="Variation name"
            className="sp-input"
            style={{ height: 18, padding: "0 4px", fontSize: 10.5, minWidth: 0, flex: 1 }}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") {
                (e.target as HTMLInputElement).value = variant.name;
                (e.target as HTMLInputElement).blur();
              }
            }}
            onBlur={(e) => {
              const next = e.target.value.trim();
              if (next && next !== variant.name) onRename(next);
              setRenaming(false);
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setRenaming(true)}
            title="Rename"
            className="truncate text-left"
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 10.5,
              fontWeight: selected ? 500 : 400,
              color: selected ? "var(--text-primary)" : "var(--text-secondary)",
            }}
          >
            {variant.name}
          </button>
        )}
        <button
          type="button"
          onClick={onSetDefault}
          aria-pressed={Boolean(variant.isDefault)}
          aria-label={variant.isDefault ? "Default look" : "Make this the default look"}
          title={
            variant.isDefault
              ? "The default: what old links, bulk rows, and pinned-to-nothing links render."
              : "Make this the default look"
          }
          style={{
            display: "flex",
            color: variant.isDefault ? "var(--state-primary)" : "var(--text-disabled)",
            flexShrink: 0,
          }}
        >
          <Star
            style={{ width: 11, height: 11 }}
            fill={variant.isDefault ? "currentColor" : "none"}
          />
        </button>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Delete ${variant.name}`}
            title="Delete this variation. Its colour overrides go with it; the shared layout stays."
            style={{ display: "flex", color: "var(--text-muted)", flexShrink: 0 }}
          >
            <X style={{ width: 11, height: 11 }} />
          </button>
        )}
      </div>
    </div>
  );
}
