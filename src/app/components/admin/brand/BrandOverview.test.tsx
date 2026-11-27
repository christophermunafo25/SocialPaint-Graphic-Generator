import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import type { BrandDraft } from "./kitPlumbing";

const brandState = vi.hoisted(() => ({ loading: true }));
vi.mock("@/lib/brand/BrandContext", () => ({ useBrand: () => brandState }));
vi.mock("../../../router", () => ({
  routeToUrl: () => "/brand-studio",
  useRouter: () => ({ navigate: () => {} }),
}));
vi.mock("./useLinkClick", () => ({ useLinkClick: () => () => () => {} }));
vi.mock("../../SignedImg", () => ({
  SignedImg: ({ src }: { src: string }) => <img src={src} alt="" />,
}));

const { BrandOverview } = await import("./BrandOverview");

const brand = (colors: { key: string; name: string; hex: string }[] = []) =>
  ({ draft: { colors, typeStyles: [] }, assets: [], error: null }) as unknown as BrandDraft;

describe("BrandOverview's covers", () => {
  it("loads each cover as a skeleton in the cover's shape", () => {
    brandState.loading = true;
    const { container } = render(<BrandOverview brand={brand()} />);
    const covers = container.querySelectorAll(".sp-bs-cat__cover");
    expect(covers).toHaveLength(6);
    for (const cover of covers) expect(cover.classList.contains("ui-skeleton")).toBe(true);
  });

  it("draws a content cover for a category with content, the shared art for the rest", () => {
    brandState.loading = false;
    const { container } = render(
      <BrandOverview brand={brand([{ key: "primary", name: "Primary", hex: "#2F3B4C" }])} />,
    );
    const covers = Array.from(container.querySelectorAll(".sp-bs-cat__cover"));
    expect(covers).toHaveLength(6);
    // Colors has content; Logos, Fonts, Type styles, Images and Import don't.
    expect(covers[0].querySelector('.sp-bs-cover[data-kind="colors"]')).not.toBeNull();
    for (const cover of covers.slice(1)) {
      expect(cover.querySelector(".sp-bs-cover")).toBeNull();
      expect(cover.querySelector("img")).not.toBeNull();
    }
  });
});
