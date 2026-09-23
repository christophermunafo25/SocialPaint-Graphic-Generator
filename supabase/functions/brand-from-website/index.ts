// Brand from website: fetch the admin's site, ask Claude for one forced
// extraction, validate everything, and return a PREFILL for the onboarding
// wizard. Modeled on template-autobuild's structure: CORS, auth, validation,
// one tool call with one retry carrying the validation errors, and a
// proposal-only response — this function writes nothing to the database.
//
// The caller has no company yet (onboarding runs before create), so auth is
// "any signed-in user" plus a per-user rate limit, not requireRole.
//
// SSRF gate: every host this function fetches — the page, each redirect
// hop, and the logo — must pass the URL shape gate AND have every DNS
// answer outside private, loopback, link-local, CGNAT, and reserved
// ranges. Fail closed: if resolution fails, nothing is fetched.

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  GENERIC_ERROR,
  HttpError,
  handleOptions,
  jsonResponder,
  logError,
} from "../_shared/http.ts";
import { parseBody, requireString } from "../_shared/validate.ts";
import {
  BrandExtractionError,
  extractEvidence,
  isAllowedLogoHost,
  isPrivateAddress,
  isTargetProblem,
  parseTargetUrl,
  validateExtraction,
  type ExtractedBrand,
  type PageEvidence,
} from "../_shared/brandFromWebsite.ts";

const ANTHROPIC_MODEL = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-4-6";

const PAGE_TIMEOUT_MS = 8000;
const PAGE_CAP_BYTES = 800_000;
const CSS_CAP_BYTES = 200_000;
const LOGO_CAP_BYTES = 2_000_000;
const MAX_REDIRECTS = 3;

// ---------------------------------------------------------------------------
// Rate limit: max 5 calls per user per 10 minutes. In-memory is acceptable
// for v1 — a cold start resets it, which only ever errs permissive.
// ---------------------------------------------------------------------------

const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const callsByUser = new Map<string, number[]>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const recent = (callsByUser.get(userId) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    callsByUser.set(userId, recent);
    return false;
  }
  recent.push(now);
  callsByUser.set(userId, recent);
  return true;
}

// ---------------------------------------------------------------------------
// SSRF-gated fetching
// ---------------------------------------------------------------------------

/** Every DNS answer for the host must be public. Fail closed. */
async function assertPublicHost(host: string): Promise<void> {
  let answers: string[] = [];
  try {
    const [a, aaaa] = await Promise.allSettled([
      Deno.resolveDns(host, "A"),
      Deno.resolveDns(host, "AAAA"),
    ]);
    if (a.status === "fulfilled") answers = answers.concat(a.value);
    if (aaaa.status === "fulfilled") answers = answers.concat(aaaa.value);
  } catch {
    answers = [];
  }
  if (answers.length === 0) {
    throw new HttpError(400, "That website could not be found. Check the address.");
  }
  if (answers.some((ip) => isPrivateAddress(ip))) {
    throw new HttpError(400, "That address is not a public website.");
  }
}

