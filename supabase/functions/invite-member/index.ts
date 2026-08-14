import { requireRole, serviceClient } from "../_shared/figma.ts";
import {
  GENERIC_ERROR,
  HttpError,
  handleOptions,
  jsonResponder,
  logError,
} from "../_shared/http.ts";
import {
  parseBody,
  requireAllowedRedirect,
  requireEmail,
  requireEnum,
  requireUuid,
} from "../_shared/validate.ts";

/** Invite a person to a company. Caller must be an ADMIN of that company
 * (verified from their JWT). Uses the service role to send Supabase's invite
 * email and create the membership — the service role never leaves here. */
Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  const json = jsonResponder(req);
  try {
    const body = await parseBody(req);
    const companyId = requireUuid(body.companyId, "companyId");
    const email = requireEmail(body.email, "email");
    const role = requireEnum(body.role, "role", ["admin", "member"] as const);
    // The invite email's landing link must be one of OUR origins — anything
    // else would let a compromised session mint phishing links from our
    // sender address.
    const redirectTo =
      body.redirectTo === undefined || body.redirectTo === null
        ? undefined
        : requireAllowedRedirect(body.redirectTo, "redirectTo");

    const caller = await requireRole(req, companyId, "admin");
    if ("error" in caller) return json({ error: caller.error }, caller.status);

    const db = serviceClient();

    // Send the invite. If the address already has an account, fall back to
    // just creating the membership.
    let userId: string | null = null;
    const invited = await db.auth.admin.inviteUserByEmail(email, { redirectTo });
    if (invited.data.user) {
      userId = invited.data.user.id;
    } else {
      const { data: existing } = await db
        .from("users")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      userId = (existing as { id: string } | null)?.id ?? null;
      if (!userId) {
        logError("invite-member", invited.error);
        return json({ error: "Could not invite that address." }, 400);
      }
    }

    const { error } = await db
      .from("memberships")
      .upsert(
        { user_id: userId, company_id: companyId, role },
        { onConflict: "user_id,company_id" },
      );
    if (error) {
      logError("invite-member", error);
      return json({ error: "Could not save the membership — try again." }, 500);
    }

    return json({ ok: true, existing: !invited.data.user });
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    logError("invite-member", e);
    return json({ error: GENERIC_ERROR }, 500);
  }
});
