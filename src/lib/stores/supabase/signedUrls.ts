import { supabase } from "./client";
import { parseStorageRef, type StorageRef } from "../storageRef";

/** Signed-URL layer: turns storage references into short-lived fetchable
 * URLs. Replaces publicUrl() — the buckets are private as of migration 0022.
 *
 * TTL 600s: every canvas image becomes a session-cached data URL on first
 * fetch (useDataUrl), and anything showing a raw signed URL sits behind
 * useSignedUrl, which renews while mounted — so a signature only has to
 * survive mint → first fetch. Ten minutes is generous margin for slow
 * connections and backgrounded tabs while keeping a leaked URL short-lived.
 * Do NOT lengthen it to paper over a fetch problem; fix the fetch. */
export const SIGNED_URL_TTL_S = 600;

/** Renewal is proactive: a URL inside this margin of expiry is re-signed on
 * next access (stale-while-renew) — never in response to a failure. */
const RENEW_MARGIN_MS = 120_000;

/** How often a mounted useSignedUrl consumer re-checks. Comfortably inside
 * TTL − margin, so anything mounted longer than one TTL gets a fresh URL
 * before the old one dies. */
export const SIGNED_URL_REFRESH_MS = 240_000;

interface Entry {
  url: string;
  expiresAt: number;
}

/** key: "{bucket}/{path}". Lives for the SPA session — "the life of a page
 * view" — so a canvas with a dozen assets signs each once, not per render. */
const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<string | null>>();

/** Same-tick requests coalesce into ONE createSignedUrls call per bucket —
 * a template canvas or the portal grid requests many refs at once. */
const queued = new Map<string, Array<{ path: string; resolve(u: string | null): void }>>();
let flushScheduled = false;

const keyOf = (ref: StorageRef) => `${ref.bucket}/${ref.path}`;

/** Synchronous cache peek, for initial React state (avoids a placeholder
 * flash when the ref was already signed this session). Non-refs pass
 * through: they're already fetchable. */
export function peekImageUrl(src: string): string | null {
  const ref = parseStorageRef(src);
  if (!ref) return src;
  const hit = cache.get(keyOf(ref));
  return hit && hit.expiresAt > Date.now() ? hit.url : null;
}

/** Resolve any image source to something fetchable right now. Storage
 * references are signed (cached, batched, proactively renewed); data:,
 * blob:, and external URLs pass through untouched. Null = signing failed —
 * callers must show a failed state, not a broken image. */
export function resolveImageUrl(src: string): Promise<string | null> {
  const ref = parseStorageRef(src);
  if (!ref) return Promise.resolve(src);
  const key = keyOf(ref);
  const hit = cache.get(key);
  if (hit) {
    const remaining = hit.expiresAt - Date.now();
    if (remaining > RENEW_MARGIN_MS) return Promise.resolve(hit.url);
    if (remaining > 0) {
      // Still valid but aging: hand out the current URL, renew in the
      // background so the next consumer gets a fresh one.
      void enqueue(ref);
      return Promise.resolve(hit.url);
    }
  }
  return enqueue(ref);
}

function enqueue(ref: StorageRef): Promise<string | null> {
  const key = keyOf(ref);
  const existing = inflight.get(key);
  if (existing) return existing;
  const promise = new Promise<string | null>((resolve) => {
    const list = queued.get(ref.bucket) ?? [];
    list.push({ path: ref.path, resolve });
    queued.set(ref.bucket, list);
    if (!flushScheduled) {
      flushScheduled = true;
      setTimeout(() => {
        flushScheduled = false;
        void flush();
      }, 0);
    }
  }).finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

async function flush(): Promise<void> {
  const batches = new Map(queued);
  queued.clear();
  await Promise.all(
    [...batches].map(async ([bucket, items]) => {
      try {
        // inflight dedups per ref, so paths here are already unique.
        const { data, error } = await supabase()
          .storage.from(bucket)
          .createSignedUrls(
            items.map((i) => i.path),
            SIGNED_URL_TTL_S,
          );
        if (error) throw error;
        const byPath = new Map(data.map((d) => [d.path, d]));
        const mintedAt = Date.now();
        for (const item of items) {
          const d = byPath.get(item.path);
          if (d?.signedUrl && !d.error) {
            cache.set(`${bucket}/${item.path}`, {
              url: d.signedUrl,
              // Slightly conservative (mintedAt is post-response), which only
              // renews earlier — never hands out a dead URL.
              expiresAt: mintedAt + SIGNED_URL_TTL_S * 1000,
            });
            item.resolve(d.signedUrl);
          } else {
            console.error("Signing failed", bucket, item.path, d?.error ?? "not in response");
            item.resolve(null);
          }
        }
      } catch (e) {
        // Failures are not cached: the next request retries, and mounted
        // useSignedUrl consumers retry on their refresh interval.
        console.error("Signing request failed", bucket, e);
        items.forEach((i) => i.resolve(null));
      }
    }),
  );
}
