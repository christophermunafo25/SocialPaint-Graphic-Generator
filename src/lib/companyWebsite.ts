/** Website normalization shared by onboarding and Settings → Workspace.
 *
 * companies.website stores a bare domain plus optional path ("acme.com",
 * "acme.com/studio") — never a protocol, query, or fragment. One pure
 * function owns the rule so the two write sites cannot drift.
 */

/** Hostname shape: dot-separated labels, letters/digits/hyphens, a
 * two-plus-letter final label. Punycode labels (xn--) pass as ordinary
 * labels. Deliberately strict — an IP, a bare word, or "localhost" is not
 * a company website. */
const DOMAIN_RE = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,}$/;

/** Normalize raw input to the stored form, or null when it does not parse
 * as a domain. Trims, tolerates a missing or http(s) protocol, lowercases
 * the host, drops query and fragment, and trims the trailing slash. Any
 * other protocol (ftp:, javascript:) is rejected outright. */
export function normalizeWebsite(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // A protocol other than http(s) is never a website worth storing.
  const protocol = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(trimmed)?.[1]?.toLowerCase();
  if (protocol && protocol !== "http" && protocol !== "https") return null;
  const withProtocol = protocol ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    return null;
  }
  if (url.username || url.password || url.port) return null;
  const host = url.hostname.toLowerCase();
  if (!DOMAIN_RE.test(host)) return null;
  const path = url.pathname.replace(/\/+$/, "");
  return `${host}${path}`;
}

/** A stored website as a clickable URL. */
export const websiteUrl = (website: string): string => `https://${website}`;
