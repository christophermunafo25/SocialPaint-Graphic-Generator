/** Workspace-settings helpers: the slug rules Settings shares with
 * onboarding, and the timezone list the Workspace section offers. */

/** Same normalization onboarding applies when deriving a slug from the
 * company name: lowercase, runs of anything else collapse to single dashes,
 * no leading or trailing dash. */
export const toSlug = (raw: string): string =>
  raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** A slug is valid exactly when normalizing it changes nothing (and it is
 * non-empty) — one rule, not two that can drift. */
export const isValidSlug = (slug: string): boolean => slug.length > 0 && toSlug(slug) === slug;

/** The browser's own zone — the select's default for a company that has
 * never chosen one. */
export const browserTimeZone = (): string => new Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Every IANA zone the runtime knows. supportedValuesOf is ES2023 and not in
 * this project's TS lib target, hence the cast; browsers this app supports
 * all ship it, and the fallback keeps the select usable rather than empty. */
export function listTimeZones(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
  const zones =
    typeof intl.supportedValuesOf === "function" ? intl.supportedValuesOf("timeZone") : [];
  if (zones.length > 0) return zones;
  return ["UTC", browserTimeZone()].filter((z, i, a) => a.indexOf(z) === i);
}
