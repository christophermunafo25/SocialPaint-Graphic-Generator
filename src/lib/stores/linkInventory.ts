import type { CompanyTemplateLink, TemplateLink } from "../types";

/** Join links to their templates, keeping ONLY the given company's rows.
 *
 * The Supabase store scopes in SQL (an inner join on templates.company_id,
 * under RLS that hides other tenants anyway); the local dev store and its
 * test run this same predicate in code. Extracted so "a second company's
 * links must not appear" is a testable sentence rather than a hope. */
export function joinCompanyLinks(
  links: Array<TemplateLink & { templateId: string }>,
  templates: Array<{ id: string; name: string; companyId: string }>,
  companyId: string,
): CompanyTemplateLink[] {
  const own = new Map(templates.filter((t) => t.companyId === companyId).map((t) => [t.id, t]));
  return (
    links
      .filter((l) => own.has(l.templateId))
      // The local backend stores no tokens: nothing to copy there.
      .map((l) => ({ ...l, templateName: own.get(l.templateId)!.name, token: null }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  );
}
