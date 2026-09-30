import { describe, expect, it } from "vitest";
import {
  aiUsageLine,
  exactMonthStartIso,
  monthStartIso,
  summarizeMonthlyUsage,
} from "./monthlyUsage";

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

describe("exactMonthStartIso", () => {
  it("is local midnight on the 1st, in the zone", () => {
    const now = new Date("2026-09-29T15:00:00Z");
    expect(exactMonthStartIso("UTC", now)).toBe("2026-09-01T00:00:00.000Z");
    // Chicago is on CDT (UTC-5) on September 1st.
    expect(exactMonthStartIso("America/Chicago", now)).toBe("2026-09-01T05:00:00.000Z");
    // Tokyo is UTC+9: its September starts on August 31st in UTC.
    expect(exactMonthStartIso("Asia/Tokyo", now)).toBe("2026-08-31T15:00:00.000Z");
  });

  it("uses the zone's month when UTC is already in the next one", () => {
    // 02:00 UTC on October 1st is still September 30th in Chicago.
    const now = new Date("2026-10-01T02:00:00Z");
    expect(exactMonthStartIso("America/Chicago", now)).toBe("2026-09-01T05:00:00.000Z");
  });

  it("reads an unknown zone as UTC", () => {
    expect(exactMonthStartIso("Not/AZone", new Date("2026-09-29T15:00:00Z"))).toBe(
      "2026-09-01T00:00:00.000Z",
    );
  });
});

describe("aiUsageLine", () => {
  it("reads as the Settings card's line, compact and singular where it should be", () => {
    expect(aiUsageLine({ requests: 128, inputTokens: 412_300, outputTokens: 38_000 })).toBe(
      "128 requests · 412.3K tokens in · 38K out, this month",
    );
    expect(aiUsageLine({ requests: 1, inputTokens: 900, outputTokens: 40 })).toBe(
      "1 request · 900 tokens in · 40 out, this month",
    );
    expect(aiUsageLine({ requests: 2400, inputTokens: 3_100_000, outputTokens: 0 })).toBe(
      "2,400 requests · 3.1M tokens in · 0 out, this month",
    );
  });
});
