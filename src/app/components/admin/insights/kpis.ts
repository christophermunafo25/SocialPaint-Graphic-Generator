import type { Insights } from "@/lib/insights/buildInsights";
import type { SegmentDot } from "../../primitives";
import { METRIC_DOT } from "./TrendCard";

/** The four headline numbers on Insights. Exports, Opens and Posted carry
 * their chart series' dot, taken from the chart's own map so a number, its
 * segment and its bars share one colour; Active members has no series, so
 * no dot (premium polish D14). */
export const KPIS: { key: keyof Insights["kpis"]; label: string; series?: SegmentDot }[] = [
  { key: "exports", label: "Exports", series: METRIC_DOT.exports },
  { key: "opens", label: "Opens", series: METRIC_DOT.opens },
  { key: "posted", label: "Posted to LinkedIn", series: METRIC_DOT.posted },
  { key: "activeMembers", label: "Active members" },
];
