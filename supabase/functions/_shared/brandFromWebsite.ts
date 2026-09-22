// Brand-from-website: the pure logic behind the brand-from-website Edge
// Function. URL policy, private-network detection (the SSRF gate's pure
// half — DNS resolution itself lives in the function), page evidence
// extraction, and validation of the model's extraction. No I/O, no Deno
// globals, so vitest covers it under Node.

// ---------------------------------------------------------------------------
// URL policy
// ---------------------------------------------------------------------------

export interface TargetUrlProblem {
  problem: string;
}

/** Parse and normalize the admin's URL: http upgrades to https, anything
 * else is refused, and the hostname must look like a public registrable
 * name (an IP literal or a dotless name like "localhost" never is).
 * Resolution-time checks (DNS answers in private ranges) happen in the
 * function; this is the shape gate. */
export function parseTargetUrl(raw: string): URL | TargetUrlProblem {
  const trimmed = raw.trim();
  if (!trimmed) return { problem: "Enter a website address." };
  const withProtocol = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    return { problem: "That does not look like a web address." };
  }
  if (url.protocol === "http:") url.protocol = "https:";
  if (url.protocol !== "https:") {
    return { problem: "Only http and https addresses can be read." };
  }
  if (url.username || url.password) {
    return { problem: "Addresses with credentials are not supported." };
  }
  if (url.port && url.port !== "443") {
    return { problem: "Only the standard https port can be read." };
  }
  const host = url.hostname.toLowerCase();
  if (isIpLiteral(host) || !/^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]+$/.test(host)) {
    return { problem: "Enter a public website address, like acme.com." };
  }
  url.hash = "";
  return url;
}

export const isTargetProblem = (v: URL | TargetUrlProblem): v is TargetUrlProblem =>
  typeof (v as TargetUrlProblem).problem === "string";

function isIpLiteral(host: string): boolean {
  if (/^\[?[0-9a-f:]+\]?$/i.test(host) && host.includes(":")) return true;
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

/** Is a resolved address private, loopback, link-local, or otherwise not a
 * public internet host? THE SSRF gate's verdict — every DNS answer for
 * every fetched host (redirect hops and the logo included) goes through
 * here before anything is fetched. */
export function isPrivateAddress(ip: string): boolean {
  const v4 = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(v4);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // multicast + reserved
    return false;
  }
  const v6 = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (v6 === "::" || v6 === "::1") return true;
  if (
    v6.startsWith("fe80:") ||
    v6.startsWith("fe9") ||
    v6.startsWith("fea") ||
    v6.startsWith("feb")
  )
    return true; // link-local fe80::/10
  if (v6.startsWith("fc") || v6.startsWith("fd")) return true; // ULA fc00::/7
  return false;
}

/** May the logo live on this host, given the input host? Same origin or a
 * subdomain relationship in either direction ("acme.com" and
 * "cdn.acme.com" both pass; "evil.com" never does). */
export function isAllowedLogoHost(logoHost: string, inputHost: string): boolean {
  const a = logoHost.toLowerCase();
  const b = inputHost.toLowerCase();
  return a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);
}

// ---------------------------------------------------------------------------
// Page evidence
// ---------------------------------------------------------------------------

export interface PageEvidence {
  title?: string;
  siteName?: string;
  themeColor?: string;
  ogImage?: string;
  icons: string[];
  /** hrefs of same-origin stylesheets (capped by the caller). */
  stylesheets: string[];
  /** Concatenated inline <style> blocks. */
  inlineCss: string;
}

const attr = (tag: string, name: string): string | undefined => {
  const m = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i").exec(tag);
  return m ? (m[2] ?? m[3]) : undefined;
};

const decodeEntities = (s: string): string =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

/** Pull the brand evidence out of raw HTML without executing anything.
 * Regex-based on purpose: the function runs no DOM and no JS. */
export function extractEvidence(html: string, pageUrl: URL): PageEvidence {
  const evidence: PageEvidence = { icons: [], stylesheets: [], inlineCss: "" };

  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (title) evidence.title = decodeEntities(title[1].trim()).slice(0, 200);

  for (const meta of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const prop = (attr(meta, "property") ?? attr(meta, "name"))?.toLowerCase();
    const content = attr(meta, "content");
    if (!prop || !content) continue;
    if (prop === "og:site_name") evidence.siteName = decodeEntities(content).slice(0, 120);
    if (prop === "og:image" && !evidence.ogImage) evidence.ogImage = content.slice(0, 2048);
    if (prop === "theme-color" && !evidence.themeColor) evidence.themeColor = content.slice(0, 32);
  }

  for (const link of html.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = attr(link, "rel")?.toLowerCase() ?? "";
    const href = attr(link, "href");
    if (!href) continue;
    if (/(^|\s)(icon|apple-touch-icon|mask-icon|shortcut icon)(\s|$)/.test(rel)) {
      evidence.icons.push(href.slice(0, 2048));
    }
    if (/(^|\s)stylesheet(\s|$)/.test(rel)) {
      try {
        const resolved = new URL(href, pageUrl);
        if (resolved.hostname.toLowerCase() === pageUrl.hostname.toLowerCase()) {
          evidence.stylesheets.push(resolved.toString());
        }
      } catch {
        // Unresolvable href: skip it.
      }
    }
  }

  const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]);
  evidence.inlineCss = styles.join("\n").slice(0, 200_000);

  return evidence;
}

