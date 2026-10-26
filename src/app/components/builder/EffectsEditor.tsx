import React, { useEffect, useRef, useState } from "react";
import { GripVertical, Minus, Plus } from "lucide-react";
import type { BrandKit, FieldEffect, TemplateField } from "@/lib/types";
import { Menu, MenuItem } from "../primitives/Menu";
import {
  InspectorSection,
  NumericField,
  PropertyRow,
  compactControlStyle,
} from "./InspectorControls";
import { FillPicker, fillSwatchCss } from "./FillPicker";
import {
  EFFECT_LABELS,
  effectKindsFor,
  effectSummary,
  joinColor,
  kindOf,
  moveEffect,
  newEffect,
  normalizeEffects,
  splitColor,
  type EffectTarget,
} from "./effectOps";

const iconStyle = { width: 13, height: 13 } as const;
const useBaseStyle: React.CSSProperties = { color: "var(--text-secondary)", flexShrink: 0 };
const quietButton: React.CSSProperties = {
  color: "var(--text-muted)",
  display: "flex",
  flexShrink: 0,
};

/** A field FillPicker can point at for one solid color (a proxy, as the
 * stroke and plate pickers use). */
function colorProxy(hex: string): TemplateField {
  return {
    id: "color-proxy",
    label: "",
    fieldKey: "color-proxy",
    type: "shape",
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    colorHex: hex,
  };
}

/** One solid color: swatch (opens the fill picker), hex, and an opacity
 * percent when `alpha` is on. `value` is #RRGGBB or #RRGGBBAA. */
