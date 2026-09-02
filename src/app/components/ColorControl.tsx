import React, { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import type { BrandColor } from "@/lib/types";
import { useBrand } from "@/lib/brand/BrandContext";

interface ColorControlProps {
  value: string | undefined; // #RRGGBB
  onChange(hex: string): void;
  /** Show a clear affordance and allow returning to "no color". */
  onClear?: () => void;
  size?: number; // swatch px — a square, the default everywhere
  /** Overrides the swatch box for the one place it is not a square: the
   *  onboarding palette tile (181 × 127 in the frame, fluid here). `size`
   *  stays the default and the other call sites never see this. */
  swatchStyle?: React.CSSProperties;
  /** Pencil glyph px. Defaults to scale with `size`; a swatch styled to a
   *  larger box passes its own so the glyph reads at that size. */
  pencilSize?: number;
  /** The inline hex field beside the swatch. Off where the caller renders
   *  the hex itself (the palette tile's label row). */
  hexField?: boolean;
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
 * palette, field colors, canvas background, gradient stops, onboarding.
 *
 * The pencil veil is always in the tree and fades on --dur-state — on hover,
 * on keyboard focus, and while the editor is open — so the affordance
 * appears on approach rather than snapping in. */
export function ColorControl({
  value,
  onChange,
  onClear,
  size = 32,
  swatchStyle,
  pencilSize,
  hexField = true,
  ariaLabel,
  brandSwatches = true,
  onPickBrandColor,
  selectedColorKey,
  swatchesDisabled = false,
}: ColorControlProps) {
  const { kit } = useBrand();
  const palette = brandSwatches ? (kit?.colors ?? []) : [];
  const [draft, setDraft] = useState(value ?? "");
  const nativeRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value ?? "");
  }, [value]);

  const commitDraft = () => {
    const m = HEX_RE.exec(draft.trim());
    if (m) onChange(`#${m[1].toUpperCase()}`);
    else setDraft(value ?? ""); // revert invalid input
  };

  const pencil = pencilSize ?? Math.max(12, Math.round(size * 0.38));

  return (
    <div className="sp-color-control inline-flex flex-col items-start gap-2">
      <div className="sp-color-control__row inline-flex items-center gap-2">
        <button
          type="button"
          title="Click to edit color"
          aria-label={ariaLabel ?? "Edit color"}
          onClick={() => nativeRef.current?.click()}
          className="sp-color-swatch"
          style={{
            width: size,
            height: size,
            ...swatchStyle,
            background: value
              ? value
              : "repeating-conic-gradient(#e5e5e5 0% 25%, #ffffff 0% 50%) 0 0 / 10px 10px",
          }}
        >
          <span className="sp-color-swatch__veil" aria-hidden>
            <Pencil style={{ width: pencil, height: pencil }} />
          </span>
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
        {hexField && (
          <input
            type="text"
            value={draft}
            placeholder="#RRGGBB"
            spellCheck={false}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitDraft}
            onKeyDown={(e) => e.key === "Enter" && commitDraft()}
            className="sp-input"
            style={{
              width: 88,
              fontFamily: "var(--font-mono)",
              fontSize: "var(--type-caption-size)",
              padding: "5px 8px",
            }}
            aria-label={`${ariaLabel ?? "Color"} hex value`}
          />
        )}
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
          <span className="sp-eyebrow" style={{ fontSize: 9 }}>
            Brand
          </span>
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
                onClick={() =>
                  onPickBrandColor ? onPickBrandColor(c) : onChange(c.hex.toUpperCase())
                }
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
