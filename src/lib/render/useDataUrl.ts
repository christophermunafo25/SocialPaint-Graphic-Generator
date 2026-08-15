import { useEffect, useState } from "react";
import { resolveImageUrl } from "@/lib/stores/supabase/signedUrls";

/** Keyed by the ORIGINAL source (storage reference or URL), not the signed
 * URL — signatures rotate, the underlying object doesn't, so one fetch
 * serves the whole session regardless of signature renewals. */
const cache = new Map<string, string>();

export interface DataUrlResult {
  /** The embeddable data URL, once resolved. */
  dataUrl: string | null;
  /** A fetch (or signing) is in flight — the canvas is NOT ready to
   * rasterize yet, and the export gate waits on this. */
  loading: boolean;
  /** Signing or fetching failed. The image will not appear in an export, so
   * the export refuses rather than hand over a picture with a hole. */
  failed: boolean;
}

/** Already embeddable without a fetch: data URLs, and anything cached. */
const resolvedNow = (url: string | undefined): string | null =>
  !url ? null : url.startsWith("data:") ? url : (cache.get(url) ?? null);

/** Fetch a (possibly remote) image and return it as a data URL.
 *
 * Load-bearing for export: html-to-image silently drops cross-origin images,
 * so everything rendered on the canvas — Storage backgrounds, logos, member
 * uploads — must be a data URL before toPng runs. URLs that are already
 * data: pass through. Storage references are signed first (signedUrls.ts);
 * once the bytes are in this cache, signature expiry can't touch them. The
 * loading/failed flags let the export gate wait for images and refuse when
 * one is missing.
 */
export function useDataUrl(url: string | undefined): DataUrlResult {
  const [result, setResult] = useState<DataUrlResult>(() => {
    const hit = resolvedNow(url);
    return { dataUrl: hit, loading: Boolean(url) && !hit, failed: false };
  });

  useEffect(() => {
    if (!url) {
      setResult({ dataUrl: null, loading: false, failed: false });
      return;
    }
    const hit = resolvedNow(url);
    if (hit) {
      setResult({ dataUrl: hit, loading: false, failed: false });
      return;
    }
    setResult({ dataUrl: null, loading: true, failed: false });
    let cancelled = false;
    void (async () => {
      try {
        const fetchable = await resolveImageUrl(url);
        if (fetchable === null) throw new Error("could not sign the storage reference");
        const response = await fetch(fetchable);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        cache.set(url, dataUrl);
        if (!cancelled) setResult({ dataUrl, loading: false, failed: false });
      } catch (e) {
        // Deliberately NOT cached: a network blip, or a signature that
        // failed once, must not permanently poison this source.
        console.error("Image load failed", url, e);
        if (!cancelled) setResult({ dataUrl: null, loading: false, failed: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  return result;
}
