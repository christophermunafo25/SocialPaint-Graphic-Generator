/** Storage references — the persisted, sign-on-read form of an image source.
 *
 * A reference is "{bucket}/{objectPath}" naming one of our two private
 * buckets. Persisted image columns (templates.background_storage_path,
 * template_fields.static_value, brand_assets.storage_path) hold either a
 * reference, a bare object path (legacy rows; the bucket is implied by the
 * column), or a genuinely external URL. Migration 0022 rewrote our own
 * public-bucket URLs into references; parsing still accepts that URL form as
 * defense in depth — e.g. a tab opened before the cutover saving a draft
 * after it.
 *
 * The two forms can't collide: object paths always start with a company
 * UUID, never a bucket name.
 *
 * Pure string logic — no Supabase client, safe for tests and local mode.
 */

export const BUCKETS = {
  brandAssets: "brand-assets",
  templateBackgrounds: "template-backgrounds",
} as const;

export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS];

const BUCKET_LIST = Object.values(BUCKETS);

const LEGACY_PUBLIC_URL =
  /^https?:\/\/[^/]+\/storage\/v1\/object\/public\/(brand-assets|template-backgrounds)\/(.+)$/;

export interface StorageRef {
  bucket: BucketName;
  path: string;
}

/** Parse an image source into a storage reference, or null when it isn't
 * one (data:/blob: URLs, external hosts, bare paths with no bucket context). */
export function parseStorageRef(src: string): StorageRef | null {
  for (const bucket of BUCKET_LIST) {
    if (src.startsWith(`${bucket}/`)) {
      const path = src.slice(bucket.length + 1);
      return path ? { bucket, path } : null;
    }
  }
  const m = LEGACY_PUBLIC_URL.exec(src);
  if (m) return { bucket: m[1] as BucketName, path: m[2] };
  return null;
}

export const formatStorageRef = (bucket: BucketName, path: string): string => `${bucket}/${path}`;

/** Normalize a persisted column value into an image source: references and
 * external URLs pass through, bare paths pick up the column's implied
 * bucket, legacy public URLs collapse to references. */
export function toImageSource(impliedBucket: BucketName, value: string): string {
  if (/^(https?|data|blob):/.test(value)) {
    const ref = parseStorageRef(value);
    return ref ? formatStorageRef(ref.bucket, ref.path) : value;
  }
  return parseStorageRef(value) ? value : formatStorageRef(impliedBucket, value);
}
