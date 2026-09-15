import React, { useEffect, useRef, useState } from "react";
import type { BrandColor } from "@/lib/types";
import { DEFAULT_PALETTE } from "@/lib/theme";
import { parseColorInput } from "@/lib/color";
import { consumeAddFlow } from "./addFlow";
import { CONTRAST_PASS, contrastReadout } from "./contrast";
import { assignColorRole, newCustomColor, type ColorRole } from "./kitOps";
import { propagationNote, type BrandDraft, type useBrandBindings } from "./kitPlumbing";
import { AddSlot } from "./primitives/AddSlot";
import { EditOverlay } from "./primitives/EditOverlay";
import { Tag } from "./primitives/Tag";
import { TagChoice } from "./primitives/TagChoice";
import { useInPlaceEdit, type InPlaceEdit } from "./primitives/useInPlaceEdit";

const ROLES: readonly ColorRole[] = ["primary", "secondary", "accent"];
const ROLE_LABELS: Record<ColorRole, string> = {
  primary: "Primary",
  secondary: "Secondary",
  accent: "Accent",
};

/** Keeps an add-slot alone in the last row from collapsing below the
 * resting cards beside it: 8 + 88 + 8 + 17 + 12 of card geometry. */
const CARD_MIN_HEIGHT = 133;

type Bindings = ReturnType<typeof useBrandBindings>;

/** The Colors page: the palette as a grid of swatch cards, each edited in
 * place through its overlay (D8), roles moving between colors (D11), and
 * the roles summary underneath. */
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

  return (
    <>
      <div className="sp-colors-grid">
        {colors.map((c) =>
          c.key === edit.editingId ? (
            <ColorEditingCard
              key={c.key}
              color={c}
              colors={colors}
              edit={edit}
              setColors={setColors}
              noteFor={noteFor}
            />
          ) : (
            <button
              key={c.key}
              type="button"
              className="sp-card sp-color-card sp-has-overlay"
              aria-label={`Edit ${c.name}`}
              data-edit-item={c.key}
              onClick={() => edit.start(c.key)}
            >
              <span
                className="sp-color-card__block"
                style={{ "--swatch": c.hex } as React.CSSProperties}
              >
                {c.role && (
                  <span className="sp-color-card__role">
                    <Tag onMedia>{ROLE_LABELS[c.role]}</Tag>
                  </span>
                )}
                <EditOverlay />
              </span>
              <span className="sp-color-card__row">
                <span className="sp-color-card__name">{c.name}</span>
                <span className="sp-eyebrow">{c.hex}</span>
              </span>
            </button>
          ),
        )}
        <AddSlot
          label="Add color"
          onClick={addColor}
          style={{ minHeight: CARD_MIN_HEIGHT, alignSelf: "stretch" }}
        />
      </div>

      <RolesSummary colors={colors} />
    </>
  );
}

