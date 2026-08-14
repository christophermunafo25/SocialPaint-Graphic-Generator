import { getFigmaToken, requireRole, serviceClient } from "../_shared/figma.ts";
import {
  GENERIC_ERROR,
  HttpError,
  handleOptions,
  jsonResponder,
  logError,
} from "../_shared/http.ts";
import { parseBody, requireUuid } from "../_shared/validate.ts";

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  const json = jsonResponder(req);
  try {
    const body = await parseBody(req);
    const companyId = requireUuid(body.companyId, "companyId");

    const caller = await requireRole(req, companyId, "member");
    if ("error" in caller) return json({ error: caller.error }, caller.status);
    const token = await getFigmaToken(serviceClient(), companyId);
    return json({ connected: Boolean(token) });
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    logError("figma-status", e);
    return json({ error: GENERIC_ERROR }, 500);
  }
});
