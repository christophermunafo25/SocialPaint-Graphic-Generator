// Shared helpers for the Figma Edge Functions. Runs in Deno (Supabase Edge).
// Tokens live ONLY here (integration_connections via service role) — the
// browser client never talks to Figma directly.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { HttpError } from "./http.ts";

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

/** Hard ceiling on decomposed pieces per import. Shared so the import that
 * accepts a frame and the recompose that re-renders it can never disagree. */
export const MAX_UNITS = 300;

/** How many node ids go into one /v1/images call. The image endpoint is the
 * rate constraint on big frames — batching (not refusal) is how a detailed
 * template imports. */
const RENDER_BATCH = 25;

/** Run `fn` over items with at most `limit` in flight. Rejects on the first
 * failure, like Promise.all. */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

/** Batched node render at 2×, keyed by node id. Ids are chunked into
 * /v1/images calls (a few in flight) so a frame with hundreds of pieces
 * renders instead of tripping a URL-length limit or serializing minutes of
 * render time. A failed batch fails the whole render — a partial map would
 * quietly compose a plate with missing artwork and report success. */
export async function renderNodes(
  fileKey: string,
  ids: string[],
  token: string,
): Promise<Record<string, string | null>> {
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += RENDER_BATCH) batches.push(ids.slice(i, i + RENDER_BATCH));
  const out: Record<string, string | null> = {};
  const results = await mapLimit(batches, 3, async (batch) => {
    const res = await figmaGet(
      `/v1/images/${fileKey}?ids=${encodeURIComponent(batch.join(","))}&format=png&scale=2`,
      token,
    );
    if (!res.ok) throw new HttpError(400, `Figma render failed (${res.status}).`);
    return ((await res.json()) as { images: Record<string, string | null> }).images;
  });
  for (const images of results) Object.assign(out, images);
  return out;
}

/** The file's image-fill map (imageRef → source bitmap URL), fetched once. */
export async function fetchFillMap(
  fileKey: string,
  token: string,
): Promise<Record<string, string>> {
  const res = await figmaGet(`/v1/files/${fileKey}/images`, token);
  if (!res.ok) return {};
  return ((await res.json()) as { meta?: { images?: Record<string, string> } }).meta?.images ?? {};
}

/** Download a remote image and re-host it in our Storage (Figma URLs expire
 * and lack reliable CORS). Returns a storage reference ("bucket/path" — the
 * buckets are private; the client signs it), or null on failure. */
export async function rehost(
  db: SupabaseClient,
  url: string,
  path: string,
): Promise<string | null> {
  const res = await fetch(url);
  if (!res.ok) return null;
  const up = await db.storage
    .from("template-backgrounds")
    .upload(path, await res.arrayBuffer(), { contentType: "image/png" });
  if (up.error) return null;
  return `template-backgrounds/${path}`;
}
