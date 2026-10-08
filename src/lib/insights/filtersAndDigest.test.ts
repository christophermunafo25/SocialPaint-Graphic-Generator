import { describe, expect, it } from "vitest";
import type { InsightEvent, TemplateSchema } from "../types";
import {
  buildInsights,
  dayPartOf,
  hourInZone,
  platformsInUse,
  PUBLIC_MEMBER,
  type InsightsFilters,
  type InsightsRange,
} from "./buildInsights";
import { digestHeading, digestSentence, windowDates } from "./digest";

/** A Tuesday, as the existing tests use. */
const NOW = new Date("2026-09-15T12:00:00Z");

const event = (over: Partial<InsightEvent> & { createdAt: string }): InsightEvent => ({
  templateId: "square",
  action: "download",
  actor: "member",
  userId: "u1",
  linkId: null,
  variantId: null,
  ...over,
});

const template = (id: string, w: number, h: number, name = id): TemplateSchema =>
  ({
    id,
    companyId: "c1",
    name,
    status: "published",
    canvasWidth: w,
    canvasHeight: h,
    fields: [],
  }) as unknown as TemplateSchema;

const TEMPLATES = [
  template("square", 1080, 1080, "Stat highlight"),
  template("story", 1080, 1920, "Event promo"),
  template("link", 1200, 627, "Partner card"),
];

const build = (events: InsightEvent[], filters?: InsightsFilters, range: InsightsRange = "30d") =>
  buildInsights({
    events,
    templates: TEMPLATES,
    range,
    timeZone: "America/Chicago",
    filters,
    now: NOW,
  });

const EVENTS: InsightEvent[] = [
  // Tuesday Sep 8, 9am Chicago: three square exports by u1.
  event({ createdAt: "2026-09-08T14:00:00Z" }),
  event({ createdAt: "2026-09-08T14:10:00Z" }),
  event({ createdAt: "2026-09-08T14:20:00Z" }),
  // A story export by u2, Thursday afternoon.
  event({ templateId: "story", userId: "u2", createdAt: "2026-09-10T20:00:00Z" }),
  // A public download of the square template.
  event({ actor: "public", userId: null, linkId: "l1", createdAt: "2026-09-11T15:00:00Z" }),
];

describe("filters (PHASE-8 §2)", () => {
  it("narrows by template", () => {
    expect(build(EVENTS, { templateId: "story" }).kpis.exports.current).toBe(1);
  });

  it("narrows by member, and Active members to that member", () => {
    const i = build(EVENTS, { member: "u2" });
    expect(i.kpis.exports.current).toBe(1);
    expect(i.kpis.activeMembers.current).toBe(1);
  });

  it("'Public links' keeps only public-link events (D4)", () => {
    const i = build(EVENTS, { member: PUBLIC_MEMBER });
    expect(i.kpis.exports.current).toBe(1);
    expect(i.kpis.activeMembers.current).toBe(0);
  });

  it("narrows by platform through the template's size", () => {
    // 1080×1920 is the one TikTok size here.
    expect(build(EVENTS, { platform: "tiktok" }).kpis.exports.current).toBe(1);
    // 1080×1920 serves LinkedIn too; 1080×1080 is Instagram and Facebook
    // only, so the square exports don't count.
    expect(build(EVENTS, { platform: "linkedin" }).kpis.exports.current).toBe(1);
    expect(build(EVENTS, { platform: "facebook" }).kpis.exports.current).toBe(5);
    // Out-of-scope templates leave the CSV rows.
    expect(build(EVENTS, { platform: "tiktok" }).templateRows.map((r) => r.templateId)).toEqual([
      "story",
    ]);
  });

  it("lists the platforms in use, in the fixed platform order", () => {
    const used = platformsInUse(TEMPLATES);
    expect(used.length).toBeGreaterThan(0);
    expect(used).toContain("tiktok");
    expect(used).toContain("linkedin");
    expect(used.indexOf("linkedin")).toBeLessThan(used.indexOf("tiktok"));
  });
});

describe("window and busiest slot", () => {
  it("returns the current window's first and last day", () => {
    expect(build(EVENTS).window).toEqual({ start: "2026-08-17", end: "2026-09-15" });
  });

  it("finds the weekday and part of day with the most exports, in the workspace zone", () => {
    expect(build(EVENTS).busiestSlot).toEqual({ weekday: 1, part: "morning" });
    expect(build([]).busiestSlot).toBeNull();
  });

  it("reads hours in a zone and names the part of day", () => {
    expect(hourInZone("2026-09-08T14:00:00Z", "America/Chicago")).toBe(9);
    expect(dayPartOf(9)).toBe("morning");
    expect(dayPartOf(12)).toBe("afternoon");
    expect(dayPartOf(18)).toBe("evening");
    expect(dayPartOf(23)).toBe("night");
    expect(dayPartOf(3)).toBe("night");
  });
});

describe("digest (D5)", () => {
  it("takes its heading and dates from the range", () => {
    expect(digestHeading("30d")).toBe("Your last 30 days in brief");
    expect(digestHeading("12m")).toBe("Your last 12 months in brief");
    expect(windowDates({ start: "2026-08-17", end: "2026-09-15" }, "30d")).toBe("Aug 17 to Sep 15");
    expect(windowDates({ start: "2025-12-20", end: "2026-01-18" }, "30d")).toBe(
      "Dec 20, 2025 to Jan 18, 2026",
    );
    expect(windowDates({ start: "2025-10-01", end: "2026-09-15" }, "12m")).toBe(
      "Oct 2025 to Sep 2026",
    );
  });

  it("writes one sentence from the numbers: the change, the leading template, the busiest slot", () => {
    const previous = event({ createdAt: "2026-08-05T15:00:00Z" });
    const sentence = digestSentence(build([...EVENTS, previous]), "30d", false);
    expect(sentence).toBe(
      "Your team exported 5 graphics, 400% more than the previous 30 days. Stat highlight drove 80% of them, and Tuesday mornings were the busiest.",
    );
  });

  it("says new, flat and empty plainly", () => {
    expect(digestSentence(build(EVENTS), "30d", false)).toMatch(
      /^Your team exported 5 graphics, none in the previous 30 days\./,
    );
    expect(digestSentence(build([]), "7d", false)).toBe("No exports in the last 7 days.");
    expect(digestSentence(build([], { member: "u2" }), "30d", true)).toBe(
      "No exports match these filters.",
    );
  });
});
