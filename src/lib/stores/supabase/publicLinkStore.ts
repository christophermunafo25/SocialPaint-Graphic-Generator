import type {
  CompanyTemplateLink,
  TemplateLink,
  TemplateLinkPatch,
  TemplateLinkWithToken,
} from "../../types";
import type { PublicLinkStore } from "../interfaces";
import { isSupabaseConfigured, supabase } from "./client";

/** Public share links. Every call goes through the template-links Edge
 * Function — the client never writes template_links, because the token has
 * to be minted and hashed somewhere the browser cannot reach, and because
 * every link action has to land in the audit trail on its way past.
 *
 * There is no getToken(): the plaintext exists only in the response that
 * created it. Losing a link means regenerating it, which is the correct
 * consequence — a token you can look up later is a token sitting in a
 * database waiting to be dumped. */
export class SupabasePublicLinkStore implements PublicLinkStore {
  isAvailable(): boolean {
    return isSupabaseConfigured;
  }

  async list(companyId: string, templateId: string): Promise<TemplateLink[]> {
    const { links } = await this.call<{ links: TemplateLink[] }>({
      companyId,
      action: "list",
      templateId,
    });
    return links;
  }

  async create(
    companyId: string,
    templateId: string,
    input: TemplateLinkPatch,
  ): Promise<TemplateLinkWithToken> {
    return this.call<TemplateLinkWithToken>({
      companyId,
      action: "create",
      templateId,
      ...input,
    });
  }

  async update(companyId: string, linkId: string, patch: TemplateLinkPatch): Promise<TemplateLink> {
    const { link } = await this.call<{ link: TemplateLink }>({
      companyId,
      action: "update",
      linkId,
      ...patch,
    });
    return link;
  }

  async revoke(companyId: string, linkId: string): Promise<TemplateLink> {
    const { link } = await this.call<{ link: TemplateLink }>({
      companyId,
      action: "revoke",
      linkId,
    });
    return link;
  }

  async regenerate(companyId: string, linkId: string): Promise<TemplateLinkWithToken> {
    return this.call<TemplateLinkWithToken>({ companyId, action: "regenerate", linkId });
  }

  /** The Sharing inventory is a READ, so it goes straight to the table under
   * RLS (admin_read_template_links already scopes rows to the caller's own
   * company; the inner join makes the companyId contract explicit) rather
   * than through the Edge Function, which exists for mutations. */
  async listAll(companyId: string): Promise<CompanyTemplateLink[]> {
    const { data, error } = await supabase()
      .from("template_links")
      .select(
        "id, name, allow_uploads, expires_at, use_cap, use_count, revoked_at, created_at, " +
          "last_used_at, template_id, templates!inner(name, company_id)",
      )
      .eq("templates.company_id", companyId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (
      data as unknown as Array<{
        id: string;
        name: string;
        allow_uploads: boolean;
        expires_at: string | null;
        use_cap: number | null;
        use_count: number;
        revoked_at: string | null;
        created_at: string;
        last_used_at: string | null;
        template_id: string;
        templates: { name: string } | null;
      }>
    ).map((r) => ({
      id: r.id,
      name: r.name,
      allowUploads: r.allow_uploads,
      expiresAt: r.expires_at,
      useCap: r.use_cap,
      useCount: r.use_count,
      revokedAt: r.revoked_at,
      createdAt: r.created_at,
      lastUsedAt: r.last_used_at,
      templateId: r.template_id,
      templateName: r.templates?.name ?? "(deleted template)",
    }));
  }

  /** The function answers a refusal with `{ error }` and a 4xx, which
   * functions.invoke surfaces as a transport error whose body the caller
   * cannot see. Read it back so the admin gets the real sentence ("Publish
   * this template before sharing a public link") rather than a status code. */
  private async call<T>(body: Record<string, unknown>): Promise<T> {
    const { data, error } = await supabase().functions.invoke("template-links", { body });
    if (error) {
      const detail = await readErrorMessage(error);
      throw new Error(detail ?? "That didn't work. Try again.");
    }
    return data as T;
  }
}

async function readErrorMessage(error: unknown): Promise<string | null> {
  const response = (error as { context?: Response }).context;
  if (!(response instanceof Response)) return null;
  try {
    const body = (await response.clone().json()) as { error?: string };
    return typeof body.error === "string" ? body.error : null;
  } catch {
    return null;
  }
}
