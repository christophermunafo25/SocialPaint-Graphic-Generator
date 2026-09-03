import React from "react";
import { Plus, Trash2 } from "lucide-react";
import type { BrandColor } from "@/lib/types";
import { DEFAULT_PALETTE } from "@/lib/theme";
import { ColorControl } from "../../ColorControl";
import { InlineEdit } from "../../InlineEdit";
import { Disclosure } from "./Disclosure";
import { propagationNote, usageLabel, type BrandDraft, type useBrandBindings } from "./kitPlumbing";

const GLANCE_CAP = 6;

interface SectionProps {
  brand: BrandDraft;
  bindings: ReturnType<typeof useBrandBindings>;
  open: boolean;
  onToggle(): void;
}

/** The palette. Fields carry no live palette binding — picking a color in
 * the builder copies its hex onto the field — so a hex edit here reaches
 * saved templates only through type styles that name the color. That's the
 * blast radius the toast reports, with Undo attached. */
export function ColorsSection({ brand, bindings, open, onToggle }: SectionProps) {
  const colors = brand.draft.colors;

  const setColors = (next: BrandColor[], message: string, coalesceKey?: string) =>
    brand.commit({ colors: next }, { message, coalesceKey });

  /** "Restyled 14 fields in 6 templates" when this color is bound, else the
   * plain line. */
  const noteFor = (key: string, fallback: string) =>
    propagationNote([bindings.colorUse.get(key)]) ?? fallback;

  return (
    <Disclosure
      eyebrow={`Palette · ${colors.length} color${colors.length === 1 ? "" : "s"}`}
      title="Colors"
      glance={
        <span className="flex" style={{ gap: 6 }}>
          {colors.slice(0, GLANCE_CAP).map((c) => (
            <span
              key={c.key}
              title={c.name}
              style={{
                width: 16,
                height: 16,
                borderRadius: "var(--radius-control)",
                border: "1px solid var(--border)",
                background: c.hex,
              }}
            />
          ))}
        </span>
      }
      open={open}
      onToggle={onToggle}
    >
      <div className="space-y-4">
        <p
          style={{
            fontSize: "var(--type-caption-size)",
            color: "var(--text-muted)",
            maxWidth: 480,
          }}
        >
          The sanctioned palette builders pick from. Picking a color copies its value onto a field.
          Saved templates keep what they were built with.
        </p>

        <div className="space-y-2.5" style={{ maxWidth: 520 }}>
          {colors.map((c, i) => (
            <div key={c.key} className="flex items-center gap-3" style={{ minHeight: 44 }}>
              <ColorControl
                ariaLabel={`${c.name} color`}
                value={c.hex}
                onChange={(hex) =>
                  setColors(
                    colors.map((x, j) => (j === i ? { ...x, hex } : x)),
                    noteFor(c.key, `${c.name} recolored`),
                    // A picker drag is one undo step, not sixty.
                    `hex:${c.key}`,
                  )
                }
                /* This row IS the palette — offering the palette back would
                   just be a circle. */
                brandSwatches={false}
              />
              <div className="flex-1 min-w-0">
                <InlineEdit
                  value={c.name}
                  onSave={(name) =>
                    setColors(
                      colors.map((x, j) => (j === i ? { ...x, name } : x)),
                      `Renamed to “${name}”`,
                    )
                  }
                  ariaLabel={`Rename the ${c.name} brand color`}
                  inputAriaLabel="Color name"
                  valueStyle={{ fontSize: 14 }}
                />
                {bindings.templates && (
                  <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {usageLabel(bindings.colorUse.get(c.key))}
                  </p>
                )}
              </div>
              {!DEFAULT_PALETTE.some((d) => d.key === c.key) && (
                <button
                  onClick={() =>
                    setColors(
                      colors.filter((_, j) => j !== i),
                      noteFor(c.key, `Removed “${c.name}”`),
                    )
                  }
                  aria-label={`Remove ${c.name}`}
                >
                  <Trash2 className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} />
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={() => {
            const n = colors.filter((c) => c.key.startsWith("custom")).length + 1;
            setColors(
              [...colors, { key: `custom_${n}`, name: `Custom ${n}`, hex: "#888888" }],
              `Added “Custom ${n}”`,
            );
          }}
          className="sp-btn sp-btn-ghost"
        >
          <Plus className="w-3.5 h-3.5" />
          Add color
        </button>
      </div>
    </Disclosure>
  );
}
