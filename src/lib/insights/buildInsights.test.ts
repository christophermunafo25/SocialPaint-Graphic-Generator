import { describe, expect, it } from "vitest";
import type { InsightEvent, TemplateSchema } from "../types";
import type { Member } from "../stores/interfaces";
import { buildInsights, insightWindowStartIso, type InsightsRange } from "./buildInsights";

/** A fixed clock (a Tuesday) so window math is deterministic. */
const NOW = new Date("2026-09-15T12:00:00Z");

const event = (over: Partial<InsightEvent> & { createdAt: string }): InsightEvent => ({
  templateId: "t1",
  action: "download",
  actor: "member",
  userId: "u1",
  linkId: null,
  variantId: null,
  ...over,
});

const template = (over: Partial<TemplateSchema> & { id: string }): TemplateSchema => ({
  companyId: "c1",
  name: over.id,
  description: "",
  category: "",
  tags: [],
  status: "published",
  canvasWidth: 1080,
  canvasHeight: 1350,
  backgroundUrl: "",
  fields: [],
  captionTemplate: "",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  ...over,
});

const member = (userId: string): Member => ({ userId, email: `${userId}@x.test`, role: "member" });

const build = (
  events: InsightEvent[],
  over?: {
    templates?: TemplateSchema[];
    members?: Member[];
    range?: InsightsRange;
    timeZone?: string;
  },
) =>
  buildInsights({
    events,
    templates: over?.templates ?? [template({ id: "t1" })],
    members: over?.members ?? [],
    range: over?.range ?? "30d",
    timeZone: over?.timeZone ?? "UTC",
    now: NOW,
  });

describe("buildInsights windows", () => {
  it("compares against the previous window of the same length", () => {
    // 30d current: Aug 17 – Sep 15. Previous: Jul 18 – Aug 16.
    const events = [
      event({ createdAt: "2026-09-01T10:00:00Z" }),
      event({ createdAt: "2026-09-10T10:00:00Z" }),
      event({ createdAt: "2026-09-15T10:00:00Z" }),
      event({ createdAt: "2026-08-01T10:00:00Z" }),
      // Outside both windows entirely:
      event({ createdAt: "2026-07-01T10:00:00Z" }),
    ];
    const insights = build(events);
    expect(insights.kpis.exports.current).toBe(3);
    expect(insights.kpis.exports.previous).toBe(1);
    expect(insights.kpis.exports.change).toEqual({ direction: "up", percent: 200 });
    expect(insights.series.exports).toHaveLength(30);
    expect(insights.series.exports[insights.series.exports.length - 1].date).toBe("2026-09-15");
  });

  it("window edges are inclusive at both ends", () => {
    // 7d current: Sep 9 – Sep 15; previous: Sep 2 – Sep 8.
    const insights = build(
      [
        event({ createdAt: "2026-09-09T00:00:00Z" }),
        event({ createdAt: "2026-09-08T23:59:59Z" }),
        event({ createdAt: "2026-09-02T00:00:00Z" }),
        event({ createdAt: "2026-09-01T23:59:59Z" }),
      ],
      { range: "7d" },
    );
    expect(insights.kpis.exports.current).toBe(1);
    expect(insights.kpis.exports.previous).toBe(2);
  });

  it("reports 'new' when the previous window was zero, 'flat' when both are", () => {
    const insights = build([event({ createdAt: "2026-09-14T10:00:00Z" })]);
    expect(insights.kpis.exports.change).toEqual({ direction: "new" });
    expect(insights.kpis.opens.change).toEqual({ direction: "flat" });
  });

  it("reports 'flat' when the two windows match exactly", () => {
    const insights = build([
      event({ createdAt: "2026-09-14T10:00:00Z" }),
      event({ createdAt: "2026-08-10T10:00:00Z" }),
    ]);
    expect(insights.kpis.exports.change).toEqual({ direction: "flat" });
  });

  it("active members report an absolute delta, not a percent", () => {
    const insights = build(
      [
        event({ createdAt: "2026-09-14T10:00:00Z", userId: "u1" }),
        event({ createdAt: "2026-09-14T11:00:00Z", userId: "u1" }),
        event({ createdAt: "2026-09-14T10:00:00Z", userId: "u2" }),
        event({ createdAt: "2026-09-13T10:00:00Z", userId: "u3" }),
        event({ createdAt: "2026-08-10T10:00:00Z", userId: "u1" }),
      ],
      { members: [member("u1"), member("u2"), member("u3")] },
    );
    expect(insights.kpis.activeMembers.current).toBe(3);
    expect(insights.kpis.activeMembers.previous).toBe(1);
    expect(insights.kpis.activeMembers.change).toEqual({ direction: "up", delta: 2 });
  });
});

