import React from "react";
import { useBrand } from "@/lib/brand/BrandContext";
import type { BrandCategory } from "../../../router";
import { CATEGORY_TITLES } from "./categories";
import { BrandDetailHeader } from "./BrandDetailHeader";
import { ColorsDetail } from "./ColorsDetail";
import { FontsDetail } from "./FontsDetail";
import { ImagesDetail } from "./ImagesDetail";
import { ImportDetail } from "./ImportDetail";
import { LogosDetail } from "./LogosDetail";
import { TypeStylesDetail } from "./TypeStylesDetail";
import type { BrandDraft, useBrandBindings } from "./kitPlumbing";
import type { LogoSurface } from "./kitOps";

interface BrandDetailProps {
  category: BrandCategory;
  /** Logos page filter, from the URL. */
  surface?: LogoSurface;
  brand: BrandDraft;
  bindings: ReturnType<typeof useBrandBindings>;
}

/** One category, edited in place. The draft lives in BrandStudio above, so
 * moving between the overview and any detail page never reloads it. */
export function BrandDetail({ category, surface, brand, bindings }: BrandDetailProps) {
  const { loading } = useBrand();
  return (
    <>
      <BrandDetailHeader title={CATEGORY_TITLES[category]} brand={brand} />
      {brand.error && (
        <p className="t-body-s sp-bs-error" role="alert">
          {brand.error}
        </p>
      )}
      {loading ? (
        <DetailSkeleton category={category} />
      ) : (
        <>
          {category === "colors" && <ColorsDetail brand={brand} bindings={bindings} />}
          {category === "logos" && <LogosDetail brand={brand} surface={surface} />}
          {category === "typography" && <FontsDetail brand={brand} />}
          {category === "type-styles" && <TypeStylesDetail brand={brand} bindings={bindings} />}
          {category === "images" && <ImagesDetail brand={brand} />}
          {category === "import" && <ImportDetail brand={brand} />}
        </>
      )}
    </>
  );
}

/** First-load stand-ins with each page's real geometry, so nothing jumps
 * when the kit and assets land. One aria-busy label per page. */
function DetailSkeleton({ category }: { category: BrandCategory }) {
  const label = `Loading ${CATEGORY_TITLES[category]}`;
  if (category === "colors") {
    return (
      <div className="sp-bs-colors" aria-busy="true" aria-label={label}>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="sp-bs-color" aria-hidden>
            <span className="sp-bs-color__swatch sp-bs-bone" />
            <span className="sp-bs-color__meta">
              <span className="sp-bs-bone" style={{ width: 56, height: 10 }} />
              <span className="sp-bs-bone" style={{ width: 44, height: 8 }} />
            </span>
          </div>
        ))}
      </div>
    );
  }
  if (category === "logos") {
    return (
      <div className="sp-bs-logos" aria-busy="true" aria-label={label}>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="sp-bs-logo" aria-hidden>
            <span className="sp-bs-logo__plate sp-bs-bone" />
            <span className="sp-bs-logo__meta">
              <span className="sp-bs-bone" style={{ width: 96, height: 10 }} />
              <span className="sp-bs-bone" style={{ width: 64, height: 8 }} />
            </span>
          </div>
        ))}
      </div>
    );
  }
  if (category === "images") {
    return (
      <div className="sp-bs-images" aria-busy="true" aria-label={label}>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="sp-bs-image" aria-hidden>
            <span className="sp-bs-image__plate sp-bs-bone" />
            <span className="sp-bs-image__meta">
              <span className="sp-bs-bone" style={{ width: 96, height: 10 }} />
              <span className="sp-bs-bone" style={{ width: 64, height: 8 }} />
            </span>
          </div>
        ))}
      </div>
    );
  }
  if (category === "import") {
    return (
      <div className="sp-bs-import" aria-busy="true" aria-label={label}>
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="sp-bs-import__leg" aria-hidden>
            <span className="sp-bs-bone" style={{ width: 120, height: 10 }} />
            <span className="sp-bs-bone" style={{ width: 160, height: 40 }} />
          </div>
        ))}
      </div>
    );
  }
  // Fonts and type styles: the list card with row-shaped bones.
  return (
    <div className="sp-bs-list" aria-busy="true" aria-label={label}>
      <div className="sp-bs-list__rows">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="sp-bs-font" aria-hidden>
            <span className="sp-bs-bone" style={{ width: 40, height: 32 }} />
            <span className="sp-bs-font__id">
              <span className="sp-bs-bone" style={{ width: 120, height: 10 }} />
              <span className="sp-bs-bone" style={{ width: 64, height: 8 }} />
            </span>
            <span className="sp-bs-font__specimen">
              <span className="sp-bs-bone" style={{ width: "60%", height: 12 }} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
