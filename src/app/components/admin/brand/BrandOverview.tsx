import React, { useState } from "react";
import { useBrand } from "@/lib/brand/BrandContext";
import { routeToUrl, useRouter, type BrandCategory } from "../../../router";
import { Bone } from "../../Skeleton";
import { PageHeader } from "../../layout/Page";
import { requestAddFlow } from "./addFlow";
import { CATEGORY_ORDER, CATEGORY_TITLES, categoryCount } from "./categories";
import type { BrandDraft } from "./kitPlumbing";
import { EditOverlay } from "./primitives/EditOverlay";
import { useLinkClick } from "./useLinkClick";
import coverColors from "@/assets/socialpaint/brand-studio/brand-studio-cover-colors.webp";
import coverLogos from "@/assets/socialpaint/brand-studio/brand-studio-cover-logos.webp";
import coverFonts from "@/assets/socialpaint/brand-studio/brand-studio-cover-fonts.webp";
import coverTypeStyles from "@/assets/socialpaint/brand-studio/brand-studio-cover-type-styles.webp";
import coverImages from "@/assets/socialpaint/brand-studio/brand-studio-cover-images.webp";
import coverImport from "@/assets/socialpaint/brand-studio/brand-studio-cover-import.webp";

/** Category art in the SocialPaint brand — identical for every tenant. */
const COVERS: Record<BrandCategory, string> = {
  colors: coverColors,
  logos: coverLogos,
  typography: coverFonts,
  "type-styles": coverTypeStyles,
  images: coverImages,
  import: coverImport,
};

interface SetupSection {
  category: BrandCategory;
  ready: boolean;
  /** Why it isn't ready, shown for the FIRST unfinished section. */
  reason: string;
  /** The strip's one primary action, named for this section. */
  action: string;
}

const dismissKey = (companyId: string) => `sp:brand-setup-dismissed:${companyId}`;

const readDismissed = (companyId: string | undefined): boolean => {
  if (!companyId) return false;
  try {
    return localStorage.getItem(dismissKey(companyId)) === "1";
  } catch {
    return false;
  }
};

/** The overview: the setup strip, then three even columns of lifted
 * category cards — each a REAL link to its detail page, editable through
 * the cover's overlay affordance (D8). */
export function BrandOverview({
  brand,
  companyId,
  companyName,
}: {
  brand: BrandDraft;
  companyId?: string;
  companyName?: string;
}) {
  const linkClick = useLinkClick();
  const { navigate } = useRouter();
  const { loading } = useBrand();
  const { draft, assets } = brand;
  const [dismissed, setDismissed] = useState(() => readDismissed(companyId));

  const logoCount = assets.filter((a) => a.kind === "logo").length;
  const imageCount = assets.filter((a) => a.kind === "image").length;
  const sections: SetupSection[] = [
    {
      category: "colors",
      ready: draft.colors.length >= 4,
      reason: "The palette is still under 4 colors.",
      action: "Add color",
    },
    {
      category: "logos",
      ready: logoCount >= 1,
      reason: "Logos is still empty.",
      action: "Upload logo",
    },
    {
      category: "typography",
      ready: !!(draft.headingFont?.family && draft.bodyFont?.family),
      reason: "Fonts still need a heading and a body face.",
      action: "Set fonts",
    },
    {
      category: "type-styles",
      ready: draft.typeStyles.length >= 1,
      reason: "Type styles is still empty.",
      action: "Add style",
    },
    {
      category: "images",
      ready: imageCount >= 1,
      reason: "Images is still empty.",
      action: "Upload images",
    },
  ];
  const readyCount = sections.filter((s) => s.ready).length;
  const firstUnfinished = sections.find((s) => !s.ready);
  const allReady = !firstUnfinished;

  const dismiss = () => {
    setDismissed(true);
    if (!companyId) return;
    try {
      localStorage.setItem(dismissKey(companyId), "1");
    } catch {
      // Storage can be unavailable (private window); the strip just
      // reappears next visit.
    }
  };

  const startAddFlow = (section: SetupSection) => {
    requestAddFlow(section.category);
    navigate({ name: "brandStudio", category: section.category });
  };

  const showStrip = !loading && (!allReady || !dismissed);

  return (
    <>
      <PageHeader eyebrow={companyName} title="Brand Studio" />

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

      {showStrip && (
        <section className="sp-card sp-setup-strip">
          <div className="min-w-0">
            <p
              style={{
                fontFamily: "var(--font-ui)",
                fontWeight: "var(--weight-ui)" as React.CSSProperties["fontWeight"],
                fontSize: "var(--type-label-size)",
                color: "var(--text-primary)",
              }}
            >
              {allReady ? "All 5 sections ready" : `${readyCount} of 5 sections ready`}
            </p>
            <p style={{ fontSize: "var(--type-caption-size)", color: "var(--text-muted)" }}>
              {allReady ? "Your templates have everything they draw from." : firstUnfinished.reason}
            </p>
            <div className="sp-setup-strip__bars" aria-hidden>
              {sections.map((s) => (
                <span key={s.category} className="sp-setup-strip__bar" data-ready={s.ready} />
              ))}
            </div>
          </div>
          {allReady ? (
            <button className="sp-btn sp-btn-tertiary flex-shrink-0" onClick={dismiss}>
              Dismiss
            </button>
          ) : (
            <button
              className="sp-btn sp-btn-primary flex-shrink-0"
              onClick={() => startAddFlow(firstUnfinished)}
            >
              {firstUnfinished.action}
            </button>
          )}
        </section>
      )}

      {loading ? (
        <div className="sp-brand-overview-grid" aria-busy="true" aria-label="Loading Brand Studio">
          {CATEGORY_ORDER.map((category) => (
            <div key={category} className="sp-card sp-overview-card" aria-hidden>
              <Bone w="100%" h="auto" r="var(--radius-media)" style={{ aspectRatio: "3 / 2" }} />
              <span className="sp-overview-card__label-row">
                <Bone w={64} h={13} />
                <Bone w={48} h={10} />
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="sp-brand-overview-grid">
          {CATEGORY_ORDER.map((category) => {
            const route = { name: "brandStudio" as const, category };
            return (
              <a
                key={category}
                href={routeToUrl(route)}
                onClick={linkClick(route)}
                aria-label={`Edit ${CATEGORY_TITLES[category]}`}
                className="sp-card sp-overview-card sp-has-overlay"
              >
                <span className="sp-overview-card__cover">
                  <img src={COVERS[category]} alt="" />
                  <EditOverlay />
                </span>
                <span className="sp-overview-card__label-row">
                  <span className="sp-overview-card__name">{CATEGORY_TITLES[category]}</span>
                  <span className="sp-eyebrow">{categoryCount(category, draft, assets)}</span>
                </span>
              </a>
            );
          })}
        </div>
      )}
    </>
  );
}