describe("buildInsights counting rules", () => {
  it("never counts a bulk export as an export", () => {
    const insights = build([
      event({ action: "bulk_export", createdAt: "2026-09-14T10:00:00Z" }),
      event({ action: "bulk_export", createdAt: "2026-09-14T10:00:00Z" }),
      event({ createdAt: "2026-09-14T10:00:00Z" }),
    ]);
    expect(insights.kpis.exports.current).toBe(1);
    expect(insights.templateRows[0].bulk).toBe(2);
    expect(insights.templateRows[0].exports).toBe(1);
  });

  it("counts a public event once, as a subset — never on top", () => {
    const insights = build([
      event({ createdAt: "2026-09-14T10:00:00Z", actor: "public", userId: null, linkId: "l1" }),
      event({ createdAt: "2026-09-14T11:00:00Z" }),
    ]);
    expect(insights.kpis.exports.current).toBe(2);
    expect(insights.templateRows[0].exports).toBe(2);
    expect(insights.templateRows[0].publicDownloads).toBe(1);
    // A public event has no user and never counts a member active.
    expect(insights.kpis.activeMembers.current).toBe(1);
  });
});

describe("buildInsights timezone boundaries", () => {
  it("buckets days and weekdays in the workspace zone, not UTC", () => {
    // 2026-09-13T02:00Z is Sunday 13th in UTC but Saturday 12th evening in
    // Los Angeles. In the LA workspace it must land on Saturday.
    const insights = build([event({ createdAt: "2026-09-13T02:00:00Z" })], {
      range: "7d",
      timeZone: "America/Los_Angeles",
    });
    const saturday = 5;
    const sunday = 6;
    expect(insights.weekday.totals[saturday]).toBe(1);
    expect(insights.weekday.totals[sunday]).toBe(0);
  });

  it("an event on the zone's today lands in the newest bucket", () => {
    // 2026-09-16T03:00Z is already the 16th in UTC, still the 15th in LA.
    const insights = build([event({ createdAt: "2026-09-16T03:00:00Z" })], {
      range: "7d",
      timeZone: "America/Los_Angeles",
    });
    const last = insights.series.exports[insights.series.exports.length - 1];
    expect(last.current).toBe(1);
  });
});

describe("buildInsights 12-month range", () => {
  it("buckets monthly with the previous 12 months aligned by index", () => {
    const insights = build(
      [
        event({ createdAt: "2026-09-10T10:00:00Z" }), // current, last bucket
        event({ createdAt: "2025-10-05T10:00:00Z" }), // current, first bucket
        event({ createdAt: "2025-09-20T10:00:00Z" }), // previous, last slot
        event({ createdAt: "2024-10-15T10:00:00Z" }), // previous, first slot
        event({ createdAt: "2024-09-15T10:00:00Z" }), // before both windows
      ],
      { range: "12m" },
    );
    expect(insights.series.exports).toHaveLength(12);
    expect(insights.series.exports[0].date).toBe("2025-10");
    expect(insights.series.exports[11].date).toBe("2026-09");
    expect(insights.series.exports[0].current).toBe(1);
    expect(insights.series.exports[11].current).toBe(1);
    expect(insights.series.exports[0].previous).toBe(1); // 2024-10
    expect(insights.series.exports[11].previous).toBe(1); // 2025-09
    expect(insights.kpis.exports.current).toBe(2);
    expect(insights.kpis.exports.previous).toBe(2);
  });
});

describe("buildInsights sizes", () => {
  const sized = [
    template({ id: "p", canvasWidth: 1080, canvasHeight: 1350 }), // Portrait 4:5
    template({ id: "s", canvasWidth: 1080, canvasHeight: 1080 }), // Square 1:1
    template({ id: "v", canvasWidth: 1080, canvasHeight: 1920 }), // Vertical 9:16
    template({ id: "l", canvasWidth: 1200, canvasHeight: 628 }), // Landscape 1.91:1
  ];

  it("labels sizes from the catalogue helpers", () => {
    const insights = build([event({ templateId: "p", createdAt: "2026-09-14T10:00:00Z" })], {
      templates: sized,
    });
    expect(insights.sizes).toEqual([{ label: "Portrait 4:5", exports: 1, percent: 100 }]);
  });

  it("rolls a fourth-and-beyond size into Other, percents summing to 100", () => {
    const at = "2026-09-14T10:00:00Z";
    const events = [
      ...Array.from({ length: 4 }, () => event({ templateId: "p", createdAt: at })),
      ...Array.from({ length: 3 }, () => event({ templateId: "s", createdAt: at })),
      ...Array.from({ length: 2 }, () => event({ templateId: "v", createdAt: at })),
      event({ templateId: "l", createdAt: at }),
    ];
    const insights = build(events, { templates: sized });
    expect(insights.sizes.map((s) => s.label)).toEqual([
      "Portrait 4:5",
      "Square 1:1",
      "Vertical 9:16",
      "Other",
    ]);
    expect(insights.sizes.map((s) => s.exports)).toEqual([4, 3, 2, 1]);
    expect(insights.sizes.reduce((n, s) => n + s.percent, 0)).toBe(100);
  });
});

