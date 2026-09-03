import { describe, expect, it } from "vitest";
import { monthStartIso, summarizeMonthlyUsage } from "./monthlyUsage";

const now = () => new Date().toISOString();

describe("summarizeMonthlyUsage", () => {
  it("names every action: shares are not downloads and bulk exports stand alone", () => {
    const out = summarizeMonthlyUsage(
      [
        { templateId: "t1", userId: "u1", action: "open", actor: "member", createdAt: now() },
        { templateId: "t1", userId: "u1", action: "download", actor: "member", createdAt: now() },
        { templateId: "t1", userId: "u1", action: "share", actor: "member", createdAt: now() },
        {
          templateId: "t2",
          userId: "u2",
          action: "bulk_export",
          actor: "member",
          createdAt: now(),
        },
        {
          templateId: "t2",
          userId: "u2",
          action: "bulk_export",
          actor: "member",
          createdAt: now(),
        },
        { templateId: "t1", userId: null, action: "open", actor: "public", createdAt: now() },
      ],
      "UTC",
    );
    expect(out).toEqual({
      opens: 2,
      downloads: 1,
      bulkExports: 2,
      publicOpens: 1,
      templatesUsed: 2,
      membersActive: 2,
    });
  });

  it("drops events outside the current month", () => {
    const old = new Date();
    old.setMonth(old.getMonth() - 2);
    const out = summarizeMonthlyUsage(
      [{ templateId: "t1", userId: "u1", action: "download", createdAt: old.toISOString() }],
      "UTC",
    );
    expect(out).toMatchObject({ downloads: 0, bulkExports: 0, templatesUsed: 0, membersActive: 0 });
  });

  it("monthStartIso sits before the current instant", () => {
    expect(monthStartIso("UTC") < now()).toBe(true);
    expect(monthStartIso("Australia/Sydney") < now()).toBe(true);
  });
});
