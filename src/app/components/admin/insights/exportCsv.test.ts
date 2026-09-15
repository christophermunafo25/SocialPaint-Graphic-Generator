import { describe, expect, it } from "vitest";
import type { InsightTemplateRow } from "@/lib/insights/buildInsights";
import { insightsCsv } from "./exportCsv";

const row = (over: Partial<InsightTemplateRow>): InsightTemplateRow => ({
  templateId: "t1",
  name: "Plain",
  opens: 10,
  exports: 5,
  posted: 1,
  bulk: 0,
  publicDownloads: 2,
  lastUsedAt: "2026-09-14T10:00:00Z",
  ...over,
});

describe("insightsCsv", () => {
  it("writes the eight columns with a computed export rate", () => {
    const csv = insightsCsv([row({})]);
    expect(csv.split("\n")[0]).toBe(
      "Template,Opens,Exports,Export rate,Posted,Through public links,Bulk exports,Last used",
    );
    expect(csv.split("\n")[1]).toBe("Plain,10,5,50%,1,2,0,2026-09-14T10:00:00Z");
  });

  it("escapes commas and quotes in template names", () => {
    const csv = insightsCsv([row({ name: 'Launch, "big" one' })]);
    expect(csv.split("\n")[1].startsWith('"Launch, ""big"" one",')).toBe(true);
  });

  it("dashes the export rate at zero opens and blanks a never-used date", () => {
    const csv = insightsCsv([row({ opens: 0, exports: 0, lastUsedAt: null })]);
    const cells = csv.split("\n")[1].split(",");
    expect(cells[3]).toBe("—");
    expect(cells[7]).toBe("");
  });
});
