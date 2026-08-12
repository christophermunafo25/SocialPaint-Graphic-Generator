import { handleOptions, json, requireRole, serviceClient } from "../_shared/figma.ts";

interface InviteBody {
  companyId?: string;
  email?: string;
  role?: "admin" | "member";
  redirectTo?: string;
}

/** Invite a person to a company. Caller must be an ADMIN of that company
 * (verified from their JWT). Uses the service role to send Supabase's invite
 * email and create the membership — the service role never leaves here. */
Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;
  try {
    const { companyId, email, role, redirectTo } = (await req.json()) as InviteBody;
    if (!companyId || !email || !role)
      return json({ error: "companyId, email, role required" }, 400);
    if (role !== "admin" && role !== "member")
      return json({ error: "role must be admin or member" }, 400);

    const caller = await requireRole(req, companyId, "admin");
    if ("error" in caller) return json({ error: caller.error }, caller.status);

    const db = serviceClient();

    // Send the invite. If the address already has an account, fall back to
    // just creating the membership.
    let userId: string | null = null;
    const invited = await db.auth.admin.inviteUserByEmail(email, {
      redirectTo: redirectTo ?? undefined,
    });
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
        return json({ error: invited.error?.message ?? "Could not invite that address." }, 400);
      }
    }

    const { error } = await db
      .from("memberships")
      .upsert(
        { user_id: userId, company_id: companyId, role },
        { onConflict: "user_id,company_id" },
      );
    if (error) return json({ error: error.message }, 500);

    return json({ ok: true, existing: !invited.data.user });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
