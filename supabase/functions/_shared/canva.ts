// Canva token storage and refresh. Tokens live in integration_connections
// (provider = 'canva') exactly like Figma's — Edge Functions only, service
// role only, never a client.
//
// Canva access tokens are short-lived and refresh tokens ROTATE on use, so
// concurrent refreshes are dangerous: the loser of a race holds a revoked
// refresh token and the connection is stranded. A lease column
// (refresh_lease_until) makes the claim atomic — one UPDATE with a
// conditional WHERE either wins the lease or observes another worker's
// in-flight refresh and briefly waits for its result.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

const TOKEN_ENDPOINT = "https://api.canva.com/rest/v1/oauth/token";
const LEASE_SECONDS = 30;
/** Refresh this long before nominal expiry so a token never dies mid-call. */
const EXPIRY_MARGIN_MS = 120_000;

/** CANVA_ENABLED=true plus a Connect API client id turns the feature on.
 * CANVA_AUTOBUILD_ENABLED is the old name for the same switch; the fallback
 * can be dropped once no environment sets it. */
export const canvaEnabled = (): boolean => {
  const flag = Deno.env.get("CANVA_ENABLED") ?? Deno.env.get("CANVA_AUTOBUILD_ENABLED");
  return flag === "true" && Boolean(Deno.env.get("CANVA_CLIENT_ID"));
};

interface ConnectionRow {
  id: string;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
}

export async function getCanvaToken(db: SupabaseClient, companyId: string): Promise<string | null> {
  const { data } = await db
    .from("integration_connections")
    .select("id, access_token, refresh_token, expires_at")
    .eq("company_id", companyId)
    .eq("provider", "canva")
    .maybeSingle();
  const row = data as ConnectionRow | null;
  if (!row) return null;

  const fresh =
    row.expires_at && new Date(row.expires_at).getTime() - Date.now() > EXPIRY_MARGIN_MS;
  if (fresh || !row.refresh_token) return row.access_token;

  // Claim the refresh lease atomically. Only one worker's UPDATE matches the
  // WHERE clause; the rest see an in-flight refresh.
  const leaseUntil = new Date(Date.now() + LEASE_SECONDS * 1000).toISOString();
  const now = new Date().toISOString();
  const { data: claimed } = await db
    .from("integration_connections")
    .update({ refresh_lease_until: leaseUntil })
    .eq("id", row.id)
    .or(`refresh_lease_until.is.null,refresh_lease_until.lt.${now}`)
    .select("id, refresh_token");
  const won = Array.isArray(claimed) && claimed.length > 0;

  if (!won) {
    // Another invocation is refreshing. Wait briefly, then read its result.
    await new Promise((r) => setTimeout(r, 1500));
    const { data: after } = await db
      .from("integration_connections")
      .select("access_token")
      .eq("id", row.id)
      .maybeSingle();
    return (after as { access_token: string } | null)?.access_token ?? row.access_token;
  }

  try {
    const clientId = Deno.env.get("CANVA_CLIENT_ID") ?? "";
    const clientSecret = Deno.env.get("CANVA_CLIENT_SECRET");
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: (claimed![0] as { refresh_token: string }).refresh_token,
      client_id: clientId,
    });
    if (clientSecret) body.set("client_secret", clientSecret);
    const res = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) throw new Error(`Canva refresh failed (${res.status}).`);
    const tokens = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };
    await db
      .from("integration_connections")
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? row.refresh_token,
        expires_at: tokens.expires_in
          ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
          : null,
        refresh_lease_until: null,
      })
      .eq("id", row.id);
    return tokens.access_token;
  } catch {
    // Release the lease so the next call can retry; the old access token may
    // still have life in it.
    await db.from("integration_connections").update({ refresh_lease_until: null }).eq("id", row.id);
    return row.access_token;
  }
}

// ---------------------------------------------------------------------------
// PKCE helpers for the connect flow.
// ---------------------------------------------------------------------------

const b64url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

export function makePkcePair(): { verifier: string; state: string } {
  const rand = (n: number) => {
    const b = new Uint8Array(n);
    crypto.getRandomValues(b);
    return b64url(b);
  };
  return { verifier: rand(48), state: rand(24) };
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return b64url(new Uint8Array(digest));
}

export async function exchangeCanvaCode(
  code: string,
  verifier: string,
  redirectUri: string,
): Promise<{ access_token: string; refresh_token?: string; expires_in?: number }> {
  const clientId = Deno.env.get("CANVA_CLIENT_ID") ?? "";
  const clientSecret = Deno.env.get("CANVA_CLIENT_SECRET");
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    code_verifier: verifier,
    client_id: clientId,
    redirect_uri: redirectUri,
  });
  if (clientSecret) body.set("client_secret", clientSecret);
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Canva token exchange failed (${res.status}). ${detail.slice(0, 200)}`);
  }
  return (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };
}
