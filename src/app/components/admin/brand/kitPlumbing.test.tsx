import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { BrandKit } from "@/lib/types";
import { useBrandDraft } from "./kitPlumbing";
import { useInPlaceEdit } from "./primitives/useInPlaceEdit";

const KIT: BrandKit = {
  id: "kit-1",
  companyId: "co-1",
  colors: [{ key: "primary", name: "Slime", hex: "#17FF7E" }],
  typeStyles: [],
  guidelines: [],
  primaryLogoAssetId: "logo-a",
  primaryLogoDarkAssetId: "logo-a",
  primaryLogoLightAssetId: "logo-a",
} as unknown as BrandKit;

vi.mock("@/lib/auth/AuthContext", () => ({ useAuth: () => ({ company: { id: "co-1" } }) }));
vi.mock("@/lib/brand/BrandContext", () => ({
  useBrand: () => ({ kit: KIT, assets: [], refresh: async () => {} }),
}));
vi.mock("@/lib/stores", () => ({ stores: { brandKits: { upsert: async () => {} } } }));

function useStudio() {
  const brand = useBrandDraft();
  const edit = useInPlaceEdit(brand);
  return { brand, edit };
}

describe("useBrandDraft (PHASE-6 §9)", () => {
  it("Escape drops the cancelled edit's undo steps, keeping the ones before it", () => {
    const { result } = renderHook(() => useStudio());
    act(() => result.current.brand.commit({ allowOffPalette: false }));
    expect(result.current.brand.historyDepth).toBe(1);

    act(() => result.current.edit.start("primary"));
    act(() =>
      result.current.brand.commit({
        colors: [{ key: "primary", name: "Lime", hex: "#17FF7E" }],
      }),
    );
    act(() =>
      result.current.brand.commit({
        colors: [{ key: "primary", name: "Lime", hex: "#000000" }],
      }),
    );
    expect(result.current.brand.historyDepth).toBe(3);

    act(() => result.current.edit.cancel());
    expect(result.current.brand.draft.colors[0].name).toBe("Slime");
    expect(result.current.brand.historyDepth).toBe(1);

    // Undo now reaches the step before the edit, never part of the edit.
    act(() => result.current.brand.undo());
    expect(result.current.brand.draft.allowOffPalette).toBe(true);
    expect(result.current.brand.draft.colors[0].name).toBe("Slime");
  });

  it("a removed primary logo can't come back through Undo", () => {
    const { result } = renderHook(() => useStudio());
    // An earlier step that names logo-a as the primary.
    act(() => result.current.brand.commit({ allowOffPalette: false }, { message: "Changed" }));
    act(() =>
      result.current.brand.forgetAsset("logo-a", {
        primaryLogoAssetId: "logo-b",
        primaryLogoDarkAssetId: "logo-b",
        primaryLogoLightAssetId: "logo-b",
      }),
    );
    expect(result.current.brand.historyDepth).toBe(1);
    expect(result.current.brand.undoOffer?.snapshot.primaryLogoDarkAssetId).toBe("logo-b");

    act(() => result.current.brand.undo());
    expect(result.current.brand.draft.primaryLogoAssetId).toBe("logo-b");
    expect(result.current.brand.draft.primaryLogoDarkAssetId).toBe("logo-b");
    expect(result.current.brand.draft.allowOffPalette).toBe(true);
  });
});
