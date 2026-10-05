import React from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useUnsavedChangesWarning } from "@/lib/useUnsavedChangesWarning";
import { type BrandCategory } from "../../router";
import { Page } from "../layout/Page";
import { LegalLinks } from "../generate/LegalLinks";
import { Toast } from "../primitives";
import { BrandDetail } from "./brand/BrandDetail";
import { BrandOverview } from "./brand/BrandOverview";
import type { LogoSurface } from "./brand/kitOps";
import { useBrandBindings, useBrandDraft } from "./brand/kitPlumbing";

/** Brand Studio, in two steps: /brand-studio is an overview of category
 * cards, /brand-studio/<category> is that category's detail page, edited
 * in place. Every edit saves itself — no Save button, no dirty state; Undo
 * (and ⌘Z) is the safety net. The draft lives HERE, above both steps, so
 * opening a category or coming back never reloads it or loses a pending
 * edit — App mounts this component un-keyed and only `category` changes. */
export function BrandStudio({
  category,
  surface,
}: {
  category?: BrandCategory;
  surface?: LogoSurface;
}) {
  const { company } = useAuth();
  const brand = useBrandDraft();
  const bindings = useBrandBindings(brand.kit);

  // Autosave trails the keystroke; closing the tab inside that window would
  // drop the last edit.
  useUnsavedChangesWarning(brand.pending || brand.saving);

  return (
    <Page layout={{ className: "sp-bs-page" }}>
      <div className="sp-bs-content">
        {category ? (
          <BrandDetail category={category} surface={surface} brand={brand} bindings={bindings} />
        ) : (
          <BrandOverview brand={brand} companyId={company?.id} />
        )}
      </div>

      {/* The toast (13:9850): the Toast primitive, centred on the page. */}
      <div className="sp-bs-toast-anchor">
        {brand.undoOffer && (
          <Toast
            message={brand.undoOffer.message}
            actionLabel="Undo"
            onAction={() => brand.undo(brand.undoOffer?.snapshot)}
          />
        )}
      </div>

      <p className="t-caption-s sp-bs-legal">
        <LegalLinks />
      </p>
    </Page>
  );
}
