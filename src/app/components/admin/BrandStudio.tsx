import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useUnsavedChangesWarning } from "@/lib/useUnsavedChangesWarning";
import { useRouter, type BrandCategory } from "../../router";
import { Page, PageHeader } from "../layout/Page";
import { BrandRail } from "./brand/BrandRail";
import { ColorsSection } from "./brand/ColorsSection";
import { ImportSection } from "./brand/ImportSection";
import { LogosSection } from "./brand/LogosSection";
import { TypeStylesSection } from "./brand/TypeStylesSection";
import { TypographySection } from "./brand/TypographySection";
import { useBrandBindings, useBrandDraft } from "./brand/kitPlumbing";

type OpenMap = Partial<Record<BrandCategory, boolean>>;

const anchorId = (section: BrandCategory) => `brand-${section}`;

/** Brand Studio: everything the templates draw from, on one page. Each
 * category is a card that opens in place instead of a screen you navigate
 * to and back from, and every edit saves itself — so there is no Save
 * button, no dirty state, and nothing to lose by leaving. Undo (and ⌘Z) is
 * the safety net that buys all of that.
 *
 * The old per-category URLs still work: /brand-studio/<category> now opens
 * that card rather than replacing the page. */
export function BrandStudio({ category }: { category?: BrandCategory }) {
  const { company } = useAuth();
  const { navigate } = useRouter();
  const brand = useBrandDraft();
  const bindings = useBrandBindings(brand.kit);

  // Colors first by default — it's the category people come here for. A
  // deep link opens its own card instead.
  const [open, setOpen] = useState<OpenMap>(() =>
    category ? { [category]: true } : { colors: true },
  );
  const toggle = (section: BrandCategory) => setOpen((o) => ({ ...o, [section]: !o[section] }));

  /** Set by the checklist: open the card, then bring it into view. */
  const [reveal, setReveal] = useState<BrandCategory | null>(null);
  useEffect(() => {
    if (!reveal) return;
    setReveal(null);
    document
      .getElementById(anchorId(reveal))
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [reveal]);

  const openSection = (section: BrandCategory) => {
    setOpen((o) => ({ ...o, [section]: true }));
    setReveal(section);
    // Keep the URL honest about what's on screen, without a history entry
    // per card — this is the same page, scrolled.
    navigate({ name: "brandStudio", category: section }, { replace: true });
  };

  // Autosave trails the keystroke; closing the tab inside that window would
  // drop the last edit.
  useUnsavedChangesWarning(brand.pending || brand.saving);

  return (
    <Page>
      <PageHeader
        eyebrow={company?.name}
        title="Brand Studio"
        description="Everything your templates draw from, in one place. Changes save as you type. Undo anything."
      />

      {brand.error && (
        <p
          className="mb-5 text-sm px-4 py-3"
          data-radius-card
          role="alert"
          style={{ background: "var(--danger-wash)", color: "var(--destructive)" }}
        >
          {brand.error}
        </p>
      )}

      <div className="sp-brand-layout">
        <div className="flex flex-col" style={{ gap: "var(--space-sm)" }}>
          <div id={anchorId("colors")}>
            <ColorsSection
              brand={brand}
              bindings={bindings}
              open={!!open.colors}
              onToggle={() => toggle("colors")}
            />
          </div>
          <div id={anchorId("typography")}>
            <TypographySection
              brand={brand}
              open={!!open.typography}
              onToggle={() => toggle("typography")}
            />
          </div>
          <div id={anchorId("logos")}>
            <LogosSection brand={brand} open={!!open.logos} onToggle={() => toggle("logos")} />
          </div>
          <div id={anchorId("type-styles")}>
            <TypeStylesSection
              brand={brand}
              bindings={bindings}
              open={!!open["type-styles"]}
              onToggle={() => toggle("type-styles")}
            />
          </div>
          <div id={anchorId("import")}>
            <ImportSection brand={brand} open={!!open.import} onToggle={() => toggle("import")} />
          </div>
        </div>

        <BrandRail
          brand={brand}
          companyName={company?.name ?? "Your brand"}
          onOpenSection={openSection}
        />
      </div>

      {brand.undoOffer && (
        <div className="sp-toast" role="status" aria-live="polite">
          <span
            className="flex-1"
            style={{ fontSize: "var(--type-label-size)", color: "var(--text-primary)" }}
          >
            {brand.undoOffer.message}
          </span>
          <button
            onClick={() => brand.undo(brand.undoOffer?.snapshot)}
            className="sp-btn sp-btn-ghost"
            style={{ height: 28, padding: "0 10px", fontSize: "var(--type-caption-size)" }}
          >
            Undo
          </button>
        </div>
      )}
    </Page>
  );
}
