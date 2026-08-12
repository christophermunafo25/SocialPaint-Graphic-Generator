import { figmaGet, handleOptions, json, requireRole, serviceClient } from "../_shared/figma.ts";

interface ConnectBody {
  companyId?: string;
  kind?: "pat" | "oauth-code";
  value?: string;
}

/** Store a Figma credential for a company.
 *
 * v1 primary path: a personal access token (kind "pat"), validated against
 * /v1/me before storing. OAuth (kind "oauth-code") exchanges the code using
 * FIGMA_CLIENT_ID / FIGMA_CLIENT_SECRET — set those secrets and register
 * FIGMA_OAUTH_REDIRECT_URI to enable it (see docs/ARCHITECTURE.md). */
Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  try {
    const { companyId, kind, value } = (await req.json()) as ConnectBody;
    if (!companyId || !kind || !value)
      return json({ error: "companyId, kind, value required" }, 400);

    const caller = await requireRole(req, companyId, "admin");
    if ("error" in caller) return json({ error: caller.error }, caller.status);

    let accessToken = value;
    let refreshToken: string | null = null;
    let scope = "file_read";

    if (kind === "oauth-code") {
      const clientId = Deno.env.get("FIGMA_CLIENT_ID");
      const clientSecret = Deno.env.get("FIGMA_CLIENT_SECRET");
      const redirectUri = Deno.env.get("FIGMA_OAUTH_REDIRECT_URI");
      if (!clientId || !clientSecret || !redirectUri) {
        return json(
          { error: "Figma OAuth is not configured on the server; use a personal access token." },
          400,
        );
      }
      const tokenRes = await fetch("https://api.figma.com/v1/oauth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        },
        body: new URLSearchParams({
          redirect_uri: redirectUri,
          code: value,
          grant_type: "authorization_code",
        }),
      });
      if (!tokenRes.ok) return json({ error: `OAuth exchange failed (${tokenRes.status})` }, 400);
      const tokens = (await tokenRes.json()) as { access_token: string; refresh_token?: string };
      accessToken = tokens.access_token;
      refreshToken = tokens.refresh_token ?? null;
      scope = "files:read";
    } else {
      // Validate the PAT. Figma's new scoped tokens can't call /v1/me unless
      // they carry the current-user scope, and a missing-scope 403 looks
      // different from an invalid-token 403 — accept scope errors as "token
      // works, just narrowly scoped" (file access is checked at import time).
      const me = await figmaGet("/v1/me", accessToken);
      if (!me.ok) {
        const body = (await me.text()).toLowerCase();
        const scopeOnly = me.status === 403 && body.includes("scope");
        if (!scopeOnly) {
          return json(
            {
              error:
                "Figma rejected that token — generate a personal access token with File content read access and try again.",
            },
            400,
          );
        }
      }
    }

    const db = serviceClient();
    const { error } = await db.from("integration_connections").upsert(
      {
        company_id: companyId,
        provider: "figma",
        access_token: accessToken,
        refresh_token: refreshToken,
        scope,
      },
      { onConflict: "company_id,provider" },
    );
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
