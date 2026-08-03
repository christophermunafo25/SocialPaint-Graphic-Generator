import React, { useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import type { BrandColor } from "@/lib/types";
import { useBrand } from "@/lib/brand/BrandContext";

interface ColorControlProps {
  value: string | undefined; // #RRGGBB
  onChange(hex: string): void;
  /** Show a clear affordance and allow returning to "no color". */
  onClear?: () => void;
  size?: number; // swatch px
  ariaLabel?: string;
  /** Quick-select row of the company's brand colors. On everywhere except the
   *  two screens where this control IS the palette editor. */
  brandSwatches?: boolean;
  /** Picking a swatch reports the palette entry rather than a raw hex, so the
   *  caller can bind by key and let a re-theme flow through. Without it, a
   *  swatch just sets its hex. */
  onPickBrandColor?(color: BrandColor): void;
  /** Palette key the value is currently bound to — drives the selected ring. */
  selectedColorKey?: string;
  /** Greys out the brand row only (locked brand rules still show the palette). */
  swatchesDisabled?: boolean;
}

const HEX_RE = /^#?([0-9a-fA-F]{6})$/;

/** The app-wide color control: a swatch that is OBVIOUSLY editable (hover
 * pencil + pointer + tooltip) paired with a visible, editable hex input, and
 * the brand palette underneath for one-click on-brand picks. The native color
 * picker opens from the swatch. Used everywhere a color is set — Brand Studio
 * palette, field colors, canvas background, gradient stops, onboarding. */
export function ColorControl({
  value,
  onChange,
  onClear,
  size = 32,
  ariaLabel,
  brandSwatches = true,
  onPickBrandColor,
  selectedColorKey,
  swatchesDisabled = false,
}: ColorControlProps) {
  const { kit } = useBrand();
  const palette = brandSwatches ? kit?.colors ?? [] : [];
  const [draft, setDraft] = useState(value ?? "");
  const [hover, setHover] = useState(false);
  const nativeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value ?? "");
  }, [value]);

  const commitDraft = () => {
    const m = HEX_RE.exec(draft.trim());
    if (m) onChange(`#${m[1].toUpperCase()}`);
    else setDraft(value ?? ""); // revert invalid input
  };

  return (
    <div className="inline-flex flex-col items-start gap-2">
      <div className="inline-flex items-center gap-2">
      <button
        type="button"
        title="Click to edit color"
        aria-label={ariaLabel ?? "Edit color"}
        onClick={() => nativeRef.current?.click()}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className="relative flex-shrink-0 cursor-pointer"
        style={{
          width: size,
          height: size,
          borderRadius: "var(--radius-control)",
          border: hover ? "2px solid var(--state-primary)" : "1px solid var(--border-strong)",
          background: value
            ? value
            : "repeating-conic-gradient(#e5e5e5 0% 25%, #ffffff 0% 50%) 0 0 / 10px 10px",
          transition: "border-color 0.15s",
        }}
      >
        {hover && (
          <span
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: "color-mix(in srgb, var(--text-on-accent) 35%, transparent)", borderRadius: "var(--radius-control)" }}
          >
            <Pencil style={{ width: Math.max(11, size * 0.38), height: Math.max(11, size * 0.38), color: "#fff" }} />
          </span>
        )}
        <input
          ref={nativeRef}
          type="color"
          value={value ?? "#888888"}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="absolute inset-0 opacity-0 cursor-pointer"
          tabIndex={-1}
          aria-hidden
        />
      </button>
      <input
        type="text"
        value={draft}
        placeholder="#RRGGBB"
        spellCheck={false}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitDraft}
        onKeyDown={(e) => e.key === "Enter" && commitDraft()}
        className="sp-input"
        style={{ width: 88, fontFamily: "var(--font-mono)", fontSize: "var(--type-caption-size)", padding: "5px 8px" }}
        aria-label={`${ariaLabel ?? "Color"} hex value`}
      />
      {onClear && value && (
        <button
          type="button"
          onClick={onClear}
          style={{ fontSize: 11, color: "var(--text-muted)" }}
          title="Remove color"
        >
          Clear
        </button>
      )}
      </div>

      {palette.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="sp-eyebrow" style={{ fontSize: 9 }}>Brand</span>
          {palette.map((c) => {
            const selected = selectedColorKey
              ? selectedColorKey === c.key
              : (value ?? "").toUpperCase() === c.hex.toUpperCase();
            return (
              <button
                key={c.key}
                type="button"
                title={`${c.name} — click to use`}
                aria-label={`Use brand color ${c.name}`}
                aria-pressed={selected}
                disabled={swatchesDisabled}
                onClick={() => (onPickBrandColor ? onPickBrandColor(c) : onChange(c.hex.toUpperCase()))}
                className="sp-swatch"
                data-selected={selected ? "true" : undefined}
                style={{ background: c.hex }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
