import { describe, expect, it } from "vitest";
import { builderUsageLine, editedAgo } from "./builderMeta";

// Local time, mid-afternoon, so "the same day" has hours on both sides.
const NOW = new Date(2026, 10, 16, 15, 0, 0);
const at = (days: number, hours = 15, minutes = 0) =>
  new Date(2026, 10, 16 - days, hours, minutes, 0).toISOString();

describe("builderUsageLine", () => {
  it("counts a published template's downloads", () => {
    const published = { status: "published" as const, updatedAt: at(3) };
    expect(builderUsageLine(published, 128, NOW)).toBe("128 downloads");
    expect(builderUsageLine(published, 1, NOW)).toBe("1 download");
    expect(builderUsageLine(published, 0, NOW)).toBe("Not used yet");
  });

  it("says nothing about usage it has not loaded", () => {
    expect(builderUsageLine({ status: "published", updatedAt: at(0) }, null, NOW)).toBe("");
  });

  it("dates a draft's last edit", () => {
    expect(builderUsageLine({ status: "draft", updatedAt: at(0, 13) }, 40, NOW)).toBe(
      "Edited 2 hours ago",
    );
  });
});

describe("editedAgo", () => {
  it("counts minutes, then hours within the day", () => {
    expect(editedAgo(at(0, 14, 59), NOW)).toBe("1 minute ago");
    expect(editedAgo(new Date(NOW.getTime() - 20_000).toISOString(), NOW)).toBe("just now");
    expect(editedAgo(at(0, 14, 15), NOW)).toBe("45 minutes ago");
    expect(editedAgo(at(0, 1), NOW)).toBe("14 hours ago");
  });

  it("names the day before as yesterday, then days, then the date", () => {
    expect(editedAgo(at(1, 23), NOW)).toBe("yesterday");
    expect(editedAgo(at(3), NOW)).toBe("3 days ago");
    expect(editedAgo(at(40), NOW)).toBe(
      new Date(at(40)).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    );
  });
});
