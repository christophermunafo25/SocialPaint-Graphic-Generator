import { useEffect, useState } from "react";
import { parseStorageRef } from "@/lib/stores/storageRef";
import {
  peekImageUrl,
  resolveImageUrl,
  SIGNED_URL_REFRESH_MS,
} from "@/lib/stores/supabase/signedUrls";

export interface SignedImage {
  /** Fetchable src for an <img>, or null while loading / after failure. */
  url: string | null;
  /** Signing failed — show a clear failed state, not a broken image icon. */
  failed: boolean;
}

/** Resolve an image source (storage reference, external URL, or data URL)
 * to something an <img> can load right now. References are signed with a
 * short TTL and renewed on an interval while the component stays mounted —
 * before expiry, never after a failure — so an asset never vanishes from an
 * open session because a signature aged out. */
export function useSignedUrl(src: string | undefined): SignedImage {
  const [state, setState] = useState<SignedImage>(() => ({
    url: src ? peekImageUrl(src) : null,
    failed: false,
  }));

  useEffect(() => {
    if (!src) {
      setState({ url: null, failed: false });
      return;
    }
    if (!parseStorageRef(src)) {
      setState({ url: src, failed: false });
      return;
    }
    let disposed = false;
    const refresh = async () => {
      const url = await resolveImageUrl(src);
      if (disposed) return;
      setState((prev) =>
        prev.url === url && prev.failed === (url === null) ? prev : { url, failed: url === null },
      );
    };
    void refresh();
    const timer = setInterval(() => void refresh(), SIGNED_URL_REFRESH_MS);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [src]);

  return state;
}
