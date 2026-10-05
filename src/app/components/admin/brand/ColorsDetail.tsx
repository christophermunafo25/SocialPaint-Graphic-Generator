import React, { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { BrandColor } from "@/lib/types";
import { DEFAULT_PALETTE } from "@/lib/theme";
import { parseColorInput } from "@/lib/color";
import { consumeAddFlow } from "./addFlow";
import { CONTRAST_PASS, contrastReadout } from "./contrast";
import { assignColorRole, newCustomColor, type ColorRole } from "./kitOps";
import { propagationNote, type BrandDraft, type useBrandBindings } from "./kitPlumbing";
import { ColorControl } from "../../ColorControl";
import { Button, ChoiceChip, Input, PreviewOverlay, Tag } from "../../primitives";
import { AddSlot } from "./primitives/AddSlot";
import { useInPlaceEdit, type InPlaceEdit } from "./primitives/useInPlaceEdit";

const ROLES: readonly ColorRole[] = ["primary", "secondary", "accent"];
const ROLE_LABELS: Record<ColorRole, string> = {
  primary: "Primary",
  secondary: "Secondary",
  accent: "Accent",
};

type Bindings = ReturnType<typeof useBrandBindings>;

/** The Colors page (13:9309): the palette as six columns of swatch cards,
 * each a button with the edit overlay (PHASE-6 §9 D8), then the roles
 * summary. Opening a card rings it and floats its editor 10 below it
 * (13:9470), with the rest of the grid and the summary blurred; a click on
 * a blurred card only closes the editor. Every change autosaves, and Done
 * closes (§9 D2). */
export function ColorsDetail({ brand, bindings }: { brand: BrandDraft; bindings: Bindings }) {
  const colors = brand.draft.colors;
  const edit = useInPlaceEdit(brand);

  const setColors = (next: BrandColor[], message?: string, coalesceKey?: string) =>
    brand.commit({ colors: next }, { message, coalesceKey });

  /** "Restyled 14 fields in 6 templates" when the color is bound, else the
   * plain line. */
  const noteFor = (key: string, fallback: string) =>
    propagationNote([bindings.colorUse.get(key)]) ?? fallback;

  const addColor = () => {
    const fresh = newCustomColor(brand.draft.colors);
    brand.commit({ colors: [...brand.draft.colors, fresh] }, { message: `Added “${fresh.name}”` });
    edit.start(fresh.key);
  };

  // The setup strip's "Add color" lands here mid-navigation.
  const addColorRef = useRef(addColor);
  addColorRef.current = addColor;
  useEffect(() => {
    if (consumeAddFlow("colors")) addColorRef.current();
  }, []);

  const editing = edit.editingId !== null;
  return (
    <div className="sp-bs-colors-page" data-editing={editing || undefined}>
      <div className="sp-bs-colors">
        {colors.map((c) => {
          const open = c.key === edit.editingId;
          return (
            <div key={c.key} className="sp-bs-color-cell" data-open={open || undefined}>
              <button
                type="button"
                className="ui-reset ui-ring sp-bs-color"
                aria-label={`Edit ${c.name}`}
                aria-expanded={open}
                data-edit-item={c.key}
                onClick={() => (open ? edit.done() : edit.start(c.key))}
              >
                <PreviewOverlay decorative className="sp-bs-color__swatch">
                  <span
                    className="sp-bs-color__fill"
                    style={{ "--swatch": c.hex } as React.CSSProperties}
                  />
                  {c.role && (
                    <Tag kind="overlay" className="sp-bs-color__role">
                      {ROLE_LABELS[c.role]}
                    </Tag>
                  )}
                </PreviewOverlay>
                <span className="sp-bs-color__meta">
                  <span className="t-label-l sp-bs-color__name">{c.name}</span>
                  <span className="t-label-xs sp-bs-color__hex">{c.hex}</span>
                </span>
              </button>
              {open && (
                <ColorPopover
                  color={c}
                  colors={colors}
                  edit={edit}
                  setColors={setColors}
                  noteFor={noteFor}
                />
              )}
            </div>
          );
        })}
        <AddSlot label="Add color" onClick={addColor} style={{ alignSelf: "stretch" }} />
      </div>

      <RolesSummary colors={colors} />
    </div>
  );
}

/** Who holds each role, under the grid (13:9457); hidden when nobody does. */
function RolesSummary({ colors }: { colors: BrandColor[] }) {
  const held = ROLES.map((role) => ({
    role,
    color: colors.find((c) => c.role === role),
  })).filter((h): h is { role: ColorRole; color: BrandColor } => !!h.color);
  if (!held.length) return null;
  return (
    <div className="sp-bs-roles">
      {held.map(({ role, color }) => (
        <span key={role} className="sp-bs-roles__item">
          <span className="t-body-xs sp-bs-roles__role">{ROLE_LABELS[role]}</span>
          <span className="t-button-m">{color.name}</span>
        </span>
      ))}
    </div>
  );
}

interface EditingProps {
  color: BrandColor;
  colors: BrandColor[];
  edit: InPlaceEdit;
  setColors(next: BrandColor[], message?: string, coalesceKey?: string): void;
  noteFor(key: string, fallback: string): string;
}

/** Inside a portaled layer the popover opened (the color picker). */
const inPortaledLayer = (target: EventTarget | null) =>
  target instanceof Element && !!target.closest("[data-radix-popper-content-wrapper]");

/** The color's editor (13:9633): Name, the picker's swatch beside the hex,
 * the contrast lines, Role, then Remove and Done. 300 wide, 10 under the
 * card, left-aligned to it; right-aligned where that would leave the grid,
 * and above the card where the window has no room below. Enter in a field
 * finishes, Escape cancels (the edit's undo steps go with it), and a click
 * outside finishes. */
function ColorPopover({ color, colors, edit, setColors, noteFor }: EditingProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const valueRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  /** The name editing opened on — an empty name on exit restores it. */
  const openedName = useRef(color.name);

  const [valueText, setValueText] = useState(color.hex);
  const [valueError, setValueError] = useState<string | null>(null);
  const [place, setPlace] = useState<{ end: boolean; above: boolean }>({
    end: false,
    above: false,
  });

  // The outside-click listener must see the LATEST palette and value text
  // when it finishes the edit, not the render it was registered on.
  const colorsRef = useRef(colors);
  colorsRef.current = colors;
  const setColorsRef = useRef(setColors);
  setColorsRef.current = setColors;
  const valueTextRef = useRef(valueText);
  valueTextRef.current = valueText;
  const noteForRef = useRef(noteFor);
  noteForRef.current = noteFor;

  // Place the popover inside the grid and the window, then focus the name
  // with its text selected.
  useLayoutEffect(() => {
    const el = rootRef.current;
    const grid = el?.closest(".sp-bs-colors");
    const cell = el?.parentElement;
    if (el && grid && cell) {
      const g = grid.getBoundingClientRect();
      const c = cell.getBoundingClientRect();
      const room = window.innerHeight - c.bottom;
      setPlace({
        end: c.left + el.offsetWidth > g.right,
        above: room < el.offsetHeight + 20 && c.top > el.offsetHeight + 20,
      });
    }
    nameRef.current?.focus();
    nameRef.current?.select();
  }, []);

  // The picker (or an undo) moved the hex under us — mirror it into the
  // value field unless the user is mid-edit there.
  useEffect(() => {
    if (document.activeElement !== valueRef.current) setValueText(color.hex);
  }, [color.hex]);

  const patch = (p: Partial<BrandColor>, message?: string, coalesceKey?: string) =>
    setColors(
      colors.map((c) => (c.key === color.key ? { ...c, ...p } : c)),
      message,
      coalesceKey,
    );

  const commitValueField = (): boolean => {
    const parsed = parseColorInput(valueText);
    if (!parsed) {
      setValueError("Use a hex like #17FF7E or rgb(23, 255, 126)");
      return false;
    }
    setValueError(null);
    setValueText(parsed);
    if (parsed !== color.hex) {
      patch({ hex: parsed }, noteFor(color.key, `${color.name} recolored`), `hex:${color.key}`);
    }
    return true;
  };

  const finish = React.useCallback(() => {
    const latest = colorsRef.current;
    const current = latest.find((c) => c.key === color.key);
    // A pending value-field edit commits as the popover closes: the
    // outside-click listener fires on POINTERDOWN, which precedes the
    // field's blur. Invalid text is discarded (the refusal has nowhere to
    // show once the popover is gone), and an unchanged value is a no-op.
    // An empty name on exit restores the one editing opened with; both
    // land in ONE write so neither can clobber the other.
    const parsed = parseColorInput(valueTextRef.current);
    const hex = current && parsed && parsed !== current.hex ? parsed : null;
    const name = current && !current.name.trim() ? openedName.current : null;
    if (hex || name) {
      setColorsRef.current(
        latest.map((c) =>
          c.key === color.key ? { ...c, ...(hex ? { hex } : {}), ...(name ? { name } : {}) } : c,
        ),
        hex ? noteForRef.current(color.key, `${current?.name ?? color.name} recolored`) : undefined,
        hex ? `hex:${color.key}` : undefined,
      );
    }
    edit.done();
  }, [color.key, color.name, edit]);

  // A click outside the card and its popover finishes. A click on the open
  // card itself is the card's own (it closes); the picker's layer is ours.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const cell = rootRef.current?.parentElement;
      if (cell?.contains(e.target as Node) || inPortaledLayer(e.target)) return;
      finish();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [finish]);

  const readout = contrastReadout(color.hex);
  const isDefault = DEFAULT_PALETTE.some((d) => d.key === color.key);

  const setRole = (role: ColorRole | null) => {
    const previous = role ? colors.find((c) => c.role === role && c.key !== color.key) : null;
    const message = !role
      ? `Role cleared from ${color.name}`
      : previous
        ? `${ROLE_LABELS[role]} moved to ${color.name}`
        : `${ROLE_LABELS[role]} set to ${color.name}`;
    setColors(assignColorRole(colors, color.key, role), message);
  };

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label={`Edit ${color.name}`}
      className="sp-bs-popover sp-bs-color-popover"
      data-end={place.end || undefined}
      data-above={place.above || undefined}
      onKeyDown={(e) => {
        if (e.key !== "Escape") return;
        // The picker's own Escape is the picker's.
        if (!rootRef.current?.contains(e.target as Node)) return;
        e.stopPropagation();
        edit.cancel();
      }}
    >
      <Input
        ref={nameRef}
        size="sm"
        aria-label="Color name"
        value={color.name}
        onChange={(e) => patch({ name: e.target.value }, undefined, `name:${color.key}`)}
        onKeyDown={(e) => e.key === "Enter" && finish()}
      />
      <div className="sp-bs-color-popover__value">
        <ColorControl
          value={color.hex}
          size={32}
          hexField={false}
          brandSwatches={false}
          ariaLabel={`Pick ${color.name}`}
          onChange={(hex) =>
            patch(
              { hex: hex.toUpperCase() },
              noteFor(color.key, `${color.name} recolored`),
              `hex:${color.key}`,
            )
          }
        />
        <Input
          ref={valueRef}
          size="sm"
          aria-label="Color value"
          aria-invalid={valueError ? true : undefined}
          spellCheck={false}
          value={valueText}
          onChange={(e) => {
            setValueText(e.target.value);
            // Errors never appear per keystroke, but a shown one clears the
            // moment the value turns valid.
            if (valueError && parseColorInput(e.target.value)) setValueError(null);
          }}
          onBlur={commitValueField}
          onKeyDown={(e) => {
            if (e.key === "Enter" && commitValueField()) finish();
          }}
        />
      </div>
      {valueError && (
        <p className="t-caption-s sp-bs-error-line" role="alert">
          {valueError}
        </p>
      )}

      {readout && (
        <div className="sp-bs-color-popover__contrast">
          <p className="t-caption-s">
            Ink {readout.ink}:1 {readout.ink >= CONTRAST_PASS ? "passes" : "fails"}
          </p>
          <p className="t-caption-s">
            White {readout.white}:1 {readout.white >= CONTRAST_PASS ? "passes" : "fails"}
          </p>
        </div>
      )}

      <div className="sp-bs-color-popover__role">
        <span id={titleId} className="t-label-xs sp-bs-color-popover__label">
          Role
        </span>
        <div role="group" aria-labelledby={titleId} className="sp-bs-chips">
          <ChoiceChip selected={!color.role} onClick={() => setRole(null)}>
            None
          </ChoiceChip>
          {ROLES.map((role) => (
            <ChoiceChip key={role} selected={color.role === role} onClick={() => setRole(role)}>
              {ROLE_LABELS[role]}
            </ChoiceChip>
          ))}
        </div>
      </div>

      <div className="sp-bs-popover__foot">
        {!isDefault ? (
          <button
            type="button"
            className="ui-reset ui-ring t-label-xs sp-bs-quiet-action"
            onClick={() => {
              setColors(
                colors.filter((c) => c.key !== color.key),
                noteFor(color.key, `Removed “${color.name}”`),
              );
              edit.done();
            }}
          >
            Remove
          </button>
        ) : (
          <span />
        )}
        <Button kind="primary" size="sm" onClick={finish}>
          Done
        </Button>
      </div>
    </div>
  );
}
