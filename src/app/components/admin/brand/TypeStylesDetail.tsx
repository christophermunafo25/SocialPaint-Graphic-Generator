import React, { useEffect, useRef, useState } from "react";
import type { BrandTypeStyle } from "@/lib/types";
import { DEFAULT_PALETTE, DEFAULT_TYPE_STYLES } from "@/lib/theme";
import { TypeStylesEditor } from "../TypeStylesEditor";
import { BrandDetailPage, ImpactDialog } from "./BrandDetailPage";
import {
  summarizeImpact,
  usageLabel,
  useBrandBindings,
  useKitSave,
  type BindingUsage,
  type Impact,
} from "./kitPlumbing";

/** The brand rules engine, lifted from the old single-screen Brand Studio.
 * Type styles are the ONE live brand channel left: every property a style
 * defines — face, weight, size, casing, color — follows the style across
 * all templates, which is exactly why edits here confirm their blast
 * radius before applying. */
export function TypeStylesDetail() {
  const { kit, assets, saving, saved, error, save } = useKitSave();
  const bindings = useBrandBindings(kit);
  const fontAssets = assets.filter((a) => a.kind === "font");

  const [typeStyles, setTypeStyles] = useState<BrandTypeStyle[]>(
    kit?.typeStyles?.length ? kit.typeStyles : DEFAULT_TYPE_STYLES,
  );
  const syncedKitIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!kit || syncedKitIdRef.current === kit.id) return;
    syncedKitIdRef.current = kit.id;
    setTypeStyles(kit.typeStyles?.length ? kit.typeStyles : DEFAULT_TYPE_STYLES);
  }, [kit]);

  const dirty =
    JSON.stringify(typeStyles) !==
    JSON.stringify(kit?.typeStyles?.length ? kit.typeStyles : DEFAULT_TYPE_STYLES);

  const [impact, setImpact] = useState<Impact | null>(null);
  const computeImpact = (): Impact | null => {
    if (!kit || !bindings.templates) return null; // no baseline or unknown usage → don't block
    const affected: BindingUsage[] = [];
    let removals = false;
    for (const prev of kit.typeStyles ?? []) {
      const next = typeStyles.find((s) => s.key === prev.key);
      const use = bindings.styleUse.get(prev.key);
      if (!use || use.fields === 0) continue;
      if (!next) removals = true;
      if (!next || JSON.stringify(next) !== JSON.stringify(prev)) affected.push(use);
    }
    return summarizeImpact(affected, removals);
  };

  const requestSave = () => {
    const i = computeImpact();
    if (i) setImpact(i);
    else void save({ typeStyles });
  };

  return (
    <BrandDetailPage
      title="Type styles"
      description="Saved styles a builder can apply to a field. Every property a style defines is locked and follows the style across all templates — the one live brand rule mechanism."
      dirty={dirty}
      saving={saving}
      saved={saved}
      saveLabel="Save type styles"
      error={error}
      onSave={requestSave}
    >
      <ImpactDialog
        impact={impact}
        onCancel={() => setImpact(null)}
        onConfirm={() => {
          setImpact(null);
          void save({ typeStyles });
        }}
      />

      <section className="sp-card sp-card--content space-y-4">
        <TypeStylesEditor
          styles={typeStyles}
          colors={kit?.colors ?? DEFAULT_PALETTE}
          customFamilies={fontAssets.map((a) => a.metadata.family ?? a.name)}
          onChange={setTypeStyles}
          usageLabelFor={
            bindings.templates ? (key) => usageLabel(bindings.styleUse.get(key)) : undefined
          }
        />
      </section>
    </BrandDetailPage>
  );
}
