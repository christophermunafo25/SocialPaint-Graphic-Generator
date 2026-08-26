// Admin management of public template links: list, create, rename, revoke,
// regenerate.
//
// Every mutation lives here rather than behind an RLS write policy for two
// reasons. Tokens are minted server-side and stored hashed, so the client
// must never be the thing that decides what a token is; and every action
// lands in the link audit trail, which only works if there is one door.
//
// Two authorisation checks, both required:
//   * requireRole(companyId, "admin") — the caller is an admin of the company
//     they claim.
//   * the template (or the link's template) actually belongs to that company.
// The second is what stops an admin of company A passing company A's id
// alongside company B's template id.

import { requireRole, serviceClient } from "../_shared/figma.ts";
import {
  GENERIC_ERROR,
  HttpError,
  handleOptions,
  jsonResponder,
  logError,
} from "../_shared/http.ts";
import {
  optionalFutureIso,
  optionalInt,
  optionalString,
  parseBody,
  requireEnum,
  requireUuid,
} from "../_shared/validate.ts";
import { hashToken, mintToken } from "../_shared/publicLink.ts";

const MAX_LINKS_PER_TEMPLATE = 50;
const MAX_NAME_CHARS = 80;

/** The admin's view of a link. token_hash is not here and must never be:
 * it is not a working key, but there is no reason to move it around either. */
interface LinkView {
  id: string;
  name: string;
  allowUploads: boolean;
  expiresAt: string | null;
  useCap: number | null;
  useCount: number;
  revokedAt: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

const LINK_COLUMNS =
  "id, name, allow_uploads, expires_at, use_cap, use_count, revoked_at, created_at, last_used_at";

interface LinkRow {
  id: string;
  name: string;
  allow_uploads: boolean;
  expires_at: string | null;
  use_cap: number | null;
  use_count: number;
  revoked_at: string | null;
  created_at: string;
  last_used_at: string | null;
}

const toView = (r: LinkRow): LinkView => ({
  id: r.id,
  name: r.name,
  allowUploads: r.allow_uploads,
  expiresAt: r.expires_at,
  useCap: r.use_cap,
  useCount: r.use_count,
  revokedAt: r.revoked_at,
  createdAt: r.created_at,
  lastUsedAt: r.last_used_at,
});

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  const json = jsonResponder(req);

