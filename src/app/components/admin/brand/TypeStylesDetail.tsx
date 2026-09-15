import React, { useEffect, useRef, useState } from "react";
import type { BrandTypeStyle } from "@/lib/types";
import { loadGoogleFonts } from "@/lib/render/fonts";
import { TypeStylesEditor } from "../TypeStylesEditor";
import { consumeAddFlow } from "./addFlow";
import { propagationNote, type BrandDraft, type useBrandBindings } from "./kitPlumbing";
import { AddSlot } from "./primitives/AddSlot";
import { RowMenu, type RowMenuGroup, type RowMenuHandle } from "./primitives/RowMenu";

type Bindings = ReturnType<typeof useBrandBindings>;

/** One editable value in the row: which property, its display, and its
 * arrow-key step. */
type ValueField = "size" | "lineHeight" | "tracking";

const VALUE_ORDER: readonly ValueField[] = ["size", "lineHeight", "tracking"];

const slugKey = (name: string, taken: BrandTypeStyle[]): string => {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "style";
  let key = base;
  let n = 2;
  while (taken.some((s) => s.key === key)) key = `${base}_${n++}`;
  return key;
};

/** The Type styles page: one full-width card of style rows — a rendered
 * specimen, the face line, and the three values edited in place — with the
 * full rules editor one menu action away. */
export function TypeStylesDetail({ brand, bindings }: { brand: BrandDraft; bindings: Bindings }) {
  const styles = brand.draft.typeStyles;
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  // Specimens render in their own faces — make sure they are loaded.
  useEffect(() => {
    const families = styles
      .map((s) => s.font)
      .filter((f): f is NonNullable<typeof f> => f?.source === "google")
      .map((f) => f.family);
    if (families.length) loadGoogleFonts(families);
  }, [styles]);

  /** Every change reports its blast radius, exactly as the accordion did. */
  const onChange = (next: BrandTypeStyle[]) => {
    const touched = styles
      .filter((prev) => {
        const after = next.find((s) => s.key === prev.key);
        return !after || JSON.stringify(after) !== JSON.stringify(prev);
      })
      .map((prev) => bindings.styleUse.get(prev.key));
    brand.commit(
      { typeStyles: next },
      {
        message: propagationNote(touched) ?? "Type styles updated",
        coalesceKey: "typeStyles",
      },
    );
  };

  const focusNameInput = () => {
    requestAnimationFrame(() => {
      document
        .querySelector<HTMLInputElement>('.sp-style-expand input[aria-label="Name"]')
        ?.focus();
    });
  };

  const addStyle = () => {
    const name = "New style";
    const key = slugKey(name, brand.draft.typeStyles);
    onChange([...brand.draft.typeStyles, { key, name }]);
    setExpandedKey(key);
    focusNameInput();
  };

  const addRef = useRef(addStyle);
  addRef.current = addStyle;
  useEffect(() => {
    if (consumeAddFlow("type-styles")) addRef.current();
  }, []);

  return (
    <section className="sp-card sp-list-card">
      {styles.map((s) => (
        <StyleRow
          key={s.key}
          style={s}
          styles={styles}
          onChange={onChange}
          expanded={expandedKey === s.key}
          setExpanded={(open) => setExpandedKey(open ? s.key : null)}
          brand={brand}
        />
      ))}
      <AddSlot
        label="Add style"
        onClick={addStyle}
        style={{ minHeight: 56, marginTop: "var(--space-2xs)" }}
      />
    </section>
  );
}

