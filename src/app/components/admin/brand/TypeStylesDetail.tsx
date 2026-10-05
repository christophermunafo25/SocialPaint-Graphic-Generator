import React, { useEffect, useId, useRef, useState } from "react";
import { Lock } from "lucide-react";
import type { BrandTypeStyle, FontRef } from "@/lib/types";
import { GOOGLE_FONTS, loadGoogleFonts } from "@/lib/render/fonts";
import {
  STRETCH_ORDER,
  familyStyles,
  parseStyleKey,
  styleKey,
  toFontStyle,
  type FontStyle,
} from "@/lib/render/fontCatalog";
import { ruleSentences } from "@/lib/brand/resolveStyle";
import { assignFontRole, type FontRole } from "@/lib/brand/fontRoles";
import {
  Button,
  ChoiceChip,
  Field,
  Input,
  RowContextMenu,
  RowMenu,
  Select,
  Tag,
  type RowMenuGroup,
} from "../../primitives";
import { consumeAddFlow } from "./addFlow";
import {
  propagationNote,
  type BindingUsage,
  type BrandDraft,
  type useBrandBindings,
} from "./kitPlumbing";
import { AddSlot } from "./primitives/AddSlot";

type Bindings = ReturnType<typeof useBrandBindings>;

/** One editable value in the row, and its arrow-key step. */
type ValueField = "size" | "lineHeight" | "tracking";

const VALUE_ORDER: readonly ValueField[] = ["size", "lineHeight", "tracking"];
const VALUE_NAME: Record<ValueField, string> = {
  size: "size",
  lineHeight: "line height",
  tracking: "tracking",
};

const ROLE_LABELS: Record<FontRole, string> = { heading: "Heading", body: "Body" };

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

/** Where a style is used, and the refusal when it can't be removed (PHASE-6
 * §9 D6: template fields bound to a missing style were left dangling). */
const inUseRefusal = (name: string, usage: BindingUsage) => {
  const names = usage.templateNames;
  const shown = names.slice(0, 3).join(", ") + (names.length > 3 ? ", …" : "");
  return `“${name}” is used by ${usage.fields} ${usage.fields === 1 ? "field" : "fields"} in ${names.length} ${names.length === 1 ? "template" : "templates"} (${shown}). Change those fields' style first, then remove it.`;
};

/**
 * The Type styles page (13:10888): one card of style rows (the specimen in
 * the style's own face, the face line with the style's role, and the three
 * values edited in place, PHASE-6 §9 D5), then Add style. "Edit all
 * properties" opens the style's editor under its row (13:11196), where the
 * style takes a role ("Use for", §9 D3). Every change autosaves with its
 * blast-radius toast, and Done closes (§9 D2).
 */
