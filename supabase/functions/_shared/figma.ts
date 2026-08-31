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

/** Fetch a node's subtree ONCE, with geometry=paths — the same tree serves
 * the field walk and the background decomposition. geometry=paths is what
 * makes relativeTransform, size, and fillGeometry appear, i.e. rotation,
 * true unrotated bounds, and the raster-leaf test all depend on it. */
export async function fetchNodeTree<T>(
  fileKey: string,
  nodeId: string,
  token: string,
): Promise<{ root: T } | { error: string; status: number }> {
  const res = await figmaGet(
    `/v1/files/${fileKey}/nodes?ids=${encodeURIComponent(nodeId)}&geometry=paths`,
    token,
  );
  if (!res.ok) return { error: `Figma nodes request failed (${res.status}).`, status: 400 };
  const body = (await res.json()) as { nodes: Record<string, { document?: T } | null> };
  const root = body.nodes[nodeId]?.document;
  if (!root) return { error: "That node was not found in the file.", status: 400 };
  return { root };
}

/** How many node ids go into one /v1/images call. The image endpoint is the
 * rate constraint on big frames — batching (not refusal) is how a detailed
 * template imports. */
const RENDER_BATCH = 25;

/** Batched node render at 2×, keyed by node id. Ids are chunked into
 * sequential /v1/images calls so a frame with hundreds of pieces renders
 * instead of tripping a URL-length or rate limit. */
export async function renderNodes(
  fileKey: string,
  ids: string[],
  token: string,
): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {};
  for (let i = 0; i < ids.length; i += RENDER_BATCH) {
    const batch = ids.slice(i, i + RENDER_BATCH);
    const res = await figmaGet(
      `/v1/images/${fileKey}?ids=${encodeURIComponent(batch.join(","))}&format=png&scale=2`,
      token,
    );
    if (!res.ok) continue;
    Object.assign(out, ((await res.json()) as { images: Record<string, string | null> }).images);
  }
  return out;
}
