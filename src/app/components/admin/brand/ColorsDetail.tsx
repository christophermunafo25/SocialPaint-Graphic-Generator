import React, { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { BrandColor } from "@/lib/types";
import { DEFAULT_PALETTE } from "@/lib/theme";
import { ColorControl } from "../../ColorControl";
import { InlineEdit } from "../../InlineEdit";
import { BrandDetailPage, ImpactDialog } from "./BrandDetailPage";
import {
  summarizeImpact,
  usageLabel,
  useBrandBindings,
  useKitSave,
  type BindingUsage,
  type Impact,
} from "./kitPlumbing";

/** The palette editor, lifted from the old single-screen Brand Studio.
 * Fields carry no live palette binding, so a hex edit here reaches saved
 * templates only through type styles that name the color — that's the
 * blast radius the impact dialog reports. */
export function ColorsDetail() {
  const { kit, saving, saved, error, save } = useKitSave();
  const bindings = useBrandBindings(kit);

  const [colors, setColors] = useState<BrandColor[]>(kit?.colors ?? DEFAULT_PALETTE);
  // Sync the working copy ONLY when a different kit arrives (company switch /
  // first load) — background refreshes must not wipe unsaved edits.
  const syncedKitIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!kit || syncedKitIdRef.current === kit.id) return;
    syncedKitIdRef.current = kit.id;
    setColors(kit.colors);
  }, [kit]);

  const dirty = JSON.stringify(colors) !== JSON.stringify(kit?.colors ?? DEFAULT_PALETTE);

  const [impact, setImpact] = useState<Impact | null>(null);
  const computeImpact = (): Impact | null => {
    if (!kit || !bindings.templates) return null; // no baseline or unknown usage → don't block
    const affected: BindingUsage[] = [];
    let removals = false;
    for (const prev of kit.colors ?? []) {
      const next = colors.find((c) => c.key === prev.key);
      const use = bindings.colorUse.get(prev.key);
      if (!use || use.fields === 0) continue;
      if (!next) removals = true;
      if (!next || next.hex !== prev.hex) affected.push(use);
    }
    return summarizeImpact(affected, removals);
  };

  const requestSave = () => {
    const i = computeImpact();
    if (i) setImpact(i);
    else void save({ colors });
  };

  return (
    <BrandDetailPage
      title="Colors"
      description="The sanctioned palette builders pick from. Picking a color copies its value onto the field — templates keep what they were built with."
      dirty={dirty}
      saving={saving}
      saved={saved}
      saveLabel="Save colors"
      error={error}
      onSave={requestSave}
    >
      <ImpactDialog
        impact={impact}
        onCancel={() => setImpact(null)}
        onConfirm={() => {
          setImpact(null);
          void save({ colors });
        }}
      />

      <section className="sp-card sp-card--content space-y-4" style={{ maxWidth: 560 }}>
        <div className="space-y-2.5">
          {colors.map((c, i) => (
            <div key={c.key} className="flex items-center gap-3" style={{ minHeight: 44 }}>
              <ColorControl
                ariaLabel={`${c.name} color`}
                value={c.hex}
                onChange={(hex) => setColors(colors.map((x, j) => (j === i ? { ...x, hex } : x)))}
                /* This row IS the palette — offering the palette back would
                   just be a circle. */
                brandSwatches={false}
              />
              <div className="flex-1 min-w-0">
                <InlineEdit
                  value={c.name}
                  /* Local commit only — the page's "Save colors" button owns the
                     kit write, behind the impact dialog. */
                  onSave={(name) =>
                    setColors(colors.map((x, j) => (j === i ? { ...x, name } : x)))
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
                  onClick={() => setColors(colors.filter((_, j) => j !== i))}
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
            setColors([...colors, { key: `custom_${n}`, name: `Custom ${n}`, hex: "#888888" }]);
          }}
          style={{
            fontSize: "var(--type-caption-size)",
            color: "var(--state-primary)",
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <Plus className="w-3.5 h-3.5" />
          Add color
        </button>
      </section>
    </BrandDetailPage>
  );
}
