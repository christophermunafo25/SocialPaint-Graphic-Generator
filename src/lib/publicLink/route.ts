/** The public link URL, and the one function that decides whether a page
 * load is a public fill.
 *
 * Kept in its own tiny module with no imports because main.tsx consults it
 * BEFORE it imports anything else — the whole point of the public entry point
 * is that App.tsx, the auth provider, the brand provider, and the store
 * factory never load for an anonymous visitor.
 */

/** Short on purpose: this URL gets pasted into an email, and every character
 * is one more thing a mail client can wrap in the middle of. */
export const PUBLIC_LINK_PREFIX = "/l/";

/** The token from a public-link path, or null when this is a normal app
 * load. Only the FIRST segment after the prefix is taken, so a trailing
 * slash or an appended path cannot smuggle anything into the token. */
export function publicLinkToken(pathname: string): string | null {
  if (!pathname.startsWith(PUBLIC_LINK_PREFIX)) return null;
  const raw = pathname.slice(PUBLIC_LINK_PREFIX.length).split("/")[0] ?? "";
  if (!raw) return null;
  try {
    const token = decodeURIComponent(raw);
    return token.length > 0 && token.length <= 256 ? token : null;
  } catch {
    // A malformed escape is not a token. It takes the same "unavailable"
    // page as a revoked one — the visitor can act on neither distinction.
    return null;
  }
}

/** The shareable URL for a token. The token lives in the PATH, never a query
 * string: query strings are what referrer headers, analytics scripts, and
 * proxy logs collect. */
export function publicLinkUrl(origin: string, token: string): string {
  return `${origin}${PUBLIC_LINK_PREFIX}${encodeURIComponent(token)}`;
}
