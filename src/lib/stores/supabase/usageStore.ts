import type { DailyActivityPoint, UsageAction, UsageSummary, UsageSummaryRow } from "../../types";
import type { UsageStore } from "../interfaces";
import { bucketDailyActivity } from "../dailyActivity";
import { supabase } from "./client";

interface EventRow {
  template_id: string;
  action: UsageAction;
  actor: "member" | "public";
  created_at: string;
  templates: { name: string } | null;
}

export class SupabaseUsageStore implements UsageStore {
  async record(
    companyId: string,
    templateId: string,
    action: UsageAction,
    userId?: string,
  ): Promise<void> {
    try {
      await supabase()
        .from("usage_events")
        .insert({
          company_id: companyId,
          template_id: templateId,
          action,
          user_id: userId ?? null,
          // The member path is the only thing that reaches this store. A
          // public fill is written server-side by the link's own endpoint,
          // and the insert policy refuses a client that claims otherwise.
          actor: "member",
        });
    } catch (e) {
      // Instrumentation must never break the member flow.
      console.warn("usage_events insert failed", e);
    }
  }

  async getUsageSummary(companyId: string): Promise<UsageSummary> {
    const { data, error } = await supabase()
      .from("usage_events")
      .select("template_id, action, actor, created_at, templates(name)")
      .eq("company_id", companyId);
    if (error) throw error;
    const byTemplate = new Map<string, UsageSummaryRow>();
    for (const e of data as unknown as EventRow[]) {
      const row = byTemplate.get(e.template_id) ?? {
        templateId: e.template_id,
        templateName: e.templates?.name ?? "(deleted template)",
        opens: 0,
        downloads: 0,
        publicOpens: 0,
        publicDownloads: 0,
        lastUsedAt: null,
      };
      if (e.action === "open") {
        row.opens += 1;
        if (e.actor === "public") row.publicOpens += 1;
      } else {
        row.downloads += 1;
        if (e.actor === "public") row.publicDownloads += 1;
      }
      if (!row.lastUsedAt || e.created_at > row.lastUsedAt) row.lastUsedAt = e.created_at;
      byTemplate.set(e.template_id, row);
    }
    const rows = [...byTemplate.values()].sort(
      (a, b) => b.downloads - a.downloads || b.opens - a.opens,
    );
    return { rows, totalDownloads: rows.reduce((n, r) => n + r.downloads, 0) };
  }

  async getDailyActivity(companyId: string, days: number): Promise<DailyActivityPoint[]> {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (days - 1));
    const { data, error } = await supabase()
      .from("usage_events")
      .select("action, created_at")
      .eq("company_id", companyId)
      .gte("created_at", since.toISOString());
    if (error) throw error;
    return bucketDailyActivity(
      (data as Array<{ action: UsageAction; created_at: string }>).map((e) => ({
        action: e.action,
        createdAt: e.created_at,
      })),
      days,
    );
  }
}
