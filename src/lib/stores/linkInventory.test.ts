import { describe, expect, it } from "vitest";
import { joinCompanyLinks } from "./linkInventory";
import type { TemplateLink } from "../types";

const link = (
  id: string,
  templateId: string,
  createdAt: string,
): TemplateLink & { templateId: string } => ({
  id,
  templateId,
  name: `link-${id}`,
  allowUploads: true,
  expiresAt: null,
  useCap: null,
  useCount: 0,
  revokedAt: null,
  createdAt,
  lastUsedAt: null,
});

const templates = [
  { id: "t-a1", name: "A one", companyId: "company-a" },
  { id: "t-a2", name: "A two", companyId: "company-a" },
  { id: "t-b1", name: "B one", companyId: "company-b" },
];

describe("joinCompanyLinks", () => {
  it("scopes to one company — a second company's links must not appear", () => {
    const rows = joinCompanyLinks(
      [
        link("1", "t-a1", "2026-01-01T00:00:00Z"),
        link("2", "t-b1", "2026-01-02T00:00:00Z"),
        link("3", "t-a2", "2026-01-03T00:00:00Z"),
      ],
      templates,
      "company-a",
    );
    expect(rows.map((r) => r.id).sort()).toEqual(["1", "3"]);
    expect(rows.every((r) => r.templateName.startsWith("A"))).toBe(true);
  });

  it("drops links whose template is gone rather than inventing a row", () => {
    const rows = joinCompanyLinks(
      [link("1", "t-deleted", "2026-01-01T00:00:00Z")],
      templates,
      "company-a",
    );
    expect(rows).toEqual([]);
  });

  it("carries the template name and sorts newest first", () => {
    const rows = joinCompanyLinks(
      [link("old", "t-a1", "2026-01-01T00:00:00Z"), link("new", "t-a2", "2026-02-01T00:00:00Z")],
      templates,
      "company-a",
    );
    expect(rows[0]).toMatchObject({ id: "new", templateName: "A two" });
    expect(rows[1]).toMatchObject({ id: "old", templateName: "A one" });
  });

  it("returns nothing for a company with no templates", () => {
    expect(
      joinCompanyLinks([link("1", "t-a1", "2026-01-01T00:00:00Z")], templates, "company-c"),
    ).toEqual([]);
  });
});
