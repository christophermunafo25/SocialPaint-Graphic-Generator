import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { BrandAsset, BrandKit } from "../types";
import { stores } from "../stores";
import { useAuth } from "../auth/AuthContext";
import { applyBrandTheme } from "../theme";
import { loadBrandFonts } from "../render/fonts";

/** Loads the active company's brand kit and assets; applies the
 * CSS-variable theme and loads brand fonts. Everything brand-aware (renderer,
 * builder, studio, chrome) reads from here. */
interface BrandState {
  loading: boolean;
  /** Set when the initial load failed — consumers should show an error state
   * (with `retry`) instead of rendering against a missing brand kit. */
  error: Error | null;
  kit: BrandKit | null;
  assets: BrandAsset[];
  primaryLogoUrl: string | null;
  refresh(): Promise<void>;
  /** Re-runs the failed load in place. */
  retry(): void;
}

const BrandContext = createContext<BrandState | null>(null);

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const { company } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [kit, setKit] = useState<BrandKit | null>(null);
  const [assets, setAssets] = useState<BrandAsset[]>([]);
  const [tick, setTick] = useState(0);
  const retry = useCallback(() => setTick((t) => t + 1), []);

  const refresh = useCallback(async () => {
    if (!company) {
      setKit(null);
      setAssets([]);
      applyBrandTheme(null);
      return;
    }
    const [nextKit, nextAssets] = await Promise.all([
      stores.brandKits.getActive(company.id),
      stores.brandAssets.list(company.id),
    ]);
    setKit(nextKit);
    setAssets(nextAssets);
    applyBrandTheme(nextKit);
    if (nextKit) {
      await loadBrandFonts(
        nextKit,
        nextAssets.filter((a) => a.kind === "font"),
      );
    }
  }, [company]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    refresh()
      .catch((e) => {
        console.error("Brand load failed", e);
        if (alive) setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [refresh, tick]);

  const primaryLogoUrl = useMemo(() => {
    const primary = assets.find((a) => a.id === kit?.primaryLogoAssetId);
    return (primary ?? assets.find((a) => a.kind === "logo"))?.url ?? null;
  }, [assets, kit]);

  const value = useMemo<BrandState>(
    () => ({ loading, error, kit, assets, primaryLogoUrl, refresh, retry }),
    [loading, error, kit, assets, primaryLogoUrl, refresh, retry],
  );

  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

export function useBrand(): BrandState {
  const ctx = useContext(BrandContext);
  if (!ctx) throw new Error("useBrand must be used inside BrandProvider");
  return ctx;
}

/** The brand when there is one to read. Null outside a BrandProvider — the
 * public link page, which mounts none — so a component shared between the
 * member and public paths can offer brand assets only where they exist
 * rather than throwing where they do not. */
export function useBrandOptional(): BrandState | null {
  return useContext(BrandContext);
}
