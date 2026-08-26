// Public template links — token minting, storage-reference handling, and the
// response shaping for the anonymous read path.
//
// Everything here is pure or Web-Crypto only, so the vitest suite under Node
// exercises the parts that decide what an anonymous visitor receives. Nothing
// at module level may touch Deno.

/** 32 bytes = 256 bits from the platform CSPRNG. Guessing is not a strategy:
 * an attacker running a billion attempts a second against every link we will
 * ever issue does not meaningfully dent the space. Rendered base64url, which
 * is 43 URL-safe characters and survives an email client's link mangling. */
export const TOKEN_BYTES = 32;

/** Nothing longer is worth hashing. Over-length input is NOT a distinct
 * error — it takes the same refusal as any other bad token, because a
 * distinguishable rejection turns the endpoint into an oracle. */
export const MAX_TOKEN_CHARS = 256;

/** How long a public asset signature lives. Long enough that a visitor
 * filling a form on a slow phone connection never watches an image vanish,
 * short enough that a leaked URL is worthless by the time it is pasted
 * anywhere. Renewal without a session is a re-read of the same link (the
 * public page re-calls the read endpoint), but it is rarely needed: the
 * canvas converts every image to a session-cached data URL on first fetch,
 * so a signature only has to survive mint → first fetch. */
export const PUBLIC_SIGNED_URL_TTL_S = 300;

const B64URL = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

/** A fresh link token. Server-side only — the client never mints one, and
 * the plaintext is returned exactly once, at creation. */
export function mintToken(): string {
  return B64URL(crypto.getRandomValues(new Uint8Array(TOKEN_BYTES)));
}

/** SHA-256, lowercase hex. What the database stores: a hash is not a working
 * key, so a database dump does not hand anyone a customer's template.
 *
 * Deliberately NOT keyed or salted per row. A 256-bit random token has no
 * guessable structure to protect against offline search, and a plain digest
 * keeps lookup to one indexed equality — which is what makes a revoked token
 * and a never-existed token cost the same. */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------------------
// Storage references
// ---------------------------------------------------------------------------

/** Mirrors src/lib/stores/storageRef.ts. Duplicated rather than shared
 * because Edge Functions and the app have no common module graph — the same
 * reason _shared/validate.ts carries its own storage-URL parsing. Both sides
 * are covered by tests; if one changes, the other has to follow. */
export const PUBLIC_BUCKETS = ["brand-assets", "template-backgrounds"] as const;
export type PublicBucket = (typeof PUBLIC_BUCKETS)[number];

export interface StorageRef {
  bucket: PublicBucket;
  path: string;
}

const LEGACY_PUBLIC_URL =
  /^https?:\/\/[^/]+\/storage\/v1\/object\/public\/(brand-assets|template-backgrounds)\/(.+)$/;

/** Parse a persisted image value into a bucket-qualified reference, or null
 * when it is not one (an external URL, a data URL, an empty string). */
export function parseStorageRef(src: string | null | undefined): StorageRef | null {
  if (!src) return null;
  for (const bucket of PUBLIC_BUCKETS) {
    if (src.startsWith(`${bucket}/`)) {
      const path = src.slice(bucket.length + 1);
      return path ? { bucket, path } : null;
    }
  }
  const m = LEGACY_PUBLIC_URL.exec(src);
  if (m) return { bucket: m[1] as PublicBucket, path: m[2] };
  return null;
}

/** A persisted column value that carries an implied bucket (a bare object
 * path from a legacy row) resolved to a reference. */
export function refWithImpliedBucket(
  impliedBucket: PublicBucket,
  value: string | null | undefined,
): StorageRef | null {
  if (!value) return null;
  const explicit = parseStorageRef(value);
  if (explicit) return explicit;
  if (/^(https?|data|blob):/.test(value)) return null; // genuinely external
  return { bucket: impliedBucket, path: value };
}

export const refKey = (ref: StorageRef): string => `${ref.bucket}/${ref.path}`;

// ---------------------------------------------------------------------------
// What a schema actually references
//
// The rule everywhere below: an anonymous visitor receives the values their
// template renders with, and not one thing more. A palette entry no field
// binds to, a type style no field names, an uploaded font no field uses —
// none of it crosses the boundary.
// ---------------------------------------------------------------------------

export interface FieldLike {
  type?: string | null;
  is_static?: boolean | null;
  static_value?: string | null;
  type_style_key?: string | null;
  font_family?: string | null;
}

export interface TypeStyleLike {
  key: string;
  font?: { source?: string; family?: string } | null;
  colorKey?: string | null;
}

export interface FontAssetLike {
  name: string;
  metadata?: { family?: string } | null;
}

/** The type styles the fields bind to, by key. */
export function referencedTypeStyleKeys(fields: FieldLike[]): Set<string> {
  return new Set(fields.map((f) => f.type_style_key).filter((k): k is string => Boolean(k)));
}

/** The palette keys that will be looked up at render time.
 *
 * Only a BOUND TYPE STYLE carries a live palette binding — a field's own
 * colour is a copied hex (see resolveFieldStyle). So the referenced palette
 * is exactly the colorKeys of the type styles the fields use, and a brand's
 * other colours never leave the tenant. */
export function referencedColorKeys(fields: FieldLike[], typeStyles: TypeStyleLike[]): Set<string> {
  const bound = referencedTypeStyleKeys(fields);
  const keys = new Set<string>();
  for (const style of typeStyles) {
    if (!bound.has(style.key)) continue;
    if (style.colorKey) keys.add(style.colorKey);
  }
  return keys;
}

/** Every font family the schema renders with: a bound type style's family
 * wins over the field's own, exactly as resolveFieldStyle resolves it. */
export function referencedFontFamilies(
  fields: FieldLike[],
  typeStyles: TypeStyleLike[],
): Set<string> {
  const byKey = new Map(typeStyles.map((s) => [s.key, s]));
  const families = new Set<string>();
  for (const field of fields) {
    const style = field.type_style_key ? byKey.get(field.type_style_key) : undefined;
    const family = style?.font?.family ?? field.font_family;
    if (family) families.add(family);
  }
  return families;
}

/** The family an uploaded font asset registers under. Mirrors
 * registerCustomFont in src/lib/render/fonts.ts byte for byte — if the two
 * disagree, a template silently exports in a fallback typeface, which is
 * exactly the kind of quiet wrongness this feature must not produce. */
export function fontAssetFamily(asset: FontAssetLike): string {
  return asset.metadata?.family ?? asset.name.replace(/\.[^.]+$/, "");
}

/** Every storage object the schema paints: the background, plus each static
 * image element's value. Member-filled image fields are not here — those are
 * data URLs cropped in the visitor's own browser and never touch storage. */
export function schemaAssetRefs(
  backgroundPath: string | null | undefined,
  fields: FieldLike[],
): StorageRef[] {
  const refs = new Map<string, StorageRef>();
  const add = (ref: StorageRef | null) => {
    if (ref) refs.set(refKey(ref), ref);
  };
  add(refWithImpliedBucket("template-backgrounds", backgroundPath));
  for (const field of fields) {
    if (field.type !== "image") continue;
    add(refWithImpliedBucket("brand-assets", field.static_value));
  }
  return [...refs.values()];
}

// ---------------------------------------------------------------------------
// Caller identity for rate limiting
// ---------------------------------------------------------------------------

/** The caller's address, as the edge reports it. Used ONLY as a rate-limit
 * key, and hashed with a server-side pepper before it is stored — we count
 * events, not people, and there is no identity graph to build from a
 * one-day-retention counter row. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("cf-connecting-ip") ?? headers.get("x-real-ip") ?? "unknown";
}
