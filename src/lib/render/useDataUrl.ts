import { useEffect, useState } from "react";

const cache = new Map<string, string>();

/** Fetch a (possibly remote) image and return it as a data URL.
 *
 * Load-bearing for export: html-to-image silently drops cross-origin images,
 * so everything rendered on the canvas — Storage backgrounds, logos — must be
 * a data URL before toPng runs. Ported from the reference Generator's
 * background/facility-logo pipeline. URLs that are already data: pass through.
 */
export function useDataUrl(url: string | undefined): string | null {
  const [dataUrl, setDataUrl] = useState<string | null>(() =>
    url?.startsWith("data:") ? url : (url && cache.get(url)) || null,
  );

  useEffect(() => {
    if (!url) {
      setDataUrl(null);
      return;
    }
    if (url.startsWith("data:")) {
      setDataUrl(url);
      return;
    }
    const cached = cache.get(url);
    if (cached) {
      setDataUrl(cached);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const result = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        cache.set(url, result);
        if (!cancelled) setDataUrl(result);
      } catch (e) {
        console.error("Image load failed", url, e);
        if (!cancelled) setDataUrl(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  return dataUrl;
}
