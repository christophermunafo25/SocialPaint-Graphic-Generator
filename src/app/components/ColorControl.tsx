import React, { useEffect, useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { HexColorPicker } from "react-colorful";
import { AnimatePresence, motion } from "motion/react";
import { Pencil } from "lucide-react";
import type { BrandColor } from "@/lib/types";
import { useBrand } from "@/lib/brand/BrandContext";
import { useMotionTokens } from "@/lib/motionTokens";

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
  /** Open the editor on mount — a freshly added palette entry asks for its
   *  colour straight away rather than showing a grey square. */
  defaultOpen?: boolean;
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
 * the brand palette underneath for one-click on-brand picks. Used everywhere
 * a color is set — Brand Studio palette, field colors, canvas background,
 * gradient stops, onboarding.
 *
 * The editor is an in-app popover, never the operating system's colour
 * panel (2026-09-02, at Chris's direction — the native <input type="color">
 * threw up the full macOS picker). It anchors to the swatch, flips above
 * when there is no room below, and becomes a bottom sheet under --bp-lg.
 * The swatch updates live behind it as the user drags. Enter commits and
 * closes; click-outside closes and keeps the live value; Escape closes and
 * puts back the colour the editor opened on. Focus moves into the picker
 * on open and returns to the swatch on close; the picker's areas take the
 * arrow keys, so a colour can be chosen without a mouse. Everywhere, since
 * every call site is the same swatch-and-hex pair and survives it.
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
  defaultOpen = false,
  ariaLabel,
  brandSwatches = true,
  onPickBrandColor,
  selectedColorKey,
  swatchesDisabled = false,
}: ColorControlProps) {
  const { kit } = useBrand();
  const palette = brandSwatches ? (kit?.colors ?? []) : [];
  const [draft, setDraft] = useState(value ?? "");
  const [open, setOpen] = useState(defaultOpen);
  const openedOn = useRef<string | undefined>(defaultOpen ? value : undefined);
  const m = useMotionTokens();

  useEffect(() => {
    setDraft(value ?? "");
  }, [value]);

  const commitDraft = () => {
    const match = HEX_RE.exec(draft.trim());
    if (match) onChange(`#${match[1].toUpperCase()}`);
    else setDraft(value ?? ""); // revert invalid input
  };

  const setOpenState = (next: boolean) => {
    if (next) openedOn.current = value;
    setOpen(next);
  };
  const revert = () => {
    if (openedOn.current !== undefined && openedOn.current !== value) onChange(openedOn.current);
  };

  const pencil = pencilSize ?? Math.max(12, Math.round(size * 0.38));
  const label = ariaLabel ?? "Color";

  const hexInput = (
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
      aria-label={`${label} hex value`}
    />
  );

  return (
    <div className="sp-color-control inline-flex flex-col items-start gap-2">
      <div className="sp-color-control__row inline-flex items-center gap-2">
        <Popover.Root open={open} onOpenChange={setOpenState}>
          <Popover.Trigger asChild>
            <button
              type="button"
              title="Click to edit color"
              aria-label={ariaLabel ?? "Edit color"}
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
            </button>
          </Popover.Trigger>
          <AnimatePresence>
            {open && (
              <Popover.Portal forceMount>
                <Popover.Content
                  forceMount
                  asChild
                  side="bottom"
                  align="start"
                  sideOffset={8}
                  collisionPadding={16}
                  aria-label={`${label} editor`}
                  onEscapeKeyDown={revert}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      setOpenState(false);
                    }
                  }}
                >
                  <motion.div
                    className="sp-color-pop"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: m.state, ease: m.ease }}
                  >
                    <HexColorPicker
                      color={value ?? "#888888"}
                      onChange={(hex) => onChange(hex.toUpperCase())}
                    />
                    <div className="sp-color-pop__row">
                      <span
                        className="sp-color-pop__chip"
                        aria-hidden
                        style={{ background: value ?? "transparent" }}
                      />
                      {hexInput}
                    </div>
                  </motion.div>
                </Popover.Content>
              </Popover.Portal>
            )}
          </AnimatePresence>
        </Popover.Root>
        {hexField && hexInput}
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