function RolesSummary({ colors }: { colors: BrandColor[] }) {
  const held = ROLES.map((role) => ({
    role,
    color: colors.find((c) => c.role === role),
  })).filter((h): h is { role: ColorRole; color: BrandColor } => !!h.color);
  if (!held.length) return null;
  return (
    <div className="sp-roles-summary">
      {held.map(({ role, color }) => (
        <span key={role} className="sp-roles-summary__item">
          <span className="sp-eyebrow">{ROLE_LABELS[role]}</span>
          <span
            style={{
              fontFamily: "var(--font-ui)",
              fontWeight: "var(--weight-ui)" as React.CSSProperties["fontWeight"],
              fontSize: "var(--type-label-size)",
              color: "var(--text-primary)",
            }}
          >
            {color.name}
          </span>
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

function ColorEditingCard({ color, colors, edit, setColors, noteFor }: EditingProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const valueRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);
  /** The name editing opened on — an empty name on exit restores it. */
  const openedName = useRef(color.name);

  const [valueText, setValueText] = useState(color.hex);
  const [valueError, setValueError] = useState<string | null>(null);

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

  // Focus the name with its text selected on open.
  useEffect(() => {
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
    // A pending value-field edit commits as the card closes: the
    // outside-click listener fires on POINTERDOWN, which precedes the
    // field's blur, so without this a typed hex silently vanished with
    // the editor (2026-09-15). Invalid text is discarded — the refusal
    // has nowhere to show once the card is gone — and an unchanged value
    // is a no-op. Empty name on exit restores the one editing opened
    // with; both land in ONE write so neither can clobber the other.
    const parsed = parseColorInput(valueTextRef.current);
    const hex = current && parsed && parsed !== current.hex ? parsed : null;
    const name = current && !current.name.trim() ? openedName.current : null;
    if (hex || name) {
      setColorsRef.current(
        latest.map((c) =>
          c.key === color.key
            ? { ...c, ...(hex ? { hex } : {}), ...(name ? { name } : {}) }
            : c,
        ),
        hex ? noteForRef.current(color.key, `${current?.name ?? color.name} recolored`) : undefined,
        hex ? `hex:${color.key}` : undefined,
      );
    }
    edit.done();
  }, [color.key, edit]);

  // Clicking outside finishes, the way a rename does elsewhere.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
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
      className="sp-card sp-color-editing"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          edit.cancel();
        }
      }}
    >
      <button
        type="button"
        className="sp-color-card__block"
        style={{ "--swatch": color.hex } as React.CSSProperties}
        aria-label={`Pick ${color.name} with the color picker`}
        onClick={() => pickerRef.current?.click()}
      >
        {color.role && (
          <span className="sp-color-card__role">
            <Tag onMedia>{ROLE_LABELS[color.role]}</Tag>
          </span>
        )}
      </button>
      <input
        ref={pickerRef}
        type="color"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        value={color.hex}
        onChange={(e) =>
          patch(
            { hex: e.target.value.toUpperCase() },
            noteFor(color.key, `${color.name} recolored`),
            `hex:${color.key}`,
          )
        }
      />

      <input
        ref={nameRef}
        className="sp-input sp-input--mini"
        aria-label="Color name"
        value={color.name}
        onChange={(e) => patch({ name: e.target.value }, undefined, `name:${color.key}`)}
        onKeyDown={(e) => e.key === "Enter" && finish()}
      />
      <input
        ref={valueRef}
        className="sp-input sp-input--mini"
        aria-label="Color value"
        spellCheck={false}
        value={valueText}
        onChange={(e) => {
          setValueText(e.target.value);
          // Errors never appear per keystroke — but a shown one clears the
          // moment the value turns valid.
          if (valueError && parseColorInput(e.target.value)) setValueError(null);
        }}
        onBlur={commitValueField}
        onKeyDown={(e) => {
          if (e.key === "Enter" && commitValueField()) finish();
        }}
      />
      {valueError && (
        <p style={{ fontSize: "var(--type-caption-size)", color: "var(--state-danger)" }}>
          {valueError}
        </p>
      )}

      {readout && (
        <div>
          <p className="sp-contrast-line">
            Ink {readout.ink}:1 {readout.ink >= CONTRAST_PASS ? "passes" : "fails"}
          </p>
          <p className="sp-contrast-line">
            White {readout.white}:1 {readout.white >= CONTRAST_PASS ? "passes" : "fails"}
          </p>
        </div>
      )}

      <span className="sp-eyebrow">Role</span>
      <div
        role="radiogroup"
        aria-label={`Role for ${color.name}`}
        className="flex flex-wrap"
        style={{ gap: "var(--space-2xs)" }}
      >
        <TagChoice role="radio" checked={!color.role} onChange={() => setRole(null)}>
          None
        </TagChoice>
        {ROLES.map((role) => (
          <TagChoice
            key={role}
            role="radio"
            checked={color.role === role}
            onChange={() => setRole(role)}
          >
            {ROLE_LABELS[role]}
          </TagChoice>
        ))}
      </div>

      <div className="flex items-center justify-between" style={{ marginTop: "var(--space-3xs)" }}>
        {!isDefault ? (
          <button
            type="button"
            className="sp-btn sp-btn-tertiary"
            style={{ height: 28, padding: "0 10px", fontSize: "var(--type-caption-size)" }}
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
        <button
          type="button"
          className="sp-btn sp-btn-ghost"
          style={{ height: 28, padding: "0 10px", fontSize: "var(--type-caption-size)" }}
          onClick={finish}
        >
          Done
        </button>
      </div>
    </div>
  );
}
