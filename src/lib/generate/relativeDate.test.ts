import { describe, expect, it } from "vitest";
import type { PlatformId } from "../templates/platforms";
import { chatMeta, relativeDate } from "./relativeDate";

// Local-time constructors throughout, so the day boundaries under test are
// the test machine's own, whatever its zone (as they are the member's in
// the browser).
const at = (y: number, m: number, d: number, h = 12, min = 0) =>
  new Date(y, m - 1, d, h, min).toISOString();

const NOW = new Date(2026, 8, 26, 15, 0); // Sep 26, 2026, 3pm local

describe("relativeDate", () => {
  it("says Today for any time today", () => {
    expect(relativeDate(at(2026, 9, 26, 0, 0), NOW)).toBe("Today");
    expect(relativeDate(at(2026, 9, 26, 14, 59), NOW)).toBe("Today");
  });

  it("says Today for a little later today (a clock running ahead)", () => {
    expect(relativeDate(at(2026, 9, 26, 23, 59), NOW)).toBe("Today");
  });

  it("says Yesterday for any time yesterday", () => {
    expect(relativeDate(at(2026, 9, 25, 0, 0), NOW)).toBe("Yesterday");
    expect(relativeDate(at(2026, 9, 25, 23, 59), NOW)).toBe("Yesterday");
  });

  it("gives month and day for earlier this year", () => {
    expect(relativeDate(at(2026, 9, 24, 23, 59), NOW)).toBe("Sep 24");
    expect(relativeDate(at(2026, 9, 19), NOW)).toBe("Sep 19");
    expect(relativeDate(at(2026, 9, 5), NOW)).toBe("Sep 5");
    expect(relativeDate(at(2026, 1, 1, 0, 0), NOW)).toBe("Jan 1");
  });

  it("adds the year for another year", () => {
    expect(relativeDate(at(2025, 12, 31), NOW)).toBe("Dec 31, 2025");
    expect(relativeDate(at(2024, 3, 7), NOW)).toBe("Mar 7, 2024");
  });

  it("prefers Yesterday across New Year", () => {
    const newYear = new Date(2027, 0, 1, 9, 0);
    expect(relativeDate(at(2026, 12, 31, 20), newYear)).toBe("Yesterday");
    expect(relativeDate(at(2026, 12, 30, 20), newYear)).toBe("Dec 30, 2026");
  });

  it("reads Postgres's six fractional digits and offset", () => {
    const iso = "2026-09-26T10:15:30.123456+00:00";
    expect(relativeDate(iso, new Date(Date.UTC(2026, 8, 26, 10, 15, 30)))).toBe("Today");
  });

  it("is empty for a timestamp that does not parse", () => {
    expect(relativeDate("", NOW)).toBe("");
    expect(relativeDate("not a date", NOW)).toBe("");
  });
});

describe("chatMeta", () => {
  it("joins the platform labels, then the date", () => {
    expect(chatMeta(["instagram", "linkedin"], at(2026, 9, 26), NOW)).toBe(
      "Instagram, LinkedIn · Today",
    );
    expect(chatMeta(["facebook"], at(2026, 9, 19), NOW)).toBe("Facebook · Sep 19");
  });

  it("keeps the order it is given", () => {
    expect(chatMeta(["linkedin", "instagram"], at(2026, 9, 25), NOW)).toBe(
      "LinkedIn, Instagram · Yesterday",
    );
  });

  it("is the date alone for a chat with no platforms", () => {
    expect(chatMeta([], at(2025, 5, 2), NOW)).toBe("May 2, 2025");
  });

  it("skips an id this build does not know", () => {
    expect(chatMeta(["myspace" as PlatformId, "x"], at(2026, 9, 26), NOW)).toBe("X · Today");
  });

  it("is the platforms alone when the date does not parse", () => {
    expect(chatMeta(["instagram"], "", NOW)).toBe("Instagram");
  });
});
