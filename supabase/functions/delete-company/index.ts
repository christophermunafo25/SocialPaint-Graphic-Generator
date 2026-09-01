// Delete a workspace — the Settings → Advanced end of the road. The caller
// must be an ADMIN of the company (verified from their JWT, same as
// invite-member); the delete itself runs under the service role because the
// client's RLS grants no DELETE on companies, deliberately: one row here
// takes templates, fields, links, link events, brand kits, assets, usage
// events, and memberships with it (every table references companies(id)
// on delete cascade — inventoried at the bottom of 0026), and an action of
// that size belongs behind exactly one server-side door.
//
// Storage objects under the company's prefix are swept best-effort AFTER the
// rows are gone: the database is the source of truth, and an orphaned PNG is
// an acceptable failure where an orphaned tenant row is not.

import { requireRole, serviceClient } from "../_shared/figma.ts";
import {
  GENERIC_ERROR,
  HttpError,
  handleOptions,
  jsonResponder,
  logError,
} from "../_shared/http.ts";
import { parseBody, requireUuid } from "../_shared/validate.ts";

const BUCKETS = ["brand-assets", "template-backgrounds"];

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  const json = jsonResponder(req);
  try {
    const body = await parseBody(req);
    const companyId = requireUuid(body.companyId, "companyId");

    const caller = await requireRole(req, companyId, "admin");
    if ("error" in caller) return json({ error: caller.error }, caller.status);

    const db = serviceClient();
    const { error } = await db.from("companies").delete().eq("id", companyId);
    if (error) {
      logError("delete-company", error);
      return json({ error: "Could not delete the workspace — try again." }, 500);
    }

    // Best-effort binary sweep. Failures are logged, never surfaced — the
    // workspace is already gone.
    for (const bucket of BUCKETS) {
      try {
        await sweepPrefix(db, bucket, companyId);
      } catch (e) {
        logError("delete-company", e);
      }
    }

    return json({ ok: true });
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    logError("delete-company", e);
    return json({ error: GENERIC_ERROR }, 500);
  }
});

/** Remove every object under `${prefix}/`, walking folders breadth-first.
 * Bounded: storage paths here are at most a few levels deep by construction
 * (companyId/kind/file), so the depth cap is a guard, not a limit hit in
 * practice. */
async function sweepPrefix(
  db: ReturnType<typeof serviceClient>,
  bucket: string,
  prefix: string,
): Promise<void> {
  const queue = [prefix];
  let depth = 0;
  while (queue.length > 0 && depth < 6) {
    depth += 1;
    const folders = queue.splice(0);
    for (const folder of folders) {
      const { data, error } = await db.storage.from(bucket).list(folder, { limit: 1000 });
      if (error || !data) continue;
      const files = data.filter((o) => o.id !== null).map((o) => `${folder}/${o.name}`);
      // A row without an id is a subfolder in Supabase Storage's listing.
      queue.push(...data.filter((o) => o.id === null).map((o) => `${folder}/${o.name}`));
      if (files.length > 0) await db.storage.from(bucket).remove(files);
    }
  }
}
