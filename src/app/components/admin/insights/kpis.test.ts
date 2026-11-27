import { describe, expect, it } from "vitest";
import { KPIS } from "./kpis";
import { METRIC_DOT } from "./TrendCard";

describe("KPIS", () => {
  it("gives each number with a chart series that series' dot", () => {
    for (const { key, series } of KPIS) {
      if (key in METRIC_DOT) expect(series).toBe(METRIC_DOT[key as keyof typeof METRIC_DOT]);
    }
    expect(KPIS.filter((k) => k.series).map((k) => k.key)).toEqual(["exports", "opens", "posted"]);
  });

  it("gives Active members no dot, since it has no series", () => {
    expect(KPIS.find((k) => k.key === "activeMembers")?.series).toBeUndefined();
  });
});
