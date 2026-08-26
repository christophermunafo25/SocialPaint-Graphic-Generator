// THE unauthenticated read path. This is the only place in the application
// where an anonymous caller reaches privileged data access, and it should be
// reviewed line by line every time it changes.
//
// The discipline, stated so a reviewer can check it against the code below:
//
//   1. The request carries ONE input: a token, in the body (never the query
//      string, where it would land in access logs and proxy caches).
//   2. That token is hashed and handed to public_link_lookup, which applies
//      every eligibility rule in one locked statement and returns a link id,
//      a template id, and a company id.
//   3. Every subsequent query is parameterised by those three server-derived
//      values and NOTHING else. No value from the request reaches a query
//      after step 2. There is no id parameter to tamper with, because there
//      is no id parameter.
//   4. Every refusal returns the same body and status, whatever the cause.
//      A revoked token, an expired one, a capped one, one for an unpublished
//      template, and one that never existed are indistinguishable. Without
//      this the endpoint is an oracle for probing which tokens exist.
//   5. The response is assembled by an allowlist in _shared/publicTemplate.ts
//      and then swept for anything that still looks like a storage reference.
//
// This function must keep doing exactly one thing. Every future request to
// have it return "just one more field" is a request to widen the only hole
// in the tenant boundary.

import { serviceClient } from "../_shared/figma.ts";
import {
  GENERIC_ERROR,
  HttpError,
  corsHeadersFor,
  handleOptions,
  jsonResponder,
  logError,
} from "../_shared/http.ts";
import { parseBody } from "../_shared/validate.ts";
import {
  MAX_TOKEN_CHARS,
  PUBLIC_SIGNED_URL_TTL_S,
  clientIp,
  hashToken,
  refKey,
  type StorageRef,
} from "../_shared/publicLink.ts";
import {
  buildPublicPayload,
  findUnsignedRefs,
  payloadAssetRefs,
  type Row,
} from "../_shared/publicTemplate.ts";

/** The one refusal. Same body, same status, every cause. */
const REFUSAL = { error: "unavailable" } as const;

/** Rate limits. This endpoint is unauthenticated and it will be scraped.
 *
 *  - Per IP: generous enough for a marketing team behind one office NAT
 *    opening a batch of links, useless for enumeration against a 256-bit
 *    token space.
 *  - Global: a ceiling on the whole endpoint, so a botnet spread across
 *    thousands of addresses still cannot turn this into a load generator.
 *  - Per token: a single link blasted to a conference mailing list can see
 *    real simultaneous traffic; a scraper hammering one token learns
 *    nothing new. Generous, but bounded. */
const LIMITS = {
  perIp: { limit: 60, windowSeconds: 600 },
  global: { limit: 600, windowSeconds: 60 },
  perToken: { limit: 600, windowSeconds: 3600 },
} as const;

const STORAGE_BASE = `${Deno.env.get("SUPABASE_URL") ?? ""}/storage/v1`;

/** The pepper for rate-limit keys. A caller's address is never stored, only
 * a keyed digest of it with one day of retention — enough to count requests,
 * not enough to build an identity graph, which this feature deliberately
 * does not do.
 *
 * PUBLIC_LINK_IP_PEPPER is the intended source. It falls back to the service
 * role key, which is server-only and high entropy, so a missing secret
 * degrades the key's independence rather than switching the limiter off — an
 * unauthenticated endpoint running unlimited is the worse failure. */
function pepper(): string {
  return (
    Deno.env.get("PUBLIC_LINK_IP_PEPPER") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "unset"
  );
}

async function peppered(value: string): Promise<string> {
  return (await hashToken(`${pepper()}:${value}`)).slice(0, 32);
}

interface ResolvedLink {
  link_id: string;
  template_id: string;
  company_id: string;
  allow_uploads: boolean;
}

/** Sign exactly the objects this template paints, batched per bucket.
 *
 * Signatures are per object: a URL minted for one link's background grants
 * access to that object and nothing else — not a sibling, not another
 * tenant's, not a bucket listing. */
