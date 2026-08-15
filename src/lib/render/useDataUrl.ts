import { useEffect, useState } from "react";
import { resolveImageUrl } from "@/lib/stores/supabase/signedUrls";

/** Keyed by the ORIGINAL source (storage reference or URL), not the signed
 * URL — signatures rotate, the underlying object doesn't, so one fetch
 * serves the whole session regardless of signature renewals. */
const cache = new Map<string, string>();

export interface DataUrlResult {
  dataUrl: string | null;
  /** Signing or fetching failed. Distinct from loading (dataUrl null,
   * failed false) so slots can show a real failed state. */
  failed: boolean;
}

/** Fetch a (possibly remote) image and return it as a data URL.
 *
 * Load-bearing for export: html-to-image silently drops cross-origin images,
 * so everything rendered on the canvas — Storage backgrounds, logos — must be
 * a data URL before toPng runs. Ported from the reference Generator's
 * background/facility-logo pipeline. URLs that are already data: pass
 * through. Storage references are signed first (signedUrls.ts); once the
 * bytes are in this cache, signature expiry can't touch them. */
export function useDataUrl(url: string | undefined): DataUrlResult {
  const [result, setResult] = useState<DataUrlResult>(() => ({
    dataUrl: url?.startsWith("data:") ? url : (url && cache.get(url)) || null,
    failed: false,
  }));

  useEffect(() => {
    if (!url) {
      setResult({ dataUrl: null, failed: false });
      return;
    }
    if (url.startsWith("data:")) {
      setResult({ dataUrl: url, failed: false });
      return;
    }
    const cached = cache.get(url);
    if (cached) {
      setResult({ dataUrl: cached, failed: false });
      return;
    }
    let cancelled = false;
    setResult({ dataUrl: null, failed: false });
    void (async () => {
      try {
        const fetchable = await resolveImageUrl(url);
        if (fetchable === null) throw new Error("could not sign the storage reference");
        const response = await fetch(fetchable);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        const result = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        cache.set(url, result);
        if (!cancelled) setResult({ dataUrl: result, failed: false });
      } catch (e) {
        console.error("Image load failed", url, e);
        if (!cancelled) setResult({ dataUrl: null, failed: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  return result;
}
