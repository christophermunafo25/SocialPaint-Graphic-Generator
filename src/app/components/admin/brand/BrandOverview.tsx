import React, { useState } from "react";
import { useBrand } from "@/lib/brand/BrandContext";
import { routeToUrl, useRouter, type BrandCategory } from "../../../router";
import { PageHeader } from "../../layout/Page";
import { Button, PreviewOverlay } from "../../primitives";
import { roleStyle } from "@/lib/brand/fontRoles";
import { requestAddFlow } from "./addFlow";
import { CATEGORY_ORDER, CATEGORY_TITLES, categoryCount } from "./categories";
import type { BrandDraft } from "./kitPlumbing";
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
  /** The action opens the page without starting its add flow (the fonts
   * check, which is about roles, not a new style). */
  openOnly?: boolean;
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

/** The overview (13:9043): the setup strip, then three columns of category
 * cards. Each card is a REAL link to its detail page; its cover carries the
 * edit overlay on hover and keyboard focus, drawn as part of the card
 * (PHASE-6 §9 D8). */
export function BrandOverview({ brand, companyId }: { brand: BrandDraft; companyId?: string }) {
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
      // The fonts check reads Type styles (PHASE-6 §9 D3): ready when one
      // style is used for Heading and one for Body.
      category: "type-styles",
      ready: !!(roleStyle(draft, "heading") && roleStyle(draft, "body")),
      reason: "Type styles still need a Heading and a Body.",
      action: "Set fonts",
      openOnly: true,
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
    if (!section.openOnly) requestAddFlow(section.category);
    navigate({ name: "brandStudio", category: section.category });
  };

  const showStrip = !loading && (!allReady || !dismissed);

  return (
    <>
      <PageHeader title="Brand Studio" />

      <div className="sp-bs-overview">
        {brand.error && (
          <p className="t-body-s sp-bs-error" role="alert">
            {brand.error}
          </p>
        )}

        {showStrip && (
          <section className="sp-bs-strip" aria-label="Setup">
            <div className="sp-bs-strip__progress">
              <p className="sp-bs-strip__status">
                <span className="t-button-m">
                  {allReady ? "All 5 sections ready" : `${readyCount} of 5 sections ready`}
                </span>
                {!allReady && (
                  <span className="t-label-xs sp-bs-strip__reason">{firstUnfinished.reason}</span>
                )}
              </p>
              <div className="sp-bs-strip__bars" aria-hidden>
                {sections.map((s, i) => (
                  <span key={i} className="sp-bs-strip__bar" data-ready={s.ready} />
                ))}
              </div>
            </div>
            {allReady ? (
              <Button kind="neutral" onClick={dismiss}>
                Dismiss
              </Button>
            ) : (
              <Button kind="primary" onClick={() => startAddFlow(firstUnfinished)}>
                {firstUnfinished.action}
              </Button>
            )}
          </section>
        )}

        {loading ? (
          <div className="sp-bs-overview__grid" aria-busy="true" aria-label="Loading Brand Studio">
            {CATEGORY_ORDER.map((category) => (
              <div key={category} className="sp-bs-cat" aria-hidden>
                <span className="sp-bs-cat__cover" />
                <span className="sp-bs-cat__meta">
                  <span className="sp-bs-bone" style={{ width: 64, height: 10 }} />
                  <span className="sp-bs-bone" style={{ width: 48, height: 8 }} />
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="sp-bs-overview__grid">
            {CATEGORY_ORDER.map((category) => {
              const route = { name: "brandStudio" as const, category };
              return (
                <a
                  key={category}
                  href={routeToUrl(route)}
                  onClick={linkClick(route)}
                  aria-label={`Edit ${CATEGORY_TITLES[category]}`}
                  className="ui-ring sp-bs-cat"
                >
                  <PreviewOverlay decorative className="sp-bs-cat__cover">
                    <img src={COVERS[category]} alt="" />
                  </PreviewOverlay>
                  <span className="sp-bs-cat__meta">
                    <span className="t-label-l sp-bs-cat__title">{CATEGORY_TITLES[category]}</span>
                    <span className="t-label-xs sp-bs-cat__count">
                      {categoryCount(category, draft, assets)}
                    </span>
                  </span>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