async function signRefs(
  db: ReturnType<typeof serviceClient>,
  refs: StorageRef[],
): Promise<Map<string, string>> {
  const signed = new Map<string, string>();
  const byBucket = new Map<string, string[]>();
  for (const ref of refs) {
    byBucket.set(ref.bucket, [...(byBucket.get(ref.bucket) ?? []), ref.path]);
  }
  await Promise.all(
    [...byBucket].map(async ([bucket, paths]) => {
      const { data, error } = await db.storage
        .from(bucket)
        .createSignedUrls(paths, PUBLIC_SIGNED_URL_TTL_S);
      if (error || !data) {
        console.error("[public-template] signing failed", bucket, error);
        return;
      }
      for (const entry of data) {
        if (!entry.signedUrl || entry.error || !entry.path) continue;
        // Absolute in the pinned client; prefixed defensively so a version
        // skew cannot silently ship relative URLs the browser can't fetch.
        const url = entry.signedUrl.startsWith("http")
          ? entry.signedUrl
          : `${STORAGE_BASE}${entry.signedUrl}`;
        signed.set(refKey({ bucket: bucket as StorageRef["bucket"], path: entry.path }), url);
      }
    }),
  );
  return signed;
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  const json = jsonResponder(req);

  // Logged with every refusal so abuse is visible in the function logs
  // without any of them being visible to the caller.
  let ipKey = "";

  try {
    const db = serviceClient();
    ipKey = await peppered(clientIp(req.headers));

    // Limits first: a flood of invalid tokens must not reach the database
    // beyond one counter increment each.
    const allowed = await consume(db, [
      { key: "pub:global", ...LIMITS.global },
      { key: `pub:ip:${ipKey}`, ...LIMITS.perIp },
    ]);
    if (!allowed) return tooMany(req, "ip-or-global", ipKey);

    const body = await parseBody(req);
    const token = typeof body.token === "string" ? body.token : "";
    // A malformed token is refused exactly like a revoked one. Deliberately
    // NOT a 400: the shape of a token is not something this endpoint will
    // confirm or deny.
    if (!token || token.length > MAX_TOKEN_CHARS) return refuse(json, "malformed", ipKey);

    const tokenHash = await hashToken(token);

    if (!(await consume(db, [{ key: `pub:link:${tokenHash.slice(0, 32)}`, ...LIMITS.perToken }]))) {
      return tooMany(req, "per-token", ipKey);
    }

    // Every eligibility rule, in one locked statement: token exists, not
    // revoked, not expired, under its cap, template still exists and is
    // still published, company's links still enabled (prompt 08's seam).
    // The cap is claimed here, so two simultaneous visitors cannot both slip
    // past the last use.
    const { data: resolved, error: lookupError } = await db.rpc("public_link_lookup", {
      p_token_hash: tokenHash,
      p_consume: true,
    });
    if (lookupError) {
      logError("public-template", lookupError);
      return refuse(json, "lookup-error", ipKey);
    }
    const link = resolved as ResolvedLink | null;
    if (!link) return refuse(json, "not-eligible", ipKey);

    // --- Past this line every query key is server-derived. ---

    const [templateResult, fieldsResult, kitResult, fontsResult] = await Promise.all([
      db
        .from("templates")
        .select(
          "name, description, canvas_width, canvas_height, background_storage_path, " +
            "background_color, background_gradient, layout_groups, caption_template",
        )
        .eq("id", link.template_id)
        .maybeSingle(),
      db
        .from("template_fields")
        .select("*")
        .eq("template_id", link.template_id)
        .order("sort_order", { ascending: true }),
      db
        .from("brand_kits")
        .select("colors, type_styles")
        .eq("company_id", link.company_id)
        .eq("is_active", true)
        .maybeSingle(),
      db
        .from("brand_assets")
        .select("name, storage_path, metadata")
        .eq("company_id", link.company_id)
        .eq("kind", "font"),
    ]);

    const template = templateResult.data as Row | null;
    if (templateResult.error || !template) {
      if (templateResult.error) logError("public-template", templateResult.error);
      return refuse(json, "template-missing", ipKey);
    }

    const fields = ((fieldsResult.data as Row[] | null) ?? []).map(stripTemplateId);
    const brandKit = (kitResult.data as Row | null) ?? null;
    const fontAssets = (fontsResult.data as Row[] | null) ?? [];

    const refs = payloadAssetRefs({ template, fields, brandKit, fontAssets });
    const signed = await signRefs(db, refs);

    // An object we could not sign is a HARD failure, not a degraded render.
    // A missing background would export as a graphic with no background and
    // a success message; a missing font file would export in a fallback
    // typeface. Both are quiet wrongness shipped under the customer's brand,
    // which is exactly what this feature must never produce.
    if (signed.size !== refs.length) {
      console.error("[public-template] could not sign every asset", {
        wanted: refs.length,
        signed: signed.size,
      });
      return refuse(json, "signing-incomplete", ipKey);
    }

    const payload = buildPublicPayload({
      template,
      fields,
      brandKit,
      fontAssets,
      signed,
      allowUploads: link.allow_uploads,
      assetTtlSeconds: PUBLIC_SIGNED_URL_TTL_S,
    });

    // Belt and braces on the allowlist: if anything that still parses as one
    // of our storage references survived, the page would attempt an
    // anonymous sign, RLS would refuse it, and the visitor would get a slow
    // confusing failure instead of a loud one. Refuse here instead.
    const leaked = findUnsignedRefs(payload);
    if (leaked.length > 0) {
      console.error("[public-template] unsigned storage reference in payload", leaked.length);
      return refuse(json, "unsigned-refs", ipKey);
    }

    // The open IS this request — counting it here avoids a third public
    // surface whose only job would be to say "someone opened it".
    //
    // Awaited, not fired and forgotten: a promise still pending when the
    // response returns can be cancelled by the runtime, which would make
    // "is my link working" a lossy signal for the one person who needs it.
    // One round trip is a fair price. Instrumentation still must never break
    // the visitor's flow, so a failure is logged and nothing else.
    try {
      const { error: usageError } = await db.from("usage_events").insert({
        company_id: link.company_id,
        template_id: link.template_id,
        action: "open",
        actor: "public",
        link_id: link.link_id,
        user_id: null,
      });
      if (usageError) console.warn("[public-template] usage insert failed", usageError.message);
    } catch (e) {
      console.warn("[public-template] usage insert threw", e);
    }

    return json(payload);
  } catch (e) {
    if (e instanceof HttpError) {
      // Even a malformed body takes the standard refusal — the caller learns
      // nothing about why, here of all places.
      console.warn("[public-template] refused", { reason: "bad-request", ipKey });
      return json(REFUSAL, 404);
    }
    logError("public-template", e);
    return json({ error: GENERIC_ERROR }, 500);
  }
});

