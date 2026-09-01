// Connection status and provenance for Settings → Integrations: for each
// provider, whether the workspace is connected, WHOSE credential it is, and
// when it was stored. The token itself never appears in a response — not
// even masked. integration_connections has no client RLS policy at all, so
// this function is the only way status reaches a browser; it is admin-only
// because provenance (who connected, when) is an administrative fact.

import { requireRole, serviceClient } from "../_shared/figma.ts";
import {
  GENERIC_ERROR,
  HttpError,
  handleOptions,
  jsonResponder,
  logError,
} from "../_shared/http.ts";
import { parseBody, requireUuid } from "../_shared/validate.ts";
import { canvaEnabled } from "../_shared/canva.ts";

interface ConnectionRow {
  provider: string;
  connected_by: string | null;
  created_at: string;
  expires_at: string | null;
  users: { email: string } | null;
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  const json = jsonResponder(req);
  try {
    const body = await parseBody(req);
    const companyId = requireUuid(body.companyId, "companyId");

    const caller = await requireRole(req, companyId, "admin");
    if ("error" in caller) return json({ error: caller.error }, caller.status);

    const { data, error } = await serviceClient()
      .from("integration_connections")
      // The one FK to users is connected_by, so the bare embed resolves it.
      .select("provider, connected_by, created_at, expires_at, users(email)")
      .eq("company_id", companyId);
    if (error) {
      logError("integration-status", error);
      return json({ error: "Could not load integration status — try again." }, 500);
    }

    const rows = (data ?? []) as unknown as ConnectionRow[];
    const info = (provider: "figma" | "canva", enabled: boolean) => {
      const row = rows.find((r) => r.provider === provider);
      return {
        provider,
        enabled,
        connected: Boolean(row),
        connectedByEmail: row?.users?.email ?? null,
        connectedAt: row?.created_at ?? null,
        expiresAt: row?.expires_at ?? null,
      };
    };

    return json({ connections: [info("figma", true), info("canva", canvaEnabled())] });
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    logError("integration-status", e);
    return json({ error: GENERIC_ERROR }, 500);
  }
});
