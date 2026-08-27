// The second (and last) unauthenticated surface: an anonymous visitor
// finished a graphic, and the admin who sent the link wants to know it
// worked.
//
// It takes a token and one of two fixed words. Nothing else. It does not
// read the template, does not return anything about it, and answers
// identically whether the token was good, revoked, or invented — a link's
// own analytics are not a channel for probing which links exist.
//
// It resolves the token WITHOUT consuming a use: one fill is one open, and a
// visitor exporting twice should not burn through the admin's cap twice.

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
import { MAX_TOKEN_CHARS, clientIp, hashToken } from "../_shared/publicLink.ts";

/** Deliberately not "ok: false" on failure — the caller gets the same body
 * either way, so a probe cannot use this endpoint as a token oracle. */
const ACK = { ok: true } as const;

const LIMITS = {
  perIp: { limit: 60, windowSeconds: 600 },
  global: { limit: 600, windowSeconds: 60 },
} as const;

function pepper(): string {
  return (
    Deno.env.get("PUBLIC_LINK_IP_PEPPER") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "unset"
  );
}

interface ResolvedLink {
  link_id: string;
  template_id: string;
  company_id: string;
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  const json = jsonResponder(req);

  try {
    const db = serviceClient();
    const ipKey = (await hashToken(`${pepper()}:${clientIp(req.headers)}`)).slice(0, 32);

    const allowed = await Promise.all(
      [
        { key: "evt:global", ...LIMITS.global },
        { key: `evt:ip:${ipKey}`, ...LIMITS.perIp },
      ].map(async ({ key, limit, windowSeconds }) => {
        const { data, error } = await db.rpc("consume_rate_limit", {
          p_key: key,
          p_limit: limit,
          p_window_seconds: windowSeconds,
        });
        if (error) {
          logError("public-link-event", error);
          return false;
        }
        return data === true;
      }),
    );
    if (!allowed.every(Boolean)) {
      console.warn("[public-link-event] rate limited", { ipKey });
      return new Response(JSON.stringify(ACK), {
        status: 429,
        headers: {
          ...corsHeadersFor(req),
          "Content-Type": "application/json",
          "Retry-After": "60",
        },
      });
    }

    const body = await parseBody(req);
    const token = typeof body.token === "string" ? body.token : "";
    // The action is an ALLOWLIST, not a pass-through. An "open" is the read
    // request itself and is recorded there; these two are the only events a
    // public visitor can produce. Accepting whatever arrived would let a
    // caller write arbitrary rows into a tenant's analytics.
    const action = body.action;
    const knownAction = action === "download" || action === "share";
    if (!knownAction || !token || token.length > MAX_TOKEN_CHARS) {
      console.warn("[public-link-event] ignored", { reason: "malformed", ipKey });
      return json(ACK);
    }

    const { data: resolved, error } = await db.rpc("public_link_lookup", {
      p_token_hash: await hashToken(token),
      p_consume: false,
    });
    if (error) {
      logError("public-link-event", error);
      return json(ACK);
    }
    const link = resolved as ResolvedLink | null;
    if (!link) {
      console.warn("[public-link-event] ignored", { reason: "not-eligible", ipKey });
      return json(ACK);
    }

    const { error: insertError } = await db.from("usage_events").insert({
      company_id: link.company_id,
      template_id: link.template_id,
      action,
      actor: "public",
      link_id: link.link_id,
      user_id: null,
    });
    if (insertError) console.warn("[public-link-event] insert failed", insertError.message);

    return json(ACK);
  } catch (e) {
    if (e instanceof HttpError) return json(ACK);
    logError("public-link-event", e);
    return json({ error: GENERIC_ERROR }, 500);
  }
});
