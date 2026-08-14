// Shared helpers for the Figma Edge Functions. Runs in Deno (Supabase Edge).
// Tokens live ONLY here (integration_connections via service role) — the
// browser client never talks to Figma directly.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

// URL parsers live in validate.ts (pure, vitest-covered); re-exported here so
// the functions keep one import for all Figma plumbing.
export { parseFigmaFileKey, parseFigmaUrl } from "./validate.ts";

/** Service-role client — bypasses RLS; only ever used server-side. */
export function serviceClient(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

/** Authenticate the caller from their JWT and require a membership (or
 * admin membership) in the company. Returns the caller's user id, or an
 * error payload. Used by every function so nobody can act on a company
 * they don't belong to. */
export async function requireRole(
  req: Request,
  companyId: string,
  minRole: "member" | "admin",
): Promise<{ userId: string } | { error: string; status: number }> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return { error: "Not signed in.", status: 401 };
  const { data: membership } = await serviceClient()
    .from("memberships")
    .select("role")
    .eq("user_id", userData.user.id)
    .eq("company_id", companyId)
    .maybeSingle();
  const role = (membership as { role: string } | null)?.role;
  if (!role) return { error: "You are not a member of this company.", status: 403 };
  if (minRole === "admin" && role !== "admin") {
    return { error: "Admin access required.", status: 403 };
  }
  return { userId: userData.user.id };
}

export async function getFigmaToken(db: SupabaseClient, companyId: string): Promise<string | null> {
  const { data } = await db
    .from("integration_connections")
    .select("access_token")
    .eq("company_id", companyId)
    .eq("provider", "figma")
    .maybeSingle();
  return (data as { access_token: string } | null)?.access_token ?? null;
}

export async function figmaGet(path: string, token: string): Promise<Response> {
  return fetch(`https://api.figma.com${path}`, { headers: { "X-Figma-Token": token } });
}
