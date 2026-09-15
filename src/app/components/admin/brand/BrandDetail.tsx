import React from "react";
import { useBrand } from "@/lib/brand/BrandContext";
import type { BrandCategory } from "../../../router";
import { Bone } from "../../Skeleton";
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
        <p
          className="mb-5 text-sm px-4 py-3"
          data-radius-card
          role="alert"
          style={{ background: "var(--danger-wash)", color: "var(--destructive)" }}
        >
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
      <div className="sp-colors-grid" aria-busy="true" aria-label={label}>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="sp-card sp-color-card" aria-hidden>
            <Bone w="100%" h={88} r="var(--radius-media-inner)" />
            <span className="sp-color-card__row">
              <Bone w={56} h={13} />
              <Bone w={44} h={10} />
            </span>
          </div>
        ))}
      </div>
    );
  }
  if (category === "logos" || category === "images") {
    return (
      <div className="sp-logos-grid" aria-busy="true" aria-label={label}>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="sp-card sp-logo-card" aria-hidden>
            <Bone w="100%" h={132} r="var(--radius-media-inner)" />
            <Bone w={96} h={13} />
          </div>
        ))}
      </div>
    );
  }
  if (category === "import") {
    return (
      <div className="sp-import-grid" aria-busy="true" aria-label={label}>
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="sp-card sp-import-leg" aria-hidden>
            <Bone w={140} h={13} />
            <Bone w="70%" h={11} />
            <Bone w={160} h={36} r="var(--radius-control)" />
          </div>
        ))}
      </div>
    );
  }
  // Fonts and type styles: the list card with row-shaped bones.
  return (
    <div className="sp-card sp-list-card" aria-busy="true" aria-label={label}>
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="sp-font-row" aria-hidden>
          <Bone w={40} h={32} />
          <span className="sp-font-row__id">
            <Bone w={120} h={13} />
            <Bone w={64} h={9} style={{ marginTop: 6 }} />
          </span>
          <span className="sp-font-row__specimen">
            <Bone w="60%" h={14} />
          </span>
        </div>
      ))}
    </div>
  );
}
