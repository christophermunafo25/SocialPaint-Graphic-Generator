import { describe, expect, it } from "vitest";
import { EXPORT_BINARIES_NOTE, buildWorkspaceExport } from "./workspaceExport";
import type { BrandAsset, Company, TemplateSchema } from "../types";

const company: Company = {
  id: "c1",
  name: "Acme",
  slug: "acme",
  createdAt: "2026-01-01T00:00:00Z",
  timezone: "America/New_York",
  linkDefaults: { allowUploads: true, expiryDays: 30, useCap: null },
};

const asset: BrandAsset = {
  id: "asset-1",
  companyId: "c1",
  kind: "logo",
  name: "logo.svg",
  url: "brand-assets:c1/logo/logo.svg",
  metadata: {},
  createdAt: "2026-01-02T00:00:00Z",
};

const template = {
  id: "t1",
  companyId: "c1",
  name: "Anniversary",
  description: "",
  category: "",
  tags: [],
  status: "published",
  canvasWidth: 1440,
  canvasHeight: 1440,
  backgroundUrl: "",
  fields: [],
  captionTemplate: "{name}",
  createdAt: "2026-01-03T00:00:00Z",
  updatedAt: "2026-01-03T00:00:00Z",
} as TemplateSchema;

describe("buildWorkspaceExport", () => {
  const payload = buildWorkspaceExport({
    company,
    brandKit: null,
    brandAssets: [asset],
    templates: [template],
    members: [{ userId: "u1", email: "a@acme.com", role: "admin" }],
    usageEvents: [
      {
        templateId: "t1",
        action: "open",
        actor: "member",
        userId: "u1",
        createdAt: "2026-01-04T00:00:00Z",
      },
    ],
  });

  it("declares its format, version, and the binaries caveat in the file itself", () => {
    expect(payload.format).toBe("socialpaint-workspace-export");
    expect(payload.version).toBe(1);
    expect(payload.note).toBe(EXPORT_BINARIES_NOTE);
    expect(payload.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("carries the company facts, but not the link defaults", () => {
    expect(payload.company).toEqual({
      id: "c1",
      name: "Acme",
      slug: "acme",
      timezone: "America/New_York",
      createdAt: "2026-01-01T00:00:00Z",
    });
  });

  it("references binaries by storage path rather than embedding them", () => {
    expect(payload.brandAssets).toEqual([
      {
        id: "asset-1",
        kind: "logo",
        name: "logo.svg",
        url: "brand-assets:c1/logo/logo.svg",
        metadata: {},
        createdAt: "2026-01-02T00:00:00Z",
      },
    ]);
  });

  it("includes templates with fields, members with roles, and raw usage events", () => {
    expect(payload.templates).toHaveLength(1);
    expect(payload.templates[0].fields).toEqual([]);
    expect(payload.members).toEqual([{ userId: "u1", email: "a@acme.com", role: "admin" }]);
    expect(payload.usageEvents[0]).toMatchObject({ templateId: "t1", action: "open" });
  });

  it("survives a round-trip through JSON untouched", () => {
    expect(JSON.parse(JSON.stringify(payload))).toEqual(payload);
  });
});