/** Read a response body up to a byte cap; over the cap is an error. */
async function readCapped(res: Response, cap: number, what: string): Promise<Uint8Array> {
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array(0);
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > cap) {
      await reader.cancel();
      throw new HttpError(400, `${what} is too large to read.`);
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

/** Fetch through the SSRF gate: shape-check and DNS-check the URL and every
 * redirect hop (at most 3), with one shared timeout. */
async function gatedFetch(
  target: URL,
  cap: number,
  what: string,
): Promise<{ finalUrl: URL; bytes: Uint8Array; contentType: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PAGE_TIMEOUT_MS);
  try {
    let current = target;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      await assertPublicHost(current.hostname);
      const res = await fetch(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": "SocialPaintBrandBot/1.0 (+brand onboarding)" },
      });
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        await res.body?.cancel();
        if (!location) throw new HttpError(400, `${what} redirected nowhere.`);
        const next = parseTargetUrl(new URL(location, current).toString());
        if (isTargetProblem(next))
          throw new HttpError(400, `${what} redirected somewhere unreadable.`);
        current = next;
        continue;
      }
      if (!res.ok) {
        await res.body?.cancel();
        throw new HttpError(400, `${what} answered ${res.status}.`);
      }
      const bytes = await readCapped(res, cap, what);
      return { finalUrl: current, bytes, contentType: res.headers.get("content-type") ?? "" };
    }
    throw new HttpError(400, `${what} redirected too many times.`);
  } catch (e) {
    if (e instanceof HttpError) throw e;
    if ((e as Error).name === "AbortError") {
      throw new HttpError(400, `${what} took too long to answer.`);
    }
    logError("brand-from-website", e);
    throw new HttpError(400, `${what} could not be fetched.`);
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Anthropic call — one forced tool use, one retry carrying the errors
// ---------------------------------------------------------------------------

const EXTRACT_BRAND_TOOL = {
  name: "extract_brand",
  description: "Report the brand facts you can read from this website's evidence.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["companyName", "colors", "headingFont", "bodyFont", "logoUrl", "confidence"],
    properties: {
      companyName: {
        type: "string",
        description: "The company or product name, at most 60 characters.",
      },
      colors: {
        type: "array",
        minItems: 1,
        maxItems: 8,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["hex", "role", "name"],
          properties: {
            hex: { type: "string", description: "#RRGGBB" },
            role: { type: "string", enum: ["primary", "secondary", "accent"] },
            name: { type: "string" },
          },
        },
      },
      headingFont: {
        type: ["string", "null"],
        description: "Heading font family name, or null when unclear.",
      },
      bodyFont: {
        type: ["string", "null"],
        description: "Body font family name, or null when unclear.",
      },
      logoUrl: {
        type: ["string", "null"],
        description:
          "Absolute URL of the site's logo image, taken from the page (icons or markup), on the site's own domain. Null when none is evident.",
      },
      confidence: {
        type: "object",
        additionalProperties: false,
        required: ["notes"],
        properties: {
          notes: {
            type: "array",
            items: { type: "string" },
            description: "One short note per item you are unsure about.",
          },
        },
      },
    },
  },
};

const SYSTEM_PROMPT = `You read a website's raw evidence — its title, meta tags, icon links, and CSS — and report the brand behind it. Report only what the evidence supports: colors that plainly recur as brand colors (buttons, accents, headers), not every hex in the CSS; font family names actually declared for headings and body text; a logo URL only when the markup names one on the site's own domain. Prefer the theme-color and repeated CSS custom properties over one-off values. When something is unclear, say so in confidence.notes and use null rather than guessing. The company name comes from og:site_name or the title, trimmed of taglines.`;

interface ClaudeAttempt {
  input: unknown;
  toolUseId: string;
  raw: unknown[];
}

async function callClaude(
  apiKey: string,
  userText: string,
  retry?: { priorContent: unknown[]; toolUseId: string; errors: string[] },
): Promise<ClaudeAttempt> {
  const messages: unknown[] = [{ role: "user", content: [{ type: "text", text: userText }] }];
  if (retry) {
    messages.push({ role: "assistant", content: retry.priorContent });
    messages.push({
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: retry.toolUseId,
          is_error: true,
          content: `Your extraction failed validation: ${retry.errors.join(" ")} Correct these and call extract_brand again.`,
        },
      ],
    });
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1500,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      tools: [EXTRACT_BRAND_TOOL],
      tool_choice: { type: "tool", name: "extract_brand" },
      messages,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    logError("brand-from-website", `model request failed (${res.status}): ${detail.slice(0, 500)}`);
    throw new HttpError(502, `The model request failed (${res.status}). Try again.`);
  }
  const body = (await res.json()) as {
    content: Array<{ type: string; id?: string; name?: string; input?: unknown }>;
  };
  const toolUse = body.content.find((b) => b.type === "tool_use" && b.name === "extract_brand");
  if (!toolUse?.input) throw new HttpError(502, "The model returned no extraction.");
  return { input: toolUse.input, toolUseId: toolUse.id ?? "", raw: body.content };
}

function buildUserText(pageUrl: URL, evidence: PageEvidence, css: string[]): string {
  const parts: string[] = [];
  parts.push(`Website: ${pageUrl.toString()}`);
  if (evidence.title) parts.push(`Title: ${evidence.title}`);
  if (evidence.siteName) parts.push(`og:site_name: ${evidence.siteName}`);
  if (evidence.themeColor) parts.push(`theme-color: ${evidence.themeColor}`);
  if (evidence.ogImage) parts.push(`og:image: ${evidence.ogImage}`);
  if (evidence.icons.length) parts.push(`Icon links: ${evidence.icons.slice(0, 6).join(", ")}`);
  if (evidence.inlineCss) parts.push(`Inline CSS:\n${evidence.inlineCss.slice(0, 60_000)}`);
  css.forEach((sheet, i) => {
    parts.push(`Stylesheet ${i + 1}:\n${sheet.slice(0, 60_000)}`);
  });
  return parts.join("\n\n");
}