function StyleRow({
  style: s,
  styles,
  onChange,
  expanded,
  setExpanded,
  brand,
}: {
  style: BrandTypeStyle;
  styles: BrandTypeStyle[];
  onChange(next: BrandTypeStyle[]): void;
  expanded: boolean;
  setExpanded(open: boolean): void;
  brand: BrandDraft;
}) {
  const menuRef = useRef<RowMenuHandle>(null);
  const [renaming, setRenaming] = useState(false);
  const [editingValue, setEditingValue] = useState<ValueField | null>(null);
  const fontAssets = brand.assets.filter((a) => a.kind === "font");

  const update = (patch: Partial<BrandTypeStyle>) =>
    onChange(styles.map((x) => (x.key === s.key ? { ...x, ...patch } : x)));

  const duplicate = () => {
    const name = `${s.name} copy`;
    const key = slugKey(name, styles);
    onChange([...styles, { ...s, key, name }]);
  };

  const remove = () => onChange(styles.filter((x) => x.key !== s.key));

  const groups: RowMenuGroup[] = [
    {
      items: [
        { label: "Rename", onSelect: () => setRenaming(true) },
        { label: "Duplicate", onSelect: duplicate },
        { label: "Edit all properties", onSelect: () => setExpanded(!expanded) },
      ],
    },
    { items: [{ label: "Remove", destructive: true, onSelect: remove }] },
  ];

  const specimenStyle: React.CSSProperties = {
    fontFamily: s.font ? `"${s.font.family}", sans-serif` : undefined,
    fontWeight: s.weight,
    fontStyle: s.fontStyle,
    fontStretch: s.fontStretch,
    textTransform: s.uppercase ? "uppercase" : undefined,
    fontSize: Math.min(s.fontSizePx ?? 32, 40),
    lineHeight: 1.1,
  };

  const valueFor = (field: ValueField): number | undefined =>
    field === "size" ? s.fontSizePx : field === "lineHeight" ? s.lineHeight : s.letterSpacingPx;

  const displayFor = (field: ValueField): string => {
    const v = valueFor(field);
    if (v === undefined) return "Auto";
    return field === "tracking" ? `${v}px` : `${v}`;
  };

  const saveValue = (field: ValueField, raw: string) => {
    const trimmed = raw.trim().replace(/px$/i, "");
    const parsed = trimmed === "" ? undefined : Number(trimmed);
    if (parsed !== undefined && Number.isNaN(parsed)) return;
    if (field === "size") update({ fontSizePx: parsed });
    else if (field === "lineHeight") update({ lineHeight: parsed });
    else update({ letterSpacingPx: parsed });
  };

  return (
    <>
      <div
        className="sp-style-row sp-menu-row"
        onContextMenu={(e) => {
          e.preventDefault();
          menuRef.current?.openAt(e.clientX, e.clientY);
        }}
      >
        {renaming ? (
          <input
            className="sp-input sp-style-row__spec"
            style={{ ...specimenStyle, height: "auto", padding: "0 var(--space-3xs)" }}
            aria-label={`Rename ${s.name}`}
            defaultValue={s.name}
            autoFocus
            onFocus={(e) => e.target.select()}
            onBlur={(e) => {
              const next = e.target.value.trim();
              if (next && next !== s.name) update({ name: next });
              setRenaming(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              else if (e.key === "Escape") {
                e.currentTarget.value = s.name;
                setRenaming(false);
              }
            }}
          />
        ) : (
          <span className="sp-style-row__spec" style={specimenStyle}>
            {s.name}
          </span>
        )}
        <span className="sp-style-row__face">
          {s.font?.family ?? "Any face"}
          {s.weight ? ` · ${s.weight}` : ""}
        </span>
        <span className="sp-style-row__values">
          {VALUE_ORDER.map((field, i) => (
            <React.Fragment key={field}>
              {i > 0 && <span aria-hidden>/</span>}
              {editingValue === field ? (
                <ValueInput
                  field={field}
                  initial={valueFor(field)}
                  onSave={(raw, moveNext) => {
                    saveValue(field, raw);
                    setEditingValue(moveNext ? (VALUE_ORDER[i + 1] ?? null) : null);
                  }}
                  onCancel={() => setEditingValue(null)}
                />
              ) : (
                <button
                  type="button"
                  className="sp-style-row__value"
                  data-auto={valueFor(field) === undefined || undefined}
                  aria-label={`${s.name} ${
                    field === "size" ? "size" : field === "lineHeight" ? "line height" : "tracking"
                  }`}
                  onClick={() => setEditingValue(field)}
                >
                  {displayFor(field)}
                </button>
              )}
            </React.Fragment>
          ))}
        </span>
        <RowMenu ref={menuRef} groups={groups} ariaLabel={`More actions for ${s.name}`} />
      </div>
      {expanded && (
        <div className="sp-style-expand" style={{ paddingBottom: "var(--space-sm)" }}>
          <TypeStylesEditor
            styles={[s]}
            colors={brand.draft.colors}
            customFamilies={fontAssets.map((a) => a.metadata.family ?? a.name)}
            onChange={(next) => {
              const replacement = next.find((x) => x.key === s.key);
              onChange(
                replacement
                  ? styles.map((x) => (x.key === s.key ? replacement : x))
                  : styles.filter((x) => x.key !== s.key),
              );
              if (!replacement) setExpanded(false);
            }}
          />
        </div>
      )}
    </>
  );
}

/** The 26px in-place numeric input: arrows step (size 1, line height 0.05,
 * tracking 0.5 — Shift multiplies by 10), Enter or Tab saves and moves on,
 * Esc reverts. */
function ValueInput({
  field,
  initial,
  onSave,
  onCancel,
}: {
  field: ValueField;
  initial: number | undefined;
  onSave(raw: string, moveNext: boolean): void;
  onCancel(): void;
}) {
  const [raw, setRaw] = useState(initial === undefined ? "" : String(initial));
  const step = field === "size" ? 1 : field === "lineHeight" ? 0.05 : 0.5;
  const decimals = field === "size" ? 0 : 2;

  return (
    <input
      className="sp-input sp-style-value-input"
      aria-label={`Edit ${field === "size" ? "size" : field === "lineHeight" ? "line height" : "tracking"}`}
      inputMode="decimal"
      autoFocus
      value={raw}
      onFocus={(e) => e.target.select()}
      onChange={(e) => setRaw(e.target.value)}
      onBlur={() => onSave(raw, false)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onSave(raw, true);
        } else if (e.key === "Tab") {
          e.preventDefault();
          onSave(raw, true);
        } else if (e.key === "Escape") {
          e.stopPropagation();
          onCancel();
        } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          const current = Number(raw.replace(/px$/i, "")) || 0;
          const delta = (e.key === "ArrowUp" ? 1 : -1) * step * (e.shiftKey ? 10 : 1);
          setRaw(
            (current + delta)
              .toFixed(decimals)
              .replace(/\.00$/, "")
              .replace(/(\.\d)0$/, "$1"),
          );
        }
      }}
    />
  );
}