export function TypeStylesDetail({ brand, bindings }: { brand: BrandDraft; bindings: Bindings }) {
  const styles = brand.draft.typeStyles;
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  // Specimens render in their own faces: make sure they are loaded.
  useEffect(() => {
    const families = styles
      .map((s) => s.font)
      .filter((f): f is NonNullable<typeof f> => f?.source === "google")
      .map((f) => f.family);
    if (families.length) loadGoogleFonts(families);
  }, [styles]);

  /** Every change reports its blast radius. `message` overrides it (a role
   * moving says so). */
  const onChange = (next: BrandTypeStyle[], message?: string) => {
    const touched = styles
      .filter((prev) => {
        const after = next.find((s) => s.key === prev.key);
        return !after || JSON.stringify(after) !== JSON.stringify(prev);
      })
      .map((prev) => bindings.styleUse.get(prev.key));
    brand.commit(
      { typeStyles: next },
      {
        message: message ?? propagationNote(touched) ?? "Type styles updated",
        coalesceKey: message ? undefined : "typeStyles",
      },
    );
  };

  const addStyle = () => {
    const name = "New style";
    const key = slugKey(name, brand.draft.typeStyles);
    onChange([...brand.draft.typeStyles, { key, name, useFor: null }]);
    setExpandedKey(key);
    requestAnimationFrame(() => {
      document.querySelector<HTMLInputElement>(`[data-style-name="${key}"]`)?.focus();
    });
  };

  const addRef = useRef(addStyle);
  addRef.current = addStyle;
  useEffect(() => {
    if (consumeAddFlow("type-styles")) addRef.current();
  }, []);

  return (
    <section className="sp-bs-list" aria-label="Type styles">
      <div className="sp-bs-list__rows">
        {styles.map((s) => (
          <StyleRow
            key={s.key}
            style={s}
            styles={styles}
            onChange={onChange}
            expanded={expandedKey === s.key}
            setExpanded={(open) => setExpandedKey(open ? s.key : null)}
            brand={brand}
            bindings={bindings}
          />
        ))}
      </div>
      <AddSlot label="Add style" onClick={addStyle} style={{ minHeight: 56 }} />
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
  bindings,
}: {
  style: BrandTypeStyle;
  styles: BrandTypeStyle[];
  onChange(next: BrandTypeStyle[], message?: string): void;
  expanded: boolean;
  setExpanded(open: boolean): void;
  brand: BrandDraft;
  bindings: Bindings;
}) {
  const [renaming, setRenaming] = useState(false);
  const [editingValue, setEditingValue] = useState<ValueField | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);

  const update = (patch: Partial<BrandTypeStyle>) =>
    onChange(styles.map((x) => (x.key === s.key ? { ...x, ...patch } : x)));

  const duplicate = () => {
    const name = `${s.name} copy`;
    const key = slugKey(name, styles);
    // A copy holds no role: one style holds each.
    onChange([...styles, { ...s, key, name, useFor: null }]);
  };

  /** Removing a style template fields use would leave them pointing at a
   * missing style, so it is refused (§9 D6). Undo brings a removed style
   * back, so Remove is not red. */
  const remove = (): boolean => {
    const usage = bindings.styleUse.get(s.key);
    if (usage && usage.fields > 0) {
      setBlocked(inUseRefusal(s.name, usage));
      return false;
    }
    setBlocked(null);
    onChange(
      styles.filter((x) => x.key !== s.key),
      `Removed “${s.name}”`,
    );
    return true;
  };

  const groups: RowMenuGroup[] = [
    {
      items: [
        { label: "Rename", onSelect: () => setRenaming(true) },
        { label: "Duplicate", onSelect: duplicate },
        { label: "Edit all properties", onSelect: () => setExpanded(!expanded) },
      ],
    },
    { items: [{ label: "Remove", onSelect: () => void remove() }] },
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

  const label = `More actions for ${s.name}`;
  return (
    <div className="sp-bs-style" data-expanded={expanded || undefined}>
      <RowContextMenu groups={groups} label={label} disabled={renaming || editingValue !== null}>
        <div className="sp-bs-style__row">
          {renaming ? (
            <input
              className="ui-reset ui-ring-none sp-bs-style__spec sp-bs-style__rename"
              style={specimenStyle}
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
            <span className="sp-bs-style__spec" style={specimenStyle}>
              {s.name}
            </span>
          )}
          <span className="t-body-xs sp-bs-style__face">
            <span>
              {s.font?.family ?? "Any face"}
              {s.weight ? ` · ${s.weight}` : ""}
            </span>
            {s.useFor && <Tag>{ROLE_LABELS[s.useFor]}</Tag>}
          </span>
          <span className="t-body-s sp-bs-style__values">
            {VALUE_ORDER.map((field, i) => (
              <React.Fragment key={field}>
                {i > 0 && (
                  <span aria-hidden className="sp-bs-style__slash">
                    /
                  </span>
                )}
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
                    className="ui-reset ui-ring sp-bs-style__value"
                    data-auto={valueFor(field) === undefined || undefined}
                    aria-label={`${s.name} ${VALUE_NAME[field]}: ${displayFor(field)}`}
                    onClick={() => setEditingValue(field)}
                  >
                    {displayFor(field)}
                  </button>
                )}
              </React.Fragment>
            ))}
          </span>
          <RowMenu groups={groups} label={label} />
        </div>
      </RowContextMenu>
      {blocked && !expanded && (
        <p className="t-caption-s sp-bs-error-line sp-bs-style__blocked" role="alert">
          {blocked}
        </p>
      )}
      {expanded && (
        <StyleEditor
          style={s}
          styles={styles}
          onChange={onChange}
          brand={brand}
          blocked={blocked}
          onDelete={() => {
            if (remove()) setExpanded(false);
          }}
          onDone={() => setExpanded(false)}
        />
      )}
    </div>
  );
}

/** A Select's value for "the style doesn't lock this". */
const NONE = "";

/** "500", or "500 Italic Expanded" for a cut beyond the weight (§9 D10). */
function cutLabel(style: FontStyle): string {
  const extra = [
    style.stretch !== "normal" ? style.stretch.replace(/-/g, " ") : "",
    style.italic ? "Italic" : "",
  ].filter(Boolean);
  return [String(style.weight), ...extra].join(" ");
}

