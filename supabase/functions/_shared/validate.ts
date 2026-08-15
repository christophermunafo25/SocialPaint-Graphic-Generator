// Request-body validation shared by every Edge Function. Each helper either
// returns the typed value or throws an HttpError(400) that names the bad
// field WITHOUT echoing its value (values may be attacker-chosen and land in
// logs or error UIs). Pure except where noted, so vitest covers it under Node.

import { HttpError, allowlistCsv, originAllowed } from "./http.ts";

/** Parse the JSON body, or 400 — a bare `await req.json()` would surface a
 * SyntaxError as a 500. */
export async function parseBody(req: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new HttpError(400, "Request body must be JSON.");
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new HttpError(400, "Request body must be a JSON object.");
  }
  return body as Record<string, unknown>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function requireUuid(v: unknown, field: string): string {
  if (typeof v !== "string" || !UUID_RE.test(v)) {
    throw new HttpError(400, `${field} must be a UUID.`);
  }
  return v;
}

export function requireString(v: unknown, field: string, maxLen = 2048): string {
  if (typeof v !== "string" || !v.length || v.length > maxLen) {
    throw new HttpError(400, `${field} must be a non-empty string (at most ${maxLen} characters).`);
  }
  return v;
}

export function optionalString(v: unknown, field: string, maxLen = 2048): string | undefined {
  if (v === undefined || v === null) return undefined;
  return requireString(v, field, maxLen);
}

export function requireEnum<T extends string>(v: unknown, field: string, allowed: readonly T[]): T {
  if (typeof v !== "string" || !(allowed as readonly string[]).includes(v)) {
    throw new HttpError(400, `${field} must be one of: ${allowed.join(", ")}.`);
  }
  return v as T;
}

export function optionalEnum<T extends string>(
  v: unknown,
  field: string,
  allowed: readonly T[],
): T | undefined {
  if (v === undefined || v === null) return undefined;
  return requireEnum(v, field, allowed);
}

export function requireNumber(
  v: unknown,
  field: string,
  { min, max }: { min: number; max: number },
): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max) {
    throw new HttpError(400, `${field} must be a number between ${min} and ${max}.`);
  }
  return v;
}

export function requireStringArray(
  v: unknown,
  field: string,
  { maxItems, maxLen }: { maxItems: number; maxLen: number },
): string[] {
  if (
    !Array.isArray(v) ||
    !v.length ||
    v.length > maxItems ||
    v.some((s) => typeof s !== "string" || !s.length || s.length > maxLen)
  ) {
    throw new HttpError(400, `${field} must be a non-empty array of strings.`);
  }
  return v as string[];
}

// A permissive shape check — real validation is the invite provider's job;
// this just rejects obvious garbage without bouncing unusual-but-real
// addresses.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function requireEmail(v: unknown, field: string): string {
  if (typeof v !== "string" || v.length > 320 || !EMAIL_RE.test(v)) {
    throw new HttpError(400, `${field} must be an email address.`);
  }
  return v;
}

/** Is this host `domain` or a subdomain of it? Substring tricks like
 * `evilfigma.com` or `figma.com.evil.com` do not pass. */
export function hostOnDomain(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

/** Parse a Figma file/design URL's file key, with the host pinned to
 * figma.com — a figma.com-shaped path on some other host does not pass. */
export function parseFigmaFileKey(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || !hostOnDomain(u.hostname, "figma.com")) return null;
  return u.pathname.match(/^\/(?:file|design)\/([a-zA-Z0-9]+)(?:\/|$)/)?.[1] ?? null;
}

/** Parse a Figma frame URL into { fileKey, nodeId }, host pinned as above. */
export function parseFigmaUrl(url: string): { fileKey: string; nodeId: string } | null {
  const fileKey = parseFigmaFileKey(url);
  if (!fileKey) return null;
  const rawNodeId = new URL(url).searchParams.get("node-id");
  if (!rawNodeId) return null;
  // URL node ids use "12-34"; the API wants "12:34". Instance ids can carry
  // letters and semicolons ("I12:34;56:78") — anything else is not a node id.
  const nodeId = rawNodeId.replace(/-/g, ":");
  if (!/^[A-Za-z0-9:;]{1,100}$/.test(nodeId)) return null;
  return { fileKey, nodeId };
}

/** Parse an https URL and pin its host to a domain before it goes anywhere
 * near an outbound request. */
export function requireUrlOnDomain(v: unknown, field: string, domain: string): URL {
  const raw = requireString(v, field);
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new HttpError(400, `${field} must be a valid URL on ${domain}.`);
  }
  if (url.protocol !== "https:" || !hostOnDomain(url.hostname, domain)) {
    throw new HttpError(400, `${field} must be an https URL on ${domain}.`);
  }
  return url;
}

/** Pure core of the redirect check, testable without env. */
export function redirectAllowed(csv: string, raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  return originAllowed(csv, url.origin);
}

/** OAuth/invite redirect targets must land on one of OUR origins — the same
 * ALLOWED_ORIGINS list CORS uses — or an invite email becomes an open
 * redirect. Reads env; not pure. */
export function requireAllowedRedirect(v: unknown, field: string): string {
  const raw = requireString(v, field);
  if (!redirectAllowed(allowlistCsv(), raw)) {
    throw new HttpError(400, `${field} must be a URL on this app's own domain.`);
  }
  return raw;
}

/** Pure core of the storage-URL check, testable without env. */
export function isOwnStorageUrl(raw: string, supabaseUrl: string, bucket: string): boolean {
  let url: URL;
  let base: URL;
  try {
    url = new URL(raw);
    base = new URL(supabaseUrl);
  } catch {
    return false;
  }
  return (
    url.origin === base.origin && url.pathname.startsWith(`/storage/v1/object/public/${bucket}/`)
  );
}

/** An asset the server will read must be a storage REFERENCE
 * ("{bucket}/{path}") into the named private bucket — never an arbitrary
 * URL, which would be an SSRF primitive the moment the server fetches it.
 * The legacy own-public-URL form (clients deployed before the
 * private-storage cutover) is still accepted and normalized to a reference.
 * Always returns the reference form. Reads env; not pure. */
export function requireOwnStorageRef(v: unknown, field: string, bucket: string): string {
  const raw = requireString(v, field);
  if (raw.startsWith(`${bucket}/`) && raw.length > bucket.length + 1 && !raw.includes("..")) {
    return raw;
  }
  const supabaseUrl =
    (globalThis as { Deno?: { env: { get(n: string): string | undefined } } }).Deno?.env.get(
      "SUPABASE_URL",
    ) ?? "";
  if (isOwnStorageUrl(raw, supabaseUrl, bucket)) {
    return raw.replace(/^https?:\/\/[^/]+\/storage\/v1\/object\/public\//, "");
  }
  throw new HttpError(400, `${field} must be a file uploaded to this workspace.`);
}
