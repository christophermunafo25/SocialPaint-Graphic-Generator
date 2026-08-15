import React from "react";
import type { BrandColor, BrandTypeStyle } from "@/lib/types";
import { DesignSystemImportPanel } from "../DesignSystemImportPanel";
import { Disclosure } from "./Disclosure";
import type { BrandDraft } from "./kitPlumbing";

interface SectionProps {
  brand: BrandDraft;
  open: boolean;
  onToggle(): void;
}

/** Bring your own design system: tokens.json or a Figma file merges into the
 * kit. Merges only ever APPEND — an existing key can't be redirected by an
 * import, which is why this needs no confirmation of its own. */
export function ImportSection({ brand, open, onToggle }: SectionProps) {
  const { draft, commit } = brand;

  const mergeColors = (incoming: BrandColor[]) => {
    const fresh = incoming.filter((c) => !draft.colors.some((p) => p.key === c.key));
    if (!fresh.length) return;
    commit(
      { colors: [...draft.colors, ...fresh] },
      { message: `Merged ${fresh.length} color${fresh.length === 1 ? "" : "s"}` },
    );
  };

  const mergeTypeStyles = (incoming: BrandTypeStyle[]) => {
    const fresh = incoming.filter((t) => !draft.typeStyles.some((p) => p.key === t.key));
    if (!fresh.length) return;
    commit(
      { typeStyles: [...draft.typeStyles, ...fresh] },
      { message: `Merged ${fresh.length} type style${fresh.length === 1 ? "" : "s"}` },
    );
  };

  return (
    <Disclosure
      eyebrow="Bring your own"
      title="Import design system"
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
          Ingest a design-tokens JSON, or pull color and text styles from a connected Figma file.
          Imports merge and save immediately — your existing entries always win.
        </p>
        <DesignSystemImportPanel
          onImportColors={mergeColors}
          onImportTypeStyles={mergeTypeStyles}
        />
      </div>
    </Disclosure>
  );
}
