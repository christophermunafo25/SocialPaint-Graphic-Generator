import React from "react";
import type { BrandTypeStyle } from "@/lib/types";
import { TypeStylesEditor } from "../TypeStylesEditor";
import { Disclosure } from "./Disclosure";
import { propagationNote, usageLabel, type BrandDraft, type useBrandBindings } from "./kitPlumbing";

interface SectionProps {
  brand: BrandDraft;
  bindings: ReturnType<typeof useBrandBindings>;
  open: boolean;
  onToggle(): void;
}

/** The brand rules engine, and the ONE live brand channel left: every
 * property a style defines — face, weight, size, casing, color — follows the
 * style across all templates. Which is why an edit here reports what it just
 * moved, with Undo attached. */
export function TypeStylesSection({ brand, bindings, open, onToggle }: SectionProps) {
  const { draft, commit, assets } = brand;
  const styles = draft.typeStyles;
  const fontAssets = assets.filter((a) => a.kind === "font");

  const onChange = (next: BrandTypeStyle[]) => {
    // Which bound styles this edit actually disturbed — changed or dropped.
    const touched = styles
      .filter((prev) => {
        const after = next.find((s) => s.key === prev.key);
        return !after || JSON.stringify(after) !== JSON.stringify(prev);
      })
      .map((prev) => bindings.styleUse.get(prev.key));
    commit(
      { typeStyles: next },
      {
        message: propagationNote(touched) ?? "Type styles updated",
        // The editor fires per keystroke; one run of edits is one undo step.
        coalesceKey: "typeStyles",
      },
    );
  };

  return (
    <Disclosure
      eyebrow={`Rules · ${styles.length} style${styles.length === 1 ? "" : "s"}`}
      title="Type styles"
      glance={
        styles.length
          ? styles
              .slice(0, 3)
              .map((s) => s.name)
              .join(" · ") + (styles.length > 3 ? ` +${styles.length - 3}` : "")
          : undefined
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
          Saved styles a builder can apply to a field. Every property a style defines is locked and
          follows the style across all templates — the one live brand rule mechanism.
        </p>
        <TypeStylesEditor
          styles={styles}
          colors={draft.colors}
          customFamilies={fontAssets.map((a) => a.metadata.family ?? a.name)}
          onChange={onChange}
          usageLabelFor={
            bindings.templates ? (key) => usageLabel(bindings.styleUse.get(key)) : undefined
          }
        />
      </div>
    </Disclosure>
  );
}