/** Strip the parent id before the row goes anywhere near the payload
 * builder — one fewer internal id in flight. */
function stripTemplateId(row: Row): Row {
  const { template_id: _withheld, ...rest } = row;
  return rest;
}

function refuse(
  json: (body: unknown, status?: number) => Response,
  reason: string,
  ipKey: string,
): Response {
  // The reason lives in the function log, where an operator can see it. It
  // never reaches the caller.
  console.warn("[public-template] refused", { reason, ipKey });
  return json(REFUSAL, 404);
}

/** Rate limiting is orthogonal to whether a token exists, so a distinct 429
 * gives a prober nothing while letting a legitimate client back off. */
function tooMany(req: Request, scope: string, ipKey: string): Response {
  console.warn("[public-template] rate limited", { scope, ipKey });
  return new Response(JSON.stringify({ error: "rate_limited" }), {
    status: 429,
    headers: {
      ...corsHeadersFor(req),
      "Content-Type": "application/json",
      "Retry-After": "60",
    },
  });
}

async function consume(
  db: ReturnType<typeof serviceClient>,
  buckets: Array<{ key: string; limit: number; windowSeconds: number }>,
): Promise<boolean> {
  const results = await Promise.all(
    buckets.map(async ({ key, limit, windowSeconds }) => {
      const { data, error } = await db.rpc("consume_rate_limit", {
        p_key: key,
        p_limit: limit,
        p_window_seconds: windowSeconds,
      });
      if (error) {
        // A limiter that cannot answer fails CLOSED. An unauthenticated
        // endpoint running unmetered is not an acceptable degraded mode.
        logError("public-template", error);
        return false;
      }
      return data === true;
    }),
  );
  return results.every(Boolean);
}
