import { describe, expect, it } from "vitest";
import { bucketDailyActivity } from "./dailyActivity";

/** `days` ago at noon, so a timezone shift can't slide the event into a
 * neighbouring bucket and make this suite flaky. */
const daysAgo = (n: number): string => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d.toISOString();
};

describe("bucketDailyActivity", () => {
  it("zero-fills every day in the window", () => {
    const points = bucketDailyActivity([], 7);
    expect(points).toHaveLength(7);
    expect(points.every((p) => p.opens === 0 && p.downloads === 0)).toBe(true);
    expect(points.every((p) => p.publicOpens === 0 && p.publicDownloads === 0)).toBe(true);
  });

  it("counts public events in BOTH the total and the public subset", () => {
    // The chart draws the public series as an overlay, not a stacked band —
    // if these were mutually exclusive the totals would read low.
    const points = bucketDailyActivity(
      [
        { action: "open", actor: "public", createdAt: daysAgo(0) },
        { action: "download", actor: "public", createdAt: daysAgo(0) },
      ],
      3,
    );
    const today = points[points.length - 1];
    expect(today).toMatchObject({ opens: 1, downloads: 1, publicOpens: 1, publicDownloads: 1 });
  });

  it("keeps member events out of the public subset", () => {
    const points = bucketDailyActivity(
      [
        { action: "open", actor: "member", createdAt: daysAgo(0) },
        { action: "download", actor: "member", createdAt: daysAgo(0) },
      ],
      3,
    );
    const today = points[points.length - 1];
    expect(today).toMatchObject({ opens: 1, downloads: 1, publicOpens: 0, publicDownloads: 0 });
  });

  it("treats an event with no actor as a member event", () => {
    // Rows written before the column existed, and every row the local dev
    // backend writes — neither is public traffic.
    const points = bucketDailyActivity([{ action: "download", createdAt: daysAgo(0) }], 3);
    const today = points[points.length - 1];
    expect(today).toMatchObject({ downloads: 1, publicDownloads: 0 });
  });

  it("mixes both actors on the same day", () => {
    const points = bucketDailyActivity(
      [
        { action: "download", actor: "member", createdAt: daysAgo(1) },
        { action: "download", actor: "public", createdAt: daysAgo(1) },
        { action: "download", actor: "public", createdAt: daysAgo(1) },
      ],
      5,
    );
    const yesterday = points[points.length - 2];
    expect(yesterday).toMatchObject({ downloads: 3, publicDownloads: 2 });
  });

  it("drops events older than the window", () => {
    const points = bucketDailyActivity(
      [{ action: "open", actor: "public", createdAt: daysAgo(30) }],
      7,
    );
    expect(points.reduce((n, p) => n + p.opens + p.publicOpens, 0)).toBe(0);
  });

  it("returns the days in chronological order", () => {
    const dates = bucketDailyActivity([], 5).map((p) => p.date);
    expect([...dates].sort()).toEqual(dates);
  });
});
