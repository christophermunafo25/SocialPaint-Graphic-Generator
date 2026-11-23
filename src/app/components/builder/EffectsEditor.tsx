import React, { useEffect, useRef, useState } from "react";
import { GripVertical, Minus, Plus } from "lucide-react";
import type { BrandKit, FieldEffect, TemplateField } from "@/lib/types";
import { Button, IconButton } from "../primitives";
import { Menu, MenuItem } from "../primitives/Menu";
import { HexRow, InspectorSection, NumericField, PropertyRow } from "./InspectorControls";
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
      <HexRow
        ref={swatchRef}
        swatch={fillSwatchCss(value)}
        swatchLabel={`Edit ${ariaName.toLowerCase()} color`}
        expanded={open}
        onSwatch={() => setOpen((o) => !o)}
        hex={hex}
        hexLabel={`${ariaName} hex value`}
        onHex={(next) => write(next.slice(0, 7))}
      >
        {alpha && (
          <NumericField
            bare
            suffix="%"
            ariaLabel={`${ariaName} opacity`}
            precision={0}
            min={0}
            max={100}
            value={pct}
            onCommit={(v) => write(hex, v ?? pct)}
          />
        )}
      </HexRow>
      {onUseBase && (
        <Button kind="ghost" size="sm" onClick={onUseBase}>
          Use base
        </Button>
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
  if (kind === "layerBlur") {
    const e = effect as Extract<FieldEffect, { type: "layerBlur" }>;
    return (
      <div className="sp-effect-settings">
        <PropertyRow full>{num("Radius", e.radius, (v) => ({ ...e, radius: v }), 0)}</PropertyRow>
      </div>
    );
  }
  if (kind === "noise") {
    const e = effect as Noise;
    return (
      <div className="sp-effect-settings">
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
    <div className="sp-effect-settings">
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
  scope,
}: {
  /** Names the section (`data-section`), and resets what is open when it
   * changes. */
  id: string;
  effects: FieldEffect[] | undefined;
  target: EffectTarget;
  accentHex?: string;
  kit: BrandKit | null;
  companyId?: string;
  onChange(next: FieldEffect[]): void;
  /** Present when a look changes the effects. */
  onUseBase?(): void;
  /** Which list the section edits, in variation mode (All variations or
   * This variation), above the effects. */
  scope?: React.ReactNode;
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
        <span className="sp-insp-actions">
          {onUseBase && (
            <Button kind="ghost" size="sm" onClick={onUseBase}>
              Use base
            </Button>
          )}
          <Menu
            aria-label="Add an effect"
            align="end"
            trigger={<IconButton variant="ghost" size="sm" icon={Plus} label="Add an effect" />}
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
        </span>
      }
    >
      {scope}
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
            <div className="sp-effect-row">
              <button
                type="button"
                className="ui-reset ui-ring sp-effect-row__grip"
                draggable
                onDragStart={() => setDragFrom(index)}
                onDragEnd={() => setDragFrom(null)}
                onKeyDown={(e) => {
                  if (!e.altKey) return;
                  if (e.key === "ArrowUp") reorder(index, index - 1);
                  if (e.key === "ArrowDown") reorder(index, index + 1);
                }}
                aria-label={`Reorder ${name.toLowerCase()}`}
              >
                <GripVertical size={16} className="ui-icon" aria-hidden />
              </button>
              <button
                type="button"
                className="ui-reset ui-ring sp-effect-row__main"
                aria-expanded={isOpen}
                onClick={() => setOpenIndex(isOpen ? null : index)}
              >
                <span className="t-label-s">{name}</span>
                <span className="t-caption-m sp-effect-row__summary">{effectSummary(effect)}</span>
              </button>
              <IconButton
                variant="ghost"
                size="sm"
                icon={Minus}
                label={`Remove ${name.toLowerCase()}`}
                onClick={() => {
                  onChange(list.filter((_, i) => i !== index));
                  setOpenIndex(null);
                }}
              />
            </div>
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
