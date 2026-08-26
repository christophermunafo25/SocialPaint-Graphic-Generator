import type { TemplateLink, TemplateLinkPatch, TemplateLinkWithToken } from "../../types";
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