describe("buildInsights weekday", () => {
  it("the earliest weekday wins a tie for busiest", () => {
    // Wed Sep 9 and Thu Sep 10 get one export each — Wednesday (index 2)
    // must win. (Sep 9 2026 is a Wednesday.)
    const insights = build(
      [event({ createdAt: "2026-09-10T10:00:00Z" }), event({ createdAt: "2026-09-09T10:00:00Z" })],
      { range: "7d" },
    );
    expect(insights.weekday.busiest).toBe(2);
  });

  it("computes weekday and weekend daily averages over calendar days", () => {
    // 7d window Sep 9–15 holds 5 weekdays and 2 weekend days.
    const insights = build(
      [
        event({ createdAt: "2026-09-09T10:00:00Z" }), // Wed
        event({ createdAt: "2026-09-10T10:00:00Z" }), // Thu
        event({ createdAt: "2026-09-12T10:00:00Z" }), // Sat
      ],
      { range: "7d" },
    );
    expect(insights.weekday.weekdayAvg).toBeCloseTo(2 / 5);
    expect(insights.weekday.weekendAvg).toBeCloseTo(1 / 2);
  });
});

describe("buildInsights top templates and findings", () => {
  it("ranks the top five by exports and drops zero-export templates", () => {
    const at = "2026-09-14T10:00:00Z";
    const templates = ["a", "b", "c", "d", "e", "f", "zero"].map((id) => template({ id }));
    const events = templates
      .filter((t) => t.id !== "zero")
      .flatMap((t, i) =>
        Array.from({ length: 6 - i }, () => event({ templateId: t.id, createdAt: at })),
      );
    const insights = build(events, { templates });
    expect(insights.topTemplates.map((t) => t.templateId)).toEqual(["a", "b", "c", "d", "e"]);
    expect(insights.topTemplates[0].exports).toBe(6);
  });

  it("flags a template holding 20% or more of exports", () => {
    const at = "2026-09-14T10:00:00Z";
    const templates = [template({ id: "big" }), template({ id: "small" })];
    const events = [
      ...Array.from({ length: 3 }, () => event({ templateId: "big", createdAt: at })),
      ...Array.from({ length: 7 }, () => event({ templateId: "small", createdAt: at })),
    ];
    const insights = build(events, { templates });
    // "small" leads with 70% — the finding names the TOP template's share.
    expect(insights.findings).toContainEqual({
      kind: "templateShare",
      templateId: "small",
      name: "small",
      percent: 70,
    });
  });

  it("counts inactive members and unused published templates", () => {
    const insights = build(
      [event({ createdAt: "2026-09-14T10:00:00Z", userId: "u1", templateId: "t1" })],
      {
        templates: [
          template({ id: "t1" }),
          template({ id: "t2" }),
          template({ id: "draft", status: "draft" }),
        ],
        members: [member("u1"), member("u2"), member("u3")],
      },
    );
    expect(insights.findings).toContainEqual({ kind: "inactiveMembers", count: 2 });
    // The draft is not counted — only published templates can be "unused".
    expect(insights.findings).toContainEqual({ kind: "unusedTemplates", count: 1 });
  });

  it("flags posting slipping while exports grew", () => {
    const cur = "2026-09-14T10:00:00Z";
    const prev = "2026-08-10T10:00:00Z";
    const insights = build([
      // Exports: 1 → 2 (up). Posted: 2 → 1 (down 50%).
      event({ createdAt: prev }),
      event({ createdAt: cur }),
      event({ createdAt: cur }),
      event({ action: "share", createdAt: prev }),
      event({ action: "share", createdAt: prev }),
      event({ action: "share", createdAt: cur }),
    ]);
    expect(insights.findings).toContainEqual({ kind: "postingSlipped", percent: 50 });
  });
});

describe("insightWindowStartIso", () => {
  it("starts a day before the previous window, generously", () => {
    // 30d previous window starts Jul 18; the fetch starts Jul 17 UTC.
    expect(insightWindowStartIso("30d", "UTC", NOW)).toBe("2026-07-17T00:00:00.000Z");
  });

  it("covers 24 months for the 12m range", () => {
    expect(insightWindowStartIso("12m", "UTC", NOW)).toBe("2024-09-30T00:00:00.000Z");
  });
});