  try {
    const body = await parseBody(req);
    const companyId = requireUuid(body.companyId, "companyId");
    const action = requireEnum(body.action, "action", [
      "list",
      "create",
      "update",
      "revoke",
      "regenerate",
    ] as const);

    const caller = await requireRole(req, companyId, "admin");
    if ("error" in caller) return json({ error: caller.error }, caller.status);

    const db = serviceClient();

    if (action === "list" || action === "create") {
      const templateId = requireUuid(body.templateId, "templateId");
      const { data: template, error } = await db
        .from("templates")
        .select("id, company_id, status")
        .eq("id", templateId)
        .maybeSingle();
      if (error) throw error;
      // Not found and belongs-to-someone-else take the same answer: an admin
      // has no business learning that a template id exists elsewhere.
      const row = template as { id: string; company_id: string; status: string } | null;
      if (!row || row.company_id !== companyId) {
        throw new HttpError(404, "That template doesn't exist.");
      }

      if (action === "list") {
        const { data, error: listError } = await db
          .from("template_links")
          .select(LINK_COLUMNS)
          .eq("template_id", templateId)
          .order("created_at", { ascending: false });
        if (listError) throw listError;
        return json({ links: (data as LinkRow[]).map(toView) });
      }

      // Create. Only for a published template: a link to a draft would be a
      // link that refuses on its first open, which is worse than refusing to
      // create it.
      if (row.status !== "published") {
        throw new HttpError(400, "Publish this template before sharing a public link.");
      }

      const { count, error: countError } = await db
        .from("template_links")
        .select("id", { count: "exact", head: true })
        .eq("template_id", templateId);
      if (countError) throw countError;
      if ((count ?? 0) >= MAX_LINKS_PER_TEMPLATE) {
        throw new HttpError(400, `A template can have at most ${MAX_LINKS_PER_TEMPLATE} links.`);
      }

      const token = mintToken();
      const { data: created, error: insertError } = await db
        .from("template_links")
        .insert({
          template_id: templateId,
          name: optionalString(body.name, "name", MAX_NAME_CHARS) ?? "",
          token_hash: await hashToken(token),
          allow_uploads: body.allowUploads === undefined ? true : body.allowUploads === true,
          expires_at: optionalFutureIso(body.expiresAt, "expiresAt", { maxYearsAhead: 5 }) ?? null,
          use_cap: optionalInt(body.useCap, "useCap", { min: 1, max: 1_000_000 }) ?? null,
          created_by: caller.userId,
        })
        .select(LINK_COLUMNS)
        .single();
      if (insertError) throw insertError;

      const link = toView(created as LinkRow);
      await audit(db, link.id, companyId, "created", caller.userId, { name: link.name });
      // The plaintext token is returned exactly once, here.
      return json({ link, token });
    }

    // update / revoke / regenerate all address an existing link.
    const linkId = requireUuid(body.linkId, "linkId");
    const { data: existing, error: findError } = await db
      .from("template_links")
      .select("id, use_count, name, templates!inner(company_id)")
      .eq("id", linkId)
      .maybeSingle();
    if (findError) throw findError;
    const found = existing as {
      id: string;
      use_count: number;
      name: string;
      templates: { company_id: string };
    } | null;
    if (!found || found.templates?.company_id !== companyId) {
      throw new HttpError(404, "That link doesn't exist.");
    }

    if (action === "revoke") {
      // Immediate by construction: the gate reads revoked_at on every
      // request and nothing caches it, so the next open fails. There is no
      // expiry to wait out.
      const { data, error } = await db
        .from("template_links")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", linkId)
        .select(LINK_COLUMNS)
        .single();
      if (error) throw error;
      await audit(db, linkId, companyId, "revoked", caller.userId, {
        name: found.name,
        useCountAtRevoke: found.use_count,
      });
      return json({ link: toView(data as LinkRow) });
    }

    if (action === "regenerate") {
      // One action, two effects: the old token stops matching the moment the
      // hash is replaced, and the new one is live. There is no window in
      // which both work, and no second step an admin can forget.
      //
      // The count resets because the reason to regenerate is that the old
      // link got somewhere it shouldn't — an admin re-issuing a capped link
      // wants the cap to apply to the new audience, not to the leak. The
      // prior count is kept in the audit detail.
      const token = mintToken();
      const { data, error } = await db
        .from("template_links")
        .update({
          token_hash: await hashToken(token),
          use_count: 0,
          revoked_at: null,
          last_used_at: null,
        })
        .eq("id", linkId)
        .select(LINK_COLUMNS)
        .single();
      if (error) throw error;
      await audit(db, linkId, companyId, "regenerated", caller.userId, {
        name: found.name,
        previousUseCount: found.use_count,
      });
      return json({ link: toView(data as LinkRow), token });
    }

    // update: name, expiry, cap, upload switch. Never the token.
    const patch: Record<string, unknown> = {};
    if ("name" in body) patch.name = optionalString(body.name, "name", MAX_NAME_CHARS) ?? "";
    if ("allowUploads" in body) patch.allow_uploads = body.allowUploads === true;
    if ("expiresAt" in body) {
      patch.expires_at =
        optionalFutureIso(body.expiresAt, "expiresAt", { maxYearsAhead: 5 }) ?? null;
    }
    if ("useCap" in body) {
      patch.use_cap = optionalInt(body.useCap, "useCap", { min: 1, max: 1_000_000 }) ?? null;
    }
    if (Object.keys(patch).length === 0) throw new HttpError(400, "Nothing to update.");

    const { data, error } = await db
      .from("template_links")
      .update(patch)
      .eq("id", linkId)
      .select(LINK_COLUMNS)
      .single();
    if (error) throw error;
    await audit(db, linkId, companyId, "updated", caller.userId, {
      changed: Object.keys(patch),
    });
    return json({ link: toView(data as LinkRow) });
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    logError("template-links", e);
    return json({ error: GENERIC_ERROR }, 500);
  }
});

/** Audit writes must never be the reason a link action fails — the action
 * already happened by the time we get here. Failures are logged loudly so a
 * silently unaudited trail is visible in the function logs. */
async function audit(
  db: ReturnType<typeof serviceClient>,
  linkId: string,
  companyId: string,
  action: "created" | "updated" | "revoked" | "regenerated",
  actorId: string,
  detail: Record<string, unknown>,
): Promise<void> {
  const { error } = await db.from("template_link_events").insert({
    link_id: linkId,
    company_id: companyId,
    action,
    actor_id: actorId,
    detail,
  });
  if (error) console.error("[template-links] audit write failed", action, linkId, error.message);
}