export function ColorRow({
  label,
  ariaName,
  value,
  alpha = true,
  kit,
  companyId,
  onChange,
  onUseBase,
}: {
  label?: string;
  /** Names the controls for assistive tech: "Shadow" gives "Shadow hex value". */
  ariaName: string;
  value: string;
  alpha?: boolean;
  kit: BrandKit | null;
  companyId?: string;
  onChange(color: string): void;
  /** Present on a look's tab when this look changes the color. */
  onUseBase?(): void;
}) {
  const { hex, alpha: pct } = splitColor(value);
  const [open, setOpen] = useState(false);
  const swatchRef = useRef<HTMLButtonElement>(null);
  const write = (nextHex: string, nextPct = pct) =>
    onChange(alpha ? joinColor(nextHex, nextPct) : nextHex.slice(0, 7).toUpperCase());
  return (
    <PropertyRow label={label} full={!label}>
      <button
        ref={swatchRef}
        title={`Edit ${ariaName.toLowerCase()} color`}
        aria-label={`Edit ${ariaName.toLowerCase()} color`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{
          width: 24,
          height: 24,
          flexShrink: 0,
          borderRadius: "var(--radius-control)",
          border: "1px solid var(--border-strong)",
          background: fillSwatchCss(value),
          cursor: "pointer",
        }}
      />
      <input
        type="text"
        spellCheck={false}
        aria-label={`${ariaName} hex value`}
        className="sp-input"
        style={{
          ...compactControlStyle,
          fontFamily: "var(--font-mono)",
          fontSize: "var(--type-caption-size)",
          minWidth: 0,
          flex: 1,
        }}
        key={`${ariaName}:${hex}`}
        defaultValue={hex}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            (e.target as HTMLInputElement).value = hex;
            (e.target as HTMLInputElement).blur();
          }
        }}
        onBlur={(e) => {
          const m = /^#?([0-9a-fA-F]{6})$/.exec(e.target.value.trim());
          if (m) write(`#${m[1]}`);
          else e.target.value = hex;
        }}
      />
      {alpha && (
        <div style={{ width: 68, flexShrink: 0 }}>
          <NumericField
            suffix="%"
            ariaLabel={`${ariaName} opacity`}
            precision={0}
            min={0}
            max={100}
            value={pct}
            onCommit={(v) => write(hex, v ?? pct)}
          />
        </div>
      )}
      {onUseBase && (
        <button onClick={onUseBase} className="t-caption-s" style={useBaseStyle}>
          Use base
        </button>
      )}
      {open && (
        <FillPicker
          anchorRef={swatchRef}
          field={colorProxy(hex)}
          kit={kit}
          companyId={companyId}
          locked={false}
          solidOnly
          onChange={(patch) => {
            if (patch.colorHex) write(patch.colorHex);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </PropertyRow>
  );
}

type Shadow = Extract<FieldEffect, { type: "dropShadow" | "innerShadow" }>;
type Noise = Extract<FieldEffect, { type: "noise" }>;

/** The settings under an open row: only the values its kind uses. A drop
 * shadow or glow has no Spread field (spread isn't painted, see effects.ts). */
function EffectSettings({
  effect,
  name,
  kit,
  companyId,
  onChange,
}: {
  effect: FieldEffect;
  name: string;
  kit: BrandKit | null;
  companyId?: string;
  onChange(next: FieldEffect): void;
}) {
  const kind = kindOf(effect);
  const num = (label: string, value: number, apply: (v: number) => FieldEffect, min?: number) => (
    <NumericField
      key={label}
      label={label}
      ariaLabel={`${name} ${label.toLowerCase()}`}
      precision={label === "Size" ? 1 : 0}
      min={min}
      value={value}
      onCommit={(v) => {
        if (v !== undefined) onChange(apply(v));
      }}
    />
  );
  const color = (e: Shadow | Noise) => (
    <ColorRow
      ariaName={name}
      value={e.color}
      kit={kit}
      companyId={companyId}
      onChange={(c) => onChange({ ...e, color: c } as FieldEffect)}
    />
  );
  const indent: React.CSSProperties = { paddingLeft: "var(--space-lg)" };
  if (kind === "layerBlur") {
    const e = effect as Extract<FieldEffect, { type: "layerBlur" }>;
    return (
      <div style={indent}>
        <PropertyRow full>{num("Radius", e.radius, (v) => ({ ...e, radius: v }), 0)}</PropertyRow>
      </div>
    );
  }
  if (kind === "noise") {
    const e = effect as Noise;
    return (
      <div style={indent}>
        <PropertyRow full>
          {num("Size", e.size, (v) => ({ ...e, size: v }), 0.5)}
          <NumericField
            label="Coverage"
            suffix="%"
            ariaLabel={`${name} coverage`}
            precision={0}
            min={0}
            max={100}
            value={Math.round(e.density * 100)}
            onCommit={(v) => {
              if (v !== undefined) onChange({ ...e, density: v / 100 });
            }}
          />
        </PropertyRow>
        {color(e)}
      </div>
    );
  }
  const e = effect as Shadow;
  // A glow is a drop shadow at 0, 0, so it keeps X and Y: a shadow edited
  // to 0, 0 reads as a glow and can still be offset again.
  return (
    <div style={indent}>
      <PropertyRow full>
        {num("X", e.x, (v) => ({ ...e, x: v }))}
        {num("Y", e.y, (v) => ({ ...e, y: v }))}
        {num("Blur", e.blur, (v) => ({ ...e, blur: v }), 0)}
        {kind === "innerShadow" && num("Spread", e.spread ?? 0, (v) => ({ ...e, spread: v }))}
      </PropertyRow>
      {color(e)}
    </div>
  );
}

/** The Effects section (Figma "Builder · Depth (proposal)", approved
 * 2026-10-25): one row per effect in paint order, each with a grip to
 * reorder, its name and summary, and a remove; the open row shows its
 * settings. The plus offers the kinds this target can paint. */
export function EffectsEditor({
  id,
  effects,
  target,
  accentHex,
  kit,
  companyId,
  onChange,
  onUseBase,
}: {
  /** The section's id, for its remembered open state. */
  id: string;
  effects: FieldEffect[] | undefined;
  target: EffectTarget;
  accentHex?: string;
  kit: BrandKit | null;
  companyId?: string;
  onChange(next: FieldEffect[]): void;
  /** Present on a look's tab when this look changes the effects. */
  onUseBase?(): void;
}) {
  // Read like the renderer reads: a malformed entry, or one this target
  // can't paint, isn't listed (and isn't written back by the next edit).
  const list = normalizeEffects(effects, target) ?? [];
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  // Another element, another list: nothing stays open across selections.
  const targetKey = target.kind === "canvas" ? "canvas" : `${target.field.type}`;
  useEffect(() => setOpenIndex(null), [targetKey, id]);

  const update = (index: number, next: FieldEffect) =>
    onChange(list.map((e, i) => (i === index ? next : e)));
  const reorder = (from: number, to: number) => {
    onChange(moveEffect(list, from, to));
    setOpenIndex((o) => (o === from ? Math.max(0, Math.min(list.length - 1, to)) : o));
  };

  return (
    <InspectorSection
      id={id}
      title="Effects"
      headerExtra={
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)" }}>
          {onUseBase && (
            <button onClick={onUseBase} className="t-caption-s" style={useBaseStyle}>
              Use base
            </button>
          )}
          <Menu
            aria-label="Add effect"
            align="end"
            trigger={
              <button
                title="Add effect"
                aria-label="Add effect"
                style={{ color: "var(--text-secondary)", display: "flex" }}
              >
                <Plus style={iconStyle} strokeWidth={1.5} />
              </button>
            }
          >
            {effectKindsFor(target).map((kind) => (
              <MenuItem
                key={kind}
                onSelect={() => {
                  onChange([...list, newEffect(kind, accentHex)]);
                  setOpenIndex(list.length);
                }}
              >
                {EFFECT_LABELS[kind]}
              </MenuItem>
            ))}
          </Menu>
        </div>
      }
    >
      {list.map((effect, index) => {
        const name = EFFECT_LABELS[kindOf(effect)];
        const isOpen = openIndex === index;
        return (
          <div
            key={index}
            onDragOver={(e) => {
              if (dragFrom !== null) e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragFrom !== null) reorder(dragFrom, index);
              setDragFrom(null);
            }}
          >
            <PropertyRow full>
              <button
                draggable
                onDragStart={() => setDragFrom(index)}
                onDragEnd={() => setDragFrom(null)}
                onKeyDown={(e) => {
                  if (!e.altKey) return;
                  if (e.key === "ArrowUp") reorder(index, index - 1);
                  if (e.key === "ArrowDown") reorder(index, index + 1);
                }}
                title={`Reorder ${name.toLowerCase()}`}
                aria-label={`Reorder ${name.toLowerCase()}`}
                style={{ ...quietButton, cursor: "grab" }}
              >
                <GripVertical style={iconStyle} strokeWidth={1.5} />
              </button>
              <button
                aria-expanded={isOpen}
                onClick={() => setOpenIndex(isOpen ? null : index)}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: "var(--space-2xs)",
                  flex: 1,
                  minWidth: 0,
                  textAlign: "left",
                }}
              >
                <span style={{ fontSize: "var(--type-label-size)", color: "var(--text-primary)" }}>
                  {name}
                </span>
                <span
                  className="t-caption-s"
                  style={{
                    color: "var(--text-secondary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {effectSummary(effect)}
                </span>
              </button>
              <button
                title={`Remove ${name.toLowerCase()}`}
                aria-label={`Remove ${name.toLowerCase()}`}
                onClick={() => {
                  onChange(list.filter((_, i) => i !== index));
                  setOpenIndex(null);
                }}
                style={quietButton}
              >
                <Minus style={iconStyle} strokeWidth={1.5} />
              </button>
            </PropertyRow>
            {isOpen && (
              <EffectSettings
                effect={effect}
                name={name}
                kit={kit}
                companyId={companyId}
                onChange={(next) => update(index, next)}
              />
            )}
          </div>
        );
      })}
    </InspectorSection>
  );
}
