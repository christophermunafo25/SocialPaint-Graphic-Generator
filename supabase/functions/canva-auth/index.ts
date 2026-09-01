// Canva connection lifecycle: status / start (PKCE authorize URL) /
// callback (code exchange). Only admins connect. OAuth state and the PKCE
// verifier live server-side in canva_oauth_states — the browser sees only
// the authorize URL and, on return, echoes the code+state pair back here.

import { requireRole, serviceClient } from "../_shared/figma.ts";
import {
  GENERIC_ERROR,
  HttpError,
  handleOptions,
  jsonResponder,
  logError,
} from "../_shared/http.ts";
import {
  optionalString,
  parseBody,
  requireAllowedRedirect,
  requireEnum,
  requireUuid,
} from "../_shared/validate.ts";
import { canvaEnabled, exchangeCanvaCode, makePkcePair, pkceChallenge } from "../_shared/canva.ts";

const AUTHORIZE_URL = "https://www.canva.com/api/oauth/authorize";
const SCOPES = "design:content:read design:meta:read";
const STATE_TTL_MS = 10 * 60 * 1000;

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  const json = jsonResponder(req);
  try {
    const body = await parseBody(req);
    const companyId = requireUuid(body.companyId, "companyId");
    const action = requireEnum(body.action, "action", [
      "status",
      "start",
      "callback",
      "disconnect",
    ] as const);
    const code = optionalString(body.code, "code", 2048);
    const state = optionalString(body.state, "state", 256);

    const caller = await requireRole(req, companyId, "admin");
    if ("error" in caller) return json({ error: caller.error }, caller.status);

    const db = serviceClient();

    if (action === "status") {
      if (!canvaEnabled()) return json({ enabled: false, connected: false });
      const { data } = await db
        .from("integration_connections")
        .select("id")
        .eq("company_id", companyId)
        .eq("provider", "canva")
        .maybeSingle();
      return json({ enabled: true, connected: Boolean(data) });
    }

    // Disconnect works even when the feature flag is off: a stored token
    // should always be severable, whatever the flag says today.
    if (action === "disconnect") {
      const { error } = await db
        .from("integration_connections")
        .delete()
        .eq("company_id", companyId)
        .eq("provider", "canva");
      if (error) {
        logError("canva-auth", error);
        return json({ error: "Could not disconnect — try again." }, 500);
      }
      return json({ ok: true });
    }

    if (!canvaEnabled()) return json({ error: "Canva auto-build is not enabled." }, 501);

    // Both remaining actions hand redirectUri to Canva — it must be one of
    // OUR origins, same allowlist CORS uses.
    const redirectUri = requireAllowedRedirect(body.redirectUri, "redirectUri");

    if (action === "start") {
      const { verifier, state: newState } = makePkcePair();
      const challenge = await pkceChallenge(verifier);
      const { error } = await db
        .from("canva_oauth_states")
        .insert({ state: newState, company_id: companyId, code_verifier: verifier });
      if (error) {
        logError("canva-auth", error);
        return json({ error: "Could not start the connection — try again." }, 500);
      }
      const url = new URL(AUTHORIZE_URL);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("client_id", Deno.env.get("CANVA_CLIENT_ID") ?? "");
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("scope", SCOPES);
      url.searchParams.set("state", newState);
      url.searchParams.set("code_challenge", challenge);
      url.searchParams.set("code_challenge_method", "S256");
      return json({ authorizeUrl: url.toString() });
    }

    // action === "callback"
    if (!code || !state) return json({ error: "code and state required" }, 400);
    const { data: stateRow } = await db
      .from("canva_oauth_states")
      .select("state, company_id, code_verifier, created_at")
      .eq("state", state)
      .maybeSingle();
    // Single-use, whatever happens next.
    await db.from("canva_oauth_states").delete().eq("state", state);
    const s = stateRow as {
      company_id: string;
      code_verifier: string;
      created_at: string;
    } | null;
    if (!s || s.company_id !== companyId) {
      return json({ error: "This connection attempt doesn't match — start again." }, 400);
    }
    if (Date.now() - new Date(s.created_at).getTime() > STATE_TTL_MS) {
      return json({ error: "The connection attempt expired — start again." }, 400);
    }
    const tokens = await exchangeCanvaCode(code, s.code_verifier, redirectUri);
    const { error } = await db.from("integration_connections").upsert(
      {
        company_id: companyId,
        provider: "canva",
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? null,
        expires_at: tokens.expires_in
          ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
          : null,
        scope: SCOPES,
        connected_by: caller.userId,
      },
      { onConflict: "company_id,provider" },
    );
    if (error) {
      logError("canva-auth", error);
      return json({ error: "Could not save the connection — try again." }, 500);
    }
    return json({ connected: true });
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    logError("canva-auth", e);
    return json({ error: GENERIC_ERROR }, 500);
  }
});