// ---------------------------------------------------------------------------
// Logo fetch (same gate; returned as base64 because the browser cannot
// fetch it cross-origin and no storage bucket exists for the company yet)
// ---------------------------------------------------------------------------

async function fetchLogo(
  logoUrl: string,
  inputHost: string,
  warnings: string[],
): Promise<{ base64: string; contentType: string; filename: string } | undefined> {
  try {
    const parsed = parseTargetUrl(logoUrl);
    if (isTargetProblem(parsed) || !isAllowedLogoHost(parsed.hostname, inputHost)) {
      warnings.push(
        "The logo the model pointed at was not on the site's domain, so it was skipped.",
      );
      return undefined;
    }
    const { bytes, contentType, finalUrl } = await gatedFetch(parsed, LOGO_CAP_BYTES, "The logo");
    const type = contentType.split(";")[0].trim().toLowerCase();
    if (!type.startsWith("image/")) {
      warnings.push("The logo link did not answer with an image, so it was skipped.");
      return undefined;
    }
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    const name = finalUrl.pathname.split("/").pop() || "logo";
    return { base64: btoa(binary), contentType: type, filename: name.slice(0, 100) };
  } catch (e) {
    logError("brand-from-website", e);
    warnings.push("The site's logo could not be fetched, so it was skipped.");
    return undefined;
  }
}

// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  const json = jsonResponder(req);
  try {
    const body = await parseBody(req);
    const rawUrl = requireString(body.url, "url", 2048);

    // Authenticated user required. No company exists yet, so no requireRole.
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Not signed in." }, 401);
    if (!checkRateLimit(userData.user.id)) {
      return json({ error: "Too many tries. Wait a few minutes and try again." }, 429);
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return json(
        {
          error:
            "Brand from website is not configured: set the ANTHROPIC_API_KEY secret (supabase secrets set) and redeploy.",
        },
        503,
      );
    }

    const target = parseTargetUrl(rawUrl);
    if (isTargetProblem(target)) return json({ error: target.problem }, 400);

    // 1. The page.
    const page = await gatedFetch(target, PAGE_CAP_BYTES, "The website");
    const html = new TextDecoder().decode(page.bytes);
    const evidence = extractEvidence(html, page.finalUrl);

    // 2. Up to two same-origin stylesheets, best effort.
    const warnings: string[] = [];
    const css: string[] = [];
    for (const href of evidence.stylesheets.slice(0, 2)) {
      try {
        const sheetUrl = parseTargetUrl(href);
        if (isTargetProblem(sheetUrl)) continue;
        const sheet = await gatedFetch(sheetUrl, CSS_CAP_BYTES, "A stylesheet");
        css.push(new TextDecoder().decode(sheet.bytes));
      } catch {
        warnings.push("One of the site's stylesheets could not be read.");
      }
    }

    // 3. One forced tool call; one retry carrying the validation errors.
    const inputHost = page.finalUrl.hostname.toLowerCase();
    const userText = buildUserText(page.finalUrl, evidence, css);
    let attempt = await callClaude(apiKey, userText);
    let extracted: ExtractedBrand;
    try {
      extracted = validateExtraction(attempt.input, inputHost);
    } catch (e) {
      if (!(e instanceof BrandExtractionError)) throw e;
      attempt = await callClaude(apiKey, userText, {
        priorContent: attempt.raw,
        toolUseId: attempt.toolUseId,
        errors: e.errors,
      });
      try {
        extracted = validateExtraction(attempt.input, inputHost);
      } catch {
        return json(
          {
            error:
              "The brand could not be read from that site. Enter the details manually. Everything stays editable.",
          },
          502,
        );
      }
    }

    // 4. The confidence notes travel as warnings; the logo is fetched
    // server-side through the same gate and returned inline.
    const confidence = (attempt.input as { confidence?: { notes?: unknown } }).confidence;
    if (Array.isArray(confidence?.notes)) {
      for (const note of confidence.notes.slice(0, 6)) {
        if (typeof note === "string" && note.trim()) warnings.push(note.trim().slice(0, 200));
      }
    }
    const logo = extracted.logoUrl
      ? await fetchLogo(extracted.logoUrl, inputHost, warnings)
      : undefined;

    return json({
      companyName: extracted.companyName,
      website: inputHost,
      colors: extracted.colors,
      headingFont: extracted.headingFont,
      bodyFont: extracted.bodyFont,
      logo,
      warnings,
    });
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    logError("brand-from-website", e);
    return json({ error: GENERIC_ERROR }, 500);
  }
});