/**
 * Every property of one style (13:11314): Name, Font, Weight (the cuts the
 * family ships, §9 D10), Color, Fixed size, Max characters, Letter spacing
 * and Line height on the Field primitive, then Use for (§9 D3), Always
 * uppercase and Shrink to fit the box as ChoiceChips, the rules the style
 * enforces, and Delete style (quiet: Undo brings it back) and Done.
 * "Not enforced" leaves a property for each template to set.
 */
function StyleEditor({
  style: s,
  styles,
  onChange,
  brand,
  blocked,
  onDelete,
  onDone,
}: {
  style: BrandTypeStyle;
  styles: BrandTypeStyle[];
  onChange(next: BrandTypeStyle[], message?: string): void;
  brand: BrandDraft;
  blocked: string | null;
  onDelete(): void;
  onDone(): void;
}) {
  const useForId = useId();
  const fontAssets = brand.assets.filter((a) => a.kind === "font");
  const update = (patch: Partial<BrandTypeStyle>) =>
    onChange(styles.map((x) => (x.key === s.key ? { ...x, ...patch } : x)));

  const uploaded = [
    ...new Set(fontAssets.map((a) => (a.metadata as { family?: string }).family ?? a.name)),
  ];
  const fontOptions = [
    { value: NONE, label: "Not enforced" },
    ...uploaded.map((f) => ({ value: `custom:${f}`, label: f })),
    ...GOOGLE_FONTS.filter((f) => !uploaded.includes(f)).map((f) => ({
      value: `google:${f}`,
      label: f,
    })),
  ];
  const current = toFontStyle(s.weight, s.fontStyle, s.fontStretch);
  const cuts = s.font ? familyStyles(s.font.family, fontAssets, current).styles : [];
  const ordered = [...cuts].sort(
    (a, b) =>
      a.weight - b.weight ||
      STRETCH_ORDER.indexOf(a.stretch) - STRETCH_ORDER.indexOf(b.stretch) ||
      Number(a.italic) - Number(b.italic),
  );
  const weightOptions = [
    { value: NONE, label: "Not enforced" },
    ...(s.font
      ? ordered.map((c) => ({ value: styleKey(c), label: cutLabel(c) }))
      : [300, 400, 500, 600, 700, 800].map((w) => ({
          value: styleKey({ weight: w, italic: false, stretch: "normal" }),
          label: String(w),
        }))),
  ];
  const colorOptions = [
    { value: NONE, label: "Not enforced" },
    ...brand.draft.colors.map((c) => ({ value: c.key, label: c.name })),
  ];

  const num = (raw: string): number | undefined => {
    const n = Number(raw);
    return raw.trim() === "" || Number.isNaN(n) ? undefined : n;
  };

  const setRole = (role: FontRole | null) => {
    const previous = role ? styles.find((x) => x.useFor === role && x.key !== s.key) : null;
    const message = !role
      ? `Role cleared from ${s.name}`
      : previous
        ? `${ROLE_LABELS[role]} moved to ${s.name}`
        : `${ROLE_LABELS[role]} set to ${s.name}`;
    onChange(assignFontRole(styles, s.key, role), message);
  };

  const rules = ruleSentences(s, { colors: brand.draft.colors } as Parameters<
    typeof ruleSentences
  >[1]);

  return (
    <div
      className="sp-bs-style__editor"
      onKeyDown={(e) => {
        if (e.key === "Escape" && !(e.target as Element).closest("[role=listbox]")) onDone();
      }}
    >
      <div className="sp-bs-style__fields">
        <Field label="Name">
          <Input
            data-style-name={s.key}
            value={s.name}
            onChange={(e) => update({ name: e.target.value })}
          />
        </Field>
        <Field label="Font">
          <Select
            ariaLabel="Font"
            size="lg"
            value={s.font ? `${s.font.source}:${s.font.family}` : NONE}
            options={fontOptions}
            onSelect={(v) => {
              if (!v) return update({ font: undefined });
              const [source, ...rest] = v.split(":");
              const family = rest.join(":");
              if (source === "google") loadGoogleFonts([family]);
              const ref: FontRef =
                source === "custom"
                  ? {
                      source: "custom",
                      family,
                      assetId: fontAssets.find(
                        (a) => ((a.metadata as { family?: string }).family ?? a.name) === family,
                      )?.id,
                    }
                  : { source: "google", family };
              update({ font: ref });
            }}
          />
        </Field>
        <Field label="Weight">
          <Select
            ariaLabel="Weight"
            size="lg"
            value={s.weight === undefined ? NONE : styleKey(current)}
            options={weightOptions}
            onSelect={(v) => {
              const cut = v ? parseStyleKey(v) : undefined;
              update(
                cut
                  ? {
                      weight: cut.weight,
                      fontStyle: cut.italic ? "italic" : undefined,
                      fontStretch: cut.stretch === "normal" ? undefined : cut.stretch,
                    }
                  : { weight: undefined, fontStyle: undefined, fontStretch: undefined },
              );
            }}
          />
        </Field>
        <Field label="Color">
          <Select
            ariaLabel="Color"
            size="lg"
            value={s.colorKey ?? NONE}
            options={colorOptions}
            onSelect={(v) => update({ colorKey: v || undefined })}
          />
        </Field>
        <Field label="Fixed size (px)">
          <Input
            type="number"
            value={s.fontSizePx ?? ""}
            placeholder="Per template"
            onChange={(e) => update({ fontSizePx: num(e.target.value) })}
          />
        </Field>
        <Field label="Max characters">
          <Input
            type="number"
            value={s.maxLength ?? ""}
            placeholder="No limit"
            onChange={(e) => update({ maxLength: num(e.target.value) })}
          />
        </Field>
        <Field label="Letter spacing (px)">
          <Input
            type="number"
            step="0.1"
            value={s.letterSpacingPx ?? ""}
            placeholder="Not enforced"
            onChange={(e) => update({ letterSpacingPx: num(e.target.value) })}
          />
        </Field>
        <Field label="Line height">
          <Input
            type="number"
            step="0.05"
            value={s.lineHeight ?? ""}
            placeholder="Not enforced"
            onChange={(e) => update({ lineHeight: num(e.target.value) })}
          />
        </Field>
      </div>

      <div className="sp-bs-style__toggles">
        <span id={useForId} className="t-label-xs sp-bs-style__toggle-label">
          Use for
        </span>
        <div role="group" aria-labelledby={useForId} className="sp-bs-chips">
          <ChoiceChip selected={!s.useFor} onClick={() => s.useFor && setRole(null)}>
            None
          </ChoiceChip>
          {(["heading", "body"] as const).map((role) => (
            <ChoiceChip
              key={role}
              selected={s.useFor === role}
              onClick={() => s.useFor !== role && setRole(role)}
            >
              {ROLE_LABELS[role]}
            </ChoiceChip>
          ))}
        </div>
        <span className="sp-bs-style__toggle-gap" aria-hidden />
        <ChoiceChip
          selected={!!s.uppercase}
          onClick={() => update({ uppercase: s.uppercase ? undefined : true })}
        >
          Always uppercase
        </ChoiceChip>
        <ChoiceChip
          selected={s.textSizing === "shrink"}
          onClick={() => update({ textSizing: s.textSizing === "shrink" ? undefined : "shrink" })}
        >
          Shrink to fit the box
        </ChoiceChip>
      </div>

      {rules.length > 0 && (
        <div className="sp-bs-style__rules">
          {rules.map((r) => (
            <p key={r} className="t-body-xs sp-bs-style__rule">
              <Lock size={12} className="ui-icon" aria-hidden />
              {r}
            </p>
          ))}
        </div>
      )}

      {blocked && (
        <p className="t-caption-s sp-bs-error-line" role="alert">
          {blocked}
        </p>
      )}

      <div className="sp-bs-style__foot">
        <button
          type="button"
          className="ui-reset ui-ring t-label-xs sp-bs-quiet-action"
          onClick={onDelete}
        >
          Delete style
        </button>
        <Button kind="primary" size="sm" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}

/** The in-place numeric input: arrows step (size 1, line height 0.05,
 * tracking 0.5; Shift multiplies by 10), Enter or Tab saves and moves on,
 * Escape reverts. */
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
    <Input
      size="sm"
      className="sp-bs-style__value-input"
      aria-label={`Edit ${VALUE_NAME[field]}`}
      inputMode="decimal"
      autoFocus
      value={raw}
      onFocus={(e) => e.target.select()}
      onChange={(e) => setRaw(e.target.value)}
      onBlur={() => onSave(raw, false)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          onSave(raw, true);
        } else if (e.key === "Escape") {
          e.stopPropagation();
          onCancel();
        } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          // From "Auto", step from where the specimen draws it, not from 0.
          const base = field === "size" ? 32 : field === "lineHeight" ? 1.2 : 0;
          const text = raw.replace(/px$/i, "").trim();
          const current = text === "" ? base : Number(text) || 0;
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