// ---------------------------------------------------------------------------
// Model output validation — never trust the extraction
// ---------------------------------------------------------------------------

export interface ExtractedBrand {
  companyName: string;
  colors: Array<{ hex: string; role: "primary" | "secondary" | "accent"; name: string }>;
  headingFont: string | null;
  bodyFont: string | null;
  logoUrl: string | null;
  warnings: string[];
}

export class BrandExtractionError extends Error {
  constructor(readonly errors: string[]) {
    super(errors.join(" "));
  }
}

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
const ROLES = ["primary", "secondary", "accent"] as const;

/** Strip quotes and CSS fallback lists off a family name; null when nothing
 * usable remains. "\"Neue Haas\", Helvetica, sans-serif" -> "Neue Haas". */
export function cleanFontFamily(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const first = raw.split(",")[0]?.replace(/["']/g, "").trim() ?? "";
  if (!first || first.length > 40) return null;
  const GENERIC = new Set(["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui"]);
  if (GENERIC.has(first.toLowerCase())) return null;
  if (!/^[A-Za-z0-9][A-Za-z0-9 .+-]*$/.test(first)) return null;
  return first;
}

/** Validate the model's extraction. Throws BrandExtractionError with every
 * problem found (the retry round feeds them back); returns the cleaned
 * result otherwise. logoUrl is only checked for shape and host here — the
 * function fetches it through the same SSRF gate afterwards. */
export function validateExtraction(raw: unknown, inputHost: string): ExtractedBrand {
  const errors: string[] = [];
  const r = (raw ?? {}) as Record<string, unknown>;

  const companyName = typeof r.companyName === "string" ? r.companyName.trim().slice(0, 60) : "";
  if (!companyName) errors.push("companyName must be a non-empty string of at most 60 characters.");

  const colors: ExtractedBrand["colors"] = [];
  if (!Array.isArray(r.colors) || r.colors.length === 0) {
    errors.push("colors must be a non-empty array.");
  } else {
    const seen = new Set<string>();
    for (const entry of r.colors) {
      const c = (entry ?? {}) as Record<string, unknown>;
      const hex = typeof c.hex === "string" ? c.hex.trim().toUpperCase() : "";
      if (!HEX_RE.test(hex)) {
        errors.push(`colors[].hex must match #RRGGBB (got a bad entry).`);
        continue;
      }
      const role = ROLES.includes(c.role as (typeof ROLES)[number])
        ? (c.role as (typeof ROLES)[number])
        : null;
      if (!role) {
        errors.push("colors[].role must be primary, secondary, or accent.");
        continue;
      }
      if (seen.has(hex)) continue; // dedupe silently
      seen.add(hex);
      const name = typeof c.name === "string" && c.name.trim() ? c.name.trim().slice(0, 40) : hex;
      colors.push({ hex, role, name });
      if (colors.length >= 8) break;
    }
    if (!errors.length && colors.length === 0) {
      errors.push("colors contained no valid entries.");
    }
  }

  const headingFont = cleanFontFamily(r.headingFont);
  const bodyFont = cleanFontFamily(r.bodyFont);

  let logoUrl: string | null = null;
  if (typeof r.logoUrl === "string" && r.logoUrl.trim()) {
    try {
      const parsed = new URL(r.logoUrl.trim());
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        errors.push("logoUrl must be an http(s) URL from the page.");
      } else if (!isAllowedLogoHost(parsed.hostname, inputHost)) {
        errors.push("logoUrl must be on the website's own domain or a subdomain of it.");
      } else {
        parsed.protocol = "https:";
        logoUrl = parsed.toString();
      }
    } catch {
      errors.push("logoUrl must be an absolute URL.");
    }
  }

  if (errors.length) throw new BrandExtractionError(errors);
  return { companyName, colors, headingFont, bodyFont, logoUrl, warnings: [] };
}
